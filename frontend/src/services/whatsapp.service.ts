import { api } from '../lib/api'

export type WhatsappStatus = 'DISCONNECTED' | 'QR_PENDING' | 'CONNECTED'
export type ConnectionState = 'open' | 'connecting' | 'close'

export interface WhatsappInstance {
  id: string
  companyId: string
  userId: string
  name: string
  evolutionName: string
  phone: string | null
  ownerJid: string | null
  profileName: string | null
  profilePicUrl: string | null
  status: WhatsappStatus
  connectedAt: string | null
  lastSeenAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateInstanceResponse {
  instance: WhatsappInstance
  qrCodeBase64: string | null
}

export interface InstanceStatusResponse extends WhatsappInstance {
  connectionState: ConnectionState
  qrCodeBase64: string | null
}

export const whatsappService = {
  async getMine(): Promise<WhatsappInstance | null> {
    const r = await api.get<WhatsappInstance | null>('/whatsapp')
    return r.data
  },

  async create(name?: string): Promise<CreateInstanceResponse> {
    const r = await api.post<CreateInstanceResponse>('/whatsapp', { name: name || 'Meu WhatsApp' })
    return r.data
  },

  async status(): Promise<InstanceStatusResponse | null> {
    const r = await api.get<InstanceStatusResponse | null>('/whatsapp/status')
    return r.data
  },

  async delete(): Promise<void> {
    await api.delete('/whatsapp')
  },

  async logout(): Promise<WhatsappInstance> {
    const r = await api.post<WhatsappInstance>('/whatsapp/logout', {})
    return r.data
  },
}
