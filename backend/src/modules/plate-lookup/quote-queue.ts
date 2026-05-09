import Bull from 'bull'
import { prisma } from '../../config/database'
import { getRedisConfig } from '../../config/env'
import { sendFollowUp } from './lead-followup.service'

/* ─────────────────────────────────────────────────────────────────────────
 * Fila de follow-up com delay de 5 minutos.
 *
 * Estado atual (Projeto Japão Fase 2): a fila está NEUTRALIZADA por padrão.
 * O follow-up imediato agora roda via `sendFollowUp` direto em
 * `plate-lookup.routes.ts` (POST /lead). O agendamento de 5 min só é
 * reativado se a env `ENABLE_FOLLOWUP_QUEUE=true` estiver setada E o Redis
 * estiver configurado (REDIS_URL ou REDIS_HOST != localhost).
 *
 * Sem isso, importar Bull tentava conectar Redis em loop → 100s de erros
 * por minuto nos logs de produção, sem nenhum benefício (a função do delay
 * de 5 min foi descontinuada por decisão de produto).
 *
 * Pra reativar: setar `ENABLE_FOLLOWUP_QUEUE=true` + `REDIS_URL` no Easypanel
 * e voltar a chamar `scheduleFollowUp(leadId)` no handler do POST /lead.
 * ───────────────────────────────────────────────────────────────────────── */

export interface QuoteJobData {
  leadId: string
}

const isEnabled = (): boolean => {
  if (process.env.ENABLE_FOLLOWUP_QUEUE !== 'true') return false
  if (!process.env.REDIS_URL && !process.env.REDIS_HOST) return false
  if (process.env.REDIS_HOST === 'localhost' && !process.env.REDIS_URL) return false
  return true
}

let quoteQueueInstance: Bull.Queue<QuoteJobData> | null = null
let connectionState: 'idle' | 'ready' | 'error' = 'idle'
let lastError: string | null = null

function buildQueue(): Bull.Queue<QuoteJobData> | null {
  if (!isEnabled()) {
    console.log('[JAPAO][quote-queue] desabilitada — ENABLE_FOLLOWUP_QUEUE != true ou REDIS não configurado')
    return null
  }

  const redisConfig = getRedisConfig()
  const queue = new Bull<QuoteJobData>('quote-followup', {
    redis: typeof redisConfig === 'string' ? redisConfig : redisConfig,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: 100,
      attempts: 2,
      backoff: { type: 'exponential', delay: 30_000 },
    },
  })

  queue.on('error', (err) => {
    connectionState = 'error'
    lastError = err.message
    console.warn('[JAPAO][quote-queue] redis error:', err.message)
  })
  queue.on('ready', () => {
    connectionState = 'ready'
    lastError = null
    console.log('[JAPAO][quote-queue] redis conectado')
  })

  // Worker — processa follow-up de 5 min
  queue.process(async (job) => {
    const { leadId } = job.data
    const lead = await prisma.lead.findUnique({ where: { id: leadId } })
    if (!lead) {
      console.warn(`[JAPAO][quote-queue] Lead ${leadId} não encontrado`)
      return
    }
    if (lead.whatsappClicado || lead.etapaFunil === 'convertido' || lead.followUpEnviado) {
      console.log(`[JAPAO][quote-queue] Lead ${leadId} já engajado — skip`)
      return
    }
    const result = await sendFollowUp({ leadId, withPdf: true })
    if (!result.success) {
      console.warn(`[JAPAO][quote-queue] Falha no follow-up ${leadId}: ${result.error}`)
    } else {
      console.log(`[JAPAO][quote-queue] Follow-up enviado para ${leadId}`)
    }
  })

  return queue
}

function getQueue(): Bull.Queue<QuoteJobData> | null {
  if (quoteQueueInstance !== null) return quoteQueueInstance
  if (!isEnabled()) return null
  quoteQueueInstance = buildQueue()
  return quoteQueueInstance
}

/** Agenda follow-up para 5 minutos após a criação do lead. No-op se queue desabilitada. */
export async function scheduleFollowUp(leadId: string): Promise<void> {
  const queue = getQueue()
  if (!queue) {
    console.log(`[JAPAO][quote-queue] scheduleFollowUp(${leadId}) ignorado — queue desabilitada`)
    return
  }
  const jobId = `followup:${leadId}`
  const existing = await queue.getJob(jobId).catch(() => null)
  if (existing) {
    await existing.remove().catch(() => {})
  }
  await queue.add(
    { leadId },
    {
      jobId,
      delay: 5 * 60 * 1000,
    },
  )
}

/** Cancela o follow-up agendado. No-op se queue desabilitada. */
export async function cancelFollowUp(leadId: string): Promise<boolean> {
  const queue = getQueue()
  if (!queue) return false
  const jobId = `followup:${leadId}`
  const job = await queue.getJob(jobId).catch(() => null)
  if (job) {
    await job.remove()
    return true
  }
  return false
}

/** Status para healthcheck. */
export function getQueueHealth(): {
  enabled: boolean
  state: 'idle' | 'ready' | 'error' | 'disabled'
  lastError: string | null
  reason?: string
} {
  if (!isEnabled()) {
    const reasons: string[] = []
    if (process.env.ENABLE_FOLLOWUP_QUEUE !== 'true') reasons.push('ENABLE_FOLLOWUP_QUEUE != true')
    if (!process.env.REDIS_URL && !process.env.REDIS_HOST) reasons.push('REDIS_URL/HOST ausente')
    if (process.env.REDIS_HOST === 'localhost' && !process.env.REDIS_URL) reasons.push('REDIS_HOST=localhost (dev only)')
    return { enabled: false, state: 'disabled', lastError: null, reason: reasons.join('; ') }
  }
  // Força criação se ainda não foi inicializada
  getQueue()
  return { enabled: true, state: connectionState, lastError }
}

// Export pra compatibilidade — alguns lugares ainda podem importar
export const quoteQueue = {
  add: (data: QuoteJobData, opts?: any) => getQueue()?.add(data, opts),
  getJob: (id: string) => getQueue()?.getJob(id),
}
