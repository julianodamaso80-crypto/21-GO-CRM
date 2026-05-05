import { useState } from 'react'
import {
  Plus,
  Search,
  Loader2,
  UserCircle2,
  Trash2,
  Edit3,
  TrendingUp,
  Target,
  DollarSign,
  X,
  Car,
  Send,
  ListChecks,
  FileText,
} from 'lucide-react'
import { useLeads, useLeadStats, useCreateLead, useUpdateLead, useDeleteLead } from '../../hooks/useLeads'
import { useAssociados } from '../../hooks/useAssociados'
import { LeadTasksPanel } from '../tarefas/LeadTasksPanel'
import type { Lead, CreateLeadRequest, UpdateLeadRequest, LeadStatus, LeadSource, VehiclePlano } from '../../../../shared/types'

const STATUS_MAP: Partial<Record<LeadStatus, { label: string; cls: string }>> = {
  new: { label: 'Novo', cls: 'bg-accent-blue/10 text-accent-blue' },
  contacted: { label: 'Contatado', cls: 'bg-accent-amber/10 text-accent-amber' },
  qualified: { label: 'Qualificado', cls: 'bg-accent-purple/10 text-accent-purple' },
  cotacao_enviada: { label: 'Cotacao Enviada', cls: 'bg-accent-cyan/10 text-accent-cyan' },
  negociacao: { label: 'Negociacao', cls: 'bg-accent-amber/10 text-accent-amber' },
  fechado: { label: 'Fechado', cls: 'bg-accent-emerald/10 text-accent-emerald' },
  perdido: { label: 'Perdido', cls: 'bg-dark-700 text-gray-400' },
  unqualified: { label: 'Desqualificado', cls: 'bg-dark-700 text-gray-500' },
}

const SOURCE_MAP: Partial<Record<LeadSource, string>> = {
  website: 'Website',
  whatsapp: 'WhatsApp',
  instagram: 'Instagram',
  referral: 'Indicacao',
  manual: 'Manual',
  facebook: 'Facebook',
  google: 'Google',
  tiktok: 'TikTok',
  linkedin: 'LinkedIn',
  email: 'Email',
  organic: 'Organico',
  other: 'Outro',
}

export function LeadsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const { data, isLoading } = useLeads({ search, status: statusFilter || undefined, source: sourceFilter || undefined })
  const { data: stats } = useLeadStats()
  const deleteMutation = useDeleteLead()

  const leads = data?.data || []

  const openCreate = () => { setEditingLead(null); setDrawerOpen(true) }
  const openEdit = (lead: Lead) => { setEditingLead(lead); setDrawerOpen(true) }
  const closeDrawer = () => { setDrawerOpen(false); setEditingLead(null) }

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, { onSuccess: () => setDeleteId(null) })
    }
  }

  const formatCurrency = (value?: number | null) => {
    if (!value) return '-'
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  return (
    <div className="p-6 space-y-6 page-enter">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-display font-bold text-white">Leads</h1>
          <p className="text-sm text-gray-400 mt-1">Gerencie suas oportunidades de protecao veicular</p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Novo Lead
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
          <StatCard icon={<UserCircle2 className="w-5 h-5 text-accent-blue" />} label="Total de Leads" value={stats.total} bg="bg-accent-blue/10" />
          <StatCard icon={<Target className="w-5 h-5 text-accent-emerald" />} label="Fechados" value={stats.byStatus?.fechado || 0} bg="bg-accent-emerald/10" />
          <StatCard icon={<TrendingUp className="w-5 h-5 text-accent-purple" />} label="Taxa de Conversao" value={`${stats.conversionRate}%`} bg="bg-accent-purple/10" />
          <StatCard icon={<DollarSign className="w-5 h-5 text-accent-amber" />} label="Valor Estimado" value={formatCurrency(stats.totalEstimatedValue)} bg="bg-accent-amber/10" />
        </div>
      )}

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por nome, veiculo ou placa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 pr-4"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input"
        >
          <option value="">Todos os status</option>
          <option value="new">Novo</option>
          <option value="contacted">Contatado</option>
          <option value="qualified">Qualificado</option>
          <option value="cotacao_enviada">Cotacao Enviada</option>
          <option value="negociacao">Negociacao</option>
          <option value="fechado">Fechado</option>
          <option value="perdido">Perdido</option>
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="input"
        >
          <option value="">Todas as origens</option>
          <option value="website">Website</option>
          <option value="whatsapp">WhatsApp</option>
          <option value="instagram">Instagram</option>
          <option value="referral">Indicacao</option>
          <option value="google">Google</option>
          <option value="manual">Manual</option>
        </select>
        {(statusFilter || sourceFilter) && (
          <button onClick={() => { setStatusFilter(''); setSourceFilter('') }} className="text-xs text-gray-400 hover:text-gray-300 flex items-center gap-1">
            <X className="w-3 h-3" /> Limpar filtros
          </button>
        )}
      </div>

      {/* Tabela */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-16">
          <UserCircle2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-white">Nenhum lead encontrado</h3>
          <p className="text-sm text-gray-400 mt-1">Crie o primeiro lead para comecar</p>
          <button onClick={openCreate} className="btn-primary mt-4 text-sm">
            Criar Lead
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-dark-700/40">
              <thead className="bg-dark-700">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Associado</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Veiculo Interesse</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Cotacao</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Origem</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Score</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Data</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-400 uppercase">Acoes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700/40">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-dark-700">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{lead.contact?.fullName || '-'}</p>
                        <p className="text-xs text-gray-500">{lead.contact?.phone || lead.contact?.whatsapp || lead.contact?.email || ''}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {lead.marcaInteresse ? (
                        <div className="flex items-start gap-1.5">
                          <Car className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-sm text-gray-200">{lead.marcaInteresse} {lead.modeloInteresse}</p>
                            {lead.anoInteresse && <p className="text-xs text-gray-500">{lead.anoInteresse}</p>}
                            {lead.placaInteresse && <p className="text-xs text-gray-500">Placa: {lead.placaInteresse}</p>}
                          </div>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      {lead.cotacaoValor ? (
                        <div>
                          <p className="text-sm text-gray-200">{formatCurrency(lead.cotacaoValor)}</p>
                          {lead.cotacaoPlano && <p className="text-xs text-gray-500 capitalize">{lead.cotacaoPlano}</p>}
                          {lead.cotacaoEnviada && (
                            <span className="inline-flex items-center gap-0.5 text-xs text-cyan-400 mt-0.5">
                              <Send className="w-2.5 h-2.5" /> Enviada
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400">
                      {SOURCE_MAP[lead.source] || lead.source}
                    </td>
                    <td className="px-4 py-3">
                      <ScoreBar score={lead.score} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEdit(lead)} className="p-1.5 text-gray-500 hover:text-gold-400 rounded">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteId(lead.id)} className="p-1.5 text-gray-500 hover:text-red-400 rounded">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Lead Drawer */}
      {drawerOpen && <LeadDrawer lead={editingLead} onClose={closeDrawer} />}

      {/* Delete Confirmation */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setDeleteId(null)} />
          <div className="relative card shadow-xl p-6 w-full max-w-sm">
            <h3 className="text-lg font-display font-semibold text-white">Excluir Lead</h3>
            <p className="text-sm text-gray-400 mt-2">Tem certeza que deseja excluir este lead? Esta acao nao pode ser desfeita.</p>
            <div className="flex justify-end gap-3 mt-5">
              <button onClick={() => setDeleteId(null)} className="px-4 py-2 text-sm text-gray-300 border border-dark-700/50 rounded-lg hover:bg-dark-700">
                Cancelar
              </button>
              <button onClick={confirmDelete} disabled={deleteMutation.isPending} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Sub-components ──

function StatCard({ icon, label, value, bg }: { icon: React.ReactNode; label: string; value: string | number; bg: string }) {
  return (
    <div className="stat-card">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>{icon}</div>
        <div>
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-xl font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: LeadStatus }) {
  const s = STATUS_MAP[status] || { label: status, cls: 'bg-dark-700 text-gray-400' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}

function ScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score))
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-gray-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-dark-700 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-gray-400">{score}</span>
    </div>
  )
}

// ── Lead Drawer (Create/Edit) ──

function LeadDrawer({ lead, onClose }: { lead: Lead | null; onClose: () => void }) {
  const createMutation = useCreateLead()
  const updateMutation = useUpdateLead()
  const { data: associadosData } = useAssociados({ limit: 100 })
  const associados = associadosData?.data || []

  const [tab, setTab] = useState<'detalhes' | 'tarefas'>('detalhes')
  const [title, setTitle] = useState(lead?.title || '')
  const [description, setDescription] = useState(lead?.description || '')
  const [contactId, setContactId] = useState(lead?.contactId || '')
  const [source, setSource] = useState<LeadSource>(lead?.source || 'manual')
  const [status, setStatus] = useState<LeadStatus>(lead?.status || 'new')
  const [score, setScore] = useState(String(lead?.score || 0))
  const [estimatedValue, setEstimatedValue] = useState(lead?.estimatedValue ? String(lead.estimatedValue) : '')
  const [marcaInteresse, setMarcaInteresse] = useState(lead?.marcaInteresse || '')
  const [modeloInteresse, setModeloInteresse] = useState(lead?.modeloInteresse || '')
  const [anoInteresse, setAnoInteresse] = useState(lead?.anoInteresse ? String(lead.anoInteresse) : '')
  const [placaInteresse, setPlacaInteresse] = useState(lead?.placaInteresse || '')
  const [cotacaoPlano, setCotacaoPlano] = useState<VehiclePlano | ''>(lead?.cotacaoPlano || '')

  const isEditing = !!lead
  const isPending = createMutation.isPending || updateMutation.isPending

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || (!isEditing && !contactId)) return

    const vehicleFields = {
      marcaInteresse: marcaInteresse || undefined,
      modeloInteresse: modeloInteresse || undefined,
      anoInteresse: anoInteresse ? parseInt(anoInteresse) : undefined,
      placaInteresse: placaInteresse || undefined,
      cotacaoPlano: (cotacaoPlano as VehiclePlano) || undefined,
    }

    if (isEditing) {
      const data: UpdateLeadRequest = {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        score: parseInt(score) || 0,
        source,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : null,
        ...vehicleFields,
      }
      updateMutation.mutate({ id: lead.id, data }, { onSuccess: onClose })
    } else {
      const data: CreateLeadRequest = {
        contactId,
        title: title.trim(),
        description: description.trim() || undefined,
        source,
        estimatedValue: estimatedValue ? parseFloat(estimatedValue) : undefined,
        ...vehicleFields,
      }
      createMutation.mutate(data, { onSuccess: onClose })
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md bg-dark-800 shadow-xl overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-dark-800 border-b border-dark-700/40 px-6 py-4 flex items-center justify-between z-10">
          <div>
            <h2 className="text-lg font-display font-semibold text-white">{isEditing ? 'Editar Lead' : 'Novo Lead'}</h2>
            {isEditing && lead?.contact?.fullName && (
              <p className="text-xs text-gray-500 mt-0.5">{lead.contact.fullName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-400 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs (apenas em edição) */}
        {isEditing && (
          <div className="sticky top-[73px] bg-dark-800 border-b border-dark-700/40 px-6 py-2 z-10 flex gap-1">
            <button
              onClick={() => setTab('detalhes')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === 'detalhes'
                  ? 'bg-gold-500/15 text-gold-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700/40'
              }`}
            >
              <FileText className="w-3.5 h-3.5" /> Detalhes
            </button>
            <button
              onClick={() => setTab('tarefas')}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                tab === 'tarefas'
                  ? 'bg-gold-500/15 text-gold-400'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700/40'
              }`}
            >
              <ListChecks className="w-3.5 h-3.5" /> Tarefas
            </button>
          </div>
        )}

        {isEditing && tab === 'tarefas' ? (
          <div className="p-6">
            <LeadTasksPanel leadId={lead!.id} />
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Associado */}
          {!isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Associado *</label>
              <select
                value={contactId}
                onChange={(e) => setContactId(e.target.value)}
                required
                className="w-full input"
              >
                <option value="">Selecione um associado</option>
                {associados.map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName || `${c.firstName} ${c.lastName}`}{c.cpf ? ` — ${c.cpf}` : ''}</option>
                ))}
              </select>
            </div>
          )}

          {/* Titulo */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Titulo *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Ex: Protecao Honda Civic 2022"
              className="w-full input"
            />
          </div>

          {/* Veiculo de Interesse */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Veiculo de Interesse</label>
            <div className="grid grid-cols-2 gap-3">
              <input type="text" value={marcaInteresse} onChange={(e) => setMarcaInteresse(e.target.value)}
                placeholder="Marca (Honda)" className="w-full input" />
              <input type="text" value={modeloInteresse} onChange={(e) => setModeloInteresse(e.target.value)}
                placeholder="Modelo (Civic)" className="w-full input" />
              <input type="number" value={anoInteresse} onChange={(e) => setAnoInteresse(e.target.value)}
                placeholder="Ano (2022)" min="1990" max="2030" className="w-full input" />
              <input type="text" value={placaInteresse} onChange={(e) => setPlacaInteresse(e.target.value.toUpperCase())}
                placeholder="Placa (ABC1D23)" maxLength={8} className="w-full input" />
            </div>
          </div>

          {/* Origem + Status */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Origem</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as LeadSource)}
                className="w-full input"
              >
                <option value="manual">Manual</option>
                <option value="website">Website</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="instagram">Instagram</option>
                <option value="referral">Indicacao</option>
                <option value="google">Google</option>
              </select>
            </div>
            {isEditing && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as LeadStatus)}
                  className="w-full input"
                >
                  <option value="new">Novo</option>
                  <option value="contacted">Contatado</option>
                  <option value="qualified">Qualificado</option>
                  <option value="cotacao_enviada">Cotacao Enviada</option>
                  <option value="negociacao">Negociacao</option>
                  <option value="fechado">Fechado</option>
                  <option value="perdido">Perdido</option>
                </select>
              </div>
            )}
          </div>

          {/* Plano + Valor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Plano Interesse</label>
              <select
                value={cotacaoPlano}
                onChange={(e) => setCotacaoPlano(e.target.value as VehiclePlano | '')}
                className="w-full input"
              >
                <option value="">Nao definido</option>
                <option value="basico">Basico</option>
                <option value="completo">Completo</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Valor Estimado (R$)</label>
              <input
                type="number"
                value={estimatedValue}
                onChange={(e) => setEstimatedValue(e.target.value)}
                placeholder="0.00"
                step="0.01"
                className="w-full input"
              />
            </div>
          </div>

          {/* Score (somente edicao) */}
          {isEditing && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">Score (0-100)</label>
              <input
                type="number"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                min={0} max={100}
                className="w-full input"
              />
            </div>
          )}

          {/* Descricao */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">Observacoes</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Detalhes sobre este lead..."
              className="w-full input"
            />
          </div>

          {/* Acoes */}
          <div className="flex justify-end gap-3 pt-4 border-t border-dark-700/40">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-300 border border-dark-700/50 rounded-lg hover:bg-dark-700">
              Cancelar
            </button>
            <button type="submit" disabled={isPending} className="btn-primary text-sm disabled:opacity-50">
              {isPending ? 'Salvando...' : isEditing ? 'Salvar' : 'Criar Lead'}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  )
}
