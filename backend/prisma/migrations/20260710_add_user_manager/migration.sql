-- Hierarquia de time: coluna manager_id (auto-relacao no User) para "Meu Time".
-- Idempotente: pode rodar mais de uma vez sem erro (inclusive direto no SQL Editor do Supabase).

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "manager_id" text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_manager_id_fkey'
  ) THEN
    ALTER TABLE "users"
      ADD CONSTRAINT "users_manager_id_fkey"
      FOREIGN KEY ("manager_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_manager_id_idx" ON "users"("manager_id");
