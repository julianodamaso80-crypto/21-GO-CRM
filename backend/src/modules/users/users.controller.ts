import { FastifyRequest, FastifyReply } from 'fastify'
import { UsersService, type CreateUserDTO, type UpdateUserDTO } from './users.service'
import { AppError } from '../../utils/app-error'

const usersService = new UsersService()

function requireAdmin(request: FastifyRequest) {
  const user = (request as any).user
  if (user?.role !== 'admin') {
    throw new AppError('Acesso restrito a administradores', 403, 'FORBIDDEN')
  }
  return user
}

export class UsersController {
  /** GET /users (admin only) */
  async list(request: FastifyRequest, reply: FastifyReply) {
    const user = requireAdmin(request)
    const result = await usersService.list(user.companyId)
    return reply.send(result)
  }

  /** GET /users/my-team — time direto do usuario logado (qualquer role autenticado) */
  async myTeam(request: FastifyRequest, reply: FastifyReply) {
    const user = (request as any).user
    const result = await usersService.listMyTeam(user.id, user.companyId)
    return reply.send(result)
  }

  /** GET /users/:id (admin only) */
  async getById(request: FastifyRequest, reply: FastifyReply) {
    const user = requireAdmin(request)
    const { id } = request.params as { id: string }
    const data = await usersService.getById(id, user.companyId)
    return reply.send(data)
  }

  /** POST /users (admin only) */
  async create(request: FastifyRequest, reply: FastifyReply) {
    const user = requireAdmin(request)
    const data = await usersService.create(user.companyId, request.body as CreateUserDTO)
    return reply.status(201).send(data)
  }

  /** PATCH /users/:id (admin only) */
  async update(request: FastifyRequest, reply: FastifyReply) {
    const user = requireAdmin(request)
    const { id } = request.params as { id: string }
    const data = await usersService.update(id, user.companyId, user.id, request.body as UpdateUserDTO)
    return reply.send(data)
  }

  /** DELETE /users/:id (admin only — soft delete) */
  async deactivate(request: FastifyRequest, reply: FastifyReply) {
    const user = requireAdmin(request)
    const { id } = request.params as { id: string }
    const result = await usersService.deactivate(id, user.companyId, user.id)
    return reply.send(result)
  }
}
