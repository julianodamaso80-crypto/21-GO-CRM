import { postSga } from '../clients/sga.client'
import { paginarSga, POR_PAGINA } from './coletor-placas'

interface BoletoSga {
  data_pagamento?: string
  data_vencimento?: string
  valor_pagamento?: string
  valor?: string
  descricao_situacao?: string
  nome_associado?: string
  veiculos?: Array<{ codigo_veiculo: string | number; placa?: string }>
}

export interface Pagamento {
  dataPagamento: string
  valor: number
}

export interface BoletoAberto {
  dataVencimento: string
  valor: number
  situacao: string | null
}

const primeiroDia = (mes: string) => {
  const [ano, m] = mes.split('-')
  return `01/${m}/${ano}`
}

const ultimoDia = (mes: string) => {
  const [ano, m] = mes.split('-').map(Number)
  return `${new Date(ano, m, 0).getDate()}/${String(m).padStart(2, '0')}/${ano}`
}

/**
 * Placas com boleto PAGO no mes, indexadas por codigo_veiculo.
 *
 * O pagamento no SGA e POR PLACA: e o `codigo_veiculo` dentro de `veiculos[]` que liga o
 * pagamento a venda. Cruzar por placa ou por nome do cliente erra.
 * O periodo e limitado a 31 dias pela API — um mes por execucao.
 */
export async function coletarBoletosPagos(mes: string, token: string): Promise<Map<string, Pagamento>> {
  const pagos = new Map<string, Pagamento>()
  const lote = await paginarSga<BoletoSga>(async (pagina) => {
    const r = await postSga<{ boletos?: BoletoSga[] }>(
      '/listar/boleto-associado/periodo',
      {
        data_pagamento_inicial: primeiroDia(mes),
        data_pagamento_final: ultimoDia(mes),
        inicio_paginacao: pagina,
        quantidade_por_pagina: POR_PAGINA,
      },
      token,
    )
    return r?.boletos ?? []
  })

  for (const b of lote) {
    for (const v of b.veiculos ?? []) {
      pagos.set(String(v.codigo_veiculo), {
        dataPagamento: String(b.data_pagamento || '').slice(0, 10),
        valor: Number(b.valor_pagamento || b.valor || 0),
      })
    }
  }
  return pagos
}

/**
 * Boletos VENCIDOS e nao pagos no periodo — a definicao de inadimplente que o cliente usa:
 * "cliente nao pagou o boleto no mes, esta com boleto atrasado".
 * Filtra por data de vencimento e descarta o que ja tem data de pagamento preenchida.
 */
export async function coletarBoletosVencidos(mes: string, token: string): Promise<Map<string, BoletoAberto>> {
  const abertos = new Map<string, BoletoAberto>()
  const lote = await paginarSga<BoletoSga>(async (pagina) => {
    const r = await postSga<{ boletos?: BoletoSga[] }>(
      '/listar/boleto-associado/periodo',
      {
        data_vencimento_inicial: primeiroDia(mes),
        data_vencimento_final: ultimoDia(mes),
        inicio_paginacao: pagina,
        quantidade_por_pagina: POR_PAGINA,
      },
      token,
    )
    return r?.boletos ?? []
  })

  for (const b of lote) {
    if (b.data_pagamento) continue // pagou, nao e inadimplente
    for (const v of b.veiculos ?? []) {
      abertos.set(String(v.codigo_veiculo), {
        dataVencimento: String(b.data_vencimento || '').slice(0, 10),
        valor: Number(b.valor || 0),
        situacao: b.descricao_situacao || null,
      })
    }
  }
  return abertos
}

/** Dias de atraso de um vencimento (YYYY-MM-DD) ate a data de referencia. */
export function diasDeAtraso(dataVencimento: string, hoje: Date): number {
  const venc = new Date(`${dataVencimento}T00:00:00Z`)
  const ref = new Date(`${hoje.toISOString().slice(0, 10)}T00:00:00Z`)
  const dia = 24 * 60 * 60 * 1000
  return Math.max(0, Math.round((ref.getTime() - venc.getTime()) / dia))
}
