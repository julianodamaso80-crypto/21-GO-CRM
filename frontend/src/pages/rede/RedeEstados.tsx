import type { ReactNode } from 'react'
import { UsersRound, RefreshCw, AlertTriangle } from 'lucide-react'

/** Skeleton comunica a estrutura que vem. Spinner sozinho em tela cheia, nunca. */
export function SkeletonRede() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="h-8 w-48 rounded-lg bg-dark-800 animate-shimmer" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-24 animate-shimmer" />)}
      </div>
      <div className="card mt-5 p-0 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-14 border-b border-hairline animate-shimmer" />
        ))}
      </div>
    </div>
  )
}

export function EstadoVazio({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: ReactNode }) {
  return (
    <div className="card mt-5 p-12 text-center">
      <div className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-2xl bg-dark-700 border border-hairline">
        <UsersRound className="w-8 h-8 text-dark-400" />
      </div>
      <p className="text-dark-100 font-medium">{titulo}</p>
      <p className="text-dark-400 text-sm mt-1 max-w-sm mx-auto">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function EstadoErro({ onRecarregar }: { onRecarregar: () => void }) {
  return (
    <div className="card mt-5 p-12 text-center border-error/20">
      <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-3" />
      <p className="text-dark-100 font-medium">Não conseguimos carregar sua rede.</p>
      <p className="text-dark-400 text-sm mt-1">Tente de novo em instantes.</p>
      <button onClick={onRecarregar} className="btn-secondary mt-4 inline-flex items-center gap-2">
        <RefreshCw className="w-4 h-4" /> Recarregar
      </button>
    </div>
  )
}
