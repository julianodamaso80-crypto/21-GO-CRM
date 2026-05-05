import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { pipesService, type ListCardsParams } from '../services/pipes.service'
import type {
  CreatePipeRequest,
  CreatePipeFromSuggestRequest,
  CreateCardRequest,
  MoveCardRequest,
  UpdateCardFieldsRequest,
  CreatePhaseRequest,
  CreateFieldDefinitionRequest,
} from '../../../shared/types'

// === Pipes ===

export function usePipes() {
  return useQuery({
    queryKey: ['pipes'],
    queryFn: () => pipesService.list(),
    staleTime: 1000 * 60 * 5,
  })
}

export function usePipe(pipeId: string) {
  return useQuery({
    queryKey: ['pipes', pipeId],
    queryFn: () => pipesService.getById(pipeId),
    enabled: !!pipeId,
  })
}

export function useCreatePipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePipeRequest) => pipesService.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes'] })
      toast.success('Pipe criado com sucesso!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar pipe')
    },
  })
}

export function useCreatePipeFromSuggest() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePipeFromSuggestRequest) => pipesService.createFromSuggest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes'] })
      toast.success('Pipe criado com IA!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar pipe')
    },
  })
}

export function useDeletePipe() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (pipeId: string) => pipesService.delete(pipeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes'] })
      toast.success('Pipe arquivado!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao deletar pipe')
    },
  })
}

// === Phases & Fields ===

export function useCreatePhase(pipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePhaseRequest) => pipesService.createPhase(pipeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes', pipeId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipeId] })
      toast.success('Fase criada!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar fase')
    },
  })
}

export function useUpdatePhase(pipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ phaseId, data }: { phaseId: string; data: Partial<{ name: string; color: string; probability: number; isWon: boolean; isLost: boolean }> }) =>
      pipesService.updatePhase(phaseId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes', pipeId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipeId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar fase')
    },
  })
}

export function useDeletePhase(pipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (phaseId: string) => pipesService.deletePhase(phaseId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes', pipeId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipeId] })
      toast.success('Fase removida!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao remover fase')
    },
  })
}

export function useReorderPhases(pipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (phaseIds: string[]) => pipesService.reorderPhases(pipeId, phaseIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes', pipeId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', pipeId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao reordenar fases')
    },
  })
}

export function useCreateFieldDefinition(pipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateFieldDefinitionRequest) => pipesService.createField(pipeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pipes', pipeId] })
      toast.success('Campo criado!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar campo')
    },
  })
}

// === Cards ===

export function useCards(pipeId: string, params: ListCardsParams = {}) {
  return useQuery({
    queryKey: ['cards', pipeId, params],
    queryFn: () => pipesService.listCards(pipeId, params),
    enabled: !!pipeId,
    staleTime: 1000 * 60 * 2,
  })
}

export function useKanban(pipeId: string) {
  return useQuery({
    queryKey: ['kanban', pipeId],
    queryFn: () => pipesService.getKanban(pipeId),
    enabled: !!pipeId,
    staleTime: 1000 * 30,
  })
}

export function useCard(cardId: string) {
  return useQuery({
    queryKey: ['cards', 'detail', cardId],
    queryFn: () => pipesService.getCard(cardId),
    enabled: !!cardId,
  })
}

export function useCreateCard(pipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCardRequest) => pipesService.createCard(pipeId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban', pipeId] })
      queryClient.invalidateQueries({ queryKey: ['cards', pipeId] })
      toast.success('Card criado!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao criar card')
    },
  })
}

export function useMoveCard(pipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: MoveCardRequest }) =>
      pipesService.moveCard(cardId, { ...data, pipeId } as any),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban', pipeId] })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao mover card')
    },
  })
}

export function useTransferCard(currentPipeId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, targetPipeId, targetPhaseId }: { cardId: string; targetPipeId: string; targetPhaseId?: string }) =>
      pipesService.transferCard(cardId, targetPipeId, targetPhaseId),
    onSuccess: (_, vars) => {
      // Invalida ambos os kanbans (origem e destino)
      queryClient.invalidateQueries({ queryKey: ['kanban', currentPipeId] })
      queryClient.invalidateQueries({ queryKey: ['kanban', vars.targetPipeId] })
      queryClient.invalidateQueries({ queryKey: ['pipes'] })
      toast.success('Card transferido!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao transferir card')
    },
  })
}

export function useUpdateCardFields() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ cardId, data }: { cardId: string; data: UpdateCardFieldsRequest }) =>
      pipesService.updateCardFields(cardId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['cards', 'detail', variables.cardId] })
      toast.success('Campos atualizados!')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Erro ao atualizar campos')
    },
  })
}
