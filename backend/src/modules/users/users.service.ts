import bcrypt from 'bcryptjs'
import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'

export const VALID_ROLES = ['admin', 'gestor', 'vendedor', 'operacao'] as const
export type Role = typeof VALID_ROLES[number]

export interface CreateUserDTO {
  email: string
  password?: string | null
  firstName: string
  lastName: string
  phone?: string | null
  role: Role
}

/**
 * Gera senha temporaria legivel (sem caracteres ambiguos como 0/O, 1/l/I).
 * Formato: 21go-XXXX9 — facil de ditar por WhatsApp, forte o bastante pra 1o acesso.
 */
function genTempPassword(): string {
  const letters = 'abcdefghjkmnpqrstuvwxyz'
  const digits = '23456789'
  let core = ''
  for (let i = 0; i < 4; i++) core += letters[Math.floor(Math.random() * letters.length)]
  for (let i = 0; i < 2; i++) core += digits[Math.floor(Math.random() * digits.length)]
  return `21go-${core}`
}

export interface UpdateUserDTO {
  firstName?: string
  lastName?: string
  phone?: string | null
  role?: Role
  isActive?: boolean
  password?: string
}

/**
 * Shape pro endpoint /api/users — retorna role como string ('admin' | 'gestor' | etc),
 * NÃO como objeto. Frontend (TeamPage) faz comparações tipo m.role === 'admin' e usa
 * role como key em counts/filters. Não confundir com shape do /auth/me que retorna objeto.
 */
function shape(u: any) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.firstName,
    lastName: u.lastName,
    phone: u.phone,
    avatar: u.avatar,
    role: (u.role as Role) || 'vendedor',
    isActive: u.isActive,
    mustChangePassword: u.mustChangePassword ?? false,
    companyId: u.companyId,
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

  /**
   * Time direto de um usuario (para a tela "Meu Time" do vendedor/gestor).
   * Retorna os users cujo managerId aponta pra ele, na mesma company.
   * Acessivel por qualquer usuario autenticado (ve apenas o proprio time).
   */
  async listMyTeam(managerId: string, companyId: string) {
    const users = await prisma.user.findMany({
      where: { managerId, companyId },
      orderBy: [{ isActive: 'desc' }, { firstName: 'asc' }],
    })
    return { data: users.map(shape), total: users.length }
  }

  /**
   * Downline MULTINIVEL do usuario logado (Meu Time): percorre a arvore inteira
   * (nivel 1 = diretos, 2 = diretos dos diretos, ...) via CTE recursiva e calcula
   * o nivel relativo de cada pessoa. Cap de profundidade p/ seguranca anti-ciclo.
   */
  async listMyTeamTree(managerId: string, companyId: string) {
    const rows: any[] = await prisma.$queryRaw`
      WITH RECURSIVE dl AS (
        SELECT id, email, first_name, last_name, phone, avatar, role, is_active,
               manager_id, last_login_at, 1 AS level
        FROM users
        WHERE manager_id = ${managerId} AND company_id = ${companyId}
        UNION ALL
        SELECT u.id, u.email, u.first_name, u.last_name, u.phone, u.avatar, u.role, u.is_active,
               u.manager_id, u.last_login_at, dl.level + 1
        FROM users u
        INNER JOIN dl ON u.manager_id = dl.id
        WHERE u.company_id = ${companyId} AND dl.level < 25
      )
      SELECT * FROM dl ORDER BY level ASC, first_name ASC
    `
    const data = rows.map((u) => ({
      id: u.id,
      email: u.email,
      firstName: u.first_name,
      lastName: u.last_name,
      phone: u.phone,
      avatar: u.avatar,
      role: (u.role as Role) || 'vendedor',
      isActive: u.is_active,
      managerId: u.manager_id,
      lastLoginAt: u.last_login_at,
      level: Number(u.level),
    }))
    const byLevel: Record<number, number> = {}
    for (const p of data) byLevel[p.level] = (byLevel[p.level] || 0) + 1
    const maxLevel = data.reduce((m, p) => Math.max(m, p.level), 0)
    return { data, total: data.length, byLevel, maxLevel }
  }

  async getById(id: string, companyId: string) {
    const user = await prisma.user.findFirst({ where: { id, companyId } })
    if (!user) throw new AppError('Usuario nao encontrado', 404, 'NOT_FOUND')
    return shape(user)
  }

  async create(companyId: string, data: CreateUserDTO) {
    const email = String(data.email || '').toLowerCase().trim()
    const firstName = String(data.firstName || '').trim()
    const lastName = String(data.lastName || '').trim()
    const phone = data.phone ? String(data.phone).trim() : null
    const role = data.role

    // Senha: se o admin nao informar, geramos uma temporaria e forcamos troca no 1o login.
    const provided = String(data.password || '').trim()
    const isTemp = provided.length === 0
    const password = isTemp ? genTempPassword() : provided

    if (!email || !email.includes('@')) throw new AppError('Email invalido', 400, 'VALIDATION_ERROR')
    if (!isTemp && password.length < 6) throw new AppError('Senha precisa ter ao menos 6 caracteres', 400, 'VALIDATION_ERROR')
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
        // Sempre forca troca no 1o acesso: quem cria o acesso e o admin, nunca o proprio dono.
        mustChangePassword: true,
        companyId,
      },
    })
    // tempPassword so vai na resposta da criacao (nunca fica salvo em claro).
    // Se o admin definiu a senha manualmente, ela tambem volta pra ele copiar/enviar.
    return { ...shape(user), tempPassword: password }
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
    let resetPassword: string | null = null
    if (data.password) {
      if (String(data.password).length < 6) throw new AppError('Senha precisa ter ao menos 6 caracteres', 400, 'VALIDATION_ERROR')
      resetPassword = String(data.password)
      update.password = await bcrypt.hash(resetPassword, 10)
      // Admin redefiniu a senha de alguem: forca troca no proximo login desse usuario.
      if (user.id !== currentUserId) update.mustChangePassword = true
    }

    const updated = await prisma.user.update({ where: { id }, data: update })
    const out = shape(updated)
    return resetPassword ? { ...out, tempPassword: resetPassword } : out
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
