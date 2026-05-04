import { useMemo, useState } from 'react'
import {
  Plus, Search, Loader2, Users, Shield, ShieldCheck, ShieldAlert,
  Wrench, MoreVertical, Edit3, UserX, KeyRound, CheckCircle2,
} from 'lucide-react'
import {
  useTeamMembers, useCreateTeamMember, useUpdateTeamMember, useDeactivateTeamMember,
} from '../../hooks/useUsers'
import { useAuthStore } from '../../store/auth-store'
import type { TeamMember, TeamRole } from '../../services/users.service'
import { TeamMemberDrawer } from './TeamMemberDrawer'

const ROLE_META: Record<TeamRole, { label: string; description: string; icon: any; color: string; bg: string }> = {
  admin: {
    label: 'Administrador',
    description: 'Acesso total ao sistema, configuracoes e usuarios',
    icon: ShieldAlert,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
  },
  gestor: {
    label: 'Gestor',
    description: 'Dashboards, analytics, NPS, financeiro e equipe comercial',
    icon: ShieldCheck,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
  },
  vendedor: {
    label: 'Vendedor',
    description: 'Leads, cotacoes, funil de vendas e seus associados',
    icon: Shield,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
  },
  operacao: {
    label: 'Operacao',
    description: 'Sinistros, vistorias e agenda de oficina (mobile)',
    icon: Wrench,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
  },
}

export function TeamPage() {
  const me = useAuthStore((s) => s.user)
  const myRole = (me?.role?.name as TeamRole) || 'vendedor'
  const isAdmin = myRole === 'admin'

  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<TeamRole | ''>('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<TeamMember | null>(null)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)

  const { data, isLoading, error } = useTeamMembers()
  const createMutation = useCreateTeamMember()
  const updateMutation = useUpdateTeamMember()
  const deactivateMutation = useDeactivateTeamMember()

  const members = data?.data || []

  const filtered = useMemo(() => {
    return members.filter((m) => {
      if (roleFilter && m.role !== roleFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          m.firstName.toLowerCase().includes(q) ||
          m.lastName.toLowerCase().includes(q) ||
          m.email.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [members, search, roleFilter])

  const stats = useMemo(() => {
    const counts: Record<TeamRole, number> = { admin: 0, gestor: 0, vendedor: 0, operacao: 0 }
    members.forEach((m) => { if (m.isActive) counts[m.role]++ })
    return counts
  }, [members])

  const openCreate = () => { setEditing(null); setDrawerOpen(true) }
  const openEdit = (m: TeamMember) => { setEditing(m); setDrawerOpen(true); setMenuOpenId(null) }

  const handleSubmit = async (formData: any) => {
    if (editing) {
      await updateMutation.mutateAsync({ id: editing.id, data: formData })
    } else {
      await createMutation.mutateAsync(formData)
    }
    setDrawerOpen(false); setEditing(null)
  }

  const toggleActive = async (m: TeamMember) => {
    setMenuOpenId(null)
    if (m.id === me?.id) return
    await updateMutation.mutateAsync({ id: m.id, data: { isActive: !m.isActive } })
  }

  const handleDeactivate = async (m: TeamMember) => {
    setMenuOpenId(null)
    if (m.id === me?.id) return
    if (!confirm(`Desativar ${m.firstName} ${m.lastName}? Ele perdera acesso imediatamente.`)) return
    await deactivateMutation.mutateAsync(m.id)
  }

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-3xl mx-auto page-enter">
        <div className="card border-red-500/20 p-12 text-center">
          <ShieldAlert className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-display font-bold text-white mb-2">Acesso restrito</h2>
          <p className="text-gray-400">Apenas administradores podem gerenciar a equipe.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto page-enter">
      {/* Header */}
      <div className="mb-8">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Equipe</h1>
            <p className="mt-2 text-gray-400">
              Gerencie os acessos do seu time. Cada nivel de permissao define o que cada pessoa pode ver e fazer.
            </p>
          </div>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Adicionar membro
          </button>
        </div>

        {/* Stat cards por role */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 stagger-children">
          {(Object.keys(ROLE_META) as TeamRole[]).map((role) => {
            const meta = ROLE_META[role]
            const Icon = meta.icon
            return (
              <button
                key={role}
                onClick={() => setRoleFilter(roleFilter === role ? '' : role)}
                className={`stat-card text-left transition-all ${roleFilter === role ? 'ring-2 ring-gold-500/40' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">{meta.label}</p>
                    <p className="text-2xl font-display font-bold text-white mt-1">{stats[role]}</p>
                  </div>
                  <div className={`stat-icon ${meta.bg} border`}>
                    <Icon className={`w-5 h-5 ${meta.color}`} />
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Roles Reference Card */}
      <div className="card mb-6">
        <h3 className="text-sm font-semibold text-gray-300 mb-4 uppercase tracking-wider">Niveis de acesso</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(Object.keys(ROLE_META) as TeamRole[]).map((role) => {
            const meta = ROLE_META[role]
            const Icon = meta.icon
            return (
              <div key={role} className={`flex items-start gap-3 p-3 rounded-xl border ${meta.bg}`}>
                <Icon className={`w-5 h-5 ${meta.color} flex-shrink-0 mt-0.5`} />
                <div className="min-w-0">
                  <p className={`text-sm font-semibold ${meta.color}`}>{meta.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{meta.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Filtros */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome ou email..."
              className="input pl-10"
            />
          </div>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as TeamRole | '')}
            className="input w-auto"
          >
            <option value="">Todos os niveis</option>
            <option value="admin">Administrador</option>
            <option value="gestor">Gestor</option>
            <option value="vendedor">Vendedor</option>
            <option value="operacao">Operacao</option>
          </select>
        </div>
      </div>

      {/* Lista */}
      {isLoading ? (
        <div className="card p-12 flex justify-center items-center">
          <Loader2 className="w-8 h-8 text-gold-400 animate-spin" />
        </div>
      ) : error ? (
        <div className="card border-red-500/20 p-12 text-center">
          <div className="text-red-400 mb-2">Erro ao carregar a equipe</div>
          <p className="text-gray-400 text-sm">{(error as any)?.response?.data?.message || 'Tente novamente'}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhum membro encontrado.</p>
        </div>
      ) : (
        <div className="card overflow-hidden p-0">
          <table className="w-full">
            <thead className="bg-dark-800/40 border-b border-dark-700/40">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Pessoa</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Nivel</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Ultimo acesso</th>
                <th className="w-16 px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/30">
              {filtered.map((m) => {
                const meta = ROLE_META[m.role]
                const RoleIcon = meta.icon
                const isMe = m.id === me?.id
                return (
                  <tr key={m.id} className="hover:bg-dark-800/30 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/20 flex items-center justify-center text-xs font-semibold text-gold-400 flex-shrink-0">
                          {m.firstName[0]}{m.lastName[0]}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-200 flex items-center gap-2">
                            {m.firstName} {m.lastName}
                            {isMe && <span className="text-[10px] text-gold-400 bg-gold-500/10 px-1.5 py-0.5 rounded">VOCE</span>}
                          </p>
                          <p className="text-xs text-gray-500 truncate">{m.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${meta.bg} ${meta.color}`}>
                        <RoleIcon className="w-3.5 h-3.5" />
                        {meta.label}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {m.isActive ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-400">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Ativo
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-500">
                          <UserX className="w-3.5 h-3.5" />
                          Inativo
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-xs text-gray-400">
                      {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="px-4 py-4 relative">
                      <button
                        onClick={() => setMenuOpenId(menuOpenId === m.id ? null : m.id)}
                        className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-dark-700/40 rounded-lg transition-colors"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpenId === m.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setMenuOpenId(null)} />
                          <div className="absolute right-4 top-10 w-48 bg-dark-800 border border-dark-700/40 rounded-xl shadow-lg z-20 py-1">
                            <button onClick={() => openEdit(m)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700/50 transition-colors">
                              <Edit3 className="w-3.5 h-3.5" />
                              Editar / trocar nivel
                            </button>
                            <button onClick={() => openEdit(m)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700/50 transition-colors">
                              <KeyRound className="w-3.5 h-3.5" />
                              Redefinir senha
                            </button>
                            {!isMe && (
                              <>
                                <div className="my-1 border-t border-dark-700/30" />
                                <button onClick={() => toggleActive(m)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-dark-700/50 transition-colors">
                                  {m.isActive ? <><UserX className="w-3.5 h-3.5" /> Desativar</> : <><CheckCircle2 className="w-3.5 h-3.5" /> Reativar</>}
                                </button>
                                {m.isActive && (
                                  <button onClick={() => handleDeactivate(m)} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                                    <UserX className="w-3.5 h-3.5" />
                                    Remover acesso
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Drawer de criar/editar */}
      <TeamMemberDrawer
        isOpen={drawerOpen}
        member={editing}
        onClose={() => { setDrawerOpen(false); setEditing(null) }}
        onSubmit={handleSubmit}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  )
}
