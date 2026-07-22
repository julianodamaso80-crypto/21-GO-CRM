import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { getArvore, getPlacar, getPlacas, postSync, getSync } from './rede.controller'

export async function redeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/arvore', getArvore)
  fastify.get('/placar', getPlacar)
  fastify.get('/placas', getPlacas)
  fastify.post('/sync', postSync)
  fastify.get('/sync/:id', getSync)
}
