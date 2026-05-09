# Fase 5 — Mapa de Polling → Socket.io

## Pontos de polling identificados

| Arquivo | Hook | Polling antes | Status |
|---|---|---|---|
| [useInbox.ts](frontend/src/hooks/useInbox.ts) | `useConversations` | **30s** | ✅ Migrado pra socket + heartbeat 60s |
| [useInbox.ts](frontend/src/hooks/useInbox.ts) | `useMessages` | **15s** | ✅ Migrado pra socket + heartbeat 60s, granular por conversationId |
| [useDashboard.ts](frontend/src/hooks/useDashboard.ts) | `useDashboard` | 5min | ⏸ Mantido — KPIs de baixa frequência, polling longo é apropriado |
| [useWhatsapp.ts](frontend/src/hooks/useWhatsapp.ts) | `useWhatsappStatus` | 3s (durante QR) | ⏸ Mantido — só roda enquanto não conectou, evento socket pra QR não existe |

## Eventos backend → frontend

| Evento | Disparado quando | Ouvido por |
|---|---|---|
| `inbox:new_message` | Webhook recebe msg WhatsApp ([webhook-evolution.service.ts:298](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L298)) + envio próprio ([inbox.service.ts:247](backend/src/modules/inbox/inbox.service.ts#L247)) | `useConversations`, `useMessages` (filtro por conversationId) |
| `conversation:updated` | `updateConversationStatus` em inbox.service.ts | `useConversations` |
| `conversation:assigned` | `assignConversation` em inbox.service.ts (broadcast pra company + targeted user) | `useConversations` |
| `inbox:typing` | Já existia | typing indicator |
| `inbox:message_read` | Já existia | leitura |

## Cross-tenant guard adicionado

[socket.service.ts:handleJoinRoom](backend/src/websocket/socket.service.ts#L151):

- Rooms `company:*`, `inbox:*`, `dashboard:*`, `appointments:*` → só permite join se sufixo bate com `socket.data.companyId`
- Rooms `user:*` → só permite join se bate com `socket.data.userId`
- Tentativas cross-tenant logam warning `[JAPAO][socket]` e retornam erro no callback

## Fallback / heartbeat

`refetchInterval: 60s` mantido em `useConversations` e `useMessages`. **Não é polling agressivo, é rede de segurança**:

- Cobre o caso do socket cair sem o cliente notar (cenário raro mas existe)
- 4× menos requests que o polling antigo (60s vs 15s)
- Em prod pode ser monitorado via Network tab — se o socket está saudável, requests dessa query são imperceptíveis (response cacheado)

## Optimistic update preservado

`useSendMessage` mantém `onSuccess` invalidando cache. A mensagem que vem de volta pelo `inbox:new_message` (broadcast) é deduplicada pelo banco via `whatsappMessageId @unique` — nada duplica na UI.

## Como testar manualmente

1. Logar como **Leticya** (vendedor) em 2 abas (chrome regular + anônima ou 2 perfis)
2. No celular, mandar mensagem pro número conectado à instância `21gosite`
3. **Em <2s nas 2 abas:** conversa sobe pro topo da lista
4. Clicar na conversa em uma das abas → mensagens carregam (sem "Nenhuma mensagem")
5. Responder pelo CRM → optimistic update aparece imediato
6. Confirmar no celular: mensagem chegou
7. Voltar à UI: a mensagem NÃO duplica (dedupe via `whatsappMessageId`)

## Validação backend

```bash
# Build limpo:
cd backend && npm run build
# ⚡️ Build success
```

## Mudanças desta fase

- `frontend/src/hooks/useInbox.ts` — polling 15-30s removido, socket + heartbeat 60s
- `backend/src/websocket/socket.service.ts` — cross-tenant guard em `handleJoinRoom`
- `backend/src/modules/inbox/inbox.service.ts` — emit `conversation:updated` no status change + `conversation:assigned` no assign
- `backend/src/websocket/socket.types.ts` — 2 eventos novos tipados (`conversation:updated`, `conversation:assigned`)

## Rollback

```bash
git revert <commit-fase-5>
git push origin main
```

Comportamento de fallback: volta ao polling de 15-30s. UX volta ao estado anterior, sem regressão funcional.
