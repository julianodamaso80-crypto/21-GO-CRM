import { randomUUID } from 'node:crypto'
import { prisma } from '../../../config/database'
import { coletarRede } from './coletor-rede'
import { coletarPlacasDoMes } from './coletor-placas'
import { coletarBoletosPagos, coletarBoletosVencidos } from './coletor-boletos'
import { cruzarPlacas } from './cruzamento'
import { autenticarSga } from '../clients/sga.client'
import { contarPorNivel } from '../arvore'

const soDigitos = (s?: string | null) => String(s || '').replace(/\D/g, '')

export interface ParamsSync {
  /** Gerado pelo controller para poder devolver o id na hora, antes da carga terminar. */
  cargaId?: string
  companyId: string
  raizPowerId: number
  raizNome: string
  raizCpf: string
  disparadaPor: string
  mesContrato: string
  mesPagamento: string
}

async function marcarEtapa(cargaId: string, etapa: string) {
  await prisma.redeCarga.update({ where: { id: cargaId }, data: { etapa } })
}

/**
 * Roda a carga inteira em staging e publica atomicamente no fim.
 *
 * Publica tudo ou nao publica nada: se qualquer etapa falhar, a carga fica com status
 * `falhou` e a carga publicada anterior continua intacta. Foi o token do SGA caindo no meio
 * que fez junho sair 3.473 em vez de 3.549 — sem isso, aquele numero teria virado tela.
 */
export async function sincronizar(p: ParamsSync): Promise<string> {
  const carga = await prisma.redeCarga.create({
    data: {
      id: p.cargaId ?? randomUUID(),
      companyId: p.companyId,
      raizPowerId: p.raizPowerId,
      disparadaPor: p.disparadaPor,
      etapa: 'rede',
      status: 'rodando',
    },
  })

  try {
    // 1) Rede
    const membros = await coletarRede({ powerId: p.raizPowerId, nome: p.raizNome })
    await prisma.redeConsultor.createMany({
      data: [
        {
          id: randomUUID(), companyId: p.companyId, cargaId: carga.id, powerId: p.raizPowerId,
          cpf: p.raizCpf, nome: p.raizNome, nomeTratamento: p.raizNome, email: null, celular: null,
          funcao: null, cooperativa: null, patrocinadorPowerId: null, nivelRaiz: 0,
          raizPowerId: p.raizPowerId, caminho: p.raizNome, status: 'ativo', userId: null,
        },
        ...membros.map((m) => ({
          id: randomUUID(), companyId: p.companyId, cargaId: carga.id, powerId: m.powerId,
          cpf: m.cpf, nome: m.nome, nomeTratamento: m.nomeTratamento, email: m.email,
          celular: m.celular, funcao: m.funcao, cooperativa: m.cooperativa,
          patrocinadorPowerId: m.patrocinadorPowerId, nivelRaiz: m.nivelRaiz,
          raizPowerId: p.raizPowerId, caminho: m.caminho, status: m.status, userId: null,
        })),
      ],
    })

    // 2) Placas e boletos
    await marcarEtapa(carga.id, 'placas')
    const token = await autenticarSga()
    const veiculos = await coletarPlacasDoMes(p.mesContrato, token)

    await marcarEtapa(carga.id, 'boletos')
    const pagos = await coletarBoletosPagos(p.mesPagamento, token)
    const vencidos = await coletarBoletosVencidos(p.mesPagamento, token)

    const cpfsDaRede = new Set([p.raizCpf, ...membros.map((m) => m.cpf)])
    const placas = cruzarPlacas(veiculos, pagos, vencidos, new Date())
      .filter((pl) => cpfsDaRede.has(pl.cpfConsultor))

    await prisma.redePlaca.createMany({
      data: placas.map((pl) => ({
        id: randomUUID(), companyId: p.companyId, cargaId: carga.id,
        cpfConsultor: pl.cpfConsultor, codigoVeiculo: pl.codigoVeiculo, placa: pl.placa,
        associado: pl.associado, telefoneAssociado: pl.telefoneAssociado,
        dataContrato: pl.dataContrato, mesContrato: pl.mesContrato,
        dataPagamento: pl.dataPagamento, mesPagamento: pl.mesPagamento,
        dataVencimento: pl.dataVencimento, diasAtraso: pl.diasAtraso, valor: pl.valor,
        situacaoVeiculo: pl.situacaoVeiculo, situacaoBoleto: pl.situacaoBoleto, status: pl.status,
      })),
    })

    // 3) Publicacao atomica: despublica a anterior e publica esta, na mesma transacao.
    await marcarEtapa(carga.id, 'publicando')
    const totais = {
      pessoas: membros.length,
      porNivel: contarPorNivel(membros),
      placas: placas.length,
      pagas: placas.filter((x) => x.status === 'paga').length,
      inadimplentes: placas.filter((x) => x.status === 'inadimplente').length,
      veiculosLidos: veiculos.length,
      descartadasSemCpf: veiculos.filter((v) => !soDigitos(v.cpf_voluntario)).length,
    }

    await prisma.$transaction([
      prisma.redeCarga.updateMany({
        where: { companyId: p.companyId, raizPowerId: p.raizPowerId, publicada: true },
        data: { publicada: false },
      }),
      prisma.redeCarga.update({
        where: { id: carga.id },
        data: { publicada: true, status: 'publicada', etapa: 'fim', concluidaEm: new Date(), totais },
      }),
    ])

    return carga.id
  } catch (err) {
    await prisma.redeCarga.update({
      where: { id: carga.id },
      data: { status: 'falhou', concluidaEm: new Date(), erro: (err as Error).message.slice(0, 500) },
    })
    throw err
  }
}

export async function progressoDaCarga(cargaId: string, companyId: string) {
  return prisma.redeCarga.findFirst({ where: { id: cargaId, companyId } })
}
