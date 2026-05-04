import type { VercelRequest, VercelResponse } from '@vercel/node'
import { setCors } from './_lib/auth-core'

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  setCors(res)
  return res.status(200).json({
    status: 'ok',
    mode: 'serverless-vercel',
    timestamp: new Date().toISOString(),
    hasDatabaseUrl: !!process.env.DATABASE_URL,
    hasJwtSecret: !!process.env.JWT_SECRET,
  })
}
