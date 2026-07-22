import { randomUUID } from 'node:crypto'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './rede.service'
import { sincronizar, progressoDaCarga, type ParamsSync } from './sync/sync.service'
import { TokenExpiradoError } from './clients/power.client'

interface Autenticado { id: string; companyId: string; role?: string }

/**
 * Resolve qual raiz o pedido enxerga.
 * Consultor: so a propria (a que aponta pro user_id dele). Admin: qualquer uma, via ?raiz=.
 */
async function resolverRaiz(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as Autenticado
  const { raiz } = request.query as { raiz?: string }

  if (user.role === 'admin' && raiz) {
    return { companyId: user.companyId, raizPowerId: Number(raiz), user }
  }

  const minha = await service.resolverRaizDoUsuario(user.companyId, user.id)
  if (!minha) {
    reply.status(404).send({ message: 'Voce ainda nao tem rede vinculada.' })
    return null
  }
  return { companyId: user.companyId, raizPowerId: minha.powerId, user }
}

export async function getArvore(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await resolverRaiz(request, reply)
  if (!ctx) return
  const data = await service.arvore(ctx.companyId, ctx.raizPowerId)
  if (!data) return reply.status(404).send({ message: 'Nenhuma carga publicada para esta rede ainda.' })
  return reply.send(data)
}

export async function getPlacar(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await resolverRaiz(request, reply)
  if (!ctx) return
  const { contrato = '2026-05', pagamento = '2026-06' } = request.query as { contrato?: string; pagamento?: string }
  const data = await service.placar(ctx.companyId, ctx.raizPowerId, contrato, pagamento)
  if (!data) return reply.status(404).send({ message: 'Nenhuma carga publicada para esta rede ainda.' })
  return reply.send(data)
}

export async function getPlacas(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await resolverRaiz(request, reply)
  if (!ctx) return
  const q = request.query as Record<string, string>
  const data = await service.listarPlacas(ctx.companyId, ctx.raizPowerId, {
    mesContrato: q.contrato,
    mesPagamento: q.pagamento,
    status: q.status as 'paga' | 'inadimplente' | undefined,
    cpfConsultor: q.consultor,
    nivel: q.nivel != null && q.nivel !== '' ? Number(q.nivel) : undefined,
    escopo: (q.escopo as 'proprias' | 'equipe' | 'tudo') || 'tudo',
    busca: q.busca,
  })
  return reply.send(data)
}

/**
 * Dispara a carga sem bloquear a resposta: a coleta leva ~30 min.
 * O id e gerado aqui pra poder ser devolvido na hora; o cliente acompanha por
 * GET /api/rede/sync/:id.
 */
function dispararCarga(params: ParamsSync): string {
  const cargaId = randomUUID()
  void sincronizar({ ...params, cargaId }).catch((err) => {
    console.error('[rede] carga falhou:', (err as Error).message)
  })
  return cargaId
}

export async function postSync(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as Autenticado
  if (user.role !== 'admin') return reply.status(403).send({ message: 'Apenas admin pode atualizar os dados da rede.' })

  const body = request.body as {
    raizPowerId: number; raizNome: string; raizCpf: string; mesContrato: string; mesPagamento: string
  }

  try {
    const cargaId = dispararCarga({
      companyId: user.companyId,
      disparadaPor: user.id,
      raizPowerId: Number(body.raizPowerId),
      raizNome: body.raizNome,
      raizCpf: String(body.raizCpf || '').replace(/\D/g, ''),
      mesContrato: body.mesContrato,
      mesPagamento: body.mesPagamento,
    })
    return reply.status(202).send({ cargaId })
  } catch (err) {
    if (err instanceof TokenExpiradoError) return reply.status(400).send({ message: err.message })
    throw err
  }
}

export async function getSync(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as Autenticado
  const { id } = request.params as { id: string }
  const carga = await progressoDaCarga(id, user.companyId)
  if (!carga) return reply.status(404).send({ message: 'Carga nao encontrada.' })
  return reply.send(carga)
}
