-- Regra absoluta do projeto: TODO lead novo cai num funil do Kanban.
--
-- Antes, o código em backend (`ensureCardForLead`) cobria isso, MAS só pra
-- leads criados via rotas Fastify (POST /api/leads, webhook Evolution,
-- cotação placa). O SITE público (Next.js) escreve direto na tabela `leads`
-- via Supabase REST com service_role_key — pulando o Fastify — e por isso
-- 57 leads/dia ficavam sem card.
--
-- Esse trigger move a regra pro NÍVEL DO BANCO: qualquer INSERT em `leads`
-- (vindo do CRM, do site, do n8n, de SQL manual, etc.) gera card automático.
--
-- Robustez:
--  - EXCEPTION OTHERS: se a função falhar, loga WARNING mas NUNCA bloqueia
--    o INSERT do lead. Lead sempre é gravado.
--  - Idempotência: se já existe card com mesmo (company_id, title), pula.
--  - Tipo (consultor vs associado): mesma heurística do TS — analisa
--    `origem` e `qualificado_por`. Fallback é associado.
--  - Sem pipe/phase compatível: pula silenciosamente (não trava).
--  - Sem user com company_id: pula silenciosamente.

CREATE OR REPLACE FUNCTION fn_ensure_card_for_lead() RETURNS TRIGGER AS $$
DECLARE
  v_pipe_id        TEXT;
  v_phase_id       TEXT;
  v_creator_id     TEXT;
  v_tipo           TEXT;
  v_keyword        TEXT;
  v_description    TEXT;
BEGIN
  BEGIN
    -- Resolve tipo
    IF COALESCE(NEW.origem, '') ILIKE '%consultor%'
       OR COALESCE(NEW.qualificado_por, '') ILIKE '%consultor%' THEN
      v_tipo := 'consultor';
      v_keyword := 'consultor';
    ELSE
      v_tipo := 'associado';
      v_keyword := 'associad';  -- match em "associado", "associados"
    END IF;

    -- Acha pipe da company que combine com o tipo
    SELECT p.id INTO v_pipe_id
    FROM pipes p
    WHERE p.company_id = NEW.company_id
      AND COALESCE(p.status, 'active') = 'active'
      AND LOWER(p.name) LIKE '%' || v_keyword || '%'
    ORDER BY p.created_at ASC
    LIMIT 1;

    IF v_pipe_id IS NULL THEN
      RAISE NOTICE 'fn_ensure_card_for_lead: pipe % não encontrado pra company %', v_keyword, NEW.company_id;
      RETURN NEW;
    END IF;

    -- 1a fase do pipe
    SELECT ph.id INTO v_phase_id
    FROM phases ph
    WHERE ph.pipe_id = v_pipe_id
    ORDER BY ph.position ASC
    LIMIT 1;

    IF v_phase_id IS NULL THEN
      RAISE NOTICE 'fn_ensure_card_for_lead: pipe % sem fases', v_pipe_id;
      RETURN NEW;
    END IF;

    -- Idempotência: já existe card com mesmo title?
    IF EXISTS (
      SELECT 1 FROM cards c
      WHERE c.company_id = NEW.company_id
        AND c.title = NEW.nome
    ) THEN
      RETURN NEW;
    END IF;

    -- Resolve creator: vendedor do lead > admin da company > qualquer user
    v_creator_id := NEW.vendedor_id;
    IF v_creator_id IS NULL THEN
      SELECT id INTO v_creator_id
      FROM users
      WHERE company_id = NEW.company_id
      ORDER BY (CASE WHEN role = 'admin' THEN 0 ELSE 1 END) ASC,
               created_at ASC
      LIMIT 1;
    END IF;

    IF v_creator_id IS NULL THEN
      RAISE NOTICE 'fn_ensure_card_for_lead: nenhum user na company %', NEW.company_id;
      RETURN NEW;
    END IF;

    v_description := 'Lead ' || v_tipo
      || ' — origem: ' || COALESCE(NEW.origem, '-')
      || COALESCE(' — ' || NEW.whatsapp, '')
      || ' — auto (trigger)';

    INSERT INTO cards (
      id, company_id, pipe_id, current_phase_id, title, description,
      status, created_by_id, assigned_to_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text,
      NEW.company_id,
      v_pipe_id,
      v_phase_id,
      NEW.nome,
      v_description,
      'active',
      v_creator_id,
      NEW.vendedor_id,
      NOW(),
      NOW()
    );

  EXCEPTION WHEN OTHERS THEN
    -- NUNCA bloqueia o INSERT do lead. Loga e segue.
    RAISE WARNING 'fn_ensure_card_for_lead falhou pra lead %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ensure_card_on_lead ON leads;

CREATE TRIGGER trg_ensure_card_on_lead
  AFTER INSERT ON leads
  FOR EACH ROW
  EXECUTE FUNCTION fn_ensure_card_for_lead();
