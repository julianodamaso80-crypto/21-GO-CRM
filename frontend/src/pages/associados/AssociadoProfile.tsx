import {
  Phone, Mail, MapPin, Calendar, CreditCard, Car, Bike, Truck,
  ShieldCheck, Star, Gift, Loader2, Pencil, MessageCircle, Hash,
  Clock, Building2, BadgeCheck, TrendingUp,
} from 'lucide-react'
import type { AssociadoWithStats, Vehicle } from '../../../../shared/types'
import { useAssociado } from '../../hooks/useAssociados'

interface AssociadoProfileProps {
  associado: AssociadoWithStats
  onEdit: () => void
}

const STATUS_META: Record<string, { label: string; dot: string; text: string; ring: string }> = {
  ativo:        { label: 'Ativo',        dot: 'bg-emerald-400', text: 'text-emerald-400', ring: 'ring-emerald-500/30' },
  em_adesao:    { label: 'Em Adesão',    dot: 'bg-blue-400',    text: 'text-blue-400',    ring: 'ring-blue-500/30' },
  inadimplente: { label: 'Inadimplente', dot: 'bg-orange-400',  text: 'text-orange-400',  ring: 'ring-orange-500/30' },
  inativo:      { label: 'Inativo',      dot: 'bg-dark-400',    text: 'text-dark-400',    ring: 'ring-hairline' },
  cancelado:    { label: 'Cancelado',    dot: 'bg-rose-400',    text: 'text-rose-400',    ring: 'ring-rose-500/30' },
}

const ORIGEM_LABEL: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', instagram: 'Instagram',
  site_organico: 'Site Orgânico', indicacao: 'Indicação', whatsapp: 'WhatsApp',
  direto: 'Direto', outro: 'Outro',
}

const PLANO_META: Record<string, { label: string; cls: string }> = {
  basico:   { label: 'Básico',   cls: 'bg-dark-700 text-dark-200 border-hairline' },
  completo: { label: 'Completo', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' },
  premium:  { label: 'Premium',  cls: 'bg-orange-500/15 text-orange-400 border-orange-500/25' },
}

const VISTORIA_META: Record<string, { label: string; cls: string }> = {
  pendente:  { label: 'Vistoria pendente',  cls: 'text-amber-400' },
  agendada:  { label: 'Vistoria agendada',  cls: 'text-blue-400' },
  aprovada:  { label: 'Vistoria aprovada',  cls: 'text-emerald-400' },
  reprovada: { label: 'Vistoria reprovada', cls: 'text-rose-400' },
}

const VEHICLE_ICON: Record<string, typeof Car> = {
  carro: Car, moto: Bike, caminhonete: Truck, van: Truck, caminhao: Truck,
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase()

const formatBRL = (v?: number) =>
  v != null ? v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'

const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

const onlyDigits = (s?: string) => (s || '').replace(/\D/g, '')

export function AssociadoProfile({ associado, onEdit }: AssociadoProfileProps) {
  // Busca detalhes completos (veículos, atividades) — cai no cache se já veio da lista
  const { data: details, isLoading } = useAssociado(associado.id)

  const a = details ?? associado
  const vehicles: Vehicle[] = (details?.vehicles ?? associado.vehicles ?? []) as Vehicle[]
  const status = STATUS_META[a.status || 'em_adesao'] ?? STATUS_META.em_adesao

  const mensalidadeTotal = vehicles.reduce((sum, v) => sum + (v.valorMensal || 0), 0)
  const whatsappDigits = onlyDigits(a.whatsapp || a.phone)

  return (
    <div className="flex flex-col h-full">
      {/* ===== HERO ===== */}
      <div className="relative overflow-hidden px-6 pt-7 pb-6 border-b border-hairline">
        <div
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(ellipse 70% 80% at 15% 0%, rgba(41,60,130,0.18), transparent 60%), radial-gradient(ellipse 50% 60% at 100% 20%, rgba(242,145,29,0.10), transparent 55%)',
          }}
        />
        <div className="relative flex items-start gap-4">
          <div className={`h-16 w-16 shrink-0 rounded-2xl bg-gradient-blue flex items-center justify-center ring-2 ${status.ring} shadow-glow-blue`}>
            <span className="text-white font-display font-bold text-xl">{initials(a.fullName)}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-display font-bold text-white leading-tight truncate">{a.fullName}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${status.text}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${status.dot} animate-dot-pulse`} />
                {status.label}
              </span>
              {a.cpf && (
                <span className="inline-flex items-center gap-1 text-xs text-dark-400 font-mono">
                  <Hash className="w-3 h-3" /> {a.cpf}
                </span>
              )}
              {a.origem && (
                <span className="badge-neutral">{ORIGEM_LABEL[a.origem] || a.origem}</span>
              )}
            </div>
          </div>
          <button onClick={onEdit} className="btn-secondary shrink-0 text-xs px-3 py-1.5">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        </div>

        {/* Ações rápidas de contato */}
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          <ContactAction
            href={whatsappDigits ? `https://wa.me/55${whatsappDigits}` : undefined}
            icon={<MessageCircle className="w-4 h-4" />}
            label="WhatsApp"
            accent="emerald"
          />
          <ContactAction
            href={a.phone ? `tel:${a.phone}` : undefined}
            icon={<Phone className="w-4 h-4" />}
            label="Ligar"
            accent="blue"
          />
          <ContactAction
            href={a.email ? `mailto:${a.email}` : undefined}
            icon={<Mail className="w-4 h-4" />}
            label="E-mail"
            accent="orange"
          />
        </div>
      </div>

      {/* ===== BODY ===== */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {/* KPIs do associado */}
        <div className="grid grid-cols-3 gap-3">
          <MiniStat icon={<Car className="w-4 h-4" />} label="Veículos" value={vehicles.length} accent="blue" />
          <MiniStat icon={<CreditCard className="w-4 h-4" />} label="Mensalidade" value={mensalidadeTotal > 0 ? formatBRL(mensalidadeTotal) : '—'} accent="orange" small />
          <MiniStat
            icon={<Star className="w-4 h-4" />}
            label="NPS"
            value={a.npsScore != null ? a.npsScore : '—'}
            accent={a.npsScore == null ? 'neutral' : a.npsScore >= 9 ? 'emerald' : a.npsScore >= 7 ? 'amber' : 'rose'}
          />
        </div>

        {/* Veículos protegidos */}
        <Section title="Veículos protegidos" icon={<ShieldCheck className="w-4 h-4 text-orange-400" />} count={vehicles.length}>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-orange-400 animate-spin" /></div>
          ) : vehicles.length === 0 ? (
            <EmptyLine text="Nenhum veículo cadastrado" />
          ) : (
            <div className="space-y-2.5">
              {vehicles.map((v) => <VehicleCard key={v.id} v={v} />)}
            </div>
          )}
        </Section>

        {/* Contato & Endereço */}
        <Section title="Contato & endereço" icon={<MapPin className="w-4 h-4 text-blue-400" />}>
          <div className="space-y-1">
            <InfoRow icon={<MessageCircle className="w-3.5 h-3.5" />} label="WhatsApp" value={a.whatsapp} mono />
            <InfoRow icon={<Phone className="w-3.5 h-3.5" />} label="Telefone" value={a.phone} mono />
            <InfoRow icon={<Mail className="w-3.5 h-3.5" />} label="E-mail" value={a.email} />
            <InfoRow
              icon={<Building2 className="w-3.5 h-3.5" />}
              label="Endereço"
              value={[a.address, a.bairro, [a.city, a.state].filter(Boolean).join('/')].filter(Boolean).join(', ') || undefined}
            />
          </div>
        </Section>

        {/* Associação */}
        <Section title="Associação" icon={<BadgeCheck className="w-4 h-4 text-emerald-400" />}>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
            <InfoRow icon={<Calendar className="w-3.5 h-3.5" />} label="Adesão" value={formatDate(a.dataAdesao)} />
            <InfoRow icon={<Hash className="w-3.5 h-3.5" />} label="ID Hinova" value={a.hinovaId} mono />
            <InfoRow icon={<Gift className="w-3.5 h-3.5" />} label="Indicações" value={a.totalIndicacoes ? String(a.totalIndicacoes) : undefined} />
            <InfoRow icon={<TrendingUp className="w-3.5 h-3.5" />} label="Desconto MGM" value={a.descontoMgm ? `${a.descontoMgm}%` : undefined} />
          </div>
        </Section>

        {/* Tags */}
        {a.tags && a.tags.length > 0 && (
          <Section title="Tags" icon={<Hash className="w-4 h-4 text-orange-400" />}>
            <div className="flex flex-wrap gap-2">
              {a.tags.map((tag) => (
                <span key={tag} className="badge-orange">{tag}</span>
              ))}
            </div>
          </Section>
        )}

        {/* Atividades recentes */}
        {details?.activities && details.activities.length > 0 && (
          <Section title="Atividade recente" icon={<Clock className="w-4 h-4 text-blue-400" />}>
            <div className="space-y-3 pl-1">
              {details.activities.slice(0, 6).map((act: any) => (
                <div key={act.id} className="relative flex gap-3">
                  <div className="mt-1 w-2 h-2 rounded-full bg-blue-400 shrink-0 ring-4 ring-blue-500/10" />
                  <div className="min-w-0 flex-1 -mt-0.5">
                    <p className="text-sm text-dark-100 truncate">{act.title || act.type || 'Atividade'}</p>
                    <p className="text-[11px] text-dark-400 mt-0.5">{formatDate(act.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}

/* ---------------- sub-componentes ---------------- */

function ContactAction({ href, icon, label, accent }: {
  href?: string; icon: React.ReactNode; label: string; accent: 'emerald' | 'blue' | 'orange'
}) {
  const cls = {
    emerald: 'text-emerald-400 hover:bg-emerald-500/10 hover:border-emerald-500/30',
    blue: 'text-blue-400 hover:bg-blue-500/10 hover:border-blue-500/30',
    orange: 'text-orange-400 hover:bg-orange-500/10 hover:border-orange-500/30',
  }[accent]
  const disabled = !href
  return (
    <a
      href={href}
      target={href?.startsWith('http') ? '_blank' : undefined}
      rel="noreferrer"
      className={`flex flex-col items-center gap-1.5 py-2.5 rounded-xl border border-hairline bg-dark-800/60 transition-all ${
        disabled ? 'opacity-40 pointer-events-none' : cls
      }`}
    >
      {icon}
      <span className="text-[11px] font-semibold">{label}</span>
    </a>
  )
}

function MiniStat({ icon, label, value, accent, small }: {
  icon: React.ReactNode; label: string; value: React.ReactNode; accent: string; small?: boolean
}) {
  const text = {
    blue: 'text-blue-400', orange: 'text-orange-400', emerald: 'text-emerald-400',
    amber: 'text-amber-400', rose: 'text-rose-400', neutral: 'text-dark-300',
  }[accent] || 'text-dark-200'
  return (
    <div className="rounded-xl border border-hairline bg-dark-800/60 p-3">
      <div className={`flex items-center gap-1.5 ${text}`}>{icon}
        <span className="text-[10px] font-bold uppercase tracking-wider text-dark-400">{label}</span>
      </div>
      <p className={`mt-1.5 font-display font-bold text-white leading-none ${small ? 'text-base' : 'text-2xl'}`}>{value}</p>
    </div>
  )
}

function Section({ title, icon, count, children }: {
  title: string; icon: React.ReactNode; count?: number; children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-wider text-dark-300">{title}</h3>
        {count != null && count > 0 && (
          <span className="text-[10px] font-mono text-dark-400 bg-dark-700 rounded-full px-1.5 py-0.5">{count}</span>
        )}
      </div>
      {children}
    </div>
  )
}

function VehicleCard({ v }: { v: Vehicle }) {
  const Icon = VEHICLE_ICON[v.tipo] || Car
  const plano = PLANO_META[v.plano] ?? PLANO_META.basico
  const vistoria = VISTORIA_META[v.vistoriaStatus]
  return (
    <div className="rounded-xl border border-hairline bg-dark-800/60 p-3.5 hover:border-hairline-strong transition-colors">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-white tracking-wide">{v.placa}</span>
            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border ${plano.cls}`}>
              {plano.label}
            </span>
          </div>
          <p className="text-xs text-dark-400 truncate mt-0.5">
            {v.marca} {v.modelo} · {v.anoModelo}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-display font-bold text-orange-400 text-sm">{formatBRL(v.valorMensal)}</p>
          {vistoria && <p className={`text-[10px] mt-0.5 ${vistoria.cls}`}>{vistoria.label}</p>}
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon, label, value, mono }: {
  icon: React.ReactNode; label: string; value?: string; mono?: boolean
}) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span className="text-dark-400 shrink-0">{icon}</span>
      <span className="text-xs text-dark-400 w-24 shrink-0">{label}</span>
      <span className={`text-sm text-dark-100 truncate ${mono ? 'font-mono' : ''} ${!value ? 'text-dark-500' : ''}`}>
        {value || '—'}
      </span>
    </div>
  )
}

function EmptyLine({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-hairline bg-dark-800/30 py-5 text-center">
      <p className="text-xs text-dark-400">{text}</p>
    </div>
  )
}
