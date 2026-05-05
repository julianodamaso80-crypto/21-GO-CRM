# Próximos Passos — Ações Manuais (Juliano)

> Eu (Claude) já fiz tudo que dava pra fazer sem credenciais interativas. Restam **2 ações suas**, totalizando ~20 minutos.
>
> **Site público (`21go.site`) NÃO foi tocado e continua no ar atendendo clientes.**

---

## ✅ O que já foi resolvido (sem ação sua)

- Frontend do CRM redeployado na Vercel — `https://www.crm21go.site/` agora carrega versão atualizada (antes estava com cache de 2 dias)
- 4 senhas de usuários do CRM resetadas no banco (admin/gestor/vendedor/operação) — ver tabela no fim
- Migration SQL pronta com as 3 tabelas que faltam pro site gravar (`lead_attribution`, `outbound_event_log`, `webhook_inbound_log`)
- Trigger de espelhamento `lead_attribution → leads` pronta (cada lead do site cria um registro no CRM automaticamente)
- `vercel.json` limpo (removido `experimentalServices` quebrado)
- Projeto Vercel duplicado acidental removido
- Documentação em `<vault Obsidian>/ClaudeCode/`

---

## 🔥 AÇÃO 1 — Aplicar SQL no Supabase Studio (5 min)

1. Abre: **https://supabase.com/dashboard/project/noawceqgqfwtpnrzmvdo/sql/new**
2. Abre o arquivo: [`backend/prisma/migrations/20260504_site_tables_and_sync/migration.sql`](backend/prisma/migrations/20260504_site_tables_and_sync/migration.sql)
3. Copia TODO o conteúdo
4. Cola no SQL Editor
5. Clica **Run** (ou Ctrl+Enter)

**O que isso faz:**
- Cria as tabelas `lead_attribution`, `outbound_event_log`, `webhook_inbound_log` no Supabase
- Cria trigger automático: quando o site insere em `lead_attribution`, espelha pra `leads` (CRM)
- **Risco zero**: usa `IF NOT EXISTS` em tudo, não altera tabela existente. Pode rodar 2x sem problema.

**Como validar que deu certo:**
- Abre `https://supabase.com/dashboard/project/noawceqgqfwtpnrzmvdo/editor`
- Vê se aparecem as 3 novas tabelas na lista da esquerda
- Pronto — leads do site param de sumir AUTOMATICAMENTE

---

## 🔥 AÇÃO 2 — Subir backend no Railway (15 min)

O backend Fastify tem WebSocket + Puppeteer + workers. Não roda na Vercel (limites de serverless). Tem que ir pro Railway. Já está tudo preparado: `Dockerfile` e `railway.json`.

### Passo a passo

1. Abre **https://railway.app/new/github**
2. Faz login com GitHub
3. Clica **Deploy from GitHub repo** → seleciona `julianodamaso80-crypto/21-GO-CRM`
4. Railway detecta o `Dockerfile` automaticamente
5. **Adiciona estas variáveis de ambiente** (Settings → Variables → Raw Editor):

```env
NODE_ENV=production
PORT=3333
FRONTEND_URL=https://www.crm21go.site
BACKEND_URL=https://www.crm21go.site
CORS_ORIGIN=https://www.crm21go.site,https://crm21go.site,https://21go.site,https://www.21go.site

DATABASE_URL=postgresql://postgres:GuI1616GuI%40@db.noawceqgqfwtpnrzmvdo.supabase.co:5432/postgres
SUPABASE_URL=https://noawceqgqfwtpnrzmvdo.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vYXdjZXFncWZ3dHBucnptdmRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc0MjY0NDQsImV4cCI6MjA5MzAwMjQ0NH0._aYfliqWNUEetMjKc0ojKTGYqr7-fUqAWODYlLL-8u8
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5vYXdjZXFncWZ3dHBucnptdmRvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NzQyNjQ0NCwiZXhwIjoyMDkzMDAyNDQ0fQ.r7UQm4ea7ilg8r7sfZJAuzVDfFHAiXsePf6YMoj5Cdg

JWT_SECRET=crm-jwt-secret-change-this-in-production-12345678901234567890
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_SECRET=crm-refresh-token-secret-change-in-prod-12345678901234567890
REFRESH_TOKEN_EXPIRES_IN=7d

EVOLUTION_API_URL=https://automacoes-evolution-api.klo3fa.easypanel.host
EVOLUTION_INSTANCE=21gosite
EVOLUTION_API_KEY=52DE882E153D-40EF-BD72-946FEB2E5C1F
EVOLUTION_WEBHOOK_SECRET=25c6aacd9b6e4148c0de109ca4e2d7495bafda0ebf6702804fef4827e81df8ad

GOOGLE_ADS_DEVELOPER_TOKEN=hOOAupUBBEXIhDojbQuXmA
GOOGLE_ADS_CUSTOMER_ID=4712440780
GOOGLE_ADS_CONVERSION_ACTION=7593376690

DEFAULT_COMPANY_ID=company-21go
DEFAULT_AI_PROVIDER=openai
STORAGE_TYPE=local
LOG_LEVEL=info
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

> **ATENÇÃO**: a `DATABASE_URL` usa o host direto (`db.<ref>.supabase.co`). Se o Railway não conseguir conectar (tipicamente IPv4 vs IPv6), troca pelo pooler:
> ```
> DATABASE_URL=postgresql://postgres.noawceqgqfwtpnrzmvdo:GuI1616GuI%40@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
> ```

6. Em **Settings → Networking** clica **Generate Domain**. Anota a URL (ex: `21-go-crm-backend-production.up.railway.app`)

7. **Me passa essa URL** e eu finalizo:
   - Atualizo o `vercel.json` com rewrite `/api/*` → URL Railway
   - Faço novo deploy do frontend
   - Testo login end-to-end

---

## 🔐 Senhas dos usuários (válidas após Ação 2)

| Email | Senha | Role |
|---|---|---|
| `damasojuliano@gmail.com` | `21GoAdmin2026!` | **admin** |
| `carlos.gestor@21go.org` | `Gestor21Go!` | gestor |
| `ana.vendas@21go.org` | `Vendedor21Go!` | vendedor |
| `marcos.operacao@21go.org` | `Operacao21Go!` | operação |

> Senhas só funcionam quando backend Railway estiver no ar (Ação 2).

---

## 📋 O que ainda fica como dívida (não-bloqueante)

Depois das Ações 1 e 2, o sistema funciona. Mas sobram coisas pra evoluir:

- **Conversas WhatsApp**: webhook do Evolution API precisa estar configurado pra apontar pro `https://www.crm21go.site/api/webhooks/evolution`. Aí cada mensagem vai gerar `conversations` + `messages` no banco. Posso fazer isso depois do backend voltar.
- **Tracking → leads**: o `krob-tracking-stack` (Cloudflare D1) ainda fica isolado. Posso criar um Worker que sincroniza eventos de conversão D1 → `leads` Supabase. Não é urgente.
- **Tabelas Pipefy-like**: `cards`, `phases`, `pipes`, `field_definitions`, `card_field_values` estão vazias e provavelmente não vão ser usadas. Decisão: remover ou manter.
- **Migration `timestamptz`**: dívida técnica, não-urgente.

---

## ⚡ TL;DR

1. **Cola SQL no Supabase Studio** → leads do site param de sumir
2. **Sobe backend no Railway** → me passa URL → eu finalizo
3. Pronto, CRM funcional + site continua no ar

**Site (`21go.site`) NÃO foi tocado. NÃO vai cair.**
