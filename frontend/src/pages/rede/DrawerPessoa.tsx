import { X, MessageCircle, Phone, Mail, ArrowRight } from 'lucide-react'
import type { ArvoreResponse, MembroRede } from '../../services/rede.service'
import { levelColor, levelTextColor, waLink, soDigitos } from './rede.utils'

export function DrawerPessoa({ pessoa, dados, onFechar, onVerPagamento }: {
  pessoa: MembroRede
  dados: ArvoreResponse
  onFechar: () => void
  onVerPagamento: () => void
}) {
  const placas = dados.placasPorCpf[pessoa.cpf] ?? { pagas: 0, inadimplentes: 0 }
  const ramo = dados.ramos[pessoa.powerId]
  const wa = waLink(pessoa.celular)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Detalhes de ${pessoa.nome}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <aside className="drawer-panel relative w-full max-w-md h-full overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: levelColor(pessoa.nivelRaiz), color: levelTextColor(pessoa.nivelRaiz) }}>
              N{pessoa.nivelRaiz}
            </span>
            <h2 className="mt-2 text-lg font-display font-bold text-white">{pessoa.nome}</h2>
            <p className="text-xs text-dark-400">{[pessoa.funcao, pessoa.cooperativa].filter(Boolean).join(' · ')}</p>
          </div>
          <button onClick={onFechar} aria-label="Fechar"
            className="shrink-0 h-8 w-8 grid place-items-center rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <span className={pessoa.status === 'ativo' ? 'badge-success' : 'badge-danger'}>
            {pessoa.status === 'ativo' ? 'Ativo no Power' : 'Bloqueado no Power'}
          </span>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-dark-400 mb-1">Linha completa</p>
          <p className="text-sm text-dark-200 break-words">{pessoa.caminho.replace(/ > /g, ' › ')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            ['Pagas', placas.pagas, 'text-dark-50'],
            ['Vencidas', placas.inadimplentes, 'text-warning'],
            ['Ramo', ramo?.ramo ?? 0, 'text-orange-400'],
          ].map(([rotulo, valor, cor]) => (
            <div key={rotulo as string} className="rounded-xl border border-hairline bg-dark-900/50 px-3 py-2.5 text-center">
              <div className={`font-mono text-xl font-bold tabular-nums ${cor}`}>{valor as number}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-dark-400">{rotulo as string}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" aria-label={`Chamar ${pessoa.nome} no WhatsApp`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          {pessoa.celular && (
            <a href={`tel:${soDigitos(pessoa.celular)}`} aria-label={`Ligar para ${pessoa.nome}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
              <Phone className="w-4 h-4" /> {pessoa.celular}
            </a>
          )}
          {pessoa.email && (
            <a href={`mailto:${pessoa.email}`} aria-label={`Enviar e-mail para ${pessoa.nome}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
              <Mail className="w-4 h-4" /> E-mail
            </a>
          )}
        </div>

        <button onClick={onVerPagamento} className="btn-secondary mt-6 w-full inline-flex items-center justify-center gap-2">
          Ver placas na aba Pagamento <ArrowRight className="w-4 h-4" />
        </button>
      </aside>
    </div>
  )
}
