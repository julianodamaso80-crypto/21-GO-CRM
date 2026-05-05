import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'

export interface CreateNPSSurveyDTO {
  associadoId: string
  score: number
  comment?: string
  channel: string
  tipo?: string
}

export interface ListNPSQuery {
  associadoId?: string
  category?: string
  answered?: string
}

export class NPSService {
  private calculateCategory(score: number): string {
    if (score >= 9) return 'promoter'
    if (score >= 7) return 'passive'
    return 'detractor'
  }

  async listSurveys(companyId: string, query: ListNPSQuery) {
    const where: any = { companyId }

    if (query.associadoId) {
      where.associadoId = query.associadoId
    }

    if (query.answered === 'true') {
      where.respondidoEm = { not: null }
    } else if (query.answered === 'false') {
      where.respondidoEm = null
    }

    const surveys = await prisma.npsSurvey.findMany({
      where,
      include: {
        associado: {
          select: { id: true, nome: true, email: true, telefone: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return surveys.map(s => ({
      ...s,
      category: this.calculateCategory(s.score),
      patient: s.associado ? { id: s.associado.id, fullName: s.associado.nome } : null,
      contact: s.associado ? { id: s.associado.id, fullName: s.associado.nome } : null,
    }))
  }

  async createSurvey(companyId: string, data: CreateNPSSurveyDTO) {
    const survey = await prisma.npsSurvey.create({
      data: {
        companyId,
        associadoId: data.associadoId,
        score: data.score,
        comment: data.comment,
        channel: data.channel,
        tipo: data.tipo || 'periodico',
        respondidoEm: new Date(),
      },
    })

    // Update associado NPS cache
    await prisma.associado.update({
      where: { id: data.associadoId },
      data: {
        npsScore: data.score,
        ultimoNps: new Date(),
      },
    })

    return {
      ...survey,
      category: this.calculateCategory(survey.score),
    }
  }

  async getStats(companyId: string) {
    const surveys = await prisma.npsSurvey.findMany({
      where: { companyId },
      include: { associado: { select: { id: true, nome: true } } },
      orderBy: { createdAt: 'desc' },
    })

    const total = surveys.length
    if (total === 0) {
      return {
        total: 0,
        answered: 0,
        promoters: 0,
        passives: 0,
        detractors: 0,
        npsScore: 0,
        avgScore: 0,
        averageScore: 0,
        responseRate: 0,
        byMonth: [] as Array<{ month: string; nps: number; responses: number }>,
        recentComments: [] as Array<{ id: string; associadoName: string; score: number; category: string; comment: string; date: string }>,
      }
    }

    let promoters = 0
    let passives = 0
    let detractors = 0
    let scoreSum = 0
    let answered = 0

    const monthAgg = new Map<string, { pos: number; neg: number; count: number }>()

    for (const s of surveys) {
      if (s.respondidoEm) answered++
      scoreSum += s.score
      const cat = this.calculateCategory(s.score)
      if (cat === 'promoter') promoters++
      else if (cat === 'passive') passives++
      else detractors++

      const ts = s.respondidoEm || s.createdAt
      const monthKey = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`
      const e = monthAgg.get(monthKey) || { pos: 0, neg: 0, count: 0 }
      if (cat === 'promoter') e.pos++
      if (cat === 'detractor') e.neg++
      e.count++
      monthAgg.set(monthKey, e)
    }

    const npsScore = Math.round(((promoters - detractors) / total) * 100)
    const avgScore = Math.round((scoreSum / total) * 10) / 10
    const responseRate = total > 0 ? Math.round((answered / total) * 100) : 0

    const byMonth = Array.from(monthAgg.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, agg]) => ({
        month,
        nps: agg.count > 0 ? Math.round(((agg.pos - agg.neg) / agg.count) * 100) : 0,
        responses: agg.count,
      }))

    const recentComments = surveys
      .filter(s => s.comment && s.comment.trim().length > 0)
      .slice(0, 8)
      .map(s => ({
        id: s.id,
        associadoName: s.associado?.nome || 'Anonimo',
        score: s.score,
        category: this.calculateCategory(s.score),
        comment: s.comment as string,
        date: (s.respondidoEm || s.createdAt).toISOString(),
      }))

    return {
      total,
      answered,
      promoters,
      passives,
      detractors,
      npsScore,
      avgScore,
      averageScore: avgScore,
      responseRate,
      byMonth,
      recentComments,
    }
  }
}
