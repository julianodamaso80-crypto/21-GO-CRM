// @ts-nocheck
import { useState, useEffect } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Loader2, GripVertical, Settings2, ArrowRightLeft, X, MoveRight } from 'lucide-react'
import { useKanban, useCreateCard, useMoveCard, useTransferCard, usePipes } from '../../hooks/usePipes'
import { CardDrawer } from './CardDrawer'
import { PhasesEditorDrawer } from './PhasesEditorDrawer'
import { useAuthStore } from '../../store/auth-store'
import type { Card, Phase } from '../../../../shared/types'

export function KanbanPage() {
  const { pipeId } = useParams<{ pipeId: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const { data: kanban, isLoading } = useKanban(pipeId || '')
  const { data: allPipes } = usePipes()
  const createCard = useCreateCard(pipeId || '')
  const moveCard = useMoveCard(pipeId || '')
  const transferCard = useTransferCard(pipeId || '')
  const focusCardFromUrl = searchParams.get('card')
  const [selectedCardId, setSelectedCardId] = useState<string | null>(focusCardFromUrl)

  // Sincroniza query param ?card= com state (busca global manda pra cá)
  useEffect(() => {
    if (focusCardFromUrl && focusCardFromUrl !== selectedCardId) {
      setSelectedCardId(focusCardFromUrl)
    }
  }, [focusCardFromUrl])
  const [newCardPhaseId, setNewCardPhaseId] = useState<string | null>(null)
  const [newCardTitle, setNewCardTitle] = useState('')
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [phasesEditorOpen, setPhasesEditorOpen] = useState(false)
  const [transferCardId, setTransferCardId] = useState<string | null>(null)
  const [moveCardId, setMoveCardId] = useState<string | null>(null)
  const me = useAuthStore((s) => s.user)
  const isAdmin = me?.role?.name === 'admin'

  if (!pipeId) return null

  const handleCreateCard = () => {
    if (!newCardTitle.trim() || !newCardPhaseId) return
    createCard.mutate({ title: newCardTitle.trim() }, {
      onSuccess: () => {
        setNewCardTitle('')
        setNewCardPhaseId(null)
      },
    })
  }

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    setDraggedCardId(cardId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, phaseId: string) => {
    e.preventDefault()
    if (!draggedCardId) return
    moveCard.mutate({ cardId: draggedCardId, data: { phaseId } })
    setDraggedCardId(null)
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
      </div>
    )
  }

  if (!kanban) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">Pipe nao encontrado</p>
        <Link to="/pipes" className="text-gold-400 hover:underline mt-2 inline-block">Voltar para Pipes</Link>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col page-enter">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-dark-700 bg-dark-800">
        <Link to="/pipes" className="text-gray-500 hover:text-gray-400">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm"
          style={{ backgroundColor: kanban.color || '#3B82F6' }}
        >
          {kanban.name?.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold text-white font-display">{kanban.name}</h1>
          {kanban.description && <p className="text-xs text-gray-400 truncate">{kanban.description}</p>}
        </div>
        {isAdmin && (
          <button
            onClick={() => setPhasesEditorOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gold-500/10 border border-gold-500/30 text-gold-400 rounded-lg hover:bg-gold-500/20 transition-colors"
            title="Editar fases do funil (admin)"
          >
            <Settings2 className="w-4 h-4" />
            Editar fases
          </button>
        )}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-4 h-full" style={{ minWidth: 'max-content' }}>
          {kanban.phases?.map((phase: Phase & { cards?: Card[]; _count?: { cards: number } }) => {
            const phaseCards = (phase as any).cards || []
            const phaseCount = phase._count?.cards ?? phaseCards.length
            return (
            <div
              key={phase.id}
              className="flex flex-col w-72 flex-shrink-0 bg-dark-900 rounded-lg"
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, phase.id)}
            >
              {/* Phase Header — estilo Kommo */}
              <div className="px-3 py-2.5 border-b border-dark-700">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: phase.color }} />
                    <span className="font-semibold text-xs uppercase tracking-wider text-gray-200 truncate">{phase.name}</span>
                  </div>
                  <button
                    onClick={() => setNewCardPhaseId(newCardPhaseId === phase.id ? null : phase.id)}
                    className="p-0.5 text-gray-500 hover:text-gold-400 rounded hover:bg-dark-700 flex-shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-gray-500">
                  {phaseCount} {phaseCount === 1 ? 'lead' : 'leads'}
                </p>
              </div>

              {/* New Card Form */}
              {newCardPhaseId === phase.id && (
                <div className="p-2">
                  <input
                    type="text"
                    value={newCardTitle}
                    onChange={(e) => setNewCardTitle(e.target.value)}
                    placeholder="Titulo do card..."
                    className="w-full px-2.5 py-1.5 text-sm bg-dark-800 border border-dark-600 text-gray-200 rounded-lg focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCard()
                      if (e.key === 'Escape') { setNewCardPhaseId(null); setNewCardTitle('') }
                    }}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={handleCreateCard}
                      disabled={!newCardTitle.trim() || createCard.isPending}
                      className="px-3 py-1 btn-primary text-xs disabled:opacity-50"
                    >
                      {createCard.isPending ? 'Criando...' : 'Criar'}
                    </button>
                    <button
                      onClick={() => { setNewCardPhaseId(null); setNewCardTitle('') }}
                      className="px-3 py-1 text-xs text-gray-400 hover:bg-dark-700 rounded"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Cards */}
              <div className="flex-1 overflow-y-auto p-2 space-y-2">
                {phaseCards.map((card: Card) => {
                  const created = new Date(card.createdAt)
                  const dateStr = created.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
                  return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    onClick={() => setSelectedCardId(card.id)}
                    className="bg-dark-800/60 border border-dark-700/40 hover:border-gold-500/30 hover:bg-dark-800 rounded-lg p-2.5 cursor-pointer transition-all group relative shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-white truncate flex-1">{card.title}</p>
                      <span className="text-[10px] text-gray-500 flex-shrink-0">{dateStr}</span>
                    </div>
                    {card.description && (
                      <p className="text-[10px] text-gray-500 line-clamp-1 mb-1.5">
                        {card.description}
                      </p>
                    )}
                    {card.assignedTo && (
                      <div className="flex items-center gap-1.5">
                        <div className="w-4 h-4 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-[9px] font-semibold flex items-center justify-center flex-shrink-0">
                          {(card.assignedTo as any).firstName?.charAt(0)}
                        </div>
                        <span className="text-[10px] text-gray-400 truncate">
                          {(card.assignedTo as any).firstName} {(card.assignedTo as any).lastName}
                        </span>
                      </div>
                    )}
                    {/* Botões hover: Mover de fase + Transferir de funil */}
                    <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button
                        onClick={(e) => { e.stopPropagation(); setMoveCardId(card.id === moveCardId ? null : card.id) }}
                        title="Mover pra outra fase"
                        className="p-1 rounded text-gray-500 hover:text-gold-400 hover:bg-dark-700/60"
                      >
                        <MoveRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setTransferCardId(card.id) }}
                        title="Transferir pra outro funil"
                        className="p-1 rounded text-gray-500 hover:text-gold-400 hover:bg-dark-700/60"
                      >
                        <ArrowRightLeft className="w-3 h-3" />
                      </button>
                    </div>

                    {/* Dropdown "Mover pra fase X" */}
                    {moveCardId === card.id && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="absolute top-7 right-1 w-52 bg-dark-800 border border-dark-700/60 rounded-lg shadow-2xl z-30 py-1 max-h-64 overflow-y-auto"
                      >
                        <p className="px-3 py-1 text-[10px] uppercase text-gray-500 tracking-wider">Mover pra…</p>
                        {kanban.phases?.map((p: any) => p.id !== phase.id && (
                          <button
                            key={p.id}
                            onClick={() => {
                              moveCard.mutate({ cardId: card.id, data: { phaseId: p.id } })
                              setMoveCardId(null)
                            }}
                            className="w-full text-left px-3 py-1.5 text-xs text-gray-200 hover:bg-dark-700/60 flex items-center gap-2"
                          >
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                            {p.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  )
                })}
              </div>
            </div>
            )
          })}
        </div>
      </div>

      {/* Card Drawer */}
      {selectedCardId && (
        <CardDrawer
          cardId={selectedCardId}
          pipeId={pipeId}
          onClose={() => {
            setSelectedCardId(null)
            // Limpa query param ao fechar
            if (searchParams.get('card')) {
              const next = new URLSearchParams(searchParams)
              next.delete('card')
              setSearchParams(next, { replace: true })
            }
          }}
        />
      )}

      {/* Phases Editor (admin only) */}
      {isAdmin && (
        <PhasesEditorDrawer
          isOpen={phasesEditorOpen}
          pipeId={pipeId}
          pipeName={kanban.name}
          phases={kanban.phases || []}
          onClose={() => setPhasesEditorOpen(false)}
        />
      )}

      {/* Transfer Card Modal */}
      {transferCardId && (
        <TransferCardModal
          cardId={transferCardId}
          currentPipeId={pipeId}
          pipes={(allPipes || []).filter((p: any) => p.id !== pipeId)}
          onClose={() => setTransferCardId(null)}
          onTransfer={(targetPipeId) => {
            transferCard.mutate(
              { cardId: transferCardId, targetPipeId },
              { onSuccess: () => setTransferCardId(null) },
            )
          }}
          isPending={transferCard.isPending}
        />
      )}
    </div>
  )
}

function TransferCardModal({
  cardId,
  currentPipeId,
  pipes,
  onClose,
  onTransfer,
  isPending,
}: {
  cardId: string
  currentPipeId: string
  pipes: Array<{ id: string; name: string; color?: string; description?: string }>
  onClose: () => void
  onTransfer: (targetPipeId: string) => void
  isPending: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-dark-700/40 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-display font-semibold text-white">Transferir pra outro funil</h3>
            <p className="text-xs text-gray-500 mt-0.5">O card vai pra primeira fase do funil escolhido</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-2">
          {pipes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">
              Sem outros funis disponíveis
            </p>
          ) : (
            pipes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${
                  selected === p.id
                    ? 'bg-gold-500/10 border-gold-500/40 ring-1 ring-gold-500/20'
                    : 'border-dark-700/40 hover:border-dark-600 hover:bg-dark-800/40'
                }`}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0"
                  style={{ backgroundColor: p.color || '#3B82F6' }}
                >
                  {p.name?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${selected === p.id ? 'text-white' : 'text-gray-300'} truncate`}>
                    {p.name}
                  </p>
                  {p.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">{p.description}</p>
                  )}
                </div>
                {selected === p.id && <ArrowRightLeft className="w-4 h-4 text-gold-400 flex-shrink-0" />}
              </button>
            ))
          )}
        </div>

        <div className="px-6 py-4 border-t border-dark-700/40 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 border border-dark-700/50 rounded-lg hover:bg-dark-700/40">
            Cancelar
          </button>
          <button
            onClick={() => selected && onTransfer(selected)}
            disabled={!selected || isPending}
            className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRightLeft className="w-4 h-4" />}
            Transferir
          </button>
        </div>
      </div>
    </>
  )
}
