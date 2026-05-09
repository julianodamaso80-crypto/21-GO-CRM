# Fase 2 — Diagnóstico de Filas

## Análise do uso real

Auditei `backend/src/modules/plate-lookup/quote-queue.ts` e `lead-followup.service.ts`:

| Item | Quantidade | Estado |
|---|---|---|
| Queues Bull | 1 (`quote-followup`) | Subutilizada |
| Tipos de job | 1 (`follow-up-quote`, delay 5min) | **Nunca agendado** — `scheduleFollowUp` não é chamado em lugar nenhum |
| Workers | 2 (`quoteQueue.process` + `startReengajamentoWorker`) | Reengajamento **desativado por decisão de produto** ([lead-followup.service.ts:386-391](backend/src/modules/plate-lookup/lead-followup.service.ts#L386-L391)) |
| Cron jobs / repeatable | 0 | — |

## Reality check

A premissa da auditoria ("Redis offline → follow-up morto → leads não nutridos") **estava errada**:

1. O follow-up de cotação foi mudado pra **envio imediato** ([plate-lookup.routes.ts:220-228](backend/src/modules/plate-lookup/plate-lookup.routes.ts#L220-L228) — `sendFollowUp` direto sem fila quando o cliente clica em "Contratar pelo WhatsApp").
2. O reengajamento automático foi **desativado deliberadamente** ("após o envio inicial, o bot NÃO envia mais nenhuma mensagem").
3. O `scheduleFollowUp` da Bull queue não é chamado em parte alguma do código.

Ou seja: **a fila Bull existe mas não tem job sendo agendado**. O worker fica esperando indefinidamente. Sem Redis em produção, ela tenta conectar em loop e polui os logs.

## Decisão

**Caminho C (não previsto no plano original): neutralizar a queue com switch via env, sem ativar Redis.**

Motivos:
- Ativar Redis no Easypanel só pra suportar uma queue que ninguém chama é desperdício.
- Construir scheduler nativo com Postgres (Caminho B) é overengineering — não tem job sendo agendado pra processar.
- Caminho A (Redis ativo) ficaria pronto pra reativação futura, mas desnecessário agora.

**Solução:** queue só inicializa se `ENABLE_FOLLOWUP_QUEUE=true` E `REDIS_URL`/`REDIS_HOST` estiverem setados (ignorando `localhost`). Default: desabilitada.

## Como reativar quando precisar

Quando alguém quiser reativar o follow-up agendado de 5min:

1. Easypanel → criar serviço **Redis** (template oficial, porta 6379)
2. Adicionar env var no `crm-21go`: `REDIS_URL=redis://redis-social:6379`
3. Adicionar env var: `ENABLE_FOLLOWUP_QUEUE=true`
4. Voltar a chamar `scheduleFollowUp(leadId)` no handler do `POST /lead` em `plate-lookup.routes.ts`
5. Redeploy

## Healthcheck

Novo endpoint `GET /api/health/queue` reporta:

```json
{
  "enabled": false,
  "state": "disabled",
  "lastError": null,
  "reason": "ENABLE_FOLLOWUP_QUEUE != true; REDIS_URL/HOST ausente",
  "timestamp": "..."
}
```

Quando habilitado:
- `state: "ready"` → conexão OK (200)
- `state: "error"` → Redis caiu (503)
- `state: "idle"` → ainda não conectou

## Mudanças desta fase

- `backend/src/modules/plate-lookup/quote-queue.ts` — queue lazy + switch via env + healthcheck export
- `backend/src/server.ts` — endpoint `GET /api/health/queue`

## Rollback

Se a refatoração quebrar algo (ex: lugar não-mapeado depende da queue):

```bash
git revert <commit-fase-2>
git push origin main
# Easypanel auto-rebuilda
```

Comportamento de fallback nativo: `scheduleFollowUp` e `cancelFollowUp` viram no-op (logam mas não lançam erro). Nenhum endpoint quebra.
