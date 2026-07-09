import { prisma } from '../../config/database'
import bcrypt from 'bcryptjs'
import { AppError } from '../../utils/app-error'

export interface RegisterDTO {
  email: string
  password: string
  firstName: string
  lastName: string
  companyName: string
}

export interface LoginDTO {
  email: string
  password: string
}

export class AuthService {
  async register(data: RegisterDTO) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    })

    if (existingUser) {
      throw AppError.conflict('Email already registered')
    }

    const hashedPassword = await bcrypt.hash(data.password, 10)

    const slug = data.companyName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const company = await prisma.company.create({
      data: {
        name: data.companyName,
        slug: `${slug}-${Date.now()}`,
        isActive: true,
      },
    })

    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: hashedPassword,
        firstName: data.firstName,
        lastName: data.lastName,
        role: 'admin',
        companyId: company.id,
        isActive: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        companyId: true,
        role: true,
        createdAt: true,
      },
    })

    return { user, company }
  }

  async login(data: LoginDTO, fastify: any) {
    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: {
        company: true,
      },
    })

    if (!user) {
      throw AppError.unauthorized('Invalid credentials')
    }

    if (!user.isActive) {
      throw AppError.forbidden('User is inactive')
    }

    const isPasswordValid = await bcrypt.compare(data.password, user.password)

    if (!isPasswordValid) {
      throw AppError.unauthorized('Invalid credentials')
    }

    if (!user.company.isActive) {
      throw AppError.forbidden('Company is inactive')
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    const payload = {
      id: user.id,
      email: user.email,
      companyId: user.companyId,
      role: user.role,
    }

    const token = fastify.jwt.sign(payload)

    const refreshToken = fastify.jwt.sign(payload, {
      expiresIn: '7d',
    })

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    const { password: _, ...userWithoutPassword } = user

    return {
      user: {
        ...userWithoutPassword,
        mustChangePassword: (user as any).mustChangePassword ?? false,
        role: {
          id: user.role,
          name: user.role,
          displayName: user.role === 'admin' ? 'Administrador' : user.role === 'gestor' ? 'Gestor' : user.role === 'vendedor' ? 'Vendedor' : 'Operacao',
          level: user.role === 'admin' ? 10 : user.role === 'gestor' ? 7 : user.role === 'vendedor' ? 5 : 3,
        },
      },
      token,
      refreshToken,
    }
  }

  async refreshToken(oldRefreshToken: string, fastify: any) {
    const refreshTokenRecord = await prisma.refreshToken.findUnique({
      where: { token: oldRefreshToken },
      include: { user: true },
    })

    if (!refreshTokenRecord) {
      throw AppError.unauthorized('Invalid refresh token')
    }

    if (refreshTokenRecord.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token expired')
    }

    await prisma.refreshToken.delete({
      where: { id: refreshTokenRecord.id },
    })

    const payload = {
      id: refreshTokenRecord.user.id,
      email: refreshTokenRecord.user.email,
      companyId: refreshTokenRecord.user.companyId,
      role: refreshTokenRecord.user.role,
    }

    const newToken = fastify.jwt.sign(payload)
    const newRefreshToken = fastify.jwt.sign(payload, {
      expiresIn: '7d',
    })

    await prisma.refreshToken.create({
      data: {
        token: newRefreshToken,
        userId: refreshTokenRecord.user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    })

    return {
      token: newToken,
      refreshToken: newRefreshToken,
    }
  }

  async logout(refreshToken: string) {
    await prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    })

    return { message: 'Logged out successfully' }
  }

  async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        phone: true,
        isActive: true,
        mustChangePassword: true,
        companyId: true,
        role: true,
        company: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true,
          },
        },
        createdAt: true,
        lastLoginAt: true,
      },
    })

    if (!user) {
      throw AppError.notFound('User not found')
    }

    const roleDisplayNames: Record<string, string> = {
      admin: 'Administrador',
      gestor: 'Gestor',
      vendedor: 'Vendedor',
      operacao: 'Operacao',
    }
    const roleLevels: Record<string, number> = {
      admin: 10,
      gestor: 7,
      vendedor: 5,
      operacao: 3,
    }

    return {
      ...user,
      timezone: 'America/Sao_Paulo',
      language: 'pt-BR',
      roleId: user.role,
      role: {
        id: user.role,
        name: user.role,
        displayName: roleDisplayNames[user.role] || user.role,
        level: roleLevels[user.role] || 1,
      },
    }
  }

  /**
   * Troca de senha do proprio usuario logado. Usado no fluxo de 1o acesso
   * (mustChangePassword) e tambem numa troca voluntaria. Zera a flag.
   */
  async changePassword(userId: string, currentPassword: string | undefined, newPassword: string) {
    if (!newPassword || newPassword.length < 6) {
      throw AppError.badRequest('A nova senha precisa ter ao menos 6 caracteres')
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw AppError.notFound('User not found')

    // Se NAO for 1o acesso, exigimos a senha atual pra confirmar identidade.
    if (!user.mustChangePassword) {
      if (!currentPassword) throw AppError.badRequest('Informe a senha atual')
      const ok = await bcrypt.compare(currentPassword, user.password)
      if (!ok) throw AppError.unauthorized('Senha atual incorreta')
    }

    const hashed = await bcrypt.hash(newPassword, 10)
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed, mustChangePassword: false },
    })

    return { message: 'Senha alterada com sucesso' }
  }
}
