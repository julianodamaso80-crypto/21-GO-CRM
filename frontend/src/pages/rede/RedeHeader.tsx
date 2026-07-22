import { RefreshCw, AlertTriangle, Info } from 'lucide-react'
import type { Placar } from '../../services/rede.service'

interface Props {
  nome: string
  totalPessoas: number
  niveis: number
  ativas: number
  placar: Placar | undefined
  inadimplentes: number
  atualizadoEm: string | null
  isAdmin: boolean
  onSincronizar: () => void
  onVerInadimplentes: () => void
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function carimbo(iso: string | null): string {
  if (!iso) return 'Sem sincronização ainda'
  const d = new Date(iso)
  const hora = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
  return `Dados de ${d.getDate()} de ${MESES[d.getMonth()]}, ${hora}`
}

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

const TOOLTIP_PONDERADO =
  'Cada placa sua vale 1. Cada placa vendida pelo seu time, do nível 1 ao 6, vale 0,5. Só entram placas com boleto pago.'

export function RedeHeader(p: Props) {
  const velha = p.atualizadoEm ? Date.now() - new Date(p.atualizadoEm).getTime() > SETE_DIAS : false

  return (
    <header className="page-enter">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Minha Rede</h1>
          <p className="text-sm text-dark-300 mt-0.5">
            {p.nome} · {p.totalPessoas} pessoas · {p.niveis} níveis · {p.ativas} ativas
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <span>{carimbo(p.atualizadoEm)}</span>
          {p.isAdmin && (
            <button onClick={p.onSincronizar} aria-label="Atualizar dados da rede" title="Atualizar dados da rede"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {velha && (
        <div className="badge-warning mt-3 flex items-center gap-2 w-fit">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{`Estes números são de ${carimbo(p.atualizadoEm).replace('Dados de ', '').split(',')[0]}. O ciclo pode ter mudado desde então.`}</span>
          {p.isAdmin
            ? <button onClick={p.onSincronizar} className="underline underline-offset-2">Atualizar agora</button>
            : <span>Peça ao administrador para atualizar.</span>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 stagger-children">
        <div className="stat-card">
          <div className="stat-value font-mono tabular-nums">{p.placar?.proprias ?? '—'}</div>
          <div className="stat-label">SUAS · ×1,0</div>
        </div>
        <div className="stat-card">
          <div className="stat-value font-mono tabular-nums">{p.placar?.equipe ?? '—'}</div>
          <div className="stat-label">TIME · ×0,5</div>
        </div>
        <div className="stat-card card-blue" title={TOOLTIP_PONDERADO}>
          <div className="stat-value font-mono tabular-nums text-white flex items-center gap-1.5">
            {p.placar ? p.placar.ponderado.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '—'}
            <Info className="w-3.5 h-3.5 opacity-60" aria-hidden />
          </div>
          <div className="stat-label text-white/70">PONDERADAS</div>
        </div>
        <button onClick={p.onVerInadimplentes}
          className="stat-card text-left hover:border-hairline-strong transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30">
          <div className="stat-value font-mono tabular-nums text-warning">{p.inadimplentes}</div>
          <div className="stat-label">BOLETO VENCIDO</div>
          <div className="text-[11px] text-dark-400 mt-1">Placas que só contam depois do pagamento</div>
          <span className="text-[11px] text-orange-400 font-medium">Ver quem lembrar →</span>
        </button>
      </div>
    </header>
  )
}
