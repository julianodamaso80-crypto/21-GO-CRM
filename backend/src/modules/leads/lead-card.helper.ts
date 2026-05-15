import { prisma } from '../../config/database'

export type LeadTipo = 'consultor' | 'associado'

const NOMES_GENERICOS = new Set(['', '21 Go', '21Go', 'Voce', 'Você', '.', '..', '...'])

/**
 * Regra absoluta do projeto: TODO lead deve ter card num funil do Kanban.
 *
 * Heurística de classificação (em ordem de precedência):
 *  1. hint explícito (`'consultor' | 'associado'`)
 *  2. lead.origem contém "consultor"          → consultor
 *  3. lead.qualificadoPor contém "consultor"  → consultor
 *  4. fallback: associado
 *
 * Idempotência: chave é `cards.leadId` (1:1). Se já existe card desse lead,
 * devolve o existente em vez de duplicar.
 *
 * Sanitização de title: se o nome do lead é genérico (vinda lixo de pushName
 * do WhatsApp tipo "21 Go", "Você", "."), usa últimos 4 dígitos do whatsapp.
 */
export async function ensureCardForLead(
  leadId: string,
  hint?: LeadTipo,
): Promise<{ cardId: string; pipeId: string; phaseId: string; created: boolean } | null> {
  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      companyId: true,
      nome: true,
      origem: true,
      qualificadoPor: true,
      whatsapp: true,
      telefone: true,
      vendedorId: true,
    },
  })
  if (!lead) {
    console.warn(`[ensureCardForLead] Lead ${leadId} não encontrado`)
    return null
  }

  // Idempotência por leadId (1:1)
  const existingByLead = await prisma.card.findFirst({
    where: { leadId: lead.id },
    select: { id: true, pipeId: true, currentPhaseId: true },
  })
  if (existingByLead) {
    return {
      cardId: existingByLead.id,
      pipeId: existingByLead.pipeId,
      phaseId: existingByLead.currentPhaseId,
      created: false,
    }
  }

  const tipo: LeadTipo = resolveTipo(hint, lead)
  const keyword = tipo === 'consultor' ? 'consultor' : 'associad'

  const pipes = await prisma.pipe.findMany({
    where: { companyId: lead.companyId, status: 'active' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  })
  const pipe = pipes.find((p) => p.name.toLowerCase().includes(keyword))
  if (!pipe) {
    console.warn(
      `[ensureCardForLead] Pipe '${keyword}' não encontrado pra lead ${leadId} (tipo=${tipo}). Pulando.`,
    )
    return null
  }

  const firstPhase = await prisma.phase.findFirst({
    where: { pipeId: pipe.id, companyId: lead.companyId },
    orderBy: { position: 'asc' },
    select: { id: true, name: true },
  })
  if (!firstPhase) {
    console.warn(`[ensureCardForLead] Pipe ${pipe.name} sem fase. Pulando.`)
    return null
  }

  const creatorId = await resolveCreatorId(lead.companyId, lead.vendedorId)
  if (!creatorId) {
    console.warn(`[ensureCardForLead] Sem user pra createdById em ${lead.companyId}. Pulando.`)
    return null
  }

  const phoneTag = lead.whatsapp || lead.telefone || ''
  const title = sanitizeCardTitle(lead.nome, phoneTag, lead.id)

  const card = await prisma.card.create({
    data: {
      companyId: lead.companyId,
      pipeId: pipe.id,
      currentPhaseId: firstPhase.id,
      title,
      description: `Lead ${tipo} — origem: ${lead.origem || '-'}${phoneTag ? ` — ${phoneTag}` : ''}`,
      status: 'active',
      createdById: creatorId,
      assignedToId: lead.vendedorId || null,
      leadId: lead.id,
    },
    select: { id: true },
  })

  return { cardId: card.id, pipeId: pipe.id, phaseId: firstPhase.id, created: true }
}

function sanitizeCardTitle(nome: string, phone: string, leadId: string): string {
  const trimmed = (nome || '').trim()
  if (NOMES_GENERICOS.has(trimmed) || trimmed.length < 2) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length >= 4) {
      return `Lead ${digits.slice(-4)} (sem nome)`
    }
    return `Lead sem nome (${leadId.slice(0, 8)})`
  }
  return trimmed
}

function resolveTipo(
  hint: LeadTipo | undefined,
  lead: { origem: string | null; qualificadoPor: string | null },
): LeadTipo {
  if (hint === 'consultor' || hint === 'associado') return hint
  const origem = (lead.origem || '').toLowerCase()
  const qual = (lead.qualificadoPor || '').toLowerCase()
  if (origem.includes('consultor') || qual.includes('consultor')) return 'consultor'
  return 'associado'
}

async function resolveCreatorId(companyId: string, vendedorId: string | null): Promise<string | null> {
  if (vendedorId) return vendedorId
  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'admin' },
    select: { id: true },
  })
  if (admin) return admin.id
  const any = await prisma.user.findFirst({
    where: { companyId },
    select: { id: true },
  })
  return any?.id ?? null
}

/**
 * Backfill: percorre leads sem card (cards.leadId NULL) e cria card pra cada um.
 * Idempotente — pode rodar várias vezes sem duplicar.
 *
 * OBS: a migration 20260515_fix_card_idempotency_lead_id já faz isso em SQL
 * dentro do próprio banco. Este helper fica como fallback caso novos leads
 * cheguem por algum caminho que não dispara o trigger (situação que NÃO
 * deveria mais existir, mas por segurança mantemos).
 */
export async function backfillCardsForOrphanLeads(
  companyId: string,
  limit = 1000,
): Promise<{ scanned: number; created: number; alreadyHadCard: number; skipped: number }> {
  const leads = await prisma.lead.findMany({
    where: { companyId, cards: { none: {} } },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  let created = 0
  let skipped = 0

  for (const l of leads) {
    const result = await ensureCardForLead(l.id)
    if (result?.created) created++
    else skipped++
  }

  return { scanned: leads.length, created, alreadyHadCard: 0, skipped }
}
