import { prisma } from '../../config/database'
import { calcularPlacar } from './unilevel'
import { calcularRamos } from './ramo'
import type { Placar } from './rede.types'

/** A carga publicada e a unica fonte de leitura. Carga rodando nunca aparece na tela. */
export async function cargaPublicada(companyId: string, raizPowerId: number) {
  return prisma.redeCarga.findFirst({
    where: { companyId, raizPowerId, publicada: true },
    orderBy: { concluidaEm: 'desc' },
  })
}

/** Resolve qual raiz o usuario logado enxerga: a que aponta pro user_id dele. */
export async function resolverRaizDoUsuario(companyId: string, userId: string) {
  return prisma.redeConsultor.findFirst({
    where: { companyId, userId, nivelRaiz: 0 },
    select: { powerId: true, nome: true, cpf: true },
  })
}

export interface FiltrosPlacas {
  mesContrato?: string
  mesPagamento?: string
  status?: 'paga' | 'inadimplente'
  cpfConsultor?: string
  nivel?: number
  escopo?: 'proprias' | 'equipe' | 'tudo'
  busca?: string
}

async function niveisPorCpf(cargaId: string): Promise<Map<string, number>> {
  const pessoas = await prisma.redeConsultor.findMany({
    where: { cargaId },
    select: { cpf: true, nivelRaiz: true },
  })
  return new Map(pessoas.map((p) => [p.cpf, p.nivelRaiz]))
}

export async function arvore(companyId: string, raizPowerId: number) {
  const carga = await cargaPublicada(companyId, raizPowerId)
  if (!carga) return null

  const membros = await prisma.redeConsultor.findMany({
    where: { cargaId: carga.id },
    orderBy: [{ nivelRaiz: 'asc' }, { nome: 'asc' }],
  })

  // Placas por CPF, para o card de cada pessoa e para o total do ramo.
  const agrupado = await prisma.redePlaca.groupBy({
    by: ['cpfConsultor', 'status'],
    where: { cargaId: carga.id },
    _count: { _all: true },
  })
  const placasPorCpf: Record<string, { pagas: number; inadimplentes: number }> = {}
  for (const g of agrupado) {
    const alvo = (placasPorCpf[g.cpfConsultor] ||= { pagas: 0, inadimplentes: 0 })
    if (g.status === 'paga') alvo.pagas = g._count._all
    else alvo.inadimplentes = g._count._all
  }

  const porNivel: Record<number, number> = {}
  for (const m of membros) if (m.nivelRaiz > 0) porNivel[m.nivelRaiz] = (porNivel[m.nivelRaiz] || 0) + 1

  const soPagas: Record<string, number> = {}
  for (const [cpf, v] of Object.entries(placasPorCpf)) soPagas[cpf] = v.pagas
  const ramos = calcularRamos(
    membros.map((m) => ({ powerId: m.powerId, patrocinadorPowerId: m.patrocinadorPowerId, cpf: m.cpf })),
    soPagas,
  )

  return {
    carga: { id: carga.id, atualizadoEm: carga.concluidaEm, totais: carga.totais },
    membros,
    porNivel,
    placasPorCpf,
    ramos: Object.fromEntries(ramos),
  }
}

export async function placar(
  companyId: string,
  raizPowerId: number,
  mesContrato: string,
  mesPagamento: string,
): Promise<Placar | null> {
  const carga = await cargaPublicada(companyId, raizPowerId)
  if (!carga) return null

  const placas = await prisma.redePlaca.findMany({
    where: { cargaId: carga.id, mesContrato, mesPagamento, status: 'paga' },
  })

  return calcularPlacar(
    placas.map((p) => ({
      cpfConsultor: p.cpfConsultor, codigoVeiculo: p.codigoVeiculo, placa: p.placa,
      associado: p.associado, telefoneAssociado: p.telefoneAssociado,
      dataContrato: p.dataContrato, mesContrato: p.mesContrato,
      dataPagamento: p.dataPagamento, mesPagamento: p.mesPagamento,
      dataVencimento: p.dataVencimento, diasAtraso: p.diasAtraso,
      valor: p.valor ? Number(p.valor) : null,
      situacaoVeiculo: p.situacaoVeiculo, situacaoBoleto: p.situacaoBoleto,
      status: p.status as 'paga' | 'inadimplente',
    })),
    await niveisPorCpf(carga.id),
  )
}

export async function listarPlacas(companyId: string, raizPowerId: number, f: FiltrosPlacas) {
  const carga = await cargaPublicada(companyId, raizPowerId)
  if (!carga) return { carga: null, placas: [] }

  const niveis = await niveisPorCpf(carga.id)
  const pessoas = await prisma.redeConsultor.findMany({
    where: { cargaId: carga.id },
    select: { cpf: true, nome: true, nivelRaiz: true },
  })
  const pessoaPorCpf = new Map(pessoas.map((p) => [p.cpf, p]))

  const placas = await prisma.redePlaca.findMany({
    where: {
      cargaId: carga.id,
      ...(f.mesContrato ? { mesContrato: f.mesContrato } : {}),
      ...(f.mesPagamento && f.status !== 'inadimplente' ? { mesPagamento: f.mesPagamento } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.cpfConsultor ? { cpfConsultor: f.cpfConsultor } : {}),
      ...(f.busca
        ? {
            OR: [
              { placa: { contains: f.busca, mode: 'insensitive' as const } },
              { associado: { contains: f.busca, mode: 'insensitive' as const } },
              { telefoneAssociado: { contains: f.busca } },
            ],
          }
        : {}),
    },
    orderBy: [{ dataContrato: 'asc' }, { associado: 'asc' }],
  })

  const comConsultor = placas
    .map((p) => {
      const pessoa = pessoaPorCpf.get(p.cpfConsultor)
      return {
        ...p,
        valor: p.valor ? Number(p.valor) : null,
        consultor: pessoa?.nome ?? '(fora da rede)',
        nivel: niveis.get(p.cpfConsultor) ?? null,
      }
    })
    .filter((p) => {
      if (f.nivel != null && p.nivel !== f.nivel) return false
      if (f.escopo === 'proprias' && p.nivel !== 0) return false
      if (f.escopo === 'equipe' && p.nivel === 0) return false
      return true
    })

  return { carga: { id: carga.id, atualizadoEm: carga.concluidaEm }, placas: comConsultor }
}
