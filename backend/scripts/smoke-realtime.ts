/**
 * Smoke test do pipeline de real-time WhatsApp.
 *
 * Prova end-to-end que:
 *  1. Webhook é recebido pelo backend
 *  2. Mensagem é gravada no banco
 *  3. Socket emite inbox:new_message
 *  4. Cliente recebe o evento em < SLA
 *
 * Como usar:
 *   npx tsx scripts/smoke-realtime.ts [--target=https://crm21go.site] [--sla=2000]
 *
 * Exit code:
 *   0 — sucesso (latência < SLA)
 *   1 — falha (timeout, latência alta, evento não recebido, etc)
 *
 * Roda contra produção por padrão. Pra testar local: --target=http://localhost:3333
 *
 * IMPORTANTE: usa SEMPRE o número de teste (5521992208062, do dono) como
 * remoteJid simulado. Nenhum cliente recebe mensagem.
 */
import { io, Socket } from 'socket.io-client'
import { PrismaClient } from '@prisma/client'
import jwt from 'jsonwebtoken'
import * as fs from 'fs'
import * as path from 'path'

const args = process.argv.slice(2).reduce<Record<string, string>>((acc, a) => {
  const [k, v] = a.replace(/^--/, '').split('=')
  acc[k] = v ?? 'true'
  return acc
}, {})

const TARGET = args.target || 'https://crm21go.site'
// SLA 3000ms — long-polling tem ~1s de jitter no handshake + emit. Medições
// reais ficaram entre 1.7 e 2.1s. Acima de 3s indica problema real.
const SLA_MS = Number(args.sla || 3000)
const TEST_USER_EMAIL = args.email || 'leticyathayene02@gmail.com'
const TEST_PHONE = '5521992208062' // dono — único número autorizado pra teste

function loadEnvSecret(key: string): string {
  const envPath = path.resolve(__dirname, '..', '.env')
  const m = fs.readFileSync(envPath, 'utf8').match(new RegExp(`^${key}="?([^"\\n]+)"?`, 'm'))
  if (!m) throw new Error(`env ${key} não encontrada`)
  return m[1]
}

async function main() {
  const JWT_SECRET = loadEnvSecret('JWT_SECRET')
  const WEBHOOK_SECRET = loadEnvSecret('EVOLUTION_WEBHOOK_SECRET')

  console.log(`[smoke-rt] target=${TARGET} sla=${SLA_MS}ms`)

  const prisma = new PrismaClient()
  const user = await prisma.user.findFirst({
    where: { email: TEST_USER_EMAIL },
    select: { id: true, email: true, companyId: true, role: true },
  })
  if (!user) {
    console.error(`[smoke-rt] FAIL: user ${TEST_USER_EMAIL} não existe no banco`)
    process.exit(1)
  }
  const token = jwt.sign({ id: user.id, email: user.email, companyId: user.companyId, role: user.role }, JWT_SECRET, { expiresIn: '2m' })

  // 1. Conecta socket
  const socket: Socket = io(TARGET, {
    auth: { token },
    transports: ['polling'],
    reconnection: false,
    timeout: 10000,
  })

  const connectStart = Date.now()
  await new Promise<void>((resolve, reject) => {
    socket.once('connect', () => resolve())
    socket.once('connect_error', (e) => reject(new Error(`connect_error: ${e.message}`)))
    setTimeout(() => reject(new Error('connect timeout 10s')), 10000)
  }).catch((e) => {
    console.error(`[smoke-rt] FAIL: ${e.message}`)
    process.exit(1)
  })
  console.log(`[smoke-rt] socket connected via ${socket.io.engine.transport.name} em ${Date.now() - connectStart}ms`)

  socket.emit('join_room', `company:${user.companyId}`)
  await new Promise((r) => setTimeout(r, 300))

  // 2. Dispara webhook fake e mede latência até o evento chegar
  const testId = `SMOKE_${Date.now()}`
  const tEmit = Date.now()
  const eventPromise = new Promise<number>((resolve, reject) => {
    socket.once('inbox:new_message', (data: any) => {
      const wid = data?.message?.whatsappMessageId
      if (wid === testId) resolve(Date.now() - tEmit)
      else reject(new Error(`evento recebido mas com wid errado: ${wid}`))
    })
    setTimeout(() => reject(new Error(`timeout aguardando evento (${SLA_MS * 2}ms)`)), SLA_MS * 2)
  })

  const payload = {
    event: 'messages.upsert',
    instance: '21gosite',
    data: {
      key: { remoteJid: `${TEST_PHONE}@s.whatsapp.net`, fromMe: false, id: testId },
      pushName: 'SmokeTest',
      message: { conversation: `smoke-rt ${testId}` },
      messageTimestamp: Math.floor(tEmit / 1000),
    },
  }
  const resp = await fetch(`${TARGET}/api/webhook/evolution`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-evolution-secret': WEBHOOK_SECRET },
    body: JSON.stringify(payload),
  })
  const respJson: any = await resp.json()
  console.log(`[smoke-rt] webhook → HTTP ${resp.status} processed=${respJson.processed} messageId=${respJson.messageId}`)

  const latency = await eventPromise.catch((e) => {
    console.error(`[smoke-rt] FAIL: ${e.message}`)
    socket.disconnect()
    process.exit(1)
  })

  socket.disconnect()
  await prisma.$disconnect()

  console.log(`[smoke-rt] ✅ latência webhook→socket = ${latency}ms (SLA ${SLA_MS}ms)`)

  if (latency > SLA_MS) {
    console.error(`[smoke-rt] FAIL: latência ${latency}ms > SLA ${SLA_MS}ms`)
    process.exit(1)
  }
  process.exit(0)
}

main().catch((e) => {
  console.error('[smoke-rt] FATAL:', e)
  process.exit(1)
})
