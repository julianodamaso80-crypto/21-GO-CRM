import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageCircle } from 'lucide-react'
import type { PlacaLinha } from '../../services/rede.service'
import { classeAtraso, mensagemLembrete, waLink, levelColor, levelTextColor, dataPorExtenso } from './rede.utils'

const ALTURA_LINHA = 56

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
    overscan: 10,
  })

  const linkLembrete = (p: PlacaLinha) => {
    const base = waLink(p.telefoneAssociado)
    if (!base || !p.dataVencimento) return null
    const texto = mensagemLembrete(p.associado, p.consultor || raizNome, p.placa, p.dataVencimento)
    return `${base}?text=${encodeURIComponent(texto)}`
  }

  return (
    <div className="table-container mt-3">
      <div ref={container} className="max-h-[60vh] overflow-auto">
        <table className="w-full">
          <thead className="table-header sticky top-0 z-10">
            <tr>
              <th scope="col" className="w-28">Placa</th>
              <th scope="col">Associado</th>
              <th scope="col" className="w-40">Telefone</th>
              <th scope="col" className="w-48">Vendedor</th>
              {modo === 'inadimplente'
                ? <><th scope="col" className="w-28 text-right">Atraso</th><th scope="col" className="w-24 text-right">Ação</th></>
                : <><th scope="col" className="w-32 text-right">Paga em</th><th scope="col" className="w-28 text-right">Valor</th></>}
            </tr>
          </thead>
          <tbody style={{ height: virtual.getTotalSize(), position: 'relative', display: 'block' }}>
            {virtual.getVirtualItems().map((item) => {
              const p = placas[item.index]
              const ehMinha = p.cpfConsultor === raizCpf
              const wa = linkLembrete(p)
              return (
                <tr key={p.id} className="table-row"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    height: ALTURA_LINHA, transform: `translateY(${item.start}px)`,
                    display: 'flex', alignItems: 'center',
                  }}>
                  <td className="w-28 font-mono text-sm text-dark-50 tracking-wide">{p.placa}</td>
                  <td className="flex-1 min-w-0 truncate text-sm text-dark-100">{p.associado}</td>
                  <td className="w-40 font-mono text-xs text-dark-300 tabular-nums">
                    {p.telefoneAssociado || <span className="text-dark-500" title="Sem telefone no cadastro">—</span>}
                  </td>
                  <td className="w-48 truncate text-sm">
                    {ehMinha
                      ? <span className="text-orange-400 font-semibold">Você</span>
                      : (
                        <span className="text-dark-300">
                          {p.consultor}
                          {p.nivel != null && p.nivel > 0 && (
                            <span className="ml-1.5 font-mono text-[10px] font-bold px-1 py-0.5 rounded"
                              style={{ background: levelColor(p.nivel), color: levelTextColor(p.nivel) }}>
                              N{p.nivel}
                            </span>
                          )}
                        </span>
                      )}
                  </td>
                  {modo === 'inadimplente' ? (
                    <>
                      <td className="w-28 text-right">
                        <span className={`font-mono tabular-nums text-sm ${classeAtraso(p.diasAtraso ?? 0)}`}>
                          {p.diasAtraso ?? 0} dias
                        </span>
                      </td>
                      <td className="w-24 text-right">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer"
                            aria-label={`Lembrar ${p.associado} pelo WhatsApp sobre a placa ${p.placa}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                            <MessageCircle className="w-3.5 h-3.5" /> Lembrar
                          </a>
                        ) : <span className="text-dark-500">—</span>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="w-32 text-right text-sm text-dark-300">
                        {p.dataPagamento ? dataPorExtenso(p.dataPagamento) : '—'}
                      </td>
                      <td className="w-28 text-right font-mono tabular-nums text-sm text-dark-100">
                        {p.valor != null ? p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
