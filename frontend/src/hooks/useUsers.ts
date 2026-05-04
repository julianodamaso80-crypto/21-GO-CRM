import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { usersService, type CreateTeamMemberRequest, type UpdateTeamMemberRequest } from '../services/users.service'

const KEY = ['team-users']

export function useTeamMembers() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => usersService.list(),
  })
}

export function useCreateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTeamMemberRequest) => usersService.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Membro adicionado com sucesso')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao adicionar membro')
    },
  })
}

export function useUpdateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamMemberRequest }) => usersService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Atualizado com sucesso')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao atualizar')
    },
  })
}

export function useDeactivateTeamMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => usersService.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: KEY })
      toast.success('Usuario desativado')
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Erro ao desativar')
    },
  })
}
