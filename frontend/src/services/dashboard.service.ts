import { api } from '../lib/api'
import type { DashboardPeriod, DashboardStats } from '../../../shared/types'

export const dashboardService = {
  async getStats(period: DashboardPeriod = 7): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/dashboard/stats', {
      params: { periodDays: String(period) },
    })
    return response.data
  },
}
