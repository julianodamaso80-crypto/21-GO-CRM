import { api } from '../lib/api'

export interface MembroRede {
  id: string
  powerId: number
  cpf: string
  nome: string
  nomeTratamento: string
  email: string | null
  celular: string | null
  funcao: string | null
  cooperativa: string | null
  patrocinadorPowerId: number | null
  nivelRaiz: number
  caminho: string
  status: 'ativo' | 'bloqueado'
}

export interface ResumoRamo {
  proprias: number
  ramo: number
  descendentes: number
}

export interface ArvoreResponse {
  carga: { id: string; atualizadoEm: string | null; totais: Record<string, any> | null }
  membros: MembroRede[]
  porNivel: Record<number, number>
  placasPorCpf: Record<string, { pagas: number; inadimplentes: number }>
  ramos: Record<number, ResumoRamo>
}

export interface Placar {
  proprias: number
  equipe: number
  bruto: number
  ponderado: number
  foraDoAlcance: number
  porNivel: Record<number, number>
  consultoresProduzindo: number
  valorTotal: number
}

export interface PlacaLinha {
  id: string
  placa: string
  associado: string
  telefoneAssociado: string | null
  cpfConsultor: string
  consultor: string
  nivel: number | null
  dataContrato: string
  dataPagamento: string | null
  dataVencimento: string | null
  diasAtraso: number | null
  valor: number | null
  status: 'paga' | 'inadimplente'
}

export interface FiltrosPlacas {
  contrato?: string
  pagamento?: string
  status?: 'paga' | 'inadimplente'
  consultor?: string
  nivel?: number
  escopo?: 'proprias' | 'equipe' | 'tudo'
  busca?: string
}

export interface CargaProgresso {
  id: string
  etapa: string
  status: 'rodando' | 'publicada' | 'falhou'
  iniciadaEm: string
  concluidaEm: string | null
  erro: string | null
  totais: Record<string, any> | null
}

export const redeService = {
  async arvore(): Promise<ArvoreResponse> {
    const { data } = await api.get('/rede/arvore')
    return data
  },
  async placar(contrato: string, pagamento: string): Promise<Placar> {
    const { data } = await api.get('/rede/placar', { params: { contrato, pagamento } })
    return data
  },
  async placas(f: FiltrosPlacas): Promise<{ carga: { atualizadoEm: string | null } | null; placas: PlacaLinha[] }> {
    const { data } = await api.get('/rede/placas', { params: f })
    return data
  },
  async sincronizar(body: {
    raizPowerId: number; raizNome: string; raizCpf: string; mesContrato: string; mesPagamento: string
  }): Promise<{ cargaId: string }> {
    const { data } = await api.post('/rede/sync', body)
    return data
  },
  async progresso(cargaId: string): Promise<CargaProgresso> {
    const { data } = await api.get(`/rede/sync/${cargaId}`)
    return data
  },
}
