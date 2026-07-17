import { prisma } from '../../config/database'
import { env } from '../../config/env'
import { AppError } from '../../utils/app-error'
import { fireAndForgetWebhook } from '../../utils/webhook-dispatcher'
import { cardOwnerWhere, type AuthUser } from '../../utils/scope'

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
        type: data.type,
        required: data.required ?? false,
        position,
        configJson: data.configJson || {},
      },
    })
  }

  // === Cards ===

  async listCards(pipeId: string, companyId: string, params: { phaseId?: string; q?: string; page?: number; pageSize?: number; status?: string }, user?: AuthUser) {
    const where: any = { companyId, pipeId, status: params.status || 'active', ...cardOwnerWhere(user) }
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

  async getKanbanData(pipeId: string, companyId: string, user?: AuthUser) {
    // Kanban mostra cards ativos E concluidos (status='done' em fases isWon/isLost).
    // Cards 'archived' ficam de fora.
    const kanbanStatusFilter = { in: ['active', 'done'] }
    // Escopo por dono: vendedor ve so os cards dele; admin ve todos
    const ownerFilter = cardOwnerWhere(user)
    const cardWhere = { status: kanbanStatusFilter, ...ownerFilter }
    const pipe = await prisma.pipe.findFirst({
      where: { id: pipeId, companyId },
      include: {
        phases: {
          orderBy: { position: 'asc' },
          include: {
            cards: {
              where: cardWhere,
              include: {
                assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
                fieldValues: { include: { fieldDefinition: true } },
              },
              orderBy: { createdAt: 'asc' },
            },
            _count: { select: { cards: { where: cardWhere } } },
          },
        },
      },
    })
    if (!pipe) throw new AppError('Pipe nao encontrado', 404, 'NOT_FOUND')

    // Enriquecimento: pra cada card, anexa telefone do lead, lastMessageAt e tasksPending.
    // Faço isso em batch pra não cair em N+1.
    const allCards = pipe.phases.flatMap(p => p.cards)
    if (allCards.length === 0) return pipe

    const titles = [...new Set(allCards.map(c => c.title).filter(Boolean))]

    const [leads, conversations, taskAgg] = await Promise.all([
      prisma.lead.findMany({
        where: { companyId, nome: { in: titles } },
        select: { id: true, nome: true, telefone: true, whatsapp: true, email: true, origem: true, dataPagamento: true, diaVencimento: true },
      }),
      // Pego o lastMessageAt de todas as conversations linkadas a esses leads
      // Vou indexar depois.
      prisma.conversation.findMany({
        where: { companyId, lead: { nome: { in: titles } } },
        select: { id: true, leadId: true, lastMessageAt: true, lead: { select: { nome: true } } },
      }),
      prisma.task.groupBy({
        by: ['leadId'],
        where: { companyId, status: 'pendente', leadId: { not: null } },
        _count: { _all: true },
      }),
    ])

    const leadByName = new Map(leads.map(l => [l.nome, l]))
    const convByLeadId = new Map(conversations.map(c => [c.leadId, c]))
    const tasksByLeadId = new Map(taskAgg.map(t => [t.leadId!, t._count._all]))

    for (const phase of pipe.phases) {
      for (const card of phase.cards) {
        const lead = leadByName.get(card.title)
        const conv = lead ? convByLeadId.get(lead.id) : null
        const tasksPending = lead ? (tasksByLeadId.get(lead.id) || 0) : 0
        ;(card as any).lead = lead || null
        ;(card as any).lastMessageAt = conv?.lastMessageAt || null
        ;(card as any).tasksPending = tasksPending
      }
    }

    return pipe
  }

  async getCardById(cardId: string, companyId: string) {
    const card = await prisma.card.findFirst({
      where: { id: cardId, companyId },
      include: {
        currentPhase: true,
        pipe: { select: { id: true, name: true, color: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        assignedTo: { select: { id: true, firstName: true, lastName: true, avatar: true } },
        fieldValues: { include: { fieldDefinition: true } },
      },
    })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')

    const leadSelect = { id: true, nome: true, telefone: true, whatsapp: true, email: true, origem: true, etapaFunil: true, valorCompra: true, produtoComprado: true, dataPagamento: true, diaVencimento: true }

    // 1) Preferir FK direta (cards.lead_id) — fonte de verdade pós-migration 20260515
    let lead = card.leadId
      ? await prisma.lead.findFirst({ where: { id: card.leadId, companyId }, select: leadSelect })
      : null

    // 2) Fallback: busca por nome do card (cards legados sem leadId backfilled)
    if (!lead) {
      lead = await prisma.lead.findFirst({
        where: { companyId, nome: card.title },
        select: leadSelect,
      })
    }

    // 3) Ultimo fallback: telefone na description ("Lead do WhatsApp — <fone>")
    if (!lead && card.description) {
      const phoneMatch = card.description.match(/\b(\d{10,13})\b/)
      if (phoneMatch) {
        lead = await prisma.lead.findFirst({
          where: {
            companyId,
            OR: [{ whatsapp: phoneMatch[1] }, { telefone: phoneMatch[1] }],
          },
          select: leadSelect,
        })
      }
    }

    let conversation: any = null
    if (lead) {
      // Conversa: pega só, sem mensagens (mensagens vêm em query separada limitada)
      const conv = await prisma.conversation.findFirst({
        where: { companyId, leadId: lead.id },
        orderBy: { createdAt: 'desc' },
      })
      if (conv) {
        // Últimas 100 mensagens em ordem cronológica.
        // Sem limite, conversas longas (100+ msgs) fazem o refetch demorar 1-3s.
        const recent = await prisma.message.findMany({
          where: { conversationId: conv.id },
          orderBy: { createdAt: 'desc' },
          take: 100,
        })
        conversation = { ...conv, messages: recent.reverse() }
      }
    }

    return { ...card, lead, conversation }
  }

  async createCard(
    pipeId: string,
    companyId: string,
    userId: string,
    data: {
      title: string
      description?: string
      assignedToId?: string
      dueDate?: string
      fieldValues?: Array<{ fieldDefinitionId: string; value: any }>
      // Fase de destino (default = primeira fase do funil)
      phaseId?: string
      // Lead opcional — se vier, cria/encontra Lead e linka no card
      lead?: { nome: string; telefone?: string; whatsapp?: string; email?: string }
    }
  ) {
    // Resolve fase de destino: phaseId explícito > primeira fase
    let targetPhase
    if (data.phaseId) {
      targetPhase = await prisma.phase.findFirst({
        where: { id: data.phaseId, pipeId, companyId },
      })
      if (!targetPhase) throw new AppError('Fase nao encontrada nesse funil', 400, 'BAD_REQUEST')
    } else {
      targetPhase = await prisma.phase.findFirst({
        where: { pipeId, companyId },
        orderBy: { position: 'asc' },
      })
    }
    if (!targetPhase) throw new AppError('Pipe nao tem fases. Crie pelo menos uma fase.', 400, 'BAD_REQUEST')

    return prisma.$transaction(async (tx) => {
      // Cadastro manual: cria SEMPRE um lead novo, dono = quem cadastrou.
      // NAO reaproveita lead existente por telefone — isso vinculava o card a
      // um lead de outro dono/orfao e ele sumia do kanban do vendedor (que ve
      // so os leads dele). Manual = previsivel: aparece onde ela cadastrou.
      let leadId: string | undefined
      if (data.lead?.nome?.trim()) {
        const created = await tx.lead.create({
          data: {
            companyId,
            nome: data.lead.nome.trim(),
            telefone: data.lead.telefone || null,
            whatsapp: data.lead.whatsapp || data.lead.telefone || null,
            email: data.lead.email || null,
            origem: 'manual',
            qualificadoPor: 'manual',
            vendedorId: userId,
          },
        })
        leadId = created.id
      }

      // Se o card ja nasce numa fase de fechamento (won) ou perda (lost),
      // marca como concluido AGORA — igual ao moveCard. Sem isso, cadastrar um
      // cliente ja "Aprovado" nao contava como fechado no dashboard.
      const nasceConcluido = targetPhase.isWon || targetPhase.isLost

      const card = await tx.card.create({
        data: {
          companyId,
          pipeId,
          currentPhaseId: targetPhase.id,
          title: data.title,
          description: data.description,
          createdById: userId,
          // Atribui ao criador por padrao — garante que ele veja o card que
          // acabou de criar, mesmo que o lead reaproveitado seja de outro dono.
          assignedToId: data.assignedToId ?? userId,
          dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
          leadId,
          status: nasceConcluido ? 'done' : 'active',
          completedAt: nasceConcluido ? new Date() : undefined,
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

  async updateCard(
    cardId: string,
    companyId: string,
    data: { title?: string; description?: string; assignedToId?: string | null; dueDate?: string | null; status?: string },
  ) {
    const card = await prisma.card.findFirst({ where: { id: cardId, companyId } })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')

    const update: any = {}
    if (typeof data.title === 'string') {
      if (!data.title.trim()) throw new AppError('title nao pode ser vazio', 400, 'BAD_REQUEST')
      update.title = data.title.trim()
    }
    if (data.description !== undefined) update.description = data.description
    if (data.assignedToId !== undefined) update.assignedToId = data.assignedToId
    if (data.dueDate !== undefined) update.dueDate = data.dueDate ? new Date(data.dueDate) : null
    if (data.status && ['active', 'archived', 'done'].includes(data.status)) {
      update.status = data.status
      if (data.status === 'done') update.completedAt = new Date()
    }

    return prisma.card.update({ where: { id: cardId }, data: update, include: { currentPhase: true } })
  }

  async deleteCard(cardId: string, companyId: string) {
    const card = await prisma.card.findFirst({ where: { id: cardId, companyId } })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')
    await prisma.card.update({ where: { id: cardId }, data: { status: 'archived' } })
    return { success: true }
  }

  async moveCard(cardId: string, companyId: string, phaseId: string, userId: string) {
    const card = await prisma.card.findFirst({ where: { id: cardId, companyId }, include: { currentPhase: true } })
    if (!card) throw new AppError('Card nao encontrado', 404, 'NOT_FOUND')

    const newPhase = await prisma.phase.findFirst({
      where: { id: phaseId, companyId },
      include: { pipe: { select: { id: true, name: true } } },
    })
    if (!newPhase) throw new AppError('Phase nao encontrada', 404, 'NOT_FOUND')

    if (card.currentPhaseId === phaseId) return card

    const updated = await prisma.$transaction(async (tx) => {
      return tx.card.update({
        where: { id: cardId },
        data: {
          currentPhaseId: phaseId,
          status: newPhase.isWon ? 'done' : newPhase.isLost ? 'done' : 'active',
          completedAt: (newPhase.isWon || newPhase.isLost) ? new Date() : null,
        },
        include: { currentPhase: true },
      })
    })

    void this.maybeDispatchApprovedWebhook(updated.id, newPhase, userId).catch(() => {})

    return updated
  }

  /**
   * Dispara webhook quando um card entra na fase "APROVADO" do funil "Vendas de Associados".
   * Configurado via env: WEBHOOK_LEAD_APPROVED_URL + _TOKEN + _PIPE_NAME + _PHASE_NAME.
   * Fire-and-forget: erros nao propagam pro request original.
   */
  private async maybeDispatchApprovedWebhook(
    cardId: string,
    phase: { id: string; name: string; pipe: { id: string; name: string } | null },
    userId: string,
  ) {
    const url = env.WEBHOOK_LEAD_APPROVED_URL
    if (!url) return

    const expectedPipe = env.WEBHOOK_LEAD_APPROVED_PIPE_NAME.trim().toLowerCase()
    const expectedPhase = env.WEBHOOK_LEAD_APPROVED_PHASE_NAME.trim().toLowerCase()
    if (!phase.pipe) return
    if (phase.pipe.name.trim().toLowerCase() !== expectedPipe) return
    if (phase.name.trim().toLowerCase() !== expectedPhase) return

    const card = await prisma.card.findUnique({
      where: { id: cardId },
      include: {
        lead: true,
        assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } },
        currentPhase: { select: { id: true, name: true } },
        pipe: { select: { id: true, name: true } },
      },
    })
    if (!card) return

    const lead = card.lead
    const payload = {
      event: 'lead.approved',
      occurredAt: new Date().toISOString(),
      card: {
        id: card.id,
        title: card.title,
        description: card.description,
        status: card.status,
        createdAt: card.createdAt.toISOString(),
        completedAt: card.completedAt?.toISOString() ?? null,
      },
      pipe: card.pipe ? { id: card.pipe.id, name: card.pipe.name } : null,
      phase: { id: phase.id, name: phase.name },
      lead: lead
        ? {
            id: lead.id,
            nome: lead.nome,
            telefone: lead.telefone,
            whatsapp: lead.whatsapp,
            email: lead.email,
            origem: lead.origem,
            utm: {
              source: lead.utmSource,
              medium: lead.utmMedium,
              campaign: lead.utmCampaign,
            },
            tracking: {
              gclid: lead.gclid,
              fbclid: lead.fbclid,
              fbp: lead.fbp,
              fbc: lead.fbc,
            },
          }
        : null,
      assignedTo: card.assignedTo
        ? {
            id: card.assignedTo.id,
            name: `${card.assignedTo.firstName} ${card.assignedTo.lastName}`.trim(),
            email: card.assignedTo.email,
          }
        : null,
      movedByUserId: userId,
    }

    fireAndForgetWebhook({
      url,
      bearerToken: env.WEBHOOK_LEAD_APPROVED_TOKEN,
      eventName: 'lead.approved',
      payload,
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
