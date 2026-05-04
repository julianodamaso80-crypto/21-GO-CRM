import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Pool, type PoolClient } from 'pg'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

const DATABASE_URL = process.env.DATABASE_URL
const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
const JWT_EXPIRES_IN = '24h'
const REFRESH_TOKEN_DAYS = 7

if (!DATABASE_URL) {
  console.error('[serverless] DATABASE_URL is missing — auth will fail')
}

let pool: Pool | null = null
function getPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: DATABASE_URL,
      ssl: DATABASE_URL?.includes('supabase') ? { rejectUnauthorized: false } : undefined,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    })
  }
  return pool
}

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  operacao: 'Operacao',
}
const ROLE_LEVEL: Record<string, number> = { admin: 10, gestor: 7, vendedor: 5, operacao: 3 }

type JwtPayload = { id: string; email: string; companyId: string; role: string }

function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

async function readBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return {}
}

function shapeUser(user: any) {
  const role = user.role || 'vendedor'
  return {
    id: user.id,
    email: user.email,
    firstName: user.first_name,
    lastName: user.last_name,
    avatar: user.avatar,
    phone: user.phone,
    isActive: user.is_active,
    companyId: user.company_id,
    roleId: role,
    role: { id: role, name: role, displayName: ROLE_DISPLAY[role] || role, level: ROLE_LEVEL[role] || 1 },
    timezone: 'America/Sao_Paulo',
    language: 'pt-BR',
    createdAt: user.created_at,
    updatedAt: user.updated_at,
    lastLoginAt: user.last_login_at,
  }
}

async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    return await fn(client)
  } finally {
    client.release()
  }
}

async function handleLogin(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req)
  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e senha sao obrigatorios', message: 'Email e senha sao obrigatorios' })
  }

  return withClient(async (client) => {
    const userResult = await client.query(
      `SELECT u.*, c.is_active AS company_is_active
       FROM users u
       JOIN companies c ON c.id = u.company_id
       WHERE LOWER(u.email) = $1
       LIMIT 1`,
      [email]
    )

    if (userResult.rowCount === 0) {
      return res.status(401).json({ error: 'Email ou senha invalidos', message: 'Email ou senha invalidos' })
    }

    const user = userResult.rows[0]

    if (!user.is_active) return res.status(403).json({ error: 'Usuario inativo', message: 'Usuario inativo' })
    if (!user.company_is_active) return res.status(403).json({ error: 'Empresa inativa', message: 'Empresa inativa' })

    const ok = await bcrypt.compare(password, user.password)
    if (!ok) return res.status(401).json({ error: 'Email ou senha invalidos', message: 'Email ou senha invalidos' })

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      companyId: user.company_id,
      role: user.role,
    }
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: `${REFRESH_TOKEN_DAYS}d` })

    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
    await client.query(
      `INSERT INTO refresh_tokens (id, token, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [randomUUID(), refreshToken, user.id, expiresAt]
    )

    await client.query(`UPDATE users SET last_login_at = NOW() WHERE id = $1`, [user.id])

    return res.status(200).json({ user: shapeUser(user), token, refreshToken })
  })
}

function getBearerToken(req: VercelRequest): string | null {
  const auth = req.headers.authorization || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  return auth.slice(7).trim()
}

async function handleMe(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req)
  if (!token) return res.status(401).json({ error: 'Token ausente' })

  let payload: JwtPayload
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return res.status(401).json({ error: 'Token invalido ou expirado' })
  }

  return withClient(async (client) => {
    const result = await client.query(
      `SELECT u.*, c.name AS company_name, c.slug AS company_slug, c.logo AS company_logo
       FROM users u JOIN companies c ON c.id = u.company_id
       WHERE u.id = $1 LIMIT 1`,
      [payload.id]
    )
    if (result.rowCount === 0) return res.status(404).json({ error: 'Usuario nao encontrado' })
    const user = result.rows[0]
    const shaped = shapeUser(user)
    return res.status(200).json({
      ...shaped,
      company: {
        id: user.company_id,
        name: user.company_name,
        slug: user.company_slug,
        logo: user.company_logo,
      },
    })
  })
}

async function handleRefresh(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req)
  const refreshToken = String(body.refreshToken || '')
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken obrigatorio' })

  let payload: JwtPayload
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload
  } catch {
    return res.status(401).json({ error: 'Refresh token invalido' })
  }

  return withClient(async (client) => {
    const stored = await client.query(
      `SELECT id, expires_at FROM refresh_tokens WHERE token = $1 LIMIT 1`,
      [refreshToken]
    )
    if (stored.rowCount === 0) return res.status(401).json({ error: 'Refresh token nao encontrado' })

    const expiresAt = new Date(stored.rows[0].expires_at)
    if (expiresAt < new Date()) {
      await client.query(`DELETE FROM refresh_tokens WHERE id = $1`, [stored.rows[0].id])
      return res.status(401).json({ error: 'Refresh token expirado' })
    }

    await client.query(`DELETE FROM refresh_tokens WHERE id = $1`, [stored.rows[0].id])

    const newPayload: JwtPayload = {
      id: payload.id,
      email: payload.email,
      companyId: payload.companyId,
      role: payload.role,
    }
    const token = jwt.sign(newPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
    const newRefreshToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: `${REFRESH_TOKEN_DAYS}d` })
    const newExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
    await client.query(
      `INSERT INTO refresh_tokens (id, token, user_id, expires_at, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [randomUUID(), newRefreshToken, payload.id, newExpires]
    )

    return res.status(200).json({ token, refreshToken: newRefreshToken })
  })
}

async function handleLogout(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req)
  const refreshToken = String(body.refreshToken || '')
  if (refreshToken) {
    await withClient((c) => c.query(`DELETE FROM refresh_tokens WHERE token = $1`, [refreshToken]))
  }
  return res.status(200).json({ message: 'Logged out' })
}

async function handleHealth(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'ok',
    mode: 'serverless-vercel',
    timestamp: new Date().toISOString(),
    hasDatabaseUrl: !!DATABASE_URL,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const url = (req.url || '').split('?')[0]
  const method = (req.method || 'GET').toUpperCase()
  const route = `${method} ${url}`

  try {
    if (url === '/api/health' || url === '/health') return handleHealth(req, res)

    if (route === 'POST /api/auth/login') return handleLogin(req, res)
    if (route === 'GET /api/auth/me') return handleMe(req, res)
    if (route === 'POST /api/auth/refresh') return handleRefresh(req, res)
    if (route === 'POST /api/auth/logout') return handleLogout(req, res)

    return res.status(503).json({
      error: 'Endpoint indisponivel',
      message: 'Backend completo em migracao. Apenas auth (login/me/refresh/logout) esta ativo nesta versao serverless.',
      route,
    })
  } catch (err: any) {
    console.error('[serverless] handler error:', err)
    return res.status(500).json({
      error: 'Erro interno',
      message: err?.message || 'unknown',
    })
  }
}
