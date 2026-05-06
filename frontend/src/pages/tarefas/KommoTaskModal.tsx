import { useState, useMemo } from 'react'
import {
  X, Loader2, Calendar, Phone, MessageCircle, Video, MapPin, RotateCcw, CheckSquare, ChevronLeft, ChevronRight,
} from 'lucide-react'
import {
  format, addMinutes, addHours, addDays, addWeeks, addMonths, addYears, startOfDay,
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameDay, isSameMonth, isToday,
} from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { useCreateTaskForLead } from '../../hooks/useTasks'
import type { TaskType } from '../../services/tasks.service'

interface Props {
  leadId: string
  leadName?: string
  onClose: () => void
  onCreated?: () => void
}

const SHORTCUTS = [
  { label: 'Após 15 min',  delta: () => addMinutes(new Date(), 15) },
  { label: 'Após 30 min',  delta: () => addMinutes(new Date(), 30) },
  { label: 'Em uma hora',  delta: () => addHours(new Date(), 1) },
  { label: 'Hoje',         delta: () => { const d = new Date(); d.setHours(18, 0, 0, 0); return d } },
  { label: 'Amanhã',       delta: () => { const d = addDays(new Date(), 1); d.setHours(10, 0, 0, 0); return d } },
  { label: 'Esta semana',  delta: () => { const d = addDays(new Date(), 3); d.setHours(10, 0, 0, 0); return d } },
  { label: 'Em 7 dias',    delta: () => { const d = addWeeks(new Date(), 1); d.setHours(10, 0, 0, 0); return d } },
  { label: 'Em 30 dias',   delta: () => { const d = addDays(new Date(), 30); d.setHours(10, 0, 0, 0); return d } },
  { label: 'Em 1 ano',     delta: () => { const d = addYears(new Date(), 1); d.setHours(10, 0, 0, 0); return d } },
]

const TASK_TYPES: Array<{ value: TaskType; label: string; icon: any }> = [
  { value: 'ligacao',   label: 'Ligar',     icon: Phone },
  { value: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle },
  { value: 'reuniao',   label: 'Reunião',   icon: Video },
  { value: 'visita',    label: 'Visita',    icon: MapPin },
  { value: 'follow_up', label: 'Follow-up', icon: RotateCcw },
  { value: 'tarefa',    label: 'Tarefa',    icon: CheckSquare },
]

export function KommoTaskModal({ leadId, leadName, onClose, onCreated }: Props) {
  const createTask = useCreateTaskForLead(leadId)

  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(10, 0, 0, 0); return d
  })
  const [calendarMonth, setCalendarMonth] = useState(new Date())
  const [type, setType] = useState<TaskType>('follow_up')
  const [title, setTitle] = useState('')
  const [allDay, setAllDay] = useState(false)

  // Time slots 8h–22h em incrementos de 30min
  const timeSlots = useMemo(() => {
    const slots: Array<{ h: number; m: number; label: string }> = []
    for (let h = 8; h <= 22; h++) {
      slots.push({ h, m: 0, label: `${String(h).padStart(2, '0')}:00` })
      if (h < 22) slots.push({ h, m: 30, label: `${String(h).padStart(2, '0')}:30` })
    }
    return slots
  }, [])

  // Calendar grid
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(calendarMonth), { weekStartsOn: 1 })
    const end = endOfWeek(endOfMonth(calendarMonth), { weekStartsOn: 1 })
    return eachDayOfInterval({ start, end })
  }, [calendarMonth])

  const applyShortcut = (compute: () => Date) => {
    const d = compute()
    setSelectedDate(d)
    setCalendarMonth(d)
  }

  const setDateOnly = (d: Date) => {
    const newDate = new Date(d)
    newDate.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0)
    setSelectedDate(newDate)
  }

  const setTimeOnly = (h: number, m: number) => {
    const newDate = new Date(selectedDate)
    newDate.setHours(h, m, 0, 0)
    setSelectedDate(newDate)
    setAllDay(false)
  }

  const handleSubmit = () => {
    const finalDate = allDay ? startOfDay(selectedDate) : selectedDate
    const finalTitle = title.trim() ||
      `${TASK_TYPES.find(t => t.value === type)?.label || 'Tarefa'}${leadName ? ` — ${leadName}` : ''}`

    createTask.mutate(
      {
        title: finalTitle,
        dueAt: finalDate.toISOString(),
        type,
        priority: 'media',
      },
      {
        onSuccess: () => {
          onCreated?.()
          onClose()
        },
      },
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-4xl bg-dark-900 border border-dark-700/50 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-dark-700/40 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-semibold text-white">Nova tarefa</h3>
            {leadName && <p className="text-xs text-gray-500 mt-0.5">para {leadName}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-300 hover:bg-dark-700/40 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — 3 colunas (estilo Kommo) */}
        <div className="flex-1 grid grid-cols-[180px_1fr_180px] overflow-hidden">
          {/* Coluna 1: Shortcuts */}
          <div className="border-r border-dark-700/40 overflow-y-auto py-2">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                onClick={() => applyShortcut(s.delta)}
                className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-dark-800/60 hover:text-gold-400 transition"
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Coluna 2: Calendário */}
          <div className="border-r border-dark-700/40 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setCalendarMonth((d) => addMonths(d, -1))}
                className="p-1 text-gray-500 hover:text-gold-400 rounded"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-semibold text-white capitalize">
                {format(calendarMonth, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <button
                onClick={() => setCalendarMonth((d) => addMonths(d, 1))}
                className="p-1 text-gray-500 hover:text-gold-400 rounded"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-1">
              {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((d) => (
                <div key={d} className="text-center text-[10px] font-semibold text-gray-500 uppercase py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((day) => {
                const inMonth = isSameMonth(day, calendarMonth)
                const isSelected = isSameDay(day, selectedDate)
                const isCurrent = isToday(day)
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setDateOnly(day)}
                    className={`aspect-square rounded text-xs transition ${
                      !inMonth ? 'text-gray-700' : 'text-gray-300'
                    } ${
                      isSelected
                        ? 'bg-gold-500 text-dark-900 font-bold'
                        : isCurrent
                        ? 'border border-gold-500/40'
                        : 'hover:bg-dark-700/40'
                    }`}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            {/* All-day toggle + selected info */}
            <div className="mt-4 pt-3 border-t border-dark-700/40 space-y-2">
              <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={allDay}
                  onChange={(e) => setAllDay(e.target.checked)}
                  className="rounded bg-dark-800 border-dark-600 text-gold-500 focus:ring-gold-500"
                />
                Dia todo
              </label>
              <p className="text-xs text-gray-400">
                <Calendar className="w-3 h-3 inline mr-1" />
                {format(selectedDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                {!allDay && ` · ${format(selectedDate, 'HH:mm')}`}
              </p>
            </div>
          </div>

          {/* Coluna 3: Time slots */}
          <div className={`overflow-y-auto py-2 ${allDay ? 'opacity-40 pointer-events-none' : ''}`}>
            {timeSlots.map((s) => {
              const isSelected = selectedDate.getHours() === s.h && selectedDate.getMinutes() === s.m
              return (
                <button
                  key={`${s.h}-${s.m}`}
                  onClick={() => setTimeOnly(s.h, s.m)}
                  className={`w-full text-center px-4 py-1.5 text-sm transition ${
                    isSelected
                      ? 'bg-gold-500/15 text-gold-400 font-semibold'
                      : 'text-gray-400 hover:bg-dark-800/60 hover:text-gray-200'
                  }`}
                >
                  {s.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer — tipo + título + botões */}
        <div className="border-t border-dark-700/40 p-4 space-y-3">
          {/* Tipo */}
          <div className="flex flex-wrap gap-1.5">
            {TASK_TYPES.map((opt) => {
              const Icon = opt.icon
              const active = type === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setType(opt.value)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                    active
                      ? 'bg-gold-500/15 border-gold-500/40 text-gold-400'
                      : 'border-dark-700/40 text-gray-400 hover:bg-dark-800/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {opt.label}
                </button>
              )
            })}
          </div>

          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Título da tarefa (opcional)"
            className="input"
          />

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 border border-dark-700/50 rounded-lg hover:bg-dark-700/40">
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={createTask.isPending}
              className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
            >
              {createTask.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckSquare className="w-4 h-4" />}
              Criar tarefa
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
