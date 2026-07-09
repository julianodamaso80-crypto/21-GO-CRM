import { useState } from 'react'
import { X, Copy, Check, MessageCircle, KeyRound, Link2, User as UserIcon } from 'lucide-react'
import type { TeamMemberWithCredential } from '../../services/users.service'

const CRM_URL = 'https://crm21go.site'

interface Props {
  member: TeamMemberWithCredential
  onClose: () => void
}

/** Monta o link wa.me: telefone so com digitos, com DDI 55 na frente se faltar. */
function buildWhatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null
  if (!digits.startsWith('55')) digits = `55${digits}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`
}

export function CredentialsModal({ member, onClose }: Props) {
  const [copied, setCopied] = useState(false)
  const senha = member.tempPassword || ''

  const message =
    `Ola, ${member.firstName}! Seu acesso ao 21Go CRM esta pronto.\n\n` +
    `Acesse: ${CRM_URL}\n` +
    `Login: ${member.email}\n` +
    `Senha temporaria: ${senha}\n\n` +
    `No primeiro login o sistema vai pedir pra voce criar uma senha nova. Qualquer duvida, e so chamar!`

  const waLink = buildWhatsappLink(member.phone, message)

  const copyAll = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* clipboard indisponivel — ignora */
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="w-full max-w-md bg-dark-800 border border-dark-700/60 rounded-2xl shadow-2xl pointer-events-auto overflow-hidden animate-fade-in-up">
          {/* Header */}
          <div className="relative px-6 py-5 border-b border-dark-700/40">
            <div
              className="pointer-events-none absolute inset-0 opacity-70"
              style={{ background: 'radial-gradient(ellipse 60% 90% at 10% 0%, rgba(41,60,130,0.20), transparent 60%), radial-gradient(ellipse 50% 70% at 100% 20%, rgba(242,145,29,0.12), transparent 55%)' }}
            />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold mb-1">
                  <Check className="w-4 h-4" /> ACESSO CRIADO
                </div>
                <h2 className="text-lg font-display font-bold text-white">
                  {member.firstName} {member.lastName}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">Envie as credenciais abaixo pra pessoa entrar.</p>
              </div>
              <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Credenciais */}
          <div className="px-6 py-5 space-y-3">
            <Field icon={Link2} label="Endereco" value={CRM_URL} />
            <Field icon={UserIcon} label="Login" value={member.email} />
            <Field icon={KeyRound} label="Senha temporaria" value={senha} mono highlight />

            <div className="flex items-start gap-2 pt-1 text-xs text-gray-400">
              <span className="text-gold-400 mt-0.5">i</span>
              <p>No primeiro login o sistema obriga a pessoa a criar uma senha propria. Esta senha temporaria so aparece agora — copie ou envie antes de fechar.</p>
            </div>
          </div>

          {/* Acoes */}
          <div className="px-6 py-4 border-t border-dark-700/40 flex items-center gap-3">
            <button onClick={copyAll} className="btn-secondary flex-1 flex items-center justify-center gap-2">
              {copied ? <><Check className="w-4 h-4 text-emerald-400" /> Copiado</> : <><Copy className="w-4 h-4" /> Copiar tudo</>}
            </button>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-primary flex-1 flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" /> Enviar no WhatsApp
              </a>
            ) : (
              <button
                disabled
                title="Cadastre um telefone pra enviar por WhatsApp"
                className="btn-primary flex-1 flex items-center justify-center gap-2 opacity-40 cursor-not-allowed"
              >
                <MessageCircle className="w-4 h-4" /> Sem telefone
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

function Field({ icon: Icon, label, value, mono, highlight }: { icon: any; label: string; value: string; mono?: boolean; highlight?: boolean }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }
  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${highlight ? 'border-gold-500/30 bg-gold-500/5' : 'border-dark-700/40 bg-dark-900/40'}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 ${highlight ? 'text-gold-400' : 'text-gray-500'}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
        <p className={`text-sm text-gray-100 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
      <button onClick={copy} className="text-gray-500 hover:text-gray-300 flex-shrink-0">
        {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
      </button>
    </div>
  )
}
