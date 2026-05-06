import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { prisma } from '../../config/database'

/**
 * Busca global em leads, associados e veículos.
 * Match em nome, telefone, whatsapp, email, placa, marca, modelo.
 */
export async function searchRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  fastify.get('/', async (request, reply) => {
    const user = (request as any).user
    const companyId = user.companyId
    const q = String((request.query as any)?.q || '').trim()

    if (q.length < 2) {
      return reply.send({ leads: [], associados: [], vehicles: [] })
    }

    const term = q.toLowerCase()
    const onlyDigits = q.replace(/\D/g, '')
    const limit = 8

    const [leads, associados, vehicles] = await Promise.all([
      prisma.lead.findMany({
        where: {
          companyId,
          OR: [
            { nome: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            ...(onlyDigits.length >= 4 ? [
              { telefone: { contains: onlyDigits } },
              { whatsapp: { contains: onlyDigits } },
            ] : []),
            { placaInteresse: { contains: term, mode: 'insensitive' } },
            { marcaInteresse: { contains: term, mode: 'insensitive' } },
            { modeloInteresse: { contains: term, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true, nome: true, telefone: true, whatsapp: true, email: true,
          marcaInteresse: true, modeloInteresse: true, placaInteresse: true,
          origem: true, etapaFunil: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.associado.findMany({
        where: {
          companyId,
          OR: [
            { nome: { contains: term, mode: 'insensitive' } },
            { email: { contains: term, mode: 'insensitive' } },
            ...(onlyDigits.length >= 4 ? [
              { telefone: { contains: onlyDigits } },
              { whatsapp: { contains: onlyDigits } },
              { cpf: { contains: onlyDigits } },
            ] : []),
          ],
        },
        select: {
          id: true, nome: true, cpf: true, telefone: true, whatsapp: true,
          email: true, status: true,
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      prisma.vehicle.findMany({
        where: {
          companyId,
          OR: [
            { placa: { contains: term, mode: 'insensitive' } },
            { marca: { contains: term, mode: 'insensitive' } },
            { modelo: { contains: term, mode: 'insensitive' } },
            { chassi: { contains: term, mode: 'insensitive' } },
          ],
        },
        include: {
          associado: { select: { id: true, nome: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
    ])

    return reply.send({ leads, associados, vehicles })
  })
}
