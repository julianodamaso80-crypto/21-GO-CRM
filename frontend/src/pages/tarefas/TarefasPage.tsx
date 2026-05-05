import { useMemo, useState } from 'react'
import {
  Plus, Loader2, ListChecks, CalendarDays, LayoutGrid, Sunrise,
  Clock, AlertTriangle, CheckCircle2, Filter, X,
} from 'lucide-react'
import { isPast, isToday } from 'date-fns'
import { useTasks } from '../../hooks/useTasks'
import { useAuthStore } from '../../store/auth-store'
import { HojeView } from './HojeView'
import { CalendarView } from './CalendarView'
import { KanbanView } from './KanbanView'
import { TaskFormDrawer } from './TaskFormDrawer'
import type { Task, TaskType, TaskPriority } from '../../services/tasks.service'

type View = 'hoje' | 'calendario' | 'kanban'

const VIEWS: Array<{ id: View; label: string; icon: any }> = [
  { id: 'hoje',        label: 'Hoje',       icon: Sunrise },
  { id: 'calendario',  label: 'Calendário', icon: CalendarDays },
  { id: 'kanban',      label: 'Kanban',     icon: LayoutGrid },
]

const TYPE_FILTER_OPTIONS: Array<{ value: TaskType; label: string }> = [
  { value: 'ligacao',   label: 'Ligação' },
  { value: 'whatsapp',  label: 'WhatsApp' },
  { value: 'reuniao',   label: 'Reunião' },
  { value: 'visita',    label: 'Visita' },
  { value: 'follow_up', label: 'Follow-up' },
  { value: 'email',     label: 'E-mail' },
  { value: 'tarefa',    label: 'Tarefa' },
]

export function TarefasPage() {
  const user = useAuthStore((s) => s.user)
  const isVendedor = user?.role?.name === 'vendedor'

  const [view, setView] = useState<View>('hoje')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultDueAt, setDefaultDueAt] = useState<string | undefined>(undefined)
  const [showFilters, setShowFilters] = useState(false)
  const [periodFilter, setPeriodFilter] = useState<'7d' | '30d' | 'month' | undefined>(undefined)
  const [typeFilter, setTypeFilter] = useState<TaskType | undefined>(undefined)
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | undefined>(undefined)
  const [showCompleted, setShowCompleted] = useState(false)

  const { data, isLoading } = useTasks({
    period: periodFilter,
    type: typeFilter,
    priority: priorityFilter,
    scope: isVendedor ? 'mine' : 'all',
  })
  const tasks = useMemo(() => {
    const all = data?.data || []
    return showCompleted ? all : all.filter((t) => t.status !== 'cancelada')
  }, [data, showCompleted])

  const stats = useMemo(() => {
    let overdue = 0
    let today = 0
    let upcoming = 0
    let done = 0
    for (const t of tasks) {
      if (t.status === 'concluida') { done++; continue }
      if (t.status === 'cancelada') continue
      const due = new Date(t.dueAt)
      if (isPast(due) && !isToday(due)) overdue++
      else if (isToday(due)) today++
      else upcoming++
    }
    return { overdue, today, upcoming, done }
  }, [tasks])

  const openCreate = (date?: Date) => {
    setEditingTask(null)
    setDefaultDueAt(date ? date.toISOString() : undefined)
    setDrawerOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setDefaultDueAt(undefined)
    setDrawerOpen(true)
  }

  const closeDrawer = () => {
    setDrawerOpen(false)
    setEditingTask(null)
    setDefaultDueAt(undefined)
  }

  const hasActiveFilters = periodFilter || typeFilter || priorityFilter
  const clearFilters = () => {
    setPeriodFilter(undefined)
    setTypeFilter(undefined)
    setPriorityFilter(undefined)
  }

  return (
    <div className="p-6 space-y-5 page-enter">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Tarefas</h1>
          <p className="text-sm text-gray-400 mt-1">
            Sua agenda de atividades — ligações, follow-ups, reuniões
          </p>
        </div>
        <button
          onClick={() => openCreate()}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Nova tarefa
        </button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          icon={<AlertTriangle className="w-4 h-4 text-red-400" />}
          label="Atrasadas"
          value={stats.overdue}
          accent="border-red-500/20 bg-red-500/5"
          highlight={stats.overdue > 0}
        />
        <StatCard
          icon={<Clock className="w-4 h-4 text-gold-400" />}
          label="Hoje"
          value={stats.today}
          accent="border-gold-500/20 bg-gold-500/5"
          highlight={stats.today > 0}
        />
        <StatCard
          icon={<CalendarDays className="w-4 h-4 text-blue-400" />}
          label="Próximas"
          value={stats.upcoming}
          accent="border-blue-500/20 bg-blue-500/5"
        />
        <StatCard
          icon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          label="Concluídas"
          value={stats.done}
          accent="border-emerald-500/20 bg-emerald-500/5"
        />
      </div>

      {/* Tabs + Filtros */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {/* Tabs */}
        <div className="inline-flex bg-dark-800/60 border border-dark-700/40 rounded-xl p-1">
          {VIEWS.map((v) => {
            const Icon = v.icon
            const active = view === v.id
            return (
              <button
                key={v.id}
                onClick={() => setView(v.id)}
                className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  active
                    ? 'bg-gold-500/15 text-gold-400 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {v.label}
              </button>
            )
          })}
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              showFilters || hasActiveFilters
                ? 'bg-gold-500/10 text-gold-400 border-gold-500/30'
                : 'border-dark-700/40 text-gray-400 hover:text-gray-200 hover:bg-dark-800/40'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filtros {hasActiveFilters && `(${[periodFilter, typeFilter, priorityFilter].filter(Boolean).length})`}
          </button>

          <label className="inline-flex items-center gap-2 text-xs text-gray-400 px-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showCompleted}
              onChange={(e) => setShowCompleted(e.target.checked)}
              className="rounded bg-dark-800 border-dark-600 text-gold-500 focus:ring-gold-500"
            />
            mostrar concluídas
          </label>
        </div>
      </div>

      {/* Painel de filtros */}
      {showFilters && (
        <div className="card p-4 space-y-3 animate-fade-in-down">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Período
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { v: undefined, l: 'Todos' },
                  { v: '7d' as const, l: '7 dias' },
                  { v: '30d' as const, l: '30 dias' },
                  { v: 'month' as const, l: 'Este mês' },
                ]).map((opt) => (
                  <button
                    key={String(opt.v)}
                    onClick={() => setPeriodFilter(opt.v as any)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      periodFilter === opt.v
                        ? 'bg-gold-500/15 text-gold-400 border-gold-500/40'
                        : 'border-dark-700/40 text-gray-400 hover:bg-dark-800'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Tipo
              </label>
              <select
                value={typeFilter || ''}
                onChange={(e) => setTypeFilter((e.target.value || undefined) as any)}
                className="w-full input text-xs py-1.5"
              >
                <option value="">Todos os tipos</option>
                {TYPE_FILTER_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                Prioridade
              </label>
              <div className="flex gap-1.5">
                {([
                  { v: undefined, l: 'Todas' },
                  { v: 'alta' as const, l: 'Alta' },
                  { v: 'media' as const, l: 'Média' },
                  { v: 'baixa' as const, l: 'Baixa' },
                ]).map((opt) => (
                  <button
                    key={String(opt.v)}
                    onClick={() => setPriorityFilter(opt.v as any)}
                    className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition ${
                      priorityFilter === opt.v
                        ? 'bg-gold-500/15 text-gold-400 border-gold-500/40'
                        : 'border-dark-700/40 text-gray-400 hover:bg-dark-800'
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end pt-2 border-t border-dark-700/40">
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-gold-400"
              >
                <X className="w-3 h-3" /> limpar filtros
              </button>
            </div>
          )}
        </div>
      )}

      {/* Conteúdo da view */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <EmptyState onCreate={() => openCreate()} />
      ) : (
        <>
          {view === 'hoje' && (
            <HojeView tasks={tasks} onEdit={openEdit} onCreateAtTime={openCreate} />
          )}
          {view === 'calendario' && (
            <CalendarView tasks={tasks} onEdit={openEdit} onCreateAtDate={openCreate} />
          )}
          {view === 'kanban' && (
            <KanbanView tasks={tasks} onEdit={openEdit} />
          )}
        </>
      )}

      {/* Drawer */}
      {drawerOpen && (
        <TaskFormDrawer
          task={editingTask}
          defaultDueAt={defaultDueAt}
          onClose={closeDrawer}
        />
      )}
    </div>
  )
}

// === Sub-components ===

function StatCard({
  icon, label, value, accent, highlight = false,
}: {
  icon: React.ReactNode
  label: string
  value: number
  accent: string
  highlight?: boolean
}) {
  return (
    <div className={`rounded-xl border p-3 transition-all ${accent} ${highlight ? 'shadow-glow-gold' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-dark-900/60 flex items-center justify-center flex-shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">{label}</p>
          <p className="text-xl font-bold text-white leading-tight">{value}</p>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="card p-12 text-center">
      <div className="w-16 h-16 mx-auto rounded-2xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mb-4">
        <ListChecks className="w-8 h-8 text-gold-400" />
      </div>
      <h3 className="text-lg font-display font-semibold text-white mb-2">
        Sua agenda está livre
      </h3>
      <p className="text-sm text-gray-400 max-w-md mx-auto mb-6">
        Crie tarefas pra acompanhar seus leads, agendar follow-ups e nunca perder uma oportunidade.
      </p>
      <button onClick={onCreate} className="btn-primary inline-flex items-center gap-2 text-sm">
        <Plus className="w-4 h-4" /> Criar primeira tarefa
      </button>
    </div>
  )
}
