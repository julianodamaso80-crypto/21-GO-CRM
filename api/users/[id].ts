import type { VercelRequest, VercelResponse } from '@vercel/node'
import bcrypt from 'bcryptjs'
import { setCors, requireAdmin, readBody, fail, sb, sbJson } from '../_lib/auth-core'

const VALID_ROLES = ['admin', 'gestor', 'vendedor', 'operacao'] as const

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

async function findUser(id: string, companyId: string) {
  const users = await sbJson<any[]>(
    `/users?id=eq.${encodeURIComponent(id)}&company_id=eq.${encodeURIComponent(companyId)}&limit=1`
  )
  return users[0] || null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  const payload = requireAdmin(req, res)
  if (!payload) return

  const id = String(req.query.id || '')
  if (!id) return fail(res, 400, 'ID obrigatorio')

  try {
    const user = await findUser(id, payload.companyId)
    if (!user) return fail(res, 404, 'Usuario nao encontrado')

    if (req.method === 'GET') {
      return res.status(200).json(shape(user))
    }

    if (req.method === 'PATCH') {
      const body = await readBody(req)
      const update: any = { updated_at: new Date().toISOString() }

      if (body.firstName !== undefined) update.first_name = String(body.firstName).trim()
      if (body.lastName !== undefined) update.last_name = String(body.lastName).trim()
      if (body.phone !== undefined) update.phone = body.phone ? String(body.phone).trim() : null
      if (body.role !== undefined) {
        if (!VALID_ROLES.includes(body.role)) return fail(res, 400, 'Role invalido')
        if (user.id === payload.id && body.role !== 'admin') {
          return fail(res, 400, 'Voce nao pode remover o proprio acesso de admin')
        }
        update.role = body.role
      }
      if (body.isActive !== undefined) {
        if (user.id === payload.id && body.isActive === false) {
          return fail(res, 400, 'Voce nao pode desativar a si mesmo')
        }
        update.is_active = !!body.isActive
      }
      if (body.password) {
        if (String(body.password).length < 6) return fail(res, 400, 'Senha precisa ter ao menos 6 caracteres')
        update.password = await bcrypt.hash(String(body.password), 10)
      }

      const r = await sb(`/users?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(update),
      })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro ao atualizar: ${text.slice(0, 200)}`)
      }
      const updated = await r.json() as any[]
      return res.status(200).json(shape(updated[0]))
    }

    if (req.method === 'DELETE') {
      if (user.id === payload.id) return fail(res, 400, 'Voce nao pode desativar a si mesmo')
      const r = await sb(`/users?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: false, updated_at: new Date().toISOString() }),
      })
      if (!r.ok) {
        const text = await r.text()
        return fail(res, 500, `Erro: ${text.slice(0, 200)}`)
      }
      return res.status(200).json({ message: 'Usuario desativado' })
    }

    return res.status(405).json({ error: 'Method not allowed' })
  } catch (err: any) {
    console.error('[user-id] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
