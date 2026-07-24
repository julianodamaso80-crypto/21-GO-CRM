import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Network, Users2, UserCheck, Loader2, TrendingUp, ShieldCheck, Wallet,
  AlertTriangle, Crown, Layers,
} from 'lucide-react'
import { useDashboardRede } from '../../hooks/useDashboardRede'
import type { DashboardRedeResponse } from '../../services/dashboard-rede.service'

type Visao = 'rede' | 'consultores' | 'associados'

const VISOES: Array<{ value: Visao; label: string; icon: React.ReactNode }> = [
  { value: 'rede', label: 'Minha Rede', icon: <Network className="w-4 h-4" /> },
  { value: 'consultores', label: 'Meus Consultores', icon: <Users2 className="w-4 h-4" /> },
  { value: 'associados', label: 'Meus Associados', icon: <UserCheck className="w-4 h-4" /> },
]

const NIVEL_LABEL: Record<string, string> = {
  '2026-01': 'jan', '2026-02': 'fev', '2026-03': 'mar', '2026-04': 'abr', '2026-05': 'mai',
  '2026-06': 'jun', '2026-07': 'jul', '2026-08': 'ago', '2026-09': 'set', '2026-10': 'out',
  '2026-11': 'nov', '2026-12': 'dez',
}
const mesCurto = (ym: string) => NIVEL_LABEL[ym] ?? ym

const fmtNum = (v: number) =>
  v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

/**
 * O SGA nao devolve valor no boleto vencido (vem zerado), entao mostrar "R$ 0 em aberto"
 * enganaria. So cita o valor quando ele existe de fato.
 */
const subInadimplencia = (valor: number) =>
  valor > 0 ? `${fmtBRL(valor)} em aberto` : 'boletos vencidos'

// Escala de cor por nivel (N1 mais quente -> N6 mais frio), com contraste WCAG ok.
const NIVEL_COR = ['#F2911D', '#E8A33C', '#C7B15A', '#8FA98C', '#5E97B0', '#6E7FC0']
const corNivel = (n: number) => NIVEL_COR[(n - 1) % NIVEL_COR.length]

export function DashboardRedeHibrido() {
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as Visao) || 'rede'
  const contrato = params.get('rc') || undefined
  const pagamento = params.get('rp') || undefined

  const ciclo = contrato && pagamento ? { contrato, pagamento } : undefined
  const { data, isLoading, isError } = useDashboardRede(ciclo)

  const setView = (v: Visao) => {
    const p = new URLSearchParams(params)
    p.set('view', v)
    setParams(p, { replace: true })
  }
  const setCiclo = (c: string) => {
    const [rc, rp] = c.split('|')
    const p = new URLSearchParams(params)
    p.set('rc', rc); p.set('rp', rp)
    setParams(p, { replace: true })
  }

  // Sem rede vinculada (404) ou erro: nao renderiza nada — o Dashboard cai no funil.
  if (isError) return null
  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dark-700/40 bg-dark-800/40 py-10">
        <Loader2 className="w-6 h-6 text-orange-400 animate-spin" />
      </div>
    )
  }

  const atualizado = data.ciclo.atualizadoEm
    ? new Date(data.ciclo.atualizadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    : '—'

  return (
    <div className="space-y-4">
      {/* Cabecalho: seletor de visao + ciclo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex flex-wrap gap-1 p-1 bg-dark-800/60 backdrop-blur-xl border border-dark-700/40 rounded-xl shadow-lg">
          {VISOES.map((v) => (
            <button
              key={v.value}
              onClick={() => setView(v.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${
                view === v.value
                  ? 'bg-gradient-to-br from-orange-500/25 to-orange-600/10 text-orange-200 shadow-inner border border-orange-500/30'
                  : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              {v.icon}
              {v.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          {data.ciclosDisponiveis.length > 1 && (
            <select
              value={`${data.ciclo.contrato}|${data.ciclo.pagamento}`}
              onChange={(e) => setCiclo(e.target.value)}
              className="bg-dark-900/60 border border-dark-700 rounded-lg px-2.5 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-orange-500/50"
            >
              {data.ciclosDisponiveis.map((c) => (
                <option key={`${c.contrato}|${c.pagamento}`} value={`${c.contrato}|${c.pagamento}`}>
                  Contrato {mesCurto(c.contrato)} · pago {mesCurto(c.pagamento)}
                </option>
              ))}
            </select>
          )}
          <span className="whitespace-nowrap">
            ciclo <span className="text-orange-300 font-medium">{mesCurto(data.ciclo.contrato)}→{mesCurto(data.ciclo.pagamento)}</span> · dados de {atualizado}
          </span>
        </div>
      </div>

      {view === 'rede' && <VisaoRede data={data} />}
      {view === 'consultores' && <VisaoConsultores data={data} />}
      {view === 'associados' && <VisaoAssociados data={data} />}
    </div>
  )
}

/* ---------- Visao 1: MINHA REDE ---------- */
function VisaoRede({ data }: { data: DashboardRedeResponse }) {
  const r = data.rede
  const niveis = useMemo(
    () => Array.from({ length: 6 }, (_, i) => i + 1).map((n) => ({
      nivel: n,
      pessoas: r.pessoasPorNivel[n] ?? 0,
      placas: r.porNivel[n] ?? 0,
    })),
    [r],
  )
  const maxPlacas = Math.max(1, ...niveis.map((n) => n.placas))

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* HEROI: ponderado */}
        <div className="lg:col-span-5 relative overflow-hidden rounded-2xl p-6 border border-orange-500/30 bg-gradient-to-br from-orange-500/15 via-dark-800/80 to-dark-900/50 shadow-glow-orange">
          <div className="flex items-center gap-2 text-orange-200/90 text-xs font-medium uppercase tracking-wide">
            <TrendingUp className="w-4 h-4" /> Ponderado do ciclo · o que remunera
          </div>
          <div className="mt-3 font-display text-6xl font-bold text-white tracking-tight tabular-nums">
            {fmtNum(r.ponderado)}
          </div>
          <div className="mt-2 text-sm text-gray-300">
            <span className="text-white font-semibold">{r.proprias}</span> suas <span className="text-gray-500">×1,0</span>
            {'  +  '}
            <span className="text-white font-semibold">{r.equipe}</span> do time <span className="text-gray-500">×0,5</span>
          </div>
          <div className="mt-1 text-xs text-gray-500">Bruto {r.bruto} placas · {r.consultoresProduzindo} consultores produzindo</div>
        </div>

        {/* Cards laterais */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MiniStat icon={<ShieldCheck className="w-4 h-4" />} accent="#34D399" label="Suas placas" value={String(r.proprias)} sub="venda própria ×1,0" />
          <MiniStat icon={<Users2 className="w-4 h-4" />} accent="#445DA8" label="Placas do time" value={String(r.equipe)} sub="N1 a N6 ×0,5" />
          <MiniStat icon={<Wallet className="w-4 h-4" />} accent="#F2911D" label="Receita cobrada" value={fmtBRL(r.valorTotal)} sub={`${r.bruto} boletos pagos`} />
          <MiniStat icon={<AlertTriangle className="w-4 h-4" />} accent="#F43F5E" label="Inadimplência" value={String(r.inadimplentes.qtd)} sub={subInadimplencia(r.inadimplentes.valor)} />
          {r.foraDoAlcance > 0 && (
            <MiniStat icon={<Layers className="w-4 h-4" />} accent="#94A3B8" label="Fora do alcance" value={String(r.foraDoAlcance)} sub="N7+ (não remunera)" />
          )}
        </div>
      </div>

      {/* Placas por nivel */}
      <div className="rounded-2xl border border-dark-700/40 bg-gradient-to-br from-dark-800/60 to-dark-900/40 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Placas pagas por nível do time</h3>
        <div className="space-y-2.5">
          {niveis.map((n) => (
            <div key={n.nivel} className="flex items-center gap-3">
              <span className="w-8 text-xs font-mono text-gray-400">N{n.nivel}</span>
              <div className="flex-1 h-6 rounded-md bg-dark-900/60 overflow-hidden">
                <div
                  className="h-full rounded-md transition-all"
                  style={{ width: `${(n.placas / maxPlacas) * 100}%`, backgroundColor: corNivel(n.nivel), minWidth: n.placas ? 8 : 0 }}
                />
              </div>
              <span className="w-28 text-right text-xs text-gray-300 tabular-nums">
                {n.placas} placas · {n.pessoas} pessoas
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ---------- Visao 2: MEUS CONSULTORES ---------- */
function VisaoConsultores({ data }: { data: DashboardRedeResponse }) {
  const c = data.consultores
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon={<Users2 className="w-4 h-4" />} accent="#445DA8" label="Consultores no time" value={String(c.total)} sub="toda a downline" />
        <MiniStat icon={<TrendingUp className="w-4 h-4" />} accent="#34D399" label="Produzindo" value={String(c.produzindo)} sub="≥1 placa paga no ciclo" />
        <MiniStat icon={<UserCheck className="w-4 h-4" />} accent="#F2911D" label="Ativos" value={String(c.ativos)} sub="cadastro ativo" />
        <MiniStat icon={<AlertTriangle className="w-4 h-4" />} accent="#94A3B8" label="Bloqueados" value={String(c.bloqueados)} sub="hoje bloqueados" />
      </div>

      <div className="rounded-2xl border border-dark-700/40 bg-gradient-to-br from-dark-800/60 to-dark-900/40 p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white mb-4">
          <Crown className="w-4 h-4 text-orange-300" /> Top consultores por placas do ramo
        </h3>
        {c.top.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhuma placa paga no ciclo ainda.</p>
        ) : (
          <div className="space-y-1.5">
            {c.top.map((p, i) => (
              <div key={p.powerId} className="flex items-center gap-3 rounded-lg px-3 py-2.5 bg-dark-900/40 hover:bg-dark-900/70 transition-colors">
                <span className="w-6 text-center text-xs font-bold text-gray-500">#{i + 1}</span>
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold text-dark-950"
                  style={{ backgroundColor: corNivel(p.nivel) }}
                >
                  N{p.nivel}
                </span>
                <span className="flex-1 text-sm text-gray-200 truncate">{p.nome}</span>
                <span className="text-xs text-gray-500 tabular-nums hidden sm:block">{p.descendentes} abaixo</span>
                <span className="text-xs text-gray-400 tabular-nums w-20 text-right">próprias {p.proprias}</span>
                <span className="text-sm font-semibold text-white tabular-nums w-20 text-right">ramo {p.ramo}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Visao 3: MEUS ASSOCIADOS ---------- */
function VisaoAssociados({ data }: { data: DashboardRedeResponse }) {
  const a = data.associados
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MiniStat icon={<UserCheck className="w-4 h-4" />} accent="#34D399" label="Placas pagas" value={String(a.placasPagas)} sub={`${a.associadosDistintos} associados`} />
        <MiniStat icon={<Wallet className="w-4 h-4" />} accent="#F2911D" label="Receita do ciclo" value={fmtBRL(a.receita)} sub="boletos pagos" />
        <MiniStat icon={<TrendingUp className="w-4 h-4" />} accent="#445DA8" label="Ticket médio" value={fmtBRL(a.ticketMedio)} sub="por placa" />
        <MiniStat icon={<AlertTriangle className="w-4 h-4" />} accent="#F43F5E" label="Inadimplência" value={String(a.inadimplentes.qtd)} sub={subInadimplencia(a.inadimplentes.valor)} />
      </div>

      <div className="rounded-2xl border border-dark-700/40 bg-gradient-to-br from-dark-800/60 to-dark-900/40 p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Últimos boletos pagos no ciclo</h3>
        {a.recentes.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">Nenhum boleto pago no ciclo ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-gray-500 border-b border-dark-700/40">
                  <th className="text-left font-medium py-2">Associado</th>
                  <th className="text-left font-medium py-2">Placa</th>
                  <th className="text-left font-medium py-2 hidden sm:table-cell">Consultor</th>
                  <th className="text-right font-medium py-2">Valor</th>
                  <th className="text-right font-medium py-2 hidden sm:table-cell">Pago em</th>
                </tr>
              </thead>
              <tbody>
                {a.recentes.map((p, i) => (
                  <tr key={`${p.placa}-${i}`} className="border-b border-dark-800/40 last:border-0">
                    <td className="py-2.5 text-gray-200 truncate max-w-[160px]">{p.associado}</td>
                    <td className="py-2.5 font-mono text-xs text-gray-300">{p.placa}</td>
                    <td className="py-2.5 text-gray-400 hidden sm:table-cell truncate max-w-[140px]">
                      {p.consultor}{p.nivel != null && p.nivel > 0 ? <span className="text-gray-600"> · N{p.nivel}</span> : null}
                    </td>
                    <td className="py-2.5 text-right text-white tabular-nums">{p.valor != null ? fmtBRL(p.valor) : '—'}</td>
                    <td className="py-2.5 text-right text-gray-500 tabular-nums hidden sm:table-cell">
                      {p.dataPagamento ? new Date(p.dataPagamento + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

/* ---------- Card compartilhado ---------- */
function MiniStat({
  icon, accent, label, value, sub,
}: {
  icon: React.ReactNode
  accent: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="relative overflow-hidden rounded-xl p-4 border border-dark-700/40 bg-gradient-to-br from-dark-800/70 to-dark-900/40">
      <div className="flex items-center gap-2 text-xs text-gray-400">
        <span style={{ color: accent }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-display font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-gray-500">{sub}</div>}
    </div>
  )
}
