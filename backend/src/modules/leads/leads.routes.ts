import { FastifyInstance } from 'fastify'
import { LeadsController } from './leads.controller'
import { authenticate } from '../../middlewares/authenticate'

const leadsController = new LeadsController()

export async function leadsRoutes(fastify: FastifyInstance) {
  // Todas as rotas requerem autenticação
  fastify.addHook('onRequest', authenticate)

  // GET /leads/stats - deve vir antes de /leads/:id
  fastify.get('/stats', {
    schema: {
      description: 'Get leads statistics',
      tags: ['leads'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            total: { type: 'number' },
            byStatus: {
              type: 'object',
              properties: {
                new: { type: 'number' },
                contacted: { type: 'number' },
                qualified: { type: 'number' },
                unqualified: { type: 'number' },
              },
            },
            bySource: { type: 'object' },
            conversionRate: { type: 'number' },
            totalEstimatedValue: { type: 'number' },
          },
        },
      },
    },
    handler: leadsController.getStats.bind(leadsController),
  })

  // GET /leads
  fastify.get('/', {
    schema: {
      description: 'List leads with pagination and filters',
      tags: ['leads'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'number', minimum: 1 },
          limit: { type: 'number', minimum: 1, maximum: 100 },
          search: { type: 'string' },
          status: { type: 'string' },
          source: { type: 'string' },
          sortBy: { type: 'string' },
          sortOrder: {
            type: 'string',
            enum: ['asc', 'desc'],
          },
        },
      },
    },
    handler: leadsController.list.bind(leadsController),
  })

  // GET /leads/:id
  fastify.get('/:id', {
    schema: {
      description: 'Get lead by ID with related data',
      tags: ['leads'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: leadsController.getById.bind(leadsController),
  })

  // POST /leads
  fastify.post('/', {
    schema: {
      description: 'Create a new lead',
      tags: ['leads'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['contactId', 'title', 'source'],
        properties: {
          contactId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          source: { type: 'string' },
          medium: { type: 'string' },
          campaign: { type: 'string' },
          assignedToId: { type: 'string', format: 'uuid' },
          estimatedValue: { type: 'number' },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    handler: leadsController.create.bind(leadsController),
  })

  // PUT /leads/:id
  fastify.put('/:id', {
    schema: {
      description: 'Update an existing lead',
      tags: ['leads'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      body: {
        type: 'object',
        properties: {
          contactId: { type: 'string', format: 'uuid' },
          title: { type: 'string' },
          description: { type: 'string' },
          source: { type: 'string' },
          medium: { type: 'string' },
          campaign: { type: 'string' },
          assignedToId: { type: 'string', format: 'uuid' },
          estimatedValue: { type: 'number' },
          status: { type: 'string' },
          score: { type: 'number' },
          valorCompra: { type: 'number' },
          produtoComprado: { type: 'string' },
          etapaFunil: { type: 'string' },
          tags: {
            type: 'array',
            items: { type: 'string' },
          },
        },
      },
    },
    handler: leadsController.update.bind(leadsController),
  })

  // DELETE /leads/:id
  fastify.delete('/:id', {
    schema: {
      description: 'Delete a lead',
      tags: ['leads'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' },
          },
        },
      },
    },
    handler: leadsController.delete.bind(leadsController),
  })
}
