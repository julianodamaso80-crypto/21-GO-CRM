import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { randomUUID } from 'crypto'

const SUPABASE_URL = process.env.SUPABASE_URL || ''
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
export const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production'
export const JWT_EXPIRES_IN = '24h'
export const REFRESH_TOKEN_DAYS = 7

const ROLE_DISPLAY: Record<string, string> = {
  admin: 'Administrador',
  gestor: 'Gestor',
  vendedor: 'Vendedor',
  operacao: 'Operacao',
}
const ROLE_LEVEL: Record<string, number> = { admin: 10, gestor: 7, vendedor: 5, operacao: 3 }

export type JwtPayload = { id: string; email: string; companyId: string; role: string }

export function setCors(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

export async function readBody(req: VercelRequest): Promise<any> {
  if (req.body && typeof req.body === 'object') return req.body
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body) } catch { return {} }
  }
  return {}
}

export function shapeUser(user: any) {
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

export function getBearerToken(req: VercelRequest): string | null {
  const auth = req.headers.authorization || ''
  if (!auth.toLowerCase().startsWith('bearer ')) return null
  return auth.slice(7).trim()
}

export function fail(res: VercelResponse, status: number, msg: string) {
  return res.status(status).json({ error: msg, message: msg })
}

export function authenticate(req: VercelRequest, res: VercelResponse): JwtPayload | null {
  const token = getBearerToken(req)
  if (!token) { fail(res, 401, 'Token ausente'); return null }
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    fail(res, 401, 'Token invalido ou expirado')
    return null
  }
}

export function requireAdmin(req: VercelRequest, res: VercelResponse): JwtPayload | null {
  const payload = authenticate(req, res)
  if (!payload) return null
  if (payload.role !== 'admin') {
    fail(res, 403, 'Acesso restrito a administradores')
    return null
  }
  return payload
}


export async function sb(path: string, init: RequestInit = {}): Promise<Response> {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    throw new Error('SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausentes nas env vars')
  }
  return fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(init.headers || {}),
    },
  })
}

export async function sbJson<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await sb(path, init)
  if (!r.ok) {
    const text = await r.text()
    throw new Error(`Supabase ${r.status}: ${text}`)
  }
  return r.json() as Promise<T>
}

export async function login(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req)
  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')

  if (!email || !password) return fail(res, 400, 'Email e senha sao obrigatorios')

  const users = await sbJson<any[]>(
    `/users?email=ilike.${encodeURIComponent(email)}&select=*,companies(is_active)&limit=1`
  )

  if (!users.length) return fail(res, 401, 'Email ou senha invalidos')

  const user = users[0]
  if (!user.is_active) return fail(res, 403, 'Usuario inativo')
  if (!user.companies?.is_active) return fail(res, 403, 'Empresa inativa')

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return fail(res, 401, 'Email ou senha invalidos')

  const payload: JwtPayload = {
    id: user.id, email: user.email, companyId: user.company_id, role: user.role,
  }
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  const refreshToken = jwt.sign(payload, JWT_SECRET, { expiresIn: `${REFRESH_TOKEN_DAYS}d` })

  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)
  const refreshId = randomUUID()
  const now = new Date().toISOString()

  await sb(`/refresh_tokens`, {
    method: 'POST',
    body: JSON.stringify({
      id: refreshId,
      token: refreshToken,
      user_id: user.id,
      expires_at: expiresAt.toISOString(),
      created_at: now,
    }),
  })

  await sb(`/users?id=eq.${user.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ last_login_at: now }),
  })

  return res.status(200).json({ user: shapeUser(user), token, refreshToken })
}

export async function me(req: VercelRequest, res: VercelResponse) {
  const token = getBearerToken(req)
  if (!token) return fail(res, 401, 'Token ausente')

  let payload: JwtPayload
  try {
    payload = jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return fail(res, 401, 'Token invalido ou expirado')
  }

  const users = await sbJson<any[]>(
    `/users?id=eq.${encodeURIComponent(payload.id)}&select=*,companies(id,name,slug,logo)&limit=1`
  )
  if (!users.length) return fail(res, 404, 'Usuario nao encontrado')
  const user = users[0]
  return res.status(200).json({
    ...shapeUser(user),
    company: {
      id: user.companies?.id || user.company_id,
      name: user.companies?.name,
      slug: user.companies?.slug,
      logo: user.companies?.logo,
    },
  })
}

export async function refresh(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req)
  const refreshToken = String(body.refreshToken || '')
  if (!refreshToken) return fail(res, 400, 'refreshToken obrigatorio')

  let payload: JwtPayload
  try {
    payload = jwt.verify(refreshToken, JWT_SECRET) as JwtPayload
  } catch {
    return fail(res, 401, 'Refresh token invalido')
  }

  const stored = await sbJson<any[]>(
    `/refresh_tokens?token=eq.${encodeURIComponent(refreshToken)}&select=id,expires_at&limit=1`
  )
  if (!stored.length) return fail(res, 401, 'Refresh token nao encontrado')

  const expiresAt = new Date(stored[0].expires_at)
  if (expiresAt < new Date()) {
    await sb(`/refresh_tokens?id=eq.${stored[0].id}`, { method: 'DELETE' })
    return fail(res, 401, 'Refresh token expirado')
  }
  await sb(`/refresh_tokens?id=eq.${stored[0].id}`, { method: 'DELETE' })

  const newPayload: JwtPayload = {
    id: payload.id, email: payload.email,
    companyId: payload.companyId, role: payload.role,
  }
  const token = jwt.sign(newPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
  const newRefreshToken = jwt.sign(newPayload, JWT_SECRET, { expiresIn: `${REFRESH_TOKEN_DAYS}d` })
  const newExpires = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000)

  await sb(`/refresh_tokens`, {
    method: 'POST',
    body: JSON.stringify({
      id: randomUUID(),
      token: newRefreshToken,
      user_id: payload.id,
      expires_at: newExpires.toISOString(),
      created_at: new Date().toISOString(),
    }),
  })

  return res.status(200).json({ token, refreshToken: newRefreshToken })
}

export async function logout(req: VercelRequest, res: VercelResponse) {
  const body = await readBody(req)
  const refreshToken = String(body.refreshToken || '')
  if (refreshToken) {
    await sb(`/refresh_tokens?token=eq.${encodeURIComponent(refreshToken)}`, { method: 'DELETE' })
  }
  return res.status(200).json({ message: 'Logged out' })
}
