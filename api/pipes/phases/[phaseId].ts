import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, requireAdmin, readBody, fail, sb, sbJson } from '../../_lib/auth-core'

function shapePhase(ph: any) {
  return {
    id: ph.id, companyId: ph.company_id, pipeId: ph.pipe_id,
    name: ph.name, color: ph.color, position: ph.position, probability: ph.probability,
    isWon: ph.is_won, isLost: ph.is_lost,
    createdAt: ph.created_at, updatedAt: ph.updated_at,
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = requireAdmin(req, res)
  if (!payload) return

  const phaseId = String(req.query.phaseId || '')
  if (!phaseId) return fail(res, 400, 'phaseId obrigatorio')

  try {
    const phases = await sbJson<any[]>(
      `/phases?id=eq.${encodeURIComponent(phaseId)}&company_id=eq.${encodeURIComponent(payload.companyId)}&limit=1`
    )
    if (!phases.length) return fail(res, 404, 'Fase nao encontrada')
    const phase = phases[0]

    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const update: any = { updated_at: new Date().toISOString() }
      if (body.name !== undefined) {
        const name = String(body.name).trim()
        if (!name) return fail(res, 400, 'Nome nao pode ser vazio')
        update.name = name
      }
      if (body.color !== undefined) update.color = String(body.color)
      if (body.position !== undefined) update.position = Number(body.position)
      if (body.probability !== undefined) {
        const p = Math.max(0, Math.min(100, Number(body.probability) || 0))
        update.probability = p
      }
      if (body.isWon !== undefined) update.is_won = !!body.isWon
      if (body.isLost !== undefined) update.is_lost = !!body.isLost

      const r = await sb(`/phases?id=eq.${encodeURIComponent(phaseId)}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro: ${text.slice(0, 200)}`)
      }
      const updated = await r.json() as any[]
      return res.status(200).json(shapePhase(updated[0]))
    }

    if (req.method === 'DELETE') {
      const cards = await sbJson<any[]>(
        `/cards?current_phase_id=eq.${encodeURIComponent(phaseId)}&status=neq.archived&select=id&limit=1`
      )
      if (cards.length) {
        return fail(res, 409, 'Mova ou arquive os cards desta fase antes de exclui-la')
      }

      const allPhases = await sbJson<any[]>(
        `/phases?pipe_id=eq.${encodeURIComponent(phase.pipe_id)}&select=id&limit=2`
      )
      if (allPhases.length <= 1) {
        return fail(res, 400, 'Funil precisa de pelo menos uma fase')
      }

      const r = await sb(`/phases?id=eq.${encodeURIComponent(phaseId)}`, { method: 'DELETE' })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro: ${text.slice(0, 200)}`)
      }
      return res.status(200).json({ success: true })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[phase-id] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
