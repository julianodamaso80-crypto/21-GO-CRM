import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { socketService } from '../../websocket'
import { authenticate } from '../../middlewares/authenticate'

/**
 * Endpoints de observabilidade do pipeline real-time.
 *
 *  GET /api/realtime/health  — público; status binário (servidor está respondendo)
 *  GET /api/realtime/stats   — auth; métricas (clientes conectados, usuários online)
 *
 * Usado pelo smoke test e por dashboards futuros pra detectar regressão.
 */
export async function realtimeRoutes(fastify: FastifyInstance) {
  // Health público — usado por monitor externo
  fastify.get('/health', async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: 'ok',
      service: 'realtime',
      timestamp: new Date().toISOString(),
    })
  })

  // Stats com auth — só user logado vê
  fastify.get('/stats', { preHandler: [authenticate] }, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = (request as any).user
    const totalConnections = await socketService.getConnectionsCount()
    const onlineUsers = await socketService.getOnlineUsers(user.companyId)

    return reply.send({
      service: 'realtime',
      totalConnections,
      companyOnlineUsers: onlineUsers.length,
      transports: ['polling'], // único transport ativo enquanto Traefik não faz WS upgrade
      sla: { latencyTargetMs: 2000 },
      timestamp: new Date().toISOString(),
    })
  })
}
