import { useQuery } from '@tanstack/react-query'
import { analyticsService } from '../services/analytics.service'
import type { AnalyticsFilters } from '../../../shared/types'

export function useAnalyticsOverview(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'overview', filters],
    queryFn: () => analyticsService.getOverview(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsSources(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'sources', filters],
    queryFn: () => analyticsService.getSources(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsByState(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'by-state', filters],
    queryFn: () => analyticsService.getByState(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsByVehicleType(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'by-vehicle-type', filters],
    queryFn: () => analyticsService.getByVehicleType(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsCampaigns(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'campaigns', filters],
    queryFn: () => analyticsService.getCampaigns(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsFunnel(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'funnel', filters],
    queryFn: () => analyticsService.getFunnel(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsLTV(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'ltv', filters],
    queryFn: () => analyticsService.getLTV(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsROI(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'roi', filters],
    queryFn: () => analyticsService.getROI(filters),
    staleTime: 1000 * 60 * 5,
  })
}

export function useAnalyticsTrends(filters: AnalyticsFilters = {}) {
  return useQuery({
    queryKey: ['analytics', 'trends', filters],
    queryFn: () => analyticsService.getTrends(filters),
    staleTime: 1000 * 60 * 5,
  })
}
