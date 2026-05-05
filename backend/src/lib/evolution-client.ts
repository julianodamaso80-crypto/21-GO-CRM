import axios, { type AxiosInstance } from 'axios'

/**
 * Cliente tipado da Evolution API v2 (porting do projeto 21Go-Disparo).
 *
 * Convenção de keys:
 *  - globalKey: usada pra criar/listar/deletar instâncias
 *  - instanceKey: retornada em hash/apikey na criação — usada pra QR/mensagens/status
 */

export type ConnectionState = 'open' | 'connecting' | 'close'

export class EvolutionClient {
  private readonly http: AxiosInstance

  constructor(
    baseUrl: string,
    private readonly globalKey: string,
    defaultTimeoutMs = 30_000,
  ) {
    this.http = axios.create({
      baseURL: baseUrl,
      timeout: defaultTimeoutMs,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  private withKey(apikey: string) {
    return { headers: { apikey } }
  }

  /**
   * Cria instância com flags anti-ban. Retorna apiKey (instance key) + QR base64 inicial.
   */
  async createInstance(params: {
    instanceName: string
    webhookUrl?: string | null
  }): Promise<{ instanceName: string; apiKey: string; qrCodeBase64: string | null }> {
    const body: Record<string, unknown> = {
      instanceName: params.instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      groupsIgnore: true,
      rejectCall: true,
      msgCall: 'Nao aceito chamadas, envie mensagem de texto.',
      alwaysOnline: false,
      readMessages: false,
      syncFullHistory: false,
    }

    if (params.webhookUrl) {
      body.webhook = {
        url: params.webhookUrl,
        byEvents: false,
        base64: true,
        events: [
          'QRCODE_UPDATED',
          'CONNECTION_UPDATE',
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'SEND_MESSAGE',
        ],
      }
    }

    const { data } = await this.http.post('/instance/create', body, this.withKey(this.globalKey))

    const apiKey =
      typeof data.hash === 'string' ? data.hash : data.hash?.apikey ?? ''

    return {
      instanceName: data.instance?.instanceName || params.instanceName,
      apiKey,
      qrCodeBase64: data.qrcode?.base64 ?? null,
    }
  }

  async deleteInstance(instanceName: string): Promise<void> {
    await this.http
      .delete(`/instance/delete/${instanceName}`, this.withKey(this.globalKey))
      .catch(() => undefined)
  }

  async fetchQrCode(
    instanceName: string,
    instanceKey: string,
  ): Promise<{ base64: string | null; pairingCode: string | null }> {
    try {
      const { data } = await this.http.get(
        `/instance/connect/${instanceName}`,
        this.withKey(instanceKey),
      )
      return {
        base64: data.base64 ?? null,
        pairingCode: data.pairingCode ?? null,
      }
    } catch {
      return { base64: null, pairingCode: null }
    }
  }

  async fetchConnectionState(instanceName: string, instanceKey: string): Promise<ConnectionState> {
    try {
      const { data } = await this.http.get(
        `/instance/connectionState/${instanceName}`,
        this.withKey(instanceKey),
      )
      const state = data.instance?.state ?? data.state ?? 'close'
      if (state === 'open' || state === 'connecting') return state
      return 'close'
    } catch {
      return 'close'
    }
  }

  async fetchInstanceInfo(
    instanceName: string,
    instanceKey: string,
  ): Promise<{ ownerJid: string | null; profileName: string | null; profilePicUrl: string | null }> {
    try {
      const { data } = await this.http.get('/instance/fetchInstances', {
        ...this.withKey(instanceKey),
        params: { instanceName },
      })
      const item = Array.isArray(data) ? data[0] : data
      if (!item) return { ownerJid: null, profileName: null, profilePicUrl: null }

      return {
        ownerJid: item.ownerJid ?? item.instance?.owner ?? null,
        profileName: item.profileName ?? item.instance?.profileName ?? null,
        profilePicUrl:
          item.profilePicUrl ?? item.profilePictureUrl ?? item.instance?.profilePictureUrl ?? null,
      }
    } catch {
      return { ownerJid: null, profileName: null, profilePicUrl: null }
    }
  }

  async logoutInstance(instanceName: string, instanceKey: string): Promise<void> {
    await this.http
      .delete(`/instance/logout/${instanceName}`, this.withKey(instanceKey))
      .catch(() => undefined)
  }

  /** Envia mensagem de texto pelo WhatsApp da instância */
  async sendText(params: {
    instanceName: string
    instanceKey: string
    number: string
    text: string
    delayMs?: number
  }): Promise<any> {
    const cleanNumber = params.number.replace(/\D/g, '')
    const { data } = await this.http.post(
      `/message/sendText/${params.instanceName}`,
      { number: cleanNumber, text: params.text, delay: params.delayMs ?? 1000 },
      this.withKey(params.instanceKey),
    )
    return data
  }
}

/** Singleton lazy: cria com env vars na primeira chamada */
let clientInstance: EvolutionClient | null = null
export function getEvolutionClient(): EvolutionClient {
  if (clientInstance) return clientInstance
  const baseUrl = process.env.EVOLUTION_API_URL || ''
  const globalKey = process.env.EVOLUTION_API_KEY || ''
  if (!baseUrl || !globalKey) {
    throw new Error('EVOLUTION_API_URL ou EVOLUTION_API_KEY ausentes nas env vars')
  }
  clientInstance = new EvolutionClient(baseUrl, globalKey)
  return clientInstance
}
