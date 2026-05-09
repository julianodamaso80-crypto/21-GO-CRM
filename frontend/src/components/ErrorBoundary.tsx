import { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
  /** Texto exibido quando o boundary captura um erro. */
  fallbackTitle?: string
  fallbackMessage?: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Captura erros de render dentro do filho e mostra fallback gracioso.
 * Adicionado no Projeto Japão Fase 3 pra evitar tela branca quando endpoints
 * de IA retornam 503 ou estruturas inesperadas.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const title = this.props.fallbackTitle || 'Funcionalidade em manutenção'
    const message =
      this.props.fallbackMessage ||
      'Algo deu errado ao carregar este conteúdo. A equipe foi notificada. Você pode continuar usando o resto do sistema normalmente.'

    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-xl border border-orange-500/20 bg-orange-500/5">
        <AlertTriangle className="w-10 h-10 text-orange-400 mb-3" />
        <h3 className="text-lg font-semibold text-orange-300 mb-1">{title}</h3>
        <p className="text-sm text-gray-400 text-center max-w-md">{message}</p>
        {this.state.error?.message && (
          <p className="text-xs text-gray-500 mt-3 font-mono">{this.state.error.message}</p>
        )}
      </div>
    )
  }
}
