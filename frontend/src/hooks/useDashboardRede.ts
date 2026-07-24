import { useQuery } from '@tanstack/react-query'
import { dashboardRedeService, type CicloRef } from '../services/dashboard-rede.service'

/**
 * Dashboard Hibrido da rede. `retry: false` para que o 404 de "sem rede vinculada"
 * caia direto no fallback do funil, sem ficar re-tentando.
 */
export function useDashboardRede(ciclo?: CicloRef) {
  return useQuery({
    queryKey: ['dashboard', 'rede', ciclo?.contrato ?? null, ciclo?.pagamento ?? null],
    queryFn: () => dashboardRedeService.get(ciclo),
    staleTime: 5 * 60_000,
    retry: false,
  })
}
