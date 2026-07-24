import { FastifyInstance } from 'fastify'
import { DashboardController } from './dashboard.controller'
import { authenticate } from '../../middlewares/authenticate'

const dashboardController = new DashboardController()

export async function dashboardRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  // GET /dashboard/stats?periodDays=7
  fastify.get('/stats', {
    schema: {
      description: 'Dashboard stats com filtro de periodo (1, 7, 30, 90 dias)',
      tags: ['dashboard'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          periodDays: { type: 'string', enum: ['1', '7', '30', '90'] },
        },
      },
      // Resposta schema-less: shape detalhado em shared/types/index.ts (DashboardStats).
      // Schema rigido aqui obrigava manter sincronizado em 3 lugares (service, route, types).
    },
    handler: dashboardController.getStats.bind(dashboardController),
  })

  // GET /dashboard/rede?contrato&pagamento&raiz — Dashboard Hibrido da rede (3 visoes)
  fastify.get('/rede', {
    schema: {
      description: 'Dashboard Hibrido da rede: visoes Minha Rede, Meus Consultores, Meus Associados',
      tags: ['dashboard'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          contrato: { type: 'string' },
          pagamento: { type: 'string' },
          raiz: { type: 'string' },
        },
      },
    },
    handler: dashboardController.getRede.bind(dashboardController),
  })
}
