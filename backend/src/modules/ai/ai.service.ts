import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'

// ============================================================================
// DTOs
// ============================================================================

export interface CreateKnowledgeBaseDTO {
  name: string
  description?: string
}

export interface CreateAgentDTO {
  name: string
  agentId?: string
  description?: string
  icon?: string
  tier?: number
  squad?: string
  provider: string
  model: string
  temperature?: number
  maxTokens?: number
  systemPrompt: string
  type?: string
  knowledgeBaseId?: string
  allowedRoles?: string[]
  allowedScopes?: string[]
  permissions?: Record<string, boolean>
}

export interface UpdateAgentDTO extends Partial<CreateAgentDTO> {}

export interface QueryLogDTO {
  agentId?: string
  query: string
  response: string
  context?: any
  provider: string
  model: string
  tokensUsed?: number
  latencyMs?: number
  source?: string
}

// ============================================================================
// SERVICE
// ============================================================================

export class AIService {
  // === Knowledge Bases ===

  async listKnowledgeBases(companyId: string) {
    const kbs = await prisma.knowledgeBase.findMany({
      where: { companyId },
      include: {
        documentos: {
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: { documentos: true, agents: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Transform to match frontend API expectations
    return kbs.map(kb => ({
      ...kb,
      name: kb.nome,
      description: kb.descricao,
      documents: kb.documentos.map(d => ({
        ...d,
        name: d.nome,
      })),
      _count: {
        documents: kb._count.documentos,
        agents: kb._count.agents,
      },
    }))
  }

  async getKnowledgeBaseById(id: string, companyId: string) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id, companyId },
      include: {
        documentos: {
          orderBy: { createdAt: 'desc' },
        },
        agents: true,
      },
    })

    if (!kb) {
      throw new AppError('Base de conhecimento nao encontrada', 404, 'NOT_FOUND')
    }

    return {
      ...kb,
      name: kb.nome,
      description: kb.descricao,
      documents: kb.documentos.map(d => ({ ...d, name: d.nome })),
    }
  }

  async createKnowledgeBase(companyId: string, data: CreateKnowledgeBaseDTO) {
    return prisma.knowledgeBase.create({
      data: {
        companyId,
        nome: data.name,
        descricao: data.description,
      },
    })
  }

  async deleteKnowledgeBase(id: string, companyId: string) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id, companyId },
    })

    if (!kb) {
      throw new AppError('Base de conhecimento nao encontrada', 404, 'NOT_FOUND')
    }

    await prisma.knowledgeBase.delete({ where: { id } })
    return { success: true }
  }

  // === Knowledge Documents ===

  async listDocuments(knowledgeBaseId: string, companyId: string) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, companyId },
    })

    if (!kb) {
      throw new AppError('Base de conhecimento nao encontrada', 404, 'NOT_FOUND')
    }

    const docs = await prisma.knowledgeDocument.findMany({
      where: { knowledgeBaseId },
      orderBy: { createdAt: 'desc' },
    })

    return docs.map(d => ({ ...d, name: d.nome }))
  }

  async createDocument(
    knowledgeBaseId: string,
    companyId: string,
    data: {
      name: string
      sourceType: string
      fileName?: string
      fileSize?: number
    }
  ) {
    const kb = await prisma.knowledgeBase.findFirst({
      where: { id: knowledgeBaseId, companyId },
    })

    if (!kb) {
      throw new AppError('Base de conhecimento nao encontrada', 404, 'NOT_FOUND')
    }

    return prisma.knowledgeDocument.create({
      data: {
        knowledgeBaseId,
        nome: data.name,
        sourceType: data.sourceType,
        fileName: data.fileName,
        fileSize: data.fileSize,
        status: 'pending',
      },
    })
  }

  async deleteDocument(id: string, companyId: string) {
    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id },
      include: { knowledgeBase: true },
    })

    if (!doc || doc.knowledgeBase.companyId !== companyId) {
      throw new AppError('Documento nao encontrado', 404, 'NOT_FOUND')
    }

    await prisma.knowledgeDocument.delete({ where: { id } })
    return { success: true, knowledgeBaseId: doc.knowledgeBaseId }
  }

  // === AI Agents ===

  async listAgents(companyId: string) {
    const agents = await prisma.aIAgent.findMany({
      where: { companyId },
      include: {
        knowledgeBase: {
          select: { id: true, nome: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return agents.map(a => ({
      ...a,
      name: a.nome,
      description: a.descricao,
      knowledgeBase: a.knowledgeBase ? {
        ...a.knowledgeBase,
        name: a.knowledgeBase.nome,
      } : null,
    }))
  }

  async getAgentById(id: string, companyId: string) {
    const agent = await prisma.aIAgent.findFirst({
      where: { id, companyId },
      include: {
        knowledgeBase: {
          select: { id: true, nome: true, descricao: true },
        },
      },
    })

    if (!agent) {
      throw new AppError('Agente nao encontrado', 404, 'NOT_FOUND')
    }

    return {
      ...agent,
      name: agent.nome,
      description: agent.descricao,
      knowledgeBase: agent.knowledgeBase ? {
        ...agent.knowledgeBase,
        name: agent.knowledgeBase.nome,
        description: agent.knowledgeBase.descricao,
      } : null,
    }
  }

  async createAgent(companyId: string, data: CreateAgentDTO) {
    return prisma.aIAgent.create({
      data: {
        companyId,
        nome: data.name,
        agentId: data.agentId || data.name.toLowerCase().replace(/\s+/g, '-'),
        descricao: data.description,
        icon: data.icon,
        tier: data.tier ?? 1,
        squad: data.squad ?? '21go-squad',
        provider: data.provider,
        model: data.model,
        temperature: data.temperature ?? 0.5,
        maxTokens: data.maxTokens ?? 2000,
        systemPrompt: data.systemPrompt,
        type: data.type ?? 'internal',
        knowledgeBaseId: data.knowledgeBaseId,
        allowedRoles: data.allowedRoles ?? [],
        allowedScopes: data.allowedScopes ?? [],
        permissions: data.permissions ?? {},
      },
    })
  }

  async updateAgent(id: string, companyId: string, data: UpdateAgentDTO) {
    const agent = await prisma.aIAgent.findFirst({
      where: { id, companyId },
    })

    if (!agent) {
      throw new AppError('Agente nao encontrado', 404, 'NOT_FOUND')
    }

    const updateData: any = {}
    if (data.name !== undefined) updateData.nome = data.name
    if (data.description !== undefined) updateData.descricao = data.description
    if (data.provider !== undefined) updateData.provider = data.provider
    if (data.model !== undefined) updateData.model = data.model
    if (data.temperature !== undefined) updateData.temperature = data.temperature
    if (data.maxTokens !== undefined) updateData.maxTokens = data.maxTokens
    if (data.systemPrompt !== undefined) updateData.systemPrompt = data.systemPrompt
    if (data.type !== undefined) updateData.type = data.type
    if (data.knowledgeBaseId !== undefined) updateData.knowledgeBaseId = data.knowledgeBaseId
    if (data.allowedRoles !== undefined) updateData.allowedRoles = data.allowedRoles
    if (data.allowedScopes !== undefined) updateData.allowedScopes = data.allowedScopes
    if (data.permissions !== undefined) updateData.permissions = data.permissions
    if (data.icon !== undefined) updateData.icon = data.icon

    return prisma.aIAgent.update({
      where: { id },
      data: updateData,
    })
  }

  async deleteAgent(id: string, companyId: string) {
    const agent = await prisma.aIAgent.findFirst({
      where: { id, companyId },
    })

    if (!agent) {
      throw new AppError('Agente nao encontrado', 404, 'NOT_FOUND')
    }

    await prisma.aIAgent.delete({ where: { id } })
    return { success: true }
  }

  // === Query Logs (no-op — AIQueryLog model not in schema) ===

  async logQuery(_companyId: string, _data: QueryLogDTO) {
    // AIQueryLog model removed from schema — log to console instead
    console.log('[AI Query]', _data.query?.substring(0, 100))
    return { id: 'noop', logged: false }
  }

  async getAnalyticsStats(companyId: string) {
    const [totalDocuments, totalKnowledgeBases, totalAgents] =
      await Promise.all([
        prisma.knowledgeDocument.count({
          where: { knowledgeBase: { companyId } },
        }),
        prisma.knowledgeBase.count({ where: { companyId } }),
        prisma.aIAgent.count({ where: { companyId } }),
      ])

    return {
      totalQueries: 0,
      totalDocuments,
      totalKnowledgeBases,
      totalAgents,
      avgResponseTime: 0,
      queriesByDay: [],
    }
  }

  async getRecentQueries(_companyId: string, _limit: number = 50) {
    // AIQueryLog not in schema — return empty
    return []
  }

  // === Stubs honestos (Projeto Japão Fase 3) ===
  // O schema atual de KnowledgeBase/KnowledgeDocument foi simplificado e perdeu
  // os campos collectionName, chunkCount, processingMeta, sourceContent, sourceUrl.
  // Os métodos abaixo são chamados pelos endpoints proxy do controller mas precisam
  // de um schema mais rico pra funcionar de verdade. Por ora ficam como no-op
  // graciosos pra não quebrar o build nem a UI.
  // TODO: implementação real do squad IA — fora do escopo Projeto Japão

  async getDocumentForCascade(id: string, _companyId: string): Promise<{
    id: string
    collectionName: string
    chunkCount: number
  } | null> {
    console.warn('[JAPAO][ai] getDocumentForCascade stub — schema não suporta cascade de chunks', { id })
    return null
  }

  async findKBByCollection(collectionName: string, _companyId: string): Promise<{
    id: string
    collectionName: string
  } | null> {
    console.warn('[JAPAO][ai] findKBByCollection stub — collectionName não está no schema', { collectionName })
    return null
  }

  async findDocumentByHash(kbId: string, _hash: string): Promise<{
    id: string
    chunkCount: number
  } | null> {
    console.warn('[JAPAO][ai] findDocumentByHash stub — hash idempotente não está no schema', { kbId })
    return null
  }

  async updateDocumentStatus(
    id: string,
    status: string,
    _chunks?: number,
    _errorMessage?: string,
  ): Promise<void> {
    try {
      await prisma.knowledgeDocument.update({
        where: { id },
        data: { status },
      })
    } catch (err: any) {
      console.warn('[JAPAO][ai] updateDocumentStatus failed', { id, status, err: err.message })
    }
  }
}
