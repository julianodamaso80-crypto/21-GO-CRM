import { memo, useCallback, useState } from 'react'
import { ChevronRight, ChevronDown, MessageCircle, Phone } from 'lucide-react'
import type { MembroRede, ResumoRamo } from '../../services/rede.service'
import type { NoArvore } from './arvore.model'
import { levelColor, levelTextColor, waLink, soDigitos } from './rede.utils'

const FILHOS_POR_LOTE = 30 // corte de renderizacao: o DOM nunca passa de ~200 linhas

interface LinhaProps {
  no: NoArvore
  ramo: ResumoRamo | undefined
  aberto: boolean
  onAlternar: (powerId: number) => void
  onAbrirPessoa: (m: MembroRede) => void
  posicao: number
  total: number
}

const LinhaArvore = memo(function LinhaArvore({ no, ramo, aberto, onAlternar, onAbrirPessoa, posicao, total }: LinhaProps) {
  const m = no.membro
  const cor = levelColor(m.nivelRaiz)
  const wa = waLink(m.celular)
  const temFilhos = no.filhos.length > 0

  return (
    <div
      role="treeitem"
      aria-expanded={temFilhos ? aberto : undefined}
      aria-level={m.nivelRaiz}
      aria-posinset={posicao}
      aria-setsize={total}
      className="flex items-center gap-2 py-1.5 pr-2 rounded-lg hover:bg-dark-800/60 focus-visible:ring-2 focus-visible:ring-blue-500/30"
    >
      <button
        onClick={() => temFilhos && onAlternar(m.powerId)}
        aria-label={temFilhos ? (aberto ? `Recolher ${m.nome}` : `Expandir ${m.nome}`) : undefined}
        className={`shrink-0 grid place-items-center h-6 w-6 rounded-md ${temFilhos ? 'text-dark-300 hover:text-dark-50 hover:bg-dark-700' : 'opacity-0 pointer-events-none'}`}
      >
        {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: cor, color: levelTextColor(m.nivelRaiz) }}>
        N{m.nivelRaiz}
      </span>

      <button onClick={() => onAbrirPessoa(m)} className="min-w-0 flex-1 text-left truncate">
        <span className="text-sm font-medium text-dark-50 truncate">{m.nome}</span>
      </button>

      <span className="shrink-0 font-mono tabular-nums text-[11px] text-dark-100">
        {ramo?.proprias ?? 0} {(ramo?.proprias ?? 0) === 1 ? 'placa' : 'placas'}
      </span>
      {temFilhos && (
        <span className="shrink-0 font-mono tabular-nums text-[11px] text-orange-400">
          · ramo {ramo?.ramo ?? 0}
        </span>
      )}
      {temFilhos && (
        <span className="shrink-0 font-mono text-[11px] text-dark-400 hidden sm:inline">{no.filhos.length} diretos</span>
      )}

      <span className={`shrink-0 ${m.status === 'ativo' ? 'badge-success' : 'badge-danger'}`}>
        {m.status === 'ativo' ? <><span className="badge-dot" /> Ativo</> : 'Bloqueado'}
      </span>

      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" aria-label={`Chamar ${m.nome} no WhatsApp`}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      )}
      {m.celular && (
        <a href={`tel:${soDigitos(m.celular)}`} aria-label={`Ligar para ${m.nome}`}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
          <Phone className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
})

interface RamoProps {
  nos: NoArvore[]
  ramos: Record<number, ResumoRamo>
  abertos: Set<number>
  buscando: boolean
  manter: Set<number> | null
  onAlternar: (powerId: number) => void
  onAbrirPessoa: (m: MembroRede) => void
}

function Ramo({ nos, ramos, abertos, buscando, manter, onAlternar, onAbrirPessoa }: RamoProps) {
  const visiveis = manter ? nos.filter((n) => manter.has(n.membro.powerId)) : nos
  const [mostrar, setMostrar] = useState(FILHOS_POR_LOTE)
  const lote = visiveis.slice(0, mostrar)
  const restam = visiveis.length - lote.length

  return (
    <div role="group" className="pl-4 border-l border-hairline">
      {lote.map((no, i) => {
        const expandido = buscando ? true : abertos.has(no.membro.powerId)
        return (
          <div key={no.membro.powerId}>
            <LinhaArvore
              no={no}
              ramo={ramos[no.membro.powerId]}
              aberto={expandido}
              onAlternar={onAlternar}
              onAbrirPessoa={onAbrirPessoa}
              posicao={i + 1}
              total={visiveis.length}
            />
            {expandido && no.filhos.length > 0 && (
              <Ramo nos={no.filhos} ramos={ramos} abertos={abertos} buscando={buscando} manter={manter}
                onAlternar={onAlternar} onAbrirPessoa={onAbrirPessoa} />
            )}
          </div>
        )
      })}
      {restam > 0 && (
        <button onClick={() => setMostrar((v) => v + FILHOS_POR_LOTE)}
          className="btn-ghost text-xs my-1">
          … mostrar mais {restam} {restam === 1 ? 'pessoa' : 'pessoas'}
        </button>
      )}
    </div>
  )
}

export function ModoArvore({
  nos, ramos, busca, onAbrirPessoa, manter,
}: {
  nos: NoArvore[]
  ramos: Record<number, ResumoRamo>
  busca: string
  manter: Set<number> | null
  onAbrirPessoa: (m: MembroRede) => void
}) {
  const [abertos, setAbertos] = useState<Set<number>>(() => new Set(nos.map((n) => n.membro.powerId)))

  const alternar = useCallback((powerId: number) => {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(powerId)) novo.delete(powerId)
      else novo.add(powerId)
      return novo
    })
  }, [])

  if (manter && manter.size === 0) {
    return (
      <div className="card mt-4 p-12 text-center">
        <p className="text-dark-100 font-medium">Ninguém com esse nome, telefone ou placa na sua rede.</p>
      </div>
    )
  }

  return (
    <div className="card mt-4 overflow-x-auto" role="tree" aria-label="Árvore da sua rede">
      <Ramo nos={nos} ramos={ramos} abertos={abertos} buscando={!!manter} manter={manter}
        onAlternar={alternar} onAbrirPessoa={onAbrirPessoa} />
      {busca && <p className="mt-3 text-xs text-dark-400">Mostrando os caminhos até quem casa com "{busca}".</p>}
    </div>
  )
}
