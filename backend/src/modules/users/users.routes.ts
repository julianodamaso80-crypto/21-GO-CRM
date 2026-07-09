import { FastifyInstance } from 'fastify'
import { UsersController } from './users.controller'
import { authenticate } from '../../middlewares/authenticate'

const usersController = new UsersController()

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  fastify.get('/', { handler: usersController.list.bind(usersController) })
  // Rota estatica ANTES da param /:id — time do usuario logado (qualquer role)
  fastify.get('/my-team', { handler: usersController.myTeam.bind(usersController) })
  fastify.get('/:id', { handler: usersController.getById.bind(usersController) })
  fastify.post('/', { handler: usersController.create.bind(usersController) })
  fastify.patch('/:id', { handler: usersController.update.bind(usersController) })
  fastify.put('/:id', { handler: usersController.update.bind(usersController) })
  fastify.delete('/:id', { handler: usersController.deactivate.bind(usersController) })
}
