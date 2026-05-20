import { useQuery } from '@tanstack/react-query'
import { dashboardService } from '../services/dashboard.service'
import type { DashboardPeriod } from '../../../shared/types'

export function useDashboardStats(period: DashboardPeriod = 7) {
  return useQuery({
    queryKey: ['dashboard', 'stats', period],
    queryFn: () => dashboardService.getStats(period),
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 60 * 5,
  })
}
