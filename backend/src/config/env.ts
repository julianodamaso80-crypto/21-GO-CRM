import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3333),

  // URLs
  FRONTEND_URL: z.string().default('http://localhost:5173'),
  BACKEND_URL: z.string().default('http://localhost:3333'),
  CORS_ORIGIN: z.string().default('*'),

  // Database
  DATABASE_URL: z.string().default('postgresql://localhost:5432/crm'),

  // Redis (Railway provides REDIS_URL)
  REDIS_URL: z.string().optional(),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().default(6379),
  REDIS_PASSWORD: z.string().optional(),

  // JWT
  JWT_SECRET: z.string().min(8).default('dev-jwt-secret-change-in-production-32chars'),
  // 24h default - antes era 15m, mas user perdia sessao enquanto preenchia formularios longos
  JWT_EXPIRES_IN: z.string().default('24h'),
  REFRESH_TOKEN_SECRET: z.string().min(8).default('dev-refresh-secret-change-in-prod-32chars'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),

  // AI
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  DEFAULT_AI_PROVIDER: z.enum(['openai', 'anthropic', 'google']).default('openai'),
  AI_SERVICE_URL: z.string().default('http://localhost:8100'),

  // WhatsApp
  WHATSAPP_API_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),

  // Evolution API (WhatsApp via Baileys)
  EVOLUTION_API_URL: z.string().optional(),
  EVOLUTION_INSTANCE: z.string().optional(),
  EVOLUTION_API_KEY: z.string().optional(),
  EVOLUTION_WEBHOOK_SECRET: z.string().optional(),

  // Instagram
  INSTAGRAM_APP_ID: z.string().optional(),
  INSTAGRAM_APP_SECRET: z.string().optional(),
  INSTAGRAM_ACCESS_TOKEN: z.string().optional(),

  // Storage
  STORAGE_TYPE: z.enum(['local', 's3', 'minio']).default('local'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().optional(),
  AWS_BUCKET_NAME: z.string().optional(),

  // MinIO
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.coerce.number().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().optional(),

  // Email
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // Observability
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  SENTRY_DSN: z.string().optional(),

  // Rate Limiting
  // 600 req/min por IP. Antes era 100/15min — bloqueava o inbox da Leticya
  // em uso normal (Socket.IO polling + heartbeat + invalidateQueries).
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(600),

  // API Brasil (consulta de placa + FIPE — endpoint de crédito)
  APIBRASIL_TOKEN: z.string().optional(),

  // Company ID padrão (para endpoints públicos do site)
  DEFAULT_COMPANY_ID: z.string().optional(),

  // Meta CAPI (conversões offline)
  META_PIXEL_ID: z.string().optional(),
  META_ACCESS_TOKEN: z.string().optional(),

  // Google Ads Offline Conversions
  GOOGLE_ADS_CUSTOMER_ID: z.string().optional(),
  GOOGLE_ADS_CONVERSION_ACTION: z.string().optional(),
  GOOGLE_ADS_DEVELOPER_TOKEN: z.string().optional(),
  GOOGLE_ADS_ACCESS_TOKEN: z.string().optional(),
})

const _env = envSchema.safeParse(process.env)

if (!_env.success) {
  console.error('❌ Invalid environment variables:', _env.error.format())
  throw new Error('Invalid environment variables')
}

export const env = _env.data

// Helper: get Redis connection config from REDIS_URL or individual vars
export function getRedisConfig() {
  if (env.REDIS_URL) {
    return env.REDIS_URL
  }
  return {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD || undefined,
  }
}
