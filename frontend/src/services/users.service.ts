import { api } from '../lib/api'

export type TeamRole = 'admin' | 'gestor' | 'vendedor' | 'operacao'

export interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
  phone: string | null
  avatar: string | null
  role: TeamRole
  isActive: boolean
  companyId: string
  createdAt: string
  updatedAt: string
  lastLoginAt: string | null
}

export interface CreateTeamMemberRequest {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string
  role: TeamRole
}

export interface UpdateTeamMemberRequest {
  firstName?: string
  lastName?: string
  phone?: string | null
  role?: TeamRole
  isActive?: boolean
  password?: string
}

export const usersService = {
  async list(): Promise<{ data: TeamMember[]; total: number }> {
    const response = await api.get('/users')
    return response.data
  },

  async create(data: CreateTeamMemberRequest): Promise<TeamMember> {
    const response = await api.post('/users', data)
    return response.data
  },

  async update(id: string, data: UpdateTeamMemberRequest): Promise<TeamMember> {
    const response = await api.patch(`/users/${id}`, data)
    return response.data
  },

  async deactivate(id: string): Promise<void> {
    await api.delete(`/users/${id}`)
  },
}
