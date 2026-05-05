import { FastifyRequest, FastifyReply } from 'fastify'
import { WhatsappService } from './whatsapp.service'

const service = new WhatsappService()

export class WhatsappController {
  async getMine(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const data = await service.getMine(user.id, user.companyId)
    return reply.send(data)
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const body = request.body as { name?: string }
    const data = await service.create(user.id, user.companyId, body?.name || 'Meu WhatsApp')
    return reply.status(201).send(data)
  }

  async status(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const data = await service.status(user.id, user.companyId)
    return reply.send(data)
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    await service.delete(user.id, user.companyId)
    return reply.status(204).send()
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const data = await service.logout(user.id, user.companyId)
    return reply.send(data)
  }
}
