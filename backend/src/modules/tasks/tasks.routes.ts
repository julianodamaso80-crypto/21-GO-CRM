import { FastifyInstance } from 'fastify'
import { TasksController } from './tasks.controller'
import { authenticate } from '../../middlewares/authenticate'

const tasksController = new TasksController()

export async function tasksRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  fastify.get('/', {
    schema: {
      description: 'Lista tarefas com filtros (period, status, type, priority, leadId, scope)',
      tags: ['tasks'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          period: { type: 'string', enum: ['today', 'overdue', '7d', '30d', 'month'] },
          status: { type: 'string', enum: ['pendente', 'concluida', 'cancelada'] },
          type: { type: 'string', enum: ['ligacao', 'whatsapp', 'reuniao', 'visita', 'follow_up', 'email', 'tarefa'] },
          priority: { type: 'string', enum: ['baixa', 'media', 'alta'] },
          leadId: { type: 'string' },
          scope: { type: 'string', enum: ['mine', 'all'] },
        },
      },
    },
    handler: tasksController.list.bind(tasksController),
  })

  fastify.get('/:id', {
    schema: {
      description: 'Busca tarefa por ID',
      tags: ['tasks'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    handler: tasksController.getById.bind(tasksController),
  })

  fastify.post('/', {
    schema: {
      description: 'Cria nova tarefa',
      tags: ['tasks'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title', 'dueAt'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', nullable: true },
          observacao: { type: 'string', nullable: true },
          dueAt: { type: 'string', format: 'date-time' },
          type: { type: 'string', enum: ['ligacao', 'whatsapp', 'reuniao', 'visita', 'follow_up', 'email', 'tarefa'] },
          priority: { type: 'string', enum: ['baixa', 'media', 'alta'] },
          durationMin: { type: 'integer', nullable: true },
          leadId: { type: 'string', nullable: true },
          contactId: { type: 'string', nullable: true },
          userId: { type: 'string' },
        },
      },
    },
    handler: tasksController.create.bind(tasksController),
  })

  fastify.patch('/:id', {
    schema: {
      description: 'Atualiza tarefa (parcial)',
      tags: ['tasks'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    handler: tasksController.update.bind(tasksController),
  })

  // PUT alias pra compatibilidade de PATCH
  fastify.put('/:id', { handler: tasksController.update.bind(tasksController) })

  fastify.delete('/:id', {
    schema: {
      description: 'Exclui tarefa',
      tags: ['tasks'],
      security: [{ bearerAuth: [] }],
      params: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    },
    handler: tasksController.delete.bind(tasksController),
  })
}

/** Sub-rotas montadas dentro de /api/leads — atalho pra task vinculada a lead */
export async function leadTasksRoutes(fastify: FastifyInstance) {
  fastify.addHook('onRequest', authenticate)

  fastify.get('/:leadId/tasks', {
    handler: tasksController.listByLead.bind(tasksController),
  })

  fastify.post('/:leadId/tasks', {
    handler: tasksController.createForLead.bind(tasksController),
  })
}
