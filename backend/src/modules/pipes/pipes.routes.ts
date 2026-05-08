import { FastifyInstance } from 'fastify'
import { PipesController } from './pipes.controller'
import { authenticate } from '../../middlewares/authenticate'

const pipesController = new PipesController()

export async function pipesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('onRequest', authenticate)

  // === Pipes ===
  fastify.get('/', {
    schema: { description: 'Listar pipes da empresa', tags: ['Pipes'], security: [{ bearerAuth: [] }] },
    handler: pipesController.listPipes.bind(pipesController),
  })

  fastify.get('/:pipeId', {
    schema: { description: 'Detalhes do pipe com fases e campos', tags: ['Pipes'], security: [{ bearerAuth: [] }] },
    handler: pipesController.getPipe.bind(pipesController),
  })

  fastify.post('/', {
    schema: {
      description: 'Criar pipe manualmente',
      tags: ['Pipes'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          icon: { type: 'string' },
          color: { type: 'string' },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handler: pipesController.createPipe.bind(pipesController),
  })

  fastify.post('/from-suggest', {
    schema: {
      description: 'Criar pipe a partir de sugestao da IA',
      tags: ['Pipes'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['pipeName', 'phases'],
        properties: {
          pipeName: { type: 'string', minLength: 1 },
          pipeDescription: { type: 'string' },
          phases: {
            type: 'array',
            minItems: 2,
            items: {
              type: 'object',
              required: ['name'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                color: { type: 'string' },
                order: { type: 'number' },
                probability: { type: 'number' },
                isWon: { type: 'boolean' },
                isLost: { type: 'boolean' },
              },
            },
          },
          fields: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'label', 'type'],
              properties: {
                name: { type: 'string' },
                label: { type: 'string' },
                type: { type: 'string' },
                required: { type: 'boolean' },
                options: { type: 'array', items: { type: 'string' } },
                description: { type: 'string' },
              },
            },
          },
          tags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
    handler: pipesController.createPipeFromSuggest.bind(pipesController),
  })

  fastify.delete('/:pipeId', {
    schema: { description: 'Arquivar pipe', tags: ['Pipes'], security: [{ bearerAuth: [] }] },
    handler: pipesController.deletePipe.bind(pipesController),
  })

  // === Phases ===
  fastify.post('/:pipeId/phases', {
    schema: {
      description: 'Criar fase no pipe',
      tags: ['Pipes'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          color: { type: 'string' },
          position: { type: 'number' },
          probability: { type: 'number' },
          isWon: { type: 'boolean' },
          isLost: { type: 'boolean' },
        },
      },
    },
    handler: pipesController.createPhase.bind(pipesController),
  })

  // === Field Definitions ===
  fastify.post('/:pipeId/fields', {
    schema: {
      description: 'Criar campo no pipe',
      tags: ['Pipes'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name', 'label', 'type'],
        properties: {
          name: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
          required: { type: 'boolean' },
          position: { type: 'number' },
          configJson: { type: 'object' },
        },
      },
    },
    handler: pipesController.createFieldDefinition.bind(pipesController),
  })

  // === Cards ===
  fastify.get('/:pipeId/cards', {
    schema: { description: 'Listar cards do pipe', tags: ['Cards'], security: [{ bearerAuth: [] }] },
    handler: pipesController.listCards.bind(pipesController),
  })

  fastify.get('/:pipeId/kanban', {
    schema: { description: 'Dados do kanban (fases com cards)', tags: ['Cards'], security: [{ bearerAuth: [] }] },
    handler: pipesController.getKanbanData.bind(pipesController),
  })

  fastify.post('/:pipeId/cards', {
    schema: {
      description: 'Criar card no pipe',
      tags: ['Cards'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string' },
          assignedToId: { type: 'string' },
          dueDate: { type: 'string' },
          fieldValues: {
            type: 'array',
            items: {
              type: 'object',
              required: ['fieldDefinitionId', 'value'],
              properties: {
                fieldDefinitionId: { type: 'string' },
                value: {},
              },
            },
          },
        },
      },
    },
    handler: pipesController.createCard.bind(pipesController),
  })

  // === Card Operations (by cardId) ===
  fastify.get('/cards/:cardId', {
    schema: { description: 'Detalhes do card', tags: ['Cards'], security: [{ bearerAuth: [] }] },
    handler: pipesController.getCard.bind(pipesController),
  })

  fastify.patch('/cards/:cardId', {
    schema: {
      description: 'Atualizar dados básicos do card (titulo, descricao, responsavel, due, status)',
      tags: ['Cards'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          title: { type: 'string', minLength: 1 },
          description: { type: 'string', nullable: true },
          assignedToId: { type: 'string', nullable: true },
          dueDate: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'archived', 'done'] },
        },
      },
    },
    handler: pipesController.updateCard.bind(pipesController),
  })

  fastify.delete('/cards/:cardId', {
    schema: { description: 'Arquivar card', tags: ['Cards'], security: [{ bearerAuth: [] }] },
    handler: pipesController.deleteCard.bind(pipesController),
  })

  fastify.patch('/cards/:cardId/move', {
    schema: {
      description: 'Mover card para outra fase',
      tags: ['Cards'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['phaseId'],
        properties: { phaseId: { type: 'string' } },
      },
    },
    handler: pipesController.moveCard.bind(pipesController),
  })

  fastify.patch('/cards/:cardId/transfer', {
    schema: {
      description: 'Transferir card pra outro funil (vai pra primeira fase do destino, ou fase especifica)',
      tags: ['Cards'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['targetPipeId'],
        properties: {
          targetPipeId: { type: 'string' },
          targetPhaseId: { type: 'string' },
        },
      },
    },
    handler: pipesController.transferCard.bind(pipesController),
  })

  fastify.patch('/cards/:cardId/fields', {
    schema: {
      description: 'Atualizar campos do card',
      tags: ['Cards'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fields'],
        properties: {
          fields: {
            type: 'array',
            items: {
              type: 'object',
              required: ['fieldDefinitionId', 'value'],
              properties: { fieldDefinitionId: { type: 'string' }, value: {} },
            },
          },
        },
      },
    },
    handler: pipesController.updateCardFields.bind(pipesController),
  })

  fastify.post('/cards/:cardId/attachments', {
    schema: {
      description: 'Adicionar anexo ao card',
      tags: ['Cards'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['fileName', 'storageUrl'],
        properties: {
          fileName: { type: 'string' },
          mimeType: { type: 'string' },
          size: { type: 'number' },
          storageUrl: { type: 'string' },
          aiKnowledgeDocumentId: { type: 'string' },
        },
      },
    },
    handler: pipesController.addAttachment.bind(pipesController),
  })
}
