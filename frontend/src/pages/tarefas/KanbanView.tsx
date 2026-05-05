import { useMemo, useState } from 'react'
import { AlertTriangle, Calendar, CalendarDays, Hourglass } from 'lucide-react'
import { isPast, isToday, isThisWeek, addDays } from 'date-fns'
import { TaskCard } from './TaskCard'
import { useUpdateTask } from '../../hooks/useTasks'
import type { Task } from '../../services/tasks.service'

interface Props {
  tasks: Task[]
  onEdit: (task: Task) => void
}

type ColumnId = 'overdue' | 'today' | 'week' | 'later'

const COLUMNS: Array<{
  id: ColumnId
  label: string
  description: string
  icon: any
  color: string
  bg: string
  border: string
}> = [
  {
    id: 'overdue',
    label: 'Atrasadas',
    description: 'Vencidas, sem ação',
    icon: AlertTriangle,
    color: 'text-red-400',
    bg: 'bg-red-500/5',
    border: 'border-red-500/30',
  },
  {
    id: 'today',
    label: 'Hoje',
    description: 'Próximas 24h',
    icon: Hourglass,
    color: 'text-gold-400',
    bg: 'bg-gold-500/5',
    border: 'border-gold-500/30',
  },
  {
    id: 'week',
    label: 'Esta semana',
    description: 'Até domingo',
    icon: Calendar,
    color: 'text-blue-400',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/30',
  },
  {
    id: 'later',
    label: 'Próximas',
    description: 'Daqui 8 a 30 dias',
    icon: CalendarDays,
    color: 'text-purple-400',
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/30',
  },
]

function classifyTask(task: Task): ColumnId {
  const due = new Date(task.dueAt)
  if (task.status === 'pendente' && isPast(due) && !isToday(due)) return 'overdue'
  if (isToday(due)) return 'today'
  if (isThisWeek(due, { weekStartsOn: 1 })) return 'week'
  return 'later'
}

export function KanbanView({ tasks, onEdit }: Props) {
  const updateMutation = useUpdateTask()
  const [hoverColumn, setHoverColumn] = useState<ColumnId | null>(null)

  const grouped = useMemo(() => {
    const map: Record<ColumnId, Task[]> = { overdue: [], today: [], week: [], later: [] }
    for (const t of tasks) {
      if (t.status === 'concluida') continue
      const col = classifyTask(t)
      map[col].push(t)
    }
    return map
  }, [tasks])

  const moveToColumn = (taskId: string, target: ColumnId) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const current = classifyTask(task)
    if (current === target) return

    const now = new Date()
    let newDue: Date
    if (target === 'today') {
      newDue = new Date(now); newDue.setHours(now.getHours() + 1, 0, 0, 0)
    } else if (target === 'week') {
      // próxima quarta às 10h
      const days = (3 - now.getDay() + 7) % 7 || 7
      newDue = addDays(now, days); newDue.setHours(10, 0, 0, 0)
    } else if (target === 'later') {
      newDue = addDays(now, 14); newDue.setHours(10, 0, 0, 0)
    } else {
      // overdue não faz sentido reagendar manualmente — ignora
      return
    }

    updateMutation.mutate({ id: taskId, data: { dueAt: newDue.toISOString() } })
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {COLUMNS.map((col) => {
        const Icon = col.icon
        const items = grouped[col.id]
        const isHovered = hoverColumn === col.id
        return (
          <div
            key={col.id}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (hoverColumn !== col.id) setHoverColumn(col.id)
            }}
            onDragLeave={() => setHoverColumn(null)}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain')
              setHoverColumn(null)
              if (id) moveToColumn(id, col.id)
            }}
            className={`rounded-2xl border ${col.border} ${col.bg} p-3 min-h-[300px] transition-all ${
              isHovered ? 'ring-2 ring-gold-500/40 bg-dark-800/40' : ''
            }`}
          >
            {/* Header da coluna */}
            <div className="flex items-center gap-2 px-2 pb-3 border-b border-dark-700/30 mb-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${col.bg} ${col.color}`}>
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`text-sm font-semibold ${col.color}`}>{col.label}</h3>
                <p className="text-[10px] text-gray-500 mt-0.5">{col.description}</p>
              </div>
              <span className="text-xs font-medium text-gray-400 bg-dark-800/60 px-2 py-0.5 rounded-full">
                {items.length}
              </span>
            </div>

            {/* Cards */}
            <div className="space-y-2 max-h-[calc(100vh-360px)] overflow-y-auto pr-1 scrollbar-hide">
              {items.length === 0 ? (
                <div className="text-center py-6 text-xs text-gray-600">
                  Nenhuma tarefa
                </div>
              ) : (
                items.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onEdit={onEdit}
                    draggable
                    onDragEnd={() => setHoverColumn(null)}
                  />
                ))
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
