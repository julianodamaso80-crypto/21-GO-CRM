import { api } from '../lib/api'
import type { LoginRequest, LoginResponse, RegisterRequest, User } from '../../../shared/types'

export const authService = {
  async login(data: LoginRequest): Promise<LoginResponse> {
    // BURLANDO LOGIN PARA TESTE NA VERCEL
    console.log('Faking login for:', data.email)
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          token: 'fake-token-test',
          refreshToken: 'fake-refresh',
          user: {
            id: 'user-admin',
            email: data.email,
            firstName: 'Juliano',
            lastName: 'Damaso (Teste)',
            companyId: 'company-21go',
            roleId: 'role-admin',
            role: {
              id: 'role-admin',
              name: 'admin',
              displayName: 'Administrador',
              level: 99
            }
          } as any
        })
      }, 500)
    })
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
