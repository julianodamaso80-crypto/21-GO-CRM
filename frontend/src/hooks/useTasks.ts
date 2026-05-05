import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { tasksService, type CreateTaskRequest, type UpdateTaskRequest, type ListTasksParams } from '../services/tasks.service'

export function useTasks(params: ListTasksParams = {}) {
  return useQuery({
    queryKey: ['tasks', params],
    queryFn: () => tasksService.list(params),
    staleTime: 1000 * 30,
  })
}

export function useTask(id: string) {
  return useQuery({
    queryKey: ['tasks', 'detail', id],
    queryFn: () => tasksService.getById(id),
    enabled: !!id,
  })
}

export function useTasksByLead(leadId: string) {
  return useQuery({
    queryKey: ['tasks', 'lead', leadId],
    queryFn: () => tasksService.listByLead(leadId),
    enabled: !!leadId,
  })
}

export function useCreateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTaskRequest) => tasksService.create(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      if (vars.leadId) qc.invalidateQueries({ queryKey: ['tasks', 'lead', vars.leadId] })
      toast.success('Tarefa criada!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao criar tarefa'),
  })
}

export function useCreateTaskForLead(leadId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<CreateTaskRequest, 'leadId'>) => tasksService.createForLead(leadId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      qc.invalidateQueries({ queryKey: ['tasks', 'lead', leadId] })
      toast.success('Tarefa criada!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao criar tarefa'),
  })
}

export function useUpdateTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTaskRequest }) => tasksService.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao atualizar'),
  })
}

export function useCompleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksService.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Tarefa concluída!')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao concluir'),
  })
}

export function useReopenTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksService.reopen(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks'] }),
  })
}

export function useDeleteTask() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => tasksService.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks'] })
      toast.success('Tarefa excluída')
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Erro ao excluir'),
  })
}
