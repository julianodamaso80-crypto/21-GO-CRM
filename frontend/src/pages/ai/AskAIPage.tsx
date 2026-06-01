import { useState, useRef, useEffect, KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, Send, Loader2, Database, AlertCircle, RotateCcw } from 'lucide-react'
import { aiAskService, type AskAIResult } from '../../services/ai-ask.service'

const SUGGESTIONS = [
  'Quantas vendas tivemos essa semana?',
  'Qual canal está convertendo melhor?',
  'De onde vieram os leads dos últimos 30 dias?',
  'Comparativo de receita: essa semana vs semana passada',
  'Sinistros abertos no mês',
  'Quantos leads do Meta Ads viraram clientes?',
  'Receita total dos últimos 90 dias',
  'Qual a taxa de conversão por canal?',
]

const TOOL_LABEL: Record<string, string> = {
  get_vendas_periodo: 'consultou vendas',
  get_leads_por_origem: 'consultou origem dos leads',
  get_ranking_canais: 'consultou ranking de canais',
  get_comparativo_periodos: 'comparou períodos',
  get_sinistros_periodo: 'consultou sinistros',
}

interface ChatTurn {
  id: string
  question: string
  result?: AskAIResult
  error?: string
  loading: boolean
}

export function AskAIPage() {
  const [question, setQuestion] = useState('')
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns])

  const mutation = useMutation({
    mutationFn: async ({ id, q }: { id: string; q: string }) => {
      const result = await aiAskService.ask(q)
      return { id, result }
    },
    onSuccess: ({ id, result }) => {
      setTurns((prev) => prev.map((t) => (t.id === id ? { ...t, result, loading: false } : t)))
    },
    onError: (err: any, variables) => {
      const msg = err?.response?.data?.message || err?.message || 'Falha ao consultar a IA.'
      setTurns((prev) => prev.map((t) => (t.id === variables.id ? { ...t, error: msg, loading: false } : t)))
    },
  })

  const submit = (text?: string) => {
    const q = (text ?? question).trim()
    if (!q || mutation.isPending) return
    const id = String(Date.now())
    setTurns((prev) => [...prev, { id, question: q, loading: true }])
    setQuestion('')
    mutation.mutate({ id, q })
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const reset = () => setTurns([])

  return (
    <div className="relative min-h-[calc(100vh-4rem)] flex flex-col">
      {/* Background glow */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-50"
        style={{
          background:
            'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(242, 145, 29, 0.10), transparent 60%), radial-gradient(ellipse 50% 35% at 100% 100%, rgba(41, 60, 130, 0.12), transparent 50%)',
        }}
      />

      <div className="relative z-10 flex-1 flex flex-col p-6 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-gold-400/30 to-gold-600/20 border border-gold-500/30 flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-gold-300" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-bold text-white tracking-tight">Pergunte à IA</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                Consulta dados reais do seu CRM. Pergunte em português.
              </p>
            </div>
          </div>
          {turns.length > 0 && (
            <button
              onClick={reset}
              className="text-xs text-gray-400 hover:text-gold-300 flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dark-700/50 hover:border-gold-500/30 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpar conversa
            </button>
          )}
        </div>

        {/* Chat area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-4 pb-6 pr-1">
          {turns.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500 mb-6">
                Pergunte sobre vendas, leads, canais de mídia, sinistros — tudo do seu CRM em tempo real.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-3xl mx-auto">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => submit(s)}
                    className="text-left text-sm px-4 py-3 rounded-xl bg-dark-800/40 border border-dark-700/50 text-gray-300 hover:text-gold-200 hover:border-gold-500/30 hover:bg-gold-500/5 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {turns.map((turn) => (
            <div key={turn.id} className="space-y-2">
              {/* User question */}
              <div className="flex justify-end">
                <div className="max-w-[80%] bg-gradient-to-br from-blue-600/30 to-blue-700/20 border border-blue-500/30 rounded-2xl rounded-tr-md px-4 py-2.5 text-sm text-white">
                  {turn.question}
                </div>
              </div>

              {/* AI response */}
              <div className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                  <div className="bg-dark-800/60 border border-dark-700/50 rounded-2xl rounded-tl-md px-4 py-3">
                    {turn.loading && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin text-gold-400" />
                        <span>Consultando o sistema...</span>
                      </div>
                    )}
                    {turn.error && (
                      <div className="flex items-start gap-2 text-sm text-rose-300">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <span>{turn.error}</span>
                      </div>
                    )}
                    {turn.result && (
                      <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
                        {renderInline(turn.result.answer)}
                      </p>
                    )}
                  </div>

                  {turn.result && turn.result.toolsUsed.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap pl-2">
                      <Database className="w-3 h-3 text-gray-600" />
                      <span className="text-[10px] uppercase tracking-wider text-gray-600">Dados:</span>
                      {turn.result.toolsUsed.map((t, i) => (
                        <span
                          key={i}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                        >
                          {TOOL_LABEL[t.name] || t.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Input fixo no fim */}
        <div className="sticky bottom-0 pt-4 bg-gradient-to-t from-dark-950 via-dark-950/95 to-transparent">
          <div className="relative">
            <textarea
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKey}
              placeholder="Pergunte qualquer coisa sobre seus dados..."
              rows={2}
              disabled={mutation.isPending}
              className="w-full bg-dark-900/80 backdrop-blur-xl border border-dark-700/60 rounded-2xl px-4 py-3 pr-14 text-sm text-gray-100 placeholder:text-gray-600 resize-none focus:outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/10 transition disabled:opacity-50 shadow-lg"
            />
            <button
              onClick={() => submit()}
              disabled={!question.trim() || mutation.isPending}
              className="absolute right-3 bottom-3 w-9 h-9 rounded-lg bg-gradient-to-br from-gold-500 to-gold-600 hover:from-gold-400 hover:to-gold-500 disabled:from-dark-700 disabled:to-dark-700 disabled:cursor-not-allowed flex items-center justify-center shadow-lg shadow-gold-500/20 transition-all hover:shadow-gold-500/40 disabled:shadow-none"
              title="Enviar (Enter)"
            >
              {mutation.isPending ? (
                <Loader2 className="w-4 h-4 text-white animate-spin" />
              ) : (
                <Send className="w-4 h-4 text-white" />
              )}
            </button>
          </div>
          <p className="text-[10px] text-gray-600 mt-2 text-center">
            Enter pra enviar · Shift+Enter pra quebrar linha · A IA consulta dados reais do seu CRM
          </p>
        </div>
      </div>
    </div>
  )
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return (
        <strong key={i} className="text-gold-300 font-semibold">
          {p.slice(2, -2)}
        </strong>
      )
    }
    return <span key={i}>{p}</span>
  })
}
