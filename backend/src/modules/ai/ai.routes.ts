import { FastifyInstance } from 'fastify'
import { AIController } from './ai.controller'
import { authenticate } from '../../middlewares/authenticate'

const aiController = new AIController()

export async function aiRoutes(fastify: FastifyInstance) {
  // === Health Check (sem auth - escopo separado para nao herdar o hook) ===
  fastify.get('/health', {
    schema: {
      description: 'Health check detalhado: Fastify, Prisma, Python AI Service, ChromaDB',
      tags: ['AI'],
    },
    handler: aiController.healthCheck.bind(aiController),
  })

  // === Rotas autenticadas (escopo encapsulado com auth hook) ===
  fastify.register(async function authenticatedRoutes(app) {
    app.addHook('onRequest', authenticate)

    // === Knowledge Bases ===
    app.get('/knowledge-bases', {
      schema: {
        description: 'Lista bases de conhecimento da empresa',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.listKnowledgeBases.bind(aiController),
    })

    app.post('/knowledge-bases', {
      schema: {
        description: 'Cria uma nova base de conhecimento',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['name'],
          properties: {
            name: { type: 'string' },
            description: { type: 'string' },
          },
        },
      },
      handler: aiController.createKnowledgeBase.bind(aiController),
    })

    app.delete('/knowledge-bases/:id', {
      schema: {
        description: 'Deleta uma base de conhecimento',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
      handler: aiController.deleteKnowledgeBase.bind(aiController),
    })

    // === Documents ===
    app.get('/knowledge-bases/:kbId/documents', {
      schema: {
        description: 'Lista documentos de uma base de conhecimento',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { kbId: { type: 'string' } },
        },
      },
      handler: aiController.listDocuments.bind(aiController),
    })

    app.delete('/documents/:id', {
      schema: {
        description: 'Deleta um documento',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
      handler: aiController.deleteDocument.bind(aiController),
    })

    // === Agents ===
    app.get('/agents', {
      schema: {
        description: 'Lista agentes de IA da empresa',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.listAgents.bind(aiController),
    })

    app.get('/agents/:id', {
      schema: {
        description: 'Retorna um agente por ID',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
      handler: aiController.getAgentById.bind(aiController),
    })

    app.post('/agents', {
      schema: {
        description: 'Cria um novo agente de IA',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.createAgent.bind(aiController),
    })

    app.put('/agents/:id', {
      schema: {
        description: 'Atualiza um agente de IA',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
      handler: aiController.updateAgent.bind(aiController),
    })

    app.delete('/agents/:id', {
      schema: {
        description: 'Deleta um agente de IA',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: { id: { type: 'string' } },
        },
      },
      handler: aiController.deleteAgent.bind(aiController),
    })

    // === Proxy para Python AI Service (Ingestao) ===
    app.post('/ingest/file', {
      schema: {
        description: 'Upload de arquivo para ingestao (proxy para AI service)',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.proxyIngestFile.bind(aiController),
    })

    app.post('/ingest/text', {
      schema: {
        description: 'Ingestao de texto livre (proxy para AI service)',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.proxyIngestText.bind(aiController),
    })

    app.post('/ingest/url', {
      schema: {
        description: 'Ingestao via URL (proxy para AI service)',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.proxyIngestURL.bind(aiController),
    })

    app.post('/ingest/crm', {
      schema: {
        description: 'Importar dados do CRM para base de conhecimento',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.proxyIngestCRM.bind(aiController),
    })

    // === Proxy para Python AI Service (Query) ===
    app.post('/query', {
      schema: {
        description: 'Query RAG com contexto da base de conhecimento',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.proxyQuery.bind(aiController),
    })

    // === Ask (Q&A do dashboard com tool use sobre dados reais do CRM) ===
    app.post('/ask', {
      schema: {
        description: 'Pergunta em linguagem natural sobre vendas, leads, canais, sinistros. Agente usa ferramentas pra consultar dados reais.',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['question'],
          properties: {
            question: { type: 'string', minLength: 3, maxLength: 500 },
          },
        },
      },
      handler: aiController.ask.bind(aiController),
    })

    // === Pipe Builder ===
    app.post('/pipe-suggest', {
      schema: {
        description: 'Gera sugestao de pipe/pipeline usando IA',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['promptText'],
          properties: {
            promptText: { type: 'string', minLength: 10 },
            templateType: { type: 'string', enum: ['sales', 'support', 'onboarding', 'recruitment', 'custom'] },
          },
        },
      },
      handler: aiController.pipeSuggest.bind(aiController),
    })

    // === Analytics ===
    app.get('/analytics/stats', {
      schema: {
        description: 'Estatisticas de uso da IA',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
      },
      handler: aiController.getAnalyticsStats.bind(aiController),
    })

    app.get('/analytics/queries', {
      schema: {
        description: 'Queries recentes',
        tags: ['AI'],
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            limit: { type: 'number', minimum: 1, maximum: 200, default: 50 },
          },
        },
      },
      handler: aiController.getRecentQueries.bind(aiController),
    })
  })
}
