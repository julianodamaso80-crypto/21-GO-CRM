import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, authenticate, readBody, fail, sb, sbJson } from '../_lib/auth-core'
import { shapeTask } from './index'

const ALLOWED_TYPES = ['ligacao', 'whatsapp', 'reuniao', 'visita', 'follow_up', 'email', 'tarefa']
const ALLOWED_PRIORITIES = ['baixa', 'media', 'alta']
const ALLOWED_STATUSES = ['pendente', 'concluida', 'cancelada']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = authenticate(req, res)
  if (!payload) return

  const taskId = String(req.query.id || '')
  if (!taskId) return fail(res, 400, 'taskId obrigatorio')

  try {
    const tasks = await sbJson<any[]>(
      `/tasks?id=eq.${encodeURIComponent(taskId)}&company_id=eq.${encodeURIComponent(payload.companyId)}&limit=1`
    )
    if (!tasks.length) return fail(res, 404, 'Tarefa nao encontrada')
    const task = tasks[0]

    // Vendedor só pode mexer na própria tarefa
    if (payload.role === 'vendedor' && task.user_id !== payload.id) {
      return fail(res, 403, 'Voce so pode acessar suas proprias tarefas')
    }

    if (req.method === 'GET') {
      return res.status(200).json(shapeTask(task))
    }

    if (req.method === 'PATCH' || req.method === 'PUT') {
      const body = await readBody(req)
      const update: any = { updated_at: new Date().toISOString() }

      if (body.title !== undefined) update.title = String(body.title).trim()
      if (body.description !== undefined) update.description = body.description ? String(body.description) : null
      if (body.dueAt !== undefined) update.due_at = new Date(body.dueAt).toISOString()
      if (body.durationMin !== undefined) update.duration_min = body.durationMin ? parseInt(body.durationMin) : null
      if (body.type !== undefined && ALLOWED_TYPES.includes(body.type)) update.type = body.type
      if (body.priority !== undefined && ALLOWED_PRIORITIES.includes(body.priority)) update.priority = body.priority
      if (body.status !== undefined && ALLOWED_STATUSES.includes(body.status)) {
        update.status = body.status
        if (body.status === 'concluida') update.completed_at = new Date().toISOString()
        if (body.status === 'pendente') update.completed_at = null
      }
      if (body.userId !== undefined) update.user_id = String(body.userId)
      if (body.leadId !== undefined) update.lead_id = body.leadId || null
      if (body.contactId !== undefined) update.contact_id = body.contactId || null

      const r = await sb(`/tasks?id=eq.${encodeURIComponent(taskId)}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro ao atualizar: ${text.slice(0, 200)}`)
      }
      const updated = await r.json() as any[]
      return res.status(200).json(shapeTask(updated[0]))
    }

    if (req.method === 'DELETE') {
      const r = await sb(`/tasks?id=eq.${encodeURIComponent(taskId)}`, { method: 'DELETE' })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro ao excluir: ${text.slice(0, 200)}`)
      }
      return res.status(204).end()
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[task-id] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
