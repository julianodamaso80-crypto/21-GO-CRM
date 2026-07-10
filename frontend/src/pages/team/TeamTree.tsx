import { useMemo, useState } from 'react'
import { ChevronRight, ChevronDown, Phone, MessageCircle, Crown, Users2, Expand, Minimize2 } from 'lucide-react'
import type { TeamTreeMember } from '../../services/users.service'

const LEVEL_COLORS = ['#293C82', '#39519A', '#4A67B0', '#5E80C4', '#7C9BD6', '#9DB6E4', '#B9CBEC', '#CFDBF2']
const levelColor = (lvl: number) => LEVEL_COLORS[Math.min(Math.max(lvl - 1, 0), LEVEL_COLORS.length - 1)]
const initials = (a?: string, b?: string) => ((a?.[0] || '') + (b?.[0] || '')).toUpperCase() || '?'
const digits = (s?: string | null) => (s || '').replace(/\D/g, '')
const waLink = (p?: string | null) => { const d = digits(p); return d.length < 10 ? null : `https://wa.me/${d.length <= 11 ? '55' + d : d}` }

interface Me { id?: string; firstName?: string; lastName?: string; email?: string }

export function TeamTree({ members, me, q, onlyActive }: { members: TeamTreeMember[]; me: Me | null; q: string; onlyActive: boolean }) {
  const rootId = me?.id || 'ROOT'

  const childrenMap = useMemo(() => {
    const m = new Map<string, TeamTreeMember[]>()
    for (const p of members) {
      const k = p.managerId || rootId
      const arr = m.get(k) || []
      if (!m.has(k)) m.set(k, arr)
      arr.push(p)
    }
    for (const arr of m.values()) arr.sort((a, b) => (a.firstName || '').localeCompare(b.firstName || '', 'pt-BR'))
    return m
  }, [members, rootId])

  const idToNode = useMemo(() => new Map(members.map((p) => [p.id, p])), [members])

  // descendentes (total e ativos) por nó
  const counts = useMemo(() => {
    const total = new Map<string, number>(), active = new Map<string, number>()
    const dfs = (id: string): [number, number] => {
      const kids = childrenMap.get(id) || []
      let t = 0, a = 0
      for (const k of kids) { const [ct, ca] = dfs(k.id); t += 1 + ct; a += (k.isActive ? 1 : 0) + ca }
      total.set(id, t); active.set(id, a); return [t, a]
    }
    dfs(rootId)
    return { total, active }
  }, [childrenMap, rootId])

  const allWithKids = useMemo(
    () => [rootId, ...members.filter((p) => (childrenMap.get(p.id) || []).length).map((p) => p.id)],
    [members, childrenMap, rootId],
  )
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([rootId]))
  const toggle = (id: string) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  // busca: mantém os matches + ancestrais, e força abrir
  const keepSet = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return null as Set<string> | null
    const keep = new Set<string>()
    for (const p of members) {
      const hit = `${p.firstName} ${p.lastName}`.toLowerCase().includes(s) || p.email.toLowerCase().includes(s) || digits(p.phone).includes(digits(s))
      if (hit) { let cur: string | undefined = p.id; while (cur && cur !== rootId) { keep.add(cur); cur = idToNode.get(cur)?.managerId || undefined } }
    }
    return keep
  }, [q, members, idToNode, rootId])

  const forceOpen = !!keepSet
  const visible = (p: TeamTreeMember): boolean => {
    if (onlyActive && !p.isActive && (counts.active.get(p.id) || 0) === 0) return false
    if (keepSet && !keepSet.has(p.id)) return false
    return true
  }

  const Row = ({ node }: { node: TeamTreeMember }) => {
    const kids = (childrenMap.get(node.id) || []).filter(visible)
    const hasKids = kids.length > 0
    const open = forceOpen || expanded.has(node.id)
    const c = levelColor(node.level)
    const link = waLink(node.phone)
    return (
      <div>
        <div className="group flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-dark-700/50 transition-colors" style={{ opacity: node.isActive ? 1 : 0.5 }}>
          {hasKids ? (
            <button onClick={() => toggle(node.id)} className="h-6 w-6 grid place-items-center rounded-md text-dark-300 hover:text-dark-50 hover:bg-dark-700 shrink-0">
              {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>
          ) : (
            <span className="w-6 h-6 grid place-items-center shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-dark-600" /></span>
          )}
          <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-[11px] font-bold ring-1 ring-white/10 shrink-0" style={{ background: c }}>
            {initials(node.firstName, node.lastName)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-dark-50 truncate">{node.firstName} {node.lastName}</span>
              <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded text-white" style={{ background: c }}>N{node.level}</span>
              {!node.isActive && <span className="shrink-0 text-[10px] text-dark-500">inativo</span>}
            </div>
            <span className="text-[11px] text-dark-400 truncate block">{node.email}</span>
          </div>
          {hasKids && (
            <span className="shrink-0 hidden sm:block text-[11px] text-dark-400 font-mono">
              {kids.length} diretos · {counts.total.get(node.id)} na rede
            </span>
          )}
          <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {link && <a href={link} target="_blank" rel="noreferrer" title="WhatsApp" className="h-7 w-7 grid place-items-center rounded-md text-emerald-400 hover:bg-emerald-500/15"><MessageCircle className="w-3.5 h-3.5" /></a>}
            {node.phone && <a href={`tel:${digits(node.phone)}`} title="Ligar" className="h-7 w-7 grid place-items-center rounded-md text-dark-300 hover:bg-dark-700"><Phone className="w-3.5 h-3.5" /></a>}
          </div>
        </div>
        {open && hasKids && (
          <div className="ml-3 pl-3 border-l border-hairline">
            {kids.map((k) => <Row key={k.id} node={k} />)}
          </div>
        )}
      </div>
    )
  }

  const rootKids = (childrenMap.get(rootId) || []).filter(visible)

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-dark-100 flex items-center gap-2"><Users2 className="w-4 h-4 text-blue-400" /> Árvore da rede</h3>
        <div className="flex gap-2">
          <button onClick={() => setExpanded(new Set(allWithKids))} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700"><Expand className="w-3.5 h-3.5" /> Expandir tudo</button>
          <button onClick={() => setExpanded(new Set([rootId]))} className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700"><Minimize2 className="w-3.5 h-3.5" /> Recolher tudo</button>
        </div>
      </div>

      {/* raiz = líder */}
      <div className="flex items-center gap-2 rounded-xl px-2 py-2 bg-gradient-blue-subtle border border-blue-500/20">
        <span className="w-6 shrink-0" />
        <div className="relative h-9 w-9 rounded-xl bg-gradient-blue grid place-items-center text-white text-xs font-bold ring-1 ring-white/15 shrink-0">
          {initials(me?.firstName, me?.lastName)}
          <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-md bg-orange-500 grid place-items-center ring-2 ring-dark-800"><Crown className="w-2.5 h-2.5 text-white" /></span>
        </div>
        <div className="min-w-0 flex-1">
          <span className="text-sm font-bold text-dark-50 truncate block">{me?.firstName} {me?.lastName} <span className="text-[10px] text-orange-300 font-semibold">· VOCÊ</span></span>
          <span className="text-[11px] text-dark-400">{counts.total.get(rootId) || 0} na sua rede · {counts.active.get(rootId) || 0} ativas</span>
        </div>
      </div>

      <div className="ml-3 pl-3 border-l border-hairline mt-1">
        {rootKids.length ? rootKids.map((k) => <Row key={k.id} node={k} />) : <p className="text-sm text-dark-400 px-2 py-3">Nenhuma pessoa no filtro atual.</p>}
      </div>
    </div>
  )
}
