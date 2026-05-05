import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'

export class PipesService {
  // === Pipes ===

  async listPipes(companyId: string) {
    return prisma.pipe.findMany({
      where: { companyId, status: 'active' },
      include: {
        _count: { select: { cards: true, phases: true, fieldDefinitions: true } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async getPipeById(pipeId: string, companyId: string) {
    const pipe = await prisma.pipe.findFirst({
      where: { id: pipeId, companyId },
      include: {
        phases: { orderBy: { position: 'asc' }, include: { _count: { select: { cards: true } } } },
        fieldDefinitions: { orderBy: { position: 'asc' } },
        _count: { select: { cards: true, phases: true, fieldDefinitions: true } },
      },
    })
    if (!pipe) throw new AppError('Pipe nao encontrado', 404, 'NOT_FOUND')
    return pipe
  }

  async createPipe(companyId: string, data: { name: string; description?: string; icon?: string; color?: string; tags?: string[] }) {
    return prisma.pipe.create({
      data: {
        companyId,
        name: data.name,
        description: data.description,
        icon: data.icon,
        color: data.color || '#3B82F6',
        tags: data.tags || [],
      },
      include: {
        _count: { select: { cards: true, phases: true, fieldDefinitions: true } },
      },
    })
  }

  async createPipeFromSuggest(
    companyId: string,
    data: {
      pipeName: string
      pipeDescription?: string
      phases: Array<{ name: string; description?: string; color?: string; position?: number; order?: number; probability?: number; isWon?: boolean; isLost?: boolean }>
      fields: Array<{ name: string; label: string; type: string; required?: boolean; description?: string; options?: string[] }>
      tags?: string[]
    }
  ) {
    return prisma.$transaction(async (tx) => {
      // 1. Create Pipe
      const pipe = await tx.pipe.create({
        data: {
          companyId,
          name: data.pipeName,
          description: data.pipeDescription,
          tags: data.tags || [],
        },
      })

      // 2. Create Phases
      const phases = await Promise.all(
        data.phases.map((phase, i) =>
          tx.phase.create({
            data: {
              companyId,
              pipeId: pipe.id,
              name: phase.name,
              description: phase.description,
              color: phase.color || '#6B7280',
              position: phase.position ?? phase.order ?? i,
              probability: phase.probability ?? 0,
              isWon: phase.isWon ?? false,
              isLost: phase.isLost ?? false,
            },
          })
        )
      )

      // 3. Create FieldDefinitions
      const fieldDefs = await Promise.all(
        data.fields.map((field, i) =>
          tx.fieldDefinition.create({
            data: {
              companyId,
              pipeId: pipe.id,
              name: field.name,
              label: field.label,
              description: field.description,
              type: field.type,
              required: field.required ?? false,
              position: i,
              configJson: field.options ? { options: field.options } : {},
            },
          })
        )
      )

      return {
        ...pipe,
        phases,
        fieldDefinitions: fieldDefs,
      }
    })
  }

  async deletePipe(pipeId: string, companyId: string) {
    const pipe = await prisma.pipe.findFirst({ where: { id: pipeId, companyId } })
    if (!pipe) throw new AppError('Pipe nao encontrado', 404, 'NOT_FOUND')
    await prisma.pipe.update({ where: { id: pipeId }, data: { status: 'archived' } })
    return { success: true }
  }

  // === Phases ===

  async createPhase(pipeId: string, companyId: string, data: { name: string; description?: string; color?: string; position?: number; probability?: number; isWon?: boolean; isLost?: boolean }) {
    const pipe = await prisma.pipe.findFirst({ where: { id: pipeId, companyId } })
    if (!pipe) throw new AppError('Pipe nao encontrado', 404, 'NOT_FOUND')

    const maxPos = await prisma.phase.aggregate({ where: { pipeId }, _max: { position: true } })
    const position = data.position ?? ((maxPos._max.position ?? -1) + 1)

    return prisma.phase.create({
      data: {
        companyId,
        pipeId,
        name: data.name,
        description: data.description,
        color: data.color || '#6B7280',
        position,
        probability: data.probability ?? 0,
        isWon: data.isWon ?? false,
        isLost: data.isLost ?? false,
      },
    })
  }

  // === Field Definitions ===

  async createFieldDefinition(pipeId: string, companyId: string, data: { name: string; label: string; type: string; description?: string; required?: boolean; position?: number; configJson?: Record<string, any> }) {
    const pipe = await prisma.pipe.findFirst({ where: { id: pipeId, companyId } })
    if (!pipe) throw new AppError('Pipe nao encontrado', 404, 'NOT_FOUND')

    const maxPos = await prisma.fieldDefinition.aggregate({ where: { pipeId }, _max: { position: true } })
    const position = data.position ?? ((maxPos._max.position ?? -1) + 1)

    return prisma.fieldDefinition.create({
      data: {
        companyId,
        pipeId,
        name: data.name,
        label: data.label,
        description: data.description,
        type: data.type,
        required: data.required ?? false,
        position,
        configJson: data.configJson || {},
      },
    })
  }

  // === Cards ===

  async listCards(pipeId: string, companyId: string, params: { phaseId?: string; q?: string; page?: number; pageSize?: number; status?: string }) {
    const where: any = { companyId, pipeId, status: params.status || 'active' }
    if (params.phaseId) where.currentPhaseId = params.phaseId
    if (params.q) where.title = { contains: params.q, mode: 'insensitive' }

    const page = params.page || 1
    const pageSize = params.pageSize || 50
    const skip = (page - 1) * pageSize

    const [cards, total] = await Promise.all([
      prisma.card.findMany({
        where,
        include: {
          currentPhase: true,
          assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          fieldValues: { include: { fieldDefinition: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.card.count({ where }),
    ])

    return {
      data: cards,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  }

  async getKanbanData(pipeId: string, companyId: string) {
    const pipe = await prisma.pipe.findFirst({
      where: { id: pipeId, companyId },
      include: {
        phases: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              where: { status: 'active' },
              include: {
                assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
                fieldValues: { include: { fieldDefinition: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { cards: { where: { status: 'active' } } } },
          },
        },
      },
    })
    if (!pipe) throw new AppError('Pipe nao encontrado', 404, 'NOT_FOUND')
    return pipe
  }

  async getCardById(cardId: string, companyId: string) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, companyId },
      include: {
        currentPhase: true,
        createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        fieldValues: { include: { fieldDefinition: true } },
        activityLogs: { orderBy: { createdAt: 'desc' }, take: 50 },
        attachments: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')
    return card
  }

  async createCard(
    pipeId: string,
    companyId: string,
    userId: string,
    data: { title: string; description?: string; assignedToId?: string; dueDate?: string; fieldValues?: Array<{ fieldDefinitionId: string; value: any }> }
  ) {
    // Get first phase
    const firstPhase = await prisma.phase.findFirst({
      where: { pipeId, companyId },
      orderBy: { position: 'asc' },
    })
    if (!firstPhase) throw new AppError('Pipe nao tem fases. Crie pelo menos uma fase.', 400, 'BAD_REQUEST')

    return prisma.$transaction(async (tx) => {
      const card = await tx.card.create({
        data: {
          companyId,
          pipeId,
          currentPhaseId: firstPhase.id,
          title: data.title,
          description: data.description,
          createdById: userId,
          assignedToId: data.assignedToId,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
        },
        include: { currentPhase: true },
      })

      // Create field values
      if (data.fieldValues?.length) {
        await Promise.all(
          data.fieldValues.map((fv) =>
            tx.cardFieldValue.create({
              data: {
                companyId,
                cardId: card.id,
                fieldDefinitionId: fv.fieldDefinitionId,
                valueJson: fv.value,
              },
            })
          )
        )
      }

      return card
    })
  }

  async moveCard(cardId: string, companyId: string, phaseId: string, userId: string) {
    const card = await prisma.card.findFirst({ where: { id: cardId, companyId }, include: { currentPhase: true } })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')

    const newPhase = await prisma.phase.findFirst({ where: { id: phaseId, companyId } })
    if (!newPhase) throw new AppError('Phase nao encontrada', 404, 'NOT_FOUND')

    if (card.currentPhaseId === phaseId) return card

    return prisma.$transaction(async (tx) => {
      const updated = await tx.card.update({
        where: { id: cardId },
        data: {
          currentPhaseId: phaseId,
          status: newPhase.isWon ? 'done' : newPhase.isLost ? 'done' : 'active',
          completedAt: (newPhase.isWon || newPhase.isLost) ? new Date() : null,
        },
        include: { currentPhase: true },
      })

      return updated
    })
  }

  async updateCardFields(cardId: string, companyId: string, userId: string, fields: Array<{ fieldDefinitionId: string; value: any }>) {
    const card = await prisma.card.findFirst({ where: { id: cardId, companyId } })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')

    return prisma.$transaction(async (tx) => {
      for (const field of fields) {
        await tx.cardFieldValue.upsert({
          where: { cardId_fieldDefinitionId: { cardId, fieldDefinitionId: field.fieldDefinitionId } },
          update: { valueJson: field.value },
          create: { companyId, cardId, fieldDefinitionId: field.fieldDefinitionId, valueJson: field.value },
        })
      }

      return { success: true }
    })
  }

  async addAttachment(cardId: string, companyId: string, _userId: string, data: { fileName: string; mimeType?: string; size?: number; storageUrl: string }) {
    const card = await prisma.card.findFirst({ where: { id: cardId, companyId } })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')
    // CardAttachment model removed from schema — return stub
    return { id: 'stub', cardId, fileName: data.fileName, storageUrl: data.storageUrl }
  }

  /**
   * Transfere um card pra outro funil.
   * Move pra primeira fase do funil destino (ou pra fase específica se passada).
   */
  async transferCard(
    cardId: string,
    companyId: string,
    targetPipeId: string,
    targetPhaseId: string | undefined,
    _userId: string,
  ) {
    const card = await prisma.card.findFirst({ where: { id: cardId, companyId } })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')

    const targetPipe = await prisma.pipe.findFirst({ where: { id: targetPipeId, companyId } })
    if (!targetPipe) throw new AppError('Funil destino nao encontrado', 404, 'NOT_FOUND')

    if (card.pipeId === targetPipeId) {
      throw new AppError('Card ja esta neste funil', 400, 'SAME_PIPE')
    }

    // Resolve fase destino: especificada ou primeira do pipe
    let phase
    if (targetPhaseId) {
      phase = await prisma.phase.findFirst({
        where: { id: targetPhaseId, pipeId: targetPipeId, companyId },
      })
      if (!phase) throw new AppError('Fase destino invalida', 400, 'INVALID_PHASE')
    } else {
      phase = await prisma.phase.findFirst({
        where: { pipeId: targetPipeId, companyId },
        orderBy: { position: 'asc' },
      })
      if (!phase) {
        throw new AppError('Funil destino nao tem fases', 400, 'NO_PHASES')
      }
    }

    const updated = await prisma.card.update({
      where: { id: cardId },
      data: {
        pipeId: targetPipeId,
        currentPhaseId: phase.id,
        status: phase.isWon ? 'done' : phase.isLost ? 'done' : 'active',
        completedAt: (phase.isWon || phase.isLost) ? new Date() : null,
      },
      include: { currentPhase: true },
    })

    return updated
  }
}
