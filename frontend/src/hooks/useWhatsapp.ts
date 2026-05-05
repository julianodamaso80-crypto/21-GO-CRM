import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { whatsappService } from '../services/whatsapp.service'

export function useWhatsappInstance() {
  return useQuery({
    queryKey: ['whatsapp', 'instance'],
    queryFn: () => whatsappService.getMine(),
    staleTime: 1000 * 30,
  })
}

export function useWhatsappStatus(enabled: boolean) {
  return useQuery({
    queryKey: ['whatsapp', 'status'],
    queryFn: () => whatsappService.status(),
    enabled,
    refetchInterval: enabled ? 3000 : false, // polling 3s enquanto enabled
    staleTime: 0,
  })
}

export function useCreateWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name?: string) => whatsappService.create(name),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp'] })
      toast.success('Instância criada! Escaneie o QR Code com seu WhatsApp.')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao criar instância'),
  })
}

export function useDeleteWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => whatsappService.delete(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp'] })
      toast.success('WhatsApp removido')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao remover'),
  })
}

export function useLogoutWhatsapp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => whatsappService.logout(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['whatsapp'] })
      toast.success('WhatsApp desconectado')
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Erro ao desconectar'),
  })
}
