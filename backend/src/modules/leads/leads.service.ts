import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'

export interface CreateLeadDTO {
  nome: string
  telefone?: string
  email?: string
  whatsapp?: string
  marcaInteresse?: string
  modeloInteresse?: string
  anoInteresse?: number
  cotacaoPlano?: string
  origem?: string
  vendedorId?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
}

export interface UpdateLeadDTO extends Partial<CreateLeadDTO> {
  etapaFunil?: string
  scoreQualificacao?: number
  motivoPerda?: string
  valorFipeConsultado?: number
  cotacaoValor?: number
  cotacaoEnviada?: boolean
  qualificadoPor?: string
  valorCompra?: number
  produtoComprado?: string
}

export interface ListLeadsQuery {
  page?: number
  limit?: number
  search?: string
  status?: string
  source?: string
  etapaFunil?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export class LeadsService {
  async listLeads(companyId: string, query: ListLeadsQuery) {
    const page = Math.max(1, query.page || 1)
    const limit = Math.min(100, Math.max(1, query.limit || 20))
    const skip = (page - 1) * limit

    const where: any = { companyId }

    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { telefone: { contains: query.search } },
      ]
    }

    if (query.etapaFunil || query.status) {
      where.etapaFunil = query.etapaFunil || query.status
    }

    if (query.source) {
      where.origem = query.source
    }

    const orderBy: any = {}
    const sortBy = query.sortBy || 'createdAt'
    const sortOrder = query.sortOrder || 'desc'
    orderBy[sortBy] = sortOrder

    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          vendedor: {
            select: { id: true, firstName: true, lastName: true },
          },
          associado: {
            select: { id: true, nome: true, telefone: true, whatsapp: true, email: true },
          },
        },
      }),
      prisma.lead.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    // Transform to API format matching what frontend expects
    const data = leads.map(l => ({
      id: l.id,
      companyId: l.companyId,
      title: l.nome,
      nome: l.nome,
      telefone: l.telefone,
      email: l.email,
      whatsapp: l.whatsapp,
      status: l.etapaFunil,
      etapaFunil: l.etapaFunil,
      source: l.origem,
      origem: l.origem,
      scoreQualificacao: l.scoreQualificacao,
      score: l.scoreQualificacao,
      marcaInteresse: l.marcaInteresse,
      modeloInteresse: l.modeloInteresse,
      anoInteresse: l.anoInteresse,
      valorFipeConsultado: l.valorFipeConsultado,
      cotacaoValor: l.cotacaoValor,
      cotacaoPlano: l.cotacaoPlano,
      cotacaoEnviada: l.cotacaoEnviada,
      qualificadoPor: l.qualificadoPor,
      motivoPerda: l.motivoPerda,
      vendedorId: l.vendedorId,
      vendedor: l.vendedor,
      associado: l.associado,
      utmSource: l.utmSource,
      utmMedium: l.utmMedium,
      utmCampaign: l.utmCampaign,
      createdAt: l.createdAt,
      updatedAt: l.updatedAt,
      // Frontend espera contact com nome+phone+email. Fallback pros campos do proprio lead
      // (importante pra leads vindos do WhatsApp sem associado vinculado)
      contact: l.associado
        ? {
            id: l.associado.id,
            fullName: l.associado.nome,
            firstName: l.associado.nome?.split(' ')[0] || '',
            lastName: l.associado.nome?.split(' ').slice(1).join(' ') || '',
            phone: l.associado.telefone || l.telefone,
            whatsapp: l.associado.whatsapp || l.whatsapp,
            email: l.associado.email || l.email,
          }
        : {
            id: l.id,
            fullName: l.nome,
            firstName: l.nome?.split(' ')[0] || '',
            lastName: l.nome?.split(' ').slice(1).join(' ') || '',
            phone: l.telefone,
            whatsapp: l.whatsapp,
            email: l.email,
          },
    }))

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    }
  }

  async getLeadById(id: string, companyId: string) {
    const lead = await prisma.lead.findFirst({
      where: { id, companyId },
      include: {
        vendedor: {
          select: { id: true, firstName: true, lastName: true },
        },
        associado: {
          select: { id: true, nome: true },
        },
        cotacoes: true,
      },
    })

    if (!lead) {
      throw new AppError('Lead not found', 404, 'NOT_FOUND')
    }

    return lead
  }

  async createLead(companyId: string, data: CreateLeadDTO) {
    const lead = await prisma.lead.create({
      data: {
        companyId,
        nome: data.nome,
        telefone: data.telefone,
        email: data.email,
        whatsapp: data.whatsapp,
        marcaInteresse: data.marcaInteresse,
        modeloInteresse: data.modeloInteresse,
        anoInteresse: data.anoInteresse,
        cotacaoPlano: data.cotacaoPlano,
        origem: data.origem,
        vendedorId: data.vendedorId,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        etapaFunil: 'novo',
        scoreQualificacao: 0,
      },
    })

    return lead
  }

  async updateLead(id: string, companyId: string, data: UpdateLeadDTO) {
    const existing = await prisma.lead.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      throw new AppError('Lead not found', 404, 'NOT_FOUND')
    }

    const lead = await prisma.lead.update({
      where: { id },
      data: {
        nome: data.nome,
        telefone: data.telefone,
        email: data.email,
        whatsapp: data.whatsapp,
        marcaInteresse: data.marcaInteresse,
        modeloInteresse: data.modeloInteresse,
        anoInteresse: data.anoInteresse,
        etapaFunil: data.etapaFunil,
        scoreQualificacao: data.scoreQualificacao,
        motivoPerda: data.motivoPerda,
        valorFipeConsultado: data.valorFipeConsultado,
        cotacaoValor: data.cotacaoValor,
        cotacaoPlano: data.cotacaoPlano,
        cotacaoEnviada: data.cotacaoEnviada,
        qualificadoPor: data.qualificadoPor,
        origem: data.origem,
        vendedorId: data.vendedorId,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        valorCompra: data.valorCompra,
        produtoComprado: data.produtoComprado,
      },
    })

    return lead
  }

  async deleteLead(id: string, companyId: string) {
    const existing = await prisma.lead.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      throw new AppError('Lead not found', 404, 'NOT_FOUND')
    }

    await prisma.lead.delete({ where: { id } })

    return { success: true, message: 'Lead deleted' }
  }

  async getStats(companyId: string) {
    const [total, novo, qualificado, cotacaoEnviada, negociacao, fechado, perdido] =
      await Promise.all([
        prisma.lead.count({ where: { companyId } }),
        prisma.lead.count({ where: { companyId, etapaFunil: 'novo' } }),
        prisma.lead.count({ where: { companyId, etapaFunil: 'qualificado' } }),
        prisma.lead.count({ where: { companyId, etapaFunil: 'cotacao_enviada' } }),
        prisma.lead.count({ where: { companyId, etapaFunil: 'negociacao' } }),
        prisma.lead.count({ where: { companyId, etapaFunil: 'fechado' } }),
        prisma.lead.count({ where: { companyId, etapaFunil: 'perdido' } }),
      ])

    const byStatus = {
      novo, qualificado, cotacao_enviada: cotacaoEnviada,
      negociacao, fechado, perdido,
      new: novo, contacted: qualificado, qualified: negociacao, unqualified: perdido,
    }

    const conversionRate = total > 0 ? (fechado / total) * 100 : 0

    return {
      total,
      byStatus,
      bySource: {},
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalEstimatedValue: 0,
    }
  }
}
