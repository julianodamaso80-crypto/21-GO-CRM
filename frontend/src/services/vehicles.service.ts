import { api } from '../lib/api'
import type { Vehicle, CreateVehicleRequest, UpdateVehicleRequest, VehiclesListResponse } from '../../../shared/types'

export interface ListVehiclesParams {
  page?: number
  limit?: number
  search?: string
  associadoId?: string
  plano?: string
  ativo?: boolean
}

export const vehiclesService = {
  async list(params: ListVehiclesParams = {}): Promise<VehiclesListResponse> {
    const { data } = await api.get('/vehicles', { params })
    return data
  },

  async getById(id: string): Promise<Vehicle> {
    const { data } = await api.get(`/vehicles/${id}`)
    return data
  },

  async getByAssociado(associadoId: string): Promise<Vehicle[]> {
    const { data } = await api.get(`/contacts/${associadoId}/vehicles`)
    return data
  },

  async create(payload: CreateVehicleRequest): Promise<Vehicle> {
    const { data } = await api.post('/vehicles', payload)
    return data
  },

  async update(id: string, payload: UpdateVehicleRequest): Promise<Vehicle> {
    const { data } = await api.put(`/vehicles/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/vehicles/${id}`)
  },
}
