-- Forca troca de senha no primeiro login (acessos criados pelo admin com senha temporaria)
-- Idempotente: pode rodar mais de uma vez sem erro.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "must_change_password" boolean NOT NULL DEFAULT false;
