import { FastifyRequest, FastifyReply } from 'fastify'
import { LeadsService, CreateLeadDTO, UpdateLeadDTO, ListLeadsQuery } from './leads.service'

const leadsService = new LeadsService()

export class LeadsController {
  /**
   * GET /leads
   * Lista leads com paginação e filtros
   */
  async list(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId

    const query = request.query as any
    const filters: ListLeadsQuery = {
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      search: query.search,
      status: query.status,
      source: query.source,
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    }

    const result = await leadsService.listLeads(companyId, filters, user)

    return reply.send(result)
  }

  /**
   * GET /leads/:id
   * Busca lead por ID
   */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const lead = await leadsService.getLeadById(id, companyId, user)

    return reply.send(lead)
  }

  /**
   * POST /leads
   * Cria novo lead
   */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const data = request.body as CreateLeadDTO

    const lead = await leadsService.createLead(companyId, data)

    return reply.status(201).send(lead)
  }

  /**
   * PUT /leads/:id
   * Atualiza lead existente
   */
  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }
    const data = request.body as UpdateLeadDTO

    const lead = await leadsService.updateLead(id, companyId, data)

    return reply.send(lead)
  }

  /**
   * DELETE /leads/:id
   * Deleta lead
   */
  async delete(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const { id } = request.params as { id: string }

    const result = await leadsService.deleteLead(id, companyId)

    return reply.send(result)
  }

  /**
   * GET /leads/stats
   * Estatísticas de leads
   */
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId

    const stats = await leadsService.getStats(companyId, user)

    return reply.send(stats)
  }
}
