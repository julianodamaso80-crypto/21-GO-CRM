import { api } from '../lib/api'
import type {
  Pipe,
  PipeDetail,
  Phase,
  FieldDefinition,
  Card,
  CardDetail,
  CreatePipeRequest,
  CreatePipeFromSuggestRequest,
  CreatePhaseRequest,
  CreateFieldDefinitionRequest,
  CreateCardRequest,
  MoveCardRequest,
  UpdateCardFieldsRequest,
  CardAttachment,
  KanbanData,
} from '../../../shared/types'

export interface ListCardsParams {
  phaseId?: string
  q?: string
  page?: number
  pageSize?: number
  status?: string
}

export const pipesService = {
  // === Pipes ===

  async list(): Promise<Pipe[]> {
    const response = await api.get<Pipe[]>('/pipes')
    return response.data
  },

  async getById(pipeId: string): Promise<PipeDetail> {
    const response = await api.get<PipeDetail>(`/pipes/${pipeId}`)
    return response.data
  },

  async create(data: CreatePipeRequest): Promise<Pipe> {
    const response = await api.post<Pipe>('/pipes', data)
    return response.data
  },

  async createFromSuggest(data: CreatePipeFromSuggestRequest): Promise<PipeDetail> {
    const response = await api.post<PipeDetail>('/pipes/from-suggest', data)
    return response.data
  },

  async delete(pipeId: string): Promise<{ success: boolean }> {
    const response = await api.delete(`/pipes/${pipeId}`)
    return response.data
  },

  // === Phases ===

  async createPhase(pipeId: string, data: CreatePhaseRequest): Promise<Phase> {
    const response = await api.post<Phase>(`/pipes/${pipeId}/phases`, data)
    return response.data
  },

  async updatePhase(phaseId: string, data: Partial<{ name: string; color: string; probability: number; isWon: boolean; isLost: boolean }>): Promise<Phase> {
    const response = await api.patch<Phase>(`/pipes/phases/${phaseId}`, data)
    return response.data
  },

  async deletePhase(phaseId: string): Promise<void> {
    await api.delete(`/pipes/phases/${phaseId}`)
  },

  async reorderPhases(pipeId: string, phaseIds: string[]): Promise<void> {
    await api.patch(`/pipes/${pipeId}/phases`, { phaseIds })
  },

  // === Fields ===

  async createField(pipeId: string, data: CreateFieldDefinitionRequest): Promise<FieldDefinition> {
    const response = await api.post<FieldDefinition>(`/pipes/${pipeId}/fields`, data)
    return response.data
  },

  // === Cards ===

  async listCards(pipeId: string, params: ListCardsParams = {}): Promise<{ data: Card[]; pagination: any }> {
    const response = await api.get(`/pipes/${pipeId}/cards`, { params })
    return response.data
  },

  async getKanban(pipeId: string): Promise<KanbanData> {
    const response = await api.get<KanbanData>(`/pipes/${pipeId}/kanban`)
    return response.data
  },

  async getCard(cardId: string): Promise<CardDetail> {
    const response = await api.get<CardDetail>(`/pipes/cards/${cardId}`)
    return response.data
  },

  async createCard(pipeId: string, data: CreateCardRequest): Promise<Card> {
    const response = await api.post<Card>(`/pipes/${pipeId}/cards`, data)
    return response.data
  },

  async moveCard(cardId: string, data: MoveCardRequest & { pipeId?: string }): Promise<Card> {
    const pipeId = (data as any).pipeId
    if (!pipeId) throw new Error('moveCard requires pipeId')
    const response = await api.patch<Card>(`/pipes/${pipeId}/cards`, { cardId, phaseId: data.phaseId })
    return response.data
  },

  async updateCardFields(cardId: string, data: UpdateCardFieldsRequest): Promise<{ success: boolean }> {
    const response = await api.patch(`/pipes/cards/${cardId}/fields`, data)
    return response.data
  },

  async addAttachment(cardId: string, data: { fileName: string; storageUrl: string; mimeType?: string; size?: number }): Promise<CardAttachment> {
    const response = await api.post<CardAttachment>(`/pipes/cards/${cardId}/attachments`, data)
    return response.data
  },
}
