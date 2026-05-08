import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'
import { getEvolutionClient } from '../../lib/evolution-client'

export interface ListConversationsQuery {
  status?: string
  channelType?: string
  scope?: 'mine' | 'all'
  userId?: string
  userRole?: string
}

export interface SendMessageDTO {
  content: string
  contentType?: string
}

export class InboxService {
  async listConversations(companyId: string, query: ListConversationsQuery) {
    const where: any = { companyId }

    if (query.status) {
      where.status = query.status
    }

    if (query.channelType) {
      where.channel = query.channelType
    }

    // Vendedor sempre ve apenas as conversas atribuidas a ele.
    // Admin/gestor podem passar scope=all pra ver todas, ou scope=mine pra filtrar.
    const isPrivileged = query.userRole === 'admin' || query.userRole === 'gestor'
    if (!isPrivileged || query.scope === 'mine') {
      if (query.userId) where.assignedToId = query.userId
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        associado: {
          select: { id: true, nome: true, email: true, telefone: true },
        },
        lead: {
          select: { id: true, nome: true, email: true, telefone: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, content: true, sender: true, createdAt: true },
        },
      },
      orderBy: { lastMessageAt: 'desc' },
    })

    // Transform to match frontend expectations
    return conversations.map(c => {
      const source = c.associado
        ? { id: c.associado.id, fullName: c.associado.nome, email: c.associado.email, phone: c.associado.telefone }
        : c.lead
          ? { id: c.lead.id, fullName: c.lead.nome, email: c.lead.email, phone: c.lead.telefone }
          : null
      return {
        ...c,
        channel: { type: c.channel, name: c.channel },
        contact: source
          ? {
              ...source,
              firstName: source.fullName?.split(' ')[0] || '',
              lastName: source.fullName?.split(' ').slice(1).join(' ') || '',
              avatar: null,
            }
          : null,
        lastMessage: c.messages[0] || null,
        lastMessagePreview: c.messages[0]?.content || null,
      }
    })
  }

  async getConversationById(id: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId },
      include: {
        associado: {
          select: { id: true, nome: true, email: true, telefone: true },
        },
        lead: {
          select: { id: true, nome: true, email: true, telefone: true },
        },
        assignedTo: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    })

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }

    return {
      ...conversation,
      channel: { type: conversation.channel, name: conversation.channel },
      contact: conversation.associado
        ? { id: conversation.associado.id, fullName: conversation.associado.nome, email: conversation.associado.email, phone: conversation.associado.telefone, avatar: null }
        : conversation.lead
          ? { id: conversation.lead.id, fullName: conversation.lead.nome, email: conversation.lead.email, phone: conversation.lead.telefone, avatar: null }
          : null,
    }
  }

  async getConversationMessages(id: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId },
    })

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }

    const messages = await prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        senderUser: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    })

    return messages
  }

  async sendMessage(conversationId: string, companyId: string, userId: string, data: SendMessageDTO) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      include: {
        lead: { select: { id: true, telefone: true, whatsapp: true } },
        associado: { select: { id: true, telefone: true, whatsapp: true } },
      },
    })

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }

    // Resolve telefone do destinatário (lead OU associado)
    const phone =
      conversation.lead?.whatsapp || conversation.lead?.telefone ||
      conversation.associado?.whatsapp || conversation.associado?.telefone

    let evolutionMessageId: string | null = null
    let sendError: string | null = null

    // Envia de fato pelo WhatsApp via Evolution se for canal whatsapp e tiver telefone
    if (conversation.channel === 'whatsapp' && phone) {
      // Pega instancia do user (vendedor que conectou WhatsApp)
      const instance = await prisma.whatsappInstance.findFirst({
        where: { userId, companyId, status: 'CONNECTED' },
      })
      if (!instance || !instance.evolutionApiKey) {
        throw new AppError(
          'Voce nao tem WhatsApp conectado. Conecte em /whatsapp antes de responder.',
          400,
          'NO_WHATSAPP',
        )
      }
      try {
        const evolution = getEvolutionClient()
        const sent: any = await evolution.sendText({
          instanceName: instance.evolutionName,
          instanceKey: instance.evolutionApiKey,
          number: phone,
          text: data.content,
        })
        evolutionMessageId = sent?.key?.id || sent?.id || null
      } catch (err: any) {
        sendError = err?.message || 'Falha ao enviar pelo WhatsApp'
        throw new AppError(`Erro ao enviar pelo WhatsApp: ${sendError}`, 502, 'EVOLUTION_FAIL')
      }
    }

    const message = await prisma.message.create({
      data: {
        companyId,
        conversationId,
        content: data.content,
        sender: 'vendedor',
        senderId: userId,
        direction: 'outbound',
        messageType: 'text',
        whatsappMessageId: evolutionMessageId,
      },
      include: {
        senderUser: {
          select: { id: true, firstName: true, lastName: true, avatar: true },
        },
      },
    })

    await prisma.conversation.update({
      where: { id: conversationId },
      data: { lastMessageAt: new Date(), status: 'assigned', assignedToId: userId },
    })

    return message
  }

  async assignConversation(id: string, companyId: string, userId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId },
    })

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }

    const updated = await prisma.conversation.update({
      where: { id },
      data: { assignedToId: userId, status: 'assigned' },
    })

    return updated
  }

  async closeConversation(id: string, companyId: string) {
    const conversation = await prisma.conversation.findFirst({
      where: { id, companyId },
    })

    if (!conversation) {
      throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    }

    await prisma.conversation.update({
      where: { id },
      data: { status: 'closed' },
    })

    return { success: true, message: 'Conversation closed' }
  }

  /**
   * Converte uma conversa em card no Kanban (1a fase do funil escolhido).
   * funilType:
   *  - 'consultor' → busca pipe com slug/tag 'consultores'
   *  - 'associado' → busca pipe com slug/tag 'associados'
   */
  async convertToLead(
    conversationId: string,
    companyId: string,
    userId: string,
    funilType: 'consultor' | 'associado',
    customTitle?: string,
  ) {
    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      include: {
        lead: { select: { id: true, nome: true, telefone: true, whatsapp: true } },
        associado: { select: { id: true, nome: true, telefone: true } },
      },
    })
    if (!conversation) throw new AppError('Conversa nao encontrada', 404, 'NOT_FOUND')

    // Encontra pipe pelo tipo (procura por nome contendo a palavra-chave)
    const keyword = funilType === 'consultor' ? 'consultor' : 'associado'
    const pipes = await prisma.pipe.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    })
    const pipe = pipes.find(p => p.name.toLowerCase().includes(keyword))
    if (!pipe) {
      throw new AppError(
        `Funil de ${funilType} nao encontrado. Crie um funil com nome contendo '${keyword}'.`,
        400,
        'PIPE_NOT_FOUND',
      )
    }

    // Pega 1a fase
    const firstPhase = await prisma.phase.findFirst({
      where: { pipeId: pipe.id },
      orderBy: { position: 'asc' },
    })
    if (!firstPhase) {
      throw new AppError('Funil sem fases. Adicione uma fase primeiro.', 400, 'NO_PHASES')
    }

    const contactName = conversation.lead?.nome || conversation.associado?.nome || 'Contato WhatsApp'
    const title = customTitle?.trim() || `${contactName} (WhatsApp)`

    const card = await prisma.card.create({
      data: {
        companyId,
        pipeId: pipe.id,
        currentPhaseId: firstPhase.id,
        title,
        description: `Convertido da conversa de WhatsApp em ${new Date().toLocaleString('pt-BR')}`,
        status: 'active',
        createdById: userId,
        assignedToId: userId,
      },
    })

    // Atribui a conversa pro user (se ainda nao estiver) e marca como assigned
    await prisma.conversation.update({
      where: { id: conversationId },
      data: {
        assignedToId: conversation.assignedToId || userId,
        status: 'assigned',
      },
    })

    return {
      card: {
        id: card.id,
        title: card.title,
        pipeId: card.pipeId,
        phaseId: card.currentPhaseId,
      },
      pipe: { id: pipe.id, name: pipe.name },
      kanbanUrl: `/pipes/${pipe.id}/kanban`,
    }
  }
}
