import { FastifyInstance } from 'fastify'
import { InboxController } from './inbox.controller'
import { authenticate } from '../../middlewares/authenticate'

const inboxController = new InboxController()

export async function inboxRoutes(fastify: FastifyInstance) {
  // Todas as rotas requerem autenticação
  fastify.addHook('onRequest', authenticate)

  // GET /inbox
  fastify.get('/', {
    schema: {
      description: 'List conversations with optional filters',
      tags: ['inbox'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'assigned', 'resolved', 'closed'],
          },
          channelType: { type: 'string' },
        },
      },
    },
    handler: inboxController.listConversations.bind(inboxController),
  })

  // GET /inbox/:id
  fastify.get('/:id', {
    schema: {
      description: 'Get conversation by ID with related data',
      tags: ['inbox'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: inboxController.getConversation.bind(inboxController),
  })

  // GET /inbox/:id/messages
  fastify.get('/:id/messages', {
    schema: {
      description: 'List messages from a conversation',
      tags: ['inbox'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: {
          id: { type: 'string', format: 'uuid' },
        },
      },
    },
    handler: inboxController.getMessages.bind(inboxController),
  })

  // POST /inbox/:id/messages
  fastify.post('/:id/messages', {
    schema: {
      description: 'Send a message in a conversation',
      tags: ['inbox'],
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
        required: ['content'],
        properties: {
          content: { type: 'string' },
          contentType: {
            type: 'string',
            enum: ['text', 'image', 'video', 'audio', 'file'],
            default: 'text',
          },
        },
      },
    },
    handler: inboxController.sendMessage.bind(inboxController),
  })

  // PATCH /inbox/:id/status
  fastify.patch('/:id/status', {
    schema: {
      description: 'Update conversation status',
      tags: ['inbox'],
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
        required: ['status'],
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'assigned', 'resolved', 'closed'],
          },
        },
      },
    },
    handler: inboxController.updateStatus.bind(inboxController),
  })

  // POST /inbox/:id/convert-to-lead
  fastify.post('/:id/convert-to-lead', {
    schema: {
      description: 'Converte conversa em card no Kanban (escolhe funil consultor/associado)',
      tags: ['inbox'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      body: {
        type: 'object',
        required: ['funilType'],
        properties: {
          funilType: { type: 'string', enum: ['consultor', 'associado'] },
          title: { type: 'string' },
        },
      },
    },
    handler: inboxController.convertToLead.bind(inboxController),
  })

  // PATCH /inbox/:id/read
  fastify.patch('/:id/read', {
    schema: {
      description: 'Mark conversation as read',
      tags: ['inbox'],
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
    handler: inboxController.markAsRead.bind(inboxController),
  })
}
