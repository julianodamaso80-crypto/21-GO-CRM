import { FastifyRequest, FastifyReply } from 'fastify'
import { InboxService, ListConversationsQuery, SendMessageDTO } from './inbox.service'

const inboxService = new InboxService()

export class InboxController {
  /**
   * GET /inbox
   * Lista conversas com filtros opcionais
   */
  async listConversations(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId

    const query = request.query as any
    const filters: ListConversationsQuery = {
      status: query.status,
      channelType: query.channelType,
      scope: query.scope,
      userId: user.id,
      userRole: user.role,
    }

    const result = await inboxService.listConversations(companyId, filters)

    return reply.send(result)
  }

  /**
   * GET /inbox/:id
   * Busca conversa por ID
   */
  async getConversation(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const conversation = await inboxService.getConversationById(id, companyId)

    return reply.send(conversation)
  }

  /**
   * GET /inbox/:id/messages
   * Lista mensagens de uma conversa
   */
  async getMessages(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const messages = await inboxService.getConversationMessages(id, companyId)

    return reply.send(messages)
  }

  /**
   * POST /inbox/:id/messages
   * Envia uma mensagem em uma conversa
   */
  async sendMessage(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const userId = user.id
    const { id } = request.params as { id: string }
    const data = request.body as SendMessageDTO

    const message = await inboxService.sendMessage(id, companyId, userId, data)

    return reply.status(201).send(message)
  }

  /**
   * PATCH /inbox/:id/status
   * Atualiza o status de uma conversa
   */
  async updateStatus(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }
    const { status } = request.body as { status: string }

    const conversation = await inboxService.updateConversationStatus(id, companyId, status)

    return reply.send(conversation)
  }

  /**
   * POST /inbox/:id/convert-to-lead
   * Cria card no Kanban a partir da conversa
   */
  async convertToLead(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const { id } = request.params as { id: string }
    const body = request.body as { funilType: 'consultor' | 'associado'; title?: string }

    const card = await inboxService.convertToLead(id, user.companyId, user.id, body.funilType, body.title)
    return reply.status(201).send(card)
  }

  /**
   * PATCH /inbox/:id/read
   * Marca conversa como lida
   */
  async markAsRead(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const result = await inboxService.markAsRead(id, companyId)

    return reply.send(result)
  }
}
