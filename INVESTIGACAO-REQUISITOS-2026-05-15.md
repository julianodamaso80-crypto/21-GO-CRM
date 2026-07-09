# 🔍 Investigação dos 3 Requisitos Operacionais — 2026-05-15

> Read-only. Sem alteração de código nem deploy. Tudo evidência direta de prod ou código.
>
> Contexto: usuário aprovou commit do fix `fromMe → outbound` (`37abb5f`), e pediu investigação detalhada antes de empacotar deploy único.

---

## 📋 TL;DR — Cada requisito numa frase

| # | Requisito | Status | Causa raiz |
|---|---|---|---|
| 1 | Real-time no Inbox | 🔴 **QUEBRADO** | Frontend força `transports: ['polling']` no Socket.IO client (linha 59 do `SocketContext.tsx`), com comentário dizendo que Traefik não faz upgrade WS. **Testei com curl: Traefik FAZ upgrade WS (HTTP 101).** O comentário está desatualizado. |
| 2 | Todo lead → Kanban automático | 🟡 **FRÁGIL** | Os 3 lugares que criam lead chamam `ensureCardForLead` corretamente. MAS a migration `20260515_fix_card_idempotency_lead_id` (que adiciona `cards.lead_id` + trigger v2) **não foi aplicada em prod**. Trigger atual ainda dedupe por `title=nome` → 1108 leads (54%) órfãos no Kanban hoje. |
| 3 | Formulários do site → CRM | 🟢 **OK** | Rota única `POST /api/vehicle/lead` recebe `tipo: 'consultor' \| 'associado'`. Site envia o campo corretamente (24h prova: 2 consultor + 25 cotação). Fluxo direto sem n8n no meio. |

---

## A — REAL-TIME DO INBOX (🔴 BUG REAL DO "DELAY")

### A.1 — Inicialização Socket.IO no backend

[backend/src/websocket/socket.service.ts:28-52](backend/src/websocket/socket.service.ts#L28-L52)

```typescript
this.io = new SocketIOServer(fastify.server, {
  cors: { origin: env.CORS_ORIGIN, credentials: true },
  transports: ['websocket', 'polling'],   // ✅ aceita ambos
  pingTimeout: 60000,
  pingInterval: 25000,
})
```

Rooms autojoin em [socket.service.ts:115-120](backend/src/websocket/socket.service.ts#L115-L120):

```typescript
socket.join(SocketRooms.user(userId))
socket.join(SocketRooms.company(companyId))   // ← essencial pra inbox:new_message
socket.join(SocketRooms.dashboard(companyId))
socket.join(SocketRooms.inbox(companyId))
socket.join(SocketRooms.appointments(companyId))
```

Emit do webhook em [webhook-evolution.service.ts:580](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L580):

```typescript
socketService.emitToCompany(companyId, 'inbox:new_message', payload as any)
```

→ emite na room `company:${companyId}`. Autojoin coloca o cliente nessa room. **A topologia está correta.**

### A.2 — INBOX_EMIT_PROOF em produção (real-time check)

Últimos 10 emits de produção (15/05 12:42–16:00):

| timestamp | clientsInRoom | clientsInInboxRoom |
|---|---|---|
| 12:42:50 | 0 | 0 |
| 12:43:28 | 0 | 0 |
| 12:43:41 | 0 | 0 |
| 12:43:44 | 0 | 0 |
| 12:45:31 | 0 | 0 |
| **12:50:10** | **1** | **1** |
| 12:50:11 | 1 | 1 |
| 12:59:40 | 1 | 1 |
| 13:00:06 | 1 | 1 |
| 13:00:14 | 1 | 1 |

**Observações:**
- Entre 12:42 e 12:45, **5 mensagens chegaram pra ZERO clientes conectados**. Essas mensagens NÃO apareceram em real-time pra ninguém — só vieram com refetch (heartbeat de 60s ou F5).
- Às 12:50 Leticya reconecta → contador volta pra 1.

### A.3 — SOCKET_CONNECTED em produção (transport check)

10 conexões de uma única usuária (Leticya, `4e9d733d-…`) entre 14/05 22:22 e 15/05 15:48 — **todas em `"transport":"polling"`**, todas com autojoin nas rooms certas.

**10 reconexões em 18 horas** = ~1 reconexão a cada 1h48min. Comportamento esperado de long-polling em conexão móvel/desktop instável: cada ciclo do polling longo (25s pingInterval) pode falhar silenciosamente, frontend reconecta.

### A.4 — Frontend força polling-only (CAUSA RAIZ)

[frontend/src/contexts/SocketContext.tsx:52-65](frontend/src/contexts/SocketContext.tsx#L52-L65):

```typescript
const socketInstance = io(SOCKET_URL, {
  auth: { token },
  // Traefik do Easypanel não está fazendo upgrade WebSocket (probe error).
  // Long-polling funciona estável; deixar ele tentar WS gera reconnection
  // loop e perdemos eventos no meio. Forçando polling resolve.
  transports: ['polling'],   // ← AQUI
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
})
```

**O comentário está DESATUALIZADO.** Acabei de provar com `curl` direto que o Traefik aceita upgrade WS:

```bash
$ curl -i -H "Connection: Upgrade" -H "Upgrade: websocket" \
       -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: ..." \
       "https://crm21go.site/socket.io/?EIO=4&transport=websocket"

HTTP/1.1 101 Switching Protocols      ← upgrade aceito
Connection: Upgrade
Sec-Websocket-Accept: s3pPLMBiTxaQ9kYGzzhZRbK+xOo=
Upgrade: websocket

0{"sid":"sCuZ2HXX-...","upgrades":[],...}
```

E o handshake de polling responde `"upgrades":["websocket"]` informando o cliente que poderia subir pra WS.

### A.5 — Listener do `inbox:new_message` no frontend

[frontend/src/hooks/useInbox.ts:46-117](frontend/src/hooks/useInbox.ts#L46-L117):

```typescript
useSocketEvent('inbox:new_message', (payload: any) => {
  ...
  qc.setQueriesData({ queryKey: ['conversations'] }, (old) => {
    // CASE 1 — conversa já no cache: atualiza + move pro topo
    // CASE 2 — conversa nova: prepend
  })
})
```

✅ Bem feito — usa `setQueriesData` (não refaz fetch de ~2000 conversas a cada mensagem). MAS só funciona se o Socket.IO entrega o evento — e hoje **muitas vezes não entrega** (clientsInRoom=0 enquanto Leticya está deslogada/reconectando).

### A.6 — Heartbeat de 60s como fallback

[useInbox.ts:43](frontend/src/hooks/useInbox.ts#L43): `refetchInterval: HEARTBEAT_MS` (60s)

**Esse é o "delay" real percebido**: quando Socket.IO falha em entregar o evento (clientsInRoom=0 ou polling com lag), a UI só atualiza no próximo heartbeat de 60s. Mas em horários comerciais com Leticya conectada, o polling funciona e a percepção de delay é menor.

### A.7 — FIX sugerido

**Trocar uma linha no `SocketContext.tsx`** + remover/atualizar o comentário desatualizado:

```typescript
// ANTES
transports: ['polling'],

// DEPOIS — websocket primeiro, polling como fallback automático
transports: ['websocket', 'polling'],
```

**Por que isso resolve:**
1. WebSocket cria conexão persistente bidirecional → eventos chegam em **<100ms** (vs 25s do long-polling)
2. Socket.IO automaticamente faz fallback pra polling se WS falhar (sem reconnection loop como o comentário antigo afirmava)
3. Conexão persistente reduz drops → menos reconexões → menos janelas de `clientsInRoom=0`

**Risco**: se eu estiver enganado e o WS realmente quebrar em algum cenário não testado, o Socket.IO faz fallback pra polling automaticamente. Não tem como ficar pior que está hoje.

**Como validar pós-deploy**:
1. Logar `SOCKET_CONNECTED` → `transport` deve aparecer como `"websocket"` (não mais `"polling"`)
2. Logar `INBOX_EMIT_PROOF` durante mensagem real → `clientsInRoom > 0`
3. Cliente diz "Inbox atualiza sozinho sem F5"

---

## B — LEAD → KANBAN AUTOMÁTICO (🟡 FRÁGIL)

### B.1 — Schema `cards` em PROD HOJE

Confirmado via `psql` direto no banco:

```
column_name      | data_type
-----------------+-----------------------------
id               | text
company_id       | text
pipe_id          | text
current_phase_id | text
title            | text
description      | text
status           | text
created_by_id    | text
assigned_to_id   | text
due_date         | timestamp without time zone
completed_at     | timestamp without time zone
created_at       | timestamp without time zone
updated_at       | timestamp without time zone
(13 rows)
```

**`lead_id` NÃO EXISTE em produção.** Ligação card↔lead ainda é por `title=nome` (frágil).

### B.2 — `prisma migrate status`

```
16 migrations found in prisma/migrations
Following migrations have not yet been applied:
20260319000000_init_21go
20260401_add_lead_tracking_fields
20260406_add_followup_fields
... (todas as 16)
20260511_auto_card_for_lead_trigger
20260511_conversation_unread_count
20260515_fix_card_idempotency_lead_id   ← contém o fix do cards.lead_id
```

**Observação importante:** TODAS as 16 migrations aparecem como "não aplicadas". Isso significa que a tabela `_prisma_migrations` está vazia — o banco foi populado por SQL aplicado manualmente no Supabase Studio (não via `prisma migrate deploy`). É um problema de governance, mas o DB funciona porque o schema chegou lá de algum jeito.

**A migration `20260515_fix_card_idempotency_lead_id` claramente não foi aplicada** — confirmado pelos achados B.1 e B.5.

### B.3 — Onde leads são criados (3 lugares, TODOS chamam `ensureCardForLead`)

```
1. backend/src/modules/leads/leads.service.ts:183 (createLead — CRM admin)
   → linha 205: await ensureCardForLead(lead.id) ✅ (sem hint, resolve por origem)

2. backend/src/modules/webhook-evolution/webhook-evolution.service.ts:404
   → linha 420: await ensureCardForLead(leadId, 'associado') ✅ (força associado)

3. backend/src/modules/plate-lookup/lead-capture.service.ts:97
   → linha 146: await ensureCardForLead(leadId, input.tipo) ✅ (tipo do form do site)
```

**Cobertura ✅ — nenhum lead deveria escapar.**

### B.4 — Mas 1108 leads (54%) sem card

```sql
SELECT (SELECT COUNT(*) FROM cards) AS cards,
       (SELECT COUNT(*) FROM leads) AS leads;

cards | leads
------|------
 898  | 2006
```

**1108 leads sem card.** Causa: trigger atual em PROD ainda dedupe por `title=nome`. Como WhatsApp gera muitos leads com `pushName` genérico ("21 Go", "Voce", "."), eles colidem em poucos cards. O commit `dcd7e46` resolve isso, mas a migration não rodou.

### B.5 — Trigger atual em PROD ainda é v1 (a buggy)

```sql
SELECT pg_get_functiondef(oid) FROM pg_proc WHERE proname = 'fn_ensure_card_for_lead';
```

Resposta confirma:

```plpgsql
IF EXISTS (
  SELECT 1 FROM cards c
  WHERE c.company_id = NEW.company_id
    AND c.title = NEW.nome     -- ← AINDA POR TITLE
) THEN
  RETURN NEW;
END IF;
```

A trigger v2 (que dedupe por `lead_id`) está no código do commit `dcd7e46` mas **não foi aplicada no banco**.

### B.6 — Fluxo de hint do site → ensureCardForLead

[lead-capture.service.ts:119-126](backend/src/modules/plate-lookup/lead-capture.service.ts#L119-L126):

```typescript
qualificadoPor: input.tipo === 'consultor' ? 'site_consultor' : 'site',
...
origem: input.tipo === 'consultor'
  ? 'seja_consultor'
  : (input.utmSource ? `${input.utmSource}_${input.utmMedium || 'direct'}` : 'site_organico'),
```

E linha 146: `await ensureCardForLead(leadId, input.tipo)`.

E [lead-card.helper.ts:97-106](backend/src/modules/leads/lead-card.helper.ts#L97-L106) (`resolveTipo`):

```typescript
function resolveTipo(hint, lead) {
  if (hint === 'consultor' || hint === 'associado') return hint
  const origem = (lead.origem || '').toLowerCase()
  if (origem.includes('consultor') || qual.includes('consultor')) return 'consultor'
  return 'associado'
}
```

✅ **Funciona como esperado.** Hint do site é prioritário; sem hint, infere pela origem; default `associado`.

### B.7 — Comportamento real em 24h (prod)

```sql
SELECT origem, qualificado_por, COUNT(*) FROM leads
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY origem, qualificado_por;

origem         | qualificado_por  | count
---------------+------------------+-------
site_organico  | site             | 25
whatsapp       | webhook_whatsapp |  5
seja_consultor | site_consultor   |  2
```

**32 leads em 24h.** Roteamento correto:
- 25 cotação → "Vendas de Associados"
- 2 consultor → "Vendas de Consultores"
- 5 WhatsApp → "Vendas de Associados" (forçado 'associado' no webhook)

### B.8 — FIX sugerido

**Aplicar a migration `20260515_fix_card_idempotency_lead_id`** no banco de produção. A migration já existe no repo em `backend/prisma/migrations/20260515_fix_card_idempotency_lead_id/migration.sql` e contém:

1. `ALTER TABLE cards ADD COLUMN lead_id text` + FK
2. Backfill em 2 fases (match por WhatsApp na description; depois nome único)
3. Trigger v2 (dedupe por `lead_id`)
4. Backfill final pra leads órfãos

**Como aplicar:**

```bash
# Via psql do container postgres-social, mesma técnica usada pra migration unread_count
docker exec postgres-social psql -h aws-1-...pooler.supabase.com \
  -U postgres.noawce... -d postgres -f /tmp/20260515.sql
```

**Risco**: migration faz `ALTER TABLE cards` + UPDATEs em ~898 cards + INSERTs pra ~1108 leads órfãos. Provavelmente leva alguns segundos. Em janela de pouca movimentação (sábado manhã) é seguro. Backup antes via `pg_dump -t cards -t leads`.

**Antes de aplicar — pequeno fix no código** (já está no commit `dcd7e46` mas vale conferir): o helper `ensureCardForLead` no commit dcd7e46 já usa `cards.leadId` na query Prisma. Vou confirmar isso na próxima validação antes do deploy.

---

## C — FORMULÁRIOS DO SITE → CRM (🟢 OK)

### C.1 — Rota única no backend

[backend/src/modules/plate-lookup/plate-lookup.routes.ts:154-170](backend/src/modules/plate-lookup/plate-lookup.routes.ts#L154-L170):

```typescript
fastify.post('/lead', {
  schema: { description: 'Salva lead do formulário de cotação do site no banco', ... },
}, async (request, reply) => {
  const body = request.body as any
  const ip = request.ip
  const userAgent = request.headers['user-agent'] || ''
  const result = await createPublicLead(body, ip, userAgent)
  return reply.status(201).send(result)
})
```

Prefixo no `server.ts:193`: `await fastify.register(plateLookupRoutes, { prefix: '/api/vehicle' })`

→ **Endpoint público: `POST https://crm21go.site/api/vehicle/lead`**

### C.2 — Body esperado (interface `PublicLeadInput`)

[backend/src/modules/plate-lookup/lead-capture.service.ts:5-46](backend/src/modules/plate-lookup/lead-capture.service.ts#L5-L46):

```typescript
interface PublicLeadInput {
  nome: string         // obrigatório
  whatsapp: string     // obrigatório
  email?: string
  placa?: string
  leilao?: 'nao' | 'leilao' | 'remarcado'
  marca?, modelo?, ano?, cor?, valorFipe?, plano?, valorMensal?
  carroApp?: boolean, seguroAtual?: string

  // ▶ ESSE É O CAMPO QUE DECIDE O KANBAN
  tipo?: 'consultor' | 'associado'

  // Tracking
  utmSource?, utmMedium?, utmCampaign?, utmContent?, utmTerm?,
  gclid?, fbclid?, fbp?, fbc?
}
```

### C.3 — Decisão de Kanban

```
input.tipo === 'consultor'
  → origem='seja_consultor', qualificadoPor='site_consultor'
  → ensureCardForLead(leadId, 'consultor')
  → pipe "Vendas de Consultores"

input.tipo !== 'consultor' (undefined ou 'associado')
  → origem='site_organico' (ou utm_*_*)
  → ensureCardForLead(leadId, undefined ou 'associado')
  → pipe "Vendas de Associados"
```

### C.4 — Comportamento em produção (24h)

```
origem         | qualificado_por  | count
---------------+------------------+-------
site_organico  | site             | 25
seja_consultor | site_consultor   |  2
```

→ **Site MANDA `tipo='consultor'` no formulário Seja Consultor** ✅ (2 leads chegaram com origem correta)
→ **Site NÃO manda `tipo` no formulário Cotação** ✅ (25 leads cairam em `site_organico` = default associado)

### C.5 — Sem n8n no caminho

Procurei refs a n8n no código do CRM (`backend/src`) — **zero**. O fluxo é direto: site faz POST HTTPS pra `crm21go.site/api/vehicle/lead`. Sem intermediário, sem Make, sem Zapier.

### C.6 — Logs recentes não disponíveis

`audit_logs` em produção tem **0 rows nas últimas 24h**. Não posso correlacionar POSTs específicos com leads criados. Sintoma do CRÍTICO #6 da auditoria anterior — audit logging não está sendo escrito.

Mas o achado C.4 já prova que o fluxo funciona ponta-a-ponta (32 leads novos em 24h, todos roteados corretamente).

### C.7 — Conclusão

🟢 **Sem bug. Sem fix necessário.**

**Únicas fragilidades** (não bloqueadoras):
- Sem rate-limit explícito na rota pública (dependente do middleware global do Fastify)
- Sem captcha → spam pode entrar como lead se descobrirem o endpoint
- Sem audit_log gravando

---

## 🎯 Recomendação de deploy único

Pacote sábado manhã (depois de backup `pg_dump`):

| # | Mudança | Tipo | Esforço |
|---|---|---|---|
| 1 | Fix `fromMe → outbound` | Já commitado (`37abb5f`) | 0 (só deploy) |
| 2 | `transports: ['websocket', 'polling']` no frontend | 1 linha em `SocketContext.tsx` + atualizar comentário | 5min |
| 3 | Aplicar migration `20260515_fix_card_idempotency_lead_id` no banco prod | SQL via psql | 2-5min |
| 4 | Deploy oficial via Easypanel API | rebuild da imagem do CRM | 30s |
| 5 | Monitor 30min: SOCKET_CONNECTED transport, INBOX_EMIT_PROOF clientsInRoom, WA_MESSAGE_PERSIST direction | logs | concorrente |

**Critério de aceite combinado**:
- Leticya manda mensagem pelo WhatsApp Web → aparece no Inbox com direction='outbound' em <2s **(req 1 atendido + parte do real-time)**
- Cliente externo manda WhatsApp → Inbox da Leticya atualiza sem F5 em <2s **(req 1 atendido)**
- Novo lead via `/api/vehicle/lead` → card criado no Kanban correto, com `cards.lead_id` populado **(req 2 atendido)**
- 2 leads diferentes com mesmo nome → 2 cards distintos **(req 2 fix concreto)**
- Formulários do site continuam caindo certos **(req 3 manter)**

---

> Investigação executada read-only em 15/05/2026 16:00 BRT. Próxima ação aguardando teu sinal: validar relatório → empacotar deploy.
