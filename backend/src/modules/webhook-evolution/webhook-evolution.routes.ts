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

// [TRACE-WA] Mascara JID/telefone: mantem ultimos 4 digitos pra correlacionar logs sem vazar
const maskJid = (jid?: string): string | null => {
  if (!jid) return null
  const phone = jid.split('@')[0]
  if (!phone || phone.length < 4) return jid
  return `***${phone.slice(-4)}@${jid.split('@')[1] || ''}`
}

export async function webhookEvolutionRoutes(fastify: FastifyInstance) {
  const hook = async (request: FastifyRequest, reply: FastifyReply) => {
    // [TRACE-WA] correlationId: prefere whatsappMessageId, senao gera id temporario
    const body = (request.body as any) || {}
    const correlationId: string =
      body?.data?.key?.id ||
      body?.data?.messageKey?.id ||
      `wh_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    // [TRACE-WA] Log de entrada ANTES da validacao de secret
    request.log.info(
      {
        tag: 'WA_WEBHOOK_RECEIVED',
        correlationId,
        event: body?.event,
        instance: body?.instance,
        fromMe: body?.data?.key?.fromMe,
        remoteJid: maskJid(body?.data?.key?.remoteJid),
        pushNamePresent: !!body?.data?.pushName,
        hasMessage: !!body?.data?.message,
        receivedAt: new Date().toISOString(),
        providedSecretExists: !!(
          (request.headers['x-evolution-secret'] as string | undefined) ||
          (request.headers['x-webhook-secret'] as string | undefined) ||
          (request.query as any)?.secret
        ),
        expectedSecretExists: !!process.env.EVOLUTION_WEBHOOK_SECRET,
      },
      '[WA_WEBHOOK_RECEIVED]',
    )

    const expected = process.env.EVOLUTION_WEBHOOK_SECRET
    if (expected) {
      const provided =
        (request.headers['x-evolution-secret'] as string | undefined) ||
        (request.headers['x-webhook-secret'] as string | undefined) ||
        (request.query as any)?.secret
      if (provided !== expected) {
        stats.rejected += 1
        stats.lastRejectedAt = new Date().toISOString()
        // [TRACE-WA] Log estruturado de rejeicao
        request.log.warn(
          {
            tag: 'WA_WEBHOOK_REJECTED',
            correlationId,
            reason: provided ? 'secret_mismatch' : 'missing_secret_header',
            hasExpectedSecret: !!expected,
            hasProvidedSecret: !!provided,
            instance: body?.instance,
            event: body?.event,
            ip: request.ip,
          },
          '[WA_WEBHOOK_REJECTED]',
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
      // [TRACE-WA] Propaga correlationId pro service
      const result = await processEvolutionWebhook(request.body as any, correlationId)
      stats.accepted += 1
      stats.lastAcceptedAt = new Date().toISOString()
      return reply.status(200).send({ ok: true, correlationId, ...result })
    } catch (err: any) {
      stats.errors += 1
      request.log.error(
        { tag: 'WA_WEBHOOK_PROCESS_ERROR', correlationId, err },
        '[EvolutionWebhook] processing failed',
      )
      // IMPORTANTE: sempre 200 pra Evolution não desligar o webhook por falhas.
      return reply.status(200).send({ ok: false, correlationId, error: err.message })
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
