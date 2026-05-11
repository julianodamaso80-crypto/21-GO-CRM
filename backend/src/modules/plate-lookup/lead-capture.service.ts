import { prisma } from '../../config/database'
import { sendFollowUp } from './lead-followup.service'
import { ensureCardForLead, type LeadTipo } from '../leads/lead-card.helper'

interface PublicLeadInput {
  // Dados do formulário
  nome: string
  whatsapp: string
  email?: string
  placa?: string
  leilao?: 'nao' | 'leilao' | 'remarcado'

  // Dados do veículo
  marca?: string
  modelo?: string
  ano?: string
  cor?: string
  valorFipe?: number

  // Plano selecionado
  plano?: string
  valorMensal?: number

  // Carro de aplicativo (Uber, 99) — adiciona +R$ 20/mes na mensalidade
  carroApp?: boolean

  // Seguro atual do veiculo (texto livre — ex: "Porto Seguro"). Quando null/undefined,
  // cliente declarou que nao tem seguro ou nao respondeu.
  seguroAtual?: string

  // Classificação pro Kanban: 'consultor' vai pro funil "Vendas de Consultores",
  // qualquer outro valor (ou ausência) vai pra "Vendas de Associados". Form "Seja
  // Consultor" do site deve enviar tipo='consultor'.
  tipo?: LeadTipo

  // Tracking
  utmSource?: string
  utmMedium?: string
  utmCampaign?: string
  utmContent?: string
  utmTerm?: string
  gclid?: string
  fbclid?: string
  fbp?: string
  fbc?: string
}

export async function createPublicLead(input: PublicLeadInput, ip?: string, userAgent?: string) {
  const companyId = process.env.DEFAULT_COMPANY_ID

  if (!companyId) {
    return { success: false, error: 'Serviço indisponível no momento.' }
  }

  if (!input.nome || !input.whatsapp) {
    return { success: false, error: 'Nome e WhatsApp são obrigatórios.' }
  }

  try {
    const placa = input.placa ? input.placa.toUpperCase() : null

    const existing = await prisma.lead.findFirst({
      where: placa
        ? { companyId, whatsapp: input.whatsapp, placaInteresse: placa }
        : { companyId, whatsapp: input.whatsapp, placaInteresse: null, marcaInteresse: input.marca || null, modeloInteresse: input.modelo || null },
    })

    let leadId: string
    let action: 'updated' | 'created'

    if (existing) {
      const updated = await prisma.lead.update({
        where: { id: existing.id },
        data: {
          nome: input.nome,
          email: input.email || existing.email,
          valorFipeConsultado: input.valorFipe || existing.valorFipeConsultado,
          cotacaoValor: input.valorMensal || existing.cotacaoValor,
          cotacaoPlano: input.plano || existing.cotacaoPlano,
          cotacaoEnviada: true,
          cotacaoData: new Date(),
          carroApp: typeof input.carroApp === 'boolean' ? input.carroApp : existing.carroApp,
          leilao: input.leilao || existing.leilao,
          seguroAtual: input.seguroAtual !== undefined ? input.seguroAtual : existing.seguroAtual,
          // NÃO resetamos followUpEnviado/pdfEnviado: o debounce global por
          // WhatsApp (em sendFollowUp) garante que o cliente não receba PDF
          // duplicado se refizer cotação.
          gclid: input.gclid || existing.gclid,
          fbclid: input.fbclid || existing.fbclid,
          fbp: input.fbp || existing.fbp,
          fbc: input.fbc || existing.fbc,
        },
      })
      leadId = updated.id
      action = 'updated'
    } else {
      const lead = await prisma.lead.create({
        data: {
          companyId,
          nome: input.nome,
          whatsapp: input.whatsapp,
          email: input.email || null,
          telefone: input.whatsapp,

          placaInteresse: placa,
          marcaInteresse: input.marca || null,
          modeloInteresse: input.modelo || null,
          anoInteresse: input.ano ? parseInt(input.ano) || null : null,

          valorFipeConsultado: input.valorFipe || null,
          cotacaoValor: input.valorMensal || null,
          cotacaoPlano: input.plano || null,
          cotacaoEnviada: true,
          cotacaoData: new Date(),
          carroApp: input.carroApp || false,
          leilao: input.leilao || null,
          seguroAtual: input.seguroAtual || null,

          qualificadoPor: input.tipo === 'consultor' ? 'site_consultor' : 'site',
          scoreQualificacao: 50,
          etapaFunil: 'cotacao_enviada',
          status: 'lead',

          origem: input.tipo === 'consultor'
            ? 'seja_consultor'
            : (input.utmSource ? `${input.utmSource}_${input.utmMedium || 'direct'}` : 'site_organico'),
          utmSource: input.utmSource || null,
          utmMedium: input.utmMedium || null,
          utmCampaign: input.utmCampaign || null,
          utmContent: input.utmContent || null,
          utmTerm: input.utmTerm || null,

          gclid: input.gclid || null,
          fbclid: input.fbclid || null,
          fbp: input.fbp || null,
          fbc: input.fbc || null,
          ipAddress: ip || null,
          userAgent: userAgent || null,
        },
      })
      leadId = lead.id
      action = 'created'
    }

    // Regra absoluta: todo lead novo cai num funil do Kanban
    await ensureCardForLead(leadId, input.tipo).catch((err) =>
      console.warn('[LeadCapture] ensureCardForLead falhou:', err?.message),
    )

    console.log(`[LeadCapture] Lead ${action} id=${leadId} — disparando envio imediato`)

    // Fire-and-forget: envia PDF + mensagem imediatamente (msg 1 de 2).
    // Reengajamento (msg 2) é disparado 5min depois pelo worker de reengajamento
    // SÓ se o cliente não engajou. O debounce em sendFollowUp evita PDF duplicado
    // se o cliente refizer cotação.
    ;(async () => {
      try {
        const result = await sendFollowUp({ leadId, withPdf: true })
        if (!result.success) {
          console.warn('[LeadCapture] Envio imediato falhou:', result.error)
        } else {
          console.log('[LeadCapture] Envio imediato OK:', JSON.stringify(result))
        }
      } catch (err: any) {
        console.error('[LeadCapture] Erro no envio imediato:', err.message, err.stack)
      }
    })()

    return { success: true, leadId, action }
  } catch (err: any) {
    console.error('[LeadCapture] Error:', err.message)
    return { success: false, error: 'Erro ao salvar lead.' }
  }
}
