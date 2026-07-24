import { prisma } from '../../config/database'
import { calcularPlacar } from '../rede/unilevel'
import { calcularRamos } from '../rede/ramo'
import { cargaPublicada, resolverRaizDoUsuario } from '../rede/rede.service'
import type { PlacaContada } from '../rede/rede.types'

/**
 * Agregador do Dashboard Hibrido da rede. Reusa a carga publicada e as funcoes puras do
 * modulo rede (calcularPlacar/calcularRamos) e devolve as 3 visoes ja calculadas:
 * Minha Rede, Meus Consultores, Meus Associados. Aditivo — nao mexe em /dashboard/stats.
 */

export { resolverRaizDoUsuario }

interface CicloRef {
  contrato: string
  pagamento: string
}

const norm = (s?: string | null) => String(s || '').trim().toLowerCase()

/** Converte a linha do banco (Decimal) para a forma pura usada pelo unilevel. */
function toPlacaContada(p: any): PlacaContada {
  return {
    cpfConsultor: p.cpfConsultor,
    codigoVeiculo: p.codigoVeiculo,
    placa: p.placa,
    associado: p.associado,
    telefoneAssociado: p.telefoneAssociado,
    dataContrato: p.dataContrato,
    mesContrato: p.mesContrato,
    dataPagamento: p.dataPagamento,
    mesPagamento: p.mesPagamento,
    dataVencimento: p.dataVencimento,
    diasAtraso: p.diasAtraso,
    valor: p.valor != null ? Number(p.valor) : null,
    situacaoVeiculo: p.situacaoVeiculo,
    situacaoBoleto: p.situacaoBoleto,
    status: p.status as 'paga' | 'inadimplente',
  }
}

/**
 * Ciclos disponiveis = pares (mesContrato, mesPagamento) presentes nas placas pagas,
 * ordenados por quantidade de placas desc. O primeiro e o default (o ciclo "cheio").
 */
function derivarCiclos(placas: PlacaContada[]): CicloRef[] {
  const contagem = new Map<string, { ciclo: CicloRef; qtd: number }>()
  for (const p of placas) {
    if (p.status !== 'paga' || !p.mesContrato || !p.mesPagamento) continue
    const chave = `${p.mesContrato}|${p.mesPagamento}`
    const atual = contagem.get(chave)
    if (atual) atual.qtd++
    else contagem.set(chave, { ciclo: { contrato: p.mesContrato, pagamento: p.mesPagamento }, qtd: 1 })
  }
  return [...contagem.values()].sort((a, b) => b.qtd - a.qtd).map((c) => c.ciclo)
}

/** Uma pessoa da rede, no minimo necessario para o dashboard. */
export interface PessoaRede {
  powerId: number
  cpf: string
  nome: string
  nivelRaiz: number
  patrocinadorPowerId: number | null
  status: string
}

/**
 * Nucleo puro: monta as 3 visoes a partir das pessoas e placas ja carregadas.
 * Sem IO — permite testar a agregacao inteira sem banco.
 */
export function agregarDashboardRede(
  raiz: { powerId: number; nome: string | null },
  atualizadoEm: Date | string | null,
  pessoas: PessoaRede[],
  placas: PlacaContada[],
  override?: { contrato?: string; pagamento?: string },
) {
  const niveisPorCpf = new Map(pessoas.map((p) => [p.cpf, p.nivelRaiz]))
  const nomePorCpf = new Map(pessoas.map((p) => [p.cpf, p.nome]))

  // --- Ciclo ---
  const ciclosDisponiveis = derivarCiclos(placas)
  const padrao = ciclosDisponiveis[0] ?? { contrato: '', pagamento: '' }
  const ciclo: CicloRef = {
    contrato: override?.contrato || padrao.contrato,
    pagamento: override?.pagamento || padrao.pagamento,
  }

  const pagasDoCiclo = placas.filter(
    (p) => p.status === 'paga' && p.mesContrato === ciclo.contrato && p.mesPagamento === ciclo.pagamento,
  )
  const inadimplentes = placas.filter((p) => p.status === 'inadimplente')

  // --- Visao Minha Rede (placar unilevel do ciclo) ---
  const placar = calcularPlacar(pagasDoCiclo, niveisPorCpf)
  const inadValor = inadimplentes.reduce((s, p) => s + (p.valor ?? 0), 0)

  // Quantas PESSOAS por nivel (nao placas) — para mostrar o tamanho de cada nivel.
  const pessoasPorNivel: Record<number, number> = {}
  for (const p of pessoas) {
    if (p.nivelRaiz > 0) pessoasPorNivel[p.nivelRaiz] = (pessoasPorNivel[p.nivelRaiz] || 0) + 1
  }

  // --- Visao Meus Consultores ---
  const downline = pessoas.filter((p) => p.nivelRaiz > 0)
  const pagasPorCpf: Record<string, number> = {}
  for (const p of pagasDoCiclo) pagasPorCpf[p.cpfConsultor] = (pagasPorCpf[p.cpfConsultor] || 0) + 1

  const ramos = calcularRamos(
    pessoas.map((p) => ({ powerId: p.powerId, patrocinadorPowerId: p.patrocinadorPowerId, cpf: p.cpf })),
    pagasPorCpf,
  )
  const top = downline
    .map((p) => {
      const r = ramos.get(p.powerId)
      return {
        powerId: p.powerId,
        nome: p.nome,
        nivel: p.nivelRaiz,
        proprias: r?.proprias ?? 0,
        ramo: r?.ramo ?? 0,
        descendentes: r?.descendentes ?? 0,
      }
    })
    .filter((p) => p.ramo > 0)
    .sort((a, b) => b.ramo - a.ramo || b.proprias - a.proprias)
    .slice(0, 10)

  // --- Visao Meus Associados ---
  const receita = pagasDoCiclo.reduce((s, p) => s + (p.valor ?? 0), 0)
  const associadosDistintos = new Set(pagasDoCiclo.map((p) => norm(p.associado))).size
  const recentes = [...pagasDoCiclo]
    .sort((a, b) => String(b.dataPagamento || '').localeCompare(String(a.dataPagamento || '')))
    .slice(0, 12)
    .map((p) => ({
      associado: p.associado,
      placa: p.placa,
      valor: p.valor,
      dataPagamento: p.dataPagamento,
      consultor: nomePorCpf.get(p.cpfConsultor) ?? '(fora da rede)',
      nivel: niveisPorCpf.get(p.cpfConsultor) ?? null,
    }))

  return {
    raiz,
    ciclo: { ...ciclo, atualizadoEm },
    ciclosDisponiveis,
    rede: {
      proprias: placar.proprias,
      equipe: placar.equipe,
      bruto: placar.bruto,
      ponderado: placar.ponderado,
      foraDoAlcance: placar.foraDoAlcance,
      valorTotal: placar.valorTotal,
      consultoresProduzindo: placar.consultoresProduzindo,
      porNivel: placar.porNivel,
      pessoasPorNivel,
      inadimplentes: { qtd: inadimplentes.length, valor: inadValor },
    },
    consultores: {
      total: downline.length,
      ativos: downline.filter((p) => p.status === 'ativo').length,
      bloqueados: downline.filter((p) => p.status === 'bloqueado').length,
      produzindo: placar.consultoresProduzindo,
      pessoasPorNivel,
      top,
    },
    associados: {
      placasPagas: pagasDoCiclo.length,
      associadosDistintos,
      receita,
      ticketMedio: pagasDoCiclo.length ? receita / pagasDoCiclo.length : 0,
      inadimplentes: { qtd: inadimplentes.length, valor: inadValor },
      recentes,
    },
  }
}

/**
 * Le a carga publicada da rede da raiz e monta o dashboard. Retorna null quando nao ha
 * carga publicada (o controller traduz para 404).
 */
export async function dashboardRede(
  companyId: string,
  raizPowerId: number,
  raizNome: string | null,
  override?: { contrato?: string; pagamento?: string },
) {
  const carga = await cargaPublicada(companyId, raizPowerId)
  if (!carga) return null

  const pessoas = (await prisma.redeConsultor.findMany({
    where: { cargaId: carga.id },
    select: { powerId: true, cpf: true, nome: true, nivelRaiz: true, patrocinadorPowerId: true, status: true },
  })) as PessoaRede[]

  const placas = (await prisma.redePlaca.findMany({ where: { cargaId: carga.id } })).map(toPlacaContada)

  return agregarDashboardRede({ powerId: raizPowerId, nome: raizNome }, carga.concluidaEm, pessoas, placas, override)
}
