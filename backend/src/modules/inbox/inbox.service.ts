import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'
import { getEvolutionClient } from '../../lib/evolution-client'
import { socketService } from '../../websocket'

export interface ListConversationsQuery {
  status?: string
  channelType?: string
  scope?: 'mine' | 'all'
  userId?: string
  userRole?: string
  search?: string
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

    // Vendedor vê: conversas atribuídas a ele + conversas SEM dono (fila aberta).
    // Quando ele responde, vira dono automaticamente (assigned no sendMessage).
    // Admin/gestor veem tudo. scope=mine força filtro estrito.
    const andConditions: any[] = []
    const isPrivileged = query.userRole === 'admin' || query.userRole === 'gestor'
    if (query.scope === 'mine' && query.userId) {
      where.assignedToId = query.userId
    } else if (!isPrivileged && query.userId) {
      andConditions.push({
        OR: [{ assignedToId: query.userId }, { assignedToId: null }],
      })
    }

    // Busca server-side por nome OU telefone OU whatsapp do lead/associado.
    // Casa em qualquer parte da string (ILIKE %term%). Insensível a case.
    // Pra telefone normaliza pra dígitos puros (remove (), espaços, traços do user).
    const searchRaw = (query.search || '').trim()
    if (searchRaw.length > 0) {
      const text = searchRaw
      const digits = searchRaw.replace(/\D/g, '')
      const personMatch: any[] = [
        { nome: { contains: text, mode: 'insensitive' } },
      ]
      if (digits.length >= 3) {
        // Bate em "5521999998888", "(21) 99999-8888", "21999998888" etc.
        personMatch.push({ telefone: { contains: digits } })
        personMatch.push({ whatsapp: { contains: digits } })
      }
      andConditions.push({
        OR: [
          { lead: { is: { OR: personMatch } } },
          { associado: { is: { OR: personMatch } } },
        ],
      })
    }

    if (andConditions.length > 0) {
      where.AND = andConditions
    }

    const conversations = await prisma.conversation.findMany({
      where,
      include: {
        associado: {
          select: { id: true, nome: true, email: true, telefone: true, whatsapp: true },
        },
        lead: {
          select: { id: true, nome: true, email: true, telefone: true, whatsapp: true },
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
      // NULLS LAST: conversas sem mensagem (lead criado pelo webhook mas
      // sem texto) caem no fim da lista — não bagunçam o topo.
      orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
    })

    // Transform to match frontend expectations.
    // phone: whatsapp tem prioridade — leads vindos do webhook costumam ter só esse campo.
    return conversations.map(c => {
      const source = c.associado
        ? { id: c.associado.id, fullName: c.associado.nome, email: c.associado.email, phone: c.associado.whatsapp || c.associado.telefone }
        : c.lead
          ? { id: c.lead.id, fullName: c.lead.nome, email: c.lead.email, phone: c.lead.whatsapp || c.lead.telefone }
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
          select: { id: true, nome: true, email: true, telefone: true, whatsapp: true },
        },
        lead: {
          select: { id: true, nome: true, email: true, telefone: true, whatsapp: true },
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
        ? { id: conversation.associado.id, fullName: conversation.associado.nome, email: conversation.associado.email, phone: conversation.associado.whatsapp || conversation.associado.telefone, avatar: null }
        : conversation.lead
          ? { id: conversation.lead.id, fullName: conversation.lead.nome, email: conversation.lead.email, phone: conversation.lead.whatsapp || conversation.lead.telefone, avatar: null }
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
    // IMPORTANTE: nunca lançamos AppError com statusCode 5xx aqui.
    // O Traefik (proxy do Easypanel) intercepta 5xx e substitui o body
    // pela pagina HTML de erro generica — o frontend perderia a mensagem
    // util e mostraria so "Request failed with status code 502". Por isso
    // usamos 400 (cliente nao conseguiu enviar) com codigo no campo `code`
    // pra preservar a semantica.
    const log = (msg: string, data?: any) =>
      console.log(`[sendMessage] ${msg}`, data ? JSON.stringify(data) : '')

    const conversation = await prisma.conversation.findFirst({
      where: { id: conversationId, companyId },
      include: {
        lead: { select: { id: true, telefone: true, whatsapp: true } },
        associado: { select: { id: true, telefone: true, whatsapp: true } },
      },
    })

    if (!conversation) {
      throw new AppError('Conversa nao encontrada', 404, 'NOT_FOUND')
    }

    const phone =
      conversation.lead?.whatsapp || conversation.lead?.telefone ||
      conversation.associado?.whatsapp || conversation.associado?.telefone

    let evolutionMessageId: string | null = null

    if (conversation.channel === 'whatsapp' && phone) {
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
      const evolution = getEvolutionClient()
      let activeKey = instance.evolutionApiKey
      const trySend = async (apiKey: string) => evolution.sendText({
        instanceName: instance.evolutionName,
        instanceKey: apiKey,
        number: phone,
        text: data.content,
      })

      const extractMsg = (err: any): string => {
        const r = err?.response?.data
        return (
          r?.response?.message ||
          (Array.isArray(r?.message) ? r.message.join(', ') : r?.message) ||
          err?.message ||
          'Falha ao enviar pelo WhatsApp'
        )
      }

      try {
        const sent: any = await trySend(activeKey)
        evolutionMessageId = sent?.key?.id || sent?.id || null
        log('Evolution OK', { id: evolutionMessageId })
      } catch (err: any) {
        const status = err?.response?.status
        log('Evolution falhou', { status, msg: extractMsg(err) })

        // Auto-heal: 401/403 = apikey stale.
        if (status === 401 || status === 403) {
          const freshKey = await evolution.fetchInstanceApiKey(instance.evolutionName)
          if (freshKey && freshKey !== activeKey) {
            await prisma.whatsappInstance.update({
              where: { id: instance.id },
              data: { evolutionApiKey: freshKey },
            })
            activeKey = freshKey
            try {
              const sent: any = await trySend(activeKey)
              evolutionMessageId = sent?.key?.id || sent?.id || null
              log('Evolution OK depois de re-sync da apikey')
            } catch (err2: any) {
              throw new AppError(
                `Erro ao enviar pelo WhatsApp: ${extractMsg(err2)}`,
                400,
                'EVOLUTION_FAIL',
              )
            }
          } else {
            throw new AppError(
              'Sessao do WhatsApp invalida. Reconecte em /whatsapp (escaneie o QR de novo).',
              400,
              'EVOLUTION_UNAUTHORIZED',
            )
          }
        } else {
          // Numero invalido, instancia caiu, rate limit, etc — tudo cai aqui
          throw new AppError(
            `Erro ao enviar pelo WhatsApp: ${extractMsg(err)}`,
            400,
            'EVOLUTION_FAIL',
          )
        }
      }
    }

    // A partir daqui, qualquer falha de banco/socket nao deve gerar 502 no proxy
    let message: any
    try {
      message = await prisma.message.create({
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
    } catch (err: any) {
      log('prisma.message.create FAIL', { err: err?.message })
      // Mensagem foi enviada pelo WhatsApp mas nao salvou no banco — ainda
      // assim devolvemos sucesso parcial pro user nao re-enviar pro cliente.
      // Erro mostra o que aconteceu sem matar o fluxo.
      throw new AppError(
        `Mensagem enviada mas nao gravada no historico: ${err?.message || 'erro de banco'}`,
        400,
        'DB_WRITE_FAIL',
      )
    }

    try {
      await prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: new Date(), status: 'assigned', assignedToId: userId },
      })
    } catch (err) {
      console.warn('[sendMessage] update conversation failed:', (err as Error).message)
    }

    try {
      socketService.emitToCompany(companyId, 'inbox:new_message', {
        conversationId,
        message: message as any,
        channel: { type: conversation.channel || 'whatsapp', name: 'WhatsApp' },
      })
    } catch (err) {
      console.warn('[sendMessage] socket emit failed:', (err as Error).message)
    }

    return message
  }

  async updateConversationStatus(id: string, companyId: string, status: string) {
    const conversation = await prisma.conversation.findFirst({ where: { id, companyId } })
    if (!conversation) throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    const updated = await prisma.conversation.update({ where: { id }, data: { status: status as any } })
    try {
      socketService.emitToCompany(companyId, 'conversation:updated', {
        conversationId: id,
        status,
      })
    } catch (err) {
      console.warn('[Inbox] socket emit (status) failed:', (err as Error).message)
    }
    return updated
  }

  async markAsRead(id: string, companyId: string) {
    // Schema atual não tem campo read na Message — implementação no-op
    // até decidir como modelar "lido". Por ora só valida acesso.
    const conversation = await prisma.conversation.findFirst({ where: { id, companyId } })
    if (!conversation) throw new AppError('Conversation not found', 404, 'NOT_FOUND')
    return { ok: true }
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

    try {
      socketService.emitToCompany(companyId, 'conversation:assigned', {
        conversationId: id,
        assignedToId: userId,
      })
      socketService.emitToUser(userId, 'conversation:assigned', {
        conversationId: id,
        assignedToId: userId,
      })
    } catch (err) {
      console.warn('[Inbox] socket emit (assign) failed:', (err as Error).message)
    }

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
