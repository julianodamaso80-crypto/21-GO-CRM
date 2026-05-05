import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { prisma } from '../../config/database'

export async function indicacoesRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  // GET /indicacoes
  fastify.get('/', async (request, reply) => {
    const { companyId } = (request as any).user
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))
    const skip = (page - 1) * limit

    const where: any = { companyId }
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      prisma.indicacao.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataIndicacao: 'desc' },
        include: {
          indicador: { select: { id: true, nome: true } },
          lead: { select: { id: true, nome: true, etapaFunil: true } },
          associadoResultante: { select: { id: true, nome: true } },
        },
      }),
      prisma.indicacao.count({ where }),
    ])

    return reply.send({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  })

  // POST /indicacoes
  fastify.post('/', async (request, reply) => {
    const { companyId } = (request as any).user
    const body = request.body as any

    const indicacao = await prisma.indicacao.create({
      data: {
        companyId,
        indicadorId: body.indicadorId,
        indicadoNome: body.indicadoNome,
        indicadoTelefone: body.indicadoTelefone,
        indicadoEmail: body.indicadoEmail,
        status: 'pendente',
      },
    })

    return reply.status(201).send(indicacao)
  })

  // PUT /indicacoes/:id
  fastify.put('/:id', async (request, reply) => {
    const { companyId } = (request as any).user
    const { id } = request.params as { id: string }
    const body = request.body as any

    const existing = await prisma.indicacao.findFirst({ where: { id, companyId } })
    if (!existing) return reply.status(404).send({ message: 'Indicacao nao encontrada' })

    const updateData: any = {}
    if (body.status) updateData.status = body.status
    if (body.leadId) updateData.leadId = body.leadId
    if (body.associadoResultanteId) updateData.associadoResultanteId = body.associadoResultanteId
    if (body.descontoAplicado !== undefined) updateData.descontoAplicado = body.descontoAplicado
    if (body.status === 'convertido') updateData.dataConversao = new Date()

    const indicacao = await prisma.indicacao.update({
      where: { id },
      data: updateData,
    })

    // Se converteu, incrementa totalIndicacoes do indicador
    if (body.status === 'convertido' && existing.status !== 'convertido') {
      await prisma.associado.update({
        where: { id: existing.indicadorId },
        data: {
          totalIndicacoes: { increment: 1 },
          descontoMgm: { increment: 10 }, // +10% por indicacao
        },
      })
    }

    return reply.send(indicacao)
  })

  // GET /indicacoes/stats
  fastify.get('/stats', async (request, reply) => {
    const { companyId } = (request as any).user

    const [total, pendentes, convertidos] = await Promise.all([
      prisma.indicacao.count({ where: { companyId } }),
      prisma.indicacao.count({ where: { companyId, status: 'pendente' } }),
      prisma.indicacao.count({ where: { companyId, status: 'convertido' } }),
    ])

    const conversionRate = total > 0 ? Math.round((convertidos / total) * 100) : 0

    // Frontend usa convertidas (feminino) + taxaConversao; mantem aliases pra back-compat
    return reply.send({
      total,
      pendentes,
      convertidos,
      convertidas: convertidos,
      conversionRate,
      taxaConversao: conversionRate,
    })
  })
}
