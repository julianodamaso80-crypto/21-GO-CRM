// Webhook model not in 21Go schema — fallback service

export interface CreateWebhookDTO {
  url?: string
  events?: string[]
  secret?: string
}

export interface UpdateWebhookDTO extends Partial<CreateWebhookDTO> {
  isActive?: boolean
}

export class WebhooksService {
  async listWebhooks(_companyId: string) {
    return []
  }

  async getWebhookById(_id: string, _companyId: string) {
    return null
  }

  async createWebhook(_companyId: string, _data: any) {
    return { id: 'stub', message: 'Webhooks nao disponiveis ainda' }
  }

  async updateWebhook(_id: string, _companyId: string, _data: any) {
    return { id: 'stub', message: 'Webhooks nao disponiveis ainda' }
  }

  async deleteWebhook(_id: string, _companyId: string) {
    return { success: true }
  }

  // Lista de eventos disponíveis pro CRUD da UI (stub — schema não tem webhooks ainda)
  getEvents() {
    return [
      { code: 'lead.created', label: 'Lead criado' },
      { code: 'lead.qualified', label: 'Lead qualificado' },
      { code: 'cotacao.enviada', label: 'Cotação enviada' },
      { code: 'sinistro.aberto', label: 'Sinistro aberto' },
      { code: 'sinistro.encerrado', label: 'Sinistro encerrado' },
    ]
  }
}
