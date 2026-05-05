import { prisma } from '../../config/database'
import { AppError } from '../../utils/app-error'
import { getEvolutionClient } from '../../lib/evolution-client'

const STATUS = {
  DISCONNECTED: 'DISCONNECTED',
  QR_PENDING: 'QR_PENDING',
  CONNECTED: 'CONNECTED',
} as const

function buildEvolutionName(userId: string, name: string): string {
  const prefix = process.env.EVOLUTION_INSTANCE_PREFIX || '21gocrm_'
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 20)
  const short = userId.slice(-8)
  return `${prefix}${short}_${slug || 'chip'}`
}

function shape(i: any) {
  return {
    id: i.id,
    companyId: i.companyId,
    userId: i.userId,
    name: i.name,
    evolutionName: i.evolutionName,
    phone: i.phone,
    ownerJid: i.ownerJid,
    profileName: i.profileName,
    profilePicUrl: i.profilePicUrl,
    status: i.status,
    connectedAt: i.connectedAt,
    lastSeenAt: i.lastSeenAt,
    createdAt: i.createdAt,
    updatedAt: i.updatedAt,
  }
}

export class WhatsappService {
  /** GET /whatsapp — instância do user logado (1 por user) */
  async getMine(userId: string, companyId: string) {
    const inst = await prisma.whatsappInstance.findFirst({
      where: { userId, companyId },
    })
    return inst ? shape(inst) : null
  }

  /** POST /whatsapp — cria instância (ou retorna a existente) + retorna QR inicial */
  async create(userId: string, companyId: string, name: string) {
    const trimmed = name?.trim() || 'Meu WhatsApp'

    // 1 por user — se já existe, retorna a existente sem recriar
    const existing = await prisma.whatsappInstance.findFirst({
      where: { userId, companyId },
    })
    if (existing) {
      // tenta forçar QR novo se ainda não conectou
      if (existing.status !== STATUS.CONNECTED && existing.evolutionApiKey) {
        const evolution = getEvolutionClient()
        const qr = await evolution.fetchQrCode(existing.evolutionName, existing.evolutionApiKey)
        return { instance: shape(existing), qrCodeBase64: qr.base64 }
      }
      return { instance: shape(existing), qrCodeBase64: null }
    }

    const evolutionName = buildEvolutionName(userId, trimmed)
    const webhookBase = process.env.PUBLIC_WEBHOOK_URL || process.env.BACKEND_URL || ''
    const webhookUrl = webhookBase
      ? `${webhookBase.replace(/\/$/, '')}/api/webhook/evolution`
      : null

    const evolution = getEvolutionClient()
    let created
    try {
      created = await evolution.createInstance({ instanceName: evolutionName, webhookUrl })
    } catch (err: any) {
      throw new AppError(
        `Evolution API indisponivel: ${err?.message || 'unknown'}`,
        502,
        'EVOLUTION_UNAVAILABLE',
      )
    }

    const inst = await prisma.whatsappInstance.create({
      data: {
        companyId,
        userId,
        name: trimmed,
        evolutionName: created.instanceName,
        evolutionApiKey: created.apiKey,
        status: created.qrCodeBase64 ? STATUS.QR_PENDING : STATUS.DISCONNECTED,
      },
    })

    return { instance: shape(inst), qrCodeBase64: created.qrCodeBase64 }
  }

  /** GET /whatsapp/status — polling: estado + QR atualizado */
  async status(userId: string, companyId: string) {
    const inst = await prisma.whatsappInstance.findFirst({
      where: { userId, companyId },
    })
    if (!inst) return null

    if (!inst.evolutionApiKey) {
      return { ...shape(inst), connectionState: 'close', qrCodeBase64: null }
    }

    const evolution = getEvolutionClient()
    const connectionState = await evolution.fetchConnectionState(
      inst.evolutionName,
      inst.evolutionApiKey,
    )

    let newStatus = inst.status
    let qrCodeBase64: string | null = null

    if (connectionState === 'open') {
      newStatus = STATUS.CONNECTED
      const info = await evolution.fetchInstanceInfo(inst.evolutionName, inst.evolutionApiKey)
      const phone = info.ownerJid ? info.ownerJid.replace(/\D/g, '').replace(/^55/, '') : inst.phone

      const updated = await prisma.whatsappInstance.update({
        where: { id: inst.id },
        data: {
          status: newStatus,
          ownerJid: info.ownerJid ?? inst.ownerJid,
          profileName: info.profileName ?? inst.profileName,
          profilePicUrl: info.profilePicUrl ?? inst.profilePicUrl,
          phone,
          connectedAt: inst.connectedAt ?? new Date(),
          lastSeenAt: new Date(),
        },
      })
      return { ...shape(updated), connectionState, qrCodeBase64: null }
    }

    if (connectionState === 'connecting') {
      newStatus = STATUS.QR_PENDING
      const qr = await evolution.fetchQrCode(inst.evolutionName, inst.evolutionApiKey)
      qrCodeBase64 = qr.base64

      if (inst.status !== newStatus) {
        await prisma.whatsappInstance.update({
          where: { id: inst.id },
          data: { status: newStatus },
        })
      }
      return { ...shape({ ...inst, status: newStatus }), connectionState, qrCodeBase64 }
    }

    // close
    newStatus = STATUS.DISCONNECTED
    if (inst.status !== newStatus) {
      await prisma.whatsappInstance.update({
        where: { id: inst.id },
        data: { status: newStatus },
      })
    }
    return { ...shape({ ...inst, status: newStatus }), connectionState, qrCodeBase64: null }
  }

  /** DELETE /whatsapp — remove instância e desconecta */
  async delete(userId: string, companyId: string) {
    const inst = await prisma.whatsappInstance.findFirst({
      where: { userId, companyId },
    })
    if (!inst) throw new AppError('Instancia nao encontrada', 404, 'NOT_FOUND')

    if (inst.evolutionApiKey) {
      const evolution = getEvolutionClient()
      await evolution.deleteInstance(inst.evolutionName)
    }
    await prisma.whatsappInstance.delete({ where: { id: inst.id } })
    return { success: true }
  }

  /** POST /whatsapp/logout — desconecta sem deletar */
  async logout(userId: string, companyId: string) {
    const inst = await prisma.whatsappInstance.findFirst({
      where: { userId, companyId },
    })
    if (!inst) throw new AppError('Instancia nao encontrada', 404, 'NOT_FOUND')

    if (inst.evolutionApiKey) {
      const evolution = getEvolutionClient()
      await evolution.logoutInstance(inst.evolutionName, inst.evolutionApiKey)
    }
    const updated = await prisma.whatsappInstance.update({
      where: { id: inst.id },
      data: { status: STATUS.DISCONNECTED, lastSeenAt: new Date() },
    })
    return shape(updated)
  }

  /** Helper interno: envia mensagem pelo WhatsApp do user */
  async sendText(userId: string, companyId: string, number: string, text: string) {
    const inst = await prisma.whatsappInstance.findFirst({
      where: { userId, companyId, status: STATUS.CONNECTED },
    })
    if (!inst || !inst.evolutionApiKey) {
      throw new AppError('Voce nao tem WhatsApp conectado', 400, 'NO_INSTANCE')
    }
    const evolution = getEvolutionClient()
    return evolution.sendText({
      instanceName: inst.evolutionName,
      instanceKey: inst.evolutionApiKey,
      number,
      text,
    })
  }
}
