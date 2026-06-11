// @ts-nocheck
import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, Plus, Loader2, Settings2, ArrowRightLeft, X, MoveRight,
  Search, Phone, MessageCircle, Bell, Clock, Filter, UserPlus,
} from 'lucide-react'
import { useKanban, useCreateCard, useMoveCard, useTransferCard, usePipes } from '../../hooks/usePipes'
import { CardDrawer } from './CardDrawer'
import { CreateLeadModal } from './CreateLeadModal'
import { PhasesEditorDrawer } from './PhasesEditorDrawer'
import { useAuthStore } from '../../store/auth-store'
import type { Card, Phase } from '../../../../shared/types'

// Formata "tempo na fase" em humano (5min / 2h / 3d / 2sem)
function timeAgoCompact(date: string | Date): string {
  const ms = Date.now() - new Date(date).getTime()
  const min = Math.floor(ms / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d}d`
  const w = Math.floor(d / 7)
  return `${w}sem`
}

// Mapeia origem do lead -> { label curto, classes Tailwind }
const ORIGEM_BADGE: Record<string, { label: string; cls: string }> = {
  google_ads:     { label: 'Google',    cls: 'text-blue-300 bg-blue-500/15 border-blue-500/40' },
  meta_ads:       { label: 'Meta',      cls: 'text-blue-200 bg-[#1877F2]/20 border-[#1877F2]/40' },
  facebook:       { label: 'Facebook',  cls: 'text-blue-200 bg-[#1877F2]/20 border-[#1877F2]/40' },
  instagram:      { label: 'Instagram', cls: 'text-pink-300 bg-pink-500/15 border-pink-500/40' },
  youtube:        { label: 'YouTube',   cls: 'text-red-300 bg-red-500/15 border-red-500/40' },
  blog:           { label: 'Blog',      cls: 'text-violet-300 bg-violet-500/15 border-violet-500/40' },
  site_organico:  { label: 'Orgânico',  cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40' },
  whatsapp:       { label: 'WhatsApp',  cls: 'text-emerald-200 bg-[#25D366]/15 border-[#25D366]/40' },
  whatsapp_import:{ label: 'Import',    cls: 'text-gray-400 bg-gray-500/15 border-gray-500/30' },
  indicacao:      { label: 'Indicação', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/40' },
  direto:         { label: 'Direto',    cls: 'text-indigo-300 bg-indigo-500/15 border-indigo-500/40' },
  seja_consultor: { label: 'Consultor', cls: 'text-purple-300 bg-purple-500/15 border-purple-500/40' },
  manual:         { label: 'Manual',    cls: 'text-gray-400 bg-gray-500/15 border-gray-500/30' },
  outro:          { label: 'Outro',     cls: 'text-gray-400 bg-gray-500/15 border-gray-500/30' },
}

function originBadgeFor(origem: string | null | undefined) {
  if (!origem) return null
  return ORIGEM_BADGE[origem] ?? { label: origem, cls: 'text-gray-400 bg-gray-500/15 border-gray-500/30' }
}

// Cor do badge "tempo na fase" — vai esquentando conforme o lead esfria
function ageColor(date: string | Date): string {
  const days = (Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24)
  if (days < 1) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
  if (days < 3) return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
  if (days < 7) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
  return 'text-red-400 bg-red-500/10 border-red-500/20'
}

// Normaliza telefone (5521992208062) → "+55 21 99220-8062"
function formatPhone(p?: string | null): string {
  if (!p) return ''
  const digits = p.replace(/\D/g, '')
  if (digits.length === 13) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9)}`
  if (digits.length === 12) return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 8)}-${digits.slice(8)}`
  if (digits.length === 11) return `${digits.slice(0, 2)} ${digits.slice(2, 7)}-${digits.slice(7)}`
  return p
}

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
  const [dragOverPhaseId, setDragOverPhaseId] = useState<string | null>(null)
  const [phasesEditorOpen, setPhasesEditorOpen] = useState(false)
  const [createLeadOpen, setCreateLeadOpen] = useState(false)
  const [transferCardId, setTransferCardId] = useState<string | null>(null)
  const [moveCardId, setMoveCardId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [onlyMine, setOnlyMine] = useState(false)
  const me = useAuthStore((s) => s.user)
  const isAdmin = me?.role?.name === 'admin'

  // Filtra cards conforme busca + "só meus"
  const filteredPhases = useMemo(() => {
    if (!kanban?.phases) return []
    const q = searchQuery.trim().toLowerCase()
    const qDigits = q.replace(/\D/g, '')
    return kanban.phases.map((phase: any) => {
      const cards = (phase.cards || []).filter((c: any) => {
        if (onlyMine && c.assignedToId !== me?.id) return false
        if (!q) return true
        const lead = c.lead || {}
        // bate em title, descrição, telefone, email, nome do lead
        if (c.title?.toLowerCase().includes(q)) return true
        if (c.description?.toLowerCase().includes(q)) return true
        if (lead.nome?.toLowerCase().includes(q)) return true
        if (lead.email?.toLowerCase().includes(q)) return true
        if (qDigits && (lead.whatsapp?.includes(qDigits) || lead.telefone?.includes(qDigits))) return true
        return false
      })
      return { ...phase, cards, _filteredCount: cards.length }
    })
  }, [kanban?.phases, searchQuery, onlyMine, me?.id])

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
    e.dataTransfer.setData('text/plain', cardId)
  }

  const handleDragEnd = () => {
    setDraggedCardId(null)
    setDragOverPhaseId(null)
  }

  const handleDragOver = (e: React.DragEvent, phaseId: string) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverPhaseId !== phaseId) setDragOverPhaseId(phaseId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Só limpa se saiu pra fora do container, não pra um filho
    const related = e.relatedTarget as Node | null
    if (related && (e.currentTarget as Node).contains(related)) return
    setDragOverPhaseId(null)
  }

  const handleDrop = (e: React.DragEvent, phaseId: string) => {
    e.preventDefault()
    setDragOverPhaseId(null)
    const cardId = draggedCardId || e.dataTransfer.getData('text/plain')
    if (!cardId) return
    // Não move se for a mesma fase
    const currentPhase = kanban?.phases?.find((p: any) => (p.cards || []).some((c: any) => c.id === cardId))
    if (currentPhase?.id === phaseId) { setDraggedCardId(null); return }
    moveCard.mutate({ cardId, data: { phaseId } })
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

  const totalCards = kanban.phases?.reduce((s: number, p: any) => s + (p.cards?.length || 0), 0) || 0
  const filteredCards = filteredPhases.reduce((s: number, p: any) => s + p.cards.length, 0)

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
          <p className="text-xs text-gray-500 truncate">
            {searchQuery || onlyMine
              ? `${filteredCards} de ${totalCards} cards`
              : `${totalCards} cards no funil`}
          </p>
        </div>

        {/* Busca rápida no Kanban */}
        <div className="relative w-64">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar nesta fase (nome, telefone)..."
            className="w-full pl-8 pr-8 py-1.5 text-xs bg-dark-900/60 border border-dark-700/50 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-gold-500/40"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Toggle "só meus" */}
        <button
          onClick={() => setOnlyMine(!onlyMine)}
          title="Mostrar apenas cards atribuídos a mim"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition border ${
            onlyMine
              ? 'bg-gold-500/15 border-gold-500/40 text-gold-300'
              : 'bg-dark-900/40 border-dark-700/50 text-gray-400 hover:text-gray-200'
          }`}
        >
          <Filter className="w-3.5 h-3.5" />
          Só meus
        </button>

        {/* CTA: Novo lead manual — abre modal pra escolher funil + fase + dados */}
        <button
          onClick={() => setCreateLeadOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg shadow-cta-orange transition-all"
          title="Criar lead manualmente em qualquer funil/fase"
        >
          <UserPlus className="w-4 h-4" />
          Novo lead
        </button>

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
          {filteredPhases.map((phase: any) => {
            const phaseCards = phase.cards || []
            const phaseCount = phase._count?.cards ?? phase.cards?.length ?? 0
            const visibleCount = phase._filteredCount ?? phaseCards.length
            return (
            <div
              key={phase.id}
              className={`flex flex-col w-72 flex-shrink-0 rounded-lg transition-all ${
                dragOverPhaseId === phase.id
                  ? 'bg-gold-500/10 ring-2 ring-gold-500/50'
                  : 'bg-dark-900'
              }`}
              onDragOver={(e) => handleDragOver(e, phase.id)}
              onDragLeave={handleDragLeave}
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
                  {searchQuery || onlyMine
                    ? `${visibleCount} de ${phaseCount} ${phaseCount === 1 ? 'lead' : 'leads'}`
                    : `${phaseCount} ${phaseCount === 1 ? 'lead' : 'leads'}`}
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
                {phaseCards.length === 0 && (searchQuery || onlyMine) ? (
                  <p className="text-center text-[11px] text-gray-600 py-4">Sem resultados</p>
                ) : null}
                {phaseCards.map((card: any) => {
                  const lead = card.lead
                  const phone = lead?.whatsapp || lead?.telefone
                  const phoneFmt = formatPhone(phone)
                  // Idade na fase ≈ updatedAt do card (proxy: última movimentação)
                  const ageRef = card.updatedAt || card.createdAt
                  const tasksPending = card.tasksPending || 0
                  const lastMsgAt = card.lastMessageAt
                  const recentMsg = lastMsgAt && (Date.now() - new Date(lastMsgAt).getTime()) < 1000 * 60 * 60 * 24
                  return (
                  <div
                    key={card.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card.id)}
                    onDragEnd={handleDragEnd}
                    onClick={() => setSelectedCardId(card.id)}
                    className={`bg-dark-800/60 border border-dark-700/40 hover:border-gold-500/30 hover:bg-dark-800 rounded-lg p-2.5 cursor-grab active:cursor-grabbing transition-all group relative shadow-sm ${
                      draggedCardId === card.id ? 'opacity-40 scale-95 ring-2 ring-gold-500/40' : ''
                    }`}
                  >
                    {/* Linha 1: nome + tempo na fase */}
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-white truncate flex-1">{card.title}</p>
                      <span
                        title={`Última atualização: ${new Date(ageRef).toLocaleString('pt-BR')}`}
                        className={`text-[9px] px-1.5 py-0.5 rounded border flex-shrink-0 ${ageColor(ageRef)}`}
                      >
                        {timeAgoCompact(ageRef)}
                      </span>
                    </div>

                    {/* Linha 2: telefone (se tem) */}
                    {phone && (
                      <div className="flex items-center gap-1 text-[10px] text-gray-400 mb-1.5">
                        <Phone className="w-2.5 h-2.5" />
                        <span className="truncate">{phoneFmt}</span>
                      </div>
                    )}

                    {/* Linha 2.5: badge de origem do lead */}
                    {(() => {
                      const ob = originBadgeFor(lead?.origem)
                      if (!ob) return null
                      return (
                        <div className="mb-1.5">
                          <span
                            title={`Origem: ${ob.label}`}
                            className={`inline-block text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded border ${ob.cls}`}
                          >
                            {ob.label}
                          </span>
                        </div>
                      )
                    })()}

                    {/* Linha 3: badges + assignedTo */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1 min-w-0">
                        {card.assignedTo ? (
                          <div
                            title={`${card.assignedTo.firstName || ''} ${card.assignedTo.lastName || ''}`.trim()}
                            className="w-4 h-4 rounded-full bg-gold-500/10 border border-gold-500/30 text-gold-400 text-[9px] font-semibold flex items-center justify-center flex-shrink-0"
                          >
                            {(card.assignedTo.firstName || '?').charAt(0)}
                          </div>
                        ) : null}
                        {/* Badge tarefa pendente */}
                        {tasksPending > 0 && (
                          <span
                            title={`${tasksPending} tarefa${tasksPending > 1 ? 's' : ''} pendente${tasksPending > 1 ? 's' : ''}`}
                            className="inline-flex items-center gap-0.5 text-[9px] text-amber-300 bg-amber-500/10 border border-amber-500/30 px-1 py-px rounded"
                          >
                            <Bell className="w-2.5 h-2.5" />
                            {tasksPending}
                          </span>
                        )}
                        {/* Badge mensagem recente */}
                        {recentMsg && (
                          <span
                            title={`Última msg: ${new Date(lastMsgAt).toLocaleString('pt-BR')}`}
                            className="inline-flex items-center text-[9px] text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-1 py-px rounded gap-0.5"
                          >
                            <MessageCircle className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>

                      {/* Ações rápidas (visíveis só no hover) */}
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                        {phone && (
                          <a
                            href={`https://wa.me/${phone.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title="Abrir WhatsApp Web"
                            className="p-1 rounded text-gray-500 hover:text-emerald-400 hover:bg-dark-700/60"
                          >
                            <MessageCircle className="w-3 h-3" />
                          </a>
                        )}
                        {phone && (
                          <a
                            href={`tel:+${phone.replace(/\D/g, '')}`}
                            onClick={(e) => e.stopPropagation()}
                            title="Ligar"
                            className="p-1 rounded text-gray-500 hover:text-blue-400 hover:bg-dark-700/60"
                          >
                            <Phone className="w-3 h-3" />
                          </a>
                        )}
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

      {/* Modal: Novo lead manual — escolhe funil + fase + dados */}
      <CreateLeadModal
        isOpen={createLeadOpen}
        defaultPipeId={pipeId}
        onClose={() => setCreateLeadOpen(false)}
      />

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
