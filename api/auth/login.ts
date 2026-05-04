import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors, login } from '../_lib/auth-core'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(res)
  if (req.method === 'OPTIONS') return res.status(204).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  try {
    return await login(req, res)
  } catch (err: any) {
    console.error('[login] error:', err)
    return res.status(500).json({ error: 'Erro interno', message: err?.message || 'unknown' })
  }
}
