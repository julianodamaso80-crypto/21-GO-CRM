import { FastifyRequest, FastifyReply } from 'fastify'
import { AnalyticsService, AnalyticsFilters } from './analytics.service'

const analyticsService = new AnalyticsService()

export class AnalyticsController {
  /**
   * Helper: extrai filtros da query string
   */
  private extractFilters(request: FastifyRequest): AnalyticsFilters {
    const query = request.query as any
    return {
      startDate: query.startDate,
      endDate: query.endDate,
      source: query.source,
      campaign: query.campaign,
      platform: query.platform,
      pipelineId: query.pipelineId,
      groupBy: query.groupBy,
      metric: query.metric,
      granularity: query.granularity,
      sortBy: query.sortBy,
    }
  }

  /**
   * GET /analytics/overview
   * Visao geral de metricas principais
   */
  async getOverview(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const overview = await analyticsService.getOverview(companyId, filters)

    return reply.send(overview)
  }

  /**
   * GET /analytics/sources
   * Analise por fonte de origem
   */
  async getSources(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const sources = await analyticsService.getSources(companyId, filters)

    return reply.send(sources)
  }

  /**
   * GET /analytics/by-state
   * Distribuição de leads por estado (extraído do DDD do telefone)
   */
  async getByState(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const byState = await analyticsService.getLeadsByState(companyId, filters)

    return reply.send(byState)
  }

  /**
   * GET /analytics/by-vehicle-type
   * Distribuição de leads por tipo de veículo (carro/moto) inferido da marca/modelo
   */
  async getByVehicleType(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const byType = await analyticsService.getLeadsByVehicleType(companyId, filters)

    return reply.send(byType)
  }

  /**
   * GET /analytics/campaigns
   * Analise por campanha
   */
  async getCampaigns(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const campaigns = await analyticsService.getCampaigns(companyId, filters)

    return reply.send(campaigns)
  }

  /**
   * GET /analytics/funnel
   * Funil de conversao
   */
  async getFunnel(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const funnel = await analyticsService.getFunnel(companyId, filters)

    return reply.send(funnel)
  }

  /**
   * GET /analytics/ltv
   * Lifetime Value
   */
  async getLTV(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const ltv = await analyticsService.getLTV(companyId, filters)

    return reply.send(ltv)
  }

  /**
   * GET /analytics/roi
   * Return on Investment
   */
  async getROI(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const roi = await analyticsService.getROI(companyId, filters)

    return reply.send(roi)
  }

  /**
   * GET /analytics/trends
   * Series temporais
   */
  async getTrends(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const filters = this.extractFilters(request)

    const trends = await analyticsService.getTrends(companyId, filters)

    return reply.send(trends)
  }
}
