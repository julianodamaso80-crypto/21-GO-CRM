import { describe, it, expect, vi, beforeEach } from 'vitest'

// ===== Mocks ANTES de importar o SUT =====================================
// vi.mock é hoisted ao topo do arquivo pelo vitest — precisamos usar
// vi.hoisted pra declarar os mocks também no topo, senão ReferenceError.

const { mockPrisma, ensureCardForLeadMock, socketEmitMock } = vi.hoisted(() => {
  const mockPrisma = {
    message: { findUnique: vi.fn(), create: vi.fn() },
    whatsappInstance: { findUnique: vi.fn() },
    company: { findFirst: vi.fn() },
    associado: { findFirst: vi.fn() },
    lead: { findFirst: vi.fn(), create: vi.fn() },
    conversation: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
  }
  const ensureCardForLeadMock = vi.fn()
  const socketEmitMock = vi.fn()
  return { mockPrisma, ensureCardForLeadMock, socketEmitMock }
})

vi.mock('../../config/database', () => ({ prisma: mockPrisma }))

vi.mock('../../websocket', () => ({
  socketService: {
    getIO: () => null,
    emitToCompany: socketEmitMock,
    isInitialized: () => false,
  },
}))

vi.mock('../leads/lead-card.helper', () => ({
  ensureCardForLead: ensureCardForLeadMock,
}))

// Importa o SUT DEPOIS dos mocks
import {
  buildConversationUpdate,
  processEvolutionWebhook,
  resolveDirection,
  resolvePushName,
  resolveSender,
} from './webhook-evolution.service'

// ===== Helpers ============================================================

const COMPANY_ID = 'company-21go'
const VENDEDORA_ID = 'user-leticya'
const CLIENT_PHONE = '5521991234567'
const CLIENT_JID = `${CLIENT_PHONE}@s.whatsapp.net`
const VENDEDORA_NAME = 'Consultora leticya- 21go'
const CLIENT_NAME = 'João da Silva'

function buildUpsertPayload(opts: {
  fromMe: boolean
  remoteJid?: string
  pushName?: string
  text?: string
  messageId?: string
  timestamp?: number
  instance?: string
}) {
  return {
    event: 'messages.upsert',
    instance: opts.instance ?? 'site21go',
    data: {
      key: {
        remoteJid: opts.remoteJid ?? CLIENT_JID,
        fromMe: opts.fromMe,
        id: opts.messageId ?? `wamid-${Math.random().toString(36).slice(2, 8)}`,
      },
      pushName: opts.pushName ?? (opts.fromMe ? VENDEDORA_NAME : CLIENT_NAME),
      messageTimestamp: opts.timestamp ?? Math.floor(Date.now() / 1000),
      message: { conversation: opts.text ?? 'mensagem de teste' },
    },
  }
}

function resetMocksToDefaults() {
  vi.clearAllMocks()
  ensureCardForLeadMock.mockResolvedValue({
    cardId: 'card1',
    pipeId: 'pipe1',
    phaseId: 'phase1',
    created: true,
  })
  mockPrisma.whatsappInstance.findUnique.mockResolvedValue({
    userId: VENDEDORA_ID,
    companyId: COMPANY_ID,
  })
  mockPrisma.message.findUnique.mockResolvedValue(null)
  mockPrisma.message.create.mockImplementation(({ data }: any) => ({
    id: 'msg-' + Math.random().toString(36).slice(2, 8),
    ...data,
  }))
  mockPrisma.associado.findFirst.mockResolvedValue(null)
  mockPrisma.lead.findFirst.mockResolvedValue(null)
  mockPrisma.lead.create.mockImplementation(({ data }: any) => ({
    id: 'lead-' + Math.random().toString(36).slice(2, 8),
    ...data,
  }))
  mockPrisma.conversation.findFirst.mockResolvedValue(null)
  mockPrisma.conversation.create.mockImplementation(({ data }: any) => ({
    id: 'conv-' + Math.random().toString(36).slice(2, 8),
    ...data,
  }))
  mockPrisma.conversation.findUnique.mockResolvedValue({
    lastMessageAt: null,
    unreadCount: 0,
  })
  mockPrisma.conversation.updateMany.mockResolvedValue({ count: 1 })
}

// ===== 1. Funções puras ===================================================

describe('resolveDirection', () => {
  it('fromMe=true → outbound', () => {
    expect(resolveDirection(true)).toBe('outbound')
  })
  it('fromMe=false → inbound', () => {
    expect(resolveDirection(false)).toBe('inbound')
  })
})

describe('resolvePushName', () => {
  it('inbound: usa pushName do payload', () => {
    expect(resolvePushName(false, 'João Silva', CLIENT_PHONE)).toBe('João Silva')
  })

  it('inbound sem pushName: fallback "Contato WhatsApp"', () => {
    expect(resolvePushName(false, undefined, CLIENT_PHONE)).toBe('Contato WhatsApp')
  })

  it('outbound: NUNCA usa pushName (que seria nome da vendedora) — fallback 4 últimos do tel', () => {
    expect(resolvePushName(true, VENDEDORA_NAME, '5521991234567')).toBe('Contato 4567')
  })

  it('outbound com pushName vazio também usa fallback 4 últimos', () => {
    expect(resolvePushName(true, undefined, '5521980214882')).toBe('Contato 4882')
  })
})

describe('resolveSender', () => {
  it('fromMe=true → vendedor (mesmo se associado existir)', () => {
    expect(resolveSender(true, true)).toBe('vendedor')
    expect(resolveSender(true, false)).toBe('vendedor')
  })
  it('inbound + associado → associado', () => {
    expect(resolveSender(false, true)).toBe('associado')
  })
  it('inbound sem associado → lead', () => {
    expect(resolveSender(false, false)).toBe('lead')
  })
})

describe('buildConversationUpdate', () => {
  const ts = new Date('2026-05-15T12:00:00Z')

  it('inbound: incrementa unreadCount, não mexe em status nem assigned', () => {
    const update = buildConversationUpdate('inbound', ts, VENDEDORA_ID)
    expect(update).toEqual({
      lastMessageAt: ts,
      unreadCount: { increment: 1 },
    })
    expect(update.status).toBeUndefined()
    expect(update.assignedToId).toBeUndefined()
  })

  it('outbound: zera unreadCount, marca como assigned, atribui ao user da instância', () => {
    const now = new Date('2026-05-15T12:00:30Z')
    const update = buildConversationUpdate('outbound', ts, VENDEDORA_ID, now)
    expect(update).toEqual({
      lastMessageAt: ts,
      unreadCount: 0,
      lastReadAt: now,
      status: 'assigned',
      assignedToId: VENDEDORA_ID,
    })
  })

  it('outbound com assignedUserId=null (instância sem mapping): NÃO mexe em assignedToId nem status, mas zera unread e marca como lida', () => {
    const now = new Date('2026-05-15T12:00:30Z')
    const update = buildConversationUpdate('outbound', ts, null, now)
    // Defesa contra "roubo" de conversa: sem mapping de user, preserva o que estava
    expect(update.assignedToId).toBeUndefined()
    expect(update.status).toBeUndefined()
    // Mas vendedora respondeu = leu tudo, isso é verdade independente do dono
    expect(update.unreadCount).toBe(0)
    expect(update.lastReadAt).toBe(now)
    expect(update.lastMessageAt).toBe(ts)
  })
})

// ===== 2. handleMessageUpsert (integration com mocks de Prisma) ===========

describe('processEvolutionWebhook → handleMessageUpsert', () => {
  beforeEach(() => {
    resetMocksToDefaults()
  })

  it('Inbound de lead novo: cria lead, conversa, mensagem inbound, incrementa unread', async () => {
    const payload = buildUpsertPayload({ fromMe: false, text: 'Tenho interesse no plano básico' })

    const result: any = await processEvolutionWebhook(payload as any, 'test-corr-1')

    expect(result.processed).toBe(true)
    expect(result.direction).toBe('inbound')

    // Criou lead novo
    expect(mockPrisma.lead.create).toHaveBeenCalledOnce()
    const leadData = mockPrisma.lead.create.mock.calls[0][0].data
    expect(leadData.nome).toBe(CLIENT_NAME)
    expect(leadData.whatsapp).toBe(CLIENT_PHONE)
    expect(leadData.origem).toBe('whatsapp')

    // Criou card no Kanban
    expect(ensureCardForLeadMock).toHaveBeenCalledWith(expect.any(String), 'associado')

    // Criou conversa atribuída à vendedora da instância
    expect(mockPrisma.conversation.create).toHaveBeenCalledOnce()
    const convData = mockPrisma.conversation.create.mock.calls[0][0].data
    expect(convData.assignedToId).toBe(VENDEDORA_ID)

    // Persistiu mensagem com direction='inbound', sender='lead'
    const msgData = mockPrisma.message.create.mock.calls[0][0].data
    expect(msgData.direction).toBe('inbound')
    expect(msgData.sender).toBe('lead')
    expect(msgData.senderId).toBeNull()
    expect(msgData.content).toBe('Tenho interesse no plano básico')

    // Incrementou unread
    const updateData = mockPrisma.conversation.updateMany.mock.calls[0][0].data
    expect(updateData.unreadCount).toEqual({ increment: 1 })
    expect(updateData.status).toBeUndefined()
  })

  it('Outbound fromMe:true em conversa existente: persiste outbound, zera unread, marca assigned', async () => {
    // Conversa já existe, lead também
    mockPrisma.lead.findFirst.mockResolvedValue({ id: 'lead-existente', nome: 'João Silva' })
    mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-existente' })

    const payload = buildUpsertPayload({
      fromMe: true,
      text: 'Olá João, posso te ajudar',
      pushName: VENDEDORA_NAME,
    })

    const result: any = await processEvolutionWebhook(payload as any, 'test-corr-2')

    expect(result.processed).toBe(true)
    expect(result.direction).toBe('outbound')

    // NÃO criou lead novo (já existia)
    expect(mockPrisma.lead.create).not.toHaveBeenCalled()
    // NÃO criou card (lead já existe)
    expect(ensureCardForLeadMock).not.toHaveBeenCalled()

    // Persistiu como outbound
    const msgData = mockPrisma.message.create.mock.calls[0][0].data
    expect(msgData.direction).toBe('outbound')
    expect(msgData.sender).toBe('vendedor')
    expect(msgData.senderId).toBe(VENDEDORA_ID)
    expect(msgData.conversationId).toBe('conv-existente')

    // Zerou unread + marcou assigned
    const updateData = mockPrisma.conversation.updateMany.mock.calls[0][0].data
    expect(updateData.unreadCount).toBe(0)
    expect(updateData.status).toBe('assigned')
    expect(updateData.assignedToId).toBe(VENDEDORA_ID)
    expect(updateData.lastReadAt).toBeInstanceOf(Date)
  })

  it('Outbound fromMe:true pra contato NOVO (prospecção): cria lead "Contato XXXX", NÃO usa pushName da vendedora', async () => {
    // Sem associado, sem lead → vai criar
    const phone = '5521981115678'
    const payload = buildUpsertPayload({
      fromMe: true,
      remoteJid: `${phone}@s.whatsapp.net`,
      pushName: VENDEDORA_NAME, // nome da vendedora — NÃO pode virar nome do lead
      text: 'Oi! Você se interessa por proteção veicular?',
    })

    const result: any = await processEvolutionWebhook(payload as any, 'test-corr-3')

    expect(result.processed).toBe(true)
    expect(result.direction).toBe('outbound')

    // Lead criado com nome fallback baseado no telefone, NUNCA o pushName
    expect(mockPrisma.lead.create).toHaveBeenCalledOnce()
    const leadData = mockPrisma.lead.create.mock.calls[0][0].data
    expect(leadData.nome).toBe('Contato 5678')
    expect(leadData.nome).not.toContain('leticya')
    expect(leadData.nome).not.toContain('Consultora')
    expect(leadData.whatsapp).toBe(phone)

    // Comportamento (A): outbound pra contato novo TAMBÉM cria card no Kanban,
    // mantendo a regra "todo lead tem card". Card pode ser deletado/movido
    // depois se a prospecção não vingou.
    expect(ensureCardForLeadMock).toHaveBeenCalledWith(expect.any(String), 'associado')

    // Mensagem persiste como outbound
    const msgData = mockPrisma.message.create.mock.calls[0][0].data
    expect(msgData.direction).toBe('outbound')
    expect(msgData.sender).toBe('vendedor')
    expect(msgData.senderId).toBe(VENDEDORA_ID)
  })

  it('fromMe:true em GRUPO: descarta com ignored=group, NADA é persistido', async () => {
    const payload = buildUpsertPayload({
      fromMe: true,
      remoteJid: '120363425026743784@g.us', // grupo
      pushName: VENDEDORA_NAME,
      text: 'msg interna do grupo da equipe',
    })

    const result: any = await processEvolutionWebhook(payload as any, 'test-corr-4')

    expect(result).toEqual({ ignored: 'group' })

    // ZERO escrita no banco
    expect(mockPrisma.lead.create).not.toHaveBeenCalled()
    expect(mockPrisma.conversation.create).not.toHaveBeenCalled()
    expect(mockPrisma.message.create).not.toHaveBeenCalled()
    expect(mockPrisma.conversation.updateMany).not.toHaveBeenCalled()
  })

  it('Idempotência: webhook fromMe:true com whatsappMessageId duplicado (já gravado por inbox.service.sendMessage) → ignored=duplicate', async () => {
    // Simula que inbox.service.sendMessage já gravou mensagem com este whatsappMessageId
    mockPrisma.message.findUnique.mockResolvedValue({ id: 'msg-ja-existente' })

    const payload = buildUpsertPayload({
      fromMe: true,
      messageId: 'wamid-duplicate-abc',
      text: 'Mensagem que o CRM já gravou',
    })

    const result: any = await processEvolutionWebhook(payload as any, 'test-corr-5')

    expect(result).toEqual({ ignored: 'duplicate', messageId: 'msg-ja-existente' })

    // ZERO escrita adicional
    expect(mockPrisma.message.create).not.toHaveBeenCalled()
    expect(mockPrisma.conversation.create).not.toHaveBeenCalled()
    expect(mockPrisma.lead.create).not.toHaveBeenCalled()
    expect(mockPrisma.conversation.updateMany).not.toHaveBeenCalled()

    // Mas o findUnique de idempotência foi chamado
    expect(mockPrisma.message.findUnique).toHaveBeenCalledWith({
      where: { whatsappMessageId: 'wamid-duplicate-abc' },
      select: { id: true },
    })
  })

  it('Inbound em GRUPO: descarta também (continua filtrando)', async () => {
    const payload = buildUpsertPayload({
      fromMe: false,
      remoteJid: '120363425026743784@g.us',
    })

    const result: any = await processEvolutionWebhook(payload as any, 'test-corr-6')

    expect(result).toEqual({ ignored: 'group' })
    expect(mockPrisma.lead.create).not.toHaveBeenCalled()
    expect(mockPrisma.message.create).not.toHaveBeenCalled()
  })

  it('Outbound em ASSOCIADO existente: sender ainda é "vendedor" (não "associado")', async () => {
    mockPrisma.associado.findFirst.mockResolvedValue({ id: 'assoc-1', nome: 'Cliente Antigo' })
    mockPrisma.conversation.findFirst.mockResolvedValue({ id: 'conv-assoc' })

    const payload = buildUpsertPayload({
      fromMe: true,
      pushName: VENDEDORA_NAME,
      text: 'Resposta da vendedora ao associado',
    })

    const result: any = await processEvolutionWebhook(payload as any, 'test-corr-7')

    expect(result.direction).toBe('outbound')
    const msgData = mockPrisma.message.create.mock.calls[0][0].data
    expect(msgData.sender).toBe('vendedor') // não 'associado' nem 'lead'
    expect(msgData.senderId).toBe(VENDEDORA_ID)
  })
})
