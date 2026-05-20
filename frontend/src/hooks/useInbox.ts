import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inboxService } from '../services/inbox.service'
import { useSocketEvent } from './useSocketEvent'

/**
 * Inbox hooks — atualização em tempo real via Socket.IO usando `setQueryData`
 * em vez de `invalidateQueries`. Isso evita refetch da lista de ~2.000 conversas
 * a cada mensagem nova (que estourava o rate-limit do backend e travava a UI).
 *
 * Heartbeat de 60s é mantido só como rede de segurança caso o socket caia
 * silenciosamente — não é o caminho principal de atualização.
 */

// 15s: rede de seguranca curta. Se o socket cair (proxy/CDN dropa upgrade WS,
// token expira, aba inativa), a UI ainda recebe mensagens novas em <=15s
// via refetch HTTP. Custo: 4 reqs/min por aba aberta — barato.
const HEARTBEAT_MS = 1000 * 15

type ConvListItem = any  // formato do inboxService.listConversations()

function moveToFrontAndUpdate(
  list: ConvListItem[] | undefined,
  conversationId: string,
  patch: Partial<ConvListItem>,
): ConvListItem[] | undefined {
  if (!list) return list
  const idx = list.findIndex((c) => c.id === conversationId)
  if (idx === -1) return list  // conversa não está na lista atual — ignora
  const updated = { ...list[idx], ...patch }
  const next = list.slice()
  next.splice(idx, 1)
  next.unshift(updated)
  return next
}

export function useConversations(
  params: { status?: string; channelType?: string; search?: string } = {},
) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['conversations', params],
    queryFn: () => inboxService.listConversations(params),
    staleTime: 1000 * 30,
    refetchInterval: HEARTBEAT_MS,
  })

  useSocketEvent('inbox:new_message', (payload: any) => {
    const conversationId = payload?.conversationId
    const message = payload?.message
    if (!conversationId || !message) return
    // Inbound = cliente mandou → conta como não lida.
    // Outbound = nós mandamos → não conta (e o backend zera o unread no sendMessage).
    const isInbound = message.direction === 'inbound'
    const newConversation = payload?.conversation // shape do GET /api/conversations

    // Rastreia decisão pra log (após setQueriesData rodar em todos os caches).
    // Wrapper em objeto evita narrowing agressivo do TS pra valor inicial.
    type CacheAction =
      | 'updated_existing'
      | 'prepended_new_conversation'
      | 'fallback_invalidated'
      | 'no_cache'
    const state: { action: CacheAction; foundIndex: number; cacheLength: number } = {
      action: 'no_cache',
      foundIndex: -1,
      cacheLength: 0,
    }

    qc.setQueriesData({ queryKey: ['conversations'] }, (old: ConvListItem[] | undefined) => {
      if (!old) {
        state.action = 'no_cache'
        return old
      }
      state.cacheLength = old.length
      const idx = old.findIndex((c) => c.id === conversationId)
      state.foundIndex = idx

      // CASE 1 — conversa já está no cache: atualiza imutável + move pro topo
      if (idx !== -1) {
        const current = old[idx]
        const nextUnread = isInbound ? (current.unreadCount ?? 0) + 1 : 0
        state.action = 'updated_existing'
        return moveToFrontAndUpdate(old, conversationId, {
          lastMessage: message,
          lastMessagePreview: message.content,
          lastMessageAt: message.createdAt,
          unreadCount: nextUnread,
        })
      }

      // CASE 2 — conversa NOVA e o backend mandou o objeto completo: prepend
      if (newConversation && newConversation.id === conversationId) {
        state.action = 'prepended_new_conversation'
        const prepended: ConvListItem = {
          ...newConversation,
          lastMessage: message,
          lastMessagePreview: message.content,
          lastMessageAt: message.createdAt,
          // Garante unread coerente: inbound = 1, outbound = 0
          unreadCount: isInbound ? Math.max(1, newConversation.unreadCount ?? 0) : 0,
        }
        // Dedup defensivo (não deveria ter, mas garante)
        const filtered = old.filter((c) => c.id !== conversationId)
        return [prepended, ...filtered]
      }

      // CASE 3 — conversa nova MAS backend não mandou objeto: fallback via refetch
      // Marca aqui; o invalidate é disparado fora do updater (não pode ter side-effect aqui).
      state.action = 'fallback_invalidated'
      return old
    })

    // [TRACE-WA] Prova de decisao do cache
    console.log('[INBOX_CACHE_DECISION_PROOF]', {
      tag: 'INBOX_CACHE_DECISION_PROOF',
      timestamp: new Date().toISOString(),
      correlationId: payload?.__correlationId,
      conversationId,
      messageId: message?.id,
      cacheLength: state.cacheLength,
      foundIndex: state.foundIndex,
      action: state.action,
    })

    // Side-effect fora do updater
    if (state.action === 'fallback_invalidated') {
      qc.invalidateQueries({ queryKey: ['conversations'] })
    }
  })
  useSocketEvent('conversation:updated', (payload: any) => {
    const conversationId = payload?.conversationId
    if (!conversationId) return
    qc.setQueriesData({ queryKey: ['conversations'] }, (old: ConvListItem[] | undefined) => {
      if (!old) return old
      return old.map((c) =>
        c.id === conversationId ? { ...c, status: payload?.status ?? c.status } : c,
      )
    })
  })
  useSocketEvent('conversation:assigned', (payload: any) => {
    const conversationId = payload?.conversationId
    if (!conversationId) return
    qc.setQueriesData({ queryKey: ['conversations'] }, (old: ConvListItem[] | undefined) => {
      if (!old) return old
      return old.map((c) =>
        c.id === conversationId
          ? { ...c, assignedToId: payload?.assignedToId ?? c.assignedToId, status: 'assigned' }
          : c,
      )
    })
  })

  return query
}

export function useMessages(conversationId: string) {
  const qc = useQueryClient()

  const query = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => inboxService.getMessages(conversationId),
    enabled: !!conversationId,
    staleTime: 1000 * 10,
    refetchInterval: HEARTBEAT_MS,
  })

  useSocketEvent('inbox:new_message', (payload: any) => {
    if (payload?.conversationId !== conversationId) return
    const message = payload?.message
    if (!message?.id) return
    qc.setQueryData<any[]>(['messages', conversationId], (old) => {
      if (!old) return old
      // Dedup: socket pode chegar antes ou depois do response do POST de envio.
      if (old.some((m) => m.id === message.id || (m.whatsappMessageId && m.whatsappMessageId === message.whatsappMessageId))) {
        return old
      }
      return [...old, message]
    })
  })

  return query
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      inboxService.sendMessage(conversationId, content),
    onSuccess: (data: any, variables) => {
      // Insere a mensagem retornada no cache local em vez de refetch.
      if (data?.id) {
        queryClient.setQueryData<any[]>(['messages', variables.conversationId], (old) => {
          if (!old) return old
          if (old.some((m) => m.id === data.id)) return old
          return [...old, data]
        })
      }
      // Move a conversa pro topo da lista usando os campos da mensagem nova.
      queryClient.setQueriesData({ queryKey: ['conversations'] }, (old: ConvListItem[] | undefined) =>
        moveToFrontAndUpdate(old, variables.conversationId, {
          lastMessage: data,
          lastMessagePreview: data?.content ?? variables.content,
          lastMessageAt: data?.createdAt ?? new Date().toISOString(),
        }),
      )
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.message || e?.message || 'Erro ao enviar mensagem'
      toast.error(msg)
    },
  })
}

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, status }: { conversationId: string; status: string }) =>
      inboxService.updateStatus(conversationId, status),
    onSuccess: (_, variables) => {
      queryClient.setQueriesData(
        { queryKey: ['conversations'] },
        (old: ConvListItem[] | undefined) => {
          if (!old) return old
          return old.map((c) =>
            c.id === variables.conversationId ? { ...c, status: variables.status } : c,
          )
        },
      )
      toast.success('Status atualizado!')
    },
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => inboxService.markAsRead(conversationId),
    onSuccess: (_, conversationId) => {
      queryClient.setQueriesData(
        { queryKey: ['conversations'] },
        (old: ConvListItem[] | undefined) => {
          if (!old) return old
          return old.map((c) => (c.id === conversationId ? { ...c, unreadCount: 0 } : c))
        },
      )
    },
  })
}
