import { describe, it, expect } from 'vitest'
import { agregarDashboardRede, type PessoaRede } from './dashboard-rede.service'
import type { PlacaContada } from '../rede/rede.types'

let seq = 0
const placa = (
  cpf: string,
  status: 'paga' | 'inadimplente' = 'paga',
  valor = 100,
  ciclo: { contrato: string; pagamento: string | null } = { contrato: '2026-05', pagamento: '2026-06' },
): PlacaContada => ({
  cpfConsultor: cpf, codigoVeiculo: `v-${cpf}-${seq++}`, placa: 'AAA0A00',
  associado: `Assoc ${cpf}`, telefoneAssociado: null,
  dataContrato: `${ciclo.contrato}-10`, mesContrato: ciclo.contrato,
  dataPagamento: status === 'paga' ? `${ciclo.pagamento}-05` : null,
  mesPagamento: status === 'paga' ? ciclo.pagamento : null,
  dataVencimento: '2026-06-01', diasAtraso: status === 'paga' ? null : 30, valor,
  situacaoVeiculo: 'ATIVO', situacaoBoleto: null, status,
})

const pessoa = (powerId: number, cpf: string, nivel: number, pai: number | null, status = 'ativo'): PessoaRede => ({
  powerId, cpf, nome: `Nome ${cpf}`, nivelRaiz: nivel, patrocinadorPowerId: pai, status,
})

const RAIZ = { powerId: 1, nome: 'Rodrigo' }

describe('agregarDashboardRede — as 3 visoes', () => {
  const pessoas: PessoaRede[] = [
    pessoa(1, 'raiz', 0, null),
    pessoa(2, 'a', 1, 1),
    pessoa(3, 'b', 1, 1, 'bloqueado'),
    pessoa(4, 'c', 2, 2),
  ]
  const placas: PlacaContada[] = [
    placa('raiz'), placa('raiz'),            // 2 proprias
    placa('a'), placa('c'),                  // 2 de equipe (N1 e N2)
    placa('a', 'inadimplente', 80),          // 1 inadimplente
  ]

  it('deriva o ciclo cheio automaticamente e carimba atualizadoEm', () => {
    const d = agregarDashboardRede(RAIZ, '2026-07-23T09:14:00Z', pessoas, placas)
    expect(d.ciclo.contrato).toBe('2026-05')
    expect(d.ciclo.pagamento).toBe('2026-06')
    expect(d.ciclo.atualizadoEm).toBe('2026-07-23T09:14:00Z')
    expect(d.raiz.nome).toBe('Rodrigo')
  })

  it('visao rede: placar unilevel do ciclo + inadimplencia com valor', () => {
    const d = agregarDashboardRede(RAIZ, null, pessoas, placas)
    expect(d.rede.proprias).toBe(2)
    expect(d.rede.equipe).toBe(2)
    expect(d.rede.bruto).toBe(4)
    expect(d.rede.ponderado).toBe(3) // 2*1 + 2*0,5
    expect(d.rede.inadimplentes).toEqual({ qtd: 1, valor: 80 })
    expect(d.rede.pessoasPorNivel).toEqual({ 1: 2, 2: 1 })
  })

  it('visao consultores: total do time, ativos/bloqueados e top por ramo (exclui a raiz)', () => {
    const d = agregarDashboardRede(RAIZ, null, pessoas, placas)
    expect(d.consultores.total).toBe(3) // downline, sem a raiz
    expect(d.consultores.ativos).toBe(2)
    expect(d.consultores.bloqueados).toBe(1)
    // 'a' (N1) carrega o proprio (1) + o ramo de 'c' (1) = ramo 2; e o topo.
    expect(d.consultores.top[0].nome).toBe('Nome a')
    expect(d.consultores.top[0].ramo).toBe(2)
    expect(d.consultores.top.every((t) => t.nivel > 0)).toBe(true)
  })

  it('visao associados: placas pagas, receita, ticket medio e recentes', () => {
    const d = agregarDashboardRede(RAIZ, null, pessoas, placas)
    expect(d.associados.placasPagas).toBe(4)
    expect(d.associados.receita).toBe(400)
    expect(d.associados.ticketMedio).toBe(100)
    expect(d.associados.associadosDistintos).toBe(3) // raiz, a, c (nomes distintos)
    expect(d.associados.recentes.length).toBe(4)
  })

  it('override de ciclo filtra outro mes', () => {
    const comOutro = [...placas, placa('a', 'paga', 100, { contrato: '2026-06', pagamento: '2026-07' })]
    const d = agregarDashboardRede(RAIZ, null, pessoas, comOutro, { contrato: '2026-06', pagamento: '2026-07' })
    expect(d.ciclo.contrato).toBe('2026-06')
    expect(d.rede.bruto).toBe(1) // so a placa do ciclo jun/jul
    expect(d.ciclosDisponiveis.length).toBe(2)
  })

  it('sem placas pagas: numeros zerados sem quebrar', () => {
    const d = agregarDashboardRede(RAIZ, null, pessoas, [placa('a', 'inadimplente')])
    expect(d.rede.bruto).toBe(0)
    expect(d.associados.ticketMedio).toBe(0)
    expect(d.rede.inadimplentes.qtd).toBe(1)
  })
})
