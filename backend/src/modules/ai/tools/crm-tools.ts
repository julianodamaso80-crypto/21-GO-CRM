/**
 * Ferramentas (tools) que o agente de IA do dashboard usa pra consultar dados reais.
 * Cada tool tem uma definicao JSON Schema (pra Claude saber chamar) + um handler (executa a query Prisma).
 */
import { prisma } from '../../../config/database'

export interface ToolContext {
  companyId: string
}

export interface ToolDefinition {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, any>
    required?: string[]
  }
}

const periodDaysSchema = {
  period_days: {
    type: 'number',
    description: 'Quantidade de dias do período a partir de hoje. Use 1 pra "hoje", 7 pra "última semana", 30 pra "último mês", 90 pra "últimos 3 meses".',
  },
}

export const CRM_TOOLS: ToolDefinition[] = [
  {
    name: 'get_vendas_periodo',
    description: 'Retorna quantidade de adesões (vendas fechadas), receita gerada e ticket médio num período. Use quando o usuário pergunta sobre vendas, faturamento, receita, quantas adesões, quantos fechou.',
    input_schema: {
      type: 'object',
      properties: periodDaysSchema,
      required: ['period_days'],
    },
  },
  {
    name: 'get_leads_por_origem',
    description: 'Retorna quantos leads chegaram de cada origem (Google Ads, Meta Ads, Instagram, orgânico, indicação, WhatsApp, direto) no período, com taxa de aprovação por canal. Use quando perguntam sobre origem dos leads, de onde vêm, qual canal trouxe mais leads.',
    input_schema: {
      type: 'object',
      properties: periodDaysSchema,
      required: ['period_days'],
    },
  },
  {
    name: 'get_ranking_canais',
    description: 'Retorna ranking dos canais de mídia ordenado por TAXA DE CONVERSÃO (% de leads que viraram clientes), não por volume. Use quando perguntam qual anúncio/canal está performando melhor, onde investir verba de mídia, qual a melhor mídia paga.',
    input_schema: {
      type: 'object',
      properties: periodDaysSchema,
      required: ['period_days'],
    },
  },
  {
    name: 'get_comparativo_periodos',
    description: 'Compara uma métrica entre o período atual e o período imediatamente anterior (mesma duração). Use quando perguntam "vs semana passada", "comparado ao mês anterior", "estamos melhores ou piores".',
    input_schema: {
      type: 'object',
      properties: {
        metric: {
          type: 'string',
          enum: ['leads', 'vendas', 'receita', 'sinistros'],
          description: 'Métrica a comparar.',
        },
        period_days: {
          type: 'number',
          description: 'Tamanho do período em dias (ex: 7 compara última semana vs semana anterior).',
        },
      },
      required: ['metric', 'period_days'],
    },
  },
  {
    name: 'get_sinistros_periodo',
    description: 'Retorna total de sinistros abertos no período, separados por status (aberto, em análise, encerrado). Use quando perguntam sobre sinistros, ocorrências, batidas, roubos.',
    input_schema: {
      type: 'object',
      properties: periodDaysSchema,
      required: ['period_days'],
    },
  },
]

const periodRange = (period_days: number) => {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - period_days)
  return { start, end }
}

const previousPeriodRange = (period_days: number) => {
  const { start: currentStart } = periodRange(period_days)
  const prevEnd = new Date(currentStart)
  const prevStart = new Date(prevEnd)
  prevStart.setDate(prevStart.getDate() - period_days)
  return { start: prevStart, end: prevEnd }
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

export async function executeToolCall(
  toolName: string,
  input: Record<string, any>,
  ctx: ToolContext,
): Promise<string> {
  const { companyId } = ctx

  switch (toolName) {
    case 'get_vendas_periodo': {
      const { start, end } = periodRange(input.period_days)
      const wonCards = await prisma.card.findMany({
        where: {
          companyId,
          completedAt: { gte: start, lte: end },
          currentPhase: { isWon: true },
        },
        include: {
          lead: { select: { valorCompra: true, cotacaoValor: true } },
        },
      })
      let receita = 0
      for (const c of wonCards) {
        const v = c.lead?.valorCompra ?? c.lead?.cotacaoValor ?? 0
        receita += v
      }
      const totalVendas = wonCards.length
      const ticketMedio = totalVendas > 0 ? receita / totalVendas : 0
      return JSON.stringify({
        periodo_dias: input.period_days,
        total_vendas: totalVendas,
        receita_gerada: fmtBRL(receita),
        receita_numerica: Math.round(receita * 100) / 100,
        ticket_medio: fmtBRL(ticketMedio),
        nota: receita === 0 && totalVendas > 0
          ? 'Vendas fechadas mas sem valor de compra/cotação preenchido nos leads — receita pode estar subestimada.'
          : undefined,
      })
    }

    case 'get_leads_por_origem': {
      const { start, end } = periodRange(input.period_days)
      const grouped = await prisma.lead.groupBy({
        by: ['origem'],
        where: { companyId, createdAt: { gte: start, lte: end } },
        _count: { id: true },
      })
      const result = await Promise.all(
        grouped.map(async (g) => {
          const aprovados = await prisma.lead.count({
            where: {
              companyId,
              createdAt: { gte: start, lte: end },
              origem: g.origem,
              cards: { some: { currentPhase: { isWon: true } } },
            },
          })
          return {
            origem: g.origem || 'desconhecido',
            leads_recebidos: g._count.id,
            leads_aprovados: aprovados,
            conversao_pct: g._count.id > 0 ? Math.round((aprovados / g._count.id) * 10000) / 100 : 0,
          }
        }),
      )
      return JSON.stringify({
        periodo_dias: input.period_days,
        total_leads: result.reduce((s, r) => s + r.leads_recebidos, 0),
        total_aprovados: result.reduce((s, r) => s + r.leads_aprovados, 0),
        por_origem: result.sort((a, b) => b.leads_recebidos - a.leads_recebidos),
      })
    }

    case 'get_ranking_canais': {
      const { start, end } = periodRange(input.period_days)
      const grouped = await prisma.lead.groupBy({
        by: ['origem'],
        where: { companyId, createdAt: { gte: start, lte: end } },
        _count: { id: true },
      })
      const result = await Promise.all(
        grouped.map(async (g) => {
          const aprovados = await prisma.lead.count({
            where: {
              companyId,
              createdAt: { gte: start, lte: end },
              origem: g.origem,
              cards: { some: { currentPhase: { isWon: true } } },
            },
          })
          return {
            canal: g.origem || 'desconhecido',
            leads: g._count.id,
            aprovados,
            conversao_pct: g._count.id > 0 ? Math.round((aprovados / g._count.id) * 10000) / 100 : 0,
          }
        }),
      )
      const ranked = result
        .filter((r) => r.leads >= 3)
        .sort((a, b) => b.conversao_pct - a.conversao_pct)
      return JSON.stringify({
        periodo_dias: input.period_days,
        criterio: 'taxa de conversão (mín. 3 leads por canal pra ter significância)',
        ranking: ranked,
        canais_descartados: result.filter((r) => r.leads < 3).map((r) => ({ canal: r.canal, leads: r.leads })),
      })
    }

    case 'get_comparativo_periodos': {
      const { start: curStart, end: curEnd } = periodRange(input.period_days)
      const { start: prevStart, end: prevEnd } = previousPeriodRange(input.period_days)
      const metric = input.metric as string

      const countMetric = async (start: Date, end: Date): Promise<{ count: number; valor?: number }> => {
        if (metric === 'leads') {
          const c = await prisma.lead.count({ where: { companyId, createdAt: { gte: start, lte: end } } })
          return { count: c }
        }
        if (metric === 'vendas') {
          const c = await prisma.card.count({
            where: { companyId, completedAt: { gte: start, lte: end }, currentPhase: { isWon: true } },
          })
          return { count: c }
        }
        if (metric === 'receita') {
          const cards = await prisma.card.findMany({
            where: { companyId, completedAt: { gte: start, lte: end }, currentPhase: { isWon: true } },
            include: { lead: { select: { valorCompra: true, cotacaoValor: true } } },
          })
          const receita = cards.reduce(
            (s, c) => s + (c.lead?.valorCompra ?? c.lead?.cotacaoValor ?? 0),
            0,
          )
          return { count: cards.length, valor: receita }
        }
        if (metric === 'sinistros') {
          const c = await prisma.sinistro.count({
            where: { companyId, dataOcorrencia: { gte: start, lte: end } },
          })
          return { count: c }
        }
        return { count: 0 }
      }

      const atual = await countMetric(curStart, curEnd)
      const anterior = await countMetric(prevStart, prevEnd)
      const valorAtual = atual.valor ?? atual.count
      const valorAnterior = anterior.valor ?? anterior.count
      const delta = valorAtual - valorAnterior
      const deltaPct = valorAnterior > 0 ? Math.round((delta / valorAnterior) * 10000) / 100 : null

      return JSON.stringify({
        metrica: metric,
        periodo_dias: input.period_days,
        atual: metric === 'receita' ? fmtBRL(valorAtual) : valorAtual,
        anterior: metric === 'receita' ? fmtBRL(valorAnterior) : valorAnterior,
        delta: metric === 'receita' ? fmtBRL(delta) : delta,
        delta_pct: deltaPct,
        tendencia: delta > 0 ? 'subiu' : delta < 0 ? 'caiu' : 'estavel',
      })
    }

    case 'get_sinistros_periodo': {
      const { start, end } = periodRange(input.period_days)
      const sinistros = await prisma.sinistro.findMany({
        where: { companyId, dataOcorrencia: { gte: start, lte: end } },
        select: { status: true, custoEstimado: true, custoReal: true, tipo: true },
      })
      const byStatus = sinistros.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1
        return acc
      }, {})
      const byTipo = sinistros.reduce<Record<string, number>>((acc, s) => {
        acc[s.tipo || 'desconhecido'] = (acc[s.tipo || 'desconhecido'] || 0) + 1
        return acc
      }, {})
      const custoTotal = sinistros.reduce(
        (s, x) => s + (x.custoReal ?? x.custoEstimado ?? 0),
        0,
      )
      return JSON.stringify({
        periodo_dias: input.period_days,
        total: sinistros.length,
        por_status: byStatus,
        por_tipo: byTipo,
        custo_total: fmtBRL(custoTotal),
      })
    }

    default:
      return JSON.stringify({ erro: `Ferramenta desconhecida: ${toolName}` })
  }
}
