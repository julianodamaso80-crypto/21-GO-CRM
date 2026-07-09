import { FastifyRequest, FastifyReply } from 'fastify'
import { AuthService, LoginDTO, RegisterDTO } from './auth.service'
import { z } from 'zod'

const authService = new AuthService()

// Schemas de validação
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  companyName: z.string().min(2),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
})

const refreshTokenSchema = z.object({
  refreshToken: z.string(),
})

const changePasswordSchema = z.object({
  currentPassword: z.string().optional(),
  newPassword: z.string().min(6),
})

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const data = registerSchema.parse(request.body) as RegisterDTO

    const result = await authService.register(data)

    return reply.code(201).send({
      message: 'User registered successfully',
      user: result.user,
      company: result.company,
    })
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const data = loginSchema.parse(request.body) as LoginDTO

    const result = await authService.login(data, request.server)

    return reply.send(result)
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshTokenSchema.parse(request.body)

    const result = await authService.refreshToken(refreshToken, request.server)

    return reply.send(result)
  }

  async logout(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = refreshTokenSchema.parse(request.body)

    const result = await authService.logout(refreshToken)

    return reply.send(result)
  }

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await authService.me(request.user.id)

    return reply.send(user)
  }

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const { currentPassword, newPassword } = changePasswordSchema.parse(request.body)

    const result = await authService.changePassword(request.user.id, currentPassword, newPassword)

    return reply.send(result)
  }
}
