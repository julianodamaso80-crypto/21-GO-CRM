import { FastifyRequest, FastifyReply } from 'fastify'
import { WebhooksService, CreateWebhookDTO, UpdateWebhookDTO } from './webhooks.service'

const webhooksService = new WebhooksService()

export class WebhooksController {
  /**
   * GET /webhooks
   * Lista webhooks da empresa
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId

    const result = await webhooksService.listWebhooks(companyId)

    return reply.send(result)
  }

  /**
   * GET /webhooks/:id
   * Busca webhook por ID
   */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const webhook = await webhooksService.getWebhookById(id, companyId)

    return reply.send(webhook)
  }

  /**
   * POST /webhooks
   * Cria novo webhook
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const data = request.body as CreateWebhookDTO

    const webhook = await webhooksService.createWebhook(companyId, data)

    return reply.status(201).send(webhook)
  }

  /**
   * PUT /webhooks/:id
   * Atualiza webhook existente
   */
  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }
    const data = request.body as UpdateWebhookDTO

    const webhook = await webhooksService.updateWebhook(id, companyId, data)

    return reply.send(webhook)
  }

  /**
   * DELETE /webhooks/:id
   * Deleta webhook
   */
  async delete(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const result = await webhooksService.deleteWebhook(id, companyId)

    return reply.send(result)
  }

  /**
   * GET /webhooks/events
   * Lista eventos disponíveis
   */
  async getEvents(_request: FastifyRequest, reply: FastifyReply) {
    const events = webhooksService.getEvents()

    return reply.send(events)
  }
}
