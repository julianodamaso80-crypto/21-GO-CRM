import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { processEvolutionWebhook } from './webhook-evolution.service'

/**
 * Rotas públicas (sem auth) que recebem webhooks da Evolution API.
 * Proteção: header `x-evolution-secret` deve bater com EVOLUTION_WEBHOOK_SECRET (se definido).
 *
 * Modo soft: se EVOLUTION_WEBHOOK_SECRET estiver vazio, aceita qualquer requisição
 * (compatibilidade durante rollout). Loga warning a cada chamada.
 */

const stats = {
  accepted: 0,
  rejected: 0,
  errors: 0,
  lastAcceptedAt: null as string | null,
  lastRejectedAt: null as string | null,
  warnedNoSecret: false,
}

export async function webhookEvolutionRoutes(fastify: FastifyInstance) {
  const hook = async (request: FastifyRequest, reply: FastifyReply) => {
    const expected = process.env.EVOLUTION_WEBHOOK_SECRET
    if (expected) {
      const provided =
        (request.headers['x-evolution-secret'] as string | undefined) ||
        (request.headers['x-webhook-secret'] as string | undefined) ||
        (request.query as any)?.secret
      if (provided !== expected) {
        stats.rejected += 1
        stats.lastRejectedAt = new Date().toISOString()
        request.log.warn(
          { ip: request.ip, hasHeader: !!provided },
          '[JAPAO][webhook] requisição rejeitada — secret inválido ou ausente',
        )
        return reply.status(401).send({ error: 'invalid secret' })
      }
    } else if (!stats.warnedNoSecret) {
      stats.warnedNoSecret = true
      request.log.warn(
        '[JAPAO][webhook] EVOLUTION_WEBHOOK_SECRET não configurado — aceitando requisições sem validar (modo soft)',
      )
    }

    try {
      const result = await processEvolutionWebhook(request.body as any)
      stats.accepted += 1
      stats.lastAcceptedAt = new Date().toISOString()
      return reply.status(200).send({ ok: true, ...result })
    } catch (err: any) {
      stats.errors += 1
      request.log.error({ err }, '[EvolutionWebhook] processing failed')
      // IMPORTANTE: sempre 200 pra Evolution não desligar o webhook por falhas.
      return reply.status(200).send({ ok: false, error: err.message })
    }
  }

  // Endpoint principal (uma URL recebe todos os eventos — Webhook by Events = OFF)
  fastify.post('/', {
    schema: {
      description: 'Webhook receiver da Evolution API (WhatsApp)',
      tags: ['Webhook Evolution'],
    },
    handler: hook,
  })

  // Health check específico — útil pra teste manual
  fastify.get('/', async (_req, reply) => {
    return reply.send({
      status: 'ok',
      service: 'webhook-evolution',
      timestamp: new Date().toISOString(),
      secretConfigured: !!process.env.EVOLUTION_WEBHOOK_SECRET,
    })
  })

  // Métricas — público também (sem dados sensíveis)
  fastify.get('/stats', async (_req, reply) => {
    return reply.send({
      ...stats,
      secretConfigured: !!process.env.EVOLUTION_WEBHOOK_SECRET,
      timestamp: new Date().toISOString(),
    })
  })
}
