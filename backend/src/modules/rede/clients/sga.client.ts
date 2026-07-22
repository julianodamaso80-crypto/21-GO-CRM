import { TokenExpiradoError } from './power.client'

/**
 * SGA Hinova v2. SOMENTE LEITURA — o unico POST de escrita permitido e a autenticacao.
 * Nunca logar token, senha ou CPF completo.
 */

const BASE = (process.env.HINOVA_SGA_BASE_URL || 'https://api.hinova.com.br/api/sga/v2').replace(/\/+$/, '')

/**
 * POST /usuario/autenticar.
 *
 * Detalhe que a doc oficial confirma e que e facil errar: o token pre-compartilhado da
 * integracao (HINOVA_SGA_TOKEN) vai no HEADER Authorization; o body leva apenas usuario e
 * senha; e a resposta devolve `token_usuario`, nao `token`. E esse token_usuario que
 * autentica todas as outras chamadas.
 */
export async function autenticarSga(): Promise<string> {
  const tokenIntegracao = process.env.HINOVA_SGA_TOKEN
  if (!tokenIntegracao) throw new TokenExpiradoError('sga', 0)

  const resp = await fetch(`${BASE}/usuario/autenticar`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json',
      authorization: `Bearer ${tokenIntegracao}`,
    },
    body: JSON.stringify({
      usuario: process.env.HINOVA_SGA_USUARIO,
      senha: process.env.HINOVA_SGA_SENHA,
    }),
  })

  if (!resp.ok) throw new TokenExpiradoError('sga', resp.status)
  const data = (await resp.json()) as { token_usuario?: string }
  if (!data.token_usuario) throw new TokenExpiradoError('sga', resp.status)
  return data.token_usuario
}

export async function postSga<T>(path: string, body: unknown, token: string): Promise<T> {
  const resp = await fetch(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (resp.status === 401) throw new TokenExpiradoError('sga', 401)
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${path}: ${txt.slice(0, 200)}`)
  return JSON.parse(txt) as T
}
