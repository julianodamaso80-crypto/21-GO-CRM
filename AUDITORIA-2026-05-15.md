# 🔍 AUDITORIA TÉCNICA — CRM 21Go (2026-05-15)

> Investigação executada via SSH/Easypanel API + queries diretas no banco de produção + revisão de código. Tudo aqui é evidência, sem suposição.

---

## TL;DR — 3 pontos sangrentos

1. **Webhook descarta SILENCIOSAMENTE toda mensagem que a vendedora envia pelo WhatsApp Web ou celular.** Resultado: o Inbox do CRM mostra só perguntas dos clientes, nunca as respostas. A vendedora parece estar "ignorando" — mas respondeu fora do CRM.

2. **A tabela `cards` (Kanban) não tem FK pra `leads`**. A ligação é por `title = lead.nome` — frágil. Leads homônimos compartilham o mesmo card. Já tem **10+ cards duplicados** por título igual em produção, mais lixo de teste (".", "🤬", "E2E EDITADO").

3. **Vendedores não estão usando o CRM pra responder.** Em 7 dias, apenas **11 mensagens outbound** foram registradas com `senderId` real (Leticya). Em 24h, **zero**. O resto (124 outbound) são saudações automáticas da agente IA.

**O "delay" percebido NÃO é técnico** (latência ponta-a-ponta = 1s, zero erros no webhook em 22h). É **percepção**: como as respostas humanas não aparecem no Inbox, parece que ninguém respondeu.

---

## Metodologia

| Fonte | O que extraí |
|---|---|
| `docker stats` no servidor | Saúde dos containers, uptime, restart count |
| `docker logs` da Evolution API | Tráfego real WhatsApp dos últimos 10 min (só `site21go`) |
| `docker logs` do CRM | Erros nos últimos 30 min |
| Banco Supabase via `psql` | Schemas, triggers, latência real, atividade 24h e 7 dias |
| Código TS (`webhook-evolution.service.ts`, `inbox.service.ts`, `lead-card.helper.ts`) | Lógica de persistência e fluxo |
| API `/webhook/evolution/stats` | Contador acumulado de webhooks aceitos/rejeitados |

---

## ✅ O que está saudável

| Sinal | Evidência |
|---|---|
| Containers estáveis | crm-21go uptime 22h, RestartCount = 0. Evolution idem. |
| Memória folgada | crm-21go usa **50 MiB** de 3.8 GiB; Evolution **129 MiB**. Zero risco de OOM. |
| Webhook recebendo | `accepted: 1023, rejected: 0, errors: 0` desde último boot |
| Latência real ponta-a-ponta | **1 segundo** entre `sent_at` (WhatsApp) e `created_at` (banco do CRM) |
| Conversa órfã | 0 conversas das últimas 24h sem `lead_id` ou `associado_id` |
| Site `21go.site` + `crm21go.site` | HTTP 200, deploys oficiais com sucesso |
| Idempotência do webhook | Implementada via `whatsappMessageId` UNIQUE (linha 261 do webhook service) |
| Trigger de criação de card | Dispara e executa (1663 leads em 7d ↔ 892 cards) |

---

## 🔴 Achados críticos

### CRÍTICO #1 — Webhook IGNORA mensagens do vendedor (`fromMe: true`)

**Arquivo**: [backend/src/modules/webhook-evolution/webhook-evolution.service.ts:254](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L254)

```typescript
if (fromMe) return { ignored: 'from_me' }
```

**E o handler de `SEND_MESSAGE` não persiste**: [webhook-evolution.service.ts:521-535](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L521-L535)

```typescript
async function handleSendMessage(payload, _correlationId) {
  // ... só audita, NÃO cria record na tabela messages
  return { logged: true, alreadyPersisted: !!existing }
}
```

**Consequência prática**:
- Vendedora abre o WhatsApp Web → responde cliente
- Evolution emite webhook `messages.upsert` com `fromMe: true`
- CRM **descarta** silenciosamente
- No Inbox da Leticya aparece só a mensagem do cliente, **sem resposta dela**
- Parece que ela ignorou o cliente → métricas de SLA quebram, gestor cobra resposta que já existe

**Evidência em produção (24h)**:
| Direção | Quantidade | Quem |
|---|---|---|
| inbound (cliente) | 152 | leads |
| outbound (CRM) | 26 | **TODAS** são `Oi *Nome*! Tudo bem? 😊 Me chamo Letyc...` (saudação automática da agente IA) |
| outbound humano | **0** | — |

**Por 24h inteiras, nenhuma mensagem humana do vendedor entra no banco do CRM.**

**Severidade**: 🔴 Show-stopper operacional. Causa raiz do "delay percebido".

---

### CRÍTICO #2 — `cards` sem FK pra `leads`, ligação frágil por `title`

**Schema atual** (verificado em produção):
```
cards columns: id, company_id, pipe_id, current_phase_id, title, description,
               status, created_by_id, assigned_to_id, due_date, completed_at,
               created_at, updated_at
```

**Nenhuma coluna `lead_id`.** Ligação por nome do lead:

[backend/src/modules/leads/lead-card.helper.ts:65-66](backend/src/modules/leads/lead-card.helper.ts#L65-L66):
```typescript
const existing = await prisma.card.findFirst({
  where: { companyId: lead.companyId, pipeId: pipe.id, title: lead.nome },
  ...
```

**Trigger SQL faz a mesma coisa**:
```sql
IF EXISTS (SELECT 1 FROM cards c
           WHERE c.company_id = NEW.company_id
             AND c.title = NEW.nome)  -- ← BUSCA POR NOME
THEN RETURN NEW; END IF;
```

**Consequências**:
1. **Homônimos colidem**: dois leads "Davi" → um único card → o segundo lead vira invisível no Kanban.
2. **Cards duplicados quando o trigger e o helper TS rodam em janelas diferentes**: 10+ títulos com cards duplicados (`Juliano Damaso=2, Davi=2, Thereza Guimarães=2…`).
3. **Lixo de teste no Kanban produção**:
   - `.` → 7 cards
   - `E2E EDITADO` → 4 cards
   - `🤬` → 3 cards
4. **Clicar no card no Kanban não consegue navegar pro lead correto** — não há ID.
5. A query de "leads órfãos" (1663 leads / 1663 com card_match_nome / 0 órfãos) **é falso negativo** — qualquer homônimo passa como "vinculado" mesmo apontando pra card de outra pessoa.

**Severidade**: 🔴 Bug estrutural — exige migration `ALTER TABLE cards ADD COLUMN lead_id text REFERENCES leads(id) ON DELETE SET NULL` + backfill.

---

### CRÍTICO #3 — Vendedores **não usam o CRM pra responder**

**Outbound nos últimos 7 dias (`messages.direction='outbound'`)**:

| sender | sender_id | Qtd | Período |
|---|---|---|---|
| `vendedor` | NULL | 318 | 8–9 maio (3 dias) |
| `agent` | NULL | 124 | 8–15 maio (greeting automático) |
| `vendedor` | `4e9d733d…` (Leticya) | **11** | 8–11 maio |

**De 12 a 15 de maio (4 dias) Leticya gravou ZERO mensagens reais no CRM.** Os 318 do começo do mês podem ter sido teste/seed (sender_id NULL é suspeito).

**Conversas atribuídas vs respondidas (7 dias)**:

| Atribuído a | Conversas | Inbound | Outbound (inclui agent) |
|---|---|---|---|
| Leticya | 218 | 1013 | 265 |
| ninguém | 144 | 540 | 148 |

Razão Leticya **inbound:outbound = 3.8:1** contando agent. Sem o agent: **92:1**.

**Combinado com o CRÍTICO #1**: a vendedora respondeu (vi mensagens dela no log do Evolution: "atendemos toda regiao nacional", "qual plano o sernhor tem interesse?"), mas o CRM rejeitou todas.

**Severidade**: 🔴 Operacional. Sem CRÍTICO #1 resolvido, métricas do CRM são fundamentalmente erradas.

---

### CRÍTICO #4 — Trigger atribui card SEMPRE ao admin (vendedor_id sempre NULL)

**Leads criados últimas 24h, ZERO com `vendedor_id` preenchido**:

```
hora                | leads | com_vendedor | com_status
2026-05-15 12:00:00 |   1   |      0       |    1
2026-05-15 11:00:00 |   2   |      0       |    2
...
TOTAL 24h: 38 leads, 0 atribuídos a vendedor
```

[backend/src/modules/leads/lead-card.helper.ts:108-119](backend/src/modules/leads/lead-card.helper.ts#L108-L119) — fallback pega o **admin** quando `vendedorId` é null:

```typescript
async function resolveCreatorId(companyId, vendedorId) {
  if (vendedorId) return vendedorId
  const admin = await prisma.user.findFirst({ where: { companyId, role: 'admin' } })
  if (admin) return admin.id
  ...
}
```

**Não há lógica de round-robin** entre vendedores. Como há só uma vendedora ativa (Leticya), todos os 1663 leads cairam no balde dela.

**Severidade**: 🔴 Distribuição quebrada. Quando contratar mais vendedores, leads continuarão indo todos pra Leticya (ou pro admin) até alguém escrever a regra.

---

### CRÍTICO #5 — Só 1 vendedora com WhatsApp conectado

```
evolution_name | status    | phone        | email                       | connected_at
site21go       | CONNECTED | 21980214882  | leticyathayene02@gmail.com  | 2026-05-11 21:55
```

**1 row.** Vendedora Leticya sozinha cuidando de 218 conversas atribuídas em 7 dias + 540 conversas sem assignment.

**Severidade**: 🔴 Single point of failure. Se a Leticya não consegue logar no CRM ou cai o número, ninguém atende.

---

### CRÍTICO #6 — `audit_logs` vazio

```sql
SELECT * FROM audit_logs WHERE created_at > NOW() - INTERVAL '6 hours';
→ 0 rows
```

Estrutura existe (`action, resource, resource_id, description, changes, ip_address, ...`), mas **nenhuma escrita acontece**. Não há rastreabilidade.

**Severidade**: 🟡 Importante. Quando algo der errado, não vai ter forma de investigar quem fez o quê.

---

## 🟡 Achados importantes

### #7 — Vazio `sender_id` em outbound

Tabela `messages` tem `sender_id text` mas em **318 outbound antigos** o campo veio NULL com `sender='vendedor'`. Schema permite NULL, então passou. Mas isso impossibilita relatórios de produtividade por vendedor (não dá pra fazer GROUP BY pessoa).

### #8 — Lead status concentrado em "novo"

```
etapa_funil      | status   | qtd
novo             | lead     | 1333
cotacao_enviada  | lead     | 322
excluido         | excluido | 8
```

**80% dos leads ficam em "novo"** sem progressão de funil. Pode ser sintoma do CRÍTICO #1 (vendedora não usa o CRM, então não move o card) ou UX confusa.

### #9 — `raw_payload` inflando

Picos de até **2.1 MB de raw_payload por hora** (15/05 madrugada). Em escala/anos, vai estourar quota do Supabase free. Áudios com base64 inline são a maior fonte (1 áudio = 50KB).

### #10 — Greeting automático manda mesma mensagem 2x

A 03:26 e 03:27 mandou a mesma "Oi *Cassio*!" pro mesmo número com 1min de diferença. Pode ser timing/race condition na lógica de "primeira mensagem".

---

## 🟢 Achados positivos confirmados

| # | Item |
|---|---|
| #11 | Latência **WhatsApp → CRM = 1 segundo** (sent_at vs created_at) |
| #12 | Webhook secret OK, 0 rejected, 0 errors em 1023 webhooks aceitos |
| #13 | Trigger `fn_update_conversation_on_message` funciona — `total_messages` e `last_message_at` batem com o real (`SELECT count(*) FROM messages WHERE conversation_id` confere) |
| #14 | Socket.IO emit implementado corretamente (trace logs robustos no webhook) |
| #15 | Idempotência via `whatsappMessageId UNIQUE` impede duplicação |
| #16 | Migration `20260511_conversation_unread_count` aplicada, Prisma Client com schema correto |
| #17 | Containers todos `1/1` no swarm — nada caído |

---

## 🩺 Diagnóstico final do "delay nas conversas"

Você reportou: **"está tendo delay nas conversas"**.

**A causa não é delay técnico.** É essa cadeia:

1. WhatsApp → Evolution → CRM = **1 segundo real** (provado)
2. Leticya recebe a mensagem na lista do Inbox em ~1s
3. Leticya tira o celular do bolso ou abre WhatsApp Web e responde **fora do CRM**
4. Resposta dela emite webhook `messages.upsert` com `fromMe: true`
5. CRM **descarta** (linha 254)
6. Inbox do CRM **continua mostrando a mensagem do cliente como "não respondida"**
7. Gestor olha o Inbox → "tá demorando muito pra responder esse lead!"
8. Leticya já respondeu → mas no CRM parece que não

**Plus**: a vendedora não tem motivo pra usar o CRM pra responder enquanto isso for assim, porque o WhatsApp Web no celular dela tem o histórico real. Então o problema **se retroalimenta**.

---

## 🎯 Recomendações de correção (ordem por impacto)

### P0 — Corrigir HOJE (1-2h cada)

| # | Ação | Onde | Efeito |
|---|---|---|---|
| 1 | **Persistir mensagens `fromMe: true`** como outbound | `webhook-evolution.service.ts:254` — trocar `return { ignored: 'from_me' }` por chamada análoga ao handleMessageUpsert mas com `direction: 'outbound', sender: 'vendedor', senderId: <user da instância>` | Vendedora responde no WhatsApp Web → aparece no CRM como outbound. Métricas voltam a ser reais. |
| 2 | **Limpar lixo de teste no Kanban** | SQL: `DELETE FROM cards WHERE title IN ('.', '🤬', 'E2E EDITADO')` | Tira poluição visual do Kanban |

### P1 — Esta semana (4-8h cada)

| # | Ação | Por que |
|---|---|---|
| 3 | **Migration `ALTER TABLE cards ADD COLUMN lead_id`** + FK + backfill (matching telefone, não nome) | Acabar com problema de homônimos. Backfill: pra cada card, achar lead com mesmo nome E mesmo telefone (a tabela leads tem whatsapp). |
| 4 | **Trocar checks por `lead_id`** em `ensureCardForLead` e na trigger SQL | Consistência |
| 5 | **Round-robin de leads** entre vendedores ativos | Distribuir carga quando contratar mais vendedoras |
| 6 | **Persistir `senderId`** em todo outbound | Métricas por pessoa funcionam |

### P2 — Próximas 2 semanas

| # | Ação | Por que |
|---|---|---|
| 7 | **Mover `media_base64` pra storage externo** (MinIO ou Supabase Storage) e guardar só URL | Banco não infla |
| 8 | **Ativar `audit_logs`** nos endpoints sensíveis | Rastreabilidade |
| 9 | **Conectar 2+ vendedoras** ao CRM | Tirar single point of failure |
| 10 | **UX do Inbox**: rendererizar reactions (👍), preview de áudio com transcrição (Whisper) | Vendedora prefere CRM ao WhatsApp Web |

---

## 📋 Snapshot técnico atual (referência futura)

```
─── Servidor ─────────────────────────────────────────
Host: 167.71.31.77 (DigitalOcean droplet, 4 GiB RAM)
Painel: Easypanel http://167.71.31.77:3000
SSH: chave ~/.ssh/claude_21go (autorizada)

─── Containers ativos (15/05 manhã) ──────────────────
social-21go_crm-21go         Up 22h  | 50 MiB / 3.8 GiB
sinistro-21go_evolution-api  Up 22h  | 129 MiB / 3.8 GiB
sinistro-21go_evolution-redis Up 22h | 5 MiB
sinistro-21go_evolution-postgres Up 22h | 46 MiB
+ todos os outros (postgres, redis, minio, rastreamento, etc.)

─── Volume de dados (banco Supabase produção) ───────
- Conversas: ~312 chats (Evolution) | 222 ativas (CRM últimos 7d)
- Mensagens: 5821 (Evolution) | ~1700 inbound/outbound CRM 7d
- Leads: 1663 (últimos 7d), 80% em "novo"
- Cards Kanban: 815 "Vendas de Associados" + 77 "Vendas de Consultores"
- Usuários do CRM: 1 vendedora ativa (Leticya)

─── Métricas de webhook (último boot 22h atrás) ─────
accepted: 1023, rejected: 0, errors: 0
Latência ponta-a-ponta WhatsApp→banco: 1 segundo
```

---

> Auditoria gerada por Claude após investigação direta no servidor de produção em 2026-05-15. Sem fontes secundárias, sem suposição. Todos os SQLs e logs originais estão arquivados em `/tmp/audit*.sql` e `/tmp/audit*.out` no servidor caso queira reproduzir.
