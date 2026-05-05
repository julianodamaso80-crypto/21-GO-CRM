import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'

export type TaskType = 'ligacao' | 'whatsapp' | 'reuniao' | 'visita' | 'follow_up' | 'email' | 'tarefa'
export type TaskPriority = 'baixa' | 'media' | 'alta'
export type TaskStatus = 'pendente' | 'concluida' | 'cancelada'

const ALLOWED_TYPES: TaskType[] = ['ligacao', 'whatsapp', 'reuniao', 'visita', 'follow_up', 'email', 'tarefa']
const ALLOWED_PRIORITIES: TaskPriority[] = ['baixa', 'media', 'alta']
const ALLOWED_STATUSES: TaskStatus[] = ['pendente', 'concluida', 'cancelada']

export interface CreateTaskDTO {
  title: string
  description?: string | null
  dueAt: string
  type?: TaskType
  priority?: TaskPriority
  durationMin?: number | null
  leadId?: string | null
  contactId?: string | null
  userId?: string
}

export interface UpdateTaskDTO {
  title?: string
  description?: string | null
  dueAt?: string
  type?: TaskType
  priority?: TaskPriority
  status?: TaskStatus
  durationMin?: number | null
  leadId?: string | null
  contactId?: string | null
  userId?: string
}

export interface ListTasksQuery {
  period?: 'today' | 'overdue' | '7d' | '30d' | 'month'
  status?: TaskStatus
  type?: TaskType
  priority?: TaskPriority
  leadId?: string
  scope?: 'mine' | 'all'
}

export class TasksService {
  /**
   * Lista tarefas com filtros (multi-tenant + RBAC).
   * Vendedor sempre vê só as suas (a menos que admin/gestor passe scope=all).
   */
  async list(
    companyId: string,
    userId: string,
    userRole: string,
    query: ListTasksQuery,
  ) {
    const where: any = { companyId }

    const wantsAll = query.scope === 'all'
    const isPrivileged = userRole === 'admin' || userRole === 'gestor'
    if (!isPrivileged || !wantsAll) {
      where.userId = userId
    }

    if (query.status && ALLOWED_STATUSES.includes(query.status)) {
      where.status = query.status
    }
    if (query.type && ALLOWED_TYPES.includes(query.type)) {
      where.type = query.type
    }
    if (query.priority && ALLOWED_PRIORITIES.includes(query.priority)) {
      where.priority = query.priority
    }
    if (query.leadId) {
      where.leadId = query.leadId
    }

    // Filtro de período
    const now = new Date()
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0)
    const endOfDay = new Date(now); endOfDay.setHours(23, 59, 59, 999)

    if (query.period === 'today') {
      where.dueAt = { gte: startOfDay, lte: endOfDay }
    } else if (query.period === 'overdue') {
      where.dueAt = { lt: startOfDay }
      where.status = 'pendente'
    } else if (query.period === '7d') {
      const end = new Date(now); end.setDate(end.getDate() + 7); end.setHours(23, 59, 59, 999)
      where.dueAt = { gte: startOfDay, lte: end }
    } else if (query.period === '30d') {
      const end = new Date(now); end.setDate(end.getDate() + 30); end.setHours(23, 59, 59, 999)
      where.dueAt = { gte: startOfDay, lte: end }
    } else if (query.period === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)
      where.dueAt = { gte: start, lte: end }
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { dueAt: 'asc' },
      take: 500,
    })

    return { data: tasks.map(this.shape), total: tasks.length }
  }

  async listByLead(leadId: string, companyId: string) {
    const tasks = await prisma.task.findMany({
      where: { leadId, companyId },
      orderBy: { dueAt: 'asc' },
    })
    return { data: tasks.map(this.shape), total: tasks.length }
  }

  async getById(id: string, companyId: string, userId: string, userRole: string) {
    const task = await prisma.task.findFirst({ where: { id, companyId } })
    if (!task) throw new AppError('Tarefa nao encontrada', 404, 'NOT_FOUND')
    if (userRole === 'vendedor' && task.userId !== userId) {
      throw new AppError('Voce so pode acessar suas proprias tarefas', 403, 'FORBIDDEN')
    }
    return this.shape(task)
  }

  async create(
    companyId: string,
    creatorId: string,
    data: CreateTaskDTO,
  ) {
    if (!data.title?.trim()) throw new AppError('titulo obrigatorio', 400, 'VALIDATION_ERROR')
    if (!data.dueAt) throw new AppError('data de vencimento obrigatoria', 400, 'VALIDATION_ERROR')

    const type: TaskType = data.type && ALLOWED_TYPES.includes(data.type) ? data.type : 'tarefa'
    const priority: TaskPriority = data.priority && ALLOWED_PRIORITIES.includes(data.priority) ? data.priority : 'media'

    const task = await prisma.task.create({
      data: {
        companyId,
        userId: data.userId || creatorId,
        createdById: creatorId,
        leadId: data.leadId || null,
        contactId: data.contactId || null,
        title: data.title.trim(),
        description: data.description || null,
        type,
        priority,
        status: 'pendente',
        dueAt: new Date(data.dueAt),
        durationMin: data.durationMin ?? null,
      },
    })

    return this.shape(task)
  }

  async update(
    id: string,
    companyId: string,
    userId: string,
    userRole: string,
    data: UpdateTaskDTO,
  ) {
    const existing = await prisma.task.findFirst({ where: { id, companyId } })
    if (!existing) throw new AppError('Tarefa nao encontrada', 404, 'NOT_FOUND')
    if (userRole === 'vendedor' && existing.userId !== userId) {
      throw new AppError('Voce so pode editar suas proprias tarefas', 403, 'FORBIDDEN')
    }

    const update: any = {}
    if (data.title !== undefined) update.title = String(data.title).trim()
    if (data.description !== undefined) update.description = data.description || null
    if (data.dueAt !== undefined) update.dueAt = new Date(data.dueAt)
    if (data.durationMin !== undefined) update.durationMin = data.durationMin
    if (data.type !== undefined && ALLOWED_TYPES.includes(data.type)) update.type = data.type
    if (data.priority !== undefined && ALLOWED_PRIORITIES.includes(data.priority)) update.priority = data.priority
    if (data.status !== undefined && ALLOWED_STATUSES.includes(data.status)) {
      update.status = data.status
      if (data.status === 'concluida') update.completedAt = new Date()
      if (data.status === 'pendente') update.completedAt = null
    }
    if (data.userId !== undefined) update.userId = data.userId
    if (data.leadId !== undefined) update.leadId = data.leadId || null
    if (data.contactId !== undefined) update.contactId = data.contactId || null

    const task = await prisma.task.update({ where: { id }, data: update })
    return this.shape(task)
  }

  async delete(id: string, companyId: string, userId: string, userRole: string) {
    const existing = await prisma.task.findFirst({ where: { id, companyId } })
    if (!existing) throw new AppError('Tarefa nao encontrada', 404, 'NOT_FOUND')
    if (userRole === 'vendedor' && existing.userId !== userId) {
      throw new AppError('Voce so pode excluir suas proprias tarefas', 403, 'FORBIDDEN')
    }
    await prisma.task.delete({ where: { id } })
  }

  /** Mapeia model Prisma → shape API consistente com o frontend */
  private shape(t: any) {
    return {
      id: t.id,
      companyId: t.companyId,
      userId: t.userId,
      createdById: t.createdById,
      leadId: t.leadId,
      contactId: t.contactId,
      title: t.title,
      description: t.description,
      type: t.type,
      priority: t.priority,
      status: t.status,
      dueAt: t.dueAt instanceof Date ? t.dueAt.toISOString() : t.dueAt,
      durationMin: t.durationMin,
      completedAt: t.completedAt instanceof Date ? t.completedAt.toISOString() : t.completedAt,
      createdAt: t.createdAt instanceof Date ? t.createdAt.toISOString() : t.createdAt,
      updatedAt: t.updatedAt instanceof Date ? t.updatedAt.toISOString() : t.updatedAt,
    }
  }
}
