import { useState, useEffect } from 'react'
import { X, Phone, MessageCircle, Video, MapPin, RotateCcw, Mail, CheckSquare } from 'lucide-react'
import { format } from 'date-fns'
import { useCreateTask, useUpdateTask } from '../../hooks/useTasks'
import { useLeads } from '../../hooks/useLeads'
import type { Task, TaskType, TaskPriority } from '../../services/tasks.service'

interface Props {
  task?: Task | null
  defaultLeadId?: string | null
  defaultDueAt?: string
  onClose: () => void
}

const TYPE_OPTIONS: Array<{ value: TaskType; label: string; icon: any; activeCls: string }> = [
  { value: 'ligacao',   label: 'Ligação',    icon: Phone,         activeCls: 'bg-blue-500/15 border-blue-500/50 text-blue-300' },
  { value: 'whatsapp',  label: 'WhatsApp',   icon: MessageCircle, activeCls: 'bg-emerald-500/15 border-emerald-500/50 text-emerald-300' },
  { value: 'reuniao',   label: 'Reunião',    icon: Video,         activeCls: 'bg-purple-500/15 border-purple-500/50 text-purple-300' },
  { value: 'visita',    label: 'Visita',     icon: MapPin,        activeCls: 'bg-amber-500/15 border-amber-500/50 text-amber-300' },
  { value: 'follow_up', label: 'Follow-up',  icon: RotateCcw,     activeCls: 'bg-cyan-500/15 border-cyan-500/50 text-cyan-300' },
  { value: 'email',     label: 'E-mail',     icon: Mail,          activeCls: 'bg-pink-500/15 border-pink-500/50 text-pink-300' },
  { value: 'tarefa',    label: 'Tarefa',     icon: CheckSquare,   activeCls: 'bg-gold-500/15 border-gold-500/50 text-gold-300' },
]

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; cls: string }> = [
  { value: 'baixa', label: 'Baixa', cls: 'bg-gray-500/10 text-gray-400 border-gray-500/30' },
  { value: 'media', label: 'Média', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  { value: 'alta',  label: 'Alta',  cls: 'bg-red-500/10 text-red-400 border-red-500/30' },
]

export function TaskFormDrawer({ task, defaultLeadId, defaultDueAt, onClose }: Props) {
  const isEditing = !!task
  const createMutation = useCreateTask()
  const updateMutation = useUpdateTask()
  const { data: leadsData } = useLeads({})
  const leads = leadsData?.data || []

  const [title, setTitle] = useState(task?.title || '')
  const [description, setDescription] = useState(task?.description || '')
  const [observacao, setObservacao] = useState(task?.observacao || '')
  const [type, setType] = useState<TaskType>(task?.type || 'tarefa')
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'media')
  const [leadId, setLeadId] = useState<string>(task?.leadId || defaultLeadId || '')

  const initialDate = task?.dueAt
    ? format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm")
    : defaultDueAt
    ? format(new Date(defaultDueAt), "yyyy-MM-dd'T'HH:mm")
    : format(new Date(Date.now() + 60 * 60 * 1000), "yyyy-MM-dd'T'HH:mm")
  const [dueAt, setDueAt] = useState(initialDate)

  const isPending = createMutation.isPending || updateMutation.isPending

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setDescription(task.description || '')
      setObservacao(task.observacao || '')
      setType(task.type)
      setPriority(task.priority)
      setLeadId(task.leadId || '')
      setDueAt(format(new Date(task.dueAt), "yyyy-MM-dd'T'HH:mm"))
    }
  }, [task])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !dueAt) return

    const payload = {
      title: title.trim(),
      description: description.trim() || undefined,
      observacao: observacao.trim() || undefined,
      dueAt: new Date(dueAt).toISOString(),
      type,
      priority,
      leadId: leadId || undefined,
    }

    if (isEditing) {
      updateMutation.mutate({ id: task!.id, data: payload }, { onSuccess: onClose })
    } else {
      createMutation.mutate(payload, { onSuccess: onClose })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-md bg-dark-900 shadow-2xl overflow-y-auto border-l border-dark-700/50 animate-slide-in-right">
        {/* Header */}
        <div className="sticky top-0 bg-dark-900/95 backdrop-blur border-b border-dark-700/40 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-display font-semibold text-white">
              {isEditing ? 'Editar tarefa' : 'Nova tarefa'}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {isEditing ? 'Atualize os campos da tarefa' : 'Agende uma atividade pra acompanhar este lead'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-dark-700/40 rounded-lg transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Tipo de atividade — chips */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Tipo</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const active = type === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setType(opt.value)}
                    className={`flex flex-col items-center gap-1 px-2 py-2.5 rounded-xl border transition-all ${
                      active
                        ? opt.activeCls
                        : 'border-dark-700/40 text-gray-500 hover:bg-dark-800 hover:border-dark-600'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-medium">{opt.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Título */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Título *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: João vai retornar dia 15"
              required
              autoFocus
              className="w-full input"
            />
          </div>

          {/* Data + hora */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Quando *</label>
            <input
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              required
              className="w-full input"
            />
          </div>

          {/* Prioridade — pills */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Prioridade</label>
            <div className="flex gap-2">
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPriority(opt.value)}
                  className={`flex-1 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    priority === opt.value ? opt.cls : 'border-dark-700/40 text-gray-500 hover:bg-dark-800'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Lead vinculado */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Lead vinculado
            </label>
            <select
              value={leadId}
              onChange={(e) => setLeadId(e.target.value)}
              className="w-full input"
            >
              <option value="">Sem vínculo</option>
              {leads.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.contact?.fullName || l.title}
                </option>
              ))}
            </select>
          </div>

          {/* Descrição (briefing inicial) */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
              Descrição
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalhes da atividade…"
              className="w-full input resize-none"
            />
          </div>

          {/* Observação (notas livres editaveis) */}
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Observação</span>
              <span className="text-[10px] font-normal normal-case tracking-normal text-gray-600">
                edita depois quando precisar
              </span>
            </label>
            <textarea
              value={observacao}
              onChange={(e) => setObservacao(e.target.value)}
              rows={3}
              placeholder="Ex: ele pediu pra ligar amanhã às 14h, conjugê insistente, tá querendo desconto…"
              className="w-full input resize-none border-amber-500/20 focus:border-amber-500/40"
            />
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/40">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-300 border border-dark-700/50 rounded-lg hover:bg-dark-700/40 transition">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary text-sm disabled:opacity-50">
              {isPending ? 'Salvando…' : isEditing ? 'Salvar alterações' : 'Criar tarefa'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
