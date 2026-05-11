import { prisma } from '../../config/database'
import { socketService } from '../../websocket'
import { ensureCardForLead } from '../leads/lead-card.helper'

/**
 * Webhook da Evolution API (WhatsApp via Baileys).
 * Recebe eventos MESSAGES_UPSERT, SEND_MESSAGE, CONNECTION_UPDATE.
 *
 * Fluxo principal (MESSAGES_UPSERT inbound):
 *  1. Ignora mensagens do próprio bot (fromMe) e de grupos.
 *  2. Idempotência via whatsappMessageId (evita processar 2x).
 *  3. Procura Associado → depois Lead → cria Lead novo se nada bater.
 *  4. Abre (ou reusa) Conversation.
 *  5. Persiste Message com tipo + mídia.
 *  6. Emite inbox:new_message via Socket.io.
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

async function resolveCompanyId(): Promise<string | null> {
  if (process.env.DEFAULT_COMPANY_ID) return process.env.DEFAULT_COMPANY_ID
  const first = await prisma.company.findFirst({ select: { id: true } })
  return first?.id ?? null
}

async function handleMessageUpsert(payload: EvolutionWebhookPayload) {
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

  if (fromMe) return { ignored: 'from_me' }
  if (isGroup(remoteJid)) return { ignored: 'group' }

  const phone = extractPhoneFromJid(remoteJid)
  if (!phone) return { ignored: 'invalid_jid', remoteJid }

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

  const pushName = firstName(data.pushName)
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

  // 5. Persiste a mensagem com TIMESTAMP REAL da Evolution (não now()).
  const message = await prisma.message.create({
    data: {
      companyId,
      conversationId: conversation.id,
      content,
      sender: associado ? 'associado' : 'lead',
      direction: 'inbound',
      messageType: kind === 'unknown' ? 'text' : kind,
      mediaBase64: base64 || null,
      mediaMimeType: mimetype || null,
      whatsappMessageId: whatsappMessageId || null,
      createdAt: messageTs,
    },
  })

  // lastMessageAt também usa o timestamp real — só atualiza se for mais
  // recente que o atual (evita regressão se mensagem antiga chegou atrasada).
  await prisma.conversation.updateMany({
    where: {
      id: conversation.id,
      OR: [{ lastMessageAt: null }, { lastMessageAt: { lt: messageTs } }],
    },
    data: { lastMessageAt: messageTs },
  })

  // 6. Socket.io
  try {
    socketService.emitToCompany(companyId, 'inbox:new_message', {
      conversationId: conversation.id,
      message: message as any,
      contact: {
        id: associado?.id || leadId || 'unknown',
        fullName: associado?.nome || pushName,
      },
      channel: { type: 'whatsapp', name: 'WhatsApp' },
    })
  } catch (err) {
    console.warn('[EvolutionWebhook] socket emit failed:', (err as Error).message)
  }

  return {
    processed: true,
    messageId: message.id,
    conversationId: conversation.id,
    leadId,
    associadoId: associado?.id ?? null,
    kind,
  }
}

async function handleSendMessage(payload: EvolutionWebhookPayload) {
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

async function handleConnectionUpdate(payload: EvolutionWebhookPayload) {
  const state = payload.data?.state || payload.data?.connection
  console.log(`[EvolutionWebhook] connection update → ${state}`, {
    instance: payload.instance,
  })
  return { logged: true, state }
}

export async function processEvolutionWebhook(payload: EvolutionWebhookPayload) {
  const event = (payload.event || '').toLowerCase().replace(/_/g, '.')

  switch (event) {
    case 'messages.upsert':
      return handleMessageUpsert(payload)
    case 'send.message':
      return handleSendMessage(payload)
    case 'connection.update':
      return handleConnectionUpdate(payload)
    default:
      return { ignored: 'unhandled_event', event: payload.event }
  }
}
