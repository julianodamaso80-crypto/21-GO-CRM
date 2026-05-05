import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { setCors, authenticate, readBody, fail, sb, sbJson } from '../../_lib/auth-core'
import { shapeTask } from '../../tasks/index'

const ALLOWED_TYPES = ['ligacao', 'whatsapp', 'reuniao', 'visita', 'follow_up', 'email', 'tarefa']
const ALLOWED_PRIORITIES = ['baixa', 'media', 'alta']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = authenticate(req, res)
  if (!payload) return

  const leadId = String(req.query.id || '')
  if (!leadId) return fail(res, 400, 'leadId obrigatorio')

  try {
    if (req.method === 'GET') {
      const tasks = await sbJson<any[]>(
        `/tasks?lead_id=eq.${encodeURIComponent(leadId)}&company_id=eq.${encodeURIComponent(payload.companyId)}&order=due_at.asc`
      )
      return res.status(200).json({ data: tasks.map(shapeTask), total: tasks.length })
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const title = String(body.title || '').trim()
      const dueAt = body.dueAt ? String(body.dueAt) : ''

      if (!title) return fail(res, 400, 'titulo obrigatorio')
      if (!dueAt) return fail(res, 400, 'data obrigatoria')

      const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'tarefa'
      const priority = ALLOWED_PRIORITIES.includes(body.priority) ? body.priority : 'media'

      const now = new Date().toISOString()
      const newTask = {
        id: randomUUID(),
        company_id: payload.companyId,
        user_id: body.userId || payload.id,
        created_by_id: payload.id,
        lead_id: leadId,
        contact_id: body.contactId || null,
        title,
        description: body.description ? String(body.description) : null,
        type,
        priority,
        status: 'pendente',
        due_at: new Date(dueAt).toISOString(),
        duration_min: body.durationMin ? parseInt(body.durationMin) : null,
        completed_at: null,
        created_at: now,
        updated_at: now,
      }

      const r = await sb(`/tasks`, { method: 'POST', body: JSON.stringify(newTask) })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro ao criar tarefa: ${text.slice(0, 200)}`)
      }
      const created = await r.json() as any[]
      return res.status(201).json(shapeTask(created[0]))
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[lead-tasks] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
