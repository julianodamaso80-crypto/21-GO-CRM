import path from 'path'
import fs from 'fs'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import websocket from '@fastify/websocket'
import fastifyStatic from '@fastify/static'

import { env } from './config/env'
import { errorHandler } from './middlewares/error-handler'
import { logger } from './utils/logger'
import { socketService } from './websocket'

// Auth (Prisma real — não mais mock/json-db)
import { authRoutes } from './modules/auth/auth.routes'

// Modules existentes
import { associadosRoutes } from './modules/associados/associados.routes'
import { vehiclesRoutes } from './modules/vehicles/vehicles.routes'
import { aiRoutes } from './modules/ai/ai.routes'
import { pipesRoutes } from './modules/pipes/pipes.routes'
import { leadsRoutes } from './modules/leads/leads.routes'
import { tasksRoutes, leadTasksRoutes } from './modules/tasks/tasks.routes'
import { usersRoutes } from './modules/users/users.routes'
import { whatsappRoutes } from './modules/whatsapp/whatsapp.routes'
import { searchRoutes } from './modules/search/search.routes'
import { inboxRoutes } from './modules/inbox/inbox.routes'
import { npsRoutes } from './modules/nps/nps.routes'
import { automationsRoutes } from './modules/automations/automations.routes'
import { webhooksRoutes } from './modules/webhooks/webhooks.routes'
import { dashboardRoutes } from './modules/dashboard/dashboard.routes'
import { analyticsRoutes } from './modules/analytics/analytics.routes'
import { billingRoutes } from './modules/billing/billing.routes'
import { uploadRoutes } from './modules/upload/upload.routes'

// Novos modules 21Go
import { sinistrosRoutes } from './modules/sinistros/sinistros.routes'
import { cotacoesRoutes } from './modules/cotacoes/cotacoes.routes'
import { indicacoesRoutes } from './modules/indicacoes/indicacoes.routes'
import { projectsRoutes } from './modules/projects/projects.routes'
import { plateLookupRoutes } from './modules/plate-lookup/plate-lookup.routes'
import { startReengajamentoWorker } from './modules/plate-lookup/lead-followup.service'
import { webhookEvolutionRoutes } from './modules/webhook-evolution/webhook-evolution.routes'

const port = Number(process.env.PORT) || env.PORT || 3333

const fastify = Fastify({
  logger: logger as any,
  trustProxy: true,
})

async function bootstrap() {
  try {
    // Plugins de seguranca
    await fastify.register(helmet, {
      contentSecurityPolicy: false,
    })

    await fastify.register(cors, {
      origin: (origin, cb) => {
        // Allow requests from 21go.site, localhost, and Railway preview URLs
        const allowed = [
          'https://21go.site',
          'https://www.21go.site',
          'https://app.21go.site',
          'https://crm21go.site',
          'https://www.crm21go.site',
          'https://21go-website-production.up.railway.app',
          'http://localhost:5173',
          'http://localhost:3000',
          'http://localhost:3333',
        ]
        if (!origin || allowed.includes(origin) || origin.endsWith('.railway.app')) {
          cb(null, true)
        } else if (env.CORS_ORIGIN === '*') {
          cb(null, true)
        } else {
          cb(null, env.CORS_ORIGIN === origin)
        }
      },
      credentials: true,
    })

    await fastify.register(rateLimit, {
      max: env.RATE_LIMIT_MAX_REQUESTS,
      timeWindow: env.RATE_LIMIT_WINDOW_MS,
    })

    // JWT
    await fastify.register(jwt, {
      secret: env.JWT_SECRET,
      sign: {
        expiresIn: env.JWT_EXPIRES_IN,
      },
    })

    // Multipart (upload de arquivos)
    await fastify.register(multipart, {
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
    })

    // WebSocket
    await fastify.register(websocket)

    // Swagger (documentacao API)
    await fastify.register(swagger, {
      openapi: {
        info: {
          title: 'CRM 21Go API',
          description: 'API do CRM 21Go - Protecao Veicular',
          version: '1.0.0',
        },
        servers: [
          {
            url: env.BACKEND_URL,
            description: env.NODE_ENV === 'production' ? 'Production' : 'Development',
          },
        ],
        components: {
          securitySchemes: {
            bearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'JWT',
            },
          },
        },
        security: [{ bearerAuth: [] }],
      },
    })

    await fastify.register(swaggerUi, {
      routePrefix: '/docs',
      uiConfig: {
        docExpansion: 'list',
        deepLinking: true,
      },
      staticCSP: true,
    })

    // Health check
    fastify.get('/health', async () => {
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        database: 'prisma',
      }
    })

    // ── API Routes ──────────────────────────────────────
    await fastify.register(authRoutes, { prefix: '/api/auth' })
    await fastify.register(associadosRoutes, { prefix: '/api/associados' })
    await fastify.register(vehiclesRoutes, { prefix: '/api/vehicles' })
    await fastify.register(leadsRoutes, { prefix: '/api/leads' })
    await fastify.register(leadTasksRoutes, { prefix: '/api/leads' })
    await fastify.register(tasksRoutes, { prefix: '/api/tasks' })
    await fastify.register(usersRoutes, { prefix: '/api/users' })
    await fastify.register(whatsappRoutes, { prefix: '/api/whatsapp' })
    await fastify.register(searchRoutes, { prefix: '/api/search' })
    await fastify.register(sinistrosRoutes, { prefix: '/api/sinistros' })
    await fastify.register(cotacoesRoutes, { prefix: '/api/cotacoes' })
    await fastify.register(indicacoesRoutes, { prefix: '/api/indicacoes' })
    await fastify.register(projectsRoutes, { prefix: '/api/projects' })
    await fastify.register(aiRoutes, { prefix: '/api/ai' })
    await fastify.register(pipesRoutes, { prefix: '/api/pipes' })
    await fastify.register(npsRoutes, { prefix: '/api/nps' })
    await fastify.register(inboxRoutes, { prefix: '/api/conversations' })
    await fastify.register(automationsRoutes, { prefix: '/api/automations' })
    await fastify.register(webhooksRoutes, { prefix: '/api/webhooks' })
    await fastify.register(dashboardRoutes, { prefix: '/api/dashboard' })
    await fastify.register(analyticsRoutes, { prefix: '/api/analytics' })
    await fastify.register(billingRoutes, { prefix: '/api/billing' })
    await fastify.register(uploadRoutes, { prefix: '/api/upload' })

    // Public endpoints (no auth — chamados pelo site estático)
    await fastify.register(plateLookupRoutes, { prefix: '/api/vehicle' })

    // Evolution API webhook (público — recebe da Evolution, validação via EVOLUTION_WEBHOOK_SECRET)
    await fastify.register(webhookEvolutionRoutes, { prefix: '/api/webhook/evolution' })

    // Ouvidoria (público — recebe do site)
    const { ouvidoriaRoutes } = await import('./modules/ouvidoria/ouvidoria.routes')
    await fastify.register(ouvidoriaRoutes)

    // Alias: /api/contacts -> /api/associados (backward compat)
    await fastify.register(associadosRoutes, { prefix: '/api/contacts' })

    // Boletos endpoint (alias para billing/financeiro)
    fastify.get('/api/boletos', { preHandler: [] }, async (_req, reply) => {
      return reply.send({ data: [], message: 'Boletos via Hinova SGC (integracao pendente)' })
    })

    // Inbox alias
    await fastify.register(inboxRoutes, { prefix: '/api/inbox' })

    // ── Serve frontend static files in production ───────
    const possiblePaths = [
      path.join(process.cwd(), '..', 'frontend', 'dist'),
      path.join(process.cwd(), 'frontend', 'dist'),
      path.join(__dirname, '..', '..', 'frontend', 'dist'),
      path.join(__dirname, '..', 'frontend', 'dist'),
    ]

    const frontendDistPath = possiblePaths.find(p => fs.existsSync(p))

    if (frontendDistPath) {
      console.log(`[Static] Serving frontend from: ${frontendDistPath}`)
      await fastify.register(fastifyStatic, {
        root: frontendDistPath,
        prefix: '/',
        wildcard: false,
      })

      // SPA fallback: serve index.html for any non-API, non-health route
      fastify.setNotFoundHandler((request, reply) => {
        if (request.url.startsWith('/api/') || request.url === '/health' || request.url === '/docs') {
          return reply.status(404).send({ error: 'Not Found', message: 'Route not found' })
        }
        return reply.sendFile('index.html')
      })
    } else {
      console.log('[Static] Frontend dist not found, skipping static file serving')
      console.log('[Static] Looked in:', possiblePaths)
    }

    // Error handler global
    fastify.setErrorHandler(errorHandler as any)

    // Start server
    await fastify.listen({
      port,
      host: '0.0.0.0',
    })

    // Initialize Socket.io AFTER server is listening
    try {
      await socketService.initialize(fastify)
    } catch (err) {
      console.warn('[WebSocket] Failed to initialize:', err)
    }

    // Worker de reengajamento: a cada 60s, busca leads que receberam follow-up
    // há mais de 5 min, não clicaram em "Contratar pelo WhatsApp" e não responderam.
    try {
      startReengajamentoWorker()
    } catch (err) {
      console.warn('[Reengajamento] Failed to start worker:', err)
    }

    console.log(`
    ╔═══════════════════════════════════════════════════╗
    ║                                                   ║
    ║   CRM 21Go - BACKEND STARTED (PRISMA)            ║
    ║                                                   ║
    ║   Server:  http://0.0.0.0:${String(port).padEnd(25)}║
    ║   Docs:    /docs                                  ║
    ║   Health:  /health                                ║
    ║   Env:     ${env.NODE_ENV.toUpperCase().padEnd(38)}║
    ║   Static:  ${frontendDistPath ? 'YES' : 'NO'}${' '.repeat(frontendDistPath ? 37 : 37)}║
    ║   DB:      Prisma + PostgreSQL                    ║
    ║                                                   ║
    ╚═══════════════════════════════════════════════════╝
    `)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM']
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, closing server gracefully...`)
    await fastify.close()
    process.exit(0)
  })
})

bootstrap()
