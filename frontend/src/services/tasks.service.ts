import { api } from '../lib/api'

export type TaskType = 'ligacao' | 'whatsapp' | 'reuniao' | 'visita' | 'follow_up' | 'email' | 'tarefa'
export type TaskPriority = 'baixa' | 'media' | 'alta'
export type TaskStatus = 'pendente' | 'concluida' | 'cancelada'

export interface Task {
  id: string
  companyId: string
  userId: string
  createdById: string
  leadId: string | null
  contactId: string | null
  title: string
  description: string | null
  type: TaskType
  priority: TaskPriority
  status: TaskStatus
  dueAt: string
  durationMin: number | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ListTasksParams {
  period?: 'today' | 'overdue' | '7d' | '30d' | 'month'
  status?: TaskStatus
  type?: TaskType
  priority?: TaskPriority
  leadId?: string
  scope?: 'mine' | 'all'
}

export interface CreateTaskRequest {
  title: string
  description?: string
  dueAt: string
  type?: TaskType
  priority?: TaskPriority
  durationMin?: number
  leadId?: string
  contactId?: string
  userId?: string
}

export interface UpdateTaskRequest {
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

export const tasksService = {
  async list(params: ListTasksParams = {}): Promise<{ data: Task[]; total: number }> {
    const r = await api.get('/tasks', { params })
    return r.data
  },

  async getById(id: string): Promise<Task> {
    const r = await api.get<Task>(`/tasks/${id}`)
    return r.data
  },

  async create(data: CreateTaskRequest): Promise<Task> {
    const r = await api.post<Task>('/tasks', data)
    return r.data
  },

  async update(id: string, data: UpdateTaskRequest): Promise<Task> {
    const r = await api.patch<Task>(`/tasks/${id}`, data)
    return r.data
  },

  async complete(id: string): Promise<Task> {
    const r = await api.patch<Task>(`/tasks/${id}`, { status: 'concluida' })
    return r.data
  },

  async reopen(id: string): Promise<Task> {
    const r = await api.patch<Task>(`/tasks/${id}`, { status: 'pendente' })
    return r.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/tasks/${id}`)
  },

  async listByLead(leadId: string): Promise<{ data: Task[]; total: number }> {
    const r = await api.get(`/leads/${leadId}/tasks`)
    return r.data
  },

  async createForLead(leadId: string, data: Omit<CreateTaskRequest, 'leadId'>): Promise<Task> {
    const r = await api.post<Task>(`/leads/${leadId}/tasks`, data)
    return r.data
  },
}

// === Helpers de UI ===

export const TASK_TYPE_META: Record<TaskType, { label: string; icon: string; color: string; bg: string }> = {
  ligacao:    { label: 'Ligação',    icon: 'phone',          color: 'text-blue-400',   bg: 'bg-blue-500/10' },
  whatsapp:   { label: 'WhatsApp',   icon: 'message-circle', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  reuniao:    { label: 'Reunião',    icon: 'video',          color: 'text-purple-400',  bg: 'bg-purple-500/10' },
  visita:     { label: 'Visita',     icon: 'map-pin',        color: 'text-amber-400',   bg: 'bg-amber-500/10' },
  follow_up:  { label: 'Follow-up',  icon: 'rotate-ccw',     color: 'text-cyan-400',    bg: 'bg-cyan-500/10' },
  email:      { label: 'E-mail',     icon: 'mail',           color: 'text-pink-400',    bg: 'bg-pink-500/10' },
  tarefa:     { label: 'Tarefa',     icon: 'check-square',   color: 'text-gold-400',    bg: 'bg-gold-500/10' },
}

export const TASK_PRIORITY_META: Record<TaskPriority, { label: string; color: string; barColor: string }> = {
  baixa: { label: 'Baixa',  color: 'text-gray-400',    barColor: 'bg-gray-500' },
  media: { label: 'Média',  color: 'text-amber-400',   barColor: 'bg-amber-500' },
  alta:  { label: 'Alta',   color: 'text-red-400',     barColor: 'bg-red-500' },
}
