import { FastifyRequest, FastifyReply } from 'fastify'
import { AssociadosService, CreateAssociadoDTO, UpdateAssociadoDTO, ListAssociadosQuery } from './associados.service'

const associadosService = new AssociadosService()

export class AssociadosController {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId

    const query = request.query as any
    const filters: ListAssociadosQuery = {
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      search: query.search,
      tags: query.tags ? (Array.isArray(query.tags) ? query.tags : [query.tags]) : undefined,
      status: query.status,
      origem: query.origem,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    }

    const result = await associadosService.listAssociados(companyId, filters, user)
    return reply.send(result)
  }

  async getById(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const associado = await associadosService.getAssociadoById(id, companyId, user)
    return reply.send(associado)
  }

  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const data = request.body as CreateAssociadoDTO

    const associado = await associadosService.createAssociado(companyId, data)
    return reply.status(201).send(associado)
  }

  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }
    const data = request.body as UpdateAssociadoDTO

    const associado = await associadosService.updateAssociado(id, companyId, data)
    return reply.send(associado)
  }

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const result = await associadosService.deleteAssociado(id, companyId)
    return reply.send(result)
  }

  async getTags(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId

    const tags = await associadosService.getUniqueTags(companyId)
    return reply.send({ tags })
  }

  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId

    const stats = await associadosService.getStats(companyId, user)
    return reply.send(stats)
  }
}
