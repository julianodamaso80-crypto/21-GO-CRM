import { FastifyRequest, FastifyReply } from 'fastify'
import { DashboardService, DashboardPeriod } from './dashboard.service'

const dashboardService = new DashboardService()

const VALID_PERIODS = new Set([1, 7, 30, 90])

export class DashboardController {
  /**
   * GET /dashboard/stats?periodDays=7
   * Retorna estatisticas agregadas + comparacao com periodo anterior.
   */
  async getStats(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const companyId = user.companyId
    const q = request.query as { periodDays?: string }
    const parsed = q.periodDays ? Number(q.periodDays) : 7
    const period: DashboardPeriod = (VALID_PERIODS.has(parsed) ? parsed : 7) as DashboardPeriod

    const stats = await dashboardService.getStats(companyId, period)
    return reply.send(stats)
  }
}
