import { describe, it, expect } from 'vitest'
import { calcularRamos } from './ramo'

// Rede: raiz 1 -> 2 -> 3, e 1 -> 4
const MEMBROS = [
  { powerId: 1, patrocinadorPowerId: null, cpf: 'c1' },
  { powerId: 2, patrocinadorPowerId: 1, cpf: 'c2' },
  { powerId: 3, patrocinadorPowerId: 2, cpf: 'c3' },
  { powerId: 4, patrocinadorPowerId: 1, cpf: 'c4' },
]

describe('calcularRamos', () => {
  it('soma as placas da pessoa mais tudo que esta abaixo dela', () => {
    const r = calcularRamos(MEMBROS, { c1: 10, c2: 5, c3: 2, c4: 1 })
    expect(r.get(1)).toEqual({ proprias: 10, ramo: 18, descendentes: 3 })
    expect(r.get(2)).toEqual({ proprias: 5, ramo: 7, descendentes: 1 })
    expect(r.get(3)).toEqual({ proprias: 2, ramo: 2, descendentes: 0 })
  })

  it('quem nao vendeu fica com zero, nao some', () => {
    const r = calcularRamos(MEMBROS, { c1: 1 })
    expect(r.get(4)).toEqual({ proprias: 0, ramo: 0, descendentes: 0 })
  })

  it('um direto que vende pouco pode carregar um ramo grande', () => {
    const r = calcularRamos(MEMBROS, { c2: 1, c3: 100 })
    expect(r.get(2)!.proprias).toBe(1)
    expect(r.get(2)!.ramo).toBe(101)
  })

  it('nao trava se o cadastro tiver ciclo', () => {
    const ciclico = [
      { powerId: 1, patrocinadorPowerId: 3, cpf: 'c1' },
      { powerId: 2, patrocinadorPowerId: 1, cpf: 'c2' },
      { powerId: 3, patrocinadorPowerId: 2, cpf: 'c3' },
    ]
    const r = calcularRamos(ciclico, { c1: 1, c2: 1, c3: 1 })
    expect(r.size).toBe(3)
  })
})
