import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'
import { ownerWhere, ownerWhereVia, type AuthUser } from '../../utils/scope'

export interface CreateAssociadoDTO {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  whatsapp?: string
  cpf?: string
  rg?: string
  dateOfBirth?: string
  address?: string
  bairro?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  status?: string
  dataAdesao?: string
  dataCancelamento?: string
  motivoCancelamento?: string
  hinovaId?: string
  indicadoPor?: string
  vendedorId?: string
  origem?: string
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  tags?: string[]
  customFields?: Record<string, any>
}

export interface UpdateAssociadoDTO extends Partial<CreateAssociadoDTO> {}

export interface ListAssociadosQuery {
  page?: number
  limit?: number
  search?: string
  tags?: string[]
  status?: string
  origem?: string
  sortBy?: 'createdAt' | 'updatedAt' | 'fullName'
  sortOrder?: 'asc' | 'desc'
}

// Transforma Associado do Prisma para formato da API (frontend espera firstName/lastName)
function toApiFormat(a: any) {
  if (!a) return a
  const nameParts = (a.nome || '').split(' ')
  const firstName = nameParts[0] || ''
  const lastName = nameParts.slice(1).join(' ') || ''
  return {
    id: a.id,
    companyId: a.companyId,
    firstName,
    lastName,
    fullName: a.nome,
    email: a.email,
    phone: a.telefone,
    avatar: null,
    cpf: a.cpf,
    rg: a.rg,
    dateOfBirth: a.dataNascimento,
    whatsapp: a.whatsapp,
    address: a.endereco,
    bairro: a.bairro,
    city: a.cidade,
    state: a.uf,
    country: 'BR',
    zipCode: a.cep,
    status: a.status,
    dataAdesao: a.dataAdesao,
    dataCancelamento: a.dataCancelamento,
    motivoCancelamento: a.motivoCancelamento,
    hinovaId: a.hinovaId,
    indicadoPor: a.indicadoPorId,
    vendedorId: a.vendedorId,
    totalIndicacoes: a.totalIndicacoes,
    descontoMgm: a.descontoMgm,
    npsScore: a.npsScore,
    ultimoNps: a.ultimoNps,
    origem: a.origem,
    utmSource: a.utmSource,
    utmMedium: a.utmMedium,
    utmCampaign: a.utmCampaign,
    tags: a.tags,
    customFields: a.customFields,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
    _count: a._count,
    // Nested relations (if present)
    leads: a.leads,
    vehicles: a.vehicles,
    conversations: a.conversations,
    sinistros: a.sinistros,
    cotacoes: a.cotacoes,
  }
}

export class AssociadosService {
  async listAssociados(companyId: string, query: ListAssociadosQuery, user?: AuthUser) {
    const page = Math.max(1, query.page || 1)
    const limit = Math.min(100, Math.max(1, query.limit || 20))
    const skip = (page - 1) * limit

    const where: any = {
      companyId,
      // Escopo por dono: vendedor ve so os seus; admin ve todos
      ...ownerWhere(user),
    }

    if (query.search) {
      where.OR = [
        { nome: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
        { telefone: { contains: query.search } },
        { cpf: { contains: query.search } },
        { whatsapp: { contains: query.search } },
      ]
    }

    if (query.tags && query.tags.length > 0) {
      where.tags = { hasSome: query.tags }
    }

    if (query.status) {
      where.status = query.status
    }

    if (query.origem) {
      where.origem = query.origem
    }

    const orderBy: any = {}
    const sortBy = query.sortBy === 'fullName' ? 'nome' : (query.sortBy || 'createdAt')
    const sortOrder = query.sortOrder || 'desc'
    orderBy[sortBy] = sortOrder

    const [associados, total] = await Promise.all([
      prisma.associado.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          _count: {
            select: {
              leads: true,
              conversations: true,
              vehicles: true,
            },
          },
        },
      }),
      prisma.associado.count({ where }),
    ])

    const totalPages = Math.ceil(total / limit)

    return {
      data: associados.map(toApiFormat),
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

  async getAssociadoById(id: string, companyId: string, user?: AuthUser) {
    const associado = await prisma.associado.findFirst({
      where: { id, companyId, ...ownerWhere(user) },
      include: {
        leads: {
          select: {
            id: true,
            nome: true,
            etapaFunil: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        vehicles: {
          orderBy: { createdAt: 'desc' },
        },
        conversations: {
          select: {
            id: true,
            status: true,
            channel: true,
            lastMessageAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        sinistros: {
          select: {
            id: true,
            tipo: true,
            status: true,
            dataAbertura: true,
          },
          orderBy: { dataAbertura: 'desc' },
          take: 10,
        },
        cotacoes: {
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    })

    if (!associado) {
      throw new AppError('Associado nao encontrado', 404, 'NOT_FOUND')
    }

    return toApiFormat(associado)
  }

  async createAssociado(companyId: string, data: CreateAssociadoDTO) {
    const nome = [data.firstName, data.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || 'Sem nome'

    if (data.cpf) {
      const existingCpf = await prisma.associado.findFirst({
        where: { companyId, cpf: data.cpf },
      })
      if (existingCpf) {
        throw new AppError('Ja existe um associado com este CPF', 400, 'DUPLICATE_CPF')
      }
    }

    if (data.email) {
      const existingEmail = await prisma.associado.findFirst({
        where: { companyId, email: data.email },
      })
      if (existingEmail) {
        throw new AppError('Ja existe um associado com este email', 400, 'DUPLICATE_EMAIL')
      }
    }

    const associado = await prisma.associado.create({
      data: {
        companyId,
        nome,
        email: data.email,
        telefone: data.phone,
        whatsapp: data.whatsapp,
        cpf: data.cpf,
        rg: data.rg,
        dataNascimento: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        endereco: data.address,
        bairro: data.bairro,
        cidade: data.city,
        uf: data.state,
        cep: data.zipCode,
        status: data.status || 'em_adesao',
        dataAdesao: data.dataAdesao ? new Date(data.dataAdesao) : undefined,
        dataCancelamento: data.dataCancelamento ? new Date(data.dataCancelamento) : undefined,
        motivoCancelamento: data.motivoCancelamento,
        hinovaId: data.hinovaId,
        indicadoPorId: data.indicadoPor,
        vendedorId: data.vendedorId,
        origem: data.origem,
        utmSource: data.utmSource,
        utmMedium: data.utmMedium,
        utmCampaign: data.utmCampaign,
        tags: data.tags || [],
        customFields: data.customFields || {},
      },
    })

    return toApiFormat(associado)
  }

  async updateAssociado(id: string, companyId: string, data: UpdateAssociadoDTO) {
    const existing = await prisma.associado.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      throw new AppError('Associado nao encontrado', 404, 'NOT_FOUND')
    }

    if (data.cpf && data.cpf !== existing.cpf) {
      const cpfExists = await prisma.associado.findFirst({
        where: { companyId, cpf: data.cpf, id: { not: id } },
      })
      if (cpfExists) {
        throw new AppError('Ja existe um associado com este CPF', 400, 'DUPLICATE_CPF')
      }
    }

    if (data.email && data.email !== existing.email) {
      const emailExists = await prisma.associado.findFirst({
        where: { companyId, email: data.email, id: { not: id } },
      })
      if (emailExists) {
        throw new AppError('Ja existe um associado com este email', 400, 'DUPLICATE_EMAIL')
      }
    }

    let nome = existing.nome
    if (data.firstName !== undefined || data.lastName !== undefined) {
      const existingParts = (existing.nome || '').split(' ')
      const first = data.firstName ?? existingParts[0]
      const last = data.lastName ?? existingParts.slice(1).join(' ')
      nome = [first, last].filter(Boolean).join(' ').trim() || 'Sem nome'
    }

    const updateData: any = {
      nome,
      email: data.email,
      telefone: data.phone,
      whatsapp: data.whatsapp,
      cpf: data.cpf,
      rg: data.rg,
      endereco: data.address,
      bairro: data.bairro,
      cidade: data.city,
      uf: data.state,
      cep: data.zipCode,
      status: data.status,
      motivoCancelamento: data.motivoCancelamento,
      hinovaId: data.hinovaId,
      indicadoPorId: data.indicadoPor,
      vendedorId: data.vendedorId,
      origem: data.origem,
      utmSource: data.utmSource,
      utmMedium: data.utmMedium,
      utmCampaign: data.utmCampaign,
      tags: data.tags,
      customFields: data.customFields,
    }

    // Remove undefined keys
    Object.keys(updateData).forEach(key => {
      if (updateData[key] === undefined) delete updateData[key]
    })

    if (data.dateOfBirth !== undefined) {
      updateData.dataNascimento = data.dateOfBirth ? new Date(data.dateOfBirth) : null
    }
    if (data.dataAdesao !== undefined) {
      updateData.dataAdesao = data.dataAdesao ? new Date(data.dataAdesao) : null
    }
    if (data.dataCancelamento !== undefined) {
      updateData.dataCancelamento = data.dataCancelamento ? new Date(data.dataCancelamento) : null
    }

    const associado = await prisma.associado.update({
      where: { id },
      data: updateData,
    })

    return toApiFormat(associado)
  }

  async deleteAssociado(id: string, companyId: string) {
    const existing = await prisma.associado.findFirst({
      where: { id, companyId },
    })

    if (!existing) {
      throw new AppError('Associado nao encontrado', 404, 'NOT_FOUND')
    }

    await prisma.associado.delete({ where: { id } })

    return { success: true, message: 'Associado excluido com sucesso' }
  }

  async findByEmailOrPhone(companyId: string, email?: string, phone?: string) {
    if (!email && !phone) {
      throw new AppError('Email ou telefone obrigatorio', 400, 'BAD_REQUEST')
    }

    const where: any = { companyId, OR: [] }
    if (email) where.OR.push({ email })
    if (phone) where.OR.push({ telefone: phone })

    const results = await prisma.associado.findMany({ where })
    return results.map(toApiFormat)
  }

  async getUniqueTags(companyId: string) {
    const records = await prisma.associado.findMany({
      where: { companyId },
      select: { tags: true },
    })

    const allTags = records.flatMap((c) => c.tags)
    return [...new Set(allTags)].sort()
  }

  async getStats(companyId: string, user?: AuthUser) {
    // Escopo por dono: vendedor conta so os seus associados/veiculos
    const scope = ownerWhere(user)
    const vehScope = ownerWhereVia(user, 'associado')
    const [total, ativos, inativos, inadimplentes, emAdesao, recentCount, totalVehicles] =
      await Promise.all([
        prisma.associado.count({ where: { companyId, ...scope } }),
        prisma.associado.count({ where: { companyId, ...scope, status: 'ativo' } }),
        prisma.associado.count({ where: { companyId, ...scope, status: 'inativo' } }),
        prisma.associado.count({ where: { companyId, ...scope, status: 'inadimplente' } }),
        prisma.associado.count({ where: { companyId, ...scope, status: 'em_adesao' } }),
        prisma.associado.count({
          where: {
            companyId,
            ...scope,
            createdAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            },
          },
        }),
        prisma.vehicle.count({ where: { companyId, ativo: true, ...vehScope } }),
      ])

    return {
      total,
      ativos,
      inativos,
      inadimplentes,
      emAdesao,
      recentCount,
      totalVehicles,
    }
  }
}
