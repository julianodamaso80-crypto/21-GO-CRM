import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'

export const VALID_ROLES = ['admin', 'gestor', 'vendedor', 'operacao'] as const
export type Role = typeof VALID_ROLES[number]

export interface CreateUserDTO {
  email: string
  password: string
  firstName: string
  lastName: string
  phone?: string | null
  role: Role
}

export interface UpdateUserDTO {
  firstName?: string
  lastName?: string
  phone?: string | null
  role?: Role
  isActive?: boolean
  password?: string
}

const ROLE_DISPLAY: Record<Role, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  operacao: 'Operacao',
}
const ROLE_LEVEL: Record<Role, number> = { admin: 10, gestor: 7, vendedor: 5, operacao: 3 }

function shape(u: any) {
  const role = (u.role as Role) || 'vendedor'
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    avatar: u.avatar,
    isActive: u.isActive,
    companyId: u.companyId,
    roleId: role,
    role: { id: role, name: role, displayName: ROLE_DISPLAY[role] || role, level: ROLE_LEVEL[role] || 1 },
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt,
  }
}

export class UsersService {
  async list(companyId: string) {
    const users = await prisma.user.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    })
    return { data: users.map(shape), total: users.length }
  }

  async getById(id: string, companyId: string) {
    const user = await prisma.user.findFirst({ where: { id, companyId } })
    if (!user) throw new AppError('Usuario nao encontrado', 404, 'NOT_FOUND')
    return shape(user)
  }

  async create(companyId: string, data: CreateUserDTO) {
    const email = String(data.email || '').toLowerCase().trim()
    const password = String(data.password || '')
    const firstName = String(data.firstName || '').trim()
    const lastName = String(data.lastName || '').trim()
    const phone = data.phone ? String(data.phone).trim() : null
    const role = data.role

    if (!email || !email.includes('@')) throw new AppError('Email invalido', 400, 'VALIDATION_ERROR')
    if (!password || password.length < 6) throw new AppError('Senha precisa ter ao menos 6 caracteres', 400, 'VALIDATION_ERROR')
    if (!firstName || !lastName) throw new AppError('Nome e sobrenome sao obrigatorios', 400, 'VALIDATION_ERROR')
    if (!VALID_ROLES.includes(role)) throw new AppError('Role invalido', 400, 'VALIDATION_ERROR')

    const existing = await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } })
    if (existing) throw new AppError('Email ja cadastrado', 409, 'CONFLICT')

    const hashed = await bcrypt.hash(password, 10)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        firstName,
        lastName,
        phone,
        role,
        isActive: true,
        companyId,
      },
    })
    return shape(user)
  }

  async update(id: string, companyId: string, currentUserId: string, data: UpdateUserDTO) {
    const user = await prisma.user.findFirst({ where: { id, companyId } })
    if (!user) throw new AppError('Usuario nao encontrado', 404, 'NOT_FOUND')

    const update: any = {}
    if (data.firstName !== undefined) update.firstName = String(data.firstName).trim()
    if (data.lastName !== undefined) update.lastName = String(data.lastName).trim()
    if (data.phone !== undefined) update.phone = data.phone ? String(data.phone).trim() : null
    if (data.role !== undefined) {
      if (!VALID_ROLES.includes(data.role)) throw new AppError('Role invalido', 400, 'VALIDATION_ERROR')
      if (user.id === currentUserId && data.role !== 'admin') {
        throw new AppError('Voce nao pode remover o proprio acesso de admin', 400, 'FORBIDDEN')
      }
      update.role = data.role
    }
    if (data.isActive !== undefined) {
      if (user.id === currentUserId && data.isActive === false) {
        throw new AppError('Voce nao pode desativar a si mesmo', 400, 'FORBIDDEN')
      }
      update.isActive = !!data.isActive
    }
    if (data.password) {
      if (String(data.password).length < 6) throw new AppError('Senha precisa ter ao menos 6 caracteres', 400, 'VALIDATION_ERROR')
      update.password = await bcrypt.hash(String(data.password), 10)
    }

    const updated = await prisma.user.update({ where: { id }, data: update })
    return shape(updated)
  }

  /** Soft delete: is_active = false */
  async deactivate(id: string, companyId: string, currentUserId: string) {
    const user = await prisma.user.findFirst({ where: { id, companyId } })
    if (!user) throw new AppError('Usuario nao encontrado', 404, 'NOT_FOUND')
    if (user.id === currentUserId) throw new AppError('Voce nao pode desativar a si mesmo', 400, 'FORBIDDEN')

    await prisma.user.update({ where: { id }, data: { isActive: false } })
    return { message: 'Usuario desativado' }
  }
}
