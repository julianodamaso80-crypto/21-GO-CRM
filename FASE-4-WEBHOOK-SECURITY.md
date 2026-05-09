# Fase 4 — Segurança do Webhook Evolution

## Decisão técnica: token compartilhado, não HMAC

A Evolution API v2 **não envia HMAC nativamente** no webhook. O que ela suporta é
um campo `headers` no body do `POST /webhook/set/{instance}` que vira headers
customizados em cada chamada do webhook pra trás.

Avaliados:

| Opção | Veredicto |
|---|---|
| HMAC SHA-256 do body | ❌ Evolution v2 não suporta out-of-the-box (precisaria fork) |
| Token compartilhado em header customizado | ✅ Suportado nativo via `webhook.headers` |
| IP allowlist | ❌ Evolution roda no mesmo droplet, IP muda em redeploy |

**Escolhido: token compartilhado em `x-evolution-secret`.**

## Como funciona agora

1. **Backend gera/recebe `EVOLUTION_WEBHOOK_SECRET`** (env var) — gerado com `openssl rand -hex 32`.
2. **Quando o CRM cria/reconfigura instância na Evolution**, manda no body:
   ```json
   {
     "webhook": {
       "url": "https://crm21go.site/api/webhook/evolution",
       "headers": { "x-evolution-secret": "<secret>" },
       ...
     }
   }
   ```
3. **A cada evento WhatsApp**, a Evolution chama nosso webhook com o header `x-evolution-secret: <secret>`.
4. **Receiver valida** em [webhook-evolution.routes.ts:24-39](backend/src/modules/webhook-evolution/webhook-evolution.routes.ts#L24-L39):
   - Se header bate com env → 200 + processa
   - Se não bate → 401 + log warning + métrica `rejected++`
   - Se env vazia → modo soft (aceita tudo) + log warning único + métrica `accepted++`

## Endpoints novos

- `GET /api/webhook/evolution` → status do receiver + se secret está configurado
- `GET /api/webhook/evolution/stats` → métricas (`accepted`, `rejected`, `errors`, timestamps)

## Ativação em produção (depende da Fase 1 estar deployada)

1. Setar `EVOLUTION_WEBHOOK_SECRET` no Easypanel (já documentado em `DEPLOY-FASE-1.md`)
2. Após deploy, **na UI do CRM**, ir em WhatsApp e clicar no botão `📡 Wifi` (reconfigure-webhook)
   - Isso vai chamar `POST /api/whatsapp/reconfigure-webhook`, que vai mandar `setWebhook` pra Evolution com o header configurado
3. Confirmar funcionamento:
   - `curl https://crm21go.site/api/webhook/evolution` → `secretConfigured: true`
   - Mandar mensagem no WhatsApp → conferir `accepted++` em `/api/webhook/evolution/stats`

## Testes locais (com secret = "teste123")

```bash
# 1. Sobe backend com env
EVOLUTION_WEBHOOK_SECRET=teste123 npm run dev

# 2. POST sem header — espera 401
curl -X POST http://localhost:3333/api/webhook/evolution \
  -H "Content-Type: application/json" \
  -d '{"event":"messages.upsert"}'
# {"error":"invalid secret"}

# 3. POST com header errado — espera 401
curl -X POST http://localhost:3333/api/webhook/evolution \
  -H "Content-Type: application/json" \
  -H "x-evolution-secret: errado" \
  -d '{"event":"messages.upsert"}'
# {"error":"invalid secret"}

# 4. POST com header correto — espera 200
curl -X POST http://localhost:3333/api/webhook/evolution \
  -H "Content-Type: application/json" \
  -H "x-evolution-secret: teste123" \
  -d '{"event":"messages.upsert","data":{}}'
# {"ok":true,...}

# 5. Stats
curl http://localhost:3333/api/webhook/evolution/stats
# { accepted: 1, rejected: 2, errors: 0, ... }
```

## Rollback

Se a validação quebrar o fluxo (Evolution não consegue se autenticar):

1. **Rollback rápido**: removeber `EVOLUTION_WEBHOOK_SECRET` do Easypanel → modo soft volta, aceita tudo
2. **Rollback de código**: `git revert <commit-fase-4>` + redeploy

> ⚠️ Se o secret foi setado mas a Evolution não foi reconfigurada (botão `📡 Wifi`), o webhook
> vai rejeitar todas as mensagens e o WhatsApp vai parecer parado. Sempre rodar reconfigure-webhook
> depois de setar o secret pela primeira vez.

## Mudanças desta fase

- `backend/src/lib/evolution-client.ts` — `setWebhook` e `createInstance` agora propagam
  `EVOLUTION_WEBHOOK_SECRET` no campo `headers` do body, mais evento `MESSAGES_DELETE`
- `backend/src/modules/webhook-evolution/webhook-evolution.routes.ts` — métricas internas + log de aviso único + endpoint `/stats`
- `backend/src/server.ts` — warning no boot em produção quando `EVOLUTION_WEBHOOK_SECRET` ou `PUBLIC_WEBHOOK_URL` estão ausentes
