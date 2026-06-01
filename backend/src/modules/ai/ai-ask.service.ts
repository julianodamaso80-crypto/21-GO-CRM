/**
 * Serviço de Q&A do dashboard via OpenRouter (formato OpenAI Chat Completions).
 * Modelo default: Claude Haiku 4.5 (configurável via OPENROUTER_MODEL).
 * Loop de tool use consulta dados reais do CRM antes de responder.
 */
import { env } from '../../config/env'
import { logger } from '../../utils/logger'
import { AppError } from '../../utils/app-error'
import { CRM_TOOLS, executeToolCall, type ToolContext } from './tools/crm-tools'

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MAX_TOOL_ITERATIONS = 5
const MAX_OUTPUT_TOKENS = 1024

const SYSTEM_PROMPT = `Você é o assistente de dados da 21Go — associação de proteção veicular do Rio de Janeiro.

Seu papel é responder perguntas do gestor sobre o estado real do negócio, usando APENAS dados que você puxa via ferramentas. Nunca invente números.

REGRAS:
1. Sempre que a pergunta envolver dados (vendas, leads, canais, sinistros, comparativos), use uma das ferramentas disponíveis. NÃO chute valores.
2. Interprete o período da pergunta:
   - "hoje" → period_days = 1
   - "essa semana" / "semana passada" / "última semana" → 7
   - "esse mês" / "último mês" / "30 dias" → 30
   - "trimestre" / "últimos 3 meses" → 90
   - Se ambíguo, assuma 7 dias.
3. Responda em português, direto e curto (no máximo 4 linhas). Use **negrito** pros números importantes.
4. Quando o usuário perguntar "qual anúncio/canal está melhor" — use get_ranking_canais e foque na taxa de conversão, não no volume.
5. Quando faltarem dados (ex: receita zerada), explique o motivo provável (campos não preenchidos).
6. Se a pergunta NÃO for sobre dados do CRM (ex: "como funciona proteção veicular"), responda do seu conhecimento sem chamar ferramentas.
7. Termine respostas com uma micro-recomendação prática se fizer sentido (ex: "Vale escalar verba no Google.").`

interface OAIMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string | null
  tool_calls?: Array<{
    id: string
    type: 'function'
    function: { name: string; arguments: string }
  }>
  tool_call_id?: string
}

interface OAIChoice {
  message: {
    role: 'assistant'
    content: string | null
    tool_calls?: Array<{
      id: string
      type: 'function'
      function: { name: string; arguments: string }
    }>
  }
  finish_reason: 'stop' | 'tool_calls' | 'length' | 'content_filter' | string
}

interface OAIResponse {
  id: string
  choices: OAIChoice[]
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number }
}

export interface AskAIResult {
  answer: string
  toolsUsed: Array<{ name: string; input: any }>
  iterations: number
  tokensIn: number
  tokensOut: number
  model: string
}

function toolsAsOpenAI() {
  return CRM_TOOLS.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.input_schema,
    },
  }))
}

async function callOpenRouter(messages: OAIMessage[]): Promise<OAIResponse> {
  const apiKey = env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new AppError('OPENROUTER_API_KEY não configurada — não é possível consultar a IA', 503, 'AI_NOT_CONFIGURED')
  }

  const body = {
    model: env.OPENROUTER_MODEL,
    max_tokens: MAX_OUTPUT_TOKENS,
    messages,
    tools: toolsAsOpenAI(),
    tool_choice: 'auto',
  }

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': env.OPENROUTER_REFERER,
      'X-Title': env.OPENROUTER_APP_TITLE,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    logger.error({ status: res.status, body: text.slice(0, 500) }, 'openrouter api error')
    throw new AppError(`IA respondeu com erro (${res.status})`, 502, 'AI_PROVIDER_ERROR')
  }

  return (await res.json()) as OAIResponse
}

export class AskAIService {
  async ask(question: string, ctx: ToolContext): Promise<AskAIResult> {
    const messages: OAIMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: question },
    ]
    const toolsUsed: Array<{ name: string; input: any }> = []
    let totalIn = 0
    let totalOut = 0

    for (let iteration = 1; iteration <= MAX_TOOL_ITERATIONS; iteration++) {
      const response = await callOpenRouter(messages)
      if (response.usage) {
        totalIn += response.usage.prompt_tokens
        totalOut += response.usage.completion_tokens
      }

      const choice = response.choices[0]
      if (!choice) {
        throw new AppError('IA retornou resposta vazia', 502, 'AI_EMPTY_RESPONSE')
      }

      const assistantMsg = choice.message

      if (choice.finish_reason !== 'tool_calls' || !assistantMsg.tool_calls?.length) {
        const answer = (assistantMsg.content || '').trim()
        return {
          answer: answer || 'Não consegui formular uma resposta.',
          toolsUsed,
          iterations: iteration,
          tokensIn: totalIn,
          tokensOut: totalOut,
          model: env.OPENROUTER_MODEL,
        }
      }

      messages.push({
        role: 'assistant',
        content: assistantMsg.content,
        tool_calls: assistantMsg.tool_calls,
      })

      for (const tc of assistantMsg.tool_calls) {
        const toolName = tc.function.name
        let parsedInput: Record<string, any> = {}
        try {
          parsedInput = JSON.parse(tc.function.arguments || '{}')
        } catch {
          parsedInput = {}
        }

        toolsUsed.push({ name: toolName, input: parsedInput })
        logger.info({ tool: toolName, input: parsedInput }, 'ai tool call')

        let resultContent: string
        try {
          resultContent = await executeToolCall(toolName, parsedInput, ctx)
        } catch (err: any) {
          logger.error({ err: err?.message, tool: toolName }, 'tool execution failed')
          resultContent = JSON.stringify({ erro: err?.message || 'falha ao executar ferramenta' })
        }

        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content: resultContent,
        })
      }
    }

    return {
      answer: 'A pergunta exigiu muitas consultas e não consegui concluir. Tenta perguntar de forma mais específica.',
      toolsUsed,
      iterations: MAX_TOOL_ITERATIONS,
      tokensIn: totalIn,
      tokensOut: totalOut,
      model: env.OPENROUTER_MODEL,
    }
  }
}

export const askAIService = new AskAIService()
