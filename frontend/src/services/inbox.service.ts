import { api } from '../lib/api'
import type { Conversation, Message } from '../../../shared/types'

export const inboxService = {
  async listConversations(
    params: { status?: string; channelType?: string; search?: string } = {},
  ): Promise<Conversation[]> {
    const response = await api.get<Conversation[]>('/conversations', { params })
    return response.data
  },

  async getConversation(id: string): Promise<Conversation> {
    const response = await api.get<Conversation>(`/conversations/${id}`)
    return response.data
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    const response = await api.get<Message[]>(`/conversations/${conversationId}/messages`)
    return response.data
  },

  async sendMessage(conversationId: string, content: string, contentType = 'text'): Promise<Message> {
    const response = await api.post<Message>(`/conversations/${conversationId}/messages`, { content, contentType })
    return response.data
  },

  async updateStatus(conversationId: string, status: string): Promise<Conversation> {
    const response = await api.patch<Conversation>(`/conversations/${conversationId}/status`, { status })
    return response.data
  },

  async markAsRead(conversationId: string): Promise<void> {
    await api.patch(`/conversations/${conversationId}/read`)
  },
}
