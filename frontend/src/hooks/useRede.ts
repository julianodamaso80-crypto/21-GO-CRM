import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { redeService, type FiltrosPlacas } from '../services/rede.service'

/** A arvore inteira vem de uma vez: sao 764 linhas do espelho, leitura barata. */
export function useArvoreRede() {
  return useQuery({
    queryKey: ['rede', 'arvore'],
    queryFn: () => redeService.arvore(),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function usePlacar(contrato: string, pagamento: string) {
  return useQuery({
    queryKey: ['rede', 'placar', contrato, pagamento],
    queryFn: () => redeService.placar(contrato, pagamento),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function usePlacas(filtros: FiltrosPlacas, enabled = true) {
  return useQuery({
    queryKey: ['rede', 'placas', filtros],
    queryFn: () => redeService.placas(filtros),
    staleTime: 5 * 60_000,
    enabled,
    retry: false,
  })
}

export function useSincronizar() {
  return useMutation({
    mutationFn: redeService.sincronizar,
    onSuccess: () => toast.success('Sincronização iniciada. Você continua vendo os dados atuais até terminar.'),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Não foi possível iniciar a sincronização.'),
  })
}

/** Enquanto a carga roda, pergunta o progresso a cada 10s. Para sozinho quando termina. */
export function useProgressoCarga(cargaId: string | null) {
  return useQuery({
    queryKey: ['rede', 'sync', cargaId],
    queryFn: () => redeService.progresso(cargaId!),
    enabled: !!cargaId,
    refetchInterval: (q: any) => (q.state.data?.status === 'rodando' ? 10_000 : false),
  })
}
