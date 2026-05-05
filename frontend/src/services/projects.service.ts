import { api } from '../lib/api'

export interface Project {
  id: string
  title: string
  description: string
  status: 'backlog' | 'todo' | 'doing' | 'review' | 'done'
  priority: 'alta' | 'media' | 'baixa'
  tags: string[]
  assignee: string | null
  dueDate: string | null
  progress: number
  companyId: string
  createdAt: string
  updatedAt: string
}

export interface ProjectStats {
  backlog: number
  todo: number
  doing: number
  review: number
  done: number
  total: number
}

export interface ProjectsResponse {
  data: Project[]
  stats: ProjectStats
}

export interface CreateProjectRequest {
  title: string
  description?: string
  status?: string
  priority?: string
  tags?: string[]
  assignee?: string | null
  dueDate?: string | null
  progress?: number
}

export const projectsService = {
  async list(params?: Record<string, string>): Promise<ProjectsResponse> {
    const { data } = await api.get('/projects', { params })
    return data
  },

  async getById(id: string): Promise<Project> {
    const { data } = await api.get(`/projects/${id}`)
    return data
  },

  async create(payload: CreateProjectRequest): Promise<Project> {
    const { data } = await api.post('/projects', payload)
    return data
  },

  async update(id: string, payload: Partial<CreateProjectRequest>): Promise<Project> {
    const { data } = await api.put(`/projects/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/projects/${id}`)
  },
}
