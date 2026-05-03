import { api } from '../lib/api'
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '../../../shared/types'

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/login', data)
    return response.data
  },

  async register(data: RegisterRequest): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/auth/register', data)
    return response.data
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout')
  },

  async me(): Promise<User> {
    const response = await api.get<User>('/auth/me')
    return response.data
  },
}
