import { prisma } from '../../config/database'

export type DashboardPeriod = 1 | 7 | 30 | 90 // dias

export class DashboardService {
  async getStats(companyId: string, periodDays: DashboardPeriod = 7) {
    const now = new Date()
    const periodStart = new Date(now.getTime() - periodDays * 86400000)
    const prevPeriodStart = new Date(periodStart.getTime() - periodDays * 86400000)

    // Resolve fases especiais do funil (por nome) — independente do pipe especifico
    const allPhases = await prisma.phase.findMany({
      where: { companyId },
      select: { id: true, name: true, color: true, position: true, isWon: true, isLost: true, pipeId: true },
      orderBy: { position: 'asc' },
    })

    const wonPhaseIds = allPhases.filter((p) => p.isWon).map((p) => p.id)
    const lostPhaseIds = allPhases.filter((p) => p.isLost && /reprov/i.test(p.name)).map((p) => p.id)
    const vistoriaPhaseIds = allPhases.filter((p) => /vistoria/i.test(p.name)).map((p) => p.id)
    const negociacaoPhaseIds = allPhases.filter((p) => /negocia/i.test(p.name)).map((p) => p.id)
    const atendimentoPhaseIds = allPhases.filter((p) => /atendiment/i.test(p.name)).map((p) => p.id)
    const linkVistoriaPhaseIds = allPhases.filter((p) => /mandei.*link|link.*vistoria/i.test(p.name)).map((p) => p.id)
    const aguardandoAprovPhaseIds = allPhases.filter((p) => /aguardando.*aprov/i.test(p.name)).map((p) => p.id)
    const pendenciaPhaseIds = allPhases.filter((p) => /pend[eê]ncia/i.test(p.name)).map((p) => p.id)

    // ----- Cards "won" no periodo + receita -----
    const [cardsWonInPeriod, cardsWonPrevPeriod] = await Promise.all([
      prisma.card.findMany({
        where: {
          companyId,
          currentPhaseId: { in: wonPhaseIds.length ? wonPhaseIds : ['___none___'] },
          completedAt: { gte: periodStart, lte: now },
        },
        select: { id: true, leadId: true, title: true, completedAt: true },
      }),
      prisma.card.count({
        where: {
          companyId,
          currentPhaseId: { in: wonPhaseIds.length ? wonPhaseIds : ['___none___'] },
          completedAt: { gte: prevPeriodStart, lt: periodStart },
        },
      }),
    ])

    const leadIds = cardsWonInPeriod.map((c) => c.leadId).filter(Boolean) as string[]
    const leadsWon = leadIds.length
      ? await prisma.lead.findMany({
          where: { id: { in: leadIds }, companyId },
          select: { id: true, nome: true, valorCompra: true, updatedAt: true, whatsapp: true, telefone: true },
        })
      : []

    const receitaPeriodo = leadsWon.reduce((sum, l) => sum + (l.valorCompra || 0), 0)

    // Receita periodo anterior pra delta
    const prevLeadIds = (
      await prisma.card.findMany({
        where: {
          companyId,
          currentPhaseId: { in: wonPhaseIds.length ? wonPhaseIds : ['___none___'] },
          completedAt: { gte: prevPeriodStart, lt: periodStart },
        },
        select: { leadId: true },
      })
    )
      .map((c) => c.leadId)
      .filter(Boolean) as string[]

    const receitaAnterior = prevLeadIds.length
      ? (
          await prisma.lead.findMany({
            where: { id: { in: prevLeadIds }, companyId },
            select: { valorCompra: true },
          })
        ).reduce((sum, l) => sum + (l.valorCompra || 0), 0)
      : 0

    // ----- Estados ativos (snapshot atual) -----
    const [emVistoria, emNegociacao, emAtendimento, linksVistoria, aguardandoAprovacao, pendenciasCliente] = await Promise.all([
      vistoriaPhaseIds.length
        ? prisma.card.count({ where: { companyId, status: 'active', currentPhaseId: { in: vistoriaPhaseIds } } })
        : 0,
      negociacaoPhaseIds.length
        ? prisma.card.count({ where: { companyId, status: 'active', currentPhaseId: { in: negociacaoPhaseIds } } })
        : 0,
      atendimentoPhaseIds.length
        ? prisma.card.count({ where: { companyId, status: 'active', currentPhaseId: { in: atendimentoPhaseIds } } })
        : 0,
      linkVistoriaPhaseIds.length
        ? prisma.card.count({ where: { companyId, status: 'active', currentPhaseId: { in: linkVistoriaPhaseIds } } })
        : 0,
      aguardandoAprovPhaseIds.length
        ? prisma.card.count({ where: { companyId, status: 'active', currentPhaseId: { in: aguardandoAprovPhaseIds } } })
        : 0,
      pendenciaPhaseIds.length
        ? prisma.card.count({ where: { companyId, status: 'active', currentPhaseId: { in: pendenciaPhaseIds } } })
        : 0,
    ])

    // ----- Reprovados no período (via completedAt em fase isLost com nome "reprov*") -----
    const reprovadosPeriodo = lostPhaseIds.length
      ? await prisma.card.count({
          where: {
            companyId,
            currentPhaseId: { in: lostPhaseIds },
            completedAt: { gte: periodStart, lte: now },
          },
        })
      : 0

    // Próximos a fechar = em negociação + aguardando aprovação de vistoria + link de vistoria enviado
    const prestesAFechar = emNegociacao + aguardandoAprovacao + linksVistoria

    // ----- Associados (tabela associados, status ativo) -----
    const [associadosTotal, associadosAtivos] = await Promise.all([
      prisma.associado.count({ where: { companyId } }),
      prisma.associado.count({ where: { companyId, status: 'ativo' } }),
    ])

    // ----- Entradas no periodo (leads novos) -----
    const [entradasPeriodo, entradasAnterior] = await Promise.all([
      prisma.lead.count({ where: { companyId, createdAt: { gte: periodStart, lte: now } } }),
      prisma.lead.count({
        where: { companyId, createdAt: { gte: prevPeriodStart, lt: periodStart } },
      }),
    ])

    // ----- Funil completo (todas as fases agrupadas, status active+done) -----
    // Pego cards por fase com status active OR done (kanban-style)
    const cardsByPhase = await prisma.card.groupBy({
      by: ['currentPhaseId'],
      where: { companyId, status: { in: ['active', 'done'] } },
      _count: { _all: true },
    })
    const cardCountByPhaseId = new Map(cardsByPhase.map((c) => [c.currentPhaseId, c._count._all]))

    // Funil: mostra todas as fases ordenadas por (pipe ordem, position)
    const pipes = await prisma.pipe.findMany({
      where: { companyId, status: 'active' },
      select: { id: true, name: true },
      orderBy: { createdAt: 'asc' },
    })

    // Funil principal = primeiro pipe ativo (geralmente "Vendas de Associados")
    const mainPipe =
      pipes.find((p) => /associad/i.test(p.name)) ??
      pipes.find((p) => /vendas/i.test(p.name)) ??
      pipes[0]

    const funil = mainPipe
      ? allPhases
          .filter((ph) => ph.pipeId === mainPipe.id)
          .sort((a, b) => a.position - b.position)
          .map((ph) => ({
            id: ph.id,
            name: ph.name,
            color: ph.color,
            count: cardCountByPhaseId.get(ph.id) || 0,
            isWon: ph.isWon,
            isLost: ph.isLost,
          }))
      : []

    // ----- Serie temporal: receita + fechamentos por dia (no periodo) -----
    const seriesDays = Math.min(periodDays, 30)
    const timeline: Array<{ date: string; receita: number; fechados: number; entradas: number }> = []

    for (let i = seriesDays - 1; i >= 0; i--) {
      const dayStart = new Date(now)
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - i)
      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      const dayCards = await prisma.card.findMany({
        where: {
          companyId,
          currentPhaseId: { in: wonPhaseIds.length ? wonPhaseIds : ['___none___'] },
          completedAt: { gte: dayStart, lte: dayEnd },
        },
        select: { leadId: true },
      })

      const dayLeadIds = dayCards.map((c) => c.leadId).filter(Boolean) as string[]
      const dayReceita = dayLeadIds.length
        ? (
            await prisma.lead.findMany({
              where: { id: { in: dayLeadIds } },
              select: { valorCompra: true },
            })
          ).reduce((s, l) => s + (l.valorCompra || 0), 0)
        : 0

      const dayEntradas = await prisma.lead.count({
        where: { companyId, createdAt: { gte: dayStart, lte: dayEnd } },
      })

      timeline.push({
        date: dayStart.toISOString().split('T')[0],
        receita: Math.round(dayReceita * 100) / 100,
        fechados: dayCards.length,
        entradas: dayEntradas,
      })
    }

    // ----- Ultimos fechados -----
    const ultimosFechadosRaw = await prisma.card.findMany({
      where: {
        companyId,
        currentPhaseId: { in: wonPhaseIds.length ? wonPhaseIds : ['___none___'] },
        completedAt: { not: null },
      },
      orderBy: { completedAt: 'desc' },
      take: 8,
      select: { id: true, title: true, completedAt: true, leadId: true },
    })

    const ultFechadosLeadIds = ultimosFechadosRaw
      .map((c) => c.leadId)
      .filter(Boolean) as string[]
    const ultFechadosLeads = ultFechadosLeadIds.length
      ? await prisma.lead.findMany({
          where: { id: { in: ultFechadosLeadIds } },
          select: { id: true, nome: true, valorCompra: true },
        })
      : []
    const leadMap = new Map(ultFechadosLeads.map((l) => [l.id, l]))

    const ultimosFechados = ultimosFechadosRaw.map((c) => {
      const lead = c.leadId ? leadMap.get(c.leadId) : null
      return {
        id: c.id,
        title: c.title,
        nome: lead?.nome || c.title,
        valor: lead?.valorCompra || 0,
        completedAt: c.completedAt,
      }
    })

    // ----- Veiculos protegidos -----
    const veiculosProtegidos = await prisma.vehicle.count({ where: { companyId, ativo: true } })

    // ----- Taxa de conversao: fechados / entradas no periodo -----
    const taxaConversao =
      entradasPeriodo > 0 ? (cardsWonInPeriod.length / entradasPeriodo) * 100 : 0

    // ----- Deltas (%) vs periodo anterior -----
    const calcDelta = (cur: number, prev: number) => {
      if (prev === 0 && cur === 0) return 0
      if (prev === 0) return 100
      return Math.round(((cur - prev) / prev) * 100)
    }

    return {
      periodDays,
      generatedAt: now.toISOString(),
      kpis: {
        fechadosPeriodo: cardsWonInPeriod.length,
        fechadosDelta: calcDelta(cardsWonInPeriod.length, cardsWonPrevPeriod),
        receitaPeriodo: Math.round(receitaPeriodo * 100) / 100,
        receitaDelta: calcDelta(receitaPeriodo, receitaAnterior),
        receitaAnterior: Math.round(receitaAnterior * 100) / 100,
        emVistoria,
        emNegociacao,
        emAtendimento,
        linksVistoria,
        aguardandoAprovacao,
        pendenciasCliente,
        prestesAFechar,
        reprovadosPeriodo,
        entradasPeriodo,
        entradasDelta: calcDelta(entradasPeriodo, entradasAnterior),
        taxaConversao: Math.round(taxaConversao * 10) / 10,
        associadosTotal,
        associadosAtivos,
        veiculosProtegidos,
      },
      funil,
      timeline,
      ultimosFechados,
    }
  }
}
