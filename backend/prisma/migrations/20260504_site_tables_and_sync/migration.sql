-- ============================================================================
-- 21Go — Migration 2026-05-04
-- Cria as 3 tabelas que o site Next.js (21go-website) espera escrever:
--   1) lead_attribution        — leads vindos dos formulários do site
--   2) outbound_event_log      — log de eventos enviados pra PowerCRM/Hinova
--   3) webhook_inbound_log     — log de webhooks recebidos do PowerCRM
--
-- Cria também um TRIGGER que espelha cada INSERT em lead_attribution
-- na tabela `leads` do CRM, pro agente IA enxergar a base unificada.
--
-- SEGURO: usa IF NOT EXISTS em tudo. Pode rodar 2x sem quebrar nada.
-- NÃO altera nenhuma tabela existente. NÃO derruba o site.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1) lead_attribution — leads brutos do site
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lead_attribution (
  id                          uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  trk                         text          UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),

  -- Identificação do lead
  nome                        text          NOT NULL,
  email                       text,
  telefone                    text          NOT NULL,
  cpf                         text,

  -- Dados do veículo cotado
  placa                       text,
  fipe_codigo                 text,
  marca                       text,
  modelo                      text,
  ano_modelo                  integer,
  ano_fabricacao              integer,
  plano_interesse             text,

  -- Localização
  cidade                      text,
  estado                      text,

  -- Click IDs (Google/Meta)
  gclid                       text,
  gbraid                      text,
  wbraid                      text,
  fbclid                      text,
  fbp                         text,
  fbc                         text,
  ga_client_id                text,
  external_id                 text,

  -- UTMs
  utm_source                  text,
  utm_medium                  text,
  utm_campaign                text,
  utm_content                 text,
  utm_term                    text,

  -- Contexto da requisição
  landing_page                text,
  referrer                    text,
  client_ip                   text,
  client_user_agent           text,

  -- Tracking de conversão
  event_id                    text,
  value_cents                 integer,

  -- Integração PowerCRM/Hinova
  quotation_code              text,
  negotiation_code            text,
  status                      text          DEFAULT 'NEW',
  -- valores possíveis: NEW | RECEIVED | IN_NEGOTIATION | INSPECTION | RELEASED_FOR_REGISTRATION | COMPLETED
  powercrm_add_response       jsonb,
  powercrm_update_response    jsonb,
  completed_at                timestamptz,

  -- Flags de envio de conversão offline
  gads_sent_at                timestamptz,
  meta_capi_sent_at           timestamptz,
  ga4_mp_sent_at              timestamptz,

  -- Vínculo com lead consolidado no CRM (preenchido pelo trigger)
  crm_lead_id                 text,

  created_at                  timestamptz   NOT NULL DEFAULT now(),
  updated_at                  timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lead_attribution_telefone     ON public.lead_attribution (telefone);
CREATE INDEX IF NOT EXISTS idx_lead_attribution_email        ON public.lead_attribution (email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_cpf          ON public.lead_attribution (cpf) WHERE cpf IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_status       ON public.lead_attribution (status);
CREATE INDEX IF NOT EXISTS idx_lead_attribution_quotation    ON public.lead_attribution (quotation_code) WHERE quotation_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_negotiation  ON public.lead_attribution (negotiation_code) WHERE negotiation_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_gclid        ON public.lead_attribution (gclid) WHERE gclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_fbclid       ON public.lead_attribution (fbclid) WHERE fbclid IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lead_attribution_created_at   ON public.lead_attribution (created_at DESC);

COMMENT ON TABLE public.lead_attribution IS
  'Leads brutos capturados pelo site (cotação, consultor, etc). Espelhados em public.leads via trigger.';


-- ----------------------------------------------------------------------------
-- 2) outbound_event_log — log de chamadas enviadas pra integrações externas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outbound_event_log (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_attribution_id    uuid           REFERENCES public.lead_attribution(id) ON DELETE SET NULL,

  kind                   text           NOT NULL,
  -- valores: powerapi_add | powerapi_update | powerapi_get_negotiation | gads_capi | meta_capi | ga4_mp

  request_payload        jsonb,
  response_payload       jsonb,
  status_code            integer,
  latency_ms             integer,
  error                  text,

  created_at             timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_event_log_lead       ON public.outbound_event_log (lead_attribution_id);
CREATE INDEX IF NOT EXISTS idx_outbound_event_log_kind       ON public.outbound_event_log (kind, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outbound_event_log_created_at ON public.outbound_event_log (created_at DESC);

COMMENT ON TABLE public.outbound_event_log IS
  'Log de chamadas para integrações externas (PowerCRM, Google Ads, Meta CAPI, GA4 MP).';


-- ----------------------------------------------------------------------------
-- 3) webhook_inbound_log — webhooks recebidos
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.webhook_inbound_log (
  id                     uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_attribution_id    uuid           REFERENCES public.lead_attribution(id) ON DELETE SET NULL,

  source                 text           NOT NULL,            -- 'powercrm', 'evolution', etc
  path                   text,
  headers                jsonb,
  payload                jsonb,
  status                 text           NOT NULL DEFAULT 'received',
  -- valores: received | processed | ignored | failed

  processed_at           timestamptz,
  error                  text,

  created_at             timestamptz    NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_inbound_log_source     ON public.webhook_inbound_log (source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_inbound_log_status     ON public.webhook_inbound_log (status);
CREATE INDEX IF NOT EXISTS idx_webhook_inbound_log_lead       ON public.webhook_inbound_log (lead_attribution_id);
CREATE INDEX IF NOT EXISTS idx_webhook_inbound_log_created_at ON public.webhook_inbound_log (created_at DESC);

COMMENT ON TABLE public.webhook_inbound_log IS
  'Log de webhooks recebidos de integrações externas (PowerCRM, etc).';


-- ----------------------------------------------------------------------------
-- 4) updated_at automático em lead_attribution
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_attribution_set_updated_at ON public.lead_attribution;
CREATE TRIGGER lead_attribution_set_updated_at
  BEFORE UPDATE ON public.lead_attribution
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();


-- ----------------------------------------------------------------------------
-- 5) TRIGGER de espelhamento — lead_attribution → leads (CRM)
-- Cada lead novo do site cria/atualiza um registro em public.leads
-- pra que o agente IA, vendedor e gestor enxerguem todos os leads num só lugar.
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_lead_attribution_to_leads()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_company_id text;
  v_existing_lead_id text;
  v_origem text;
BEGIN
  -- Resolve company_id: se houver mais de uma empresa, padrão é '21go'
  SELECT id INTO v_company_id
  FROM public.companies
  WHERE slug = '21go'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    SELECT id INTO v_company_id FROM public.companies LIMIT 1;
  END IF;

  IF v_company_id IS NULL THEN
    -- sem company cadastrada, não faz sync (não bloqueia o INSERT no lead_attribution)
    RETURN NEW;
  END IF;

  -- Mapeamento simples de origem
  v_origem := CASE
    WHEN NEW.utm_source IS NULL OR NEW.utm_source = '' THEN 'site_organico'
    WHEN lower(NEW.utm_source) IN ('google') AND lower(coalesce(NEW.utm_medium,'')) IN ('cpc','paid','ads') THEN 'google_ads'
    WHEN lower(NEW.utm_source) IN ('facebook','meta') THEN 'meta_ads'
    WHEN lower(NEW.utm_source) = 'instagram' THEN 'instagram'
    WHEN lower(NEW.utm_source) = 'whatsapp' THEN 'whatsapp'
    ELSE 'outro'
  END;

  -- Procura lead existente no CRM por telefone OU email
  SELECT id INTO v_existing_lead_id
  FROM public.leads
  WHERE company_id = v_company_id
    AND (
      (NEW.telefone IS NOT NULL AND telefone = NEW.telefone)
      OR (NEW.email IS NOT NULL AND email = NEW.email)
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_existing_lead_id IS NOT NULL THEN
    -- Atualiza lead existente com dados novos (não sobrescreve campos preenchidos)
    UPDATE public.leads
    SET
      nome              = COALESCE(nome, NEW.nome),
      telefone          = COALESCE(telefone, NEW.telefone),
      whatsapp          = COALESCE(whatsapp, NEW.telefone),
      email             = COALESCE(email, NEW.email),
      placa_interesse   = COALESCE(placa_interesse, NEW.placa),
      marca_interesse   = COALESCE(marca_interesse, NEW.marca),
      modelo_interesse  = COALESCE(modelo_interesse, NEW.modelo),
      ano_interesse     = COALESCE(ano_interesse, NEW.ano_modelo),
      cotacao_plano     = COALESCE(cotacao_plano, NEW.plano_interesse),
      origem            = COALESCE(origem, v_origem),
      utm_source        = COALESCE(utm_source, NEW.utm_source),
      utm_medium        = COALESCE(utm_medium, NEW.utm_medium),
      utm_campaign      = COALESCE(utm_campaign, NEW.utm_campaign),
      utm_content       = COALESCE(utm_content, NEW.utm_content),
      utm_term          = COALESCE(utm_term, NEW.utm_term),
      gclid             = COALESCE(gclid, NEW.gclid),
      fbclid            = COALESCE(fbclid, NEW.fbclid),
      fbp               = COALESCE(fbp, NEW.fbp),
      fbc               = COALESCE(fbc, NEW.fbc),
      ip_address        = COALESCE(ip_address, NEW.client_ip),
      user_agent        = COALESCE(user_agent, NEW.client_user_agent),
      updated_at        = now()
    WHERE id = v_existing_lead_id;

    NEW.crm_lead_id := v_existing_lead_id;
  ELSE
    -- Cria novo lead no CRM
    v_existing_lead_id := 'lead_' || replace(NEW.id::text, '-', '');
    INSERT INTO public.leads (
      id, company_id,
      nome, telefone, whatsapp, email,
      placa_interesse, marca_interesse, modelo_interesse, ano_interesse,
      cotacao_plano,
      etapa_funil, status, qualificado_por, score_qualificacao,
      origem, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
      gclid, fbclid, fbp, fbc, ip_address, user_agent,
      cotacao_enviada, meta_capi_sent, google_ads_sent,
      follow_up_enviado, reengajamento_enviado, carro_app,
      whatsapp_clicado, pdf_enviado,
      created_at, updated_at
    ) VALUES (
      v_existing_lead_id, v_company_id,
      NEW.nome, NEW.telefone, NEW.telefone, NEW.email,
      NEW.placa, NEW.marca, NEW.modelo, NEW.ano_modelo,
      NEW.plano_interesse,
      'novo', 'lead', 'site', 0,
      v_origem, NEW.utm_source, NEW.utm_medium, NEW.utm_campaign, NEW.utm_content, NEW.utm_term,
      NEW.gclid, NEW.fbclid, NEW.fbp, NEW.fbc, NEW.client_ip, NEW.client_user_agent,
      false, false, false,
      false, false, false,
      false, false,
      now(), now()
    );

    NEW.crm_lead_id := v_existing_lead_id;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Falha no sync NÃO bloqueia o INSERT em lead_attribution.
    -- Site continua funcionando mesmo se algo der errado no CRM.
    RAISE WARNING 'sync_lead_attribution_to_leads falhou: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_attribution_sync_to_leads ON public.lead_attribution;
CREATE TRIGGER lead_attribution_sync_to_leads
  BEFORE INSERT ON public.lead_attribution
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_attribution_to_leads();


-- ----------------------------------------------------------------------------
-- 6) Permissões pro service_role (sempre ativo no Supabase)
-- ----------------------------------------------------------------------------
GRANT ALL ON public.lead_attribution     TO service_role;
GRANT ALL ON public.outbound_event_log   TO service_role;
GRANT ALL ON public.webhook_inbound_log  TO service_role;

-- Mantém RLS desabilitado pra ficar consistente com as outras tabelas do CRM.
-- ALTER TABLE public.lead_attribution     ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.outbound_event_log   ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE public.webhook_inbound_log  ENABLE ROW LEVEL SECURITY;
