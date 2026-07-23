import { TokenExpiradoError } from './power.client'

/**
 * SGA Hinova v2. SOMENTE LEITURA — o unico POST de escrita permitido e a autenticacao.
 * Nunca logar token, senha ou CPF completo.
 */

const BASE = (process.env.HINOVA_SGA_BASE_URL || 'https://api.hinova.com.br/api/sga/v2').replace(/\/+$/, '')

/** Erro do SGA que NAO e credencial — ex.: usuario com restricao de horario. */
export class SgaRecusouError extends Error {
  constructor(public readonly motivo: string, public readonly codigo?: number) {
    super(`SGA recusou a autenticacao: ${motivo}`)
    this.name = 'SgaRecusouError'
  }
}

/**
 * POST /usuario/autenticar.
 *
 * Detalhe que a doc oficial confirma e que e facil errar: o token pre-compartilhado da
 * integracao (HINOVA_SGA_TOKEN) vai no HEADER Authorization; o body leva apenas usuario e
 * senha; e a resposta devolve `token_usuario`, nao `token`. E esse token_usuario que
 * autentica todas as outras chamadas.
 *
 * O SGA responde 200 mesmo quando recusa por regra de negocio (ex.: usuario com restricao
 * de horario) — nesse caso o corpo traz `{ error: { mensagem, codigo_erro } }` e nao o
 * token. Distinguimos isso de credencial invalida para nao mandar "renove o token" quando
 * o problema e so o horario.
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

  if (resp.status === 401 || resp.status === 403) throw new TokenExpiradoError('sga', resp.status)

  const data = (await resp.json().catch(() => ({}))) as {
    token_usuario?: string
    error?: { mensagem?: string; codigo_erro?: number }
  }

  if (data.token_usuario) return data.token_usuario

  // 200 sem token: o SGA recusou por regra de negocio (horario, permissao, etc.).
  const motivo = data.error?.mensagem || 'resposta sem token_usuario'
  throw new SgaRecusouError(motivo, data.error?.codigo_erro)
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
