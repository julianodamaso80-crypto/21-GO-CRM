import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, authenticate, readBody, fail, sb, sbJson } from '../../../_lib/auth-core'

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
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' })

  const payload = authenticate(req, res)
  if (!payload) return

  const cardId = String(req.query.cardId || '')
  if (!cardId) return fail(res, 400, 'cardId obrigatorio')

  try {
    const body = await readBody(req)
    const phaseId = String(body.phaseId || '')
    if (!phaseId) return fail(res, 400, 'phaseId obrigatorio')

    const cards = await sbJson<any[]>(
      `/cards?id=eq.${encodeURIComponent(cardId)}&company_id=eq.${encodeURIComponent(payload.companyId)}&limit=1`
    )
    if (!cards.length) return fail(res, 404, 'Card nao encontrado')
    const card = cards[0]

    const phase = await sbJson<any[]>(
      `/phases?id=eq.${encodeURIComponent(phaseId)}&pipe_id=eq.${encodeURIComponent(card.pipe_id)}&limit=1`
    )
    if (!phase.length) return fail(res, 400, 'Fase invalida')

    const now = new Date().toISOString()
    const update: any = {
      current_phase_id: phaseId,
      updated_at: now,
    }
    if (phase[0].is_won) {
      update.status = 'done'
      update.completed_at = now
    } else if (phase[0].is_lost) {
      update.status = 'archived'
    } else {
      update.status = 'active'
      update.completed_at = null
    }

    const r = await sb(`/cards?id=eq.${encodeURIComponent(cardId)}`, {
      method: 'PATCH',
      body: JSON.stringify(update),
    })
    if (!r.ok) {
      const text = await r.text()
      return fail(res, 500, `Erro: ${text.slice(0, 200)}`)
    }
    const updated = await r.json() as any[]
    return res.status(200).json(shapeCard(updated[0]))
  } catch (err: any) {
    console.error('[card-move] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
