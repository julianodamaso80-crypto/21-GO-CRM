import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageCircle, Phone } from 'lucide-react'
import type { PlacaLinha } from '../../services/rede.service'
import {
  classeAtraso, mensagemLembrete, waLink,
  levelColor, levelTextColor, dataPorExtenso, formatarTelefone,
} from './rede.utils'

const ALTURA_LINHA = 60

// Header e linhas compartilham este grid, entao alinham sempre. min-width no wrapper
// garante que as colunas nunca se espremam — se nao couber, rola na horizontal.
const COLS_PAGAS = '128px minmax(200px,1.8fr) 168px minmax(150px,1.2fr) 116px 128px'
const COLS_VENCIDAS = '128px minmax(200px,1.8fr) 168px minmax(140px,1.1fr) 124px 104px 132px'
const MINW_PAGAS = 900
const MINW_VENCIDAS = 980

function Vendedor({ p, ehMinha }: { p: PlacaLinha; ehMinha: boolean }) {
  if (ehMinha) return <span className="text-orange-400 font-semibold">Você</span>
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span className="truncate text-dark-200">{p.consultor}</span>
      {p.nivel != null && p.nivel > 0 && (
        <span className="shrink-0 font-mono text-[10px] font-bold px-1 py-0.5 rounded"
          style={{ background: levelColor(p.nivel), color: levelTextColor(p.nivel) }}>
          N{p.nivel}
        </span>
      )}
    </span>
  )
}

export function TabelaPlacas({ placas, modo, raizCpf, raizNome }: {
  placas: PlacaLinha[]
  modo: 'paga' | 'inadimplente'
  raizCpf: string
  raizNome: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const virtual = useVirtualizer({
    count: placas.length,
    getScrollElement: () => container.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 12,
  })

  const cols = modo === 'inadimplente' ? COLS_VENCIDAS : COLS_PAGAS
  const minW = modo === 'inadimplente' ? MINW_VENCIDAS : MINW_PAGAS

  const linkLembrete = (p: PlacaLinha) => {
    const base = waLink(p.telefoneAssociado)
    if (!base || !p.dataVencimento) return null
    const texto = mensagemLembrete(p.associado, p.consultor || raizNome, p.placa, p.dataVencimento)
    return `${base}?text=${encodeURIComponent(texto)}`
  }

  const Th = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
    <div className={`px-3 font-mono text-[10px] font-bold uppercase tracking-wider text-dark-400 flex items-center ${className}`}>
      {children}
    </div>
  )

  return (
    <div className="mt-3 rounded-2xl border border-hairline overflow-hidden bg-dark-900/40">
      <div ref={container} className="max-h-[62vh] overflow-auto">
        <div style={{ minWidth: minW }}>
          {/* Cabecalho */}
          <div className="grid sticky top-0 z-10 h-11 bg-dark-800 border-b border-hairline"
            style={{ gridTemplateColumns: cols }}>
            <Th>Placa</Th>
            <Th>Associado</Th>
            <Th>Telefone</Th>
            <Th>Vendedor</Th>
            {modo === 'inadimplente' ? (
              <>
                <Th className="justify-end">Venceu em</Th>
                <Th className="justify-end">Atraso</Th>
                <Th className="justify-end">Ação</Th>
              </>
            ) : (
              <>
                <Th className="justify-end">Pago em</Th>
                <Th className="justify-end">Valor</Th>
              </>
            )}
          </div>

          {/* Corpo virtualizado */}
          <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
            {virtual.getVirtualItems().map((item) => {
              const p = placas[item.index]
              const ehMinha = p.cpfConsultor === raizCpf
              const wa = linkLembrete(p)
              const telFmt = formatarTelefone(p.telefoneAssociado)
              const telWa = waLink(p.telefoneAssociado)
              return (
                <div key={p.id}
                  className={`grid items-center border-b border-hairline/60 transition-colors hover:bg-dark-800/50 ${item.index % 2 ? 'bg-dark-900/30' : ''}`}
                  style={{
                    gridTemplateColumns: cols,
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    height: ALTURA_LINHA, transform: `translateY(${item.start}px)`,
                  }}>
                  {/* Placa */}
                  <div className="px-3 min-w-0">
                    <span className="font-mono text-sm font-semibold text-dark-50 tracking-wider">{p.placa}</span>
                  </div>
                  {/* Associado */}
                  <div className="px-3 min-w-0">
                    <p className="text-sm text-dark-50 truncate leading-tight" title={p.associado}>{p.associado}</p>
                  </div>
                  {/* Telefone */}
                  <div className="px-3 min-w-0">
                    {telFmt ? (
                      telWa ? (
                        <a href={telWa} target="_blank" rel="noreferrer"
                          className="font-mono text-[13px] text-dark-200 tabular-nums whitespace-nowrap hover:text-emerald-400 transition-colors"
                          title={`Abrir WhatsApp de ${p.associado}`}>
                          {telFmt}
                        </a>
                      ) : (
                        <span className="font-mono text-[13px] text-dark-200 tabular-nums whitespace-nowrap">{telFmt}</span>
                      )
                    ) : (
                      <span className="text-dark-500" title="Sem telefone no cadastro">—</span>
                    )}
                  </div>
                  {/* Vendedor */}
                  <div className="px-3 min-w-0 text-sm">
                    <Vendedor p={p} ehMinha={ehMinha} />
                  </div>

                  {modo === 'inadimplente' ? (
                    <>
                      <div className="px-3 text-right text-sm text-dark-200 whitespace-nowrap">
                        {p.dataVencimento ? dataPorExtenso(p.dataVencimento) : '—'}
                      </div>
                      <div className="px-3 text-right">
                        <span className={`inline-block font-mono tabular-nums text-xs font-bold px-2 py-1 rounded-lg ${classeAtraso(p.diasAtraso ?? 0)}`}>
                          {p.diasAtraso ?? 0}d
                        </span>
                      </div>
                      <div className="px-3 flex justify-end">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer"
                            aria-label={`Lembrar ${p.associado} pelo WhatsApp sobre a placa ${p.placa}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" /> Lembrar
                          </a>
                        ) : telWa ? (
                          <a href={telWa} aria-label={`Ligar para ${p.associado}`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
                            <Phone className="w-3.5 h-3.5" />
                          </a>
                        ) : <span className="text-dark-500">—</span>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="px-3 text-right text-sm text-dark-300 whitespace-nowrap">
                        {p.dataPagamento ? dataPorExtenso(p.dataPagamento) : '—'}
                      </div>
                      <div className="px-3 text-right font-mono tabular-nums text-sm text-dark-50 whitespace-nowrap">
                        {p.valor != null ? p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
