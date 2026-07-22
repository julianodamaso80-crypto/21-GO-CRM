import type { UsuarioPower } from '../arvore'

/**
 * Painel interno do Power CRM. SOMENTE LEITURA.
 * O Bearer e o token de sessao do app.powercrm.com.br e EXPIRA em ~10h — quando expira,
 * o job para e pede token novo. Nunca logar o token.
 */

const BASE = (process.env.POWER_APP_BASE_URL || 'https://app.powercrm.com.br').replace(/\/+$/, '')

/** Erro que sinaliza "credencial vencida": o job para e nao publica carga pela metade. */
export class TokenExpiradoError extends Error {
  constructor(public readonly origem: 'power' | 'sga', status: number) {
    super(`Token do ${origem} expirado ou invalido (HTTP ${status}). Renove a credencial e rode de novo.`)
    this.name = 'TokenExpiradoError'
  }
}

export interface FiltroPower {
  managerIds?: number[]
  name?: string
  limitToBranches: unknown[]
  status: number
  office: number
  filterUser: boolean
  functions: null
  groupPermission: unknown[]
  cooperativeIds: unknown[]
  sortBy: null
  sortDirection: null
}

/** status: 0 = todos (ativos + bloqueados). Bloqueado entra na rede de proposito. */
export const FILTRO_BASE: FiltroPower = {
  limitToBranches: [], status: 0, office: 0, filterUser: true,
  functions: null, groupPermission: [], cooperativeIds: [],
  sortBy: null, sortDirection: null,
}

export interface PaginaPower {
  content: UsuarioPower[]
  totalElements: number
  totalPages: number
}

export async function listarUsuariosPagina(
  page: number,
  size: number,
  filtro: Partial<FiltroPower>,
): Promise<PaginaPower> {
  const bearer = process.env.POWER_APP_BEARER
  if (!bearer) throw new TokenExpiradoError('power', 0)

  const resp = await fetch(`${BASE}/company/userListFilter?page=${page}&size=${size}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({ ...FILTRO_BASE, ...filtro }),
  })

  if (resp.status === 401 || resp.status === 403) throw new TokenExpiradoError('power', resp.status)

  const txt = await resp.text()
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em userListFilter: ${txt.slice(0, 200)}`)
  return JSON.parse(txt) as PaginaPower
}
