import { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { prisma } from '../../config/database'

export async function projectsRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  // GET /projects — retorna {data:[...], stats:{backlog,em_andamento,em_revisao,concluido}}
  // (frontend usa data?.data e data?.stats)
  fastify.get('/', async (request, reply) => {
    const { companyId } = (request as any).user
    const query = request.query as any

    const where: any = { companyId }
    if (query.status) where.status = query.status

    const projetos = await prisma.projeto.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    const stats = {
      backlog: projetos.filter(p => p.status === 'backlog').length,
      em_andamento: projetos.filter(p => p.status === 'em_andamento').length,
      em_revisao: projetos.filter(p => p.status === 'em_revisao').length,
      concluido: projetos.filter(p => p.status === 'concluido').length,
      total: projetos.length,
    }

    return reply.send({ data: projetos, stats })
  })

  // GET /projects/:id
  fastify.get('/:id', async (request, reply) => {
    const { companyId } = (request as any).user
    const { id } = request.params as { id: string }

    const projeto = await prisma.projeto.findFirst({ where: { id, companyId } })
    if (!projeto) return reply.status(404).send({ message: 'Projeto nao encontrado' })
    return reply.send(projeto)
  })

  // POST /projects
  fastify.post('/', async (request, reply) => {
    const { companyId } = (request as any).user
    const body = request.body as any

    const projeto = await prisma.projeto.create({
      data: {
        companyId,
        titulo: body.titulo || body.title,
        descricao: body.descricao || body.description,
        status: body.status || 'backlog',
        prioridade: body.prioridade || 'media',
        tags: body.tags || [],
        responsavel: body.responsavel,
        dataEntrega: body.dataEntrega ? new Date(body.dataEntrega) : undefined,
        progresso: body.progresso || 0,
      },
    })

    return reply.status(201).send(projeto)
  })

  // PUT /projects/:id
  fastify.put('/:id', async (request, reply) => {
    const { companyId } = (request as any).user
    const { id } = request.params as { id: string }
    const body = request.body as any

    const existing = await prisma.projeto.findFirst({ where: { id, companyId } })
    if (!existing) return reply.status(404).send({ message: 'Projeto nao encontrado' })

    const projeto = await prisma.projeto.update({
      where: { id },
      data: {
        titulo: body.titulo || body.title,
        descricao: body.descricao || body.description,
        status: body.status,
        prioridade: body.prioridade,
        tags: body.tags,
        responsavel: body.responsavel,
        dataEntrega: body.dataEntrega ? new Date(body.dataEntrega) : undefined,
        progresso: body.progresso,
      },
    })

    return reply.send(projeto)
  })

  // DELETE /projects/:id
  fastify.delete('/:id', async (request, reply) => {
    const { companyId } = (request as any).user
    const { id } = request.params as { id: string }

    const existing = await prisma.projeto.findFirst({ where: { id, companyId } })
    if (!existing) return reply.status(404).send({ message: 'Projeto nao encontrado' })

    await prisma.projeto.delete({ where: { id } })
    return reply.send({ success: true, message: 'Projeto removido' })
  })
}
