import { useState, KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Sparkles, Send, Loader2, Database, AlertCircle } from 'lucide-react'
import { aiAskService, type AskAIResult } from '../../services/ai-ask.service'

const SUGGESTIONS = [
  'Quantas vendas tivemos essa semana?',
  'Qual canal está convertendo melhor?',
  'De onde vieram os leads dos últimos 30 dias?',
  'Comparativo de receita: essa semana vs semana passada',
  'Sinistros abertos no mês',
]

const TOOL_LABEL: Record<string, string> = {
  get_vendas_periodo: 'consultou vendas',
  get_leads_por_origem: 'consultou origem dos leads',
  get_ranking_canais: 'consultou ranking de canais',
  get_comparativo_periodos: 'comparou períodos',
  get_sinistros_periodo: 'consultou sinistros',
}

export function DashboardAskAI() {
  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<AskAIResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (q: string) => aiAskService.ask(q),
    onSuccess: (data) => {
      setResult(data)
      setError(null)
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Falha ao consultar a IA.'
      setError(msg)
      setResult(null)
    },
  })

  const submit = () => {
    const q = question.trim()
    if (!q || mutation.isPending) return
    mutation.mutate(q)
  }

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const pickSuggestion = (s: string) => {
    setQuestion(s)
    mutation.mutate(s)
  }

  return (
    <div className="relative bg-gradient-to-br from-blue-950/40 via-dark-800/60 to-dark-900/60 backdrop-blur-xl border border-blue-500/20 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.35)] overflow-hidden">
      {/* Glow decorativo */}
      <div
        className="pointer-events-none absolute -top-20 -right-20 w-80 h-80 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(circle, #F2911D 0%, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-15 blur-3xl"
        style={{ background: 'radial-gradient(circle, #293C82 0%, transparent 70%)' }}
      />

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold-400/30 to-gold-600/20 border border-gold-500/30 flex items-center justify-center shadow-inner">
            <Sparkles className="w-5 h-5 text-gold-300" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-display font-bold text-white tracking-tight">Pergunte à IA</h3>
            <p className="text-sm text-gray-400 mt-0.5">
              Consulta dados reais do seu CRM. Pergunte em português, do jeito que você falaria com um analista.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="relative">
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ex: quantas adesões tivemos essa semana? Qual anúncio está convertendo melhor?"
            rows={2}
            disabled={mutation.isPending}
            className="w-full bg-dark-900/60 border border-dark-700/60 rounded-xl px-4 py-3 pr-14 text-sm text-gray-100 placeholder:text-gray-600 resize-none focus:outline-none focus:border-gold-500/50 focus:ring-2 focus:ring-gold-500/10 transition disabled:opacity-50"
          />
          <button
            onClick={submit}
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

        {/* Sugestões */}
        {!result && !mutation.isPending && (
          <div className="flex flex-wrap gap-2 mt-3">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => pickSuggestion(s)}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-dark-800/60 border border-dark-700/50 text-gray-400 hover:text-gold-300 hover:border-gold-500/30 hover:bg-gold-500/5 transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Loading */}
        {mutation.isPending && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
            <Loader2 className="w-4 h-4 animate-spin text-gold-400" />
            <span>Consultando o sistema...</span>
          </div>
        )}

        {/* Erro */}
        {error && !mutation.isPending && (
          <div className="mt-4 flex items-start gap-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-300">{error}</p>
          </div>
        )}

        {/* Resultado */}
        {result && !mutation.isPending && (
          <div className="mt-4 space-y-2.5">
            <div className="bg-dark-900/60 border border-dark-700/60 rounded-xl p-4">
              <p className="text-sm text-gray-100 leading-relaxed whitespace-pre-wrap">
                {renderInline(result.answer)}
              </p>
            </div>

            {result.toolsUsed.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <Database className="w-3 h-3 text-gray-600" />
                <span className="text-[10px] uppercase tracking-wider text-gray-600">Dados consultados:</span>
                {result.toolsUsed.map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
                  >
                    {TOOL_LABEL[t.name] || t.name}
                  </span>
                ))}
              </div>
            )}

            <button
              onClick={() => {
                setResult(null)
                setQuestion('')
              }}
              className="text-xs text-gray-500 hover:text-gold-400 transition-colors"
            >
              ← Nova pergunta
            </button>
          </div>
        )}
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
