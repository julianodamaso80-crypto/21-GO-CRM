-- Rede multinivel: espelho do Power CRM (pessoas) + SGA (placas do ciclo).
-- Aditiva e idempotente: pode rodar mais de uma vez, inclusive no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS "rede_cargas" (
  "id"            text PRIMARY KEY,
  "company_id"    text NOT NULL,
  "raiz_power_id" integer NOT NULL,
  "iniciada_em"   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluida_em"  timestamp(3),
  "disparada_por" text NOT NULL,
  "etapa"         text NOT NULL DEFAULT 'rede',
  "status"        text NOT NULL DEFAULT 'rodando',
  "publicada"     boolean NOT NULL DEFAULT false,
  "totais"        jsonb,
  "erro"          text
);
CREATE INDEX IF NOT EXISTS "rede_cargas_company_raiz_pub_idx"
  ON "rede_cargas"("company_id", "raiz_power_id", "publicada");

CREATE TABLE IF NOT EXISTS "rede_consultores" (
  "id"                    text PRIMARY KEY,
  "company_id"            text NOT NULL,
  "carga_id"              text NOT NULL REFERENCES "rede_cargas"("id") ON DELETE CASCADE,
  "power_id"              integer NOT NULL,
  "cpf"                   text NOT NULL,
  "nome"                  text NOT NULL,
  "nome_tratamento"       text NOT NULL,
  "email"                 text,
  "celular"               text,
  "funcao"                text,
  "cooperativa"           text,
  "codigo_voluntario"     text,
  "patrocinador_power_id" integer,
  "nivel_raiz"            integer NOT NULL,
  "raiz_power_id"         integer NOT NULL,
  "caminho"               text NOT NULL,
  "status"                text NOT NULL,
  "user_id"               text
);
CREATE INDEX IF NOT EXISTS "rede_consultores_carga_nivel_idx"  ON "rede_consultores"("carga_id", "nivel_raiz");
CREATE INDEX IF NOT EXISTS "rede_consultores_carga_cpf_idx"    ON "rede_consultores"("carga_id", "cpf");
CREATE INDEX IF NOT EXISTS "rede_consultores_company_raiz_idx" ON "rede_consultores"("company_id", "raiz_power_id");

CREATE TABLE IF NOT EXISTS "rede_placas" (
  "id"                 text PRIMARY KEY,
  "company_id"         text NOT NULL,
  "carga_id"           text NOT NULL REFERENCES "rede_cargas"("id") ON DELETE CASCADE,
  "cpf_consultor"      text NOT NULL,
  "codigo_veiculo"     text NOT NULL,
  "placa"              text NOT NULL,
  "associado"          text NOT NULL,
  "telefone_associado" text,
  "data_contrato"      text NOT NULL,
  "mes_contrato"       text NOT NULL,
  "data_pagamento"     text,
  "mes_pagamento"      text,
  "data_vencimento"    text,
  "dias_atraso"        integer,
  "valor"              decimal(12,2),
  "situacao_veiculo"   text,
  "situacao_boleto"    text,
  "status"             text NOT NULL
);
CREATE INDEX IF NOT EXISTS "rede_placas_carga_cpf_idx"    ON "rede_placas"("carga_id", "cpf_consultor");
CREATE INDEX IF NOT EXISTS "rede_placas_carga_ciclo_idx"  ON "rede_placas"("carga_id", "mes_contrato", "mes_pagamento");
CREATE INDEX IF NOT EXISTS "rede_placas_carga_status_idx" ON "rede_placas"("carga_id", "status");
