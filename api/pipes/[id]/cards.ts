import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { setCors, authenticate, readBody, fail, sb, sbJson } from '../../_lib/auth-core'

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

  const payload = authenticate(req, res)
  if (!payload) return

  const pipeId = String(req.query.id || '')
  if (!pipeId) return fail(res, 400, 'pipeId obrigatorio')

  try {
    const pipes = await sbJson<any[]>(
      `/pipes?id=eq.${encodeURIComponent(pipeId)}&company_id=eq.${encodeURIComponent(payload.companyId)}&limit=1`
    )
    if (!pipes.length) return fail(res, 404, 'Funil nao encontrado')

    if (req.method === 'GET') {
      const cards = await sbJson<any[]>(
        `/cards?pipe_id=eq.${encodeURIComponent(pipeId)}&status=neq.archived&order=created_at.desc`
      )
      return res.status(200).json({ data: cards.map(shapeCard), pagination: { total: cards.length } })
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const cardId = String(body.cardId || '')
      const phaseId = String(body.phaseId || '')
      if (!cardId || !phaseId) return fail(res, 400, 'cardId e phaseId obrigatorios')

      const cards = await sbJson<any[]>(
        `/cards?id=eq.${encodeURIComponent(cardId)}&pipe_id=eq.${encodeURIComponent(pipeId)}&limit=1`
      )
      if (!cards.length) return fail(res, 404, 'Card nao encontrado')

      const phase = await sbJson<any[]>(
        `/phases?id=eq.${encodeURIComponent(phaseId)}&pipe_id=eq.${encodeURIComponent(pipeId)}&limit=1`
      )
      if (!phase.length) return fail(res, 400, 'Fase invalida')

      const now = new Date().toISOString()
      const update: any = { current_phase_id: phaseId, updated_at: now }
      if (phase[0].is_won) { update.status = 'done'; update.completed_at = now }
      else if (phase[0].is_lost) { update.status = 'archived' }
      else { update.status = 'active'; update.completed_at = null }

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
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const title = String(body.title || '').trim()
      if (!title) return fail(res, 400, 'Titulo obrigatorio')

      let phaseId = body.phaseId ? String(body.phaseId) : ''
      if (!phaseId) {
        const phases = await sbJson<any[]>(
          `/phases?pipe_id=eq.${encodeURIComponent(pipeId)}&order=position.asc&limit=1`
        )
        if (!phases.length) return fail(res, 400, 'Pipe sem fases — adicione uma fase primeiro')
        phaseId = phases[0].id
      } else {
        const phase = await sbJson<any[]>(
          `/phases?id=eq.${encodeURIComponent(phaseId)}&pipe_id=eq.${encodeURIComponent(pipeId)}&limit=1`
        )
        if (!phase.length) return fail(res, 400, 'Fase invalida')
      }

      const now = new Date().toISOString()
      const newCard = {
        id: randomUUID(),
        company_id: payload.companyId,
        pipe_id: pipeId,
        current_phase_id: phaseId,
        title,
        description: body.description ? String(body.description) : null,
        status: 'active',
        created_by_id: payload.id,
        assigned_to_id: body.assignedToId || null,
        due_date: body.dueDate || null,
        created_at: now,
        updated_at: now,
      }

      const r = await sb(`/cards`, { method: 'POST', body: JSON.stringify(newCard) })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro ao criar card: ${text.slice(0, 200)}`)
      }
      const created = await r.json() as any[]
      return res.status(201).json(shapeCard(created[0]))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[pipe-cards] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
