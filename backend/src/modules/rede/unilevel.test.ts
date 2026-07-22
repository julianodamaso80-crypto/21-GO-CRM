import { describe, it, expect } from 'vitest'
import { calcularPlacar, PAGA_ATE_NIVEL, PESO_PROPRIO, PESO_EQUIPE } from './unilevel'
import type { PlacaContada } from './rede.types'

let seq = 0
const placa = (cpf: string, status: 'paga' | 'inadimplente' = 'paga', valor = 100): PlacaContada => ({
  cpfConsultor: cpf, codigoVeiculo: `v-${cpf}-${seq++}`, placa: 'AAA0A00',
  associado: 'Fulano', telefoneAssociado: null, dataContrato: '2026-05-10', mesContrato: '2026-05',
  dataPagamento: status === 'paga' ? '2026-06-05' : null, mesPagamento: status === 'paga' ? '2026-06' : null,
  dataVencimento: '2026-06-01', diasAtraso: status === 'paga' ? null : 30, valor,
  situacaoVeiculo: 'ATIVO', situacaoBoleto: null, status,
})

describe('calcularPlacar — plano unilevel da 21Go', () => {
  it('constantes do plano: paga ate o nivel 6, propria vale 1, equipe vale 0,5', () => {
    expect(PAGA_ATE_NIVEL).toBe(6)
    expect(PESO_PROPRIO).toBe(1.0)
    expect(PESO_EQUIPE).toBe(0.5)
  })

  it('venda propria vale 1 placa e venda de equipe vale 0,5', () => {
    const niveis = new Map([['raiz', 0], ['membro', 1]])
    const r = calcularPlacar([placa('raiz'), placa('membro'), placa('membro')], niveis)
    expect(r.proprias).toBe(1)
    expect(r.equipe).toBe(2)
    expect(r.bruto).toBe(3)
    expect(r.ponderado).toBe(2) // 1*1,0 + 2*0,5
  })

  it('ignora placa inadimplente no placar — so conta o que foi pago', () => {
    const niveis = new Map([['raiz', 0]])
    const r = calcularPlacar([placa('raiz'), placa('raiz', 'inadimplente')], niveis)
    expect(r.proprias).toBe(1)
    expect(r.bruto).toBe(1)
  })

  it('placa de N7 nao entra no bruto nem no ponderado, e e contada a parte', () => {
    const niveis = new Map([['raiz', 0], ['fundo', 7]])
    const r = calcularPlacar([placa('raiz'), placa('fundo')], niveis)
    expect(r.bruto).toBe(1)
    expect(r.ponderado).toBe(1)
    expect(r.foraDoAlcance).toBe(1)
  })

  it('descarta placa de quem nao esta na rede', () => {
    const niveis = new Map([['raiz', 0]])
    const r = calcularPlacar([placa('raiz'), placa('estranho')], niveis)
    expect(r.bruto).toBe(1)
    expect(r.consultoresProduzindo).toBe(1)
  })

  it('agrupa por nivel e soma o valor pago', () => {
    const niveis = new Map([['raiz', 0], ['a', 1], ['b', 2]])
    const r = calcularPlacar([placa('raiz', 'paga', 10), placa('a', 'paga', 20), placa('b', 'paga', 30)], niveis)
    expect(r.porNivel).toEqual({ 1: 1, 2: 1 })
    expect(r.valorTotal).toBe(60)
    expect(r.consultoresProduzindo).toBe(3)
  })

  it('reproduz o ciclo conferido do Rodrigo: 40 proprias + 569 de equipe = 609 brutas, 324,5 ponderadas', () => {
    const niveis = new Map<string, number>([['rodrigo', 0]])
    const placas: PlacaContada[] = []
    for (let i = 0; i < 40; i++) placas.push(placa('rodrigo'))
    for (let i = 0; i < 569; i++) {
      const cpf = `membro-${i % 117}`
      niveis.set(cpf, (i % 6) + 1)
      placas.push(placa(cpf))
    }
    const r = calcularPlacar(placas, niveis)
    expect(r.proprias).toBe(40)
    expect(r.equipe).toBe(569)
    expect(r.bruto).toBe(609)
    expect(r.ponderado).toBe(324.5)
  })
})
