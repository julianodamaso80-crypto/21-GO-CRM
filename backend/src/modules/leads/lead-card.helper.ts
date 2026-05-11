import { prisma } from '../../config/database'

export type LeadTipo = 'consultor' | 'associado'

/**
 * Regra absoluta do projeto: TODO lead deve ter card num funil do Kanban.
 *
 * Heurística de classificação (em ordem de precedência):
 *  1. hint explícito (`'consultor' | 'associado'`)
 *  2. lead.origem === 'seja_consultor'        → consultor
 *  3. lead.qualificadoPor === 'site_consultor' → consultor
 *  4. fallback: associado
 *
 * Idempotência: se já existe card com title === lead.nome no funil resolvido,
 * devolve o existente em vez de duplicar.
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

  const existing = await prisma.card.findFirst({
    where: { companyId: lead.companyId, pipeId: pipe.id, title: lead.nome },
    select: { id: true, currentPhaseId: true },
  })
  if (existing) {
    return { cardId: existing.id, pipeId: pipe.id, phaseId: existing.currentPhaseId, created: false }
  }

  const creatorId = await resolveCreatorId(lead.companyId, lead.vendedorId)
  if (!creatorId) {
    console.warn(`[ensureCardForLead] Sem user pra createdById em ${lead.companyId}. Pulando.`)
    return null
  }

  const phoneTag = lead.whatsapp || lead.telefone || ''
  const card = await prisma.card.create({
    data: {
      companyId: lead.companyId,
      pipeId: pipe.id,
      currentPhaseId: firstPhase.id,
      title: lead.nome,
      description: `Lead ${tipo} — origem: ${lead.origem || '-'}${phoneTag ? ` — ${phoneTag}` : ''}`,
      status: 'active',
      createdById: creatorId,
      assignedToId: lead.vendedorId || null,
    },
    select: { id: true },
  })

  return { cardId: card.id, pipeId: pipe.id, phaseId: firstPhase.id, created: true }
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
 * Backfill: percorre leads sem card e cria card pra cada um.
 * Idempotente — pode rodar várias vezes sem duplicar.
 * Retorna estatísticas.
 */
export async function backfillCardsForOrphanLeads(
  companyId: string,
  limit = 500,
): Promise<{ scanned: number; created: number; alreadyHadCard: number; skipped: number }> {
  const leads = await prisma.lead.findMany({
    where: { companyId },
    select: { id: true, nome: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  const titles = leads.map((l) => l.nome)
  const existing = await prisma.card.findMany({
    where: { companyId, title: { in: titles } },
    select: { title: true },
  })
  const haveCard = new Set(existing.map((c) => c.title))

  let created = 0
  let alreadyHadCard = 0
  let skipped = 0

  for (const l of leads) {
    if (haveCard.has(l.nome)) {
      alreadyHadCard++
      continue
    }
    const result = await ensureCardForLead(l.id)
    if (result?.created) created++
    else skipped++
  }

  return { scanned: leads.length, created, alreadyHadCard, skipped }
}
