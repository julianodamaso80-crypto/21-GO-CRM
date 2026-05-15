-- ============================================================================
-- FIX: regra absoluta "TODO lead vira card" estava furada por idempotencia
-- ============================================================================
--
-- Problema: o trigger anterior (20260511_auto_card_for_lead_trigger) usava
-- (company_id, title=nome) como chave de idempotencia. Mas o webhook do
-- WhatsApp gera muitos leads com pushName generico ("21 Go", "Voce", ".") —
-- entao 691 leads "21 Go" + 373 leads "Voce" foram colapsados em 1 card cada.
--
-- Resultado em prod: 1898 leads, mas so 791 cards (~1100 leads sem card real).
--
-- Fix:
--   1. Adicionar coluna `lead_id` em `cards` (FK pra leads)
--   2. Trocar a chave de idempotencia do trigger pra lead_id (1:1 com lead)
--   3. Higienizar nome generico: se nome eh '21 Go'/'Voce'/'.', usar
--      "Lead XXXX (sem nome)" com ultimos 4 digitos do whatsapp
--   4. Backfill: linkar cards existentes via whatsapp na description
--   5. Backfill: criar card pra cada lead orfao (sem cards.lead_id linkado)

-- ============================================================================
-- 1. Schema: adicionar coluna lead_id em cards
-- ============================================================================

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS lead_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cards_lead_id_fkey'
  ) THEN
    ALTER TABLE cards
      ADD CONSTRAINT cards_lead_id_fkey
      FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS cards_lead_id_idx ON cards(lead_id);

-- ============================================================================
-- 2. Backfill: linkar cards existentes aos leads correspondentes
-- ============================================================================
-- Estrategia (em ordem de confianca):
--   a) Whatsapp do lead aparece literalmente na description do card
--   b) title=nome E so existe 1 lead com aquele nome (sem ambiguidade)
--   c) Fica NULL (card orfao historico, sem match confiavel)

-- (a) Match por whatsapp na description
WITH lead_digits AS (
  SELECT id, company_id, regexp_replace(COALESCE(whatsapp, telefone, ''), '\D', '', 'g') AS digits
  FROM leads
  WHERE COALESCE(whatsapp, telefone) IS NOT NULL
)
UPDATE cards c
SET lead_id = ld.id
FROM lead_digits ld
WHERE c.lead_id IS NULL
  AND c.company_id = ld.company_id
  AND length(ld.digits) >= 10
  AND COALESCE(c.description, '') LIKE '%' || ld.digits || '%';

-- (b) Match por nome unico
WITH unique_names AS (
  SELECT MIN(id) AS lead_id, company_id, nome
  FROM leads
  GROUP BY company_id, nome
  HAVING COUNT(*) = 1
)
UPDATE cards c
SET lead_id = un.lead_id
FROM unique_names un
WHERE c.lead_id IS NULL
  AND c.company_id = un.company_id
  AND c.title = un.nome;

-- ============================================================================
-- 3. Trigger v2: idempotencia por lead_id + higienizacao de nome
-- ============================================================================

CREATE OR REPLACE FUNCTION fn_ensure_card_for_lead() RETURNS TRIGGER AS $$
DECLARE
  v_pipe_id      TEXT;
  v_phase_id     TEXT;
  v_creator_id   TEXT;
  v_tipo         TEXT;
  v_keyword      TEXT;
  v_title        TEXT;
  v_phone_digits TEXT;
  v_description  TEXT;
BEGIN
  BEGIN
    -- Idempotencia: ja existe card desse lead? (1:1 via lead_id)
    IF EXISTS (SELECT 1 FROM cards WHERE lead_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Resolve tipo (consultor vs associado)
    IF COALESCE(NEW.origem, '') ILIKE '%consultor%'
       OR COALESCE(NEW.qualificado_por, '') ILIKE '%consultor%' THEN
      v_tipo := 'consultor';
      v_keyword := 'consultor';
    ELSE
      v_tipo := 'associado';
      v_keyword := 'associad';
    END IF;

    -- Acha pipe da company que combine com o tipo
    SELECT p.id INTO v_pipe_id FROM pipes p
    WHERE p.company_id = NEW.company_id
      AND COALESCE(p.status, 'active') = 'active'
      AND LOWER(p.name) LIKE '%' || v_keyword || '%'
    ORDER BY p.created_at ASC LIMIT 1;

    IF v_pipe_id IS NULL THEN
      RAISE NOTICE 'fn_ensure_card_for_lead: pipe % nao encontrado pra company %', v_keyword, NEW.company_id;
      RETURN NEW;
    END IF;

    -- 1a fase do pipe
    SELECT ph.id INTO v_phase_id FROM phases ph
    WHERE ph.pipe_id = v_pipe_id
    ORDER BY ph.position ASC LIMIT 1;

    IF v_phase_id IS NULL THEN
      RAISE NOTICE 'fn_ensure_card_for_lead: pipe % sem fases', v_pipe_id;
      RETURN NEW;
    END IF;

    -- Higieniza title: se nome eh generico, usa "Lead XXXX (sem nome)"
    v_phone_digits := regexp_replace(COALESCE(NEW.whatsapp, NEW.telefone, ''), '\D', '', 'g');
    IF COALESCE(NEW.nome, '') IN ('', '21 Go', '21Go', 'Voce', 'Você', '.', '..', '...')
       OR LENGTH(TRIM(COALESCE(NEW.nome, ''))) < 2 THEN
      IF LENGTH(v_phone_digits) >= 4 THEN
        v_title := 'Lead ' || RIGHT(v_phone_digits, 4) || ' (sem nome)';
      ELSE
        v_title := 'Lead sem nome (' || LEFT(NEW.id, 8) || ')';
      END IF;
    ELSE
      v_title := NEW.nome;
    END IF;

    -- Creator: vendedor > admin > qualquer user
    v_creator_id := NEW.vendedor_id;
    IF v_creator_id IS NULL THEN
      SELECT id INTO v_creator_id FROM users
      WHERE company_id = NEW.company_id
      ORDER BY (CASE WHEN role = 'admin' THEN 0 ELSE 1 END) ASC, created_at ASC
      LIMIT 1;
    END IF;

    IF v_creator_id IS NULL THEN
      RAISE NOTICE 'fn_ensure_card_for_lead: nenhum user na company %', NEW.company_id;
      RETURN NEW;
    END IF;

    v_description := 'Lead ' || v_tipo
      || ' — origem: ' || COALESCE(NEW.origem, '-')
      || COALESCE(' — ' || NEW.whatsapp, '')
      || ' — auto (trigger v2)';

    INSERT INTO cards (
      id, company_id, pipe_id, current_phase_id, title, description,
      status, created_by_id, assigned_to_id, lead_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text,
      NEW.company_id,
      v_pipe_id,
      v_phase_id,
      v_title,
      v_description,
      'active',
      v_creator_id,
      NEW.vendedor_id,
      NEW.id,
      NOW(),
      NOW()
    );

  EXCEPTION WHEN OTHERS THEN
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

-- ============================================================================
-- 4. Backfill: criar card pra cada lead sem card linkado
-- ============================================================================
-- Mesma logica do trigger, aplicada via loop nos orfaos.
-- Idempotente: pode rodar varias vezes sem duplicar (verifica cards.lead_id).

DO $$
DECLARE
  v_lead         RECORD;
  v_pipe_id      TEXT;
  v_phase_id     TEXT;
  v_creator_id   TEXT;
  v_tipo         TEXT;
  v_keyword      TEXT;
  v_title        TEXT;
  v_phone_digits TEXT;
  v_count        INT := 0;
  v_skipped      INT := 0;
BEGIN
  FOR v_lead IN
    SELECT l.*
    FROM leads l
    WHERE NOT EXISTS (SELECT 1 FROM cards c WHERE c.lead_id = l.id)
    ORDER BY l.created_at DESC
  LOOP
    -- Tipo
    IF COALESCE(v_lead.origem, '') ILIKE '%consultor%'
       OR COALESCE(v_lead.qualificado_por, '') ILIKE '%consultor%' THEN
      v_tipo := 'consultor';
      v_keyword := 'consultor';
    ELSE
      v_tipo := 'associado';
      v_keyword := 'associad';
    END IF;

    -- Pipe
    v_pipe_id := NULL;
    SELECT p.id INTO v_pipe_id FROM pipes p
    WHERE p.company_id = v_lead.company_id
      AND COALESCE(p.status, 'active') = 'active'
      AND LOWER(p.name) LIKE '%' || v_keyword || '%'
    ORDER BY p.created_at ASC LIMIT 1;

    IF v_pipe_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Phase
    v_phase_id := NULL;
    SELECT ph.id INTO v_phase_id FROM phases ph
    WHERE ph.pipe_id = v_pipe_id
    ORDER BY ph.position ASC LIMIT 1;

    IF v_phase_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    -- Title
    v_phone_digits := regexp_replace(COALESCE(v_lead.whatsapp, v_lead.telefone, ''), '\D', '', 'g');
    IF COALESCE(v_lead.nome, '') IN ('', '21 Go', '21Go', 'Voce', 'Você', '.', '..', '...')
       OR LENGTH(TRIM(COALESCE(v_lead.nome, ''))) < 2 THEN
      IF LENGTH(v_phone_digits) >= 4 THEN
        v_title := 'Lead ' || RIGHT(v_phone_digits, 4) || ' (sem nome)';
      ELSE
        v_title := 'Lead sem nome (' || LEFT(v_lead.id, 8) || ')';
      END IF;
    ELSE
      v_title := v_lead.nome;
    END IF;

    -- Creator
    v_creator_id := v_lead.vendedor_id;
    IF v_creator_id IS NULL THEN
      SELECT id INTO v_creator_id FROM users
      WHERE company_id = v_lead.company_id
      ORDER BY (CASE WHEN role = 'admin' THEN 0 ELSE 1 END) ASC, created_at ASC
      LIMIT 1;
    END IF;

    IF v_creator_id IS NULL THEN
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    INSERT INTO cards (
      id, company_id, pipe_id, current_phase_id, title, description,
      status, created_by_id, assigned_to_id, lead_id, created_at, updated_at
    ) VALUES (
      gen_random_uuid()::text,
      v_lead.company_id,
      v_pipe_id,
      v_phase_id,
      v_title,
      'Lead ' || v_tipo
        || ' — origem: ' || COALESCE(v_lead.origem, '-')
        || COALESCE(' — ' || v_lead.whatsapp, '')
        || ' — backfill v2',
      'active',
      v_creator_id,
      v_lead.vendedor_id,
      v_lead.id,
      COALESCE(v_lead.created_at, NOW()),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'Backfill v2: % cards criados, % leads pulados (sem pipe/phase/creator)', v_count, v_skipped;
END
$$;
