import { prisma } from '../../config/database'
import { getStateFromPhone, UF_TO_NAME } from '../../utils/phone-state'
import { inferVehicleType } from '../../utils/infer-vehicle-type'
import { ownerWhere, type AuthUser } from '../../utils/scope'

export interface AnalyticsFilters {
  startDate?: string
  endDate?: string
  source?: string
  campaign?: string
  platform?: string
  pipelineId?: string
  groupBy?: string
  metric?: string
  granularity?: string
  sortBy?: string
}

export class AnalyticsService {
  private buildDateFilter(filters: AnalyticsFilters): { gte?: Date; lte?: Date } {
    const dateFilter: { gte?: Date; lte?: Date } = {}
    if (filters.startDate) dateFilter.gte = new Date(filters.startDate)
    if (filters.endDate) dateFilter.lte = new Date(filters.endDate)
    if (!filters.startDate && !filters.endDate) {
      dateFilter.gte = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      dateFilter.lte = new Date()
    }
    return dateFilter
  }

  async getOverview(companyId: string, filters: AnalyticsFilters) {
    const dateFilter = this.buildDateFilter(filters)

    const [totalLeads, leadsInPeriod, totalAssociados, totalVehicles, totalSinistros] =
      await Promise.all([
        prisma.lead.count({ where: { companyId } }),
        prisma.lead.count({
          where: { companyId, createdAt: dateFilter },
        }),
        prisma.associado.count({ where: { companyId, status: 'ativo' } }),
        prisma.vehicle.count({ where: { companyId, ativo: true } }),
        prisma.sinistro.count({ where: { companyId } }),
      ])

    const fechados = await prisma.lead.count({
      where: { companyId, etapaFunil: 'fechado', createdAt: dateFilter },
    })

    const conversionRate = leadsInPeriod > 0 ? (fechados / leadsInPeriod) * 100 : 0

    return {
      totalLeads,
      leadsInPeriod,
      convertedLeads: fechados,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalAssociados,
      totalVehicles,
      totalSinistros,
      totalSpend: 0,
      cpl: 0,
      cpa: 0,
      topSource: null,
      topCampaign: null,
    }
  }

  async getLeadsBySource(companyId: string, filters: AnalyticsFilters, user?: AuthUser) {
    const dateFilter = this.buildDateFilter(filters)
    const scope = ownerWhere(user)

    const sources = await prisma.lead.groupBy({
      by: ['origem'],
      where: { companyId, ...scope, createdAt: dateFilter },
      _count: { id: true },
    })

    const data = await Promise.all(
      sources.map(async (s) => {
        const [qualified, approved] = await Promise.all([
          prisma.lead.count({
            where: {
              companyId,
              ...scope,
              createdAt: dateFilter,
              origem: s.origem,
              etapaFunil: { in: ['qualificado', 'cotacao_enviada', 'negociacao', 'fechado'] },
            },
          }),
          prisma.lead.count({
            where: {
              companyId,
              ...scope,
              createdAt: dateFilter,
              origem: s.origem,
              cards: { some: { currentPhase: { isWon: true } } },
            },
          }),
        ])
        const conversionRate = s._count.id > 0 ? (approved / s._count.id) * 100 : 0
        return {
          source: s.origem || 'desconhecido',
          leads: s._count.id,
          qualified,
          converted: approved,
          conversionRate: Math.round(conversionRate * 100) / 100,
          revenue: 0,
          avgDealValue: 0,
          avgTimeToConvert: 0,
        }
      }),
    )

    const sorted = data.sort((a, b) => b.leads - a.leads)
    const totals = sorted.reduce(
      (acc, s) => ({
        leads: acc.leads + s.leads,
        converted: acc.converted + s.converted,
        revenue: acc.revenue + s.revenue,
      }),
      { leads: 0, converted: 0, revenue: 0 },
    )

    return { data: sorted, totals }
  }

  async getCampaignPerformance(companyId: string, filters: AnalyticsFilters) {
    const dateFilter = this.buildDateFilter(filters)

    const campaigns = await prisma.lead.groupBy({
      by: ['utmCampaign'],
      where: { companyId, createdAt: dateFilter, utmCampaign: { not: null } },
      _count: { id: true },
    })

    return campaigns.map(c => ({
      campaign: c.utmCampaign,
      leads: c._count.id,
      conversions: 0,
      spend: 0,
      cpl: 0,
      cpa: 0,
      roas: 0,
    }))
  }

  async getPipelineAnalytics(companyId: string, _filters: AnalyticsFilters) {
    const funnelStages = await prisma.lead.groupBy({
      by: ['etapaFunil'],
      where: { companyId },
      _count: { id: true },
    })

    const stages = funnelStages.map(s => ({
      name: s.etapaFunil,
      count: s._count.id,
      color: '#1B4DA1',
    }))

    return {
      stages,
      totalActiveCards: stages.reduce((sum, s) => sum + s.count, 0),
      avgTimeInStage: 0,
      bottleneck: null,
    }
  }

  async getRevenueAnalytics(companyId: string, _filters: AnalyticsFilters) {
    const associadosAtivos = await prisma.associado.count({ where: { companyId, status: 'ativo' } })

    const vehicles = await prisma.vehicle.findMany({
      where: { companyId, ativo: true },
      select: { valorMensal: true },
    })

    const mrr = vehicles.reduce((sum, v) => sum + (v.valorMensal || 0), 0)

    return {
      mrr: Math.round(mrr * 100) / 100,
      arr: Math.round(mrr * 12 * 100) / 100,
      associadosAtivos,
      totalVehicles: vehicles.length,
      avgTicket: vehicles.length > 0 ? Math.round((mrr / vehicles.length) * 100) / 100 : 0,
      byPeriod: [],
    }
  }

  async getPlatformROI(companyId: string, _filters: AnalyticsFilters) {
    return {
      platforms: [],
      summary: { totalSpend: 0, totalRevenue: 0, overallROAS: 0 },
    }
  }

  async getTimeSeries(companyId: string, filters: AnalyticsFilters) {
    const metric = filters.metric || 'leads'
    const data: Array<{ date: string; value: number }> = []

    for (let i = 29; i >= 0; i--) {
      const dayStart = new Date()
      dayStart.setHours(0, 0, 0, 0)
      dayStart.setDate(dayStart.getDate() - i)

      const dayEnd = new Date(dayStart)
      dayEnd.setHours(23, 59, 59, 999)

      let value = 0
      if (metric === 'leads') {
        value = await prisma.lead.count({
          where: { companyId, createdAt: { gte: dayStart, lte: dayEnd } },
        })
      } else if (metric === 'associados') {
        value = await prisma.associado.count({
          where: { companyId, createdAt: { gte: dayStart, lte: dayEnd } },
        })
      }

      data.push({
        date: dayStart.toISOString().split('T')[0],
        value,
      })
    }

    return { metric, data }
  }

  /**
   * Agrupa leads por UF (extraída do DDD do telefone) com taxa de aprovação.
   * Telefones formato 55DDXXXXXXXXX. Leads sem telefone ou DDD desconhecido
   * caem em "desconhecido".
   */
  async getLeadsByState(companyId: string, filters: AnalyticsFilters, user?: AuthUser) {
    const dateFilter = this.buildDateFilter(filters)

    const leads = await prisma.lead.findMany({
      where: { companyId, ...ownerWhere(user), createdAt: dateFilter },
      select: {
        id: true,
        telefone: true,
        whatsapp: true,
        cards: { select: { currentPhase: { select: { isWon: true } } } },
      },
    })

    const byState = new Map<string, { leads: number; aprovados: number }>()

    for (const lead of leads) {
      const uf = getStateFromPhone(lead.telefone) ?? getStateFromPhone(lead.whatsapp) ?? 'desconhecido'
      const isApproved = lead.cards.some((c) => c.currentPhase?.isWon === true)
      const cur = byState.get(uf) ?? { leads: 0, aprovados: 0 }
      cur.leads += 1
      if (isApproved) cur.aprovados += 1
      byState.set(uf, cur)
    }

    const data = Array.from(byState.entries())
      .map(([uf, v]) => ({
        uf,
        estado: uf === 'desconhecido' ? 'Sem DDD identificado' : (UF_TO_NAME[uf] ?? uf),
        leads: v.leads,
        aprovados: v.aprovados,
        conversao: v.leads > 0 ? Math.round((v.aprovados / v.leads) * 10000) / 100 : 0,
      }))
      .sort((a, b) => b.leads - a.leads)

    const totals = data.reduce(
      (acc, s) => ({ leads: acc.leads + s.leads, aprovados: acc.aprovados + s.aprovados }),
      { leads: 0, aprovados: 0 },
    )

    return { data, totals }
  }

  /**
   * Agrupa leads por tipo de veículo (carro/moto/indefinido) inferido
   * da marca + modelo de interesse. Mostra aprovações por tipo.
   */
  async getLeadsByVehicleType(companyId: string, filters: AnalyticsFilters, user?: AuthUser) {
    const dateFilter = this.buildDateFilter(filters)

    const leads = await prisma.lead.findMany({
      where: { companyId, ...ownerWhere(user), createdAt: dateFilter },
      select: {
        marcaInteresse: true,
        modeloInteresse: true,
        cards: { select: { currentPhase: { select: { isWon: true } } } },
      },
    })

    const byType: Record<string, { leads: number; aprovados: number }> = {
      carro: { leads: 0, aprovados: 0 },
      moto: { leads: 0, aprovados: 0 },
      indefinido: { leads: 0, aprovados: 0 },
    }

    for (const lead of leads) {
      const tipo = inferVehicleType(lead.marcaInteresse, lead.modeloInteresse) ?? 'indefinido'
      const isApproved = lead.cards.some((c) => c.currentPhase?.isWon === true)
      byType[tipo].leads += 1
      if (isApproved) byType[tipo].aprovados += 1
    }

    const data = (['carro', 'moto', 'indefinido'] as const).map((tipo) => ({
      tipo,
      label: tipo === 'carro' ? 'Carro' : tipo === 'moto' ? 'Moto' : 'Indefinido',
      leads: byType[tipo].leads,
      aprovados: byType[tipo].aprovados,
      conversao: byType[tipo].leads > 0
        ? Math.round((byType[tipo].aprovados / byType[tipo].leads) * 10000) / 100
        : 0,
    }))

    const totals = data.reduce(
      (acc, s) => ({ leads: acc.leads + s.leads, aprovados: acc.aprovados + s.aprovados }),
      { leads: 0, aprovados: 0 },
    )

    return { data, totals }
  }

  // ---------------------------------------------------------------------------
  // Aliases pra bater com os nomes que o AnalyticsController chama.
  // Service tinha nomes descritivos (getLeadsBySource, getCampaignPerformance),
  // controller chamava getSources/getCampaigns/etc → 500 em produção.
  // ---------------------------------------------------------------------------

  async getSources(companyId: string, filters: AnalyticsFilters, user?: AuthUser) {
    return this.getLeadsBySource(companyId, filters, user)
  }

  async getCampaigns(companyId: string, filters: AnalyticsFilters) {
    return this.getCampaignPerformance(companyId, filters)
  }

  async getFunnel(companyId: string, filters: AnalyticsFilters) {
    return this.getPipelineAnalytics(companyId, filters)
  }

  async getLTV(companyId: string, filters: AnalyticsFilters) {
    return this.getRevenueAnalytics(companyId, filters)
  }

  async getROI(companyId: string, filters: AnalyticsFilters) {
    return this.getPlatformROI(companyId, filters)
  }

  async getTrends(companyId: string, filters: AnalyticsFilters) {
    return this.getTimeSeries(companyId, filters)
  }
}
