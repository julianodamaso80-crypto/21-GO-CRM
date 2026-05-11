import { useSocket } from '../contexts/SocketContext'
import { Wifi, WifiOff, Loader2 } from 'lucide-react'

/**
 * Indicador visual do estado do socket em tempo real.
 *
 * 🟢 ao vivo (connected) — eventos chegam em < 2s do servidor
 * 🟡 reconectando (connecting) — caiu, tentando voltar
 * 🔴 offline (disconnected) — sem conexão real-time; UI cai pro polling
 *
 * Útil pro user saber se mensagens novas vão aparecer sozinhas ou se
 * precisa F5. Sem ele, a frustração era "será que tá funcionando?"
 */
export function SocketStatusBadge() {
  const { connectionStatus } = useSocket()

  if (connectionStatus === 'connected') {
    return (
      <div
        title="Conectado em tempo real — mensagens chegam automaticamente"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30"
      >
        <Wifi size={12} className="text-emerald-400" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400">ao vivo</span>
      </div>
    )
  }

  if (connectionStatus === 'connecting') {
    return (
      <div
        title="Reconectando ao servidor — aguarde"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30"
      >
        <Loader2 size={12} className="text-amber-400 animate-spin" />
        <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-400">reconectando</span>
      </div>
    )
  }

  return (
    <div
      title="Sem conexão em tempo real — atualização a cada 15s"
      className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-red-500/10 border border-red-500/30"
    >
      <WifiOff size={12} className="text-red-400" />
      <span className="text-[10px] font-semibold uppercase tracking-wider text-red-400">offline</span>
    </div>
  )
}
