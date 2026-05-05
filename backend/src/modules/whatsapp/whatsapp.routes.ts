import { FastifyInstance } from 'fastify'
import { WhatsappController } from './whatsapp.controller'
import { authenticate } from '../../middlewares/authenticate'

const controller = new WhatsappController()

export async function whatsappRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  fastify.get('/', { handler: controller.getMine.bind(controller) })
  fastify.post('/', { handler: controller.create.bind(controller) })
  fastify.get('/status', { handler: controller.status.bind(controller) })
  fastify.delete('/', { handler: controller.delete.bind(controller) })
  fastify.post('/logout', { handler: controller.logout.bind(controller) })
}
