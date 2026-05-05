import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { prisma } from '../../config/database'

export async function sinistrosRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  // GET /sinistros
  fastify.get('/', async (request, reply) => {
    const { companyId } = (request as any).user
    const query = request.query as any
    const page = Math.max(1, parseInt(query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20))
    const skip = (page - 1) * limit

    const where: any = { companyId }
    if (query.status) where.status = query.status

    const [data, total] = await Promise.all([
      prisma.sinistro.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dataAbertura: 'desc' },
        include: {
          associado: { select: { id: true, nome: true } },
          veiculo: { select: { id: true, placa: true, marca: true, modelo: true } },
          oficina: { select: { id: true, nome: true } },
          responsavel: { select: { id: true, firstName: true, lastName: true } },
        },
      }),
      prisma.sinistro.count({ where }),
    ])

    return reply.send({
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  })

  // GET /sinistros/:id
  fastify.get('/:id', async (request, reply) => {
    const { companyId } = (request as any).user
    const { id } = request.params as { id: string }

    const sinistro = await prisma.sinistro.findFirst({
      where: { id, companyId },
      include: {
        associado: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
        veiculo: true,
        oficina: true,
        responsavel: { select: { id: true, firstName: true, lastName: true } },
      },
    })

    if (!sinistro) return reply.status(404).send({ message: 'Sinistro nao encontrado' })
    return reply.send(sinistro)
  })

  // POST /sinistros
  fastify.post('/', async (request, reply) => {
    const { companyId } = (request as any).user
    const body = request.body as any

    const sinistro = await prisma.sinistro.create({
      data: {
        companyId,
        associadoId: body.associadoId,
        veiculoId: body.veiculoId,
        tipo: body.tipo,
        descricao: body.descricao,
        dataOcorrencia: new Date(body.dataOcorrencia),
        localOcorrencia: body.localOcorrencia,
        boletimOcorrencia: body.boletimOcorrencia,
        status: 'aberto',
        responsavelId: body.responsavelId,
        fotos: body.fotos || [],
      },
    })

    return reply.status(201).send(sinistro)
  })

  // PUT /sinistros/:id
  fastify.put('/:id', async (request, reply) => {
    const { companyId } = (request as any).user
    const { id } = request.params as { id: string }
    const body = request.body as any

    const existing = await prisma.sinistro.findFirst({ where: { id, companyId } })
    if (!existing) return reply.status(404).send({ message: 'Sinistro nao encontrado' })

    const sinistro = await prisma.sinistro.update({
      where: { id },
      data: {
        status: body.status,
        oficinaId: body.oficinaId,
        custoEstimado: body.custoEstimado,
        custoReal: body.custoReal,
        guinchoSolicitado: body.guinchoSolicitado,
        guinchoRealizado: body.guinchoRealizado,
        responsavelId: body.responsavelId,
        fotos: body.fotos,
        dataEncerramento: body.status === 'encerrado' ? new Date() : undefined,
      },
    })

    return reply.send(sinistro)
  })

  // DELETE /sinistros/:id
  fastify.delete('/:id', async (request, reply) => {
    const { companyId } = (request as any).user
    const { id } = request.params as { id: string }

    const existing = await prisma.sinistro.findFirst({ where: { id, companyId } })
    if (!existing) return reply.status(404).send({ message: 'Sinistro nao encontrado' })

    await prisma.sinistro.delete({ where: { id } })
    return reply.send({ success: true, message: 'Sinistro removido' })
  })

  // GET /sinistros/stats
  fastify.get('/stats', async (request, reply) => {
    const { companyId } = (request as any).user
    const [total, abertos, emReparo, encerrados, custoAgg] = await Promise.all([
      prisma.sinistro.count({ where: { companyId } }),
      prisma.sinistro.count({ where: { companyId, status: 'aberto' } }),
      prisma.sinistro.count({ where: { companyId, status: 'reparo' } }),
      prisma.sinistro.count({ where: { companyId, status: 'encerrado' } }),
      prisma.sinistro.aggregate({ where: { companyId }, _sum: { custoReal: true, custoEstimado: true } }),
    ])
    const custoTotal = Number(custoAgg._sum.custoReal || 0) + Number(custoAgg._sum.custoEstimado || 0)
    return reply.send({ total, abertos, emReparo, encerrados, custoTotal })
  })
}
