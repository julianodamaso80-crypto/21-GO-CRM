import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare, Send, Loader2, Bot, User, CheckCheck, Search,
  Smartphone, QrCode, CheckCircle2, XCircle, Sparkles, ChevronRight, Wifi, ArrowLeft,
} from 'lucide-react'
import {
  useConversations, useMessages, useSendMessage, useUpdateConversationStatus, useMarkAsRead,
} from '../../hooks/useInbox'
import {
  useWhatsappInstance, useCreateWhatsapp, useWhatsappStatus,
} from '../../hooks/useWhatsapp'
import { useSocketEvent } from '../../hooks/useSocketEvent'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { toast } from 'sonner'
import type { Conversation, Message, ConversationStatus } from '../../../../shared/types'
import { MessageContent } from '../../components/MessageContent'

const STATUS_MAP: Record<ConversationStatus, { label: string; cls: string }> = {
  open: { label: 'Aberto', cls: 'bg-accent-blue/15 text-accent-blue' },
  assigned: { label: 'Atribuido', cls: 'bg-accent-purple/15 text-accent-purple' },
  resolved: { label: 'Resolvido', cls: 'bg-accent-emerald/15 text-accent-emerald' },
  closed: { label: 'Fechado', cls: 'bg-dark-700/50 text-gray-400' },
}

export function WhatsappPage() {
  const { data: instance } = useWhatsappInstance()
  const isConnected = instance?.status === 'CONNECTED'
  const isWaitingQr = !!instance && instance.status !== 'CONNECTED'

  // Polling de status enquanto não conectado (atualiza QR + detecta connection)
  useWhatsappStatus(isWaitingQr)

  // Se não conectou ainda, ocupa tela inteira com fluxo de conexão
  if (!isConnected) {
    return <ConnectionFlow />
  }

  // Conectado → exibe a inbox de WhatsApp (similar ao InboxPage mas focado no chip do user)
  return <ConversationsLayout />
}

// ─────────────────────────────────────────────────────────────────────
// FLUXO DE CONEXÃO (sem instância OU aguardando QR)
// ─────────────────────────────────────────────────────────────────────
function ConnectionFlow() {
  const { data: instance, isLoading } = useWhatsappInstance()
  const createMutation = useCreateWhatsapp()
  const isWaitingQr = !!instance && instance.status !== 'CONNECTED'
  const { data: liveStatus } = useWhatsappStatus(isWaitingQr)

  const [createdQr, setCreatedQr] = useState<string | null>(null)
  useEffect(() => {
    if (createMutation.isSuccess && createMutation.data?.qrCodeBase64) {
      setCreatedQr(createMutation.data.qrCodeBase64)
    }
  }, [createMutation.isSuccess, createMutation.data])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
      </div>
    )
  }

  // Sem instância → onboarding
  if (!instance) {
    return (
      <div className="p-6 max-w-3xl mx-auto page-enter">
        <div className="card p-8">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-7 h-7 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-display font-bold text-white">Conecte seu WhatsApp</h2>
              <p className="text-sm text-gray-400 mt-2 leading-relaxed">
                Atenda seus clientes pelo WhatsApp diretamente do CRM. Cada conversa nova aparece aqui pra você responder e converter em lead.
              </p>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
                <Step n={1} title="Clique em Conectar" desc="Geramos um QR Code do seu chip" />
                <Step n={2} title="Escaneie no celular" desc="WhatsApp → Aparelhos conectados" />
                <Step n={3} title="Pronto!" desc="Mensagens caem direto no CRM" />
              </div>
              <button
                onClick={() => createMutation.mutate(undefined)}
                disabled={createMutation.isPending}
                className="btn-primary mt-6 inline-flex items-center gap-2"
              >
                {createMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <QrCode className="w-4 h-4" />
                )}
                {createMutation.isPending ? 'Gerando QR…' : 'Conectar WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Tem instância mas não conectada → mostra QR
  const qr = liveStatus?.qrCodeBase64 ?? createdQr
  return (
    <div className="p-6 max-w-3xl mx-auto page-enter">
      <div className="card p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4">
            <QrCode className="w-7 h-7 text-amber-400" />
          </div>
          <h2 className="text-2xl font-display font-bold text-white">Aguardando conexão</h2>
          <p className="text-sm text-gray-400 mt-1">Escaneie o QR Code abaixo com seu celular</p>

          <div className="my-6">
            {qr ? (
              <img
                src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
                alt="QR Code"
                className="w-64 h-64 rounded-xl bg-white p-3"
              />
            ) : (
              <div className="w-64 h-64 rounded-xl border border-dark-700/50 bg-dark-800 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
              </div>
            )}
          </div>

          <div className="text-sm text-gray-300 max-w-md">
            <p className="font-medium text-white mb-2">Como conectar:</p>
            <ol className="text-xs text-gray-400 space-y-1.5 text-left">
              <li>1. Abra o WhatsApp no seu celular</li>
              <li>2. Vá em <strong className="text-gray-200">Configurações → Aparelhos conectados</strong></li>
              <li>3. Toque em <strong className="text-gray-200">Conectar um aparelho</strong></li>
              <li>4. Aponte a câmera pro QR Code acima</li>
            </ol>
            <p className="text-[11px] text-gray-500 mt-3">QR expira em 30s — está sendo renovado automaticamente</p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Step({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-dark-800/40 border border-dark-700/30">
      <div className="w-7 h-7 rounded-lg bg-gold-500/10 border border-gold-500/30 flex items-center justify-center flex-shrink-0 text-xs font-bold text-gold-400">
        {n}
      </div>
      <div>
        <p className="text-xs font-semibold text-white">{title}</p>
        <p className="text-[11px] text-gray-500 mt-0.5">{desc}</p>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// LAYOUT DE CONVERSAS (conectado)
// ─────────────────────────────────────────────────────────────────────
function ConversationsLayout() {
  const { data: instance } = useWhatsappInstance()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const queryClient = useQueryClient()

  // Debounce do searchTerm pra não bombardear o servidor a cada tecla.
  // 250ms — rápido o bastante pra parecer ao vivo, lento o bastante pra
  // a digitação completar antes de queryar.
  const [debouncedSearch, setDebouncedSearch] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250)
    return () => clearTimeout(t)
  }, [searchTerm])

  const { data: conversations, isLoading } = useConversations({
    ...(statusFilter ? { status: statusFilter } : {}),
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  })
  const markAsRead = useMarkAsRead()

  // Real-time: nova mensagem chega → invalida lista (atualiza preview, ordem,
  // contador) e mensagens da conversa ativa. Substitui o polling de 30s.
  useSocketEvent('inbox:new_message', (data: any) => {
    // [TRACE-WA] PROVA de que o evento chegou ate o navegador da tela /whatsapp
    try {
      const sock: any = (window as any).__crmSocket || null
      console.log('[INBOX_FE_RECEIVED_PROOF]', {
        tag: 'INBOX_FE_RECEIVED_PROOF',
        timestamp: new Date().toISOString(),
        correlationId: data?.__correlationId,
        conversationId: data?.conversationId,
        messageId: data?.message?.id,
        whatsappMessageId: data?.message?.whatsappMessageId,
        socketConnected: !!sock?.connected,
        transport: sock?.io?.engine?.transport?.name || 'unknown',
        currentUrl: window.location.pathname,
      })
    } catch {
      /* log nunca quebra fluxo */
    }
    queryClient.invalidateQueries({ queryKey: ['conversations'] })
    if (data?.conversationId) {
      queryClient.invalidateQueries({ queryKey: ['messages', data.conversationId] })
    }
  })

  // Server já filtrou — usa direto a lista. Mantém variável `filtered`
  // só pra não mexer no resto do JSX.
  const filtered = conversations || []

  // [TRACE-WA] PROVA de render — dispara quando a lista efetiva muda
  useEffect(() => {
    const top = filtered[0]
    console.log('[INBOX_RENDER_PROOF]', {
      tag: 'INBOX_RENDER_PROOF',
      timestamp: new Date().toISOString(),
      listLength: filtered.length,
      topConversationId: top?.id ?? null,
      topLastMessageAt: top?.lastMessageAt ?? null,
      topLastMessagePreview: (top as any)?.lastMessagePreview ?? null,
    })
  }, [filtered])

  const handleSelect = (conv: Conversation) => {
    setSelectedId(conv.id)
    if ((conv.unreadCount ?? 0) > 0) markAsRead.mutate(conv.id)
  }

  // Notificação sonora + push browser quando chega mensagem nova.
  // Não toca pra mensagem do próprio user (outbound) nem se já estiver
  // com a conversa aberta na tela.
  useNewMessageNotifier(selectedId)

  return (
    <div className="flex h-full page-enter">
      {/* Sidebar de conversas */}
      <div className="w-80 border-r border-dark-700/40 flex flex-col bg-dark-800/60">
        {/* Header com perfil conectado */}
        <div className="px-4 py-3 border-b border-dark-700/40">
          <div className="flex items-center gap-2.5 mb-3">
            {instance?.profilePicUrl ? (
              <img src={instance.profilePicUrl} alt="" className="w-8 h-8 rounded-full" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-500">Conectado como</p>
              <p className="text-sm font-medium text-white truncate">
                {instance?.profileName || 'WhatsApp'}
              </p>
            </div>
            <ReconfigureWebhookButton />
          </div>

          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-display font-semibold text-white">Conversas</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2 py-1 border border-dark-600 rounded-md bg-dark-800 text-gray-200"
            >
              <option value="">Todos</option>
              <option value="open">Abertos</option>
              <option value="assigned">Atribuídos</option>
              <option value="resolved">Resolvidos</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar conversa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-dark-800 border border-dark-600 text-gray-200 rounded-md focus:ring-1 focus:ring-gold-500/30"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhuma conversa ainda</p>
              <p className="text-[11px] text-gray-600 mt-1">As mensagens recebidas aparecerão aqui</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const unread = conv.unreadCount ?? 0
              const hasUnread = unread > 0
              return (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv)}
                className={`w-full text-left px-4 py-3 border-b border-dark-700/40 hover:bg-dark-700/50 transition relative ${
                  selectedId === conv.id ? 'bg-gold-500/10 border-l-2 border-l-gold-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium text-gray-400 flex-shrink-0">
                    {conv.contact?.firstName?.[0] || '?'}
                    {conv.contact?.lastName?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    {/* Linha 1: NOME do cliente (destaque) + horario */}
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${hasUnread ? 'font-bold text-white' : 'font-semibold text-dark-100'}`}>
                        {conv.contact?.fullName || conv.contact?.firstName || 'Contato'}
                      </span>
                      <span className={`text-[10px] whitespace-nowrap ${hasUnread ? 'text-gold-400 font-semibold' : 'text-dark-400'}`}>
                        {formatTimeAgo(conv.lastMessageAt || conv.createdAt)}
                      </span>
                    </div>
                    {/* Linha 2: CONTATO (telefone) — sub-info em laranja monoespacada */}
                    {conv.contact?.phone && (
                      <p className="text-[11px] font-mono text-orange-500 truncate mt-0.5">
                        {formatBrPhone(conv.contact.phone)}
                      </p>
                    )}
                    {/* Linha 3: ULTIMA MENSAGEM — cinza claro/itálico, ou branca/bold quando não lida */}
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className={`text-xs truncate flex-1 ${hasUnread ? 'text-dark-50 font-semibold not-italic' : 'italic text-dark-400'}`}>
                        {(conv as any).lastMessagePreview || 'Sem mensagens'}
                      </p>
                      {hasUnread && (
                        <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-gold-500 text-dark-900 text-[10px] font-bold leading-none flex-shrink-0">
                          {unread > 99 ? '99+' : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
              )
            })
          )}
        </div>
      </div>

      {/* Chat */}
      {selectedId ? (
        <ChatPanel
          conversationId={selectedId}
          conversation={filtered.find((c) => c.id === selectedId) || null}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-dark-900">
          <div className="text-center max-w-sm">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Selecione uma conversa pra ver as mensagens</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// CHAT PANEL com botão "Converter em Lead"
// ─────────────────────────────────────────────────────────────────────
function ChatPanel({
  conversationId,
  conversation,
}: {
  conversationId: string
  conversation: Conversation | null
}) {
  const { data: messages, isLoading } = useMessages(conversationId)
  const sendMessage = useSendMessage()
  const updateStatus = useUpdateConversationStatus()
  const [text, setText] = useState('')
  const [convertOpen, setConvertOpen] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!text.trim()) return
    sendMessage.mutate({ conversationId, content: text.trim() })
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex-1 flex flex-col bg-dark-800/60">
      {/* Header */}
      {conversation && (
        <div className="px-5 py-3 border-b border-dark-700/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium text-gray-400">
              {conversation.contact?.firstName?.[0] || '?'}
              {conversation.contact?.lastName?.[0] || ''}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {conversation.contact?.fullName || conversation.contact?.firstName || 'Contato'}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500 flex-wrap">
                {conversation.contact?.phone && (
                  <span className="font-mono text-gold-400/90">
                    {formatBrPhone(conversation.contact.phone)}
                  </span>
                )}
                <span>•</span>
                <span>WhatsApp</span>
                {conversation.isBotActive && (
                  <span className="flex items-center gap-0.5 text-purple-400">
                    <Bot className="w-3 h-3" /> IA ativa
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConvertOpen(true)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-gold-500/10 border border-gold-500/30 text-gold-400 hover:bg-gold-500/20 transition"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Converter em Lead
            </button>
            <select
              value={conversation.status}
              onChange={(e) => updateStatus.mutate({ conversationId, status: e.target.value })}
              className="text-xs px-2 py-1 border border-dark-600 rounded-md bg-dark-800 text-gray-200"
            >
              <option value="open">Aberto</option>
              <option value="assigned">Atribuído</option>
              <option value="resolved">Resolvido</option>
              <option value="closed">Fechado</option>
            </select>
          </div>
        </div>
      )}

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-5 py-4 bg-dark-900 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
          </div>
        ) : messages && messages.length > 0 ? (
          messages.map((msg) => <MessageBubble key={msg.id} message={msg} />)
        ) : (
          <p className="text-center text-sm text-gray-500 py-8">Nenhuma mensagem nesta conversa</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-5 py-3 border-t border-dark-700/40 bg-dark-800/60">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem... (Enter pra enviar)"
            rows={1}
            className="flex-1 px-3 py-2 text-sm bg-dark-800 border border-dark-600 text-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="p-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessage.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Modal Converter em Lead */}
      {convertOpen && (
        <ConvertToLeadModal
          conversationId={conversationId}
          onClose={() => setConvertOpen(false)}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Modal "Converter em Lead" — 2 passos: escolhe funil → escolhe fase
// ─────────────────────────────────────────────────────────────────────
type FunilType = 'consultor' | 'associado'

function ConvertToLeadModal({
  conversationId,
  onClose,
}: {
  conversationId: string
  onClose: () => void
}) {
  const [step, setStep] = useState<'funil' | 'fase'>('funil')
  const [funilType, setFunilType] = useState<FunilType | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSelectFunil = (v: FunilType) => {
    setFunilType(v)
    setStep('fase')
  }

  const handleConvert = async (phaseId: string) => {
    if (!funilType) return
    setSubmitting(true)
    try {
      const r = await api.post(`/conversations/${conversationId}/convert-to-lead`, {
        funilType,
        phaseId,
      })
      const data = r.data
      toast.success(`Lead criado em "${data.pipe?.name}"!`)
      onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Erro ao converter em lead')
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <div className="drawer-panel max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-dark-700/40 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            {step === 'fase' && (
              <button
                onClick={() => setStep('funil')}
                disabled={submitting}
                className="p-1 -ml-1 text-gray-400 hover:text-gray-200 rounded"
                title="Voltar"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <div className="min-w-0">
              <h3 className="text-lg font-display font-semibold text-white">Converter em Lead</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {step === 'funil'
                  ? 'Escolha em qual funil o card será criado'
                  : 'Escolha em qual fase do Kanban entrar'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {step === 'funil' ? (
          <div className="p-6 space-y-3">
            <FunilOption
              onSelect={() => handleSelectFunil('associado')}
              title="Vendas de Associados"
              desc="Cliente quer adesão de proteção veicular"
              color="blue"
            />
            <FunilOption
              onSelect={() => handleSelectFunil('consultor')}
              title="Vendas de Consultores"
              desc="Cliente quer ser parceiro/consultor"
              color="orange"
            />
          </div>
        ) : (
          <PhasePicker
            funilType={funilType!}
            disabled={submitting}
            onPick={handleConvert}
          />
        )}
      </div>
    </>
  )
}

function FunilOption({
  onSelect,
  title,
  desc,
  color,
}: {
  onSelect: () => void
  title: string
  desc: string
  color: 'blue' | 'orange'
}) {
  const colorCls =
    color === 'blue'
      ? 'border-dark-700/40 hover:border-blue-500/40 hover:bg-blue-500/5'
      : 'border-dark-700/40 hover:border-orange-500/40 hover:bg-orange-500/5'
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-xl border transition group ${colorCls}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-gold-400 transition" />
      </div>
    </button>
  )
}

// Lista as fases do funil escolhido — clica numa fase, converte direto.
function PhasePicker({
  funilType,
  disabled,
  onPick,
}: {
  funilType: FunilType
  disabled: boolean
  onPick: (phaseId: string) => void
}) {
  const [pipe, setPipe] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pickedId, setPickedId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        // Lista pipes da empresa e acha o que casa com a keyword (mesma lógica do backend)
        const list = await api.get('/pipes')
        const keyword = funilType === 'consultor' ? 'consultor' : 'associado'
        const found = (list.data as any[]).find((p) =>
          (p.name || '').toLowerCase().includes(keyword),
        )
        if (!found) {
          if (!cancelled) setError(`Funil de ${funilType} não encontrado.`)
          return
        }
        const detail = await api.get(`/pipes/${found.id}`)
        if (!cancelled) setPipe(detail.data)
      } catch (e: any) {
        if (!cancelled) setError(e?.response?.data?.message || 'Erro ao carregar fases')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [funilType])

  const handlePick = (phaseId: string) => {
    if (disabled) return
    setPickedId(phaseId)
    onPick(phaseId)
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-10">
        <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    )
  }

  const phases = (pipe?.phases || []) as Array<{ id: string; name: string; color?: string; isWon?: boolean; isLost?: boolean }>

  return (
    <div className="p-6 flex-1 overflow-y-auto">
      <p className="text-xs text-gray-500 mb-3">
        Funil: <span className="text-gray-300 font-medium">{pipe?.name}</span>
      </p>
      <div className="space-y-2">
        {phases.length === 0 ? (
          <p className="text-sm text-gray-400">Esse funil ainda não tem fases.</p>
        ) : (
          phases.map((ph) => {
            const isPicking = pickedId === ph.id
            const dot = ph.color || '#3B82F6'
            return (
              <button
                key={ph.id}
                onClick={() => handlePick(ph.id)}
                disabled={disabled}
                className="w-full text-left p-3 rounded-lg border border-dark-700/40 hover:border-gold-500/40 hover:bg-gold-500/5 transition flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: dot }}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{ph.name}</p>
                    {(ph.isWon || ph.isLost) && (
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        {ph.isWon ? 'Ganho' : 'Perdido'}
                      </p>
                    )}
                  </div>
                </div>
                {isPicking ? (
                  <Loader2 className="w-4 h-4 text-gold-400 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4 text-gray-500" />
                )}
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Componentes auxiliares (copiados do InboxPage)
// ─────────────────────────────────────────────────────────────────────
function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'
  // Backend retorna `senderUser` (relacao Prisma com User). O campo `sender` no
  // Prisma e' string ('vendedor'|'cliente'|'sistema'|'bot') — nao um objeto.
  const senderUser = (message as any).senderUser as { firstName?: string } | undefined
  const senderLabel = message.isFromBot
    ? 'IA'
    : senderUser?.firstName || 'Voce'
  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3.5 py-2 ${
          isOutbound
            ? 'bg-gold-500 text-white rounded-br-sm'
            : 'bg-dark-800 border border-dark-700/40 text-gray-100 rounded-bl-sm'
        }`}
      >
        {isOutbound && (
          <div className="flex items-center gap-1 mb-0.5">
            {message.isFromBot ? (
              <Bot className="w-3 h-3 text-blue-200" />
            ) : (
              <User className="w-3 h-3 text-blue-200" />
            )}
            <span className="text-[10px] text-blue-200">{senderLabel}</span>
          </div>
        )}
        <MessageContent
          messageType={(message as any).messageType}
          content={message.content}
          mediaBase64={(message as any).mediaBase64}
          mediaMimeType={(message as any).mediaMimeType}
          outbound={isOutbound}
        />
        <div className={`flex items-center justify-end gap-1 mt-1 ${isOutbound ? 'text-blue-200' : 'text-gray-500'}`}>
          <span className="text-[10px]">
            {new Date(message.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          {isOutbound && message.isRead && <CheckCheck className="w-3 h-3" />}
        </div>
      </div>
    </div>
  )
}

// Formata telefone BR pra exibição. Aceita "5521999998888", "21999998888",
// "+55 (21) 99999-8888" etc. Se não conseguir formatar, devolve o original.
function formatBrPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '')
  if (!digits) return raw
  // Tira o "55" do começo se houver (DDI Brasil)
  const noCC = digits.startsWith('55') && digits.length >= 12 ? digits.slice(2) : digits
  if (noCC.length === 11) {
    return `(${noCC.slice(0, 2)}) ${noCC.slice(2, 7)}-${noCC.slice(7)}`
  }
  if (noCC.length === 10) {
    return `(${noCC.slice(0, 2)}) ${noCC.slice(2, 6)}-${noCC.slice(6)}`
  }
  // Fora do padrão BR — devolve o original (pode ser número internacional)
  return raw
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now()
  const date = new Date(dateStr).getTime()
  const diff = now - date
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'agora'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

// Botão "Reconfigurar webhook" — força a Evolution a apontar pra URL pública
// atual. Necessário quando a instância foi criada antes da env PUBLIC_WEBHOOK_URL
// existir (mensagens novas não chegam no CRM).
function ReconfigureWebhookButton() {
  const [loading, setLoading] = useState(false)
  const handle = async () => {
    if (loading) return
    setLoading(true)
    try {
      const publicUrl = window.location.origin
      const { data } = await api.post('/whatsapp/reconfigure-webhook', { publicUrl })
      toast.success(`Webhook reconfigurado: ${data.webhookUrl}`)
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Falha ao reconfigurar webhook')
    } finally {
      setLoading(false)
    }
  }
  return (
    <button
      onClick={handle}
      disabled={loading}
      title="Reconfigurar webhook na Evolution (use se mensagens novas não estão chegando)"
      className="p-1.5 rounded-md text-gray-500 hover:text-gold-400 hover:bg-dark-700/60 disabled:opacity-50"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────
// Notificação de mensagem nova (som + push do navegador + toast)
// ─────────────────────────────────────────────────────────────────────
function useNewMessageNotifier(selectedId: string | null) {
  // Pede permissão de notificação 1 vez (se ainda não decidida).
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Mantém o id atual atualizado sem recriar o handler
  const selectedRef = useRef<string | null>(selectedId)
  useEffect(() => {
    selectedRef.current = selectedId
  }, [selectedId])

  useSocketEvent('inbox:new_message', (payload: any) => {
    const msg = payload?.message
    if (!msg) return
    // Só dispara pra mensagens RECEBIDAS — quando o vendedor envia, não toca.
    if (msg.direction !== 'inbound') return
    // Se a conversa já está aberta na tela, não polui
    if (payload.conversationId && payload.conversationId === selectedRef.current) return

    playBeep()

    const title = 'Nova mensagem no WhatsApp'
    const body = (msg.content || '').toString().slice(0, 140) || 'Você recebeu uma mensagem'

    // Push do navegador (se permitido)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const n = new Notification(title, {
          body,
          icon: '/favicon.ico',
          tag: `wa-${payload.conversationId}`, // agrupa pela conversa
          renotify: true,
        } as any)
        n.onclick = () => {
          window.focus()
          n.close()
        }
      } catch {
        /* alguns browsers exigem ServiceWorker — silencia */
      }
    }

    // Toast como fallback visual (sempre)
    toast.message(title, { description: body, duration: 4000 })
  })
}

// Beep curto via Web Audio API — sem precisar baixar mp3.
// 2 tons rápidos pra não passar batido mas também não incomodar.
let _audioCtx: AudioContext | null = null
function playBeep() {
  try {
    if (typeof window === 'undefined') return
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    if (!_audioCtx) _audioCtx = new Ctx()
    const ctx = _audioCtx
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    const now = ctx.currentTime
    const tone = (freq: number, start: number, dur = 0.12) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.01)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + dur)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + dur + 0.02)
    }
    tone(880, now)
    tone(1320, now + 0.13)
  } catch {
    /* silencia — som é nice-to-have */
  }
}
