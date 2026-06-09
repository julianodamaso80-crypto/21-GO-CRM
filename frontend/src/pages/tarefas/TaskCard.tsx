import { useState } from 'react'
import {
  Phone, MessageCircle, Video, MapPin, RotateCcw, Mail, CheckSquare,
  Check, Clock, AlertTriangle, MoreHorizontal, Trash2, Edit3, User, StickyNote,
} from 'lucide-react'
import { format, isToday, isTomorrow, isPast, isThisWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { TASK_TYPE_META, TASK_PRIORITY_META, type Task } from '../../services/tasks.service'
import { useCompleteTask, useDeleteTask, useReopenTask } from '../../hooks/useTasks'

const ICON_MAP = {
  phone: Phone,
  'message-circle': MessageCircle,
  video: Video,
  'map-pin': MapPin,
  'rotate-ccw': RotateCcw,
  mail: Mail,
  'check-square': CheckSquare,
}

export interface TaskCardProps {
  task: Task
  onEdit?: (task: Task) => void
  onDragStart?: (task: Task) => void
  onDragEnd?: () => void
  draggable?: boolean
  compact?: boolean
}

export function TaskCard({ task, onEdit, onDragStart, onDragEnd, draggable = false, compact = false }: TaskCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const completeMutation = useCompleteTask()
  const reopenMutation = useReopenTask()
  const deleteMutation = useDeleteTask()

  const typeMeta = TASK_TYPE_META[task.type]
  const priorityMeta = TASK_PRIORITY_META[task.priority]
  const Icon = (ICON_MAP as any)[typeMeta.icon] || CheckSquare

  const due = new Date(task.dueAt)
  const isDone = task.status === 'concluida'
  const isOverdue = !isDone && isPast(due) && !isToday(due)

  const dueLabel = isToday(due)
    ? `Hoje • ${format(due, 'HH:mm')}`
    : isTomorrow(due)
    ? `Amanhã • ${format(due, 'HH:mm')}`
    : isThisWeek(due, { weekStartsOn: 1 })
    ? format(due, "EEEE • HH:mm", { locale: ptBR })
    : format(due, "dd MMM • HH:mm", { locale: ptBR })

  const handleDragStart = (e: React.DragEvent) => {
    if (draggable && onDragStart) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', task.id)
      onDragStart(task)
    }
  }

  return (
    <div
      draggable={draggable && !isDone}
      onDragStart={handleDragStart}
      onDragEnd={onDragEnd}
      className={`group relative rounded-xl border bg-dark-800/60 backdrop-blur transition-all duration-200 hover:bg-dark-800 hover:shadow-lg overflow-hidden ${
        isDone
          ? 'border-dark-700/30 opacity-60'
          : isOverdue
          ? 'border-red-500/40 hover:border-red-500/60 shadow-red-500/5'
          : 'border-dark-700/40 hover:border-dark-600/60'
      } ${draggable && !isDone ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* Barra lateral de prioridade */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${priorityMeta.barColor}`} />

      <div className={`pl-4 pr-3 ${compact ? 'py-2.5' : 'py-3'}`}>
        <div className="flex items-start gap-3">
          {/* Checkbox de conclusão */}
          <button
            onClick={() =>
              isDone ? reopenMutation.mutate(task.id) : completeMutation.mutate(task.id)
            }
            className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              isDone
                ? 'bg-emerald-500 border-emerald-500'
                : 'border-dark-600 hover:border-gold-400 hover:bg-gold-500/10'
            }`}
            aria-label={isDone ? 'Reabrir' : 'Concluir'}
          >
            {isDone && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
          </button>

          {/* Conteúdo */}
          <div className="flex-1 min-w-0">
            {/* Header — tipo + título */}
            <div className="flex items-start gap-2">
              <div className={`flex-shrink-0 w-7 h-7 rounded-lg ${typeMeta.bg} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${typeMeta.color}`} />
              </div>
              <h3
                className={`text-sm font-medium leading-snug flex-1 min-w-0 ${
                  isDone ? 'text-gray-500 line-through' : 'text-white'
                }`}
              >
                {task.title}
              </h3>

              {/* Menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="opacity-0 group-hover:opacity-100 p-1 text-gray-500 hover:text-gray-300 transition-opacity"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-1 w-36 bg-dark-800 border border-dark-700/50 rounded-lg shadow-xl z-20 py-1">
                      {onEdit && (
                        <button
                          onClick={() => { onEdit(task); setMenuOpen(false) }}
                          className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-300 hover:bg-dark-700/50"
                        >
                          <Edit3 className="w-3 h-3" /> Editar
                        </button>
                      )}
                      <button
                        onClick={() => {
                          if (confirm('Excluir esta tarefa?')) {
                            deleteMutation.mutate(task.id)
                          }
                          setMenuOpen(false)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3 h-3" /> Excluir
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Bloco do lead vinculado — nome + WhatsApp clicavel */}
            {task.lead && (
              <LeadInfoBlock lead={task.lead} compact={compact} dim={isDone} />
            )}
            {!task.lead && task.leadId && (
              <div className="mt-1.5 text-[11px] text-gray-500 flex items-center gap-1">
                <User className="w-3 h-3" /> Lead vinculado (sem dados)
              </div>
            )}

            {/* Descrição (briefing inicial) */}
            {task.description && !compact && (
              <p className={`mt-1.5 text-xs leading-relaxed ${isDone ? 'text-gray-600' : 'text-gray-400'}`}>
                {task.description.length > 120 ? `${task.description.slice(0, 120)}…` : task.description}
              </p>
            )}

            {/* Observação (notas do vendedor — editavel) */}
            {task.observacao && (
              <div className={`mt-2 flex items-start gap-1.5 p-2 rounded-lg bg-amber-500/5 border border-amber-500/20 ${isDone ? 'opacity-50' : ''}`}>
                <StickyNote className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] leading-relaxed text-amber-100/80">
                  {task.observacao.length > 200 ? `${task.observacao.slice(0, 200)}…` : task.observacao}
                </p>
              </div>
            )}

            {/* Footer — data + indicadores */}
            <div className="mt-2 flex items-center gap-2 text-xs flex-wrap">
              <span
                className={`inline-flex items-center gap-1 ${
                  isOverdue ? 'text-red-400 font-medium' : isToday(due) ? 'text-gold-400 font-medium' : 'text-gray-500'
                }`}
              >
                {isOverdue ? <AlertTriangle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                {isOverdue ? `Atrasada • ${format(due, 'dd/MM HH:mm')}` : dueLabel}
              </span>

              {task.priority === 'alta' && !isDone && (
                <span className={`inline-flex items-center gap-1 ${priorityMeta.color}`}>
                  • Alta prioridade
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Formata telefone BR pra exibição: 5521988887777 → (21) 98888-7777 */
function formatPhoneBR(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const local = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (local.length === 11) return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`
  if (local.length === 10) return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`
  return phone
}

/** Gera link wa.me a partir do número (sempre com 55) */
function waLink(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  const withCountry = digits.startsWith('55') ? digits : `55${digits}`
  return `https://wa.me/${withCountry}`
}

function LeadInfoBlock({
  lead,
  compact,
  dim,
}: {
  lead: NonNullable<Task['lead']>
  compact: boolean
  dim: boolean
}) {
  const phone = lead.whatsapp || lead.telefone
  return (
    <div
      className={`mt-2 rounded-lg bg-gradient-to-br from-blue-500/8 to-emerald-500/5 border border-blue-500/20 ${
        compact ? 'px-2.5 py-1.5' : 'px-3 py-2'
      } ${dim ? 'opacity-60' : ''}`}
    >
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-blue-500/15 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
          <User className="w-3.5 h-3.5 text-blue-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-white truncate">{lead.nome}</p>
          {phone && (
            <a
              href={waLink(phone)}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:text-emerald-200 tabular-nums transition-colors"
            >
              <MessageCircle className="w-3 h-3" />
              {formatPhoneBR(phone)}
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
