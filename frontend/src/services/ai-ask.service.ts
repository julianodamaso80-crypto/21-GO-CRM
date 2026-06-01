import { api } from '../lib/api'

export interface AskAIResult {
  answer: string
  toolsUsed: Array<{ name: string; input: Record<string, any> }>
  iterations: number
  tokensIn: number
  tokensOut: number
}

export const aiAskService = {
  async ask(question: string): Promise<AskAIResult> {
    const response = await api.post<AskAIResult>('/ai/ask', { question })
    return response.data
  },
}
