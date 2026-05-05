import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Phone, MessageCircle, Video, MapPin, RotateCcw, Mail, CheckSquare } from 'lucide-react'
import {
  format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TASK_TYPE_META, type Task } from '../../services/tasks.service'
import { useUpdateTask } from '../../hooks/useTasks'

const ICON_MAP: Record<string, any> = {
  phone: Phone,
  'message-circle': MessageCircle,
  video: Video,
  'map-pin': MapPin,
  'rotate-ccw': RotateCcw,
  mail: Mail,
  'check-square': CheckSquare,
}

interface Props {
  tasks: Task[]
  onEdit: (task: Task) => void
  onCreateAtDate?: (date: Date) => void
}

export function CalendarView({ tasks, onEdit, onCreateAtDate }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date>(new Date())
  const [hoverDate, setHoverDate] = useState<Date | null>(null)
  const updateMutation = useUpdateTask()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days = eachDayOfInterval({ start: calStart, end: calEnd })

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      const key = format(new Date(t.dueAt), 'yyyy-MM-dd')
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    }
    return map
  }, [tasks])

  const tasksOfSelectedDay = tasksByDay.get(format(selectedDate, 'yyyy-MM-dd')) || []

  const handleDrop = (e: React.DragEvent, day: Date) => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    setHoverDate(null)
    if (!id) return

    const task = tasks.find((t) => t.id === id)
    if (!task) return
    const oldDue = new Date(task.dueAt)
    const newDue = new Date(day)
    newDue.setHours(oldDue.getHours(), oldDue.getMinutes(), 0, 0)
    updateMutation.mutate({ id, data: { dueAt: newDue.toISOString() } })
  }

  const weekdays = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4">
      {/* Grid do mês */}
      <div className="card p-5">
        {/* Header — navegação */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-lg font-display font-semibold text-white capitalize">
              {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">Arraste tarefas pra reagendar</p>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 text-gray-400 hover:text-gold-400 hover:bg-dark-700/40 rounded-lg transition"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => { setCurrentMonth(new Date()); setSelectedDate(new Date()) }}
              className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-gold-400 hover:bg-dark-700/40 rounded-lg transition"
            >
              Hoje
            </button>
            <button
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 text-gray-400 hover:text-gold-400 hover:bg-dark-700/40 rounded-lg transition"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Cabeçalho dos dias da semana */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekdays.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold text-gray-500 uppercase tracking-wider py-2">
              {d}
            </div>
          ))}
        </div>

        {/* Grid de dias */}
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd')
            const dayTasks = tasksByDay.get(key) || []
            const inMonth = isSameMonth(day, currentMonth)
            const isSelected = isSameDay(day, selectedDate)
            const isCurrentDay = isToday(day)
            const isHovered = hoverDate && isSameDay(hoverDate, day)
            const pendingCount = dayTasks.filter((t) => t.status === 'pendente').length
            const overdueCount = dayTasks.filter((t) => t.status === 'pendente' && new Date(t.dueAt) < new Date() && !isToday(new Date(t.dueAt))).length

            return (
              <button
                key={key}
                onClick={() => setSelectedDate(day)}
                onDoubleClick={() => onCreateAtDate?.(day)}
                onDragOver={(e) => { e.preventDefault(); if (!hoverDate || !isSameDay(hoverDate, day)) setHoverDate(day) }}
                onDragLeave={() => setHoverDate(null)}
                onDrop={(e) => handleDrop(e, day)}
                className={`group min-h-[88px] rounded-xl p-2 text-left transition-all border ${
                  !inMonth ? 'opacity-30' : ''
                } ${
                  isSelected
                    ? 'bg-gold-500/10 border-gold-500/40 shadow-glow-gold'
                    : isCurrentDay
                    ? 'bg-dark-800 border-gold-500/30'
                    : 'bg-dark-800/40 border-dark-700/30 hover:bg-dark-800 hover:border-dark-600'
                } ${isHovered ? 'ring-2 ring-gold-500/50 scale-[1.02]' : ''}`}
              >
                {/* Número do dia */}
                <div className="flex items-center justify-between mb-1">
                  <span
                    className={`text-xs font-semibold ${
                      isCurrentDay
                        ? 'w-5 h-5 rounded-full bg-gold-500 text-dark-900 flex items-center justify-center'
                        : isSelected
                        ? 'text-gold-400'
                        : 'text-gray-300'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>
                  {pendingCount > 0 && (
                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${
                      overdueCount > 0 ? 'bg-red-500/20 text-red-400' : 'bg-gold-500/20 text-gold-400'
                    }`}>
                      {pendingCount}
                    </span>
                  )}
                </div>

                {/* Indicadores de tarefas (até 3) */}
                <div className="space-y-0.5">
                  {dayTasks.slice(0, 3).map((task) => {
                    const meta = TASK_TYPE_META[task.type]
                    const Icon = ICON_MAP[meta.icon] || CheckSquare
                    return (
                      <div
                        key={task.id}
                        onClick={(e) => { e.stopPropagation(); onEdit(task) }}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate ${meta.bg} ${meta.color} ${
                          task.status === 'concluida' ? 'opacity-50 line-through' : ''
                        }`}
                      >
                        <Icon className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{task.title}</span>
                      </div>
                    )
                  })}
                  {dayTasks.length > 3 && (
                    <p className="text-[9px] text-gray-500 px-1.5">+{dayTasks.length - 3} mais</p>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Painel lateral — tarefas do dia selecionado */}
      <div className="card p-5">
        <div className="mb-4">
          <h3 className="text-sm font-display font-semibold text-white capitalize">
            {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            {tasksOfSelectedDay.length === 0
              ? 'Nenhuma tarefa pra este dia'
              : `${tasksOfSelectedDay.length} ${tasksOfSelectedDay.length === 1 ? 'tarefa' : 'tarefas'}`}
          </p>
        </div>

        <button
          onClick={() => onCreateAtDate?.(selectedDate)}
          className="w-full mb-4 px-3 py-2 text-xs font-medium text-gold-400 bg-gold-500/10 hover:bg-gold-500/20 border border-gold-500/30 rounded-lg transition"
        >
          + Nova tarefa neste dia
        </button>

        <div className="space-y-2 max-h-[calc(100vh-380px)] overflow-y-auto pr-1 scrollbar-hide">
          {tasksOfSelectedDay
            .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
            .map((task) => {
              const meta = TASK_TYPE_META[task.type]
              const Icon = ICON_MAP[meta.icon] || CheckSquare
              return (
                <button
                  key={task.id}
                  onClick={() => onEdit(task)}
                  className="w-full text-left p-3 rounded-xl bg-dark-800/60 hover:bg-dark-800 border border-dark-700/40 hover:border-dark-600 transition group"
                >
                  <div className="flex items-start gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${meta.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${task.status === 'concluida' ? 'text-gray-500 line-through' : 'text-white'} truncate`}>
                        {task.title}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {format(new Date(task.dueAt), 'HH:mm')} • {meta.label}
                      </p>
                    </div>
                  </div>
                </button>
              )
            })}
        </div>
      </div>
    </div>
  )
}
