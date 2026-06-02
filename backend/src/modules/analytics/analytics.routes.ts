import { FastifyInstance } from 'fastify'
import { AnalyticsController } from './analytics.controller'
import { authenticate } from '../../middlewares/authenticate'

const analyticsController = new AnalyticsController()

const filterQuerySchema = {
  type: 'object' as const,
  properties: {
    startDate: { type: 'string' },
    endDate: { type: 'string' },
    source: { type: 'string' },
    campaign: { type: 'string' },
    platform: { type: 'string' },
    pipelineId: { type: 'string' },
    groupBy: { type: 'string' },
    metric: { type: 'string' },
    granularity: { type: 'string', enum: ['day', 'week', 'month'] },
    sortBy: { type: 'string' },
  },
}

export async function analyticsRoutes(fastify: FastifyInstance) {
  // Todas as rotas requerem autenticacao
  fastify.addHook('onRequest', authenticate)

  // GET /analytics/overview
  fastify.get('/overview', {
    schema: {
      description: 'Get analytics overview with key metrics',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getOverview.bind(analyticsController),
  })

  // GET /analytics/sources
  fastify.get('/sources', {
    schema: {
      description: 'Get lead analytics grouped by source',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getSources.bind(analyticsController),
  })

  // GET /analytics/by-state
  fastify.get('/by-state', {
    schema: {
      description: 'Distribuição de leads e aprovações por estado (via DDD do telefone)',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getByState.bind(analyticsController),
  })

  // GET /analytics/by-vehicle-type
  fastify.get('/by-vehicle-type', {
    schema: {
      description: 'Distribuição de leads e aprovações por tipo de veículo (carro/moto)',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getByVehicleType.bind(analyticsController),
  })

  // GET /analytics/campaigns
  fastify.get('/campaigns', {
    schema: {
      description: 'Get campaign analytics with ROI metrics',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getCampaigns.bind(analyticsController),
  })

  // GET /analytics/funnel
  fastify.get('/funnel', {
    schema: {
      description: 'Get funnel conversion analysis',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getFunnel.bind(analyticsController),
  })

  // GET /analytics/ltv
  fastify.get('/ltv', {
    schema: {
      description: 'Get customer lifetime value analysis',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getLTV.bind(analyticsController),
  })

  // GET /analytics/roi
  fastify.get('/roi', {
    schema: {
      description: 'Get return on investment analysis',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getROI.bind(analyticsController),
  })

  // GET /analytics/trends
  fastify.get('/trends', {
    schema: {
      description: 'Get time series trend data',
      tags: ['analytics'],
      security: [{ bearerAuth: [] }],
      querystring: filterQuerySchema,
    },
    handler: analyticsController.getTrends.bind(analyticsController),
  })
}
