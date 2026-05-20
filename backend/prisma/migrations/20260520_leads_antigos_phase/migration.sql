-- Migration: cria fase "Leads Antigos" no pipe Vendas de Associados
--
-- Regra absoluta do projeto: a fase "Entradas" (position=0) sempre recebe leads
-- novos via trigger fn_ensure_card_for_lead (que pega `ORDER BY position ASC LIMIT 1`).
--
-- A fase "Leads Antigos" (position=1) eh o BACKLOG dos leads historicos importados
-- antes da Evolution API estar conectada. Mantem o funil ativo limpo, sem misturar
-- contatos historicos (2200+) com leads que chegam em tempo real.
--
-- Idempotente: nao duplica se ja existir, nao re-move cards se ja foram movidos.

DO $$
DECLARE
  v_pipe_id TEXT := 'seed-pipe-vendas';
  v_company_id TEXT;
  v_entradas_id TEXT;
  v_entradas_position INT;
  v_antigos_id TEXT;
  v_moved INT;
BEGIN
  -- 1) Resolve company_id e fase Entradas
  SELECT id, company_id, position INTO v_entradas_id, v_company_id, v_entradas_position
  FROM phases
  WHERE pipe_id = v_pipe_id AND name ILIKE '%entrada%'
  ORDER BY position ASC
  LIMIT 1;

  IF v_entradas_id IS NULL THEN
    RAISE NOTICE 'Pipe % nao tem fase Entradas — pulando migration', v_pipe_id;
    RETURN;
  END IF;

  -- 2) Verifica se "Leads Antigos" ja existe (idempotencia)
  SELECT id INTO v_antigos_id
  FROM phases
  WHERE pipe_id = v_pipe_id AND name = 'Leads Antigos'
  LIMIT 1;

  IF v_antigos_id IS NULL THEN
    -- 2a) Desloca todas as fases com position > Entradas em +1
    UPDATE phases
    SET position = position + 1
    WHERE pipe_id = v_pipe_id AND position > v_entradas_position;

    -- 2b) Cria a fase Leads Antigos logo apos Entradas
    INSERT INTO phases (id, company_id, pipe_id, name, color, position, probability, is_won, is_lost, created_at, updated_at)
    VALUES (gen_random_uuid()::text, v_company_id, v_pipe_id, 'Leads Antigos', '#9CA3AF', v_entradas_position + 1, 5, false, false, NOW(), NOW())
    RETURNING id INTO v_antigos_id;

    RAISE NOTICE 'Fase Leads Antigos criada: %', v_antigos_id;
  ELSE
    RAISE NOTICE 'Fase Leads Antigos ja existe: %', v_antigos_id;
  END IF;

  -- 3) Move cards atualmente em Entradas pra Leads Antigos
  -- Idempotente: se ja foi movido, nao tem cards em Entradas, esse UPDATE eh no-op
  UPDATE cards
  SET current_phase_id = v_antigos_id, updated_at = NOW()
  WHERE current_phase_id = v_entradas_id;

  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RAISE NOTICE '% cards movidos Entradas → Leads Antigos', v_moved;
END $$;
