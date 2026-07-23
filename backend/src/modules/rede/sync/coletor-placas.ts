import { postSga } from '../clients/sga.client'

/** Todas as situacoes: placa vendida em maio pode estar cancelada hoje e ainda foi venda de maio. */
export const SITUACOES = [1, 2, 3, 4, 5, 6, 7, 8]
export const POR_PAGINA = 500 // com 3000 a resposta estoura a memoria

export interface VeiculoSga {
  codigo_veiculo: string | number
  placa: string
  modelo?: string
  nome_associado: string
  // O /listar/veiculo traz o telefone do associado em campos separados (ddd + numero).
  telefone?: string
  ddd?: string
  telefone_celular?: string
  ddd_celular?: string
  telefone_celular_aux?: string
  ddd_celular_aux?: string
  telefone_comercial?: string
  ddd_comercial?: string
  data_contrato: string
  descricao_situacao?: string
  codigo_voluntario?: string | number
  nome_voluntario?: string
  cpf_voluntario?: string
}

/**
 * Monta o telefone do associado a partir dos campos do SGA, priorizando o celular.
 * Cada telefone vem em par ddd + numero; junta como "(DDD) NUMERO" quando ha numero.
 */
export function telefoneDoAssociado(v: VeiculoSga): string | null {
  const pares: Array<[string | undefined, string | undefined]> = [
    [v.ddd_celular, v.telefone_celular],
    [v.ddd_celular_aux, v.telefone_celular_aux],
    [v.ddd_comercial, v.telefone_comercial],
    [v.ddd, v.telefone],
  ]
  for (const [ddd, num] of pares) {
    const n = String(num || '').trim()
    if (!n) continue
    const d = String(ddd || '').trim()
    return d ? `(${d}) ${n}` : n
  }
  return null
}

/** Dias do mes no formato DD/MM/AAAA. `mes` vem como YYYY-MM. */
export function diasDoMes(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number)
  const total = new Date(ano, m, 0).getDate()
  return Array.from({ length: total }, (_, i) =>
    `${String(i + 1).padStart(2, '0')}/${String(m).padStart(2, '0')}/${ano}`)
}

/**
 * Pagina uma listagem do SGA.
 * ARMADILHA: `inicio_paginacao` e o NUMERO DA PAGINA (0,1,2...), nao o offset.
 * Passar `pagina * 500` devolve 406 ou nada.
 */
export async function paginarSga<T>(buscarPagina: (pagina: number) => Promise<T[]>): Promise<T[]> {
  const todos: T[] = []
  let pagina = 0
  for (;;) {
    const lote = await buscarPagina(pagina)
    todos.push(...lote)
    if (lote.length < POR_PAGINA) break
    pagina++
  }
  return todos
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Placas CONTRATADAS no mes, todas as situacoes.
 *
 * A data que vale e a do VEICULO: um associado de 2024 que poe placa nova em maio conta
 * como venda de maio. Usar a data do associado erra ~26%.
 *
 * Varre dia a dia porque `data_contrato` filtra por dia exato — sai muito mais barato que
 * paginar a base inteira. Uma chamada por vez: concorrencia satura a API e comeca a falhar.
 *
 * Situacoes que a API recusar (406) sao puladas em vez de derrubar a coleta: a situacao 8
 * costuma responder 406 e nao vale perder o mes inteiro por causa dela.
 */
export async function coletarPlacasDoMes(
  mes: string,
  token: string,
  onProgresso?: (feitos: number, total: number) => void,
): Promise<VeiculoSga[]> {
  const dias = diasDoMes(mes)
  const total = SITUACOES.length * dias.length
  const porCodigo = new Map<string, VeiculoSga>()
  let feitos = 0

  for (const codigo_situacao of SITUACOES) {
    for (const data_contrato of dias) {
      try {
        const lote = await paginarSga<VeiculoSga>(async (pagina) => {
          const r = await postSga<{ veiculos?: VeiculoSga[] }>(
            '/listar/veiculo',
            { codigo_situacao, data_contrato, inicio_paginacao: pagina, quantidade_por_pagina: POR_PAGINA },
            token,
          )
          return r?.veiculos ?? []
        })
        for (const v of lote) porCodigo.set(String(v.codigo_veiculo), v)
      } catch (err) {
        const msg = (err as Error).message
        // 406 = situacao nao aceita pelo perfil. Nao e falha de coleta, e ausencia de dado.
        if (!msg.includes('HTTP 406')) throw err
      }
      feitos++
      onProgresso?.(feitos, total)
      await sleep(80)
    }
  }

  return [...porCodigo.values()]
}
