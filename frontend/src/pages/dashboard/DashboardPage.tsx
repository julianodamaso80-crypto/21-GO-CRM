import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Users, Car, Loader2, TrendingUp, TrendingDown, Wallet,
  ShieldCheck, ArrowUpRight, Sparkles, Target, MessageSquare,
  Bot, Zap, ClipboardCheck, Handshake, Clock, Megaphone, MapPin, Calendar, Bike,
} from 'lucide-react'
import {
  Area, AreaChart, Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis,
  CartesianGrid, Legend,
} from 'recharts'
import { useDashboardStats } from '../../hooks/useDashboard'
import { useAnalyticsSources, useAnalyticsByState, useAnalyticsByVehicleType } from '../../hooks/useAnalytics'
import { DashboardRedeHibrido } from './DashboardRedeHibrido'
import type { DashboardPeriod } from '../../../../shared/types'

const SOURCE_META: Record<string, { label: string; color: string }> = {
  google_ads:    { label: 'Google Ads',  color: '#4285F4' },
  meta_ads:      { label: 'Meta Ads',    color: '#1877F2' },
  instagram:     { label: 'Instagram',   color: '#E4405F' },
  whatsapp:      { label: 'WhatsApp',    color: '#25D366' },
  site_organico: { label: 'Orgânico',     color: '#10B981' },
  indicacao:     { label: 'Indicação',    color: '#F59E0B' },
  direto:        { label: 'Direto',      color: '#6366F1' },
  desconhecido:  { label: 'Desconhecido', color: '#94A3B8' },
}

const sourceLabel = (key: string) => SOURCE_META[key]?.label ?? key
const sourceColor = (key: string) => SOURCE_META[key]?.color ?? '#94A3B8'

type PeriodPreset = 1 | 7 | 30 | 90 | 'month' | 'last_month' | 'custom'

const PERIOD_PRESETS: Array<{ value: Exclude<PeriodPreset, 'custom'>; label: string }> = [
  { value: 1, label: 'Hoje' },
  { value: 7, label: '7 dias' },
  { value: 30, label: '30 dias' },
  { value: 90, label: '90 dias' },
  { value: 'month', label: 'Este mês' },
  { value: 'last_month', label: 'Mês passado' },
]

const toYMD = (d: Date) => d.toISOString().slice(0, 10)

const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })

const formatBRLFull = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function DashboardPage() {
  const [preset, setPreset] = useState<PeriodPreset>(7)
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    return toYMD(d)
  })
  const [customEnd, setCustomEnd] = useState<string>(() => toYMD(new Date()))

  const { effectiveDays, periodLabel, analyticsFilters } = useMemo(() => {
    const now = new Date()
    const truncatedNow = new Date(now); truncatedNow.setMinutes(0, 0, 0)

    if (preset === 'custom') {
      const start = new Date(customStart + 'T00:00:00')
      const end = new Date(customEnd + 'T23:59:59')
      const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
      return {
        effectiveDays: days as DashboardPeriod,
        periodLabel: `${customStart} → ${customEnd}`,
        analyticsFilters: { startDate: start.toISOString(), endDate: end.toISOString() },
      }
    }
    if (preset === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1)
      const days = Math.max(1, Math.ceil((truncatedNow.getTime() - start.getTime()) / 86400000))
      return {
        effectiveDays: days as DashboardPeriod,
        periodLabel: 'Este mês',
        analyticsFilters: { startDate: start.toISOString(), endDate: truncatedNow.toISOString() },
      }
    }
    if (preset === 'last_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59)
      const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000))
      return {
        effectiveDays: days as DashboardPeriod,
        periodLabel: 'Mês passado',
        analyticsFilters: { startDate: start.toISOString(), endDate: end.toISOString() },
      }
    }
    const days = preset as number
    const start = new Date(truncatedNow); start.setDate(start.getDate() - days)
    return {
      effectiveDays: days as DashboardPeriod,
      periodLabel: days === 1 ? 'Hoje' : `${days} dias`,
      analyticsFilters: { startDate: start.toISOString(), endDate: truncatedNow.toISOString() },
    }
  }, [preset, customStart, customEnd])

  const { data: stats, isLoading } = useDashboardStats(effectiveDays)
  const { data: sourcesData, isLoading: sourcesLoading } = useAnalyticsSources(analyticsFilters)
  const { data: stateData, isLoading: stateLoading } = useAnalyticsByState(analyticsFilters)
  const { data: vehicleTypeData, isLoading: vehicleTypeLoading } = useAnalyticsByVehicleType(analyticsFilters)

  if (isLoading || !stats) {
    return (
      <div className="flex justify-center items-center h-96">
        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
      </div>
    )
  }

  const k = stats.kpis

  // sparklines (mesma serie, recortes diferentes pra cada KPI)
  const sparkReceita = stats.timeline.map((t) => ({ x: t.date, y: t.receita }))
  const sparkFechados = stats.timeline.map((t) => ({ x: t.date, y: t.fechados }))
  const sparkEntradas = stats.timeline.map((t) => ({ x: t.date, y: t.entradas }))

  return (
    <div className="relative min-h-screen p-6 space-y-6 page-enter">
      {/* Background radial sutil — paleta oficial 21Go (#293C82 azul + #F2911D laranja) */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(242, 145, 29, 0.08), transparent 60%), radial-gradient(ellipse 60% 40% at 90% 20%, rgba(41, 60, 130, 0.12), transparent 50%)',
        }}
      />

      <div className="relative z-10 space-y-6">
        {/* Header com filtro de periodo */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-2xl font-display font-bold text-white tracking-tight">Dashboard</h1>
              <p className="text-sm text-gray-400 mt-1">
                Visao da 21Go — periodo: <span className="text-gold-400 font-medium">{periodLabel}</span>
              </p>
            </div>
            <div className="inline-flex flex-wrap p-1 bg-dark-800/60 backdrop-blur-xl border border-dark-700/40 rounded-xl shadow-lg">
              {PERIOD_PRESETS.map((opt) => (
                <button
                  key={String(opt.value)}
                  onClick={() => setPreset(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    preset === opt.value
                      ? 'bg-gradient-to-br from-gold-500/20 to-gold-600/10 text-gold-300 shadow-inner border border-gold-500/30'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setPreset('custom')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
                  preset === 'custom'
                    ? 'bg-gradient-to-br from-gold-500/20 to-gold-600/10 text-gold-300 shadow-inner border border-gold-500/30'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Calendar className="w-3 h-3" />
                Personalizado
              </button>
            </div>
          </div>
          {preset === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 bg-dark-800/40 backdrop-blur-xl border border-gold-500/20 rounded-xl p-3">
              <span className="text-xs text-gray-400">De</span>
              <input
                type="date"
                value={customStart}
                max={customEnd}
                onChange={(e) => setCustomStart(e.target.value)}
                className="bg-dark-900/60 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gold-500/50"
              />
              <span className="text-xs text-gray-400">até</span>
              <input
                type="date"
                value={customEnd}
                min={customStart}
                max={toYMD(new Date())}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-dark-900/60 border border-dark-700 rounded-lg px-3 py-1.5 text-xs text-gray-200 focus:outline-none focus:border-gold-500/50"
              />
              <span className="text-xs text-gray-500 ml-2">
                ({effectiveDays} {effectiveDays === 1 ? 'dia' : 'dias'})
              </span>
            </div>
          )}
        </div>

        {/* === DASHBOARD HIBRIDO DA REDE (protagonista) ===
            Se render nada quando o usuario nao tem rede vinculada (cai no funil abaixo). */}
        <DashboardRedeHibrido />

        {/* === KPI HERO (4 cards principais) === */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <KpiHero
            label="Associados Fechados"
            value={k.fechadosPeriodo}
            sub={`Total ativos: ${k.associadosAtivos}`}
            delta={k.fechadosDelta}
            icon={<ShieldCheck className="w-5 h-5" />}
            accent="emerald"
            sparkline={sparkFechados}
            link="/associados"
          />
          <KpiHero
            label="Receita Cobrada"
            value={formatBRL(k.receitaPeriodo)}
            sub={`Anterior: ${formatBRL(k.receitaAnterior)}`}
            delta={k.receitaDelta}
            icon={<Wallet className="w-5 h-5" />}
            accent="gold"
            sparkline={sparkReceita}
            highlight
          />
          <KpiHero
            label="Em Vistoria"
            value={k.emVistoria}
            sub="aguardando aprovacao"
            icon={<ClipboardCheck className="w-5 h-5" />}
            accent="blue"
            link="/pipes"
          />
          <KpiHero
            label="Em Negociacao"
            value={k.emNegociacao}
            sub="conversas ativas"
            icon={<Handshake className="w-5 h-5" />}
            accent="purple"
            link="/pipes"
          />
        </div>

        {/* === KPI SECUNDARIOS === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <KpiMini
            label="Entradas no periodo"
            value={k.entradasPeriodo}
            delta={k.entradasDelta}
            icon={<Sparkles className="w-4 h-4" />}
            sparkline={sparkEntradas}
          />
          <KpiMini
            label="Taxa de conversao"
            value={`${k.taxaConversao}%`}
            icon={<Target className="w-4 h-4" />}
          />
          <TopOrigemMini sources={sourcesData?.data ?? []} loading={sourcesLoading} />
          <KpiMini
            label="Total associados"
            value={k.associadosTotal}
            icon={<Users className="w-4 h-4" />}
          />
        </div>

        {/* === ATIVIDADE DO FUNIL (snapshot atual + reprovados periodo) === */}
        <FunnelActivityStrip kpis={k} />

        {/* === GRAFICO PRINCIPAL: Receita por dia (compacto) === */}
        <GlassCard>
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Crescimento de receita</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Receita por dia — ultimos {Math.min(effectiveDays, 30)} dias
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Total no periodo</p>
              <p className="text-xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-br from-gold-300 to-gold-500">
                {formatBRLFull(k.receitaPeriodo)}
              </p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={stats.timeline} margin={{ top: 10, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="gradReceita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F2911D" stopOpacity={0.5} />
                  <stop offset="60%" stopColor="#F2911D" stopOpacity={0.15} />
                  <stop offset="100%" stopColor="#F2911D" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradFechados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#757598' }}
                tickFormatter={(d) => {
                  const dt = new Date(d)
                  return `${dt.getDate()}/${dt.getMonth() + 1}`
                }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#757598' }}
                tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid rgba(242, 145, 29, 0.25)',
                  backgroundColor: 'rgba(11, 17, 32, 0.95)',
                  backdropFilter: 'blur(16px)',
                  fontSize: 12,
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                }}
                labelFormatter={(label) => {
                  const dt = new Date(label)
                  return dt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                }}
                formatter={(value: number, name: string) => {
                  if (name === 'receita') return [formatBRLFull(value), 'Receita']
                  if (name === 'fechados') return [value, 'Fechados']
                  return [value, name]
                }}
              />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="#F2911D"
                strokeWidth={2.5}
                fill="url(#gradReceita)"
                animationDuration={800}
              />
              <Area
                type="monotone"
                dataKey="fechados"
                stroke="#10B981"
                strokeWidth={1.5}
                fill="url(#gradFechados)"
                animationDuration={1000}
              />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        {/* === CONVERSAO POR CANAL (ROI de midia) === */}
        <SourceConversionPanel
          data={sourcesData?.data ?? []}
          totals={sourcesData?.totals ?? { leads: 0, converted: 0, revenue: 0 }}
          isLoading={sourcesLoading}
          periodLabel={periodLabel}
        />

        {/* === CONVERSAO POR ESTADO (DDD do telefone) === */}
        <StateConversionPanel
          data={stateData?.data ?? []}
          totals={stateData?.totals ?? { leads: 0, aprovados: 0 }}
          isLoading={stateLoading}
          periodLabel={periodLabel}
        />

        {/* === CARRO vs MOTO === */}
        <VehicleTypeConversionPanel
          data={vehicleTypeData?.data ?? []}
          totals={vehicleTypeData?.totals ?? { leads: 0, aprovados: 0 }}
          isLoading={vehicleTypeLoading}
          periodLabel={periodLabel}
        />

        {/* === FUNIL + ULTIMOS FECHADOS === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Funil */}
          <GlassCard className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Funil de vendas</h3>
                <p className="text-xs text-gray-500 mt-0.5">Distribuicao atual por etapa</p>
              </div>
              <Link
                to="/pipes"
                className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 transition-colors"
              >
                Ver Kanban <ArrowUpRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2.5">
              {stats.funil.map((phase) => {
                const max = Math.max(...stats.funil.map((p) => p.count), 1)
                const pct = (phase.count / max) * 100
                return <FunnelBar key={phase.id} phase={phase} widthPct={pct} />
              })}
              {stats.funil.length === 0 && (
                <p className="text-sm text-gray-500 text-center py-8">Funil vazio</p>
              )}
            </div>
          </GlassCard>

          {/* Ultimos fechados */}
          <GlassCard>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white">Ultimos fechados</h3>
              <span className="text-[10px] uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                {stats.ultimosFechados.length}
              </span>
            </div>
            <div className="space-y-2.5">
              {stats.ultimosFechados.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">Nenhum fechado ainda</p>
              ) : (
                stats.ultimosFechados.map((f) => <FechadoRow key={f.id} f={f} />)
              )}
            </div>
          </GlassCard>
        </div>

        {/* === ACESSO RAPIDO === */}
        <GlassCard>
          <h3 className="text-sm font-semibold text-white mb-4">Acesso rapido</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            <QuickLink icon={<Users size={18} />} label="Associados" to="/associados" tint="gold" />
            <QuickLink icon={<Car size={18} />} label="Veiculos" to="/vehicles" tint="blue" />
            <QuickLink icon={<Target size={18} />} label="Leads" to="/leads" tint="emerald" />
            <QuickLink icon={<ShieldCheck size={18} />} label="NPS" to="/nps" tint="purple" />
            <QuickLink icon={<MessageSquare size={18} />} label="Inbox" to="/inbox" tint="rose" />
            <QuickLink icon={<Bot size={18} />} label="IA" to="/ai" tint="cyan" />
            <QuickLink icon={<TrendingUp size={18} />} label="Analytics" to="/analytics" tint="amber" />
            <QuickLink icon={<Zap size={18} />} label="Automacoes" to="/automations" tint="yellow" />
          </div>
        </GlassCard>

      </div>
    </div>
  )
}

/* ============================================================
 * SUB-COMPONENTS
 * ============================================================ */

function GlassCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`relative bg-gradient-to-br from-dark-800/60 to-dark-900/40 backdrop-blur-xl border border-dark-700/40 rounded-2xl p-5 shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-dark-700/60 transition-colors ${className}`}
    >
      {children}
    </div>
  )
}

type Accent = 'gold' | 'emerald' | 'blue' | 'purple' | 'rose' | 'cyan' | 'amber' | 'yellow'

const accentMap: Record<Accent, { text: string; bg: string; border: string; glow: string; gradId: string; stroke: string }> = {
  gold: { text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-500/25', glow: 'shadow-glow-orange', gradId: 'sparkGold', stroke: '#F2911D' },
  emerald: { text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', glow: 'shadow-emerald-500/10', gradId: 'sparkEmerald', stroke: '#34D399' },
  blue: { text: 'text-blue-300', bg: 'bg-blue-500/10', border: 'border-blue-500/25', glow: 'shadow-glow-blue', gradId: 'sparkBlue', stroke: '#445DA8' },
  purple: { text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-500/25', glow: 'shadow-violet-500/10', gradId: 'sparkPurple', stroke: '#8B5CF6' },
  rose: { text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-500/25', glow: 'shadow-rose-500/10', gradId: 'sparkRose', stroke: '#F43F5E' },
  cyan: { text: 'text-cyan-300', bg: 'bg-cyan-500/10', border: 'border-cyan-500/25', glow: 'shadow-cyan-500/10', gradId: 'sparkCyan', stroke: '#06B6D4' },
  amber: { text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/25', glow: 'shadow-amber-500/10', gradId: 'sparkAmber', stroke: '#F59E0B' },
  yellow: { text: 'text-yellow-300', bg: 'bg-yellow-500/10', border: 'border-yellow-500/25', glow: 'shadow-yellow-500/10', gradId: 'sparkYellow', stroke: '#EAB308' },
}

function KpiHero({
  label, value, sub, delta, icon, accent, sparkline, link, highlight,
}: {
  label: string
  value: number | string
  sub?: string
  delta?: number
  icon: React.ReactNode
  accent: Accent
  sparkline?: Array<{ x: string; y: number }>
  link?: string
  highlight?: boolean
}) {
  const c = accentMap[accent]
  const content = (
    <div
      className={`group relative overflow-hidden rounded-2xl p-5 border ${c.border} bg-gradient-to-br from-dark-800/80 to-dark-900/40 backdrop-blur-xl shadow-xl ${c.glow} hover:shadow-2xl transition-all hover:scale-[1.02] hover:-translate-y-0.5 cursor-pointer`}
    >
      {/* glow gradient atras */}
      {highlight && (
        <div
          className="absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(circle at 30% 0%, ${c.stroke}22, transparent 60%)`,
          }}
        />
      )}
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <div className={`w-9 h-9 rounded-xl ${c.bg} ${c.text} flex items-center justify-center ring-1 ${c.border}`}>
            {icon}
          </div>
          {typeof delta === 'number' && (
            <DeltaPill delta={delta} />
          )}
        </div>
        <div className="mt-4">
          <p className="text-xs text-gray-400 font-medium tracking-wide">{label}</p>
          <p className="text-3xl font-display font-bold text-white mt-1 leading-none">{value}</p>
          {sub && <p className="text-xs text-gray-500 mt-2">{sub}</p>}
        </div>
        {sparkline && sparkline.length > 1 && (
          <div className="mt-3 h-12 -mx-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <defs>
                  <linearGradient id={c.gradId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c.stroke} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={c.stroke} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="y" stroke={c.stroke} strokeWidth={1.8} fill={`url(#${c.gradId})`} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
  if (link) return <Link to={link}>{content}</Link>
  return content
}

function KpiMini({
  label, value, delta, icon, sparkline,
}: {
  label: string
  value: number | string
  delta?: number
  icon: React.ReactNode
  sparkline?: Array<{ x: string; y: number }>
}) {
  return (
    <div className="relative rounded-xl p-3.5 bg-gradient-to-br from-dark-800/50 to-dark-900/30 backdrop-blur-xl border border-dark-700/30 hover:border-dark-700/60 transition">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 text-gray-500">
          {icon}
          <span className="text-[11px] uppercase tracking-wider font-medium">{label}</span>
        </div>
        {typeof delta === 'number' && <DeltaPill delta={delta} mini />}
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="text-xl font-display font-bold text-white leading-none">{value}</p>
        {sparkline && sparkline.length > 1 && (
          <div className="w-20 h-7">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparkline}>
                <Area type="monotone" dataKey="y" stroke="#F2911D" strokeWidth={1.3} fill="rgba(242,145,29,0.15)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}

function DeltaPill({ delta, mini }: { delta: number; mini?: boolean }) {
  const isUp = delta > 0
  const isZero = delta === 0
  const color = isZero
    ? 'text-gray-400 bg-dark-700/40 border-dark-600/40'
    : isUp
      ? 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30'
      : 'text-rose-300 bg-rose-500/15 border-rose-500/30'
  const Icon = isUp ? TrendingUp : isZero ? null : TrendingDown
  const size = mini ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium border ${color} ${size}`}>
      {Icon && <Icon className={mini ? 'w-2.5 h-2.5' : 'w-3 h-3'} />}
      {Math.abs(delta)}%
    </span>
  )
}

function FunnelBar({ phase, widthPct }: { phase: any; widthPct: number }) {
  const stripe = phase.isWon
    ? 'from-emerald-500/80 to-emerald-600/40 border-emerald-500/40'
    : phase.isLost
      ? 'from-rose-500/70 to-rose-600/30 border-rose-500/30'
      : 'from-gold-500/70 to-gold-600/20 border-gold-500/30'
  const dot = phase.isWon ? 'bg-emerald-400' : phase.isLost ? 'bg-rose-400' : 'bg-gold-400'
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2 w-48 shrink-0">
        <span className={`w-2 h-2 rounded-full ${dot}`} />
        <span className="text-xs text-gray-300 truncate">{phase.name}</span>
      </div>
      <div className="flex-1 h-7 bg-dark-900/60 rounded-md overflow-hidden relative border border-dark-700/30">
        <div
          className={`h-full bg-gradient-to-r ${stripe} border-r transition-all duration-700 ease-out`}
          style={{ width: `${widthPct}%` }}
        />
        <span className="absolute inset-0 flex items-center px-2.5 text-[11px] text-white font-semibold drop-shadow">
          {phase.count}
        </span>
      </div>
    </div>
  )
}

function FechadoRow({ f }: { f: any }) {
  const ts = f.completedAt ? new Date(f.completedAt) : null
  const ago = ts ? timeAgo(ts) : '—'
  return (
    <div className="flex items-center gap-3 p-2.5 rounded-xl bg-dark-900/40 border border-dark-700/30 hover:border-emerald-500/30 hover:bg-emerald-500/5 transition">
      <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center flex-shrink-0">
        <ShieldCheck className="w-4 h-4 text-emerald-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-white truncate font-medium">{f.nome || f.title}</p>
        <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-0.5">
          <Clock className="w-2.5 h-2.5" /> {ago}
        </p>
      </div>
      <div className="text-right">
        <p className="text-sm font-display font-semibold text-emerald-300">
          {f.valor > 0 ? formatBRL(f.valor) : '—'}
        </p>
      </div>
    </div>
  )
}

function QuickLink({ icon, label, to, tint }: { icon: React.ReactNode; label: string; to: string; tint: Accent }) {
  const c = accentMap[tint]
  return (
    <Link
      to={to}
      className="group flex flex-col items-center gap-2 p-3 rounded-xl border border-dark-700/40 hover:border-gold-500/30 bg-dark-800/30 hover:bg-dark-700/40 transition-all"
    >
      <div className={`w-9 h-9 rounded-lg ${c.bg} ${c.text} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      <span className="text-[11px] font-medium text-gray-400 group-hover:text-white transition-colors">{label}</span>
    </Link>
  )
}

interface SourceRow {
  source: string
  leads: number
  qualified?: number
  converted: number
  conversionRate: number
}

function SourceConversionPanel({
  data,
  totals,
  isLoading,
  periodLabel,
}: {
  data: SourceRow[]
  totals: { leads: number; converted: number; revenue: number }
  isLoading: boolean
  periodLabel: string
}) {
  if (isLoading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
        </div>
      </GlassCard>
    )
  }

  const hasData = data.length > 0 && totals.leads > 0
  const avgConversion = totals.leads > 0 ? (totals.converted / totals.leads) * 100 : 0

  const chartData = data.map((d) => ({
    name: sourceLabel(d.source),
    sourceKey: d.source,
    Recebidos: d.leads,
    Aprovados: d.converted,
    conversionRate: d.conversionRate,
    color: sourceColor(d.source),
  }))

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="w-4 h-4 text-gold-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Conversão por canal</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Leads recebidos × aprovados — periodo: <span className="text-gold-400">{periodLabel}</span>
            </p>
          </div>
        </div>
        <Link
          to="/analytics"
          className="text-xs text-gold-400 hover:text-gold-300 flex items-center gap-1 transition-colors"
        >
          Ver detalhado <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>

      {/* Mini KPIs de totais */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-dark-900/40 rounded-lg border border-dark-700/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Leads recebidos</p>
          <p className="text-2xl font-display font-bold text-white mt-1">{totals.leads}</p>
        </div>
        <div className="bg-dark-900/40 rounded-lg border border-emerald-500/20 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Aprovados</p>
          <p className="text-2xl font-display font-bold text-emerald-400 mt-1">{totals.converted}</p>
        </div>
        <div className="bg-dark-900/40 rounded-lg border border-gold-500/20 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Conversão média</p>
          <p className="text-2xl font-display font-bold text-gold-300 mt-1">
            {avgConversion.toFixed(1)}<span className="text-base text-gold-400/70">%</span>
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-10 text-sm text-gray-500">
          Sem leads no período. Quando começarem a chegar, você vai ver aqui de onde vêm e quanto cada canal converte.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Chart */}
          <div className="lg:col-span-3 bg-dark-900/30 rounded-xl border border-dark-700/40 p-4">
            <ResponsiveContainer width="100%" height={Math.max(260, chartData.length * 44 + 40)}>
              <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} stroke="#334155" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#CBD5E1' }}
                  stroke="#334155"
                  width={110}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid rgba(242,145,29,0.25)',
                    backgroundColor: 'rgba(11,17,32,0.95)',
                    backdropFilter: 'blur(16px)',
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string, item: any) => {
                    if (name === 'Aprovados') {
                      const rate = item?.payload?.conversionRate ?? 0
                      return [`${value} (${rate.toFixed(1)}%)`, name]
                    }
                    return [value, name]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar dataKey="Recebidos" radius={[0, 4, 4, 0]} barSize={14}>
                  {chartData.map((entry, i) => (
                    <Cell key={`r-${i}`} fill={entry.color} fillOpacity={0.4} />
                  ))}
                </Bar>
                <Bar dataKey="Aprovados" radius={[0, 4, 4, 0]} barSize={14}>
                  {chartData.map((entry, i) => (
                    <Cell key={`a-${i}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela */}
          <div className="lg:col-span-2 bg-dark-900/30 rounded-xl border border-dark-700/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-700/40 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Detalhamento</h4>
              <span className="text-[10px] text-gray-500">{data.length} canais</span>
            </div>
            <div className="divide-y divide-dark-700/40">
              {data.map((row) => {
                const color = sourceColor(row.source)
                return (
                  <div key={row.source} className="px-4 py-2.5 hover:bg-dark-800/30 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="text-sm text-gray-200 truncate">{sourceLabel(row.source)}</span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="text-xs text-gray-400 tabular-nums">{row.leads}</span>
                        <span className="text-xs text-emerald-400 tabular-nums">→ {row.converted}</span>
                        <span
                          className={`text-xs font-medium tabular-nums w-12 text-right ${
                            row.conversionRate >= avgConversion
                              ? 'text-emerald-300'
                              : 'text-gray-500'
                          }`}
                        >
                          {row.conversionRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

interface StateRow {
  uf: string
  estado: string
  leads: number
  aprovados: number
  conversao: number
}

function StateConversionPanel({
  data,
  totals,
  isLoading,
  periodLabel,
}: {
  data: StateRow[]
  totals: { leads: number; aprovados: number }
  isLoading: boolean
  periodLabel: string
}) {
  if (isLoading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
        </div>
      </GlassCard>
    )
  }

  const hasData = data.length > 0 && totals.leads > 0
  const avgConversion = totals.leads > 0 ? (totals.aprovados / totals.leads) * 100 : 0
  const top10 = data.slice(0, 10)
  const topUF = data[0]
  const topAprovados = [...data].sort((a, b) => b.aprovados - a.aprovados)[0]

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Conversão por estado</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Origem geográfica via DDD do telefone — periodo: <span className="text-gold-400">{periodLabel}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Mini KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <div className="bg-dark-900/40 rounded-lg border border-dark-700/50 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Estado com mais leads</p>
          <p className="text-lg font-display font-bold text-white mt-1 truncate">
            {topUF ? `${topUF.estado} (${topUF.leads})` : '—'}
          </p>
        </div>
        <div className="bg-dark-900/40 rounded-lg border border-emerald-500/20 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Estado com mais fechamentos</p>
          <p className="text-lg font-display font-bold text-emerald-400 mt-1 truncate">
            {topAprovados && topAprovados.aprovados > 0
              ? `${topAprovados.estado} (${topAprovados.aprovados})`
              : '—'}
          </p>
        </div>
        <div className="bg-dark-900/40 rounded-lg border border-gold-500/20 p-3">
          <p className="text-[11px] uppercase tracking-wider text-gray-500">Estados ativos</p>
          <p className="text-lg font-display font-bold text-gold-300 mt-1">
            {data.filter((d) => d.uf !== 'desconhecido').length}
          </p>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-10 text-sm text-gray-500">
          Sem leads no período pra mapear por estado.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Chart */}
          <div className="lg:col-span-3 bg-dark-900/30 rounded-xl border border-dark-700/40 p-4">
            <ResponsiveContainer width="100%" height={Math.max(280, top10.length * 38 + 40)}>
              <BarChart
                data={top10.map((d) => ({
                  name: d.uf,
                  estado: d.estado,
                  Leads: d.leads,
                  Aprovados: d.aprovados,
                  conversao: d.conversao,
                }))}
                layout="vertical"
                margin={{ top: 8, right: 24, bottom: 8, left: 12 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#1F2937" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: '#94A3B8' }} stroke="#334155" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 12, fill: '#CBD5E1', fontWeight: 600 }}
                  stroke="#334155"
                  width={50}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    borderRadius: 8,
                    border: '1px solid rgba(16,185,129,0.25)',
                    backgroundColor: 'rgba(11,17,32,0.95)',
                    backdropFilter: 'blur(16px)',
                    fontSize: 12,
                  }}
                  labelFormatter={(uf: string, payload: any[]) =>
                    payload?.[0]?.payload?.estado || uf
                  }
                  formatter={(value: number, name: string, item: any) => {
                    if (name === 'Aprovados') {
                      const conv = item?.payload?.conversao ?? 0
                      return [`${value} (${conv.toFixed(1)}%)`, name]
                    }
                    return [value, name]
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="circle" />
                <Bar dataKey="Leads" fill="#445DA8" radius={[0, 4, 4, 0]} barSize={12} />
                <Bar dataKey="Aprovados" fill="#10B981" radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Tabela */}
          <div className="lg:col-span-2 bg-dark-900/30 rounded-xl border border-dark-700/40 overflow-hidden">
            <div className="px-4 py-3 border-b border-dark-700/40 flex items-center justify-between">
              <h4 className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Top {top10.length}</h4>
              <span className="text-[10px] text-gray-500">{data.length} estados</span>
            </div>
            <div className="divide-y divide-dark-700/40 max-h-[360px] overflow-y-auto">
              {top10.map((row) => (
                <div key={row.uf} className="px-4 py-2.5 hover:bg-dark-800/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[11px] font-mono font-semibold text-gold-400 w-7">
                        {row.uf}
                      </span>
                      <span className="text-xs text-gray-300 truncate">{row.estado}</span>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-xs text-gray-400 tabular-nums">{row.leads}</span>
                      <span className="text-xs text-emerald-400 tabular-nums">→ {row.aprovados}</span>
                      <span
                        className={`text-xs font-medium tabular-nums w-12 text-right ${
                          row.conversao >= avgConversion ? 'text-emerald-300' : 'text-gray-500'
                        }`}
                      >
                        {row.conversao.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </GlassCard>
  )
}

interface VehicleTypeRow {
  tipo: 'carro' | 'moto' | 'indefinido'
  label: string
  leads: number
  aprovados: number
  conversao: number
}

function VehicleTypeConversionPanel({
  data,
  totals,
  isLoading,
  periodLabel,
}: {
  data: VehicleTypeRow[]
  totals: { leads: number; aprovados: number }
  isLoading: boolean
  periodLabel: string
}) {
  if (isLoading) {
    return (
      <GlassCard>
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
        </div>
      </GlassCard>
    )
  }

  const carro = data.find((d) => d.tipo === 'carro') ?? { tipo: 'carro' as const, label: 'Carro', leads: 0, aprovados: 0, conversao: 0 }
  const moto = data.find((d) => d.tipo === 'moto') ?? { tipo: 'moto' as const, label: 'Moto', leads: 0, aprovados: 0, conversao: 0 }
  const indefinido = data.find((d) => d.tipo === 'indefinido') ?? { tipo: 'indefinido' as const, label: 'Indefinido', leads: 0, aprovados: 0, conversao: 0 }

  const hasData = totals.leads > 0
  const classifiedTotal = carro.leads + moto.leads
  const pctCarro = classifiedTotal > 0 ? (carro.leads / classifiedTotal) * 100 : 0
  const pctMoto = classifiedTotal > 0 ? (moto.leads / classifiedTotal) * 100 : 0

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Car className="w-4 h-4 text-blue-400" />
          <div>
            <h3 className="text-sm font-semibold text-white">Carro vs Moto</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Tipo de veículo inferido da marca/modelo — periodo: <span className="text-gold-400">{periodLabel}</span>
            </p>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="text-center py-10 text-sm text-gray-500">Sem leads no período.</div>
      ) : (
        <div className="space-y-4">
          {/* Barra horizontal stack — proporcao visual */}
          {classifiedTotal > 0 && (
            <div className="bg-dark-900/40 rounded-xl border border-dark-700/40 p-4">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                <span>{classifiedTotal} leads classificados</span>
                <span>
                  {pctCarro.toFixed(0)}% carro · {pctMoto.toFixed(0)}% moto
                </span>
              </div>
              <div className="h-3 w-full bg-dark-800 rounded-full overflow-hidden flex">
                <div
                  className="bg-gradient-to-r from-blue-500 to-blue-400 flex items-center justify-end px-2"
                  style={{ width: `${pctCarro}%` }}
                >
                  {pctCarro >= 15 && (
                    <span className="text-[10px] font-semibold text-white">{carro.leads}</span>
                  )}
                </div>
                <div
                  className="bg-gradient-to-r from-orange-500 to-orange-400 flex items-center justify-end px-2"
                  style={{ width: `${pctMoto}%` }}
                >
                  {pctMoto >= 15 && (
                    <span className="text-[10px] font-semibold text-white">{moto.leads}</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Cards: Carro / Moto / Indefinido */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TypeCard
              icon={<Car className="w-5 h-5" />}
              label="Carro"
              leads={carro.leads}
              aprovados={carro.aprovados}
              conversao={carro.conversao}
              accent="blue"
            />
            <TypeCard
              icon={<Bike className="w-5 h-5" />}
              label="Moto"
              leads={moto.leads}
              aprovados={moto.aprovados}
              conversao={moto.conversao}
              accent="orange"
            />
            <TypeCard
              icon={<Clock className="w-5 h-5" />}
              label="Indefinido"
              leads={indefinido.leads}
              aprovados={indefinido.aprovados}
              conversao={indefinido.conversao}
              accent="gray"
              hint="Sem marca/modelo preenchido"
            />
          </div>

          {indefinido.leads > 0 && indefinido.leads >= totals.leads * 0.3 && (
            <p className="text-[11px] text-gray-500 text-center">
              ⚠ {indefinido.leads} leads ({Math.round((indefinido.leads / totals.leads) * 100)}%) sem marca/modelo preenchido.
              Pra classificação ficar mais precisa, o formulário do site precisa capturar essa info.
            </p>
          )}
        </div>
      )}
    </GlassCard>
  )
}

function TypeCard({
  icon, label, leads, aprovados, conversao, accent, hint,
}: {
  icon: React.ReactNode
  label: string
  leads: number
  aprovados: number
  conversao: number
  accent: 'blue' | 'orange' | 'gray'
  hint?: string
}) {
  const colors = {
    blue: { border: 'border-blue-500/30', text: 'text-blue-300', icon: 'text-blue-400', bg: 'bg-blue-500/10' },
    orange: { border: 'border-orange-500/30', text: 'text-orange-300', icon: 'text-orange-400', bg: 'bg-orange-500/10' },
    gray: { border: 'border-dark-700/50', text: 'text-gray-400', icon: 'text-gray-500', bg: 'bg-dark-800/40' },
  }[accent]

  return (
    <div className={`bg-dark-900/40 rounded-xl border ${colors.border} p-4 relative overflow-hidden`}>
      <div className={`absolute -top-4 -right-4 w-16 h-16 rounded-full ${colors.bg} opacity-50 blur-2xl`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-3">
          <div className={`w-9 h-9 rounded-lg ${colors.bg} border ${colors.border} flex items-center justify-center ${colors.icon}`}>
            {icon}
          </div>
          <span className={`text-[11px] uppercase tracking-wider ${colors.text} font-semibold`}>
            {label}
          </span>
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-500">Leads</p>
            <p className="text-xl font-display font-bold text-white">{leads}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dark-700/40">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Aprovados</p>
              <p className={`text-sm font-semibold ${colors.text}`}>{aprovados}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-gray-500">Conversão</p>
              <p className={`text-sm font-semibold ${colors.text}`}>{conversao.toFixed(1)}%</p>
            </div>
          </div>
          {hint && <p className="text-[10px] text-gray-600 pt-1">{hint}</p>}
        </div>
      </div>
    </div>
  )
}

function TopOrigemMini({
  sources,
  loading,
}: {
  sources: Array<{ source: string; leads: number; converted: number }>
  loading: boolean
}) {
  if (loading) {
    return (
      <div className="bg-dark-800/60 backdrop-blur-xl border border-dark-700/40 rounded-xl p-3.5 flex items-center justify-center min-h-[88px]">
        <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />
      </div>
    )
  }

  // Agrupa origens "desconhecidas/outras" num bucket Outro
  const OUTRO_BUCKET = new Set(['desconhecido', 'outro', 'manual', 'whatsapp_import'])
  const ranked: Array<{ source: string; leads: number; converted: number }> = []
  let outroLeads = 0
  let outroConv = 0
  for (const s of sources) {
    if (OUTRO_BUCKET.has(s.source)) {
      outroLeads += s.leads
      outroConv += s.converted
    } else {
      ranked.push(s)
    }
  }
  ranked.sort((a, b) => b.leads - a.leads)
  if (outroLeads > 0) {
    ranked.push({ source: 'outro', leads: outroLeads, converted: outroConv })
  }

  const total = ranked.reduce((s, r) => s + r.leads, 0)
  const top = ranked.slice(0, 3)
  const restoCount = ranked.slice(3).reduce((s, r) => s + r.leads, 0)

  if (total === 0) {
    return (
      <div className="bg-dark-800/60 backdrop-blur-xl border border-dark-700/40 rounded-xl p-3.5 min-h-[88px] flex flex-col justify-center">
        <div className="flex items-center gap-1.5 text-gray-500 mb-1">
          <Megaphone className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-wider">Origem dos leads</span>
        </div>
        <p className="text-xs text-gray-500">Nenhum lead no periodo</p>
      </div>
    )
  }

  const first = top[0]
  const firstMeta = SOURCE_META[first.source] ?? { label: first.source, color: '#94A3B8' }

  return (
    <div className="bg-dark-800/60 backdrop-blur-xl border border-dark-700/40 rounded-xl p-3.5 min-h-[88px] flex flex-col justify-between">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-1.5 text-gray-500">
          <Megaphone className="w-4 h-4" />
          <span className="text-[10px] uppercase tracking-wider">Origem dos leads</span>
        </div>
        <span className="text-[10px] text-gray-600 tabular-nums">{total} total</span>
      </div>

      {/* Top 1 em destaque */}
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className="text-lg font-display font-bold tabular-nums"
          style={{ color: firstMeta.color }}
        >
          {first.leads}
        </span>
        <span className="text-sm font-semibold text-white truncate">{firstMeta.label}</span>
        <span className="text-[10px] text-gray-500 tabular-nums ml-auto">
          {Math.round((first.leads / total) * 100)}%
        </span>
      </div>

      {/* Top 2 e 3 + Outros */}
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {top.slice(1).map((s) => {
          const m = SOURCE_META[s.source] ?? { label: s.source, color: '#94A3B8' }
          return (
            <span
              key={s.source}
              className="inline-flex items-center gap-1 text-gray-400"
              title={`${s.leads} leads`}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: m.color }}
              />
              {m.label} {s.leads}
            </span>
          )
        })}
        {restoCount > 0 && (
          <span className="text-gray-500">+{restoCount} outros</span>
        )}
      </div>
    </div>
  )
}

function FunnelActivityStrip({ kpis }: { kpis: any }) {
  const stages = [
    {
      key: 'entradas',
      label: 'Entradas',
      hint: 'no período',
      value: kpis.entradasPeriodo,
      delta: kpis.entradasDelta,
      icon: <Sparkles className="w-4 h-4" />,
      accent: 'gold' as const,
    },
    {
      key: 'atendendo',
      label: 'Atendendo',
      hint: 'agora',
      value: kpis.emAtendimento,
      icon: <MessageSquare className="w-4 h-4" />,
      accent: 'blue' as const,
    },
    {
      key: 'negociando',
      label: 'Negociando',
      hint: 'agora',
      value: kpis.emNegociacao,
      icon: <Handshake className="w-4 h-4" />,
      accent: 'purple' as const,
    },
    {
      key: 'linkVistoria',
      label: 'Link vistoria',
      hint: 'enviado',
      value: kpis.linksVistoria,
      icon: <ArrowUpRight className="w-4 h-4" />,
      accent: 'cyan' as const,
    },
    {
      key: 'aguardando',
      label: 'Aguardando aprov.',
      hint: 'pra fechar',
      value: kpis.aguardandoAprovacao,
      icon: <Clock className="w-4 h-4" />,
      accent: 'amber' as const,
    },
    {
      key: 'aprovados',
      label: 'Aprovados',
      hint: 'no período',
      value: kpis.fechadosPeriodo,
      delta: kpis.fechadosDelta,
      icon: <ShieldCheck className="w-4 h-4" />,
      accent: 'emerald' as const,
    },
    {
      key: 'reprovados',
      label: 'Reprovados',
      hint: 'no período',
      value: kpis.reprovadosPeriodo,
      icon: <TrendingDown className="w-4 h-4" />,
      accent: 'rose' as const,
    },
  ]

  return (
    <GlassCard>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Atividade do funil</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            O que está rolando agora + o que aconteceu no período
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-gray-500">Prestes a fechar</p>
          <p className="text-lg font-display font-bold text-gold-300">{kpis.prestesAFechar}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
        {stages.map(({ key, ...rest }) => (
          <FunnelStageCard key={key} {...rest} />
        ))}
      </div>
    </GlassCard>
  )
}

function FunnelStageCard({
  label,
  hint,
  value,
  delta,
  icon,
  accent,
}: {
  label: string
  hint: string
  value: number
  delta?: number
  icon: React.ReactNode
  accent: 'gold' | 'blue' | 'purple' | 'cyan' | 'amber' | 'emerald' | 'rose'
}) {
  const colors = {
    gold: { text: 'text-gold-300', icon: 'text-gold-400', border: 'border-gold-500/25', bg: 'bg-gold-500/5' },
    blue: { text: 'text-blue-300', icon: 'text-blue-400', border: 'border-blue-500/25', bg: 'bg-blue-500/5' },
    purple: { text: 'text-purple-300', icon: 'text-purple-400', border: 'border-purple-500/25', bg: 'bg-purple-500/5' },
    cyan: { text: 'text-cyan-300', icon: 'text-cyan-400', border: 'border-cyan-500/25', bg: 'bg-cyan-500/5' },
    amber: { text: 'text-amber-300', icon: 'text-amber-400', border: 'border-amber-500/25', bg: 'bg-amber-500/5' },
    emerald: { text: 'text-emerald-300', icon: 'text-emerald-400', border: 'border-emerald-500/25', bg: 'bg-emerald-500/5' },
    rose: { text: 'text-rose-300', icon: 'text-rose-400', border: 'border-rose-500/25', bg: 'bg-rose-500/5' },
  }[accent]

  return (
    <div className={`relative bg-dark-900/40 rounded-lg border ${colors.border} ${colors.bg} p-2.5 hover:bg-dark-800/40 transition-colors`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={colors.icon}>{icon}</span>
        {delta !== undefined && delta !== 0 && (
          <span
            className={`text-[9px] font-semibold tabular-nums ${
              delta > 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {delta > 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>
      <p className={`text-2xl font-display font-bold ${colors.text} leading-none`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-gray-400 mt-1 truncate">{label}</p>
      <p className="text-[9px] text-gray-600">{hint}</p>
    </div>
  )
}

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}min atras`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h atras`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d atras`
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })
}
