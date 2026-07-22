import { listarUsuariosPagina, type PaginaPower } from '../clients/power.client'
import { montarArvore, type NoRaiz, type UsuarioPower } from '../arvore'
import type { MembroRede } from '../rede.types'

const POR_PAGINA = 200
const MAX_PAGINAS = 50 // trava de seguranca: ninguem tem 10.000 diretos

type BuscarPagina = (page: number) => Promise<PaginaPower>

/**
 * Diretos de um gerente, juntando as paginas.
 * Para tanto por `totalPages` quanto por pagina vazia — a API ja mentiu no totalPages antes.
 */
export async function diretosDePaginado(powerId: number, buscar: BuscarPagina): Promise<UsuarioPower[]> {
  const todos: UsuarioPower[] = []
  let page = 0
  let totalPages = 1
  do {
    const r = await buscar(page)
    const lote = r?.content ?? []
    if (!lote.length) break
    todos.push(...lote)
    totalPages = Number(r?.totalPages ?? 1)
    page++
  } while (page < totalPages && page < MAX_PAGINAS)
  return todos
}

/** Monta a rede inteira da raiz. Uma chamada por vez: concorrencia satura o Power. */
export async function coletarRede(raiz: NoRaiz): Promise<MembroRede[]> {
  return montarArvore(raiz, (powerId) =>
    diretosDePaginado(powerId, (page) => listarUsuariosPagina(page, POR_PAGINA, { managerIds: [powerId] })),
  )
}
