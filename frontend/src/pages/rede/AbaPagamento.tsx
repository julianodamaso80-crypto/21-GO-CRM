import { useMemo, useState, useEffect } from 'react'
import { Search, Download, Info } from 'lucide-react'
import { toast } from 'sonner'
import type { Placar } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { usePlacas } from '../../hooks/useRede'
import { TabelaPlacas } from './TabelaPlacas'
import { SkeletonRede } from './RedeEstados'
import { paraCsv, baixarCsv, rotuloMes, ultimosMeses } from './rede.utils'

const NOTA_METODO =
  'Contamos toda placa com contrato no mês escolhido e boleto pago no mês seguinte, direto do SGA. '
  + 'Placa sem pagamento confirmado não entra. Por isso o número pode diferir de contagens feitas à mão.'

export function AbaPagamento({ contrato, pagamento, placar, raizCpf, raizNome, params, setParam }: {
  contrato: string
  pagamento: string
  placar: Placar | undefined
  raizCpf: string
  raizNome: string
  params: URLSearchParams
  setParam: SetParam
}) {
  const status = (params.get('status') as 'paga' | 'inadimplente') || 'paga'
  const escopo = (params.get('escopo') as 'proprias' | 'equipe' | 'tudo') || 'tudo'
  const consultor = params.get('consultor') || undefined
  const buscaUrl = params.get('q') || ''
  const [busca, setBusca] = useState(buscaUrl)
  const [verNota, setVerNota] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setParam('q', busca || null), 200)
    return () => clearTimeout(t)
  }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps

  const pagas = usePlacas({ contrato, pagamento, status: 'paga', escopo, consultor, busca: buscaUrl })
  const vencidas = usePlacas({ contrato, status: 'inadimplente', escopo, consultor, busca: buscaUrl })

  const lista = useMemo(() => {
    const bruto = (status === 'paga' ? pagas.data?.placas : vencidas.data?.placas) ?? []
    if (status !== 'inadimplente') return bruto
    return [...bruto].sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0))
  }, [status, pagas.data, vencidas.data])

  const meses = ultimosMeses(14)

  const exportar = () => {
    const csv = status === 'inadimplente'
      ? paraCsv(
          lista.map((p) => ({ placa: p.placa, associado: p.associado, telefone: p.telefoneAssociado ?? '',
            vendedor: p.cpfConsultor === raizCpf ? 'Você' : p.consultor, nivel: p.nivel ?? '',
            vencimento: p.dataVencimento ?? '', atraso: p.diasAtraso ?? '' })),
          [{ key: 'placa', header: 'Placa' }, { key: 'associado', header: 'Associado' },
           { key: 'telefone', header: 'Telefone' }, { key: 'vendedor', header: 'Vendedor' },
           { key: 'nivel', header: 'Nível' }, { key: 'vencimento', header: 'Vencimento' },
           { key: 'atraso', header: 'Dias de atraso' }],
        )
      : paraCsv(
          lista.map((p) => ({ placa: p.placa, associado: p.associado, telefone: p.telefoneAssociado ?? '',
            vendedor: p.cpfConsultor === raizCpf ? 'Você' : p.consultor, nivel: p.nivel ?? '',
            pagamento: p.dataPagamento ?? '', valor: p.valor ?? '' })),
          [{ key: 'placa', header: 'Placa' }, { key: 'associado', header: 'Associado' },
           { key: 'telefone', header: 'Telefone' }, { key: 'vendedor', header: 'Vendedor' },
           { key: 'nivel', header: 'Nível' }, { key: 'pagamento', header: 'Pago em' },
           { key: 'valor', header: 'Valor' }],
        )
    const nome = `rede-${status === 'paga' ? 'pagas' : 'inadimplentes'}-${contrato}_${pagamento}.csv`
    baixarCsv(nome, csv)
    toast.success(`Arquivo exportado com ${lista.length} placas.`)
  }

  const carregando = status === 'paga' ? pagas.isLoading : vencidas.isLoading

  return (
    <section className="page-enter">
      <div className="mt-4 flex items-center gap-2 flex-wrap text-sm">
        <label className="text-dark-400">Contrato em</label>
        <select value={contrato} onChange={(e) => setParam('contrato', e.target.value)} className="input w-auto py-1.5">
          {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
        <span className="text-dark-500">→</span>
        <label className="text-dark-400">Pagamento em</label>
        <select value={pagamento} onChange={(e) => setParam('pagamento', e.target.value)} className="input w-auto py-1.5">
          {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
      </div>

      <div className="card mt-4">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-dark-400">Como fechou o ciclo</h3>
        <div className="mt-3 font-mono text-sm space-y-1 tabular-nums">
          <p className="text-dark-200">
            <span className="inline-block w-16 text-right">{placar?.proprias ?? 0}</span> placas suas
            <span className="text-dark-500"> × 1,0 = </span>
            <span className="text-dark-50">{(placar?.proprias ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
          </p>
          <p className="text-dark-200">
            <span className="inline-block w-16 text-right">{placar?.equipe ?? 0}</span> placas do time (N1–N6)
            <span className="text-dark-500"> × 0,5 = </span>
            <span className="text-dark-50">{((placar?.equipe ?? 0) * 0.5).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
          </p>
          <div className="border-t border-hairline my-2" />
          <p className="text-dark-100 font-semibold">
            <span className="inline-block w-16 text-right">{placar?.bruto ?? 0}</span> placas contadas
            <span className="text-dark-500"> → </span>
            <span className="text-orange-400">{(placar?.ponderado ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ponderadas</span>
          </p>
        </div>
        <button onClick={() => setVerNota((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-dark-400 hover:text-dark-200">
          <Info className="w-3.5 h-3.5" /> Como contamos
          {(placar?.foraDoAlcance ?? 0) > 0 && ` · ${placar!.foraDoAlcance} placa(s) de N7 fora do alcance`}
        </button>
        {verNota && <p className="mt-2 text-xs text-dark-400 max-w-2xl">{NOTA_METODO}</p>}
      </div>

      <div className="mt-4 inline-flex rounded-xl border border-hairline bg-dark-800 p-1" role="tablist">
        {([['paga', 'Pagas', pagas.data?.placas.length], ['inadimplente', 'Boleto vencido', vencidas.data?.placas.length]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={status === id} onClick={() => setParam('status', id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
              status === id ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'
            }`}>
            {label} · {n ?? '—'}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar placas" placeholder="Buscar por placa, associado ou telefone…" className="input pl-10" />
        </div>
        <div className="inline-flex rounded-xl border border-hairline bg-dark-800 p-1 self-start">
          {([['proprias', 'Minhas'], ['equipe', 'Do time'], ['tudo', 'Tudo']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setParam('escopo', id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                escopo === id ? 'bg-blue-500 text-white font-semibold' : 'text-dark-300 hover:text-dark-50 font-medium'
              }`}>{label}</button>
          ))}
        </div>
        <button onClick={exportar} className="btn-secondary inline-flex items-center gap-2 self-start">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {consultor && (
        <button onClick={() => setParam('consultor', null)} className="badge-info mt-3">
          Consultor filtrado ×
        </button>
      )}

      {carregando ? <SkeletonRede /> : lista.length === 0 ? (
        <div className="card mt-4 p-12 text-center">
          <p className="text-dark-100 font-medium">
            {status === 'inadimplente'
              ? 'Nenhum boleto vencido neste ciclo. Seu time está em dia.'
              : 'Nenhuma placa paga neste ciclo ainda. Os boletos pagos aparecem aqui assim que o SGA confirma.'}
          </p>
          {(buscaUrl || consultor) && (
            <button onClick={() => { setBusca(''); setParam('q', null); setParam('consultor', null) }}
              className="btn-secondary mt-4">Limpar busca</button>
          )}
        </div>
      ) : (
        <>
          <TabelaPlacas placas={lista} modo={status} raizCpf={raizCpf} raizNome={raizNome} />
          <p className="mt-3 text-xs text-dark-400">{lista.length} placas · filtro aplicado</p>
        </>
      )}
    </section>
  )
}
