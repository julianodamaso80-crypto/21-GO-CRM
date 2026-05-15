import { prisma } from '../../config/database'
import { socketService } from '../../websocket'
import { ensureCardForLead } from '../leads/lead-card.helper'

/**
 * Webhook da Evolution API (WhatsApp via Baileys).
 * Recebe eventos MESSAGES_UPSERT, SEND_MESSAGE, CONNECTION_UPDATE.
 *
 * Fluxo principal (MESSAGES_UPSERT — inbound OU outbound do WhatsApp Web do vendedor):
 *  1. Descarta mensagens de grupo (sempre, mesmo fromMe — equipe interna posta lá).
 *  2. Decide direction: fromMe=true → 'outbound' (vendedora respondendo via WhatsApp Web/celular).
 *  3. Idempotência via whatsappMessageId UNIQUE — protege contra dupla persistência
 *     quando inbox.service.sendMessage já gravou a mesma mensagem antes do webhook chegar.
 *  4. Procura Associado → depois Lead → cria Lead novo se nada bater.
 *     Em outbound, pushName é a vendedora — NÃO usar como nome de lead novo,
 *     cai em fallback "Contato XXXX" (4 últimos dígitos do telefone).
 *  5. Abre (ou reusa) Conversation.
 *  6. Persiste Message com direction/sender/senderId corretos.
 *  7. Atualiza Conversation: inbound incrementa unreadCount; outbound zera +
 *     marca como 'assigned' + atribui ao user da instância (vendedora respondeu = leu tudo).
 *  8. Emite inbox:new_message via Socket.io.
 */

interface EvolutionWebhookPayload {
  event?: string
  instance?: string
  data?: any
  [key: string]: any
}

type MessageKind =
  | 'text'
  | 'audio'
  | 'image'
  | 'video'
  | 'document'
  | 'sticker'
  | 'location'
  | 'reaction'
  | 'poll'
  | 'contact'
  | 'unknown'

/**
 * Desembrulha wrappers comuns do Baileys/WhatsApp que escondem a mensagem real:
 *  - ephemeralMessage (modo "desaparecimento")
 *  - viewOnceMessage / viewOnceMessageV2 (ver uma vez)
 *  - documentWithCaptionMessage (documento com legenda)
 *
 * Sem isso, o webhook gravava "[mensagem não suportada]" pra qualquer mensagem
 * em conversas com modo efêmero ativado.
 */
function unwrapMessage(message: any, depth = 0): any {
  if (!message || depth > 3) return message
  if (message.ephemeralMessage?.message) return unwrapMessage(message.ephemeralMessage.message, depth + 1)
  if (message.viewOnceMessage?.message) return unwrapMessage(message.viewOnceMessage.message, depth + 1)
  if (message.viewOnceMessageV2?.message) return unwrapMessage(message.viewOnceMessageV2.message, depth + 1)
  if (message.documentWithCaptionMessage?.message) return unwrapMessage(message.documentWithCaptionMessage.message, depth + 1)
  return message
}

function extractPhoneFromJid(jid: string | undefined): string | null {
  if (!jid) return null
  // formato: "5521979034169@s.whatsapp.net" ou "5521979034169@c.us"
  const phone = jid.split('@')[0]
  if (!/^\d{10,15}$/.test(phone)) return null
  return phone
}

function isGroup(jid: string | undefined): boolean {
  return !!jid && jid.endsWith('@g.us')
}

function detectMessageKind(rawMessage: any): {
  kind: MessageKind
  content: string
  mimetype?: string
} {
  const message = unwrapMessage(rawMessage)
  if (!message) return { kind: 'unknown', content: '' }

  if (typeof message.conversation === 'string') {
    return { kind: 'text', content: message.conversation }
  }
  if (message.extendedTextMessage?.text) {
    return { kind: 'text', content: message.extendedTextMessage.text }
  }
  if (message.audioMessage) {
    const seconds = message.audioMessage.seconds
    return {
      kind: 'audio',
      content: seconds ? `[áudio — ${seconds}s]` : '[áudio]',
      mimetype: message.audioMessage.mimetype,
    }
  }
  if (message.imageMessage) {
    return {
      kind: 'image',
      content: message.imageMessage.caption || '[imagem]',
      mimetype: message.imageMessage.mimetype,
    }
  }
  if (message.videoMessage) {
    return {
      kind: 'video',
      content: message.videoMessage.caption || '[vídeo]',
      mimetype: message.videoMessage.mimetype,
    }
  }
  if (message.documentMessage) {
    const name = message.documentMessage.fileName || 'documento'
    return {
      kind: 'document',
      content: `[documento: ${name}]`,
      mimetype: message.documentMessage.mimetype,
    }
  }
  if (message.stickerMessage) {
    return {
      kind: 'sticker',
      content: '[figurinha]',
      mimetype: message.stickerMessage.mimetype,
    }
  }
  if (message.locationMessage) {
    const lat = message.locationMessage.degreesLatitude
    const lng = message.locationMessage.degreesLongitude
    return { kind: 'location', content: `[localização: ${lat},${lng}]` }
  }

  // Reação com emoji (cliente clica em "reagir" numa mensagem). Quase metade
  // dos "[mensagem não suportada]" eram isso.
  if (message.reactionMessage) {
    const emoji = message.reactionMessage.text || '👍'
    return { kind: 'reaction', content: `[reagiu: ${emoji}]` }
  }

  // Enquete (poll). V3 é o formato novo do WhatsApp Business.
  const poll = message.pollCreationMessage
    || message.pollCreationMessageV2
    || message.pollCreationMessageV3
  if (poll) {
    const name = poll.name || 'Enquete'
    return { kind: 'poll', content: `[enquete: ${name}]` }
  }

  // Contato compartilhado (cartão vCard).
  if (message.contactMessage) {
    const name = message.contactMessage.displayName || 'contato'
    return { kind: 'contact', content: `[contato: ${name}]` }
  }
  if (message.contactsArrayMessage) {
    const list = message.contactsArrayMessage.contacts || []
    const display = list.map((c: any) => c.displayName).filter(Boolean).join(', ') || 'contatos'
    return { kind: 'contact', content: `[contatos: ${display}]` }
  }

  // Localização em tempo real.
  if (message.liveLocationMessage) {
    const lat = message.liveLocationMessage.degreesLatitude
    const lng = message.liveLocationMessage.degreesLongitude
    return { kind: 'location', content: `[localização ao vivo: ${lat},${lng}]` }
  }

  return { kind: 'unknown', content: '[mensagem não suportada]' }
}

function firstName(raw: string | undefined): string {
  if (!raw) return 'Contato WhatsApp'
  return raw.trim().split(/\s+/).slice(0, 3).join(' ') || 'Contato WhatsApp'
}

// ============================================================================
// Funções puras (exportadas pra teste) — decisões de direção / sender /
// payload de update da conversation. Mantém handleMessageUpsert legível e
// permite testar a lógica sem mockar Prisma inteiro.
// ============================================================================

export type Direction = 'inbound' | 'outbound'

export function resolveDirection(fromMe: boolean): Direction {
  return fromMe ? 'outbound' : 'inbound'
}

/**
 * pushName é do REMETENTE da mensagem WhatsApp. Em outbound (fromMe:true),
 * é o nome do perfil da vendedora — NUNCA usar como nome de lead novo.
 * Fallback usa os 4 últimos dígitos do telefone do CONTATO (não da vendedora).
 */
export function resolvePushName(
  fromMe: boolean,
  dataPushName: string | undefined,
  phone: string,
): string {
  if (fromMe) return `Contato ${phone.slice(-4)}`
  return firstName(dataPushName)
}

export function resolveSender(
  fromMe: boolean,
  hasAssociado: boolean,
): 'vendedor' | 'associado' | 'lead' {
  if (fromMe) return 'vendedor'
  return hasAssociado ? 'associado' : 'lead'
}

/**
 * Payload do UPDATE da conversation depois de gravar a mensagem.
 *  - inbound: incrementa unreadCount, mantém status/assigned como estão.
 *  - outbound: zera unreadCount + lastReadAt (vendedora respondeu = leu tudo,
 *    isso é verdade independente de quem é dono). Se a instância está mapeada
 *    pra um user (assignedUserId !== null), também força status='assigned' e
 *    atribui à vendedora. Se NÃO está mapeada, preserva assignedToId/status
 *    atuais — não "rouba" a conversa pra ninguém (defesa contra instância
 *    nova criada sem rodar mapping em whatsapp_instances).
 */
export function buildConversationUpdate(
  direction: Direction,
  messageTs: Date,
  assignedUserId: string | null,
  now: Date = new Date(),
): Record<string, unknown> {
  if (direction === 'inbound') {
    return { lastMessageAt: messageTs, unreadCount: { increment: 1 } }
  }
  const base = {
    lastMessageAt: messageTs,
    unreadCount: 0,
    lastReadAt: now,
  }
  if (assignedUserId === null) {
    return base
  }
  return {
    ...base,
    status: 'assigned',
    assignedToId: assignedUserId,
  }
}

async function resolveCompanyId(): Promise<string | null> {
  if (process.env.DEFAULT_COMPANY_ID) return process.env.DEFAULT_COMPANY_ID
  const first = await prisma.company.findFirst({ select: { id: true } })
  return first?.id ?? null
}

/**
 * Monta o DTO de Conversation no MESMO shape que o GET /api/conversations
 * retorna pra inbox (ver inbox.service.ts → listConversations). Frontend usa
 * esse shape pra renderizar uma linha da lista direto, sem precisar refetch.
 *
 * Reproduzido aqui (e não importado de inbox.service) pra evitar acoplamento
 * cruzado entre módulos. Drift fica óbvio em revisão — se o shape mudar lá,
 * tem que mudar aqui também.
 */
async function buildConversationDTOById(
  conversationId: string,
  fallbackPushName?: string,
): Promise<any | null> {
  const c = await prisma.conversation.findUnique({
    where: { id: conversationId },
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
  })
  if (!c) return null

  const source = c.associado
    ? {
        id: c.associado.id,
        fullName: c.associado.nome,
        email: c.associado.email,
        phone: c.associado.whatsapp || c.associado.telefone,
      }
    : c.lead
      ? {
          id: c.lead.id,
          fullName: c.lead.nome || fallbackPushName || null,
          email: c.lead.email,
          phone: c.lead.whatsapp || c.lead.telefone,
        }
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
}

async function handleMessageUpsert(payload: EvolutionWebhookPayload, correlationId: string) {
  const data = payload.data
  if (!data) return { ignored: 'no_data' }

  const remoteJid: string | undefined = data.key?.remoteJid
  const fromMe: boolean = !!data.key?.fromMe
  const whatsappMessageId: string | undefined = data.key?.id

  // Timestamp REAL da mensagem (Evolution manda em segundos Unix).
  // Sem isso o CRM cravava o tempo do processamento — leads "atrasados"
  // pareciam ter chegado "agora" e bagunçavam a contagem.
  const messageTs: Date = data.messageTimestamp
    ? new Date(Number(data.messageTimestamp) * 1000)
    : new Date()

  // Grupo descarta SEMPRE — mesmo fromMe (vendedora posta no grupo interno
  // da equipe e isso não pode contaminar Inbox de lead nenhum).
  // ORDEM IMPORTA: filtro de grupo TEM que vir antes do tratamento de fromMe.
  if (isGroup(remoteJid)) return { ignored: 'group' }

  const phone = extractPhoneFromJid(remoteJid)
  if (!phone) return { ignored: 'invalid_jid', remoteJid }

  // Decide direção: fromMe=true (vendedora respondeu via WhatsApp Web/celular)
  // → outbound. Senão → inbound (cliente mandando).
  const direction = resolveDirection(fromMe)

  // Idempotência
  if (whatsappMessageId) {
    const existing = await prisma.message.findUnique({
      where: { whatsappMessageId },
      select: { id: true },
    })
    if (existing) return { ignored: 'duplicate', messageId: existing.id }
  }

  // Mapeia instance → user (cada user tem 1 instancia Evolution propria)
  // Permite filtrar conversas por userId (vendedor so ve as suas)
  const instanceName: string | undefined = payload.instance
  let assignedUserId: string | null = null
  let mappedCompanyId: string | null = null
  if (instanceName) {
    const inst = await prisma.whatsappInstance.findUnique({
      where: { evolutionName: instanceName },
      select: { userId: true, companyId: true },
    })
    if (inst) {
      assignedUserId = inst.userId
      mappedCompanyId = inst.companyId
    }
  }

  const companyId = mappedCompanyId || (await resolveCompanyId())
  if (!companyId) return { ignored: 'no_company' }

  // pushName é o nome do REMETENTE. Em outbound, é o nome do perfil da
  // vendedora ("Consultora leticya- 21go") — NÃO usar pra nomear lead novo.
  const pushName = resolvePushName(fromMe, data.pushName, phone)
  const { kind, content, mimetype } = detectMessageKind(data.message)
  const base64: string | undefined = data.message?.base64 || data.base64

  // 1. Tenta casar com Associado existente pelo telefone
  const associado = await prisma.associado.findFirst({
    where: {
      companyId,
      OR: [
        { telefone: phone },
        { telefone: `+${phone}` },
        { whatsapp: phone },
        { whatsapp: `+${phone}` },
      ],
    },
    select: { id: true, nome: true },
  })

  // 2. Senão, procura Lead
  let leadId: string | null = null
  if (!associado) {
    const existingLead = await prisma.lead.findFirst({
      where: {
        companyId,
        OR: [{ whatsapp: phone }, { telefone: phone }],
      },
      select: { id: true, nome: true },
      orderBy: { createdAt: 'desc' },
    })

    if (existingLead) {
      leadId = existingLead.id
    } else {
      // 3. Cria lead novo automático
      const novo = await prisma.lead.create({
        data: {
          companyId,
          nome: pushName,
          whatsapp: phone,
          telefone: phone,
          origem: 'whatsapp',
          etapaFunil: 'novo',
          qualificadoPor: 'webhook_whatsapp',
        },
        select: { id: true },
      })
      leadId = novo.id

      // 3b. Regra absoluta: cria card automático no Kanban (default associado).
      // Vendedor pode transferir manualmente pra "Vendas de Consultores" depois.
      await ensureCardForLead(leadId, 'associado').catch((err) =>
        console.warn('[EvolutionWebhook] ensureCardForLead falhou:', err?.message),
      )
    }
  }

  // 4. Abre ou reusa conversation
  const whereConv = associado
    ? { companyId, associadoId: associado.id, status: { not: 'closed' } }
    : { companyId, leadId: leadId!, status: { not: 'closed' } }

  let conversation = await prisma.conversation.findFirst({
    where: whereConv,
    orderBy: { createdAt: 'desc' },
    select: { id: true },
  })

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        companyId,
        channel: 'whatsapp',
        status: 'open',
        associadoId: associado?.id ?? null,
        leadId: leadId ?? null,
        assignedToId: assignedUserId, // Vendedor que conectou WhatsApp recebe a conversa
      },
      select: { id: true },
    })
  } else if (assignedUserId && !conversation) {
    // edge case
  }

  // [TRACE-WA] Captura lastMessageAt anterior pra evidenciar drift no update
  const persistStart = Date.now()
  const convBefore = await prisma.conversation.findUnique({
    where: { id: conversation.id },
    select: { lastMessageAt: true, unreadCount: true },
  })

  const sender = resolveSender(fromMe, !!associado)
  const senderId = fromMe ? assignedUserId : null

  console.log(
    '[WA_MESSAGE_PERSIST_START] ' +
      JSON.stringify({
        tag: 'WA_MESSAGE_PERSIST_START',
        correlationId,
        companyId,
        leadId,
        associadoId: associado?.id ?? null,
        conversationId: conversation.id,
        whatsappMessageId: whatsappMessageId || null,
        direction,
        sender,
        senderId,
        oldLastMessageAt: convBefore?.lastMessageAt?.toISOString() || null,
        kind,
      }),
  )

  // 5. Persiste a mensagem com TIMESTAMP REAL da Evolution (não now()).
  const message = await prisma.message.create({
    data: {
      companyId,
      conversationId: conversation.id,
      content,
      sender,
      senderId,
      direction,
      messageType: kind === 'unknown' ? 'text' : kind,
      mediaBase64: base64 || null,
      mediaMimeType: mimetype || null,
      whatsappMessageId: whatsappMessageId || null,
      createdAt: messageTs,
    },
  })

  // lastMessageAt usa o timestamp real — só atualiza se for mais recente que
  // o atual (evita regressão se mensagem antiga chegou atrasada).
  //  - inbound: unreadCount incrementa.
  //  - outbound (fromMe:true): vendedora respondeu = leu tudo, zera unreadCount
  //    + marca como assigned + atribui à dona da instância. Mesma semântica
  //    que inbox.service.sendMessage usa (mantém comportamento consistente).
  const updateResult = await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: messageTs } }],
    },
    data: buildConversationUpdate(direction, messageTs, assignedUserId) as any,
  })

  console.log(
    '[WA_MESSAGE_PERSIST_DONE] ' +
      JSON.stringify({
        tag: 'WA_MESSAGE_PERSIST_DONE',
        correlationId,
        messageId: message.id,
        conversationId: conversation.id,
        direction,
        newLastMessageAt: messageTs.toISOString(),
        lastMessageAtUpdated: updateResult.count > 0,
        durationMs: Date.now() - persistStart,
      }),
  )

  // 6. Socket.io
  try {
    // [TRACE-WA] Conta clientes em cada room antes do emit
    const io = socketService.getIO()
    const roomCompany = `company:${companyId}`
    const roomInbox = `inbox:${companyId}`
    let clientsInCompanyRoom = -1
    let clientsInInboxRoom = -1
    if (io) {
      try {
        const sockCompany = await io.in(roomCompany).fetchSockets()
        clientsInCompanyRoom = sockCompany.length
      } catch {
        /* fetchSockets pode falhar em adapter sem suporte — segue */
      }
      try {
        const sockInbox = await io.in(roomInbox).fetchSockets()
        clientsInInboxRoom = sockInbox.length
      } catch {
        /* idem */
      }
    }

    // Monta `conversation` no mesmo shape do GET /api/conversations.
    // Permite que o frontend insira a linha direto na lista (prepend) sem refetch.
    const conversationDTO = await buildConversationDTOById(conversation.id, pushName).catch(
      () => null,
    )

    const payload = {
      conversationId: conversation.id,
      message: message as any,
      contact: {
        id: associado?.id || leadId || 'unknown',
        fullName: associado?.nome || pushName,
      },
      channel: { type: 'whatsapp', name: 'WhatsApp' },
      // Payload completo da conversation pra prepend imediato no front
      conversation: conversationDTO,
      // [TRACE-WA] propaga correlationId pro frontend
      __correlationId: correlationId,
    }

    // [TRACE-WA] PROVA DE EMISSÃO — log no ponto exato antes de emitir
    console.log(
      '[INBOX_EMIT_PROOF] ' +
        JSON.stringify({
          tag: 'INBOX_EMIT_PROOF',
          timestamp: new Date().toISOString(),
          correlationId,
          companyId,
          conversationId: conversation.id,
          messageId: message.id,
          whatsappMessageId: whatsappMessageId || null,
          direction,
          room: roomCompany,
          roomInbox,
          clientsInRoom: clientsInCompanyRoom,
          clientsInInboxRoom,
          socketInitialized: socketService.isInitialized(),
          payloadKeys: Object.keys(payload),
          conversationIncluded: !!conversationDTO,
        }),
    )

    socketService.emitToCompany(companyId, 'inbox:new_message', payload as any)
  } catch (err) {
    console.warn(
      '[INBOX_SOCKET_EMIT_FAIL] ' +
        JSON.stringify({
          tag: 'INBOX_SOCKET_EMIT_FAIL',
          correlationId,
          err: (err as Error).message,
        }),
    )
  }

  return {
    processed: true,
    messageId: message.id,
    conversationId: conversation.id,
    leadId,
    associadoId: associado?.id ?? null,
    direction,
    kind,
  }
}

async function handleSendMessage(payload: EvolutionWebhookPayload, _correlationId: string) {
  // Log de mensagens que NÓS enviamos — útil pra auditoria,
  // mas a persistência principal é feita pelo módulo que dispara o envio.
  const data = payload.data
  const whatsappMessageId: string | undefined = data?.key?.id
  if (!whatsappMessageId) return { ignored: 'no_id' }

  // Se já existe (porque o módulo de envio persistiu), só atualiza timestamp
  const existing = await prisma.message.findUnique({
    where: { whatsappMessageId },
    select: { id: true },
  })

  return { logged: true, alreadyPersisted: !!existing }
}

async function handleConnectionUpdate(payload: EvolutionWebhookPayload, _correlationId: string) {
  const state = payload.data?.state || payload.data?.connection
  console.log(`[EvolutionWebhook] connection update → ${state}`, {
    instance: payload.instance,
  })
  return { logged: true, state }
}

export async function processEvolutionWebhook(
  payload: EvolutionWebhookPayload,
  // [TRACE-WA] correlationId injetado pela route; fallback caso seja chamado de outro lugar
  correlationId: string = `proc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
) {
  const event = (payload.event || '').toLowerCase().replace(/_/g, '.')

  switch (event) {
    case 'messages.upsert':
      return handleMessageUpsert(payload, correlationId)
    case 'send.message':
      return handleSendMessage(payload, correlationId)
    case 'connection.update':
      return handleConnectionUpdate(payload, correlationId)
    default:
      return { ignored: 'unhandled_event', event: payload.event }
  }
}
