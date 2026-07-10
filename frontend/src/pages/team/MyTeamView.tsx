import { useMemo, useRef, useState } from 'react'
import {
  Search, Users, Crown, Phone, Mail, MessageCircle,
  Loader2, Sparkles, UsersRound, Network, ChevronRight, Coins,
  LayoutList, GitBranch,
} from 'lucide-react'
import { useMyTeam } from '../../hooks/useUsers'
import type { TeamTreeMember } from '../../services/users.service'
import { TeamTree } from './TeamTree'

interface Me {
  id?: string
  firstName?: string
  lastName?: string
  email?: string
  role?: { name?: string }
}

// Niveis que geram comissao (plano unilevel 21 GO: 50% fixo do N1 ao N6).
const PAY_DEPTH = 6

// Escala de cor por nivel: azul institucional clareando com a profundidade (harmonico).
const LEVEL_COLORS = ['#293C82', '#39519A', '#4A67B0', '#5E80C4', '#7C9BD6', '#9DB6E4', '#B9CBEC', '#CFDBF2']
const levelColor = (lvl: number) => LEVEL_COLORS[Math.min(lvl - 1, LEVEL_COLORS.length - 1)]

const initials = (a?: string, b?: string) =>
  ((a?.[0] || '') + (b?.[0] || '')).toUpperCase() || 'EU'
const onlyDigits = (s?: string | null) => (s || '').replace(/\D/g, '')
const waLink = (phone?: string | null) => {
  const d = onlyDigits(phone)
  if (d.length < 10) return null
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}`
}

function MemberCard({ m, sponsor }: { m: TeamTreeMember; sponsor?: string }) {
  const wa = waLink(m.phone)
  const c = levelColor(m.level)
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-hairline bg-dark-800 p-4 shadow-card transition-all duration-300 ease-smooth hover:-translate-y-1 hover:border-hairline-strong hover:shadow-card-hover">
      <div
        className="pointer-events-none absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(120% 80% at 0% 0%, ${c}22, transparent 55%)` }}
      />
      {/* faixa lateral com a cor do nivel */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-1" style={{ background: c }} />

      <div className="relative flex items-start gap-3 pl-1.5">
        <div className="relative shrink-0">
          <div
            className="h-11 w-11 rounded-2xl flex items-center justify-center text-white font-display font-bold text-sm ring-1 ring-white/10"
            style={{ backgroundImage: `linear-gradient(140deg, ${c}, ${c}cc)` }}
          >
            {initials(m.firstName, m.lastName)}
            <div className="pointer-events-none absolute inset-0 rounded-2xl" style={{ background: 'linear-gradient(155deg, rgba(255,255,255,0.28), transparent 42%)' }} />
          </div>
          <span className={`absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full ring-2 ring-dark-800 ${m.isActive ? 'bg-emerald-400' : 'bg-dark-500'}`} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-dark-50 truncate">{m.firstName} {m.lastName}</p>
            <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md text-white" style={{ background: c }}>N{m.level}</span>
          </div>
          <p className="text-xs text-dark-400 truncate">{m.email}</p>
          {sponsor && (
            <p className="mt-1 text-[11px] text-dark-400 truncate flex items-center gap-1">
              <ChevronRight className="w-3 h-3 shrink-0 text-dark-500" /> via <span className="text-dark-300 font-medium">{sponsor}</span>
            </p>
          )}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {m.isActive
              ? <span className="badge-success"><span className="badge-dot" /> Ativo</span>
              : <span className="badge-neutral">Inativo</span>}
            {m.phone && <span className="font-mono text-[11px] text-dark-400 tabular-nums">{m.phone}</span>}
          </div>
        </div>
      </div>

      <div className="relative mt-3 pt-3 border-t border-hairline flex items-center gap-2 pl-1.5">
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
            <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
          </a>
        )}
        {m.phone && (
          <a href={`tel:${onlyDigits(m.phone)}`} title="Ligar"
            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors">
            <Phone className="w-3.5 h-3.5" />
          </a>
        )}
        <a href={`mailto:${m.email}`} title="E-mail"
          className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors">
          <Mail className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  )
}

export function MyTeamView({ me }: { me: Me | null }) {
  const { data: resp, isLoading } = useMyTeam()
  const members = resp?.data || []
  const byLevel = resp?.byLevel || {}
  const maxLevel = resp?.maxLevel || 0
  const total = resp?.total || 0
  const ativos = members.filter((m) => m.isActive).length

  const [q, setQ] = useState('')
  const [onlyActive, setOnlyActive] = useState(true)
  const [levelSel, setLevelSel] = useState(0) // 0 = todos os niveis
  const [view, setView] = useState<'niveis' | 'arvore'>('niveis')
  const heroRef = useRef<HTMLDivElement>(null)

  // id -> nome, pra resolver o patrocinador direto (upline) de cada card
  const nameById = useMemo(() => {
    const map = new Map<string, string>()
    members.forEach((p) => map.set(p.id, `${p.firstName} ${p.lastName}`.trim()))
    if (me?.id) map.set(me.id, `${me.firstName || ''} ${me.lastName || ''}`.trim())
    return map
  }, [members, me])

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    return members.filter((m) => {
      if (onlyActive && !m.isActive) return false
      if (levelSel && m.level !== levelSel) return false
      if (!s) return true
      return (
        m.firstName.toLowerCase().includes(s) ||
        m.lastName.toLowerCase().includes(s) ||
        m.email.toLowerCase().includes(s) ||
        onlyDigits(m.phone).includes(onlyDigits(s))
      )
    })
  }, [members, q, onlyActive, levelSel])

  const grupos = useMemo(() => {
    const g: Record<number, TeamTreeMember[]> = {}
    for (const m of filtered) (g[m.level] = g[m.level] || []).push(m)
    return g
  }, [filtered])
  const niveis = Object.keys(grupos).map(Number).sort((a, b) => a - b)
  const maxCount = Math.max(1, ...Object.values(byLevel).map(Number))

  const onTilt = (e: React.MouseEvent) => {
    const el = heroRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width - 0.5
    const py = (e.clientY - r.top) / r.height - 0.5
    el.style.transform = `rotateX(${(-py * 3).toFixed(2)}deg) rotateY(${(px * 4.5).toFixed(2)}deg)`
  }
  const resetTilt = () => { if (heroRef.current) heroRef.current.style.transform = 'rotateX(0deg) rotateY(0deg)' }

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-200 ${
      active
        ? 'text-white border-transparent shadow-cta-blue'
        : 'text-dark-300 border-hairline hover:text-dark-50 hover:border-hairline-strong'
    }`

  if (isLoading) {
    return <div className="p-6 max-w-6xl mx-auto"><div className="card p-12 flex justify-center"><Loader2 className="w-8 h-8 text-blue-400 animate-spin" /></div></div>
  }

  return (
    <div className="p-6 max-w-6xl mx-auto page-enter">
      {/* ═══ HERO ═══ */}
      <div style={{ perspective: '1200px' }}>
        <div ref={heroRef} onMouseMove={onTilt} onMouseLeave={resetTilt}
          className="relative overflow-hidden rounded-3xl border border-hairline p-6 sm:p-8 shadow-glass transition-transform duration-200 ease-smooth"
          style={{ transformStyle: 'preserve-3d', background: 'linear-gradient(135deg, rgba(41,60,130,0.22), rgba(12,18,40,0.55))' }}>
          <div className="pointer-events-none absolute inset-0 opacity-80"
            style={{ background: 'radial-gradient(ellipse 55% 75% at 6% -12%, rgba(68,93,168,0.38), transparent 60%), radial-gradient(ellipse 45% 60% at 105% 120%, rgba(242,145,29,0.16), transparent 55%)' }} />
          <div className="pointer-events-none absolute inset-0 bg-noise opacity-40 mix-blend-overlay" />

          <div className="relative flex flex-col sm:flex-row sm:items-center gap-6" style={{ transform: 'translateZ(45px)' }}>
            <div className="relative shrink-0">
              <div className="h-20 w-20 rounded-3xl bg-gradient-blue flex items-center justify-center text-white font-display font-black text-2xl shadow-glow-blue-lg ring-1 ring-white/15">
                {initials(me?.firstName, me?.lastName)}
                <div className="pointer-events-none absolute inset-0 rounded-3xl" style={{ background: 'linear-gradient(160deg, rgba(255,255,255,0.35), transparent 46%)' }} />
              </div>
              <span className="absolute -bottom-2 -right-2 grid place-items-center h-8 w-8 rounded-xl bg-orange-500 text-white shadow-glow-orange ring-2 ring-dark-900"><Crown className="w-4 h-4" /></span>
            </div>
            <div className="min-w-0">
              <span className="badge-orange mb-2"><Sparkles className="w-3 h-3" /> Líder da rede</span>
              <h1 className="text-2xl sm:text-3xl font-display font-bold text-white truncate">{me?.firstName} {me?.lastName}</h1>
              <p className="text-sm text-dark-300 truncate">{me?.email}</p>
            </div>
            <div className="sm:ml-auto grid grid-cols-3 gap-3">
              {[['Na rede', total, 'text-blue-300'], ['Ativos', ativos, 'text-emerald-400'], ['Níveis', maxLevel, 'text-orange-300']].map(([l, v, c]) => (
                <div key={l as string} className="rounded-2xl border border-hairline bg-dark-900/50 backdrop-blur-sm px-4 py-3 text-center shadow-card min-w-[74px]">
                  <div className={`font-mono text-2xl font-bold tabular-nums leading-none ${c}`}>{v as number}</div>
                  <div className="mt-1 font-mono text-[10px] font-bold uppercase tracking-wider text-dark-400">{l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ PROFUNDIDADE DA REDE (funil por nivel) ═══ */}
      {maxLevel > 0 && (
        <div className="card mt-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2"><Network className="w-4 h-4 text-blue-400" /> Profundidade da rede</h3>
            <span className="text-[11px] text-dark-400 flex items-center gap-1.5"><Coins className="w-3.5 h-3.5 text-orange-400" /> Níveis 1–{PAY_DEPTH} geram comissão (50%)</span>
          </div>
          <div className="space-y-2">
            {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lvl) => {
              const count = Number(byLevel[lvl] || 0)
              const pays = lvl <= PAY_DEPTH
              return (
                <button key={lvl} onClick={() => setLevelSel(levelSel === lvl ? 0 : lvl)}
                  className={`w-full flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors ${levelSel === lvl ? 'bg-dark-700' : 'hover:bg-dark-700/50'}`}>
                  <span className="shrink-0 font-mono text-[11px] font-bold text-white w-9 h-6 grid place-items-center rounded-md" style={{ background: levelColor(lvl) }}>N{lvl}</span>
                  <div className="flex-1 h-6 rounded-md bg-dark-700/60 overflow-hidden relative">
                    <div className="h-full rounded-md transition-all duration-500 ease-smooth" style={{ width: `${Math.max(6, (count / maxCount) * 100)}%`, background: `linear-gradient(90deg, ${levelColor(lvl)}, ${levelColor(lvl)}bb)`, opacity: pays ? 1 : 0.45 }} />
                  </div>
                  <span className="shrink-0 font-mono text-sm font-bold text-dark-100 tabular-nums w-10 text-right">{count}</span>
                  {!pays && <span className="shrink-0 text-[10px] text-dark-500">s/ com.</span>}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* ═══ MODO DE VISUALIZACAO ═══ */}
      <div className="mt-5 flex items-center gap-2 flex-wrap">
        <span className="text-xs text-dark-400 mr-1">Visualizar:</span>
        <div className="inline-flex rounded-xl border border-hairline bg-dark-800 p-1">
          <button onClick={() => setView('niveis')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-all ${view === 'niveis' ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'}`}><LayoutList className="w-4 h-4" /> Níveis</button>
          <button onClick={() => setView('arvore')} className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-all ${view === 'arvore' ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'}`}><GitBranch className="w-4 h-4" /> Árvore</button>
        </div>
      </div>

      {/* ═══ CONTROLES (busca + status, compartilhados) ═══ */}
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar em toda a rede por nome, e-mail ou telefone..." className="input pl-10" />
        </div>
        <div className="inline-flex rounded-xl border border-hairline bg-dark-800 p-1 self-start">
          <button onClick={() => setOnlyActive(true)} className={`px-3.5 py-1.5 rounded-lg text-sm transition-all ${onlyActive ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'}`}>Ativos</button>
          <button onClick={() => setOnlyActive(false)} className={`px-3.5 py-1.5 rounded-lg text-sm transition-all ${!onlyActive ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'}`}>Todos</button>
        </div>
      </div>

      {view === 'niveis' ? (
      <>
      {/* chips de nivel */}
      {maxLevel > 1 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={() => setLevelSel(0)} className={chip(levelSel === 0)} style={levelSel === 0 ? { background: '#293C82' } : undefined}>Todos os níveis</button>
          {Array.from({ length: maxLevel }, (_, i) => i + 1).map((lvl) => (
            <button key={lvl} onClick={() => setLevelSel(lvl)} className={chip(levelSel === lvl)} style={levelSel === lvl ? { background: levelColor(lvl) } : undefined}>
              Nível {lvl}
            </button>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs text-dark-400">
        Mostrando <span className="font-semibold text-dark-200">{filtered.length}</span> de {total} pessoas da sua rede
      </p>

      {/* ═══ SECOES POR NIVEL ═══ */}
      {total === 0 ? (
        <div className="card mt-5 p-12 text-center">
          <div className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-2xl bg-dark-700 border border-hairline"><UsersRound className="w-8 h-8 text-dark-400" /></div>
          <p className="text-dark-100 font-medium">Você ainda não tem rede vinculada</p>
          <p className="text-dark-400 text-sm mt-1 max-w-sm mx-auto">Assim que consultores forem vinculados a você (e abaixo de você), eles aparecem aqui por nível.</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card mt-5 p-12 text-center"><Users className="w-10 h-10 text-dark-500 mx-auto mb-3" /><p className="text-dark-300">Nenhuma pessoa encontrada com esse filtro.</p></div>
      ) : (
        <div className="mt-4 space-y-8">
          {niveis.map((lvl) => (
            <section key={lvl}>
              <div className="flex items-center gap-3 mb-3 sticky top-0 z-10 py-1.5 bg-dark-950/80 backdrop-blur-sm">
                <span className="font-mono text-xs font-bold text-white px-2.5 py-1 rounded-lg" style={{ background: levelColor(lvl) }}>NÍVEL {lvl}</span>
                <span className="text-sm text-dark-200 font-medium">{lvl === 1 ? 'Seus diretos' : `Indicados do nível ${lvl - 1}`}</span>
                <span className="text-xs text-dark-400">· {grupos[lvl].length} {grupos[lvl].length === 1 ? 'pessoa' : 'pessoas'}</span>
                {lvl <= PAY_DEPTH && <span className="ml-auto text-[10px] text-orange-300/80 flex items-center gap-1"><Coins className="w-3 h-3" /> comissão 50%</span>}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {grupos[lvl].map((m) => (
                  <MemberCard key={m.id} m={m} sponsor={m.managerId ? nameById.get(m.managerId) : undefined} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      </>
      ) : (
        <TeamTree members={members} me={me} q={q} onlyActive={onlyActive} />
      )}
    </div>
  )
}
