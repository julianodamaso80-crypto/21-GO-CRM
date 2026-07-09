import { FastifyInstance } from 'fastify'
import { AuthController } from './auth.controller'
import { authenticate } from '../../middlewares/authenticate'

const authController = new AuthController()

export async function authRoutes(fastify: FastifyInstance) {
  // Rotas públicas
  fastify.post('/register', {
    schema: {
      description: 'Register a new user and company',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password', 'firstName', 'lastName', 'companyName'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          firstName: { type: 'string', minLength: 2 },
          lastName: { type: 'string', minLength: 2 },
          companyName: { type: 'string', minLength: 2 },
        },
      },
    },
    handler: authController.register.bind(authController),
  })

  fastify.post('/login', {
    schema: {
      description: 'Login with email and password',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' },
        },
      },
    },
    handler: authController.login.bind(authController),
  })

  fastify.post('/refresh', {
    schema: {
      description: 'Refresh access token',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    handler: authController.refresh.bind(authController),
  })

  fastify.post('/logout', {
    schema: {
      description: 'Logout and invalidate refresh token',
      tags: ['auth'],
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
    handler: authController.logout.bind(authController),
  })

  // Rotas protegidas
  fastify.get('/me', {
    onRequest: [authenticate],
    schema: {
      description: 'Get current user profile',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
    },
    handler: authController.me.bind(authController),
  })

  fastify.post('/change-password', {
    onRequest: [authenticate],
    schema: {
      description: 'Change own password (used on first-access forced change)',
      tags: ['auth'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['newPassword'],
        properties: {
          currentPassword: { type: 'string' },
          newPassword: { type: 'string', minLength: 6 },
        },
      },
    },
    handler: authController.changePassword.bind(authController),
  })
}
