/** Tipos do modulo Minha Rede. Ver spec 2026-07-22-minha-rede-crm-rodrigo-design.md */

/** Uma pessoa da rede, ja com o nivel relativo a raiz (0 = a propria raiz). */
export interface MembroRede {
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

/** Uma placa ja atribuida a um consultor e com o desfecho de pagamento resolvido. */
export interface PlacaContada {
  cpfConsultor: string
  codigoVeiculo: string
  placa: string
  associado: string
  telefoneAssociado: string | null
  dataContrato: string
  mesContrato: string
  dataPagamento: string | null
  mesPagamento: string | null
  dataVencimento: string | null
  diasAtraso: number | null
  valor: number | null
  situacaoVeiculo: string | null
  situacaoBoleto: string | null
  status: 'paga' | 'inadimplente'
}

/** O placar do ciclo, ja com a regra unilevel aplicada. */
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
