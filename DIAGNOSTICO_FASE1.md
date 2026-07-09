# 🔍 Diagnóstico Fase 1

> **Data:** 2026-05-11
> **Branch:** `fix/realtime-inbox-fase-1`
> **Modo:** Diagnóstico ativo — ZERO código produtivo alterado
> **Confirmação inicial:** Leticya responde clientes PELO CELULAR físico (confirmado por você).

---

## 🚨 CAUSA RAIZ ENCONTRADA — leia primeiro

A Fase 1 expôs **duas falhas catastróficas simultâneas** que explicam 100% do sintoma:

### Falha A — Instância "fantasma" no banco do CRM

A `whatsapp_instances` aponta para `evolutionName = "21gocrm_db9c5f4f_meu-whatsapp"`. **Essa instância NÃO existe na Evolution API.** Chamar `POST /message/sendText/21gocrm_db9c5f4f_meu-whatsapp` retorna **HTTP 404 `The "21gocrm_db9c5f4f_meu-whatsapp" instance does not exist`**.

A única instância que existe na Evolution é a `21gosite` (antiga, mencionada na memória de 09/05).

**Consequência:** todo `sendMessage` do CRM tenta usar a instância fantasma → 404 → erro `EVOLUTION_FAIL` → mensagem nunca sai. **Isso bate exatamente com a última outbound real ser de 09/05 21:22 UTC.**

### Falha B — A `21gosite` REAL foi desconectada hoje

A `21gosite` (que ainda existe na Evolution) foi **desconectada em `2026-05-11T13:33:13.774Z`** com erro `device_removed` (someone unlinked the WhatsApp Web/app, ou o celular cortou o pareamento).

```json
"connectionStatus": "close",
"disconnectionReasonCode": 401,
"disconnectionAt": "2026-05-11T13:33:13.774Z",
"disconnectionObject": "...Stream Errored (conflict)...device_removed..."
```

**Consequência:** mesmo se eu corrigir o nome no banco AGORA, nenhuma mensagem sai/chega porque o WhatsApp está fora do ar. Precisa reescanear QR no celular da empresa.

### Bônus — a mensagem "TESTE" que a Leticya tentou agora

Eu vi no banco que às `14:22:19Z` apareceu uma mensagem outbound `"TESTE"` com `whatsapp_message_id: "3EB0D85BECEF7B3FA53FF7"`. Esse ID **NÃO existe na Evolution** (`findMessages` retornou `total: 0`). Mas foi gravado no banco do CRM. Há um caminho de envio que está gravando a mensagem **mesmo quando o sendText falha**. Vou investigar isso na próxima rodada — pode ser um optimistic update que não rolba, ou outro endpoint além do `inbox.service.sendMessage`. Preciso saber o que apareceu na tela da Leticya pra fechar.

---

## 1.1 — Webhook find (JSON cru) ✅ EXECUTADO

### 1.1.a — Config base lida do .env local
```
EVOLUTION_API_URL: https://automacoes-evolution-api.klo3fa.easypanel.host
EVOLUTION_API_KEY (4 primeiros): 52DE****
EVOLUTION_WEBHOOK_SECRET (4 primeiros): 25c6****
PUBLIC_WEBHOOK_URL: (unset)     ← ⚠️ não setado no .env LOCAL (em prod precisa estar)
BACKEND_URL: https://crm21go.site
```

### 1.1.b — Instância "21gocrm_db9c5f4f_meu-whatsapp" no banco do CRM
```json
{
  "id": "16655b4f-fccd-48d1-b7cd-a568c07ff4b9",
  "evolutionName": "21gocrm_db9c5f4f_meu-whatsapp",
  "status": "CONNECTED",     ← MENTIRA (cache stale do banco)
  "userId": "4e9d733d-...-leticya",
  "evolutionApiKey": "A5BC****",     ← stale, não bate com a key real
  "connectedAt": "2026-05-08T18:21:33.008Z",
  "lastSeenAt": "2026-05-11T13:34:51.351Z",
  "ownerJid": "5521980214882@s.whatsapp.net",
  "phone": "21980214882"
}
```

### 1.1.c — Chamada `fetchConnectionState` e `fetchInstanceApiKey` para a instância fantasma
```
Estado da conexão WhatsApp: close
fetchInstanceApiKey retornou null  ← instância não existe na Evolution
findWebhook retornou null  ← idem
```

### 1.1.d — Lista TODAS as instâncias na Evolution
```
HTTP 200, content-type application/json
Resposta = ARRAY com 1 instâncias.
Nomes: [ '21gosite' ]

A "21gocrm_db9c5f4f_meu-whatsapp" está na lista? false
```

### 1.1.d.2 — JSON COMPLETO da `21gosite` (a que existe de verdade)
```json
{
  "id": "f3638f77-e933-4d4a-ad4d-b0468e8c04c0",
  "name": "21gosite",
  "connectionStatus": "close",
  "ownerJid": "5521980214882@s.whatsapp.net",
  "profileName": "21 Go",
  "integration": "WHATSAPP-BAILEYS",
  "token": "52DE882E153D-40EF-BD72-946FEB2E5C1F",  // ← same prefix da globalKey
  "clientName": "evolution_exchange",
  "disconnectionReasonCode": 401,
  "disconnectionObject": "{\"error\":{\"data\":{\"tag\":\"conflict\",\"attrs\":{\"type\":\"device_removed\"}},...\"message\":\"Stream Errored (conflict)\"}...}",
  "disconnectionAt": "2026-05-11T13:33:13.774Z",
  "createdAt": "2026-04-22T13:08:38.299Z",
  "updatedAt": "2026-05-11T13:33:13.796Z",
  "_count": { "Message": 19421, "Contact": 3862, "Chat": 262 }
}
```

### 1.1.d.3 — Webhook da `21gosite` (configurado e correto!)
```json
{
  "id": "cmoa33xl10512lc4ymlr30oxv",
  "url": "https://crm21go.site/api/webhook/evolution",
  "headers": {
    "Content-Type": "application/json",
    "x-evolution-secret": "25c6aacd9b6e4148c0de109ca4e2d7495bafda0ebf6702804fef4827e81df8ad"
  },
  "enabled": true,
  "events": [
    "QRCODE_UPDATED",
    "CONNECTION_UPDATE",
    "MESSAGES_UPSERT",
    "MESSAGES_UPDATE",
    "SEND_MESSAGE"
  ],
  "webhookByEvents": false,
  "webhookBase64": true,
  "createdAt": "2026-04-22T13:24:30.277Z",
  "updatedAt": "2026-05-09T10:10:10.598Z",   // ← Projeto Japão (botão 📡 Wifi)
  "instanceId": "f3638f77-e933-4d4a-ad4d-b0468e8c04c0"
}
```

**Validação cruzada do secret:**
- `.env` local (header `EVOLUTION_WEBHOOK_SECRET`): começa com `25c6****`
- Webhook da `21gosite` no header `x-evolution-secret`: começa com `25c6aacd9b...`
- **BATE ✅**

### 1.1.d.4 — Estado AGORA da `21gosite`
```
Estado: close
```

### 1.1.e — Sanity check da Evolution
```
HTTP 200
{"status":200,"message":"Welcome to the Evolution API, it is working!","version":"2.3.7","clientName":"evolution_exchange",...}
```

### 1.1.X — Teste forçando sendText na instância fantasma (replica o erro real do CRM)
```
POST /message/sendText/21gocrm_db9c5f4f_meu-whatsapp
HTTP 404
Body: {"status":404,"error":"Not Found","response":{"message":["The \"21gocrm_db9c5f4f_meu-whatsapp\" instance does not exist"]}}
```

---

## 1.2 — Secret check ✅ EXECUTADO (com método alternativo)

Você pediu pra eu inspecionar o secret no Easypanel — não tenho acesso direto. Mas consegui validar pelo caminho inverso:

| Origem | 4 primeiros |
|---|---|
| `backend/.env` LOCAL (Leticya tem; Claude leu) | `25c6****` |
| Webhook da `21gosite` na Evolution (campo `headers.x-evolution-secret`) | `25c6aacd9b...` |
| **Match** | ✅ **SIM** |

**Como o webhook tem o secret correto:** alguém apertou o botão 📡 Wifi (`POST /api/whatsapp/reconfigure-webhook`) em `2026-05-09T10:10:10Z` — `updatedAt` do registro do webhook. Foi durante o Projeto Japão, quando ainda usavam a `21gosite`.

**Pergunta aberta pra você (entregável 1.2):** entrar no Easypanel → projeto `social-21go` → serviço `crm-21go` → aba Environment, e me dizer:
- Os 4 primeiros caracteres da var `EVOLUTION_WEBHOOK_SECRET` lá. **Tem que ser `25c6`** pra rejection rate cair. Se for diferente, foi alterada DEPOIS da última reconfig do webhook (e a Evolution está mandando o header velho enquanto o backend exige o novo).
- Se `PUBLIC_WEBHOOK_URL` está setado (no .env local ela está unset).

---

## 1.3 — Logs do Easypanel ⛔ PRECISA DE VOCÊ

Eu não tenho acesso ao Easypanel. Te peço:

### Como capturar (5 minutos)
1. Abrir http://167.71.31.77:3000 → projeto `social-21go` → serviço `crm-21go` → aba **Logs**.
2. Filtrar últimas **2 horas**.
3. Capturar e colar nos 4 blocos abaixo. Pode editar este arquivo direto, ou colar aqui no chat.

### Bloco A — Rejeições de webhook (busque: `JAPAO` ou `webhook` + `secret` ou `rejected`)
```
[cole aqui]
```

### Bloco B — Falhas de envio (busque: `sendMessage` ou `EVOLUTION_FAIL` ou `EVOLUTION_UNAUTHORIZED` ou `NO_WHATSAPP`)
**HIPÓTESE PRÉ-LOG:** deve aparecer toneladas de `EVOLUTION_FAIL` com mensagem `instance does not exist` (status 404), porque toda tentativa de envio vai cair nisso enquanto a instância no banco for a fantasma.
```
[cole aqui]
```

### Bloco C — Inicialização (busque: `BACKEND STARTED` ou `bootstrap` no começo do log atual)
**O que eu quero ver:**
- Se aparece `[JAPAO][security] EVOLUTION_WEBHOOK_SECRET ausente em PRODUÇÃO` → secret não está em prod (= falha grave)
- Se aparece `[JAPAO][config] PUBLIC_WEBHOOK_URL ausente` → URL não está em prod
- Versão/commit deployado (talvez aparece no log)
```
[cole aqui]
```

### Bloco D — Erros não-tratados (busque: `Error`, `Unhandled`, `ECONNREFUSED`, `401`, `403`, `404`, `does not exist`)
```
[cole aqui]
```

---

## 1.4 — Teste cronometrado da Leticya ⚠️ PARCIAL

A Leticya **já testou** enviar a mensagem `"TESTE"` enquanto eu fazia o diagnóstico (gravada em `2026-05-11T14:22:19.389Z`).

### O que eu sei sem precisar de você

- A mensagem foi gravada no banco do CRM:
  ```
  id: a801bbb0-c4f9-470d-907a-fda11c27729f
  direction: outbound
  sender: vendedor
  content: TESTE
  whatsapp_message_id: 3EB0D85BECEF7B3FA53FF7   ← formato típico de WhatsApp real
  sender_id: NULL                               ← ⚠️ deveria ser o user id da Leticya
  ```
- A mensagem **NÃO existe na Evolution**: `findMessages({ key: { id: '3EB0D85BECEF7B3FA53FF7' } })` retornou `total: 0`.
- A `21gosite` continua `close` agora.

### O que eu PRECISO que a Leticya me diga

1. Quando ela apertou enviar, **o que apareceu na tela?**
   - [ ] Toast verde de "Mensagem enviada"
   - [ ] Toast vermelho de erro (qual mensagem?)
   - [ ] Spinner girando infinitamente
   - [ ] Mensagem apareceu na conversa imediatamente (optimistic)
   - [ ] Outra coisa: _______________

2. **A mensagem chegou no celular do destinatário?**
   - [ ] Sim
   - [ ] Não
   - [ ] Não conferiu

3. **Onde dentro do CRM ela tentou enviar?**
   - [ ] /whatsapp (página de Inbox/conversas)
   - [ ] /inbox
   - [ ] CardDrawer do Kanban
   - [ ] Drawer de Lead
   - [ ] Outro: _______________

3 é importante porque há vários caminhos de envio diferentes. Se ela usou o CardDrawer, é outra rota que talvez tenha optimistic update sem rollback.

### Logs do momento exato (14:22:19Z)

Você consegue pegar no Easypanel as 30 linhas que apareceram **entre `14:22:15Z` e `14:22:30Z`**? Cole aqui:

```
[cole aqui]
```

---

## 📋 Resumo executivo

| Item | Status |
|---|---|
| 1.1 — Webhook find na Evolution | ✅ executado por mim |
| 1.2 — Secret check | ⚠️ inferido (precisa só confirmar no Easypanel) |
| 1.3 — Logs Easypanel | ⛔ aguardando você colar 4 blocos |
| 1.4 — Teste Leticya | ⚠️ parcial (já testou; preciso saber o que apareceu na tela) |

### Plano de correção SUGERIDO (após você OK)

Tudo abaixo é **fora desta Fase 1** (que era só diagnóstico). Estou listando pra você ver o caminho — mas **não executo nada sem OK explícito**.

#### Sub-fase 1.X — Reconectar WhatsApp (~5 min, **manual da Leticya**)
1. Abrir CRM → `/whatsapp`.
2. Apertar "Conectar WhatsApp" — vai abrir um QR.
3. No celular: WhatsApp → Aparelhos conectados → Conectar um aparelho → escanear o QR.

**Pergunta importante:** quando ela apertar "Conectar", o backend (na rota `POST /api/whatsapp`) vai checar se já existe uma instância e tentar usar a do banco — `21gocrm_db9c5f4f_meu-whatsapp`. Que não existe na Evolution. Aí o backend chama `fetchQrCode(...)` que vai retornar `null` (instância não existe). Resultado: o QR pode não aparecer.

**Alternativas em ordem de preferência:**

**Opção A (recomendada — limpa):**
- Backend: DELETE da row em `whatsapp_instances` da Leticya (1 SQL UPDATE/DELETE).
- Frontend/UI: Leticya aperta "Conectar WhatsApp" no CRM.
- Backend cria uma instância nova na Evolution com o nome novo + webhook configurado com secret (o código `createInstance` faz isso direito — [evolution-client.ts:35-79](backend/src/lib/evolution-client.ts#L35-L79)).
- Leticya escaneia QR.

**Opção B (alternativa — manual):**
- Atualizar `evolution_name = '21gosite'` + `evolution_api_key = '52DE882E153D-40EF-BD72-946FEB2E5C1F'` na row da Leticya.
- Apertar 📡 Wifi pra reconfigurar webhook (já está, mas garantir).
- Leticya escaneia QR do `21gosite` (a instância antiga).

A Opção A é mais limpa porque o nome da instância vira algo padronizado pelo CRM (`21gocrm_<userId>_<slug>`). Mas joga fora as 19.421 mensagens da `21gosite` histórica que vivem no banco da Evolution (não nas msgs do CRM — essas estão preservadas).

#### Sub-fase 1.Y — Confirmar envio
- Smoke test do envio: rodar `npx tsx backend/scripts/smoke-realtime.ts --target=https://crm21go.site`
- Leticya envia uma mensagem teste pro `5521992208062` (seu número).
- Verificar `accepted` incrementa no `/stats` e a mensagem aparece no banco com `whatsapp_message_id` que EXISTE na Evolution.

---

## ⛔ Fase 1 ENCERRADA. Aguardando:

1. **Você colar os 4 blocos do log do Easypanel** (Bloco A, B, C, D na seção 1.3).
2. **A Leticya me dizer** o que apareceu na tela dela quando ela apertou enviar `"TESTE"` (seção 1.4 — checkboxes).
3. **Sua confirmação dos 4 primeiros chars do `EVOLUTION_WEBHOOK_SECRET` no Easypanel** (deve bater com `25c6****`).
4. **Seu OK** pra executar a Sub-fase 1.X (Opção A ou B).

**Nada de código produtivo foi tocado. Scripts temporários `_diag_webhook.ts`, `_diag_lastmsg.ts`, `_diag_send.ts` foram criados, rodados e deletados.**
Branch: `fix/realtime-inbox-fase-1` (apenas este MD + os dois MDs anteriores, todos untracked).
