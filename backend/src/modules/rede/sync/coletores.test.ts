import { describe, it, expect } from 'vitest'
import { diretosDePaginado } from './coletor-rede'
import { diasDoMes, paginarSga } from './coletor-placas'
import { diasDeAtraso } from './coletor-boletos'
import type { UsuarioPower } from '../arvore'

const fake = (id: number): UsuarioPower => ({
  id, name: `n${id}`, fullName: `n${id}`, registration: '00000000000', email: '',
  companyUserMobile: '', officeString: '', cooperativeString: '', active: true, responsibleUser: '',
})

describe('diretosDePaginado', () => {
  it('junta todas as paginas ate totalPages', async () => {
    const paginas = [
      { content: [fake(1), fake(2)], totalElements: 3, totalPages: 2 },
      { content: [fake(3)], totalElements: 3, totalPages: 2 },
    ]
    const chamadas: number[] = []
    const r = await diretosDePaginado(99, async (page) => { chamadas.push(page); return paginas[page] })
    expect(r.map((x) => x.id)).toEqual([1, 2, 3])
    expect(chamadas).toEqual([0, 1])
  })

  it('para quando a pagina volta vazia, mesmo que totalPages minta', async () => {
    const r = await diretosDePaginado(99, async (page) =>
      page === 0
        ? { content: [fake(1)], totalElements: 99, totalPages: 50 }
        : { content: [], totalElements: 99, totalPages: 50 })
    expect(r).toHaveLength(1)
  })

  it('devolve vazio quando a pessoa nao tem ninguem abaixo', async () => {
    const r = await diretosDePaginado(99, async () => ({ content: [], totalElements: 0, totalPages: 0 }))
    expect(r).toEqual([])
  })
})

describe('diasDoMes', () => {
  it('varre o mes dia a dia no formato do SGA, porque data_contrato filtra por dia exato', () => {
    const d = diasDoMes('2026-06')
    expect(d).toHaveLength(30)
    expect(d[0]).toBe('01/06/2026')
    expect(d[29]).toBe('30/06/2026')
  })

  it('respeita fevereiro', () => {
    expect(diasDoMes('2026-02')).toHaveLength(28)
  })
})

describe('paginarSga', () => {
  it('inicio_paginacao e o NUMERO DA PAGINA, nao o offset', async () => {
    const recebidos: number[] = []
    await paginarSga(async (pagina) => {
      recebidos.push(pagina)
      return pagina === 0 ? new Array(500).fill({ x: 1 }) : []
    })
    expect(recebidos).toEqual([0, 1]) // 0 e 1, nunca 0 e 500
  })

  it('para na primeira pagina incompleta', async () => {
    const recebidos: number[] = []
    const r = await paginarSga(async (pagina) => {
      recebidos.push(pagina)
      return pagina === 0 ? new Array(500).fill({ x: 1 }) : new Array(3).fill({ x: 2 })
    })
    expect(recebidos).toEqual([0, 1])
    expect(r).toHaveLength(503)
  })
})

describe('diasDeAtraso', () => {
  it('conta os dias corridos entre o vencimento e hoje', () => {
    expect(diasDeAtraso('2026-06-22', new Date('2026-07-22T12:00:00Z'))).toBe(30)
  })

  it('nunca devolve negativo pra boleto que ainda vai vencer', () => {
    expect(diasDeAtraso('2026-08-01', new Date('2026-07-22T12:00:00Z'))).toBe(0)
  })
})
