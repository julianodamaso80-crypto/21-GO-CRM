import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { setCors, authenticate, readBody, fail, sb, sbJson } from '../_lib/auth-core'

const DEFAULT_PHASES = [
  { name: 'Novo Lead', color: '#3D72DE', probability: 10 },
  { name: 'Qualificado', color: '#A78BFA', probability: 25 },
  { name: 'Cotacao Enviada', color: '#FBBF24', probability: 50 },
  { name: 'Negociacao', color: '#F08C28', probability: 75 },
  { name: 'Fechado (Ganho)', color: '#34D399', probability: 100, is_won: true },
  { name: 'Perdido', color: '#FB7185', probability: 0, is_lost: true },
]

function shapePipe(p: any) {
  return {
    id: p.id,
    companyId: p.company_id,
    name: p.name,
    description: p.description,
    icon: p.icon,
    color: p.color,
    status: p.status,
    tags: p.tags || [],
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    _count: {
      phases: p.phases?.[0]?.count ?? 0,
      cards: p.cards?.[0]?.count ?? 0,
      fieldDefinitions: p.field_definitions?.[0]?.count ?? 0,
    },
  }
}

async function listPipes(_req: VercelRequest, res: VercelResponse, payload: { companyId: string }) {
  const path = `/pipes?company_id=eq.${encodeURIComponent(payload.companyId)}` +
    `&status=eq.active` +
    `&select=id,company_id,name,description,icon,color,status,tags,created_at,updated_at,` +
    `phases(count),cards(count),field_definitions(count)` +
    `&order=created_at.desc`
  const pipes = await sbJson<any[]>(path)
  return res.status(200).json(pipes.map(shapePipe))
}

async function createPipe(req: VercelRequest, res: VercelResponse, payload: { companyId: string }) {
  const body = await readBody(req)
  const name = String(body.name || '').trim()
  if (!name) return fail(res, 400, 'Nome do funil e obrigatorio')

  const description = body.description ? String(body.description).trim() : null
  const color = body.color ? String(body.color) : '#1B4DA1'
  const icon = body.icon ? String(body.icon) : null
  const tags: string[] = Array.isArray(body.tags) ? body.tags.map(String) : []

  const pipeId = randomUUID()
  const now = new Date().toISOString()

  const r = await sb(`/pipes`, {
    method: 'POST',
    body: JSON.stringify({
      id: pipeId,
      company_id: payload.companyId,
      name, description, color, icon, tags,
      status: 'active',
      created_at: now,
      updated_at: now,
    }),
  })
  if (!r.ok) {
    const text = await r.text()
    return fail(res, 500, `Erro ao criar funil: ${text.slice(0, 200)}`)
  }
  const created = (await r.json()) as any[]

  const phasesPayload = DEFAULT_PHASES.map((p, i) => ({
    id: randomUUID(),
    company_id: payload.companyId,
    pipe_id: pipeId,
    name: p.name,
    color: p.color,
    position: i,
    probability: p.probability,
    is_won: p.is_won || false,
    is_lost: p.is_lost || false,
    created_at: now,
    updated_at: now,
  }))

  const ph = await sb(`/phases`, { method: 'POST', body: JSON.stringify(phasesPayload) })
  if (!ph.ok) {
    console.warn('[pipes] phases POST failed:', await ph.text())
  }

  return res.status(201).json({
    ...shapePipe(created[0]),
    _count: { phases: DEFAULT_PHASES.length, cards: 0, fieldDefinitions: 0 },
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = authenticate(req, res)
  if (!payload) return

  try {
    if (req.method === 'GET') return await listPipes(req, res, payload)
    if (req.method === 'POST') return await createPipe(req, res, payload)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[pipes] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
