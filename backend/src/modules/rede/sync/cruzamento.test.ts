import { describe, it, expect } from 'vitest'
import { cruzarPlacas } from './cruzamento'
import type { VeiculoSga } from './coletor-placas'

const veic = (cod: string, cpf: string): VeiculoSga => ({
  codigo_veiculo: cod, placa: `AAA${cod}`, nome_associado: 'Fulano de Tal',
  celular_associado: '(21) 99999-0000', data_contrato: '2026-05-10T00:00:00-0300',
  descricao_situacao: 'ATIVO', cpf_voluntario: cpf,
})

const HOJE = new Date('2026-07-22T12:00:00Z')

describe('cruzarPlacas', () => {
  it('marca como paga a placa cujo codigo_veiculo aparece nos pagos', () => {
    const r = cruzarPlacas([veic('10', '111')], new Map([['10', { dataPagamento: '2026-06-05', valor: 195.25 }]]), new Map(), HOJE)
    expect(r[0].status).toBe('paga')
    expect(r[0].mesPagamento).toBe('2026-06')
    expect(r[0].valor).toBe(195.25)
  })

  it('marca como inadimplente a placa com boleto vencido em aberto, com dias de atraso', () => {
    const r = cruzarPlacas([veic('10', '111')], new Map(), new Map([['10', { dataVencimento: '2026-06-22', valor: 195.25, situacao: 'EM ABERTO' }]]), HOJE)
    expect(r[0].status).toBe('inadimplente')
    expect(r[0].diasAtraso).toBe(30)
  })

  it('pagamento vence inadimplencia quando a placa aparece nos dois lados', () => {
    const r = cruzarPlacas(
      [veic('10', '111')],
      new Map([['10', { dataPagamento: '2026-06-05', valor: 10 }]]),
      new Map([['10', { dataVencimento: '2026-06-01', valor: 10, situacao: 'EM ABERTO' }]]),
      HOJE,
    )
    expect(r[0].status).toBe('paga')
  })

  it('descarta placa sem CPF de voluntario em vez de somar a alguem por aproximacao', () => {
    const semCpf = { ...veic('10', ''), cpf_voluntario: '' }
    const r = cruzarPlacas([semCpf], new Map(), new Map(), HOJE)
    expect(r).toHaveLength(0)
  })

  it('normaliza CPF, mes de contrato e telefone do associado', () => {
    const v = { ...veic('10', '151.837.367-40'), celular_associado: '(21) 97543-3883' }
    const r = cruzarPlacas([v], new Map([['10', { dataPagamento: '2026-06-05', valor: 1 }]]), new Map(), HOJE)
    expect(r[0].cpfConsultor).toBe('15183736740')
    expect(r[0].mesContrato).toBe('2026-05')
    expect(r[0].dataContrato).toBe('2026-05-10')
    expect(r[0].telefoneAssociado).toBe('(21) 97543-3883')
  })

  it('placa contratada, sem pagamento e sem boleto vencido fica de fora das duas listas', () => {
    const r = cruzarPlacas([veic('10', '111')], new Map(), new Map(), HOJE)
    expect(r).toHaveLength(0)
  })
})
