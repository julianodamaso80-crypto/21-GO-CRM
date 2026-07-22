import { useState } from 'react'
import { X, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { MembroRede } from '../../services/rede.service'
import { useSincronizar, useProgressoCarga } from '../../hooks/useRede'

const ETAPAS: Record<string, string> = {
  rede: 'etapa 1 de 3 (pessoas do Power)',
  placas: 'etapa 2 de 3 (placas do SGA)',
  boletos: 'etapa 3 de 3 (boletos do SGA)',
  publicando: 'publicando',
  fim: 'concluída',
}

const PROGRESSO: Record<string, number> = { rede: 33, placas: 66, boletos: 90, publicando: 98, fim: 100 }

export function PainelSincronizacao({ raiz, contrato, pagamento, onFechar }: {
  raiz: MembroRede
  contrato: string
  pagamento: string
  onFechar: () => void
}) {
  const [cargaId, setCargaId] = useState<string | null>(null)
  const sincronizar = useSincronizar()
  const progresso = useProgressoCarga(cargaId)

  const rodando = progresso.data?.status === 'rodando'

  return (
    <div className="card mt-4 border-blue-500/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-dark-100">Atualizar dados da rede</h3>
          <p className="text-xs text-dark-400 mt-0.5">
            Traz as pessoas do Power e as placas do SGA. Leva cerca de 30 minutos.
          </p>
        </div>
        <button onClick={onFechar} aria-label="Fechar painel"
          className="h-8 w-8 grid place-items-center rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {progresso.data?.status === 'falhou' && (
        <div className="badge-warning mt-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            A sincronização parou na etapa {progresso.data.etapa}. Os dados anteriores continuam valendo.
            Motivo: {progresso.data.erro}
          </span>
        </div>
      )}

      {progresso.data?.status === 'publicada' && (
        <div className="badge-success mt-3 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sincronização concluída. Recarregue a página para ver os números novos.
        </div>
      )}

      {rodando && (
        <div className="mt-3">
          <div className="badge-info flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Sincronização em andamento — {ETAPAS[progresso.data!.etapa] ?? progresso.data!.etapa}.
            Você continua vendo os dados atuais até terminar.
          </div>
          <div className="mini-progress mt-2">
            <div className="mini-progress-track">
              <div className="mini-progress-fill" style={{ width: `${PROGRESSO[progresso.data!.etapa] ?? 10}%` }} />
            </div>
          </div>
        </div>
      )}

      <button
        disabled={rodando || sincronizar.isPending}
        onClick={() => sincronizar.mutate(
          { raizPowerId: raiz.powerId, raizNome: raiz.nome, raizCpf: raiz.cpf, mesContrato: contrato, mesPagamento: pagamento },
          { onSuccess: (r) => setCargaId(r.cargaId) },
        )}
        className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
      >
        <RefreshCw className="w-4 h-4" />
        {rodando ? 'Sincronizando…' : progresso.data?.status === 'falhou' ? 'Tentar de novo' : 'Sincronizar agora'}
      </button>
    </div>
  )
}
