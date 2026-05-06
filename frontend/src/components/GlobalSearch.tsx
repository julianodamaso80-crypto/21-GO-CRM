import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Loader2, UserCircle2, User, Car, Phone, Mail, X,
} from 'lucide-react'
import { api } from '../lib/api'

type SearchResult = {
  leads: Array<{
    id: string
    nome: string
    telefone: string | null
    whatsapp: string | null
    email: string | null
    marcaInteresse: string | null
    modeloInteresse: string | null
    placaInteresse: string | null
    origem: string | null
    etapaFunil: string | null
  }>
  associados: Array<{
    id: string
    nome: string
    cpf: string | null
    telefone: string | null
    whatsapp: string | null
    email: string | null
    status: string | null
  }>
  vehicles: Array<{
    id: string
    placa: string
    marca: string
    modelo: string
    associado?: { id: string; nome: string } | null
  }>
}

const EMPTY: SearchResult = { leads: [], associados: [], vehicles: [] }

export function GlobalSearch() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult>(EMPTY)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Atalho "/" pra focar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
        setQ('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Click fora fecha
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  // Debounced search
  useEffect(() => {
    const term = q.trim()
    if (term.length < 2) {
      setResults(EMPTY)
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      try {
        const r = await api.get<SearchResult>('/search', { params: { q: term } })
        setResults(r.data || EMPTY)
      } catch {
        setResults(EMPTY)
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => clearTimeout(t)
  }, [q])

  const totalResults = results.leads.length + results.associados.length + results.vehicles.length

  const goTo = (path: string) => {
    setOpen(false)
    setQ('')
    navigate(path)
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
      <input
        ref={inputRef}
        type="text"
        placeholder="Buscar lead, associado, placa, telefone..."
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        className="w-full pl-9 pr-12 py-2 bg-dark-800/40 border border-dark-700/40 rounded-xl text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gold-500/30 focus:ring-1 focus:ring-gold-500/20 transition-all"
      />
      {q ? (
        <button
          onClick={() => { setQ(''); setOpen(false); inputRef.current?.focus() }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      ) : (
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 bg-dark-700/50 px-1.5 py-0.5 rounded-md border border-dark-600/30 font-mono">/</kbd>
      )}

      {/* Dropdown de resultados */}
      {open && q.trim().length >= 2 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-dark-800 border border-dark-700/50 rounded-xl shadow-2xl overflow-hidden z-50 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-xs text-gray-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando…
            </div>
          ) : totalResults === 0 ? (
            <p className="px-4 py-6 text-center text-xs text-gray-500">
              Nada encontrado pra "{q}"
            </p>
          ) : (
            <>
              {results.leads.length > 0 && (
                <Section title={`Leads (${results.leads.length})`}>
                  {results.leads.map((l) => (
                    <button
                      key={l.id}
                      onClick={() => goTo(`/leads`)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-dark-700/40 text-left transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                        <UserCircle2 className="w-4 h-4 text-blue-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{l.nome}</p>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                          {l.whatsapp || l.telefone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> {l.whatsapp || l.telefone}
                            </span>
                          ) : null}
                          {l.placaInteresse ? <span>· {l.placaInteresse}</span> : null}
                          {l.marcaInteresse ? <span>· {l.marcaInteresse} {l.modeloInteresse}</span> : null}
                          {l.origem ? <span>· {l.origem}</span> : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {results.associados.length > 0 && (
                <Section title={`Associados (${results.associados.length})`}>
                  {results.associados.map((a) => (
                    <button
                      key={a.id}
                      onClick={() => goTo(`/associados`)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-dark-700/40 text-left transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">{a.nome}</p>
                        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                          {a.whatsapp || a.telefone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="w-2.5 h-2.5" /> {a.whatsapp || a.telefone}
                            </span>
                          ) : null}
                          {a.cpf ? <span>· {a.cpf}</span> : null}
                          {a.email ? (
                            <span className="inline-flex items-center gap-1">
                              <Mail className="w-2.5 h-2.5" /> {a.email}
                            </span>
                          ) : null}
                          {a.status ? <span>· {a.status}</span> : null}
                        </div>
                      </div>
                    </button>
                  ))}
                </Section>
              )}

              {results.vehicles.length > 0 && (
                <Section title={`Veículos (${results.vehicles.length})`}>
                  {results.vehicles.map((v) => (
                    <button
                      key={v.id}
                      onClick={() => goTo(`/vehicles`)}
                      className="w-full flex items-start gap-3 px-4 py-2.5 hover:bg-dark-700/40 text-left transition"
                    >
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center flex-shrink-0">
                        <Car className="w-4 h-4 text-amber-400" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-white truncate">
                          {v.placa} · {v.marca} {v.modelo}
                        </p>
                        {v.associado && (
                          <p className="text-[11px] text-gray-500 mt-0.5 truncate">
                            de {v.associado.nome}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </Section>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-dark-700/30 last:border-b-0">
      <p className="px-4 pt-2.5 pb-1 text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
        {title}
      </p>
      <div>{children}</div>
    </div>
  )
}
