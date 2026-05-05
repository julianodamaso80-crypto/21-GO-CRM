import { useMemo } from 'react'
import { Sunrise, AlertTriangle, CheckCircle2, Inbox } from 'lucide-react'
import { format, isPast, isToday, addDays, isSameDay } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TaskCard } from './TaskCard'
import type { Task } from '../../services/tasks.service'

interface Props {
  tasks: Task[]
  onEdit: (task: Task) => void
  onCreateAtTime?: (date: Date) => void
}

export function HojeView({ tasks, onEdit, onCreateAtTime }: Props) {
  const today = new Date()
  const tomorrow = addDays(today, 1)

  const { overdue, todayTasks, tomorrowTasks, doneToday } = useMemo(() => {
    const overdue: Task[] = []
    const todayPending: Task[] = []
    const tomorrowPending: Task[] = []
    const completedToday: Task[] = []

    for (const t of tasks) {
      const due = new Date(t.dueAt)
      if (t.status === 'concluida') {
        if (t.completedAt && isToday(new Date(t.completedAt))) completedToday.push(t)
        continue
      }
      if (t.status === 'cancelada') continue
      if (isPast(due) && !isToday(due)) overdue.push(t)
      else if (isToday(due)) todayPending.push(t)
      else if (isSameDay(due, tomorrow)) tomorrowPending.push(t)
    }

    overdue.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    todayPending.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
    tomorrowPending.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())

    return {
      overdue,
      todayTasks: todayPending,
      tomorrowTasks: tomorrowPending,
      doneToday: completedToday,
    }
  }, [tasks, tomorrow])

  // Timeline 7h–22h
  const timelineHours = Array.from({ length: 16 }, (_, i) => i + 7)
  const tasksAtHour = (h: number) => todayTasks.filter((t) => new Date(t.dueAt).getHours() === h)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
      {/* Coluna 1 — Timeline */}
      <div className="card p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center">
            <Sunrise className="w-4 h-4 text-gold-400" />
          </div>
          <div>
            <h3 className="text-sm font-display font-semibold text-white capitalize">
              {format(today, "EEEE, d 'de' MMMM", { locale: ptBR })}
            </h3>
            <p className="text-[11px] text-gray-500">Sua agenda do dia</p>
          </div>
        </div>

        <div className="space-y-px max-h-[calc(100vh-300px)] overflow-y-auto pr-1 scrollbar-hide">
          {timelineHours.map((h) => {
            const hourTasks = tasksAtHour(h)
            const slotDate = new Date(today)
            slotDate.setHours(h, 0, 0, 0)
            return (
              <div key={h} className="group flex gap-3 min-h-[52px] py-1 border-t border-dark-700/20">
                {/* Hora */}
                <div className="flex-shrink-0 w-12 pt-1">
                  <span className="text-[11px] font-mono text-gray-500">
                    {String(h).padStart(2, '0')}:00
                  </span>
                </div>

                {/* Slot */}
                <div className="flex-1 min-h-[40px]">
                  {hourTasks.length === 0 ? (
                    <button
                      onClick={() => onCreateAtTime?.(slotDate)}
                      className="w-full h-10 rounded-lg border border-dashed border-dark-700/40 hover:border-gold-500/40 hover:bg-gold-500/5 transition opacity-0 group-hover:opacity-100 text-[11px] text-gray-600 hover:text-gold-400"
                    >
                      + adicionar
                    </button>
                  ) : (
                    <div className="space-y-1.5">
                      {hourTasks.map((t) => (
                        <TaskCard key={t.id} task={t} onEdit={onEdit} compact />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Coluna 2 — Lista priorizada */}
      <div className="space-y-4">
        {/* Atrasadas */}
        {overdue.length > 0 && (
          <div className="card p-4 border-red-500/20">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <h3 className="text-sm font-semibold text-red-400">Atrasadas</h3>
              <span className="text-[10px] font-medium text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full">
                {overdue.length}
              </span>
            </div>
            <div className="space-y-2">
              {overdue.map((t) => (
                <TaskCard key={t.id} task={t} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}

        {/* Hoje (lista) */}
        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Inbox className="w-4 h-4 text-gold-400" />
            <h3 className="text-sm font-semibold text-white">Hoje</h3>
            <span className="text-[10px] font-medium text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded-full">
              {todayTasks.length}
            </span>
          </div>
          {todayTasks.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400">Nenhuma tarefa pra hoje</p>
              <p className="text-xs text-gray-600 mt-1">Aproveita pra prospectar 🎯</p>
            </div>
          ) : (
            <div className="space-y-2">
              {todayTasks.map((t) => (
                <TaskCard key={t.id} task={t} onEdit={onEdit} />
              ))}
            </div>
          )}
        </div>

        {/* Amanhã */}
        {tomorrowTasks.length > 0 && (
          <div className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sunrise className="w-4 h-4 text-blue-400" />
              <h3 className="text-sm font-semibold text-white">Amanhã</h3>
              <span className="text-[10px] font-medium text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                {tomorrowTasks.length}
              </span>
            </div>
            <div className="space-y-2">
              {tomorrowTasks.map((t) => (
                <TaskCard key={t.id} task={t} onEdit={onEdit} />
              ))}
            </div>
          </div>
        )}

        {/* Concluídas hoje */}
        {doneToday.length > 0 && (
          <div className="card p-4 opacity-80">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-emerald-400">Concluídas hoje</h3>
              <span className="text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                {doneToday.length}
              </span>
            </div>
            <div className="space-y-2">
              {doneToday.map((t) => (
                <TaskCard key={t.id} task={t} onEdit={onEdit} compact />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
