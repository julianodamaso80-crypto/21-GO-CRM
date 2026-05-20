-- Migration: move fase "Leads Antigos" pra ultima posicao do pipe Vendas de Associados
-- Visualmente fica como BACKLOG no fim do Kanban, fora do fluxo ativo de vendas.
-- Idempotente: se ja esta no final, no-op.

DO $$
DECLARE
  v_pipe TEXT := 'seed-pipe-vendas';
  v_antigos_id TEXT;
  v_antigos_pos INT;
  v_max_pos INT;
BEGIN
  SELECT id, position INTO v_antigos_id, v_antigos_pos
  FROM phases WHERE pipe_id = v_pipe AND name = 'Leads Antigos';

  IF v_antigos_id IS NULL THEN
    RAISE NOTICE 'Leads Antigos nao existe — pulando';
    RETURN;
  END IF;

  SELECT MAX(position) INTO v_max_pos FROM phases WHERE pipe_id = v_pipe;

  IF v_antigos_pos = v_max_pos THEN
    RAISE NOTICE 'Leads Antigos ja esta no final';
    RETURN;
  END IF;

  -- 1) tira Leads Antigos da fila (posicao temporaria)
  UPDATE phases SET position = -1 WHERE id = v_antigos_id;

  -- 2) desloca pra baixo as fases que estavam acima dela
  UPDATE phases
  SET position = position - 1
  WHERE pipe_id = v_pipe AND position > v_antigos_pos;

  -- 3) poe Leads Antigos no final
  UPDATE phases SET position = v_max_pos WHERE id = v_antigos_id;

  RAISE NOTICE 'Leads Antigos movida de pos % pra %', v_antigos_pos, v_max_pos;
END $$;
