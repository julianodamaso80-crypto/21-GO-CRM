import { useState } from 'react'
import {
  X, Plus, Trash2, GripVertical, Loader2, Check, Trophy, XCircle,
  ChevronUp, ChevronDown,
} from 'lucide-react'
import {
  useCreatePhase, useUpdatePhase, useDeletePhase, useReorderPhases,
} from '../../hooks/usePipes'

interface Phase {
  id: string
  name: string
  color: string
  position: number
  probability: number
  isWon: boolean
  isLost: boolean
}

interface Props {
  isOpen: boolean
  pipeId: string
  pipeName: string
  phases: Phase[]
  onClose: () => void
}

const COLOR_PALETTE = [
  '#3D72DE', '#A78BFA', '#F08C28', '#FBBF24', '#34D399',
  '#FB7185', '#10B981', '#06B6D4', '#8B5CF6', '#F472B6',
  '#6B7280', '#EAB308',
]

export function PhasesEditorDrawer({ isOpen, pipeId, pipeName, phases, onClose }: Props) {
  const [newPhaseName, setNewPhaseName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  const createPhase = useCreatePhase(pipeId)
  const updatePhase = useUpdatePhase(pipeId)
  const deletePhase = useDeletePhase(pipeId)
  const reorderPhases = useReorderPhases(pipeId)

  if (!isOpen) return null

  const sortedPhases = [...phases].sort((a, b) => a.position - b.position)

  const handleCreate = () => {
    const name = newPhaseName.trim()
    if (!name) return
    createPhase.mutate(
      { name, color: '#6B7280', probability: 50 } as any,
      {
        onSuccess: () => setNewPhaseName(''),
      }
    )
  }

  const startRename = (p: Phase) => {
    setEditingId(p.id); setEditingName(p.name)
  }

  const commitRename = () => {
    if (!editingId) return
    const name = editingName.trim()
    if (name) updatePhase.mutate({ phaseId: editingId, data: { name } })
    setEditingId(null); setEditingName('')
  }

  const changeColor = (id: string, color: string) => {
    updatePhase.mutate({ phaseId: id, data: { color } })
  }

  const changeProbability = (id: string, probability: number) => {
    updatePhase.mutate({ phaseId: id, data: { probability } })
  }

  const toggleWon = (p: Phase) => {
    updatePhase.mutate({ phaseId: p.id, data: { isWon: !p.isWon, isLost: false } })
  }

  const toggleLost = (p: Phase) => {
    updatePhase.mutate({ phaseId: p.id, data: { isLost: !p.isLost, isWon: false } })
  }

  const movePhase = (idx: number, direction: -1 | 1) => {
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= sortedPhases.length) return
    const newOrder = [...sortedPhases]
    ;[newOrder[idx], newOrder[newIdx]] = [newOrder[newIdx], newOrder[idx]]
    reorderPhases.mutate(newOrder.map((p) => p.id))
  }

  const handleDelete = (p: Phase) => {
    if (!confirm(`Remover a fase "${p.name}"? Esta acao nao pode ser desfeita.`)) return
    deletePhase.mutate(p.id)
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel max-w-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700/40">
          <div>
            <h2 className="text-xl font-semibold font-display text-white">Editar fases do funil</h2>
            <p className="text-xs text-gray-400 mt-0.5">{pipeName}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-3">
          <div className="card bg-blue-500/5 border-blue-500/20 p-3">
            <p className="text-xs text-gray-400">
              <strong className="text-blue-400">Como funciona:</strong> as fases definem as colunas do Kanban
              de todos os vendedores e gestores deste funil. Voce (admin) edita aqui e a equipe inteira ve.
              <br />
              <Trophy className="inline w-3 h-3 text-emerald-400" /> = ganho (card vira "concluido"),
              <XCircle className="inline w-3 h-3 text-rose-400" /> = perdido (card e arquivado).
            </p>
          </div>

          {sortedPhases.map((phase, idx) => {
            const isEditing = editingId === phase.id
            return (
              <div key={phase.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-1">
                    <button
                      onClick={() => movePhase(idx, -1)}
                      disabled={idx === 0}
                      className="p-0.5 text-gray-500 hover:text-gold-400 disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Mover pra cima"
                    >
                      <ChevronUp size={14} />
                    </button>
                    <GripVertical size={14} className="text-gray-600" />
                    <button
                      onClick={() => movePhase(idx, 1)}
                      disabled={idx === sortedPhases.length - 1}
                      className="p-0.5 text-gray-500 hover:text-gold-400 disabled:opacity-20 disabled:cursor-not-allowed"
                      title="Mover pra baixo"
                    >
                      <ChevronDown size={14} />
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onBlur={commitRename}
                          onKeyDown={(e) => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') { setEditingId(null); setEditingName('') } }}
                          className="flex-1 bg-dark-800 border border-gold-500/30 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:border-gold-500"
                        />
                      ) : (
                        <button
                          onClick={() => startRename(phase)}
                          className="flex-1 text-left text-sm font-medium text-white hover:text-gold-400 transition-colors"
                        >
                          {phase.name}
                        </button>
                      )}
                      <span className="text-[10px] text-gray-500 uppercase tracking-wider">
                        Posicao {idx + 1}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {COLOR_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => changeColor(phase.id, c)}
                          className={`w-5 h-5 rounded-full transition-all ${phase.color === c ? 'ring-2 ring-offset-2 ring-offset-dark-800 ring-gold-400 scale-110' : 'hover:scale-110'}`}
                          style={{ backgroundColor: c }}
                          title={c}
                        />
                      ))}
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <label className="text-xs text-gray-400 flex-shrink-0">Probabilidade:</label>
                      <input
                        type="range"
                        min={0}
                        max={100}
                        value={phase.probability}
                        onChange={(e) => changeProbability(phase.id, Number(e.target.value))}
                        className="flex-1 accent-gold-500"
                      />
                      <span className="text-xs font-medium text-gold-400 w-10 text-right">{phase.probability}%</span>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => toggleWon(phase)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          phase.isWon
                            ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-400'
                            : 'bg-dark-700/40 border border-dark-600/40 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <Trophy size={12} />
                        {phase.isWon ? 'Fase de GANHO' : 'Marcar como ganho'}
                        {phase.isWon && <Check size={12} />}
                      </button>
                      <button
                        onClick={() => toggleLost(phase)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          phase.isLost
                            ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                            : 'bg-dark-700/40 border border-dark-600/40 text-gray-500 hover:text-gray-300'
                        }`}
                      >
                        <XCircle size={12} />
                        {phase.isLost ? 'Fase de PERDA' : 'Marcar como perda'}
                        {phase.isLost && <Check size={12} />}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => handleDelete(phase)}
                    disabled={deletePhase.isPending || sortedPhases.length <= 1}
                    title={sortedPhases.length <= 1 ? 'Funil precisa de pelo menos uma fase' : 'Remover fase'}
                    className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            )
          })}

          <div className="card p-4 border-dashed border-dark-600/40">
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-gray-500" />
              <input
                value={newPhaseName}
                onChange={(e) => setNewPhaseName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
                placeholder="Nome da nova fase..."
                className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none"
              />
              <button
                onClick={handleCreate}
                disabled={!newPhaseName.trim() || createPhase.isPending}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1 disabled:opacity-50"
              >
                {createPhase.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                Adicionar
              </button>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-dark-700/40 flex justify-end">
          <button onClick={onClose} className="btn-secondary">Concluir</button>
        </div>
      </div>
    </>
  )
}
