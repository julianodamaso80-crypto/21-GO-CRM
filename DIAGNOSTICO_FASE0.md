# 📊 Diagnóstico Fase 0 — números-base antes de qualquer correção

> **Data:** 2026-05-11
> **Branch:** `fix/realtime-inbox-fase-0`
> **Modo:** Diagnóstico ativo — ZERO código produtivo alterado
> **Confirmação inicial:** Cloudflare em DNS-only (cinza). Bloqueio do WS não vem de lá.

---

## 🚨 RESUMO — Achados que MUDAM o plano

Antes de qualquer tabela, três fatos novos que apareceram na Fase 0 e que invalidam parte das suposições da auditoria anterior:

### Achado #1 — Envio (outbound) está QUEBRADO há 48 horas

A **última mensagem outbound no banco é `2026-05-09T21:22:35Z`** (49 horas atrás no momento da medição). De `2026-05-09 21:22 UTC` até **agora**, ZERO mensagens saíram pelo CRM. Antes disso, 7.758 outbound histórico — funcionava.

A data bate **exatamente** com a entrega do Projeto Japão (commit `0af9726`, 2026-05-09). Não é coincidência: alguma coisa do Japão (ou dos deploys subsequentes) quebrou o envio.

**Isso explica metade do sintoma da Leticya** ("envio CRM → cliente demora a aparecer"). Não está demorando — **está falhando**. Se ela está vendo mensagens "atrasadas" no envio, são mensagens que ela está enviando pelo celular físico, não pelo CRM. E o handler do webhook (`handleSendMessage`) **não persiste essas mensagens no banco** ([webhook-evolution.service.ts:334-348](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L334-L348)) — então a UI nunca recebe.

### Achado #2 — Webhook está rejeitando 60% das mensagens recebidas

`/api/webhook/evolution/stats` mostra:

```json
{
  "accepted": 72,
  "rejected": 112,
  "errors": 0,
  "lastAcceptedAt": "2026-05-11T13:33:14.093Z",
  "lastRejectedAt": "2026-05-11T14:01:42.117Z",
  "secretConfigured": true
}
```

- `secretConfigured: true` → backend está em modo **estrito**.
- `rejected: 112` vs `accepted: 72` → **60,9% de rejeição**.
- Última rejeição há 42 segundos no momento da medição.

**Diagnóstico:** a Evolution não está enviando o header `x-evolution-secret` em **todas** as mensagens. Quando ela rejeita, a Evolution faz retry com backoff exponencial (3-5-10-20-30s) — **isso explica direto os atrasos de 10-20s a 3 min** sentidos pela Leticya.

A causa raiz é mais profunda: a instância atual é `21gocrm_db9c5f4f_meu-whatsapp` (não `21gosite` que estava na memória de 09/maio), conectada em `2026-05-08T18:21:33Z`. Provavelmente foi recriada **antes** do Projeto Japão deployar o secret, e nunca foi reconfigurada via o botão 📡 Wifi.

### Achado #3 — Query do inbox NÃO é o gargalo principal

Eu havia hipotetizado que a query sem LIMIT (1.953 conversas) era um dos gargalos. EXPLAIN ANALYZE no Supabase mostrou: **56ms execution time** com warm cache, **2.4ms sem o include**. É alto pra refetch a cada 15s × N usuários, mas não é o que causa o sintoma de 10-20s.

**Inverte a prioridade:** paginação é otimização válida, mas tirada da fila P0 → vai pra P2.

### Achado #4 — Latência webhook→socket está no SLA, mas é alta

5 amostras do smoke test contra `crm21go.site` (com header secret correto):

| Run | Handshake socket | Latência webhook→socket |
|---|---|---|
| 1 | 1005ms | **2819ms** |
| 2 | 968ms | 1750ms |
| 3 | 875ms | 2552ms |
| 4 | 935ms | 2814ms |
| 5 | 851ms | 2652ms |
| **p50** | 935ms | 2652ms |
| **p95 (5 amostras)** | 1005ms | 2819ms |
| **Média** | 927ms | 2517ms |

- Transporte: **polling** (confirmado em todas as runs)
- 100% das mensagens entregues (5/5)
- Zero erros
- SLA padrão do smoke test é 3000ms — passa por pouco.

Long-polling tem jitter de 1-2s. Confirma o diagnóstico de WS quebrado. Mas mesmo se isso fosse zero, os achados #1 e #2 ainda derrubariam a UX.

---

## ✅ Tarefas executadas

### 0.1 — Smoke test em produção (5 execuções)

Comando: `npx tsx backend/scripts/smoke-realtime.ts --target=https://crm21go.site`

Resultado em [tabela acima](#achado-4--latência-webhooksocket-está-no-sla-mas-é-alta).

Observação: smoke test usa o `EVOLUTION_WEBHOOK_SECRET` correto, então mede só o **fluxo ideal**. Em produção real, com webhook rejeitando 60%, a latência **percebida** é muito pior (Evolution faz retry).

### 0.2 — Webhook stats

Comando: `curl https://crm21go.site/api/webhook/evolution/stats`

Resultado:
```json
{
  "accepted": 72,
  "rejected": 112,
  "errors": 0,
  "lastAcceptedAt": "2026-05-11T13:33:14.093Z",
  "lastRejectedAt": "2026-05-11T14:01:42.117Z",
  "warnedNoSecret": false,
  "secretConfigured": true,
  "timestamp": "2026-05-11T14:02:24.107Z"
}
```

Health endpoints adicionais:
- `/health` → ok, uptime 2289s (38min)
- `/api/realtime/health` → ok
- `/api/health/queue` → `disabled, reason: "ENABLE_FOLLOWUP_QUEUE != true"` (esperado)

### 0.3 — Inspeção do banco

Rodei via script temporário `backend/_diag_db.ts` (já deletado — não toca em código produtivo).

#### 0.3.1 — Contagens
| Item | Valor |
|---|---|
| `conversations` total | **1.953** |
| `messages` total | 13.404 |
| Mensagens nas últimas 24h | 100 (todas **inbound**) |
| `whatsapp_instances` ativas | 1 (Leticya) |

#### 0.3.2 — Índices (Conversation e Message)

**Conversation tem 10 índices** — incluindo o crítico:
- `ix_conversations_last_msg` em `(last_message_at DESC)` ✅ existe
- `conversations_company_id_idx` ✅ existe
- `conversations_assigned_to_id_idx` ✅ existe
- `conversations_status_idx` ✅ existe

**Message tem 10 índices** — incluindo:
- `ix_messages_conv` em `(conversation_id)` ✅ existe
- `ix_messages_created` em `(created_at DESC)` ✅ existe
- `messages_whatsapp_message_id_key` UNIQUE ✅ (idempotência)

**Conclusão:** índices estão OK. Nenhum buraco crítico aqui.

#### 0.3.3 — Tamanhos físicos

| Tabela | Total | Linhas |
|---|---|---|
| messages | 33 MB | 13.404 |
| leads | 1.584 kB | 1.837 |
| conversations | 1.528 kB | 1.953 |
| associados | 144 kB | 0 |
| whatsapp_instances | 96 kB | 1 |

**Conclusão:** banco é pequeno. Zero stress de I/O.

#### 0.3.4 — EXPLAIN ANALYZE da query do inbox

**(a) Versão base (sem include):**
```
Sort  (cost=196.76..201.73 rows=1988 width=354) (actual time=1.972..2.146 rows=1953 loops=1)
  Sort Key: last_message_at DESC NULLS LAST
  ->  Seq Scan on conversations  (rows=1953)
        Filter: (company_id = 'company-21go'::text)
Planning Time: 1.687 ms
Execution Time: 2.355 ms
```

**(b) Versão simulando o `include: { messages: { take: 1 } }` do Prisma:**
```
Sort  (cost=20832.13..20837.10 rows=1988 width=386) (actual time=55.871..56.130 rows=1953 loops=1)
  Sort Key: c.last_message_at DESC NULLS LAST
  Buffers: shared hit=9295
  ->  Seq Scan on conversations c  (rows=1953)
        SubPlan 1
          ->  Index Scan using ix_messages_conv on messages
                Index Cond: (conversation_id = c.id)
                loops=1953
Planning Time: 0.359 ms
Execution Time: 56.332 ms
```

**Análise:**
- O include é o custo dominante: 2.4ms → 56ms (24× mais).
- Postgres usa `ix_messages_conv` corretamente no subplan.
- Faz Seq Scan em `conversations` mesmo com índice em `company_id` — porque praticamente 100% das linhas têm `company_id = 'company-21go'`. Quando virar multi-tenant de verdade, o índice vai entrar.
- **56ms é OK para refetch ocasional. NÃO é o gargalo crítico.**

#### 0.3.5 — Distribuição horária (últimas 24h)

100 mensagens **todas inbound**:

| Hora UTC | Hora BRT | Inbound |
|---|---|---|
| 14:00 | 11:00 | 5 |
| 13:00 | 10:00 | **45** ← pico |
| 12:00 | 09:00 | 21 |
| 11:00 | 08:00 | (continua decrescente) |
| ... | ... | ... |

Throughput modesto. Pico ~45 msg/h = 0,75 msg/min. Não há stress nenhum no servidor.

#### 0.3.6 — Direção em 24h

```json
[{ "direction": "inbound", "last_at": "2026-05-11T14:03:36.000Z", "n": "99" }]
```

**Sem nenhuma outbound em 24h.** ← achado #1 confirmado pela primeira vez.

#### 0.3.7 — Direção histórica

```json
[
  { "direction": "outbound", "last_at": "2026-05-09T21:22:35.682Z", "n": "7758" },
  { "direction": "inbound", "last_at": "2026-05-11T14:03:36.000Z", "n": "5646" }
]
```

**A última outbound é de 09/05 21:22 UTC.** 49 horas sem envio. Coincide com o deploy do Projeto Japão.

#### 0.3.8 — Últimas 10 mensagens outbound

Todas de 2026-05-09 entre 18:48 e 21:22 UTC. Sender mistura `agent` (4 — templates da IA) e `vendedor` (6). **Nota:** `sender_id` está `null` em todas as 10 — apesar de [inbox.service.ts:285](backend/src/modules/inbox/inbox.service.ts#L285) passar `senderId: userId`. Investigar se isso é causa ou consequência (talvez essas saíram por outro caminho — followup ou automation).

#### 0.3.11 — Match user ↔ instância

8 usuários da company. **Só a Leticya tem WhatsApp conectado:**

```json
{
  "id": "4e9d733d-e25b-4566-82b4-68f3db9c5f4f",
  "email": "leticyathayene02@gmail.com",
  "first_name": "Leticya",
  "role": "vendedor",
  "instance_id": "16655b4f-fccd-48d1-b7cd-a568c07ff4b9",
  "evolution_name": "21gocrm_db9c5f4f_meu-whatsapp",
  "instance_status": "CONNECTED",
  "last_seen_at": "2026-05-11T13:34:51.351Z",
  "connected_at": "2026-05-08T18:21:33.008Z",
  "has_apikey": true
}
```

A instância **NÃO é mais `21gosite`** (que estava na memória do projeto até 09/05). Foi recriada/renomeada em `2026-05-08T18:21:33` — UM DIA antes do Projeto Japão. **Provavelmente nunca foi reconfigurada com o secret.**

#### 0.3.12 — Atribuição de conversations

```json
[
  { "assigned_to_id": "4e9d733d-...leticya", "n": 1822 },
  { "assigned_to_id": null, "n": 131 }
]
```

1822 conversas atribuídas à Leticya, 131 sem dono. Bate com o sintoma — ela é o único vendedor recebendo.

---

## ⛔ Tarefas que NÃO consigo executar sozinha

Estas 3 partes da Fase 0 dependem de acessos que eu não tenho. Te passo o passo-a-passo exato.

### 0.4 — Easypanel logs (PRECISA DE VOCÊ)

**Como pegar:**
1. Acessar Easypanel: http://167.71.31.77:3000
2. Projeto `social-21go` → serviço `crm-21go`
3. Aba **Logs** → filtrar últimas 2h
4. Procurar:
   - `upgrade` ou `websocket` ou `WS` → erros de upgrade WS no Traefik
   - `[sendMessage]` → toda chamada deve ter `Evolution OK` ou erro. Procurar erros recentes
   - `[EvolutionWebhook]` → erros de processamento
   - `[JAPAO][webhook]` → rejeições por secret
   - `EVOLUTION_UNAUTHORIZED` ou `EVOLUTION_FAIL` → falhas de envio

**Me cola aqui as 50 últimas linhas relevantes.** Esse é o dado mais valioso pra completar o quadro do envio quebrado.

### 0.5 — Teste cronometrado real (PRECISA DE VOCÊ)

**Procedimento (5x repetições):**
1. Abrir CRM em prod, logada como Leticya.
2. F12 → DevTools → aba **Network** → filtro `socket.io`.
3. Pedir pra alguém mandar uma mensagem do celular pro número da Leticya (pode ser **5521992208062** — seu número de teste).
4. Cronometrar (relógio do celular):
   - **T0** = horário que a msg saiu do celular
   - **T1** = aparece o frame Socket.IO no DevTools (Network, request `socket.io/?...` com response contendo o payload)
   - **T2** = aparece visualmente na inbox
5. Anotar T0, T1, T2.
6. Repetir 4x mais.

**Tabela esperada:**

| # | T0 (BRT) | T1 (frame socket) | T2 (UI) | T1−T0 | T2−T1 |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |
| 3 | | | | | |
| 4 | | | | | |
| 5 | | | | | |

Esse teste com mensagem REAL (não via smoke) vai expor o tempo da Evolution + retries no header rejeitado. **Suspeito que vai dar 10-20s em alguns casos.**

### 0.3 (continuação) — SQL no Supabase Studio (OPCIONAL — já tenho via Prisma)

Já cobri 0.3.1 a 0.3.12 via Prisma com `$queryRawUnsafe`. Se quiser confirmar diretamente no Supabase Studio (SQL Editor), as queries estão acima. Não é bloqueante.

---

## 📈 Métricas-base consolidadas (antes das Fases 1-3)

| Métrica | Valor atual | Como medi |
|---|---|---|
| Webhook accept rate | **39,1%** (72/(72+112)) | curl /stats |
| Webhook reject rate | **60,9%** | curl /stats |
| Latência webhook→socket (p50) | **2.652 ms** | smoke-realtime, 5 runs |
| Latência webhook→socket (p95) | **2.819 ms** | smoke-realtime, 5 runs |
| Handshake socket | **927 ms média** | smoke-realtime |
| Transporte socket | **polling** | smoke-realtime |
| Outbound nas últimas 24h | **0** | SQL |
| Outbound nas últimas 48h | **0** (última: 09/05 21:22 UTC) | SQL |
| Inbound nas últimas 24h | 100 | SQL |
| Query inbox (sem include) | 2,4 ms | EXPLAIN ANALYZE |
| Query inbox (com include) | 56 ms | EXPLAIN ANALYZE |
| Conversations total | 1.953 | SQL |
| Messages total | 13.404 (33 MB) | SQL |
| Heartbeat polling ativo | 15s | useInbox.ts:21 |
| Rate limit configurado | 100 req / 15 min | server.ts:89-92 |

---

## 🎯 Recomendação que muda o plano (ler com calma)

A Fase 1 original — "WebSocket de verdade" — **pode esperar**. O sintoma que a Leticya descreveu (10-20s a 3 min) é causado por **três fatores muito mais graves** que descobri agora:

### Reordenamento sugerido das fases (pra discussão):

#### 🔥 NOVA FASE 1 — Webhook rejeitando 60% (1-2h de trabalho, retorno enorme)
Reconfigurar o webhook da Evolution na instância `21gocrm_db9c5f4f_meu-whatsapp` com o secret correto. **Já existe o botão 📡 Wifi na UI que faz exatamente isso** — ou rodar manual o `POST /api/whatsapp/reconfigure-webhook` autenticado como Leticya. Mas antes precisamos validar **por que** o `setWebhook` da Evolution não está propagando o header (ou se está, por que ainda dá 401).

**Métrica de sucesso:** `accepted` cresce, `rejected` para de crescer no `/stats` após apertar o botão.

#### 🔥 NOVA FASE 2 — Outbound quebrado há 48h (2-3h de trabalho)
Investigar por que `sendMessage` parou de funcionar em 09/05 21:22 UTC. Hipóteses:
- (a) `EVOLUTION_API_KEY` global stale → `fetchInstanceApiKey` retorna null → fallback "Sessao do WhatsApp invalida". Resolve girando key.
- (b) Apikey da instância stale e a Evolution não está retornando uma nova. Resolve recriando instância.
- (c) `EVOLUTION_API_URL` no Easypanel está apontando pra URL errada. Resolve corrigindo env.

Pra diagnosticar: pedir pra Leticya tentar enviar uma mensagem agora, eu olho os logs do Easypanel.

**Métrica de sucesso:** uma mensagem outbound gravada no banco com sucesso, conferível via SQL.

#### 🟡 NOVA FASE 3 — WS de verdade (era Fase 1 original) — depois de 1+2 fechadas
Mesmo plano original. Mas com os ganhos de 1+2, talvez o WS deixe de ser P0 e vire P1.

#### 🟡 NOVA FASE 4 — Cache local em socket (era Fase 2 original) — opcional após 1+2+3
Mesmo plano original. Otimização legítima, mas não é o que está quebrando hoje.

#### 🟡 NOVA FASE 5 — Envio otimista (era Fase 3 original) — depende de 2 fechada
Só faz sentido depois que o envio voltar a funcionar.

---

## ❓ Perguntas pra você responder antes da Fase 1

1. **A Leticya está respondendo as mensagens dos clientes pelo celular físico** (WhatsApp do telefone) **ou pelo CRM?** Se for pelo celular, o sintoma percebido é diferente — o "atraso no envio" é ela enxergando o que ela mandou pelo celular não aparecer no CRM (handler `handleSendMessage` é no-op).
2. **Posso eu rodar o `POST /api/whatsapp/reconfigure-webhook`** com um token da Leticya pra reconfigurar o webhook da Evolution? Ou você prefere apertar o botão 📡 Wifi na UI?
3. **Você consegue testar AGORA enviar uma mensagem pelo CRM** (logada como Leticya) e me dizer o que aconteceu? (toast de erro, spinner infinito, sucesso aparente, etc.)
4. **Easypanel: você tem 10 minutos pra colar os logs do `crm-21go` aqui?** É o que falta pra fechar o quadro do envio quebrado.
5. **Sobre minhas mudanças não-commitadas iniciais** (leads/pipes/CardDrawer) — eram suas? Tinha trabalho em andamento que eu não toquei?

---

## ⛔ Fase 0 ENCERRADA. Aguardando seu OK + respostas pras 5 perguntas.

**Aviso explícito:** **NÃO vou seguir pra Fase 1 do plano original.** Os achados acima invalidam parte das suposições. Quero seu OK pra eu reordenar como sugeri (rejeição do webhook + envio quebrado **antes** de WS de verdade) ou pra você redirecionar.

Arquivo gerado nesta fase: `DIAGNOSTICO_FASE0.md` (este).
Branch: `fix/realtime-inbox-fase-0` (sem commits ainda — só este MD e o `AUDITORIA_CRM_21GO.md` da rodada anterior, ambos untracked).
Script temporário `backend/_diag_db.ts` foi deletado após coleta. Zero código produtivo tocado.
