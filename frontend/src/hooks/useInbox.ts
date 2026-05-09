import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { inboxService } from '../services/inbox.service'

export function useConversations(params: { status?: string; channelType?: string } = {}) {
  return useQuery({
    queryKey: ['conversations', params],
    queryFn: () => inboxService.listConversations(params),
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  })
}

export function useMessages(conversationId: string) {
  return useQuery({
    queryKey: ['messages', conversationId],
    queryFn: () => inboxService.getMessages(conversationId),
    enabled: !!conversationId,
    staleTime: 1000 * 10,
    refetchInterval: 1000 * 15,
  })
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
