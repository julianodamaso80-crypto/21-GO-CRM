import { api } from '../lib/api'

export interface CicloRef {
  contrato: string
  pagamento: string
}

export interface DashboardRedeResponse {
  raiz: { powerId: number; nome: string | null }
  ciclo: CicloRef & { atualizadoEm: string | null }
  ciclosDisponiveis: CicloRef[]
  rede: {
    proprias: number
    equipe: number
    bruto: number
    ponderado: number
    foraDoAlcance: number
    valorTotal: number
    consultoresProduzindo: number
    porNivel: Record<number, number>
    pessoasPorNivel: Record<number, number>
    inadimplentes: { qtd: number; valor: number }
  }
  consultores: {
    total: number
    ativos: number
    bloqueados: number
    produzindo: number
    pessoasPorNivel: Record<number, number>
    top: Array<{ powerId: number; nome: string; nivel: number; proprias: number; ramo: number; descendentes: number }>
  }
  associados: {
    placasPagas: number
    associadosDistintos: number
    receita: number
    ticketMedio: number
    inadimplentes: { qtd: number; valor: number }
    recentes: Array<{
      associado: string
      placa: string
      valor: number | null
      dataPagamento: string | null
      consultor: string
      nivel: number | null
    }>
  }
}

export const dashboardRedeService = {
  async get(ciclo?: CicloRef): Promise<DashboardRedeResponse> {
    const { data } = await api.get('/dashboard/rede', {
      params: ciclo ? { contrato: ciclo.contrato, pagamento: ciclo.pagamento } : undefined,
    })
    return data
  },
}
