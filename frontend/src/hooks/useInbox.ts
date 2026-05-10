import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inboxService } from '../services/inbox.service'
import { useSocketEvent } from './useSocketEvent'

/**
 * Inbox hooks — Projeto Japão Fase 5.
 *
 * Polling 15-30s removido. Atualização agora vem via Socket.io:
 *  - `inbox:new_message` — dispara invalidação de conversations + messages
 *  - `conversation:updated` — invalida conversations
 *  - `conversation:assigned` — invalida conversations
 *
 * Mantemos `refetchInterval: 60s` como heartbeat de resiliência (caso o socket
 * caia sem o cliente perceber). É 4x menos custoso que o polling antigo.
 */

const HEARTBEAT_MS = 1000 * 60 // 60s

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

  useSocketEvent('inbox:new_message', () => {
    qc.invalidateQueries({ queryKey: ['conversations'] })
  })
  useSocketEvent('conversation:updated', () => {
    qc.invalidateQueries({ queryKey: ['conversations'] })
  })
  useSocketEvent('conversation:assigned', () => {
    qc.invalidateQueries({ queryKey: ['conversations'] })
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

  // Invalidação granular: só refaz quando a mensagem é DESTA conversa.
  useSocketEvent('inbox:new_message', (payload: any) => {
    if (payload?.conversationId === conversationId) {
      qc.invalidateQueries({ queryKey: ['messages', conversationId] })
    }
  })

  return query
}

export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, content }: { conversationId: string; content: string }) =>
      inboxService.sendMessage(conversationId, content),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['messages', variables.conversationId] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      toast.success('Status atualizado!')
    },
  })
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (conversationId: string) => inboxService.markAsRead(conversationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
