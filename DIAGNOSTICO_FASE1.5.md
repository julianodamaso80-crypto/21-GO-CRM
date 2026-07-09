# 🔬 Diagnóstico Fase 1.5 — Reavaliação crítica

> **Data:** 2026-05-11
> **Branch:** `fix/realtime-inbox-fase-1`
> **Modo:** Diagnóstico investigativo — ZERO alteração em código, banco, ou env vars
> **Trigger:** A mensagem TESTE da Leticya **chegou no destinatário com delay de ~10s**, o que invalidou parte da Fase 1.

---

## 🙏 Reconhecimento de erros da Fase 1

Antes de qualquer coisa, três conclusões da Fase 1 que **não se sustentam** com os novos dados:

| Fase 1 disse | Realidade |
|---|---|
| "Envio quebrado há 49h" | ❌ INCORRETO. Mensagens estão entregando (a TESTE chegou) |
| "21gosite device_removed impede envio" | ❌ INCORRETO. Connection state segue `close` mas a mensagem chegou |
| "Instância fantasma 404 é a CAUSA RAIZ" | ⚠️ INCOMPLETO. O 404 é REAL (testei com apikey completa) mas há outro caminho de envio que eu ainda não mapeei |

**Erro técnico de execução que eu fiz na Fase 1:** mandei o curl pra `21gocrm_db9c5f4f_meu-whatsapp` com `apikey: 'A5BC'` — só o **prefixo** de 4 chars, não a key inteira. Aqui na 1.5 refiz com a **apikey COMPLETA do banco** (`A5BCD56C-2A8F-494A-AA61-762B93774E20`, 36 chars). **O 404 se mantém** mesmo com a key correta. E a globalKey `52DE...` também responde 404. **A instância realmente não existe no servidor Evolution `automacoes-evolution-api.klo3fa.easypanel.host` (o que está no `.env` LOCAL).**

---

## 1.5.A — Caminhos de criação de mensagens outbound

### A.1 — Row COMPLETA da mensagem TESTE (todas as colunas)

```json
{
  "id": "a801bbb0-c4f9-470d-907a-fda11c27729f",
  "company_id": "company-21go",
  "conversation_id": "5d9e0bb7-2784-45db-bf75-5aec6ca09ced",
  "content": "TESTE",
  "sender": "vendedor",
  "sender_id": "4e9d733d-e25b-4566-82b4-68f3db9c5f4f",    ← Leticya (NÃO é null)
  "message_type": "text",
  "media_base64": null, "media_mime_type": null, "media_url": null,
  "direction": "outbound",
  "whatsapp_message_id": "3EB0D85BECEF7B3FA53FF7",       ← formato WhatsApp real
  "created_at": "2026-05-11T14:22:19.389Z",
  "status": "PENDING",                                    ← campo NÃO presente no schema.prisma
  "raw_payload": null,
  "sent_at": null, "delivered_at": null, "read_at": null, ← nunca foram atualizados
  "evolution_instance": null,                             ← NULL (não foi gravado)
  "jid": null, "pushname": null, "caption": null,
  "media_filename": null, "lead_id": null
}
```

**Fato 1:** `sender_id` está populado (Leticya). Minha afirmação anterior de "sender_id null" foi consequência de eu ter listado apenas 10 colunas no SELECT da Fase 1. **Errei.**

**Fato 2:** A mensagem tem `status: "PENDING"`. Esse campo **não existe no `schema.prisma`** (model Message). Foi adicionado ao Postgres fora do controle do Prisma.

### A.2 — Caminhos de `prisma.message.create` no backend

Encontrei exatamente **2 lugares**:

| Arquivo | Linha | Contexto |
|---|---|---|
| [backend/src/modules/inbox/inbox.service.ts](backend/src/modules/inbox/inbox.service.ts#L280) | 280 | `sendMessage` (outbound) |
| [backend/src/modules/webhook-evolution/webhook-evolution.service.ts](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L284) | 284 | `handleMessageUpsert` (inbound) |

Como a TESTE é `direction='outbound'`, **só pode ter saído por `inbox.service.ts:280`**.

### A.3 — Releitura cuidadosa de `sendMessage`

Reli linhas 173-330 de `inbox.service.ts`. Fluxo:

1. `prisma.conversation.findFirst()` — busca conversa.
2. Se `channel === 'whatsapp'` e tem phone → busca `whatsappInstance` (`status: CONNECTED`).
3. `evolution.sendText({ instanceName: instance.evolutionName, instanceKey: instance.evolutionApiKey, ... })`.
4. **No try:** se OK, captura `evolutionMessageId = sent?.key?.id || sent?.id`.
5. **No catch:** se status 401/403 → auto-heal (`fetchInstanceApiKey`). **Se status ≠ 401/403 → joga `AppError('EVOLUTION_FAIL')` e ABORTA.** Não chega no `message.create`.

**Implicação:** se o `sendText` retornou 404, **a mensagem TESTE não devia ter sido gravada.** Mas foi. **Logo, o `sendText` em PRODUÇÃO não retornou 404.**

### A.4 — Testes adicionais (com apikey completa)

```
A.4.1 — POST /message/sendText/21gocrm_db9c5f4f_meu-whatsapp
       header apikey = A5BCD56C-2A8F-494A-AA61-762B93774E20 (do banco, completa)
       → HTTP 404: "The \"21gocrm_db9c5f4f_meu-whatsapp\" instance does not exist"

A.4.2 — Mesma chamada com globalKey 52DE…
       → HTTP 404 (mesmo erro)

A.4.3 — GET /instance/fetchInstances com a apikey do banco A5BC…
       → HTTP 401 Unauthorized — essa key NÃO é aceita por essa Evolution

A.4.4 — GET /instance/fetchInstances com a globalKey AGORA
       → 1 instância: 21gosite, state=close, disconnectionAt=2026-05-11T13:33:13.774Z
```

**Conclusão dura:** o servidor Evolution `automacoes-evolution-api.klo3fa.easypanel.host` **não conhece** a instância `21gocrm_db9c5f4f_meu-whatsapp`. E a apikey do banco **não é aceita** lá.

**Hipótese forte (mas não verificada):** o backend em **produção** usa uma `EVOLUTION_API_URL` **DIFERENTE** do meu `.env` local. Naquela outra Evolution, a instância existe e a apikey é válida. **Não posso verificar sem ver o Environment do Easypanel.**

### A.5 — Outros caminhos de envio que não usam `prisma.message.create`

Pesquisei `sendText` no código. **Encontrei outro caminho** que não passa pelo Prisma message.create:

| Arquivo | Linha | Função |
|---|---|---|
| [backend/src/modules/plate-lookup/lead-followup.service.ts](backend/src/modules/plate-lookup/lead-followup.service.ts#L135) | 135 | `sendText(phone, text)` próprio do followup. Envia direto via `fetch`, **não grava em messages** |

Esse caminho é só pro **followup automático de cotação** (worker `startReengajamentoWorker` em [server.ts:278](backend/src/server.ts#L278)). Não é o que a Leticya usou na TESTE.

### A.6 — O que ainda NÃO sei

- **Por que `sendText` em produção não retornou 404.** Hipótese mais provável: `EVOLUTION_API_URL` em prod é diferente. Mas não verifiquei.

---

## 1.5.B — Logs do Easypanel ⛔ AGUARDANDO VOCÊ

Esta parte depende de acesso ao Easypanel. **Não posso fazer.**

### O que preciso

Logs do container `crm-21go` entre **`2026-05-11T14:22:00Z` e `2026-05-11T14:22:40Z`** (UTC) — 40 segundos em torno do TESTE.

Cole aqui:
```
[cole aqui o log cru desse intervalo]
```

**O que eu vou procurar:**
- `[sendMessage] Evolution OK` (sucesso) ou `[sendMessage] Evolution falhou` (erro com status)
- Se aparecer "Evolution OK" com ID `3EB0D85BECEF7B3FA53FF7` → confirma que prod tem URL diferente
- Se aparecer "Evolution falhou {status: 404}" → tem algum caminho que ignora o throw e grava mesmo assim (precisa rever código)

### Bônus que também ajuda

No painel do Easypanel, projeto `social-21go` → serviço `crm-21go` → aba **Environment**, me passe (com 4 primeiros chars mascarando o resto):

```
EVOLUTION_API_URL=______________________
EVOLUTION_API_KEY=____****
EVOLUTION_INSTANCE=__________
EVOLUTION_INSTANCE_PREFIX=__________
EVOLUTION_WEBHOOK_SECRET=____****
PUBLIC_WEBHOOK_URL=_____________________
```

---

## 1.5.C — Sobre a "21gosite desconectada"

### C.1 — Estado real AGORA

`GET /instance/connectionState/21gosite` (com globalKey):
```json
{ "instance": { "instanceName": "21gosite", "state": "close" } }
```

`GET /instance/fetchInstances` confirma `connectionStatus: "close"` + `disconnectionAt: 2026-05-11T13:33:13.774Z`.

**Não é cache stale.** Esses endpoints lêem do estado interno do Baileys. A `21gosite` (no servidor Evolution que eu enxergo) está realmente desconectada.

### C.2 — Auto-heal / auto-reconnect no código

Grep por `reconnect`, `auto-heal`, `connectionState`, `fetchInstanceApiKey` no backend. Achei:

| Lugar | O que faz |
|---|---|
| [evolution-client.ts:124](backend/src/lib/evolution-client.ts#L124) | `fetchInstanceApiKey` — pega apikey REAL via globalKey |
| [inbox.service.ts:240-247](backend/src/modules/inbox/inbox.service.ts#L240-L247) | Auto-heal apenas se status === 401 OR 403 |
| [whatsapp.service.ts:126-134](backend/src/modules/whatsapp/whatsapp.service.ts#L126-L134) | Mesma lógica no `reconfigureWebhook` |

**Não há nenhum** worker que tente reconectar uma instância caída sozinho. **Não há retry com backoff** para casos de `close`. **Não há cron job** no código que reabra a sessão.

Portanto: se a `21gosite` está fechada na visão do meu `.env`, e a mensagem TESTE chegou no destinatário, ou **outra Evolution está sendo usada**, ou **outro processo (fora do CRM Prisma) enviou**.

### C.3 — `pg_cron` no Supabase

Tentei consultar `cron.job` — `relation does not exist`. Não há schema cron configurado. **Não há jobs Postgres rodando.**

---

## 1.5.D — Os 60% de webhook rejeitado

### D.1 — Análise EXATA do handler

[webhook-evolution.routes.ts:22-56](backend/src/modules/webhook-evolution/webhook-evolution.routes.ts#L22-L56). Pseudo-código:

```
const expected = process.env.EVOLUTION_WEBHOOK_SECRET

if (expected) {  // ← modo ESTRITO em prod (está setado)
  const provided = headers['x-evolution-secret']
                || headers['x-webhook-secret']
                || query.secret
  if (provided !== expected) {
    stats.rejected += 1
    return reply.status(401).send({ error: 'invalid secret' })
  }
}
```

Verifica **igualdade exata** do header. Se não bate → 401, conta como `rejected`.

### D.2 — Origens possíveis dos 112 rejected

**O backend NÃO loga `request.ip` nem o secret recebido** (só loga `hasHeader: !!provided`). Não dá pra saber QUEM foi rejeitado, apenas que foi.

Possibilidades, ordenadas por probabilidade:

| # | Origem | Probabilidade | Como verificar |
|---|---|---|---|
| 1 | Outra instância Evolution (em outro servidor) configurada com secret antigo ou sem secret | **ALTA** se prod usa outro `EVOLUTION_API_URL` | Logs do Easypanel mostram IP de origem do request (Bloco D) |
| 2 | Bot/scanner público batendo no endpoint sem header | Média | IP estranho nos logs |
| 3 | `EVOLUTION_WEBHOOK_SECRET` em prod foi alterado depois do último `setWebhook` | Média (Leticya pode confirmar no Environment) | Comparar 4 primeiros do Easypanel com `25c6` do .env local |
| 4 | Outra app no Easypanel (n8n? site público?) chamando o endpoint | Baixa-Média | Logs com origin/user-agent |

### D.3 — `lastRejectedAt` ainda recente?

No momento da Fase 0: `accepted: 72, rejected: 112, lastRejectedAt: 2026-05-11T14:01:42.117Z`.

**AGORA (`2026-05-11T14:38:36Z`):** `accepted: 0, rejected: 6, lastRejectedAt: 2026-05-11T14:38:30.350Z` (6 segundos atrás).

**⚠️ ACHADO IMPORTANTE:** os contadores foram **zerados** entre a Fase 0 e agora. Isso só acontece se o **container foi reiniciado** (os contadores são em memória — variável `stats` no [webhook-evolution.routes.ts:12-19](backend/src/modules/webhook-evolution/webhook-evolution.routes.ts#L12-L19)).

**Implicações:**
- Houve um restart do `crm-21go` no Easypanel entre 14:02:24Z e 14:38:36Z. Pode ter sido deploy automático, OOM, crash, ou restart manual.
- **6 rejeições já apareceram desde o restart**, e ZERO aceitas. Significa: **toda chamada de webhook que chega está sendo rejeitada por header errado.**
- Isso **piora** a hipótese de que o que está chamando o webhook agora **não é** a `21gosite` (que tem o secret correto setado). É outro emissor.

---

## 1.5.E — Diagnóstico FINAL HONESTO

### O que aprendi de novo na Fase 1.5

1. **O banco do CRM tem 11 colunas extras na tabela `messages` que o `schema.prisma` não conhece** (`status`, `raw_payload`, `sent_at`, `delivered_at`, `read_at`, `evolution_instance`, `jid`, `pushname`, `caption`, `media_filename`, `lead_id`). E 6 colunas extras em `conversations` (`jid`, `evolution_instance`, `pushname`, `profile_pic_url`, `total_messages`, `unread_count`, `first_inbound_at`, `first_outbound_at`).
2. **Há 4 tabelas extras no banco** que não estão no `schema.prisma`: `conversion_events_log`, `lead_status_history`, `outbound_event_log`, `webhook_inbound_log`. Cara de log/audit.
3. **1.442 mensagens** (de 13.405 totais) têm `raw_payload` populado — provavelmente gravadas por OUTRO sistema (cara do `21Go-Disparo` mencionado no header do `evolution-client.ts`).
4. **`evolution_instance` na tabela `messages` revela 4 instâncias usadas historicamente:**
   - `null` → 11.963 msgs (criadas pelo CRM Prisma, que não preenche esse campo)
   - `21gosite` → 1.350 msgs (até 06/05 19:04)
   - `21GO2` → 49 msgs (até 07/05 01:28)
   - `21gosite2` → 43 msgs (até 09/05 21:22) — **última msg outbound real**
5. **Conversations idem:** 256 conversas com `evolution_instance=21GO2`, com `last_update` até hoje 14:14:27Z (4 min antes da TESTE).
6. **Trigger no banco:** `trg_update_conversation_on_message` mantém o `last_message_at` da conversation sincronizado quando uma message é inserida. Não escreve mensagens, só atualiza conversation.
7. **Não há cron jobs nem auto-reconnect logic** no backend Node — confirmado por grep.

### Perguntas duras que ainda precisam de resposta

| # | Pergunta | Como responder |
|---|---|---|
| 1 | A mensagem TESTE chegou no destinatário? **Quem confirmou? Você ou a Leticya?** Foi visto NO CELULAR do destinatário ou só na tela do CRM? | Você me confirma. Crítico distinguir "apareceu na UI do CRM" (optimistic) vs "chegou no celular do destinatário" |
| 2 | `EVOLUTION_API_URL` em PROD é o mesmo do meu `.env` local (`automacoes-evolution-api.klo3fa.easypanel.host`) ou outro? | Você confere no Easypanel Environment do `crm-21go` |
| 3 | Há OUTRA aplicação rodando no Easypanel (`app-social` ou outra) que também grava em `messages` e/ou usa Evolution? Talvez 21Go-Disparo? | Você confere o painel do Easypanel |
| 4 | Logs do Easypanel no momento da TESTE (14:22:15-14:22:40Z) — o `[sendMessage]` logou "Evolution OK" ou "Evolution falhou"? | Você cola os logs |

### Classificação dos 4 problemas iniciais — SINTOMA vs CAUSA

| Problema | Categoria | Justificativa |
|---|---|---|
| **Instância fantasma `21gocrm_db9c5f4f_meu-whatsapp`** | ❓ AINDA INDEFINIDO | É 404 contra a Evolution do `.env` local. Mas a TESTE chegou. Se prod tem outro `EVOLUTION_API_URL`, isso pode ser **irrelevante** (só problema do meu .env local). Se prod usa a mesma URL, é causa real e há outro caminho de envio que ainda não mapeei |
| **`21gosite` device_removed (close)** | 🟡 IRRELEVANTE pro envio | Não é a instância usada pelo CRM Prisma; era usada por OUTRO sistema (21Go-Disparo?) que parece não estar mais ativo |
| **Webhook rejeitando 60%** | ⚠️ INDEFINIDO | Pode ser ruído externo (bots, request scanner). Pode ser outra instância Evolution. Precisa dos logs com IP de origem |
| **Long-polling Socket.IO (~2.6s p50)** | 🔴 CAUSA REAL parcial | Mesmo que o resto funcione perfeitamente, polling sempre vai dar 1-3s de atraso por evento. **Confirma metade do delay de 10s** que ela vê |

### Hipótese atualizada (não confirmada) do delay de ~10s

(1) Frontend chama POST → backend grava `message` em PENDING → emite socket. (2) Backend chama Evolution em prod (que talvez seja outra URL) → Evolution aceita → retorna `3EB0...`. (3) Backend atualiza? — não. O `inbox.service.ts:280-296` apenas faz `prisma.message.create` com `whatsappMessageId: evolutionMessageId`. **Mas o `status` fica PENDING porque o create não passa esse campo** (não está no schema do Prisma — defaulta a `PENDING` do banco). (4) Evolution entrega ao WhatsApp. Cliente recebe.

**Os ~10s podem ser:**
- 0,5-2s — pipeline backend (find conversation, find instance, sendText)
- 1-3s — Evolution processar + delay anti-ban (`delay: 1000` no `sendText`)
- 1-3s — WhatsApp entregar ao destinatário (rede + cliente)
- 1-3s — long-polling jitter pra refresh visual no CRM

**Se isso for confirmado, a otimização REAL é:**
- WS de verdade (corta 1-3s do polling)
- Tornar envio assíncrono (responde frontend em 100ms, processa Evolution em background)

### Ordem proposta REVISADA pra correção (não execute sem OK)

| # | Ação | Bloqueia próxima? | Esforço |
|---|---|---|---|
| 1 | Você cola logs do Easypanel (1.5.B) e me passa o `EVOLUTION_API_URL` real de prod | SIM | 5 min |
| 2 | Eu analiso e decido entre 3 cenários: (a) prod usa outra Evolution → ignora todo o ruído da instância fantasma; (b) prod usa a mesma e tem caminho de envio que ignora 404 → bug a investigar; (c) outra coisa que ainda não vi | SIM | 10-30 min |
| 3 | Confirmar o que está acontecendo com os 60% de rejected (origem) | NÃO | depois |
| 4 | Decidir se ataca primeiro long-polling, envio assíncrono, ou tabelas dessincronizadas Prisma↔banco | NÃO | depois |

---

## ⛔ Fase 1.5 ENCERRADA. NÃO mexi em nada.

**Para fechar e seguir, preciso de:**

1. **Logs do Easypanel** entre `2026-05-11T14:22:00Z` e `14:22:40Z` (UTC). Sem isso eu estou chutando.
2. **`EVOLUTION_API_URL`, `EVOLUTION_API_KEY` (4 primeiros), `EVOLUTION_INSTANCE`, `EVOLUTION_INSTANCE_PREFIX`** do Environment do serviço `crm-21go` no Easypanel.
3. **Confirmação** se a mensagem TESTE chegou no celular do destinatário (visualmente) ou só ficou na UI do CRM.

Branch: `fix/realtime-inbox-fase-1` (mesmo). Sem commits.

Scripts temporários criados → rodados → **deletados** (`_diag_15.ts`, `_diag_15b.ts`, `_diag_15c.ts`). Nenhum código produtivo, banco ou env var foi tocado.
