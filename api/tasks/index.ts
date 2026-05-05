import type { VercelRequest, VercelResponse } from '@vercel/node'
import { randomUUID } from 'crypto'
import { setCors, authenticate, readBody, fail, sb, sbJson } from '../_lib/auth-core'

export function shapeTask(t: any) {
  return {
    id: t.id,
    companyId: t.company_id,
    userId: t.user_id,
    createdById: t.created_by_id,
    leadId: t.lead_id,
    contactId: t.contact_id,
    title: t.title,
    description: t.description,
    type: t.type,
    priority: t.priority,
    status: t.status,
    dueAt: t.due_at,
    durationMin: t.duration_min,
    completedAt: t.completed_at,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
  }
}

const ALLOWED_TYPES = ['ligacao', 'whatsapp', 'reuniao', 'visita', 'follow_up', 'email', 'tarefa']
const ALLOWED_PRIORITIES = ['baixa', 'media', 'alta']
const ALLOWED_STATUSES = ['pendente', 'concluida', 'cancelada']

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = authenticate(req, res)
  if (!payload) return

  try {
    if (req.method === 'GET') {
      const { period, status, type, priority, leadId, scope } = req.query as Record<string, string>

      const filters: string[] = [`company_id=eq.${encodeURIComponent(payload.companyId)}`]

      // Vendedor só vê suas tarefas (a menos que peça scope=all e seja admin/gestor)
      const wantsAll = scope === 'all'
      if (!wantsAll || (payload.role !== 'admin' && payload.role !== 'gestor')) {
        filters.push(`user_id=eq.${encodeURIComponent(payload.id)}`)
      }

      if (status && ALLOWED_STATUSES.includes(status)) {
        filters.push(`status=eq.${status}`)
      }
      if (type && ALLOWED_TYPES.includes(type)) {
        filters.push(`type=eq.${type}`)
      }
      if (priority && ALLOWED_PRIORITIES.includes(priority)) {
        filters.push(`priority=eq.${priority}`)
      }
      if (leadId) {
        filters.push(`lead_id=eq.${encodeURIComponent(leadId)}`)
      }

      // Filtro de período
      const now = new Date()
      const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
      const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999)

      if (period === 'today') {
        filters.push(`due_at=gte.${startOfDay.toISOString()}`)
        filters.push(`due_at=lte.${endOfDay.toISOString()}`)
      } else if (period === 'overdue') {
        filters.push(`due_at=lt.${startOfDay.toISOString()}`)
        filters.push(`status=eq.pendente`)
      } else if (period === '7d') {
        const end = new Date(now); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999)
        filters.push(`due_at=gte.${startOfDay.toISOString()}`)
        filters.push(`due_at=lte.${end.toISOString()}`)
      } else if (period === '30d') {
        const end = new Date(now); end.setDate(end.getDate() + 30); end.setHours(23, 59, 59, 999)
        filters.push(`due_at=gte.${startOfDay.toISOString()}`)
        filters.push(`due_at=lte.${end.toISOString()}`)
      } else if (period === 'month') {
        const start = new Date(now.getFullYear(), now.getMonth(), 1)
        const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
        filters.push(`due_at=gte.${start.toISOString()}`)
        filters.push(`due_at=lte.${end.toISOString()}`)
      }

      const tasks = await sbJson<any[]>(
        `/tasks?${filters.join('&')}&order=due_at.asc&limit=500`
      )
      return res.status(200).json({ data: tasks.map(shapeTask), total: tasks.length })
    }

    if (req.method === 'POST') {
      const body = await readBody(req)
      const title = String(body.title || '').trim()
      const dueAt = body.dueAt ? String(body.dueAt) : ''

      if (!title) return fail(res, 400, 'titulo obrigatorio')
      if (!dueAt) return fail(res, 400, 'data de vencimento obrigatoria')

      const type = ALLOWED_TYPES.includes(body.type) ? body.type : 'tarefa'
      const priority = ALLOWED_PRIORITIES.includes(body.priority) ? body.priority : 'media'

      const now = new Date().toISOString()
      const newTask = {
        id: randomUUID(),
        company_id: payload.companyId,
        user_id: body.userId || payload.id,
        created_by_id: payload.id,
        lead_id: body.leadId || null,
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
    console.error('[tasks] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
