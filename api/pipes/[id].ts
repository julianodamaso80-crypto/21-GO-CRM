import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, authenticate, fail, sb, sbJson } from '../_lib/auth-core'

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
  }
}

function shapePhase(ph: any) {
  return {
    id: ph.id,
    companyId: ph.company_id,
    pipeId: ph.pipe_id,
    name: ph.name,
    color: ph.color,
    position: ph.position,
    probability: ph.probability,
    isWon: ph.is_won,
    isLost: ph.is_lost,
    createdAt: ph.created_at,
    updatedAt: ph.updated_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = authenticate(req, res)
  if (!payload) return

  const id = String(req.query.id || '')
  if (!id) return fail(res, 400, 'ID obrigatorio')

  try {
    const pipes = await sbJson<any[]>(
      `/pipes?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(payload.companyId)}&limit=1`
    )
    if (!pipes.length) return fail(res, 404, 'Funil nao encontrado')
    const pipe = pipes[0]

    if (req.method === 'GET') {
      const phases = await sbJson<any[]>(
        `/phases?pipe_id=eq.${encodeURIComponent(id)}&order=position.asc`
      )
      return res.status(200).json({
        ...shapePipe(pipe),
        phases: phases.map(shapePhase),
        fieldDefinitions: [],
      })
    }

    if (req.method === 'DELETE') {
      const r = await sb(`/pipes?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'archived', updated_at: new Date().toISOString() }),
      })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro: ${text.slice(0, 200)}`)
      }
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[pipe-id] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
