import { FastifyRequest, FastifyReply } from 'fastify'
import { DashboardService, DashboardPeriod } from './dashboard.service'
import { dashboardRede, resolverRaizDoUsuario } from './dashboard-rede.service'

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

    const stats = await dashboardService.getStats(companyId, period, user)
    return reply.send(stats)
  }

  /**
   * GET /dashboard/rede?contrato&pagamento&raiz
   * Dashboard Hibrido da rede (3 visoes). Consultor ve a propria raiz; admin pode ?raiz=.
   * 404 quando o usuario nao tem rede vinculada ou nao ha carga publicada.
   */
  async getRede(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const q = request.query as { contrato?: string; pagamento?: string; raiz?: string }

    let raizPowerId: number
    let raizNome: string | null = null
    if (user.role === 'admin' && q.raiz) {
      raizPowerId = Number(q.raiz)
    } else {
      const minha = await resolverRaizDoUsuario(user.companyId, user.id)
      if (!minha) return reply.status(404).send({ message: 'Voce ainda nao tem rede vinculada.' })
      raizPowerId = minha.powerId
      raizNome = minha.nome
    }

    const data = await dashboardRede(user.companyId, raizPowerId, raizNome, {
      contrato: q.contrato,
      pagamento: q.pagamento,
    })
    if (!data) return reply.status(404).send({ message: 'Nenhuma carga publicada para esta rede ainda.' })
    return reply.send(data)
  }
}
