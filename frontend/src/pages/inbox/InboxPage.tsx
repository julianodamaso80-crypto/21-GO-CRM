import { useState, useRef, useEffect } from 'react'
import {
  MessageSquare,
  Send,
  Loader2,
  Bot,
  User,
  CheckCheck,
  Search,
} from 'lucide-react'
import { useConversations, useMessages, useSendMessage, useUpdateConversationStatus, useMarkAsRead } from '../../hooks/useInbox'
import type { Conversation, Message, ConversationStatus } from '../../../../shared/types'
import { MessageContent } from '../../components/MessageContent'

const STATUS_MAP: Record<ConversationStatus, { label: string; cls: string }> = {
  open: { label: 'Aberto', cls: 'bg-accent-blue/15 text-accent-blue' },
  assigned: { label: 'Atribuido', cls: 'bg-accent-purple/15 text-accent-purple' },
  resolved: { label: 'Resolvido', cls: 'bg-accent-emerald/15 text-accent-emerald' },
  closed: { label: 'Fechado', cls: 'bg-dark-700/50 text-gray-400' },
}

const CHANNEL_ICON: Record<string, string> = {
  webchat: 'WC',
  whatsapp: 'WA',
  instagram: 'IG',
}

export function InboxPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchTerm, setSearchTerm] = useState('')

  const { data: conversations, isLoading } = useConversations(statusFilter ? { status: statusFilter } : {})
  const markAsRead = useMarkAsRead()

  const filtered = (conversations || []).filter((c) => {
    if (!searchTerm) return true
    const s = searchTerm.toLowerCase()
    return (
      c.contact?.fullName?.toLowerCase().includes(s) ||
      c.contact?.firstName?.toLowerCase().includes(s) ||
      (c as any).lastMessagePreview?.toLowerCase().includes(s)
    )
  })

  const handleSelect = (conv: Conversation) => {
    setSelectedId(conv.id)
    if ((conv.unreadCount ?? 0) > 0) markAsRead.mutate(conv.id)
  }

  return (
    <div className="flex h-full page-enter">
      {/* Conversations List */}
      <div className="w-80 border-r border-dark-700/40 flex flex-col bg-dark-800/60">
        {/* Header */}
        <div className="px-4 py-3 border-b border-dark-700/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-display font-semibold text-white">Inbox</h2>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-xs px-2 py-1 border border-dark-600 rounded-md bg-dark-800 text-gray-200"
            >
              <option value="">Todos</option>
              <option value="open">Abertos</option>
              <option value="assigned">Atribuidos</option>
              <option value="resolved">Resolvidos</option>
              <option value="closed">Fechados</option>
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

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-gold-400 animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 px-4">
              <MessageSquare className="w-10 h-10 text-gray-600 mx-auto mb-2" />
              <p className="text-sm text-gray-500">Nenhuma conversa</p>
            </div>
          ) : (
            filtered.map((conv) => {
              const unread = conv.unreadCount ?? 0
              const hasUnread = unread > 0
              return (
              <button
                key={conv.id}
                onClick={() => handleSelect(conv)}
                className={`w-full text-left px-4 py-3 border-b border-dark-700/40 hover:bg-dark-700/50 transition-colors relative ${
                  selectedId === conv.id ? 'bg-gold-500/10 border-l-2 border-l-gold-500' : ''
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium text-gray-400 flex-shrink-0">
                    {conv.contact?.firstName?.[0]}{conv.contact?.lastName?.[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm truncate ${hasUnread ? 'font-bold text-white' : 'font-medium text-gray-300'}`}>
                        {conv.contact?.fullName || conv.contact?.firstName || 'Contato'}
                      </span>
                      <span className={`text-[10px] whitespace-nowrap ${hasUnread ? 'text-gold-400 font-semibold' : 'text-gray-500'}`}>
                        {formatTimeAgo(conv.lastMessageAt || conv.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] px-1 py-0.5 rounded bg-dark-700 text-gray-400 font-medium">
                        {CHANNEL_ICON[conv.channel?.type] || conv.channel?.type}
                      </span>
                      <p className={`text-xs truncate flex-1 ${hasUnread ? 'text-gray-50 font-semibold' : 'text-gray-400'}`}>
                        {(conv as any).lastMessagePreview || 'Sem mensagens'}
                      </p>
                      {hasUnread && (
                        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 rounded-full bg-gold-500 text-dark-900 text-[10px] font-bold leading-none flex-shrink-0">
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

      {/* Chat Panel */}
      {selectedId ? (
        <ChatPanel
          conversationId={selectedId}
          conversation={filtered.find((c) => c.id === selectedId) || null}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-dark-900">
          <div className="text-center">
            <MessageSquare className="w-16 h-16 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">Selecione uma conversa para ver as mensagens</p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Chat Panel ──

function ChatPanel({ conversationId, conversation }: { conversationId: string; conversation: Conversation | null }) {
  const { data: messages, isLoading } = useMessages(conversationId)
  const sendMessage = useSendMessage()
  const updateStatus = useUpdateConversationStatus()
  const [text, setText] = useState('')
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
      {/* Chat Header */}
      {conversation && (
        <div className="px-5 py-3 border-b border-dark-700/40 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-dark-700 flex items-center justify-center text-xs font-medium text-gray-400">
              {conversation.contact?.firstName?.[0]}{conversation.contact?.lastName?.[0]}
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                {conversation.contact?.fullName || conversation.contact?.firstName}
              </p>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span>{CHANNEL_ICON[conversation.channel?.type]} - {conversation.channel?.name}</span>
                {conversation.isBotActive && (
                  <span className="flex items-center gap-0.5 text-purple-400">
                    <Bot className="w-3 h-3" /> IA ativa
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={conversation.status} />
            <select
              value={conversation.status}
              onChange={(e) => updateStatus.mutate({ conversationId, status: e.target.value })}
              className="text-xs px-2 py-1 border border-dark-600 rounded-md bg-dark-800 text-gray-200"
            >
              <option value="open">Aberto</option>
              <option value="assigned">Atribuido</option>
              <option value="resolved">Resolvido</option>
              <option value="closed">Fechado</option>
            </select>
          </div>
        </div>
      )}

      {/* Messages */}
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
            placeholder="Digite sua mensagem... (Enter para enviar)"
            rows={1}
            className="flex-1 px-3 py-2 text-sm bg-dark-800 border border-dark-600 text-gray-200 rounded-lg resize-none focus:ring-2 focus:ring-gold-500/30 focus:border-gold-500"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="p-2.5 btn-primary rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sendMessage.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ──

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === 'outbound'

  return (
    <div className={`flex ${isOutbound ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-xl px-3.5 py-2 ${
          isOutbound
            ? 'bg-gold-500 text-white rounded-br-sm'
            : 'bg-dark-800 border border-dark-700/40 text-gray-100 rounded-bl-sm'
        }`}
      >
        {/* Sender label */}
        {isOutbound && (
          <div className="flex items-center gap-1 mb-0.5">
            {message.isFromBot ? (
              <Bot className="w-3 h-3 text-blue-200" />
            ) : (
              <User className="w-3 h-3 text-blue-200" />
            )}
            <span className="text-[10px] text-blue-200">
              {message.isFromBot ? 'IA' : message.sender ? `${message.sender.firstName}` : 'Voce'}
            </span>
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

function StatusBadge({ status }: { status: ConversationStatus }) {
  const s = STATUS_MAP[status] || { label: status, cls: 'bg-dark-700 text-gray-400' }
  return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
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
