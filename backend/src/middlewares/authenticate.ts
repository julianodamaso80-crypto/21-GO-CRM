import { FastifyRequest, FastifyReply } from 'fastify'
import { AppError } from '../utils/app-error'

export async function authenticate(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  // Skip OPTIONS preflight - browsers nao enviam Authorization header em preflight CORS
  if (request.method === 'OPTIONS') return

  try {
    await request.jwtVerify()

    if (!request.user) {
      throw AppError.unauthorized('Invalid token payload')
    }

    const { id, email, companyId, role } = request.user as any

    if (!id || !email || !companyId || !role) {
      throw AppError.unauthorized('Invalid token payload structure')
    }

    // Compatibilidade: manter roleId para codigo legado
    ;(request.user as any).roleId = role
  } catch (error) {
    throw AppError.unauthorized('Authentication failed')
  }
}
