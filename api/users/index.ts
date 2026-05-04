import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'crypto'
import { setCors, requireAdmin, readBody, fail, sb, sbJson } from '../_lib/auth-core'

const VALID_ROLES = ['admin', 'gestor', 'vendedor', 'operacao'] as const
type Role = typeof VALID_ROLES[number]

function shape(u: any) {
  return {
    id: u.id,
    email: u.email,
    firstName: u.first_name,
    lastName: u.last_name,
    phone: u.phone,
    avatar: u.avatar,
    role: u.role,
    isActive: u.is_active,
    companyId: u.company_id,
    createdAt: u.created_at,
    updatedAt: u.updated_at,
    lastLoginAt: u.last_login_at,
  }
}

async function listUsers(_req: VercelRequest, res: VercelResponse, payload: { companyId: string }) {
  const path = `/users?company_id=eq.${encodeURIComponent(payload.companyId)}` +
    `&select=id,email,first_name,last_name,phone,avatar,role,is_active,company_id,created_at,updated_at,last_login_at` +
    `&order=created_at.desc`
  const users = await sbJson<any[]>(path)
  return res.status(200).json({ data: users.map(shape), total: users.length })
}

async function createUser(req: VercelRequest, res: VercelResponse, payload: { companyId: string }) {
  const body = await readBody(req)
  const email = String(body.email || '').toLowerCase().trim()
  const password = String(body.password || '')
  const firstName = String(body.firstName || '').trim()
  const lastName = String(body.lastName || '').trim()
  const phone = body.phone ? String(body.phone).trim() : null
  const role = String(body.role || '') as Role

  if (!email || !email.includes('@')) return fail(res, 400, 'Email invalido')
  if (!password || password.length < 6) return fail(res, 400, 'Senha precisa ter ao menos 6 caracteres')
  if (!firstName || !lastName) return fail(res, 400, 'Nome e sobrenome sao obrigatorios')
  if (!VALID_ROLES.includes(role)) return fail(res, 400, 'Role invalido')

  const existing = await sbJson<any[]>(
    `/users?email=ilike.${encodeURIComponent(email)}&select=id&limit=1`
  )
  if (existing.length) return fail(res, 409, 'Email ja cadastrado')

  const hashed = await bcrypt.hash(password, 10)
  const now = new Date().toISOString()
  const newUser = {
    id: randomUUID(),
    email,
    password: hashed,
    first_name: firstName,
    last_name: lastName,
    phone,
    role,
    is_active: true,
    company_id: payload.companyId,
    created_at: now,
    updated_at: now,
  }

  const r = await sb(`/users`, { method: 'POST', body: JSON.stringify(newUser) })
  if (!r.ok) {
    const text = await r.text()
    return fail(res, 500, `Erro ao criar usuario: ${text.slice(0, 200)}`)
  }
  const created = await r.json() as any[]
  return res.status(201).json(shape(created[0]))
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = requireAdmin(req, res)
  if (!payload) return

  try {
    if (req.method === 'GET') return await listUsers(req, res, payload)
    if (req.method === 'POST') return await createUser(req, res, payload)
    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[users] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
