import { api } from '../lib/api'
import type {
  AnalyticsFilters,
  AnalyticsOverview,
  SourceAnalyticsResponse,
  CampaignAnalyticsResponse,
  FunnelAnalyticsResponse,
  LTVAnalyticsResponse,
  ROIAnalyticsResponse,
  TrendsAnalyticsResponse,
} from '../../../shared/types'

export const analyticsService = {
  async getOverview(filters: AnalyticsFilters = {}): Promise<AnalyticsOverview> {
    const response = await api.get<AnalyticsOverview>('/analytics/overview', { params: filters })
    return response.data
  },

  async getSources(filters: AnalyticsFilters = {}): Promise<SourceAnalyticsResponse> {
    const response = await api.get<SourceAnalyticsResponse>('/analytics/sources', { params: filters })
    return response.data
  },

  async getByState(filters: AnalyticsFilters = {}): Promise<{
    data: Array<{ uf: string; estado: string; leads: number; aprovados: number; conversao: number }>
    totals: { leads: number; aprovados: number }
  }> {
    const response = await api.get('/analytics/by-state', { params: filters })
    return response.data as any
  },

  async getByVehicleType(filters: AnalyticsFilters = {}): Promise<{
    data: Array<{ tipo: 'carro' | 'moto' | 'indefinido'; label: string; leads: number; aprovados: number; conversao: number }>
    totals: { leads: number; aprovados: number }
  }> {
    const response = await api.get('/analytics/by-vehicle-type', { params: filters })
    return response.data as any
  },

  async getCampaigns(filters: AnalyticsFilters = {}): Promise<CampaignAnalyticsResponse> {
    const response = await api.get<CampaignAnalyticsResponse>('/analytics/campaigns', { params: filters })
    return response.data
  },

  async getFunnel(filters: AnalyticsFilters = {}): Promise<FunnelAnalyticsResponse> {
    const response = await api.get<FunnelAnalyticsResponse>('/analytics/funnel', { params: filters })
    return response.data
  },

  async getLTV(filters: AnalyticsFilters = {}): Promise<LTVAnalyticsResponse> {
    const response = await api.get<LTVAnalyticsResponse>('/analytics/ltv', { params: filters })
    return response.data
  },

  async getROI(filters: AnalyticsFilters = {}): Promise<ROIAnalyticsResponse> {
    const response = await api.get<ROIAnalyticsResponse>('/analytics/roi', { params: filters })
    return response.data
  },

  async getTrends(filters: AnalyticsFilters = {}): Promise<TrendsAnalyticsResponse> {
    const response = await api.get<TrendsAnalyticsResponse>('/analytics/trends', { params: filters })
    return response.data
  },
}
