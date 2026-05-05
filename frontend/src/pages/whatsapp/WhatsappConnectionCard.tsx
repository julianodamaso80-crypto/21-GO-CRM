import { useEffect, useState } from 'react'
import { Loader2, QrCode, CheckCircle2, XCircle, RotateCcw, Trash2, Smartphone } from 'lucide-react'
import {
  useWhatsappInstance,
  useCreateWhatsapp,
  useDeleteWhatsapp,
  useLogoutWhatsapp,
  useWhatsappStatus,
} from '../../hooks/useWhatsapp'

/**
 * Card de conexão do WhatsApp do user logado.
 * - Se não tem instância: botão "Conectar WhatsApp"
 * - Se tem instância em QR_PENDING: mostra QR + polling 3s
 * - Se CONNECTED: mostra perfil + telefone + botões desconectar/remover
 */
export function WhatsappConnectionCard() {
  const { data: instance, isLoading } = useWhatsappInstance()
  const createMutation = useCreateWhatsapp()
  const deleteMutation = useDeleteWhatsapp()
  const logoutMutation = useLogoutWhatsapp()

  const isWaitingQr = instance?.status === 'QR_PENDING' || instance?.status === 'DISCONNECTED'
  const { data: liveStatus } = useWhatsappStatus(!!instance && isWaitingQr)

  const [createdQr, setCreatedQr] = useState<string | null>(null)

  // se acabou de criar, guarda o QR inicial até polling pegar o atualizado
  useEffect(() => {
    if (createMutation.isSuccess && createMutation.data?.qrCodeBase64) {
      setCreatedQr(createMutation.data.qrCodeBase64)
    }
  }, [createMutation.isSuccess, createMutation.data])

  if (isLoading) {
    return (
      <div className="card p-6 flex items-center justify-center">
        <Loader2 className="w-5 h-5 text-gold-400 animate-spin" />
      </div>
    )
  }

  // Sem instância → botão pra conectar
  if (!instance) {
    return (
      <div className="card p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-display font-semibold text-white">Conecte seu WhatsApp</h3>
            <p className="text-sm text-gray-400 mt-1">
              Atenda seus clientes pelo WhatsApp diretamente do CRM. Suas conversas aparecerão aqui.
            </p>
            <button
              onClick={() => createMutation.mutate(undefined)}
              disabled={createMutation.isPending}
              className="btn-primary mt-4 inline-flex items-center gap-2 text-sm"
            >
              {createMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <QrCode className="w-4 h-4" />
              )}
              {createMutation.isPending ? 'Criando…' : 'Conectar WhatsApp'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  const effectiveStatus = liveStatus?.status ?? instance.status
  const qr = liveStatus?.qrCodeBase64 ?? createdQr

  return (
    <div className="card p-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0 flex-1">
          {liveStatus?.profilePicUrl || instance.profilePicUrl ? (
            <img
              src={liveStatus?.profilePicUrl || instance.profilePicUrl || ''}
              alt="Avatar"
              className="w-12 h-12 rounded-2xl object-cover border border-dark-700/50"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <Smartphone className="w-6 h-6 text-emerald-400" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-display font-semibold text-white truncate">
              {liveStatus?.profileName || instance.profileName || instance.name}
            </h3>
            <p className="text-sm text-gray-400 mt-0.5">
              {liveStatus?.phone || instance.phone
                ? `+${liveStatus?.phone || instance.phone}`
                : instance.evolutionName}
            </p>
            <div className="mt-2">
              <StatusBadge status={effectiveStatus} />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {effectiveStatus === 'CONNECTED' && (
            <button
              onClick={() => {
                if (confirm('Desconectar WhatsApp? Você poderá reconectar depois.')) {
                  logoutMutation.mutate()
                }
              }}
              disabled={logoutMutation.isPending}
              className="btn-secondary inline-flex items-center gap-2 text-xs px-3 py-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Desconectar
            </button>
          )}
          <button
            onClick={() => {
              if (confirm('Remover instância? Isso apaga tudo na Evolution.')) {
                deleteMutation.mutate()
              }
            }}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remover
          </button>
        </div>
      </div>

      {/* QR Code (se aguardando) */}
      {effectiveStatus !== 'CONNECTED' && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-dark-700/40 bg-dark-800/40 p-6">
          {qr ? (
            <img
              src={qr.startsWith('data:') ? qr : `data:image/png;base64,${qr}`}
              alt="QR Code WhatsApp"
              className="w-64 h-64 rounded-lg bg-white p-2"
            />
          ) : (
            <div className="w-64 h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-gold-400" />
            </div>
          )}
          <div className="text-center max-w-md">
            <p className="text-sm font-medium text-white">Escaneie o QR Code</p>
            <p className="text-xs text-gray-400 mt-1">
              Abra o WhatsApp → Configurações → <strong>Aparelhos conectados</strong> → <strong>Conectar aparelho</strong>
            </p>
            <p className="text-[11px] text-gray-500 mt-2">QR Code expira em 30s — está sendo renovado automaticamente</p>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const base = 'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border'
  if (status === 'CONNECTED')
    return (
      <span className={`${base} bg-emerald-500/10 border-emerald-500/30 text-emerald-400`}>
        <CheckCircle2 className="w-3 h-3" /> Conectado
      </span>
    )
  if (status === 'QR_PENDING')
    return (
      <span className={`${base} bg-amber-500/10 border-amber-500/30 text-amber-400`}>
        <QrCode className="w-3 h-3" /> Aguardando QR
      </span>
    )
  return (
    <span className={`${base} bg-dark-700/50 border-dark-600/40 text-gray-400`}>
      <XCircle className="w-3 h-3" /> Desconectado
    </span>
  )
}
