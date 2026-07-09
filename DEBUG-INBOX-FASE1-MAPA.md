# Investigação Inbox WhatsApp — Fase 1: Mapa do código + evidência inicial

> **Status:** investigação em andamento. Nenhum código foi alterado.
> **Data:** 2026-05-11 ~20:20 UTC
> **Autor:** Claude (Opus 4.7)

---

## Evidência zero-custo já coletada (Fase 4 parcial)

Antes de mapear código, rodei 3 GETs públicos que provam o estado do pipeline server-side:

```bash
$ curl https://crm21go.site/api/webhook/evolution/stats
{
  "accepted": 1103,
  "rejected": 0,
  "errors": 0,
  "lastAcceptedAt": "2026-05-11T19:52:45.119Z",
  "lastRejectedAt": null,
  "warnedNoSecret": false,
  "secretConfigured": true,
  "timestamp": "2026-05-11T20:19:47.562Z"
}

$ curl https://crm21go.site/api/webhook/evolution
{
  "status": "ok",
  "service": "webhook-evolution",
  "timestamp": "2026-05-11T20:19:48.424Z",
  "secretConfigured": true
}

$ curl https://crm21go.site/health
{
  "status": "ok",
  "uptime": 10872.78,  // ~3h sem restart
  "database": "prisma"
}
```

### Interpretação

| Evidência | Conclusão |
|---|---|
| `accepted=1103, rejected=0, errors=0` | Webhook está **funcionando** server-side. Evolution entrega, secret bate, persistência conclui sem erro. |
| `secretConfigured=true` | Env `EVOLUTION_WEBHOOK_SECRET` aplicada. |
| `lastAcceptedAt=19:52 UTC ≈ 16:52 BRT` | Bate com o print que o usuário mandou (timestamps "12m, 13m, 17m, 18m, 22m" às ~17:10 BRT). Mensagens estão entrando no banco. |
| `uptime=10872s ≈ 3h` | Backend não reiniciou no período do bug. Não é cold start. |

### Hipóteses ELIMINADAS por essa evidência

- ❌ **Hipótese 1 — Evolution não entrega webhook**: refutada. 1103 aceitos.
- ❌ **Hipótese 2 — Webhook rejeitado por secret**: refutada. `rejected=0`.
- ❌ **Hipótese 3 — Backend recebe mas não persiste**: refutada. `errors=0` significa que o `processEvolutionWebhook` retornou sem throw. Implícito: persist concluiu.

### Hipóteses que SOBRARAM (em ordem de probabilidade)

- ⚠️ **Hipótese 7 — Frontend recebe socket mas cache ignora conversa nova** (forte: bug do `findIndex === -1`)
- ⚠️ **Hipótese 6 — Socket perde evento** (forte: polling-only + possível buffering Traefik)
- ⚠️ **Hipótese 5 — Backend emite pra room sem cliente** (médio: precisa contar clientes na room)
- ⚠️ **Hipótese 4 — Backend persiste mas não emite socket** (baixo: código tem `emit` após persist, mas pode falhar silenciosamente em `catch`)
- ⚠️ **Hipótese 8 — Cache atualiza mas render não reflete** (baixo: TanStack Query normalmente notifica)
- ⚠️ **Hipótese 9 — Lista REST lenta/pesada** (secundário, mas explica heartbeat falhando)

---

## Mapa do código — backend

### 1. `backend/src/modules/webhook-evolution/webhook-evolution.routes.ts`

**Função no fluxo:** porta de entrada do POST da Evolution.

| Pergunta | Resposta |
|---|---|
| Eventos recebidos | HTTP POST `/api/webhook/evolution` |
| Eventos emitidos | Nenhum diretamente; delega pra `processEvolutionWebhook` |
| QueryKey TanStack | N/A |
| Filtros silenciosos | Sim: rejeita 401 se `expected && provided !== expected`. Se `expected` vazio, aceita tudo (modo soft). Hoje `secretConfigured=true`, então valida. |
| Notas | Catch envolto envia 200 mesmo em erro pra Evolution não desativar webhook → erros de processamento ficam invisíveis pro caller mas contabilizam em `errors` |

### 2. `backend/src/modules/webhook-evolution/webhook-evolution.service.ts`

**Função no fluxo:** processa o payload, persiste, emite socket.

| Pergunta | Resposta |
|---|---|
| Eventos recebidos | `processEvolutionWebhook(payload)` é chamado pela route |
| Eventos emitidos | `socketService.emitToCompany(companyId, 'inbox:new_message', {conversationId, message, contact, channel})` em `handleMessageUpsert` linha 335 |
| QueryKey TanStack | N/A |
| Filtros silenciosos | Sim, múltiplos: `fromMe`, `isGroup`, `whatsappMessageId duplicate`, `invalid_jid`, `no_company`. Todos retornam `{ignored: '...'}` sem throw, contabilizam como `accepted` (porque não dão erro). |
| Notas críticos | **Linha 344**: `catch (err)` no `socketService.emitToCompany` só faz `console.warn` e segue — se socket falhar, **não há retry nem evidência observável fora do log**. |

**Fluxo de `handleMessageUpsert`:**

```
1. Lê data.key.remoteJid, fromMe, id, messageTimestamp
2. Ignora se fromMe || isGroup(remoteJid)
3. Idempotência: busca message por whatsappMessageId, ignora se já existe
4. Resolve companyId/userId via WhatsappInstance (lookup por evolutionName)
5. Procura Associado por phone → Lead → cria Lead novo + ensureCardForLead
6. Cria/reusa Conversation (status != closed) — orderBy createdAt desc
7. prisma.message.create com createdAt = messageTs real
8. prisma.conversation.updateMany SET lastMessageAt = messageTs, unreadCount++ (WHERE id = conv.id AND (lastMessageAt < messageTs OR null))
9. socketService.emitToCompany(companyId, 'inbox:new_message', {...})
```

**Dado mínimo que vai no payload do socket:**
```ts
{
  conversationId: conversation.id,
  message: {  // Prisma.Message completo
    id, content, sender, direction, messageType,
    mediaBase64, mediaMimeType, whatsappMessageId,
    createdAt, conversationId, companyId, ...
  },
  contact: { id, fullName },  // ← MUITO ENXUTO. Sem phone, sem firstName/lastName separados, sem avatar
  channel: { type: 'whatsapp', name: 'WhatsApp' }
}
```

⚠️ **Problema potencial #1:** o payload do socket **não tem** o `Conversation` completo nem `phone` do contato. Pra renderizar uma linha nova da lista, o frontend precisa de: `id, contact.firstName, contact.lastName, contact.phone, lastMessagePreview, lastMessageAt, unreadCount, status`. **O socket atual entrega menos da metade disso.** Isso explica por que `useInbox.ts` aborta quando a conversa não está na lista — não tem dados pra inserir.

### 3. `backend/src/websocket/socket.service.ts`

**Função no fluxo:** servidor Socket.IO com auth JWT, rooms tenant-scoped.

| Pergunta | Resposta |
|---|---|
| Eventos recebidos | `join_room`, `leave_room`, `typing`, `stop_typing`, `message_read`, `disconnect` |
| Eventos emitidos | Tudo via `emitToCompany(companyId, event, data)` → `io.to('company:<id>').emit(...)` |
| Filtros silenciosos | **Sim, crítico**: handleJoinRoom rejeita join se `room.startsWith('company:')` e `targetCompany !== socket.data.companyId`. Mesma coisa pra `inbox:`, `dashboard:`, `appointments:`, `user:`. |
| Auto-join no connect | `socket.join('user:<userId>')`, `'company:<companyId>'`, `'dashboard:<companyId>'`, `'inbox:<companyId>'`, `'appointments:<companyId>'` — TODOS automaticamente em `handleConnection` linha 116-120 |
| Notas | `emitToCompany` usa `SocketRooms.company(id) = 'company:${id}'` — mesma string do auto-join. ✓ sem mismatch |

**Confirmado:** o `SocketRooms.company(id)` em `socket.types.ts:317` retorna **exatamente** `` `company:${companyId}` ``. **Não há mismatch de room.** Suspeito #5 da minha hipótese anterior está enfraquecido (mas não totalmente eliminado — precisa contar clientes ativos).

### 4. `backend/src/modules/inbox/inbox.service.ts`

**Função no fluxo:** REST API da inbox (GET conversations, GET messages, POST messages, etc.).

| Pergunta | Resposta |
|---|---|
| Eventos recebidos | HTTP via controller |
| Eventos emitidos | `inbox:new_message` (no sendMessage), `conversation:updated` (no updateStatus), `conversation:assigned` (no assign) |
| QueryKey TanStack | N/A (é backend) |
| Filtros silenciosos | `listConversations` filtra por `userId/userRole` quando não privilegiado |
| Performance | ⚠️ `prisma.conversation.findMany` **SEM `take`/`skip`** — traz todas as conversas da empresa. Com `include` aninhado e ~2000+ conversas, pode levar segundos. |

**Resposta da `listConversations`:**
```ts
{
  ...c,
  channel: { type, name },
  contact: { id, fullName, email, phone, firstName, lastName, avatar: null },
  lastMessage: c.messages[0] || null,
  lastMessagePreview: c.messages[0]?.content || null,
}
```

⚠️ **Problema potencial #2:** sem paginação. Cada heartbeat REST traz a lista inteira.

### 5. `backend/src/server.ts` — bootstrap do Socket.IO

| Linha | O quê |
|---|---|
| 109-110 | `await fastify.register(websocket)` — plugin de WebSocket do Fastify (legado, não usado pelo socket.io) |
| 257-261 | `await socketService.initialize(fastify)` **depois** de `fastify.listen()`. ✓ Correto. |
| 31-39 (em socket.service) | `new SocketIOServer(fastify.server, { cors, transports: ['websocket', 'polling'], pingTimeout: 60000, pingInterval: 25000 })` — backend **aceita** os 2 transports |

**Conclusão:** o backend está pronto pra WebSocket E polling. **O frontend que está forçando polling-only**.

### 6. `backend/src/modules/inbox/inbox.routes.ts` + controller

Confirma: rota `/api/conversations` (alias `/api/inbox`) com `authenticate` hook. Sem paginação no schema.

---

## Mapa do código — frontend

### 7. `frontend/src/contexts/SocketContext.tsx`

| Pergunta | Resposta |
|---|---|
| O que faz | Inicializa o socket.io-client após login, conecta na URL e joina `company:<id>` |
| Eventos enviados | `join_room`, `leave_room`, `typing`, etc. |
| Eventos recebidos | Todos os do servidor (forward pro `useSocketEvent`) |
| QueryKey | N/A |
| Filtros silenciosos | Não inicializa se `!isAuthenticated || !token || !user` |
| **Bug potencial** | Linha 75: `socketInstance.emit('join_room', \`company:${user.companyId}\`)` — formato **string**. O backend aceita string OU `{room, metadata}` (linha 158-160 de socket.service.ts) ✓ |
| **Bug crítico** | Linha 60: `transports: ['polling']` — **WebSocket desabilitado** com comentário "Traefik do Easypanel não está fazendo upgrade WebSocket (probe error)". Não há evidência DE QUANDO esse problema foi confirmado nem se ainda existe. |

### 8. `frontend/src/hooks/useInbox.ts`

**Função no fluxo:** TanStack Query + 3 listeners de socket.

| Pergunta | Resposta |
|---|---|
| QueryKey | `['conversations', params]` — params inclui `status`/`search` filtrados |
| staleTime | 30s |
| refetchInterval | 60s (heartbeat fallback) |
| Eventos escutados | `inbox:new_message`, `conversation:updated`, `conversation:assigned` |
| **Filtro silencioso #1** | `useConversations` linha 56: `if (idx === -1) return old` — **conversa nova é DESCARTADA do cache** |
| **Filtro silencioso #2** | `useConversations` linha 53: `qc.setQueriesData({queryKey: ['conversations']}, ...)` afeta TODAS as variações do cache (status="open", status="resolved", etc.). Se a conversa nova for status="open" e a query atual filtra "resolved", o `idx === -1` é correto pra essa query — mas a tab "Todos" também recebe o update e descarta. |
| **Filtro silencioso #3** | `useMessages` linha 107: `if (payload?.conversationId !== conversationId) return` — correto (filtra mensagens de outra conversa). |
| `useMessages` staleTime | 10s |
| `useMessages` refetchInterval | 60s |
| Dado mínimo pra render | A linha da sidebar precisa de: `c.contact.firstName`, `c.contact.lastName`, `c.contact.fullName`, `c.contact.phone`, `c.lastMessagePreview`, `c.lastMessageAt`, `c.unreadCount`, `c.status`, `c.id`. **Payload do socket NÃO traz `phone`, `firstName`, `lastName`, nem `status`** → impossível prepend sem invalidate. |

### 9. `frontend/src/services/inbox.service.ts`

Simples wrapper axios. `listConversations({status, search})` → `GET /conversations`. Sem paginação.

### 10. `frontend/src/pages/whatsapp/WhatsappPage.tsx`

| Pergunta | Resposta |
|---|---|
| O que renderiza | `<ConversationsLayout>` com sidebar de conversas + chat |
| Como usa o hook | `useConversations({status, search})` — chama com filtros |
| **Listener duplicado** | Linhas 188-193: outra cópia de `useSocketEvent('inbox:new_message')` que faz `queryClient.invalidateQueries({queryKey: ['conversations']})`. **Isso é redundante e potencialmente ÚTIL**: invalidate força refetch → cobre o caso de conversa nova que o hook descartou. |
| Memoização | Não há `useMemo`/`memo` no list rendering — vai re-renderizar conforme TanStack Query notifica |
| Filtro local | `const filtered = conversations || []` — sem filtro client-side adicional |
| Notificação | `useNewMessageNotifier(selectedId)` toca som + push se `direction==='inbound'` e `conversationId !== selectedRef.current` |

⚠️ **Observação importante:** o `invalidateQueries` no WhatsappPage **deveria** refetchar a lista quando chega mensagem nova. Se isso está funcionando, a conversa nova **deveria** aparecer em até 1-2s após o socket entregar. **Se não aparece, o problema é:**
- (a) o socket nem entrega o evento no front (Hipótese 6 - perda) OU
- (b) o backend não emite (Hipótese 4 - silent fail) OU
- (c) o invalidate refetcha mas a query é tão lenta (sem paginação) que o user percebe como "delay" (Hipótese 9).

### 11. `frontend/src/hooks/useSocketEvent.ts`

| Pergunta | Resposta |
|---|---|
| O que faz | `socket.on(event, handler)` + cleanup |
| **Bug potencial #4** | Linha 30: `if (!socket || connectionStatus !== 'connected') return` → **se o socket está em `'connecting'` no momento que o hook monta, o listener NÃO é registrado**. Só registra quando muda pra `'connected'`. Como o effect depende de `[socket, connectionStatus, event]`, ele re-registra quando muda. ✓ correto. |

---

## Resumo do mapa — fluxo end-to-end com falhas potenciais marcadas

```
[Cliente WhatsApp envia mensagem]
      │
      ▼
[Evolution API] ─────────────────────────► PROVADO OK (1103 entregas)
      │
      ▼
[POST /api/webhook/evolution] ───────────► PROVADO OK (rejected=0)
      │
      ▼
[processEvolutionWebhook]
      │
      ├─► Idempotência whatsappMessageId
      ├─► Resolve company/user via WhatsappInstance
      ├─► Cria Lead se necessário + Card no Kanban
      ├─► Cria/reusa Conversation
      ├─► prisma.message.create ──────────► PROVADO OK (errors=0)
      ├─► prisma.conversation.update lastMessageAt + unreadCount
      │
      ▼
[socketService.emitToCompany('inbox:new_message')] ◄─⚠️ HIPÓTESE 4
      │     - se socket NÃO inicializado: warn silencioso, nenhum evento sai
      │     - se nenhum cliente na room company:<id>: emit OK mas perdido
      │
      ▼ (assumindo emit OK)
[Socket.IO Server ─ room: company:<companyId>]
      │
      ▼ ◄─⚠️ HIPÓTESE 5: clientes podem não estar na room (desconectados)
      │   ⚠️ HIPÓTESE 6: polling-only + Traefik buffering pode perder
      │
[Browser SocketContext.tsx]
      │     - transports: ['polling'] forçado
      │     - auth: { token: JWT }
      │     - auto-join via emit('join_room', 'company:<id>') (REDUNDANTE com auto-join do backend)
      │
      ▼
[useSocketEvent('inbox:new_message')] (2 listeners)
      │
      ├─► useInbox.ts:46 → setQueriesData ◄─⚠️ HIPÓTESE 7
      │   - if (idx === -1) return old  ← BUG: descarta conversa nova
      │
      └─► WhatsappPage.tsx:188 → invalidateQueries ✓
          - força refetch da listConversations
                  │
                  ▼
          [GET /api/conversations] ◄─⚠️ HIPÓTESE 9
                  - sem paginação, 2000 registros
                  - leva 2-5s em produção?
                  │
                  ▼
          [TanStack Query atualiza cache]
                  │
                  ▼
          [Re-render da WhatsappPage] ◄─⚠️ HIPÓTESE 8 (improvável)
                  │
                  ▼
          [Sidebar atualizada]
```

---

## Fase 2 — Logs propostos (NÃO APLICADOS)

Abaixo, as 10 patches que vou aplicar **assim que você autorizar**. Cada bloco é um diff visual; nenhum foi escrito em disco ainda.

> **Convenção de correlationId:** uso `whatsappMessageId || messageKey.id || nanoid()`. Mascaramento de telefone: últimos 4 dígitos.

### Patch 2.1 — `webhook-evolution.routes.ts` (entrada e rejeição)

Adicionar no início do `hook`:

```ts
const startTs = Date.now()
const body = request.body as any
const correlationId =
  body?.data?.key?.id ||
  body?.data?.messageKey?.id ||
  `wh_${startTs}_${Math.random().toString(36).slice(2, 8)}`

request.log.info(
  {
    correlationId,
    event: body?.event,
    instance: body?.instance,
    fromMe: body?.data?.key?.fromMe,
    remoteJid: body?.data?.key?.remoteJid,
    pushName: body?.data?.pushName,
    hasMessage: !!body?.data?.message,
    receivedAt: new Date().toISOString(),
    providedSecretExists: !!(
      request.headers['x-evolution-secret'] ||
      request.headers['x-webhook-secret'] ||
      (request.query as any)?.secret
    ),
    expectedSecretExists: !!process.env.EVOLUTION_WEBHOOK_SECRET,
  },
  '[WA_WEBHOOK_RECEIVED]',
)
```

No bloco de rejeição:
```ts
if (provided !== expected) {
  stats.rejected += 1
  stats.lastRejectedAt = new Date().toISOString()
  request.log.warn(
    {
      correlationId,
      reason: 'invalid_or_missing_secret',
      hasExpectedSecret: !!expected,
      hasProvidedSecret: !!provided,
      instance: body?.instance,
      event: body?.event,
    },
    '[WA_WEBHOOK_REJECTED]',
  )
  return reply.status(401).send({ error: 'invalid secret' })
}
```

Propagar `correlationId` pro service via `request.body.__correlationId = correlationId` (hack barato e temporário).

### Patch 2.2 — `webhook-evolution.service.ts` (persist + emit)

Substituir o final do `handleMessageUpsert`:

```ts
// ANTES de prisma.message.create:
const persistStart = Date.now()
const oldLastMessageAt = conversation
  ? (await prisma.conversation.findUnique({ where: { id: conversation.id }, select: { lastMessageAt: true } }))?.lastMessageAt
  : null

console.log(JSON.stringify({
  tag: '[WA_MESSAGE_PERSIST_START]',
  correlationId,
  companyId,
  leadId,
  associadoId: associado?.id ?? null,
  conversationId: conversation.id,
  whatsappMessageId: whatsappMessageId || null,
  direction: 'inbound',
  oldLastMessageAt: oldLastMessageAt?.toISOString() || null,
}))

const message = await prisma.message.create({ /* ... */ })

await prisma.conversation.updateMany({ /* ... */ })

console.log(JSON.stringify({
  tag: '[WA_MESSAGE_PERSIST_DONE]',
  correlationId,
  messageId: message.id,
  conversationId: conversation.id,
  newLastMessageAt: messageTs.toISOString(),
  durationMs: Date.now() - persistStart,
}))

// Emit socket — com contagem de clientes na room
try {
  const io = socketService.getIO()
  const roomCompany = `company:${companyId}`
  const roomInbox = `inbox:${companyId}`
  const sockCompany = io ? await io.in(roomCompany).fetchSockets() : []
  const sockInbox = io ? await io.in(roomInbox).fetchSockets() : []

  console.log(JSON.stringify({
    tag: '[INBOX_SOCKET_EMIT_ATTEMPT]',
    correlationId,
    companyId,
    roomCompany,
    roomInbox,
    eventName: 'inbox:new_message',
    conversationId: conversation.id,
    messageId: message.id,
    clientsInCompanyRoom: sockCompany.length,
    clientsInInboxRoom: sockInbox.length,
    socketServerInitialized: socketService.isInitialized(),
  }))

  socketService.emitToCompany(companyId, 'inbox:new_message', {
    conversationId: conversation.id,
    message: message as any,
    contact: { id: associado?.id || leadId || 'unknown', fullName: associado?.nome || pushName },
    channel: { type: 'whatsapp', name: 'WhatsApp' },
    __correlationId: correlationId,  // ← propaga pro frontend
  })
} catch (err) {
  console.warn('[EvolutionWebhook] socket emit failed:', (err as Error).message)
}
```

### Patch 2.3 — `socket.service.ts` (conexão + join)

```ts
// Em handleConnection, após socket.join(...) das rooms iniciais:
const rooms = Array.from(socket.rooms).filter(r => r !== socket.id)
console.log(JSON.stringify({
  tag: '[SOCKET_CONNECTED]',
  socketId: socket.id,
  userId,
  companyId,
  transport: socket.conn.transport.name,  // 'polling' ou 'websocket'
  roomsJoined: rooms,
}))

// Em handleJoinRoom, antes de cada callback:
console.log(JSON.stringify({
  tag: '[SOCKET_JOIN_ROOM]',
  socketId: socket.id,
  userId,
  requestedRoom: room,
  accepted: !error,  // ajusto a lógica no patch real
  reason: error || 'ok',
  currentRooms: Array.from(socket.rooms).filter(r => r !== socket.id),
}))
```

### Patch 2.4 — `SocketContext.tsx` (frontend connect)

```ts
socketInstance.on('connect', () => {
  log('Connected successfully', socketInstance.id)
  console.log('[FE_SOCKET_CONNECTED]', {
    socketId: socketInstance.id,
    transport: socketInstance.io.engine.transport.name,
    connected: socketInstance.connected,
    companyId: user?.companyId,
  })
  // ... resto
})

// Listener global pra TODOS os eventos do servidor:
socketInstance.onAny((eventName, ...args) => {
  const payload = args[0]
  console.log('[FE_SOCKET_EVENT]', {
    eventName,
    correlationId: payload?.__correlationId,
    conversationId: payload?.conversationId,
    messageId: payload?.message?.id,
    receivedAt: new Date().toISOString(),
    transport: socketInstance.io.engine.transport.name,
  })
})
```

### Patch 2.5 — `useInbox.ts` (processamento do cache)

```ts
useSocketEvent('inbox:new_message', (payload: any) => {
  const conversationId = payload?.conversationId
  const message = payload?.message
  const correlationId = payload?.__correlationId
  if (!conversationId || !message) return

  const isInbound = message.direction === 'inbound'
  let foundIndex = -1
  let actionTaken = 'unknown'
  let listLengthBefore = 0
  let listLengthAfter = 0
  const queryKeysAtingidas: any[] = []

  qc.setQueriesData({ queryKey: ['conversations'] }, (old: ConvListItem[] | undefined) => {
    if (!old) {
      actionTaken = 'no_cache'
      return old
    }
    listLengthBefore = old.length
    const idx = old.findIndex((c) => c.id === conversationId)
    foundIndex = idx

    if (idx === -1) {
      actionTaken = 'ignored_missing_conversation'
      return old
    }
    // ... lógica atual de moveToFrontAndUpdate
    actionTaken = 'updated_existing'
    listLengthAfter = old.length
    return moveToFrontAndUpdate(old, conversationId, { /* ... */ })
  })

  console.log('[FE_INBOX_EVENT_PROCESS]', {
    correlationId,
    conversationId,
    messageId: message?.id,
    listLengthBefore,
    foundIndex,
    actionTaken,
    listLengthAfter,
  })
})
```

### Patch 2.6 — `WhatsappPage.tsx` (render top)

```ts
// Logo após `const filtered = conversations || []`:
useEffect(() => {
  if (filtered.length === 0) return
  const top = filtered[0]
  console.log('[FE_INBOX_RENDER_TOP]', {
    topConversationId: top.id,
    topLastMessageAt: top.lastMessageAt,
    topContactName: top.contact?.fullName,
    listLength: filtered.length,
    renderedAt: new Date().toISOString(),
  })
}, [filtered])
```

---

## Fase 3 — Roteiro de teste controlado (PRA EXECUTAR APÓS AUTORIZAR FASE 2)

Cada cenário com instrução exata de o que registrar:

### Cenário A — conversa existente
1. Login no `crm21go.site/whatsapp` na máquina A (vendedor).
2. DevTools aberto, console limpo.
3. Confirmar que apareceu `[FE_SOCKET_CONNECTED]` no console.
4. Da máquina B (seu celular, 21 99220-8062), mandar mensagem pro chip conectado.
5. **Coletar do console do navegador**: `[FE_SOCKET_EVENT]` + `[FE_INBOX_EVENT_PROCESS]` + `[FE_INBOX_RENDER_TOP]`.
6. **Coletar do servidor** (`docker logs`): `[WA_WEBHOOK_RECEIVED]`, `[WA_MESSAGE_PERSIST_DONE]`, `[INBOX_SOCKET_EMIT_ATTEMPT]`.
7. Validar que o `correlationId` é o mesmo nas 6 linhas.
8. Validar visualmente: conversa subiu pro topo? `topConversationId` no log bate?

### Cenário B — número novo
1. Mesma setup do A.
2. Da máquina C (número que NÃO está na lista), mandar mensagem.
3. **Expectativa**: ver `actionTaken: 'ignored_missing_conversation'` se a hipótese 7 estiver correta.
4. **Mas o `invalidateQueries` da `WhatsappPage` deveria refetchar** — esperar ~2-5s e ver se aparece via heartbeat ou refetch.

### Cenário C — outbound (vendedor envia pelo CRM)
1. Mandar mensagem pelo input do chat.
2. Verificar se `[INBOX_SOCKET_EMIT_ATTEMPT]` é emitido pelo `inbox.service.ts:325` (já tem emit lá).
3. Validar se `actionTaken: 'updated_existing'` no front.

### Cenário D — sair e voltar
1. Em `/whatsapp`, ver lista.
2. Ir pra `/dashboard`.
3. Da máquina B, mandar mensagem.
4. Voltar pra `/whatsapp`.
5. **Expectativa**: lista deveria refetchar no mount. Validar se há `[FE_INBOX_RENDER_TOP]` com timestamp recente.

### Cenário E — F5
1. Após cenário D, dar F5.
2. Comparar a lista pós-F5 com pré-F5: se F5 corrige, há divergência entre cache e backend.

---

## Fase 4 — Testes read-only do servidor (PRA VOCÊ EXECUTAR)

Eu não tenho SSH direto. Preciso que **você rode estes comandos no servidor Easypanel** e cole a saída:

```bash
# 1. Listar containers
docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}" | grep -E "(crm|evolution|traefik|21go)"

# 2. Quantas réplicas do backend
docker ps --filter "name=crm-21go" --format "{{.Names}}"

# 3. Logs do backend (últimas 200 linhas, procurar pelos novos tags)
docker logs --tail=200 NOME_DO_CONTAINER_CRM 2>&1 | grep -E "(WA_WEBHOOK|WA_MESSAGE|INBOX_SOCKET|SOCKET_CONNECTED|SOCKET_JOIN)"

# 4. Logs Evolution
docker logs --tail=200 NOME_DO_CONTAINER_EVOLUTION 2>&1 | tail -50

# 5. Logs Traefik (se tiver acesso)
docker logs --tail=200 traefik 2>&1 | grep -iE "(websocket|upgrade|socket.io|crm21go)"
```

### No browser (você executa)

DevTools → Network → filter "socket.io":
- Anote o transport: aparece `?EIO=4&transport=polling` ou `?EIO=4&transport=websocket`?
- Existe alguma resposta 101 (Switching Protocols)? Se não, WS upgrade falhou.
- Existe 400 com `{"code":1,"message":"Session ID unknown"}` no payload? Se sim → sticky session faltando.
- Tempo médio das requisições GET /socket.io: 25s (long-polling normal) ou < 1s (sem long-polling, perdendo eventos)?

---

## Fase 5 — Matriz de decisão (PRA PREENCHER APÓS FASES 2-4)

| Hipótese | Evidência necessária | Status |
|---|---|---|
| 1. Evolution não entrega | ausência `WA_WEBHOOK_RECEIVED` | ❌ refutada |
| 2. Webhook rejeitado | `WA_WEBHOOK_REJECTED` | ❌ refutada |
| 3. Backend não persiste | sem `WA_MESSAGE_PERSIST_DONE` | ❌ refutada |
| 4. Backend não emite | sem `INBOX_SOCKET_EMIT_ATTEMPT` ou `socketServerInitialized=false` | pendente |
| 5. Emit pra room vazia | `clientsInCompanyRoom=0` enquanto user está logado | pendente |
| 6. Socket perde evento | emit OK + clientes > 0, mas sem `FE_SOCKET_EVENT` | pendente |
| 7. Cache ignora conversa nova | `FE_SOCKET_EVENT` + `actionTaken: ignored_missing_conversation` | pendente |
| 8. Render não reflete cache | `updated/prepended` + `FE_INBOX_RENDER_TOP` não muda | pendente |
| 9. REST lento | duração alta no log + F5 lento | pendente |

---

## Fase 6 — Correção condicionada (NÃO IMPLEMENTAR AGORA)

Cada fix abaixo só será aplicado se a evidência da Fase 5 apontar pra hipótese correspondente. Listo aqui pra você decidir.

### Se Hipótese 7 confirmada (cache ignora nova)
**Fix mínimo:** ampliar o payload do socket emitido pelo backend pra carregar o objeto `conversation` completo (igual ao retornado pelo REST). Frontend trata `idx === -1` fazendo prepend imutável e dedup.

### Se Hipótese 6 confirmada (socket perde evento)
**Fix mínimo:** habilitar `connectionStateRecovery` no `SocketIOServer` (Socket.IO 4.6+). Adicionar reconciliação via REST ao reconectar.

### Se Hipótese 4/5 confirmada (backend não emite ou room vazia)
**Fix mínimo:** investigar `socketService.getIO()` no momento do emit. Pode ser que o handler do webhook estoure exception ANTES do emit e o `try/catch` engula. Adicionar logs + asserção.

### Se Hipótese 9 confirmada (REST pesada)
**Fix mínimo:** paginação cursor-based por `(lastMessageAt DESC, id DESC)` na rota `/api/conversations`. Frontend usa `useInfiniteQuery`. Socket sempre atualiza apenas a primeira página.

---

## Fase 7 — Relatório final (PRA PREENCHER APÓS FASES 2-5)

A entregar depois da reprodução controlada. Já tenho:

| Item | Status |
|---|---|
| 1. Linha do tempo de uma mensagem | parcial: server-side confirmado, falta tracejar frontend |
| 2. Evidência da causa-raiz (logs correlacionados) | pendente (precisa Fase 2 aplicada) |
| 3. Causa principal | a definir |
| 4. Causas secundárias | provavelmente: falta paginação + payload socket enxuto + polling-only sem confirmação atual de WS bloqueado |
| 5. Correção proposta | a definir |
| 6. Risco | a definir |
| 7. Rollback | a definir |
| 8. Testes de aceite | listados na proposta original do GPT |

---

## Próximo passo — **decisão tua**

Pra continuar, preciso de:

1. **Autorização pra aplicar Patches 2.1–2.6** (logs temporários, marcados com tags `[WA_*]`/`[FE_*]` pra facilitar `grep` e remoção depois).
2. **Acesso aos logs do servidor** (você cola a saída dos `docker ps` / `docker logs` da Fase 4) **OU** me dá o nome do container e eu te mando comando exato.
3. **Disponibilidade pra reprodução controlada** (Fase 3, ~10 minutos) com você na frente do browser + celular pra mandar mensagem de número novo + telefone alternativo pro Cenário B.

Sem 1 e 3, eu fico cego no que acontece no front no momento da entrega do evento. Quer que eu aplique os patches?
