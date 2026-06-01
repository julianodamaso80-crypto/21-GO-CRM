import { logger } from './logger'

interface DispatchOptions {
  url: string
  payload: unknown
  bearerToken?: string
  maxAttempts?: number
  timeoutMs?: number
  eventName: string
}

const DEFAULT_MAX_ATTEMPTS = 3
const DEFAULT_TIMEOUT_MS = 10_000
const BACKOFF_MS = [1_000, 3_000, 9_000]

export async function dispatchWebhook(opts: DispatchOptions): Promise<void> {
  const {
    url,
    payload,
    bearerToken,
    eventName,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = opts

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': '21Go-CRM-Webhook/1.0',
    'X-Webhook-Event': eventName,
  }
  if (bearerToken) headers['Authorization'] = `Bearer ${bearerToken}`

  const body = JSON.stringify(payload)

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      })
      clearTimeout(timer)

      if (res.ok) {
        logger.info({ eventName, attempt, status: res.status }, 'webhook dispatched')
        return
      }

      const text = await res.text().catch(() => '')
      logger.warn(
        { eventName, attempt, status: res.status, response: text.slice(0, 500) },
        'webhook returned non-2xx'
      )

      if (res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429) {
        return
      }
    } catch (err: any) {
      clearTimeout(timer)
      logger.warn(
        { eventName, attempt, error: err?.message || String(err) },
        'webhook attempt failed'
      )
    }

    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1] ?? 9_000))
    }
  }

  logger.error({ eventName, url }, 'webhook gave up after retries')
}

export function fireAndForgetWebhook(opts: DispatchOptions): void {
  dispatchWebhook(opts).catch((err) => {
    logger.error({ err: err?.message || String(err), eventName: opts.eventName }, 'webhook crashed')
  })
}
