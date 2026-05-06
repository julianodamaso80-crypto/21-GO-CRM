// @ts-nocheck
import { useState, useRef, useEffect } from 'react'
import {
  X, Loader2, Send, MessageSquare, Phone, Mail, MapPin, User2, Calendar,
  Sparkles, ArrowRightLeft, CheckCircle2, XCircle, Tag,
} from 'lucide-react'
import { useCard, useTransferCard, usePipes } from '../../hooks/usePipes'
import { api } from '../../lib/api'
import { toast } from 'sonner'

interface CardDrawerProps {
  cardId: string
  pipeId: string
  onClose: () => void
}

/**
 * CardDrawer estilo HubSpot Inbox: drawer GRANDE com 2 colunas.
 * Esquerda: info do lead + ações rápidas.
 * Direita: chat WhatsApp completo (mensagens + input pra responder).
 */
export function CardDrawer({ cardId, pipeId, onClose }: CardDrawerProps) {
  const { data: card, isLoading, refetch } = useCard(cardId)
  const { data: allPipes } = usePipes()
  const transferCard = useTransferCard(pipeId)

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [transferOpen, setTransferOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const conversation = (card as any)?.conversation
  const lead = (card as any)?.lead
  const messages = conversation?.messages || []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  const handleSend = async () => {
    if (!text.trim() || !conversation?.id) return
    setSending(true)
    try {
      await api.post(`/conversations/${conversation.id}/messages`, { content: text.trim() })
      setText('')
      await refetch()
      toast.success('Mensagem enviada!')
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao enviar')
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="relative w-full max-w-5xl bg-dark-900 shadow-2xl flex flex-col animate-slide-in-right border-l border-dark-700/50">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
          </div>
        ) : !card ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <p className="text-gray-400">Card não encontrado</p>
            <button onClick={onClose} className="btn-secondary">Fechar</button>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-6 py-4 border-b border-dark-700/40 flex items-center justify-between gap-4 bg-dark-800/60">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-gold-500/10 border border-gold-500/30 flex items-center justify-center text-sm font-semibold text-gold-400">
                  {(card.title || '?').slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h2 className="text-lg font-display font-semibold text-white truncate">{card.title}</h2>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                    {card.pipe?.name && (
                      <>
                        <span>{card.pipe.name}</span>
                        <span>•</span>
                      </>
                    )}
                    {card.currentPhase && (
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: card.currentPhase.color }} />
                        {card.currentPhase.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <button onClick={onClose} className="p-2 text-gray-500 hover:text-gray-300 hover:bg-dark-700/40 rounded-lg transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body 2 colunas */}
            <div className="flex-1 flex overflow-hidden">
              {/* COLUNA ESQUERDA — Info do lead + ações */}
              <div className="w-80 border-r border-dark-700/40 overflow-y-auto bg-dark-800/30">
                {/* Info contato */}
                <div className="p-5 border-b border-dark-700/40">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Contato</p>
                  <div className="space-y-2.5">
                    <InfoRow icon={User2} label="Nome" value={lead?.nome || card.title} />
                    {(lead?.whatsapp || lead?.telefone) && (
                      <InfoRow icon={Phone} label="WhatsApp" value={`+${lead.whatsapp || lead.telefone}`} />
                    )}
                    {lead?.email && <InfoRow icon={Mail} label="E-mail" value={lead.email} />}
                    {lead?.origem && <InfoRow icon={Tag} label="Origem" value={lead.origem} />}
                  </div>
                </div>

                {/* Atribuição + datas */}
                <div className="p-5 border-b border-dark-700/40">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-3">Detalhes</p>
                  <div className="space-y-2.5">
                    {card.assignedTo && (
                      <InfoRow
                        icon={User2}
                        label="Responsável"
                        value={`${card.assignedTo.firstName || ''} ${card.assignedTo.lastName || ''}`.trim()}
                      />
                    )}
                    <InfoRow
                      icon={Calendar}
                      label="Criado"
                      value={new Date(card.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    />
                  </div>
                </div>

                {/* Ações */}
                <div className="p-5 space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Ações</p>
                  <button
                    onClick={() => setTransferOpen(true)}
                    className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-dark-800/60 border border-dark-700/40 text-sm text-gray-300 hover:bg-dark-700/40 hover:border-gold-500/30 transition"
                  >
                    <ArrowRightLeft className="w-4 h-4 text-gold-400" />
                    Transferir pra outro funil
                  </button>
                </div>

                {/* Description */}
                {card.description && (
                  <div className="p-5 border-t border-dark-700/40">
                    <p className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold mb-2">Descrição</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{card.description}</p>
                  </div>
                )}
              </div>

              {/* COLUNA DIREITA — Chat WhatsApp embutido */}
              <div className="flex-1 flex flex-col bg-dark-900">
                {/* Chat header */}
                <div className="px-5 py-3 border-b border-dark-700/40 bg-dark-800/40">
                  <div className="flex items-center gap-2 text-sm text-gray-400">
                    <MessageSquare className="w-4 h-4 text-emerald-400" />
                    <span className="font-medium">Conversa WhatsApp</span>
                    {messages.length > 0 && (
                      <span className="text-xs text-gray-500">• {messages.length} mensagens</span>
                    )}
                  </div>
                </div>

                {/* Mensagens */}
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
                  {!conversation ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
                      <MessageSquare className="w-12 h-12 text-gray-600 mb-3" />
                      <p className="text-sm text-gray-400">Sem conversa vinculada</p>
                      <p className="text-xs text-gray-600 mt-1">Esse card não tem mensagens de WhatsApp ainda</p>
                    </div>
                  ) : messages.length === 0 ? (
                    <p className="text-center text-sm text-gray-500 py-8">Nenhuma mensagem</p>
                  ) : (
                    messages.map((msg: any) => <MessageBubble key={msg.id} message={msg} />)
                  )}
                  <div ref={bottomRef} />
                </div>

                {/* Input */}
                {conversation && (
                  <div className="px-5 py-3 border-t border-dark-700/40 bg-dark-800/40">
                    <div className="flex items-end gap-2">
                      <textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite e pressione Enter pra enviar pelo WhatsApp..."
                        rows={1}
                        className="flex-1 px-3 py-2 text-sm bg-dark-800 border border-dark-600/50 text-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
                      />
                      <button
                        onClick={handleSend}
                        disabled={!text.trim() || sending}
                        className="p-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-gray-600 mt-1.5">
                      A mensagem sai pelo seu WhatsApp conectado
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal de transferência */}
            {transferOpen && allPipes && (
              <TransferModal
                pipes={(allPipes || []).filter((p: any) => p.id !== card.pipeId)}
                onClose={() => setTransferOpen(false)}
                onTransfer={(targetPipeId) => {
                  transferCard.mutate(
                    { cardId, targetPipeId },
                    {
                      onSuccess: () => {
                        setTransferOpen(false)
                        onClose()
                      },
                    },
                  )
                }}
                isPending={transferCard.isPending}
              />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</p>
        <p className="text-sm text-gray-200 truncate">{value || '—'}</p>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: any }) {
  const isOutbound = message.direction === 'outbound'
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3.5 py-2 ${
          isOutbound
            ? 'bg-emerald-600 text-white rounded-br-sm'
            : 'bg-dark-800 border border-dark-700/40 text-gray-100 rounded-bl-sm'
        }`}
      >
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        <p className={`text-[10px] mt-1 ${isOutbound ? 'text-emerald-100' : 'text-gray-500'}`}>
          {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  )
}

function TransferModal({
  pipes, onClose, onTransfer, isPending,
}: {
  pipes: Array<{ id: string; name: string; color?: string }>
  onClose: () => void
  onTransfer: (id: string) => void
  isPending: boolean
}) {
  const [selected, setSelected] = useState<string | null>(null)
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card max-w-md w-full mx-6">
        <div className="px-6 py-4 border-b border-dark-700/40 flex items-center justify-between">
          <h3 className="text-lg font-display font-semibold text-white">Transferir pra outro funil</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-2 max-h-80 overflow-y-auto">
          {pipes.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Nenhum outro funil disponível</p>
          ) : (
            pipes.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelected(p.id)}
                className={`w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${
                  selected === p.id
                    ? 'bg-gold-500/10 border-gold-500/40'
                    : 'border-dark-700/40 hover:border-dark-600 hover:bg-dark-800/40'
                }`}
              >
                <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm" style={{ backgroundColor: p.color || '#3B82F6' }}>
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-gray-200">{p.name}</span>
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
    </div>
  )
}
