import { useState } from 'react'
import { Plus, Loader2, ListChecks, Phone, MessageCircle, Video, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { useTasksByLead, useCreateTaskForLead } from '../../hooks/useTasks'
import { TaskCard } from './TaskCard'
import { TaskFormDrawer } from './TaskFormDrawer'
import type { Task, TaskType } from '../../services/tasks.service'

interface Props {
  leadId: string
}

const QUICK_TYPES: Array<{ value: TaskType; label: string; icon: any; color: string }> = [
  { value: 'ligacao',   label: 'Ligar',     icon: Phone,         color: 'text-blue-400' },
  { value: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle, color: 'text-emerald-400' },
  { value: 'follow_up', label: 'Follow-up', icon: RotateCcw,     color: 'text-cyan-400' },
  { value: 'reuniao',   label: 'Reunião',   icon: Video,         color: 'text-purple-400' },
]

export function LeadTasksPanel({ leadId }: Props) {
  const { data, isLoading } = useTasksByLead(leadId)
  const createMutation = useCreateTaskForLead(leadId)

  const [quickTitle, setQuickTitle] = useState('')
  const [quickDate, setQuickDate] = useState(format(new Date(Date.now() + 3600 * 1000), "yyyy-MM-dd'T'HH:mm"))
  const [quickType, setQuickType] = useState<TaskType>('follow_up')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)

  const tasks = data?.data || []
  const pending = tasks.filter((t) => t.status === 'pendente')
  const done = tasks.filter((t) => t.status === 'concluida')

  const handleQuickCreate = (e: React.FormEvent) => {
    e.preventDefault()
    if (!quickTitle.trim() || !quickDate) return
    createMutation.mutate(
      {
        title: quickTitle.trim(),
        dueAt: new Date(quickDate).toISOString(),
        type: quickType,
        priority: 'media',
      },
      {
        onSuccess: () => {
          setQuickTitle('')
          setQuickDate(format(new Date(Date.now() + 3600 * 1000), "yyyy-MM-dd'T'HH:mm"))
        },
      }
    )
  }

  const openEdit = (task: Task) => {
    setEditingTask(task)
    setDrawerOpen(true)
  }

  return (
    <div className="space-y-4">
      {/* Form de criação rápida */}
      <form onSubmit={handleQuickCreate} className="rounded-xl border border-dark-700/40 bg-dark-800/40 p-4 space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <Plus className="w-3.5 h-3.5" />
          Agendar atividade
        </div>

        <input
          type="text"
          value={quickTitle}
          onChange={(e) => setQuickTitle(e.target.value)}
          placeholder="Ex: João vai retornar dia 15"
          className="w-full input text-sm"
        />

        <div className="grid grid-cols-2 gap-2">
          <input
            type="datetime-local"
            value={quickDate}
            onChange={(e) => setQuickDate(e.target.value)}
            className="input text-xs"
          />
          <select
            value={quickType}
            onChange={(e) => setQuickType(e.target.value as TaskType)}
            className="input text-xs"
          >
            {QUICK_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Chips rápidos de tipo */}
        <div className="flex gap-1.5 flex-wrap">
          {QUICK_TYPES.map((t) => {
            const Icon = t.icon
            const active = quickType === t.value
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setQuickType(t.value)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] border transition ${
                  active ? 'bg-gold-500/15 border-gold-500/40 text-gold-400' : 'border-dark-700/40 text-gray-400 hover:bg-dark-800'
                }`}
              >
                <Icon className={`w-3 h-3 ${active ? '' : t.color}`} /> {t.label}
              </button>
            )
          })}
        </div>

        <button
          type="submit"
          disabled={createMutation.isPending || !quickTitle.trim()}
          className="w-full btn-primary text-xs py-2 disabled:opacity-50"
        >
          {createMutation.isPending ? 'Salvando…' : 'Agendar atividade'}
        </button>
      </form>

      {/* Listagens */}
      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-8 px-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center mb-3">
            <ListChecks className="w-5 h-5 text-gold-400" />
          </div>
          <p className="text-sm text-gray-400">Nenhuma tarefa pra este lead</p>
          <p className="text-xs text-gray-600 mt-0.5">Use o formulário acima pra agendar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pending.length > 0 && (
            <div>
              <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">
                Pendentes ({pending.length})
              </h4>
              <div className="space-y-2">
                {pending.map((t) => (
                  <TaskCard key={t.id} task={t} onEdit={openEdit} />
                ))}
              </div>
            </div>
          )}

          {done.length > 0 && (
            <details className="group">
              <summary className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider px-1 cursor-pointer hover:text-gray-400 list-none flex items-center gap-1">
                <span className="group-open:rotate-90 transition-transform">▸</span>
                Concluídas ({done.length})
              </summary>
              <div className="space-y-2 mt-2">
                {done.map((t) => (
                  <TaskCard key={t.id} task={t} onEdit={openEdit} compact />
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {drawerOpen && (
        <TaskFormDrawer
          task={editingTask}
          defaultLeadId={leadId}
          onClose={() => { setDrawerOpen(false); setEditingTask(null) }}
        />
      )}
    </div>
  )
}
