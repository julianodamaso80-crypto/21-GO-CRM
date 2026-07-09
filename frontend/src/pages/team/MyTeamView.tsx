import { useMemo, useRef, useState } from 'react'
import {
  Search, Users, Crown, Phone, Mail, MessageCircle,
  UserX, Loader2, Sparkles, UsersRound,
} from 'lucide-react'
import { useMyTeam } from '../../hooks/useUsers'
import type { TeamMember } from '../../services/users.service'

interface Me {
  firstName?: string
  lastName?: string
  email?: string
  role?: { name?: string }
}

const initials = (a?: string, b?: string) =>
  ((a?.[0] || '') + (b?.[0] || '')).toUpperCase() || 'EU'

const onlyDigits = (s?: string | null) => (s || '').replace(/\D/g, '')

const waLink = (phone?: string | null) => {
  const d = onlyDigits(phone)
  if (d.length < 10) return null
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}`
}

// Gradientes de avatar derivados do nome — variedade dentro da paleta da marca.
const AVATAR_GRADIENTS = [
  'linear-gradient(140deg,#293C82,#445DA8)',
  'linear-gradient(140deg,#F2911D,#D97A0F)',
  'linear-gradient(140deg,#22326C,#293C82)',
  'linear-gradient(140deg,#445DA8,#6E85C2)',
  'linear-gradient(140deg,#B5630B,#F2911D)',
]
const gradFor = (seed: string) => {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_GRADIENTS[h % AVATAR_GRADIENTS.length]
}

function StatChip({ label, value, tone }: { label: string; value: number; tone: 'blue' | 'emerald' | 'muted' }) {
  const color =
    tone === 'blue' ? 'text-blue-300' : tone === 'emerald' ? 'text-emerald-400' : 'text-dark-300'
  return (
    <div className="rounded-2xl border border-hairline bg-dark-900/50 backdrop-blur-sm px-4 py-3 text-center shadow-card min-w-[74px]">
      <div className={`font-mono text-2xl font-bold tabular-nums leading-none ${color}`}>{value}</div>
      <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-dark-400">{label}</div>
    </div>
  )
}

function MemberCard({ m }: { m: TeamMember }) {
  const wa = waLink(m.phone)
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-hairline bg-dark-800 p-4 shadow-card transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-hairline-strong hover:shadow-card-hover">
      {/* glow de profundidade no hover */}
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: 'radial-gradient(120% 80% at 0% 0%, rgba(68,93,168,0.16), transparent 55%)' }}
      />
      <div className="relative flex items-start gap-3">
        {/* Avatar com bevel 3D + status dot */}
        <div className="relative shrink-0">
          <div
            className="h-12 w-12 rounded-2xl flex items-center justify-center text-white font-display font-bold text-sm shadow-glow-blue ring-1 ring-white/10"
            style={{ backgroundImage: gradFor(m.email || m.id) }}
          >
            {initials(m.firstName, m.lastName)}
            <div
              className="pointer-events-none absolute inset-0 rounded-2xl"
              style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.30), transparent 42%)' }}
            />
          </div>
          <span
            className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-dark-800 ${
              m.isActive ? 'bg-emerald-400' : 'bg-dark-500'
            }`}
          />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dark-50 truncate">
            {m.firstName} {m.lastName}
          </p>
          <p className="text-xs text-dark-400 truncate">{m.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {m.isActive ? (
              <span className="badge-success"><span className="badge-dot" /> Ativo</span>
            ) : (
              <span className="badge-neutral"><UserX className="w-3 h-3" /> Inativo</span>
            )}
            {m.phone && (
              <span className="font-mono text-[11px] text-dark-400 tabular-nums">{m.phone}</span>
            )}
          </div>
        </div>
      </div>

      {/* Ações rápidas — poucos cliques pra falar com a pessoa */}
      <div className="relative mt-3 pt-3 border-t border-hairline flex items-center gap-2">
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors"
          >
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        )}
        {m.phone && (
          <a
            href={`tel:${onlyDigits(m.phone)}`}
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors"
            title="Ligar"
          >
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        <a
          href={`mailto:${m.email}`}
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors"
          title="E-mail"
        >
          <Mail className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}

export function MyTeamView({ me }: { me: Me | null }) {
  const { data, isLoading } = useMyTeam()
  const members = data?.data || []
  const [q, setQ] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)
  const heroRef = useRef<HTMLDivElement>(null)

  const ativos = members.filter((m) => m.isActive).length
  const inativos = members.length - ativos

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return members.filter((m) => {
      if (onlyActive && !m.isActive) return false
      if (!s) return true
      return (
        m.firstName.toLowerCase().includes(s) ||
        m.lastName.toLowerCase().includes(s) ||
        m.email.toLowerCase().includes(s) ||
        onlyDigits(m.phone).includes(onlyDigits(s))
      )
    })
  }, [members, q, onlyActive])

  // Tilt 3D sutil do hero (um único elemento — barato pra performance)
  const onTilt = (e: React.MouseEvent) => {
    const el = heroRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `rotateX(${(-py * 3.5).toFixed(2)}deg) rotateY(${(px * 5).toFixed(2)}deg)`
  }
  const resetTilt = () => {
    if (heroRef.current) heroRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)'
  }

  const seg = (active: boolean) =>
    `px-3.5 py-1.5 rounded-lg text-sm transition-all duration-200 ${
      active ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'
    }`

  return (
    <div className="p-6 max-w-6xl mx-auto page-enter">
      {/* ══ HERO do líder — profundidade em camadas + tilt 3D ══ */}
      <div style={{ perspective: '1200px' }}>
        <div
          ref={heroRef}
          onMouseMove={onTilt}
          onMouseLeave={resetTilt}
          className="relative overflow-hidden rounded-3xl border border-hairline p-6 sm:p-8 shadow-glass transition-transform duration-200 ease-smooth"
          style={{ transformStyle: 'preserve-3d', background: 'linear-gradient(135deg, rgba(41,60,130,0.22), rgba(12,18,40,0.55))' }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            style={{ background: 'radial-gradient(ellipse 55% 75% at 6% -12%, rgba(68,93,168,0.38), transparent 60%), radial-gradient(ellipse 45% 60% at 105% 120%, rgba(242,145,29,0.16), transparent 55%)' }}
          />
          <div className="pointer-events-none absolute inset-0 bg-noise opacity-40 mix-blend-overlay" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6" style={{ transform: 'translateZ(45px)' }}>
            {/* Avatar do líder */}
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-3xl bg-gradient-blue flex items-center justify-center text-white font-display font-black text-2xl shadow-glow-blue-lg ring-1 ring-white/15">
                {initials(me?.firstName, me?.lastName)}
                <div
                  className="pointer-events-none absolute inset-0 rounded-3xl"
                  style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.35), transparent 46%)' }}
                />
              </div>
              <span className="absolute -bottom-2 -right-2 grid place-items-center h-8 w-8 rounded-xl bg-orange-500 text-white shadow-glow-orange ring-2 ring-dark-900">
                <Crown className="w-4 h-4" />
              </span>
            </div>

            <div className="min-w-0">
              <span className="badge-orange mb-2"><Sparkles className="w-3 h-3" /> Líder do time</span>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white truncate">
                {me?.firstName} {me?.lastName}
              </h1>
              <p className="text-sm text-dark-300 truncate">{me?.email}</p>
            </div>

            <div className="sm:ml-auto grid grid-cols-3 gap-3">
              <StatChip label="No time" value={members.length} tone="blue" />
              <StatChip label="Ativos" value={ativos} tone="emerald" />
              <StatChip label="Inativos" value={inativos} tone="muted" />
            </div>
          </div>
        </div>
      </div>

      {/* ══ Controles — busca + filtro (poucos cliques) ══ */}
      <div className="mt-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nome, e-mail ou telefone..."
            className="input pl-10"
          />
        </div>
        <div className="inline-flex rounded-xl border border-hairline bg-dark-800 p-1 self-start">
          <button onClick={() => setOnlyActive(true)} className={seg(onlyActive)}>Ativos</button>
          <button onClick={() => setOnlyActive(false)} className={seg(!onlyActive)}>Todos</button>
        </div>
      </div>
      <p className="mt-2 text-xs text-dark-400">
        Mostrando <span className="font-semibold text-dark-200">{filtered.length}</span> de {members.length}{' '}
        {members.length === 1 ? 'pessoa' : 'pessoas'} do seu time
      </p>

      {/* ══ Grid do time — escala pra times grandes ══ */}
      {isLoading ? (
        <div className="card mt-5 p-12 flex justify-center">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      ) : members.length === 0 ? (
        <div className="card mt-5 p-12 text-center">
          <div className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-2xl bg-dark-700 border border-hairline">
            <UsersRound className="w-8 h-8 text-dark-400" />
          </div>
          <p className="text-dark-100 font-medium">Você ainda não tem time vinculado</p>
          <p className="text-dark-400 text-sm mt-1 max-w-sm mx-auto">
            Assim que consultores forem vinculados a você, eles aparecem aqui automaticamente.
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card mt-5 p-12 text-center">
          <Users className="w-10 h-10 text-dark-500 mx-auto mb-3" />
          <p className="text-dark-300">Nenhuma pessoa encontrada com esse filtro.</p>
        </div>
      ) : (
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m) => (
            <MemberCard key={m.id} m={m} />
          ))}
        </div>
      )}
    </div>
  )
}
