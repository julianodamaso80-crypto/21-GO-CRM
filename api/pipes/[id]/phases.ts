import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
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

  const pipeId = String(req.query.id || '')
  if (!pipeId) return fail(res, 400, 'pipeId obrigatorio')

  try {
    const pipes = await sbJson<any[]>(
      `/pipes?id=eq.${encodeURIComponent(pipeId)}&company_id=eq.${encodeURIComponent(payload.companyId)}&limit=1`
    )
    if (!pipes.length) return fail(res, 404, 'Funil nao encontrado')

    if (req.method === 'GET') {
      const phases = await sbJson<any[]>(
        `/phases?pipe_id=eq.${encodeURIComponent(pipeId)}&order=position.asc`
      )
      return res.status(200).json(phases.map(shapePhase))
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const phaseIds: string[] = Array.isArray(body.phaseIds) ? body.phaseIds.map(String) : []
      if (!phaseIds.length) return fail(res, 400, 'phaseIds (array) obrigatorio para reordenar')

      const existing = await sbJson<any[]>(
        `/phases?pipe_id=eq.${encodeURIComponent(pipeId)}&select=id`
      )
      const existingIds = new Set(existing.map((p) => p.id))
      if (phaseIds.length !== existingIds.size || phaseIds.some((id) => !existingIds.has(id))) {
        return fail(res, 400, 'phaseIds nao corresponde as fases atuais do funil')
      }

      const now = new Date().toISOString()
      for (let i = 0; i < phaseIds.length; i++) {
        await sb(`/phases?id=eq.${encodeURIComponent(phaseIds[i])}`, {
          method: 'PATCH',
          body: JSON.stringify({ position: i, updated_at: now }),
        })
      }
      return res.status(200).json({ success: true })
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const name = String(body.name || '').trim()
      if (!name) return fail(res, 400, 'Nome da fase e obrigatorio')

      const existing = await sbJson<any[]>(
        `/phases?pipe_id=eq.${encodeURIComponent(pipeId)}&select=position&order=position.desc&limit=1`
      )
      const nextPosition = existing.length ? (existing[0].position + 1) : 0

      const now = new Date().toISOString()
      const newPhase = {
        id: randomUUID(),
        company_id: payload.companyId,
        pipe_id: pipeId,
        name,
        color: body.color ? String(body.color) : '#6B7280',
        position: typeof body.position === 'number' ? body.position : nextPosition,
        probability: typeof body.probability === 'number' ? body.probability : 0,
        is_won: !!body.isWon,
        is_lost: !!body.isLost,
        created_at: now,
        updated_at: now,
      }

      const r = await sb(`/phases`, { method: 'POST', body: JSON.stringify(newPhase) })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro: ${text.slice(0, 200)}`)
      }
      const created = await r.json() as any[]
      return res.status(201).json(shapePhase(created[0]))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[pipe-phases] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
