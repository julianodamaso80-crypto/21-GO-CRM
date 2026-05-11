import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { fromZodError } from 'zod-validation-error'
import { AppError } from '../utils/app-error'

export function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Zod validation errors
  if (error instanceof ZodError) {
    // Cast pra ZodError compatível com a versão usada por zod-validation-error.
    // Fastify+zod-to-json-schema embaralham os generics e o TS se confunde —
    // o cast via `any` mantém o comportamento de runtime intacto.
    const validationError = fromZodError(error as any)
    return reply.status(400).send({
      error: 'Validation Error',
      message: validationError.message,
      details: error.errors,
    })
  }

  // Custom application errors
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.name,
      message: error.message,
      code: error.code,
    })
  }

  // JWT errors
  if (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing authorization header',
    })
  }

  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Token expired',
    })
  }

  if (error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid token',
    })
  }

  // Rate limit errors
  if (error.statusCode === 429) {
    return reply.status(429).send({
      error: 'Too Many Requests',
      message: 'Rate limit exceeded. Please try again later.',
    })
  }

  // Log unexpected errors
  request.log.error({
    error,
    request: {
      method: request.method,
      url: request.url,
      headers: request.headers,
      body: request.body,
    },
  })

  // Generic error response
  return reply.status(error.statusCode || 500).send({
    error: 'Internal Server Error',
    message:
      process.env.NODE_ENV === 'production'
        ? 'An unexpected error occurred'
        : error.message,
  })
}
