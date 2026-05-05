-- =====================================================================
-- 21Go CRM — Módulo de Tarefas (Atividades de Vendas)
-- =====================================================================
-- Inspirado em Pipedrive Activities + Close.com Tasks.
-- Tarefa = atividade tipada (ligação, WhatsApp, reunião, visita, follow-up).
-- Cada tarefa pode estar vinculada a um lead OU a um associado.
-- Filtragem por período (hoje/7d/30d/atrasadas) é feita pelo campo due_at.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tasks (
  id              text PRIMARY KEY,
  company_id      text NOT NULL,
  user_id         text NOT NULL,                  -- responsável (vendedor)
  created_by_id   text NOT NULL,                  -- quem criou
  lead_id         text NULL,                      -- lead vinculado (FK lógica)
  contact_id      text NULL,                      -- associado vinculado (FK lógica)
  title           text NOT NULL,
  description     text NULL,
  type            text NOT NULL DEFAULT 'tarefa', -- ligacao | whatsapp | reuniao | visita | follow_up | email | tarefa
  priority        text NOT NULL DEFAULT 'media',  -- baixa | media | alta
  status          text NOT NULL DEFAULT 'pendente', -- pendente | concluida | cancelada
  due_at          timestamp without time zone NOT NULL,
  duration_min    integer NULL,
  completed_at    timestamp without time zone NULL,
  created_at      timestamp without time zone NOT NULL DEFAULT now(),
  updated_at      timestamp without time zone NOT NULL DEFAULT now()
);

-- Índices pra queries rápidas
CREATE INDEX IF NOT EXISTS idx_tasks_company_id        ON public.tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id           ON public.tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id           ON public.tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_contact_id        ON public.tasks(contact_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due_at            ON public.tasks(due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_status            ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_company_user_due  ON public.tasks(company_id, user_id, due_at);

-- Constraints de validação
DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT chk_tasks_type
    CHECK (type IN ('ligacao','whatsapp','reuniao','visita','follow_up','email','tarefa'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT chk_tasks_priority
    CHECK (priority IN ('baixa','media','alta'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.tasks ADD CONSTRAINT chk_tasks_status
    CHECK (status IN ('pendente','concluida','cancelada'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =====================================================================
-- Como rodar: cole tudo no Supabase Studio → SQL Editor → Run
-- Idempotente: pode rodar 2x sem problema (IF NOT EXISTS em tudo).
-- =====================================================================
