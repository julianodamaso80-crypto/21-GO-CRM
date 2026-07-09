import { useState } from 'react'
import {
  useAssociados,
  useCreateAssociado,
  useUpdateAssociado,
  useAssociadoStats,
} from '../../hooks/useAssociados'
import { AssociadosTable } from './AssociadosTable'
import { AssociadoDrawer, type DrawerMode } from './AssociadoDrawer'
import {
  Plus, Search, Loader2, Users, CheckCircle2, AlertCircle, Car, X,
} from 'lucide-react'
import type { CreateAssociadoRequest, AssociadoWithStats } from '../../../../shared/types'

const STATUS_CHIPS = [
  { value: '', label: 'Todos' },
  { value: 'ativo', label: 'Ativos' },
  { value: 'em_adesao', label: 'Em adesão' },
  { value: 'inadimplente', label: 'Inadimplentes' },
  { value: 'inativo', label: 'Inativos' },
  { value: 'cancelado', label: 'Cancelados' },
]

export function AssociadosPage() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [origemFilter, setOrigemFilter] = useState('')
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [drawerMode, setDrawerMode] = useState<DrawerMode>('view')
  const [selectedAssociado, setSelectedAssociado] = useState<AssociadoWithStats | null>(null)

  const { data: associadosData, isLoading, error } = useAssociados({
    page,
    limit: 20,
    search,
    status: statusFilter || undefined,
    origem: origemFilter || undefined,
  })
  const { data: stats } = useAssociadoStats()

  const createAssociado = useCreateAssociado()
  const updateAssociado = useUpdateAssociado()

  const handleSearch = () => {
    setSearch(searchInput)
    setPage(1)
  }

  const handleSearchKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch()
  }

  const handleCreate = () => {
    setSelectedAssociado(null)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  // Clique na linha → abre o PERFIL (view)
  const handleView = (associado: AssociadoWithStats) => {
    setSelectedAssociado(associado)
    setDrawerMode('view')
    setIsDrawerOpen(true)
  }

  // Editar → abre o formulário
  const handleEdit = (associado: AssociadoWithStats) => {
    setSelectedAssociado(associado)
    setDrawerMode('edit')
    setIsDrawerOpen(true)
  }

  const closeDrawer = () => {
    setIsDrawerOpen(false)
    setSelectedAssociado(null)
  }

  const handleSubmit = async (data: CreateAssociadoRequest) => {
    if (selectedAssociado) {
      await updateAssociado.mutateAsync({ id: selectedAssociado.id, data })
    } else {
      await createAssociado.mutateAsync(data)
    }
    closeDrawer()
  }

  const isSubmitting = createAssociado.isPending || updateAssociado.isPending
  const hasFilters = !!statusFilter || !!origemFilter || !!search

  return (
    <div className="relative min-h-screen p-6 max-w-7xl mx-auto page-enter">
      {/* Background ambiente — paleta oficial 21Go */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 70% 45% at 50% -10%, rgba(41,60,130,0.10), transparent 60%), radial-gradient(ellipse 50% 40% at 95% 15%, rgba(242,145,29,0.05), transparent 55%)',
        }}
      />

      <div className="relative z-10">
        {/* ===== Header ===== */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-display font-bold text-white tracking-tight">Associados</h1>
            <p className="mt-1 text-sm text-dark-400">Cadastro e gestão da base de associados 21Go</p>
          </div>
          <button onClick={handleCreate} className="btn-cta self-start sm:self-auto">
            <Plus className="w-4 h-4" />
            Novo Associado
          </button>
        </div>

        {/* ===== Stat Cards ===== */}
        {stats && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 stagger-children">
            <StatCard
              icon={<Users className="w-5 h-5" />}
              label="Total"
              value={stats.total}
              accent="blue"
              onClick={() => { setStatusFilter(''); setPage(1) }}
              active={!statusFilter}
            />
            <StatCard
              icon={<CheckCircle2 className="w-5 h-5" />}
              label="Ativos"
              value={stats.ativos}
              accent="emerald"
              onClick={() => { setStatusFilter('ativo'); setPage(1) }}
              active={statusFilter === 'ativo'}
            />
            <StatCard
              icon={<AlertCircle className="w-5 h-5" />}
              label="Inadimplentes"
              value={stats.inadimplentes}
              accent="orange"
              onClick={() => { setStatusFilter('inadimplente'); setPage(1) }}
              active={statusFilter === 'inadimplente'}
            />
            <StatCard
              icon={<Car className="w-5 h-5" />}
              label="Veículos"
              value={stats.totalVehicles}
              accent="lime"
            />
          </div>
        )}

        {/* ===== Filtros ===== */}
        <div className="card mb-6 !p-4">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-[220px] relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyPress={handleSearchKeyPress}
                  placeholder="Buscar por nome, CPF ou WhatsApp..."
                  className="input pl-10"
                />
              </div>
              <select
                value={origemFilter}
                onChange={(e) => { setOrigemFilter(e.target.value); setPage(1) }}
                className="input w-auto min-w-[160px]"
              >
                <option value="">Todas as origens</option>
                <option value="google_ads">Google Ads</option>
                <option value="meta_ads">Meta Ads</option>
                <option value="instagram">Instagram</option>
                <option value="indicacao">Indicação</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="direto">Direto</option>
              </select>
              <button onClick={handleSearch} className="btn-primary">
                Buscar
              </button>
              {hasFilters && (
                <button
                  onClick={() => { setStatusFilter(''); setOrigemFilter(''); setSearch(''); setSearchInput(''); setPage(1) }}
                  className="btn-ghost text-xs"
                >
                  <X className="w-3.5 h-3.5" /> Limpar
                </button>
              )}
            </div>

            {/* Chips de status */}
            <div className="flex flex-wrap gap-1.5">
              {STATUS_CHIPS.map((chip) => {
                const isActive = statusFilter === chip.value
                return (
                  <button
                    key={chip.value || 'all'}
                    onClick={() => { setStatusFilter(chip.value); setPage(1) }}
                    className={`px-3 py-1 rounded-full text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-blue-500 text-white shadow-cta-blue'
                        : 'bg-dark-700 text-dark-300 hover:text-dark-100 hover:bg-dark-600 border border-hairline'
                    }`}
                  >
                    {chip.label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* ===== Tabela ===== */}
        {isLoading ? (
          <div className="card p-12 flex justify-center items-center">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="card border-rose-500/20 p-12 text-center">
            <div className="text-rose-400 mb-2 font-semibold">Erro ao carregar associados</div>
            <p className="text-dark-400 text-sm">{(error as any)?.response?.data?.message || 'Tente novamente mais tarde'}</p>
          </div>
        ) : associadosData ? (
          <>
            <AssociadosTable associados={associadosData.data} onEdit={handleEdit} onView={handleView} />
            {associadosData.pagination.totalPages > 1 && (
              <div className="mt-6 flex items-center justify-between">
                <div className="text-sm text-dark-400">
                  Mostrando{' '}
                  <span className="font-medium text-dark-100">{(page - 1) * associadosData.pagination.limit + 1}</span> até{' '}
                  <span className="font-medium text-dark-100">{Math.min(page * associadosData.pagination.limit, associadosData.pagination.total)}</span> de{' '}
                  <span className="font-medium text-dark-100">{associadosData.pagination.total}</span> associados
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={!associadosData.pagination.hasPrev}
                    className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={!associadosData.pagination.hasNext}
                    className="btn-secondary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Próximo
                  </button>
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>

      {/* Drawer */}
      <AssociadoDrawer
        isOpen={isDrawerOpen}
        mode={drawerMode}
        associado={selectedAssociado}
        onClose={closeDrawer}
        onEdit={() => setDrawerMode('edit')}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  )
}

const ACCENTS: Record<string, { icon: string; ring: string; glow: string }> = {
  blue:    { icon: 'text-blue-400 bg-blue-500/10',       ring: 'hover:border-blue-500/40',    glow: 'ring-blue-500/40' },
  emerald: { icon: 'text-emerald-400 bg-emerald-500/10', ring: 'hover:border-emerald-500/40', glow: 'ring-emerald-500/40' },
  orange:  { icon: 'text-orange-400 bg-orange-500/10',   ring: 'hover:border-orange-500/40',  glow: 'ring-orange-500/40' },
  lime:    { icon: 'text-lime-500 bg-lime-500/10',       ring: 'hover:border-lime-500/40',    glow: 'ring-lime-500/40' },
}

function StatCard({ icon, label, value, accent, onClick, active }: {
  icon: React.ReactNode
  label: string
  value: number
  accent: keyof typeof ACCENTS
  onClick?: () => void
  active?: boolean
}) {
  const c = ACCENTS[accent]
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={`card-hover group text-left ${onClick ? 'cursor-pointer' : 'cursor-default'} ${c.ring} ${
        active ? `ring-2 ${c.glow}` : ''
      }`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="stat-label">{label}</p>
          <p className="stat-value mt-1">{value}</p>
        </div>
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${c.icon}`}>
          {icon}
        </div>
      </div>
    </button>
  )
}
