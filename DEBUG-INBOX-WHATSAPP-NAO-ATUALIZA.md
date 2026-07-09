# 🔥 Bug crítico: Inbox WhatsApp não atualiza em tempo real

**Status:** aberto há ~3 dias. Tentativas anteriores não resolveram.
**Stack:** React 18 + Vite + TanStack Query + Socket.io-client | Fastify + Prisma + Socket.io + PostgreSQL Supabase
**Hospedagem:** Easypanel (Traefik) em DigitalOcean — domínio `crm21go.site`
**Integração WhatsApp:** Evolution API (Baileys) com webhook apontando pro backend

---

## 🎯 O que o usuário vê (sintoma)

URL: `https://crm21go.site/whatsapp`

1. A página mostra lista de conversas WhatsApp à esquerda, chat à direita.
2. **Quando uma mensagem nova chega no chip do WhatsApp, ela NÃO aparece em tempo real na lista.**
3. **Quando o usuário sai da página `/whatsapp` e volta, a lista não reflete as últimas mensagens recém-chegadas.** Só recarrega depois de algum tempo (~minutos).
4. **Quando dá F5 (refresh forçado), aparece tudo.**

Print do print do usuário: timestamps `12m, 13m, 17m, 18m, 22m` em várias conversas — ou seja, **algumas mensagens chegam** mas com delay de minutos, e nada chega em "agora / 1m".

---

## 🧭 Arquitetura do fluxo end-to-end

```
[Cliente envia WhatsApp]
      │
      ▼
[Servidor Evolution API ─ Baileys]
      │  POST com header x-evolution-secret
      ▼
[Backend Fastify ─ /api/webhook/evolution] ◄── valida secret, persiste, emite socket
      │       │
      │       └─► socketService.emitToCompany(companyId, 'inbox:new_message', {...})
      ▼
[Socket.io ─ rooms: company:<companyId>]
      │
      ▼
[Frontend Browser ─ SocketContext.tsx]
      │  socket.on('inbox:new_message') ─► TanStack Query setQueryData
      ▼
[Lista de conversas renderiza atualizada]
```

Heartbeat fallback: `useConversations` faz `refetchInterval = 60_000` (rede de segurança caso socket caia silenciosamente).

---

## 🚨 Suspeitos principais (em ordem de probabilidade)

### Suspeito #1 — Socket.io está FORÇADO em `polling` (sem WebSocket)

Arquivo: `frontend/src/contexts/SocketContext.tsx`

```ts
const socketInstance = io(SOCKET_URL, {
  auth: { token },
  // Traefik do Easypanel não está fazendo upgrade WebSocket (probe error).
  // Long-polling funciona estável; deixar ele tentar WS gera reconnection
  // loop e perdemos eventos no meio. Forçando polling resolve.
  transports: ['polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
})
```

**Por que isso pode ser o problema:**
- Polling depende de **sticky sessions** quando há mais de 1 réplica de backend. Se o Easypanel está rodando N réplicas atrás do Traefik sem sticky cookie, as requisições de polling caem em backends diferentes — o `sid` da sessão socket.io é desconhecido para o backend "errado" → erros de "Session ID unknown" e perda de eventos.
- Mesmo com 1 réplica, alguns proxies bufferizam respostas longas, quebrando o long-polling.
- Sem WebSocket, latência sobe e o backend não consegue empurrar eventos (precisa esperar o cliente fazer poll).

**O que pedir pro modelo:**
- Como configurar **Traefik (no Easypanel)** pra fazer upgrade WebSocket corretamente em uma app Fastify + Socket.io?
- Quais labels/headers Traefik preciso adicionar? (Tenho acesso ao painel Easypanel mas não ao docker-compose direto — preciso saber se tem como configurar via UI.)
- Como detectar do navegador se o handshake do socket está conseguindo `upgrade`?

### Suspeito #2 — Evolution API está rejeitando ou não disparando o webhook

Arquivo: `backend/src/modules/webhook-evolution/webhook-evolution.routes.ts`

```ts
const expected = process.env.EVOLUTION_WEBHOOK_SECRET
if (expected) {
  const provided =
    (request.headers['x-evolution-secret'] as string | undefined) ||
    (request.headers['x-webhook-secret'] as string | undefined) ||
    (request.query as any)?.secret
  if (provided !== expected) {
    return reply.status(401).send({ error: 'invalid secret' })
  }
}
```

**Por que isso pode ser o problema:**
- A env var `EVOLUTION_WEBHOOK_SECRET` foi setada no backend recentemente.
- Mas as **instâncias Evolution que já existiam** foram criadas SEM esse secret — então a Evolution não envia o header `x-evolution-secret`, e o webhook rejeita com 401.
- Existe um botão **📡 Wifi** na UI que faz `POST /api/whatsapp/reconfigure-webhook` — mas se o usuário não clicou após o deploy, a instância ainda manda webhook sem header.
- Endpoint pra diagnosticar: `GET /api/webhook/evolution/stats` retorna `{accepted, rejected, errors, lastAcceptedAt, lastRejectedAt}`.

**O que pedir pro modelo:**
- Comando `curl` pra bater no `/api/webhook/evolution/stats` autenticado (é público sem auth) e interpretar:
  - Se `rejected > accepted` → o secret está bloqueando.
  - Se `accepted > 0` mas `lastAcceptedAt` é antigo → Evolution parou de mandar.
- Como olhar logs do Evolution diretamente no servidor pra ver se ele está tentando entregar?

### Suspeito #3 — Lista do React Query ignora conversas NOVAS

Arquivo: `frontend/src/hooks/useInbox.ts`

```ts
function moveToFrontAndUpdate(list, conversationId, patch) {
  if (!list) return list
  const idx = list.findIndex((c) => c.id === conversationId)
  if (idx === -1) return list  // ⚠️ conversa não está na lista → IGNORA
  // ...
}

useSocketEvent('inbox:new_message', (payload) => {
  qc.setQueriesData({ queryKey: ['conversations'] }, (old) => {
    if (!old) return old
    const idx = old.findIndex((c) => c.id === conversationId)
    if (idx === -1) return old  // ⚠️ MESMO BUG
    // ...
  })
})
```

**Por que isso pode ser o problema:**
- Quando chega mensagem de um **número novo** (lead inexistente que vira lead via webhook), o backend cria a conversation, emite `inbox:new_message` com `conversationId` novo.
- O frontend recebe, mas como **a nova conversation ainda não está na lista cacheada** (`old.findIndex === -1`), o handler simplesmente retorna `old` sem fazer nada.
- Só vai aparecer no próximo `refetchInterval` (60s) ou no F5.

**Esse provavelmente é o motivo do delay percebido como "minutos".**

**O que pedir pro modelo:**
- Sugestão de fix: ao invés de só atualizar a lista existente, fazer `qc.invalidateQueries({ queryKey: ['conversations'] })` quando `findIndex === -1` (forçar refetch só pra conversa que não existia).
- Ou prepend da conversa nova diretamente (mas falta o `contact` completo no payload do socket — só tem `id` e `fullName`).
- Avaliar: qual estratégia escala melhor pra ~2000 conversas?

### Suspeito #4 — Heartbeat de 60s vira backup ineficiente em listas grandes

```ts
const HEARTBEAT_MS = 1000 * 60

useQuery({
  queryKey: ['conversations', params],
  queryFn: () => inboxService.listConversations(params),
  staleTime: 1000 * 30,
  refetchInterval: HEARTBEAT_MS,
})
```

**Backend (`inbox.service.ts → listConversations`):**
```ts
const conversations = await prisma.conversation.findMany({
  where, // companyId + filtros
  include: { associado, lead, assignedTo, messages (top 1) },
  orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
  // SEM take, SEM skip ⚠️
})
```

**Por que isso pode ser o problema:**
- A query traz TODAS as conversas (sem paginação). Com ~2000 conversas + N mensagens incluídas, isso pode demorar segundos.
- Cada heartbeat de 60s dispara essa query pesada → backend lento → quando finalmente responde, a UI demora pra renderizar (2000 items na sidebar).
- Se o cliente fechar a aba antes do refetch terminar, a próxima abertura mostra dados velhos do cache.

**O que pedir pro modelo:**
- Estratégia recomendada de paginação infinita pra inbox com socket.io (cursor-based vs offset, manter consistência com push de mensagem nova).

### Suspeito #5 — Cross-tenant guard pode estar BLOQUEANDO o join

Arquivo: `backend/src/websocket/socket.service.ts`

```ts
// Cross-tenant guard (Projeto Japão Fase 5)
const tenantPrefixes = ['company:', 'inbox:', 'dashboard:', 'appointments:']
const matchedPrefix = tenantPrefixes.find((p) => room.startsWith(p))
if (matchedPrefix) {
  const targetCompany = room.slice(matchedPrefix.length)
  if (targetCompany !== companyId) {
    logger.warn('[JAPAO][socket] tentativa de join cross-tenant bloqueada')
    callback?.({ success: false, error: 'cross-tenant join denied' })
    return
  }
}
```

E no `SocketContext.tsx` o frontend faz:
```ts
socketInstance.emit('join_room', `company:${user.companyId}`)
```

**Mas no `handleConnection` do backend o usuário JÁ é automaticamente joined:**
```ts
socket.join(SocketRooms.user(userId))
socket.join(SocketRooms.company(companyId))  // ⬅️ auto-join
socket.join(SocketRooms.dashboard(companyId))
socket.join(SocketRooms.inbox(companyId))
```

**Possível problema:**
- O auto-join usa `SocketRooms.company(companyId)`. O front depois emite `join_room: 'company:<id>'`. Se `SocketRooms.company(id)` retornar algo diferente de `company:${id}` (por exemplo, com prefixo extra como `co:${id}`), o cliente está numa room mas o emit vai pra outra → eventos perdidos.

**O que pedir pro modelo:**
- Confirmar que `SocketRooms.company(id)` em `socket.types.ts` retorna exatamente `company:${id}`.
- Sugerir mudar `emitToCompany` pra também emitir pra `inbox:<id>` redundantemente (a inbox usa esse room).

### Suspeito #6 — `_isProductionBrowser ? '' : ...` quebra socket em domínios não-localhost de dev

```ts
const _isProductionBrowser = typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
const SOCKET_URL = _isProductionBrowser ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3333')
```

`SOCKET_URL = ''` em produção significa "mesmo origin que o browser está rodando". OK em teoria. Mas o `io('')` no socket.io-client pode ter comportamento diferente em algumas versões. Documentar a versão e validar.

---

## 📋 Arquivos relevantes (cole junto)

### `backend/src/modules/webhook-evolution/webhook-evolution.service.ts`

```ts
import { prisma } from '../../config/database'
import { socketService } from '../../websocket'
import { ensureCardForLead } from '../leads/lead-card.helper'

// ... (handleMessageUpsert: extrai phone, idempotência por whatsappMessageId,
//      cria/acha lead, cria conversation, persiste message, emite socket)

async function handleMessageUpsert(payload) {
  // 1. Ignora fromMe e grupos
  // 2. Idempotência por whatsappMessageId
  // 3. Mapeia instance → user/companyId via WhatsappInstance
  // 4. Procura Associado → Lead → cria Lead novo se nada bater
  // 5. Cria card no Kanban automaticamente (ensureCardForLead)
  // 6. Abre ou reusa Conversation
  // 7. Persiste Message com timestamp REAL da Evolution
  // 8. Update conversation.lastMessageAt + unreadCount++
  // 9. Emit socket: socketService.emitToCompany(companyId, 'inbox:new_message', {...})
}
```

### `backend/src/websocket/socket.service.ts` — emitToCompany

```ts
emitToCompany(companyId: string, event: keyof ServerToClientEvents, data: any): void {
  if (!this.io) { logger.warn('Socket.io not initialized'); return }
  this.io.to(SocketRooms.company(companyId)).emit(event as any, data)
}
```

### `frontend/src/hooks/useInbox.ts` — handler de inbox:new_message

```ts
useSocketEvent('inbox:new_message', (payload: any) => {
  const conversationId = payload?.conversationId
  const message = payload?.message
  if (!conversationId || !message) return
  const isInbound = message.direction === 'inbound'

  qc.setQueriesData({ queryKey: ['conversations'] }, (old) => {
    if (!old) return old
    const idx = old.findIndex((c) => c.id === conversationId)
    if (idx === -1) return old  // ⚠️ conversa nova é IGNORADA
    // move to front, increment unread, update preview
  })
})
```

### `frontend/src/contexts/SocketContext.tsx` — config Socket.io-client

```ts
const _isProductionBrowser = typeof window !== 'undefined'
  && window.location.hostname !== 'localhost'
  && window.location.hostname !== '127.0.0.1'
const SOCKET_URL = _isProductionBrowser ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3333')

const socketInstance = io(SOCKET_URL, {
  auth: { token },
  transports: ['polling'],  // ⚠️ WebSocket desabilitado
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000,
})
```

---

## 🧪 Comandos de diagnóstico que já posso rodar

```bash
# 1. Stats do webhook (público, sem auth)
curl https://crm21go.site/api/webhook/evolution/stats

# 2. Health do socket — não tem endpoint dedicado, mas dá pra abrir o DevTools:
#    Network → filter "socket.io" → ver se as requisições POST/GET /socket.io/ retornam 200
#    Console → procurar "[Socket.io] Connected successfully <id>"

# 3. Browser console — após login no /whatsapp, rodar:
#    window.__socket = (algum hack pra pegar a instância) → window.__socket.connected
```

---

## ❓ Perguntas pro modelo (GPT-5.5)

1. **Causa-raiz mais provável:** olhando o fluxo end-to-end e os 6 suspeitos, qual é a hipótese mais provável pra "delay de minutos + lista que não atualiza ao voltar pra página"?

2. **Plano de diagnóstico ordenado:** que comandos rodo, em que ordem, pra eliminar cada suspeito? (Quero algo executável, não abstrato.)

3. **Solução pro Suspeito #3 (lista ignora conversa nova):** qual é a forma mais idiomática em TanStack Query v5 de tratar "evento socket trouxe entidade nova que não está na lista cacheada"? Quero evitar `invalidateQueries` por causar refetch da lista inteira (~2000 itens sem paginação).

4. **Solução pro Suspeito #1 (Traefik não faz WS upgrade):** como configuro Traefik via Easypanel UI pra habilitar WebSocket upgrade na rota `/socket.io/`? Tem como NÃO precisar mexer em docker-compose? Se precisar, qual a syntax exata das labels?

5. **Paginação da inbox:** sugestão de implementação de infinite scroll com socket.io que **não quebre quando uma mensagem nova chega numa página que o usuário não está olhando**.

6. **Checklist de monitoramento:** que métricas mínimas devo ter pra detectar essa regressão automaticamente no futuro? (heartbeat de socket, latência do webhook, drift entre evento socket emitido vs renderizado...)

---

## 📎 Contexto extra

- **Histórico:** em 2026-05-09, projeto "Japão Fase 5" trocou polling de 15s por socket + heartbeat de 60s. A intenção foi aliviar carga. Mas isso INTRODUZIU o bug do `findIndex === -1` ignorar conversa nova.
- **Antes:** polling de 15s pegava lista inteira → conversa nova aparecia em até 15s.
- **Depois:** socket é a fonte principal → mas conversa nova nunca aparece via socket (bug do findIndex), só via heartbeat de 60s → percepção "demora 1 minuto pra aparecer".
- **No print:** todas as conversas têm timestamp ≥ 12m. Coincide com hipótese de que o heartbeat puxou uma vez ~10-20m atrás e parou de funcionar (talvez aba em background, throttling do navegador, ou socket caiu sem reconectar).

---

**Resumo de 3 linhas pra quem só vai ler isso:**

> Inbox WhatsApp atualizando com delay de minutos em prod. Pipeline `Evolution → webhook → Prisma → socket.io → React Query → lista` tem múltiplos pontos de falha: (a) socket forçado em polling-only por Traefik não fazer upgrade WS, (b) handler do socket no front ignora conversa cujo ID não está na lista cacheada, (c) lista sem paginação → heartbeat de 60s é caro. Preciso de causa-raiz + plano executável.
