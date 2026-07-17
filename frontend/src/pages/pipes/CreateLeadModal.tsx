import { useState, useMemo, useEffect } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, Loader2, UserPlus } from 'lucide-react'
import { toast } from 'sonner'
import { usePipes, useKanban } from '../../hooks/usePipes'
import { pipesService } from '../../services/pipes.service'

interface Props {
  isOpen: boolean
  onClose: () => void
  // Pipe inicialmente selecionado (vem do KanbanPage atual, mas o user pode trocar)
  defaultPipeId?: string
}

export function CreateLeadModal({ isOpen, onClose, defaultPipeId }: Props) {
  const queryClient = useQueryClient()
  const { data: pipes } = usePipes()

  const [pipeId, setPipeId] = useState<string>(defaultPipeId || '')
  const [phaseId, setPhaseId] = useState<string>('')
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [email, setEmail] = useState('')

  // Carrega kanban do pipe escolhido pra listar as fases disponíveis
  const { data: kanban } = useKanban(pipeId)
  const phases = useMemo(() => kanban?.phases || [], [kanban])

  // Quando troca de pipe, reseta a fase escolhida pra primeira
  useEffect(() => {
    if (phases.length > 0 && !phases.find((p: any) => p.id === phaseId)) {
      setPhaseId(phases[0].id)
    }
  }, [phases, phaseId])

  // Sincroniza defaultPipeId quando o modal abre
  useEffect(() => {
    if (isOpen && defaultPipeId) setPipeId(defaultPipeId)
  }, [isOpen, defaultPipeId])

  const create = useMutation({
    mutationFn: (data: any) => pipesService.createCard(pipeId, data),
    // Update otimista: insere o card na fase escolhida na hora, sem esperar o
    // refetch do kanban (que e lento, ~2-4s). Reconcilia depois no onSettled.
    onMutate: async (vars: any) => {
      const key = ['kanban', pipeId]
      await queryClient.cancelQueries({ queryKey: key })
      const previous = queryClient.getQueryData<any>(key)
      if (previous?.phases && vars.phaseId) {
        const now = new Date().toISOString()
        const tempCard = {
          id: `temp-${now}`,
          title: vars.title,
          createdAt: now,
          updatedAt: now,
          assignedTo: null,
          tasksPending: 0,
          lead: {
            nome: vars.lead?.nome,
            telefone: vars.lead?.telefone,
            whatsapp: vars.lead?.whatsapp,
            email: vars.lead?.email,
            origem: 'manual',
          },
          _optimistic: true,
        }
        const phases = previous.phases.map((ph: any) =>
          ph.id === vars.phaseId
            ? {
                ...ph,
                cards: [...(ph.cards || []), tempCard],
                _count: { ...(ph._count || {}), cards: (ph._count?.cards ?? ph.cards?.length ?? 0) + 1 },
              }
            : ph,
        )
        queryClient.setQueryData(key, { ...previous, phases })
      }
      return { previous, key }
    },
    onError: (err: any, _vars, context: any) => {
      if (context?.previous) queryClient.setQueryData(context.key, context.previous)
      toast.error(err.response?.data?.message || 'Erro ao criar lead')
    },
    onSuccess: () => {
      toast.success('Lead criado e adicionado ao funil!')
      handleClose()
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['kanban', pipeId] })
      queryClient.invalidateQueries({ queryKey: ['cards', pipeId] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  const handleClose = () => {
    setNome('')
    setTelefone('')
    setEmail('')
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome.trim() || !pipeId || !phaseId) {
      toast.error('Preencha nome, funil e fase')
      return
    }
    create.mutate({
      title: nome.trim(),
      phaseId,
      lead: {
        nome: nome.trim(),
        telefone: telefone.trim() || undefined,
        whatsapp: telefone.trim() || undefined,
        email: email.trim() || undefined,
      },
    })
  }

  if (!isOpen) return null

  return (
    <>
      <div className="drawer-overlay" onClick={handleClose} />
      <div className="drawer-panel max-w-md flex flex-col">
        <div className="px-6 py-4 border-b border-hairline flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h3 className="text-lg font-display font-semibold text-dark-50">Novo lead manual</h3>
              <p className="text-xs text-dark-400 mt-0.5">Escolha o funil e a fase de destino</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-dark-400 hover:text-dark-200 p-1 rounded-lg hover:bg-dark-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Funil */}
          <div>
            <label className="label">Funil de destino</label>
            <div className="grid grid-cols-1 gap-2">
              {(pipes || []).map((p: any) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPipeId(p.id)}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition text-left ${
                    pipeId === p.id
                      ? 'bg-blue-500/10 border-blue-500/40 ring-1 ring-blue-500/20'
                      : 'border-hairline hover:border-hairline-strong hover:bg-dark-700/40'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm flex-shrink-0 font-semibold"
                    style={{ backgroundColor: p.color || '#293C82' }}
                  >
                    {p.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${pipeId === p.id ? 'text-dark-50' : 'text-dark-200'}`}>{p.name}</p>
                    {p.description && <p className="text-[11px] text-dark-400 truncate mt-0.5">{p.description}</p>}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Fase */}
          {pipeId && (
            <div>
              <label className="label">Fase do funil</label>
              {phases.length === 0 ? (
                <p className="text-xs text-dark-400 italic">Carregando fases…</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {phases.map((ph: any) => (
                    <button
                      key={ph.id}
                      type="button"
                      onClick={() => setPhaseId(ph.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition flex items-center gap-2 ${
                        phaseId === ph.id
                          ? 'bg-orange-500/10 border-orange-500/40 text-orange-300'
                          : 'border-hairline text-dark-300 hover:border-hairline-strong'
                      }`}
                    >
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ph.color || '#94A3B8' }} />
                      {ph.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dados do lead */}
          <div className="space-y-4 pt-2 border-t border-hairline">
            <div>
              <label htmlFor="nome" className="label">Nome do lead *</label>
              <input
                id="nome"
                type="text"
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                required
                autoFocus
                placeholder="Ex: João da Silva"
                className="input"
              />
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label htmlFor="telefone" className="label">Telefone / WhatsApp</label>
                <input
                  id="telefone"
                  type="tel"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  placeholder="+55 21 99999-9999"
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="input"
                />
              </div>
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t border-hairline flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="px-4 py-2 text-sm text-dark-300 border border-hairline rounded-lg hover:bg-dark-700/40"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!nome.trim() || !pipeId || !phaseId || create.isPending}
            className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Criar lead
          </button>
        </div>
      </div>
    </>
  )
}
