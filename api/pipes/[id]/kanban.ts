import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, authenticate, fail, sbJson } from '../../_lib/auth-core'

function shapePipe(p: any) {
  return {
    id: p.id, companyId: p.company_id, name: p.name, description: p.description,
    icon: p.icon, color: p.color, status: p.status, tags: p.tags || [],
    createdAt: p.created_at, updatedAt: p.updated_at,
  }
}

function shapePhase(ph: any, cards: any[]) {
  return {
    id: ph.id, companyId: ph.company_id, pipeId: ph.pipe_id,
    name: ph.name, color: ph.color, position: ph.position, probability: ph.probability,
    isWon: ph.is_won, isLost: ph.is_lost,
    cards: cards.map(shapeCard),
    _count: { cards: cards.length },
    createdAt: ph.created_at, updatedAt: ph.updated_at,
  }
}

function shapeCard(c: any) {
  return {
    id: c.id, pipeId: c.pipe_id, companyId: c.company_id,
    currentPhaseId: c.current_phase_id, title: c.title, description: c.description,
    status: c.status, createdById: c.created_by_id, assignedToId: c.assigned_to_id,
    dueDate: c.due_date, completedAt: c.completed_at,
    createdAt: c.created_at, updatedAt: c.updated_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const payload = authenticate(req, res)
  if (!payload) return

  const id = String(req.query.id || '')
  if (!id) return fail(res, 400, 'ID obrigatorio')

  try {
    const pipes = await sbJson<any[]>(
      `/pipes?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(payload.companyId)}&limit=1`
    )
    if (!pipes.length) return fail(res, 404, 'Funil nao encontrado')

    const phases = await sbJson<any[]>(
      `/phases?pipe_id=eq.${encodeURIComponent(id)}&order=position.asc`
    )
    const cards = await sbJson<any[]>(
      `/cards?pipe_id=eq.${encodeURIComponent(id)}&status=neq.archived&order=created_at.desc`
    )

    const cardsByPhase = new Map<string, any[]>()
    cards.forEach((c) => {
      const arr = cardsByPhase.get(c.current_phase_id) || []
      arr.push(c)
      cardsByPhase.set(c.current_phase_id, arr)
    })

    return res.status(200).json({
      ...shapePipe(pipes[0]),
      phases: phases.map((ph) => shapePhase(ph, cardsByPhase.get(ph.id) || [])),
    })
  } catch (err: any) {
    console.error('[kanban] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
