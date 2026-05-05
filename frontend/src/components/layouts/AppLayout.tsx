import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, MessageSquare, UserCircle2, Brain,
  LayoutGrid, LogOut, Webhook, Zap, CreditCard, BarChart3,
  SmilePlus, Car, FileText, AlertTriangle, Gift, Link2,
  Search, Bell, ChevronDown, ChevronRight, ClipboardList, Settings,
  Shield, Wrench, UserCog, Loader2,
} from 'lucide-react'
import { useAuthStore, type UserRole } from '../../store/auth-store'
import { useState } from 'react'
import { usePipes } from '../../hooks/usePipes'

type NavItem = {
  path: string
  icon: any
  label: string
  roles?: UserRole[]
}

type NavSection = {
  label: string | null
  roles?: UserRole[]
  items: NavItem[]
}

const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'Associados',
    roles: ['admin', 'gestor', 'vendedor'],
    items: [
      { path: '/associados', icon: Users, label: 'Associados' },
      { path: '/vehicles', icon: Car, label: 'Veiculos' },
      { path: '/nps', icon: SmilePlus, label: 'Satisfacao (NPS)', roles: ['admin', 'gestor'] },
      { path: '/indicacoes', icon: Gift, label: 'Indicacoes (MGM)' },
    ],
  },
  {
    label: 'Comercial',
    roles: ['admin', 'gestor', 'vendedor'],
    items: [
      { path: '/leads', icon: UserCircle2, label: 'Leads' },
      { path: '/cotacoes', icon: FileText, label: 'Cotacoes' },
      { path: '/analytics', icon: BarChart3, label: 'Analytics', roles: ['admin', 'gestor'] },
    ],
  },
  {
    label: 'Operacao',
    roles: ['admin', 'gestor', 'operacao'],
    items: [
      { path: '/sinistros', icon: AlertTriangle, label: 'Sinistros' },
      { path: '/vehicles', icon: Wrench, label: 'Vistorias', roles: ['operacao'] },
    ],
  },
  {
    label: 'Comunicacao',
    items: [
      { path: '/inbox', icon: MessageSquare, label: 'Inbox' },
    ],
  },
  {
    label: 'Ferramentas',
    roles: ['admin', 'gestor'],
    items: [
      { path: '/ai', icon: Brain, label: 'IA & Treinamento' },
      { path: '/automations', icon: Zap, label: 'Automacoes' },
      { path: '/webhooks', icon: Webhook, label: 'Webhooks', roles: ['admin'] },
      { path: '/hinova', icon: Link2, label: 'Hinova (SGA)' },
      { path: '/projects', icon: ClipboardList, label: 'Projetos' },
    ],
  },
  {
    label: 'Administracao',
    roles: ['admin'],
    items: [
      { path: '/equipe', icon: UserCog, label: 'Equipe & Acessos' },
    ],
  },
]

const ROLE_LABELS: Record<UserRole, { label: string; color: string }> = {
  admin: { label: 'Admin', color: 'text-red-400' },
  gestor: { label: 'Gestor', color: 'text-purple-400' },
  vendedor: { label: 'Vendedor', color: 'text-blue-400' },
  operacao: { label: 'Operacao', color: 'text-cyan-400' },
}

export function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const user = useAuthStore((s) => s.user)
  const updateUser = useAuthStore((s) => s.updateUser)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const [searchFocused, setSearchFocused] = useState(false)
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)

  const currentRole = (user?.role?.name as UserRole) || 'admin'

  const handleLogout = () => {
    clearAuth()
    navigate('/login', { replace: true })
  }

  const handleRoleChange = (newRole: UserRole) => {
    updateUser({
      role: { id: `role-${newRole}`, name: newRole, displayName: ROLE_LABELS[newRole].label, level: newRole === 'admin' ? 10 : 50 },
    })
    setRoleMenuOpen(false)
  }

  const isActive = (path: string) =>
    location.pathname === path || (path !== '/' && location.pathname.startsWith(path))

  const canSeeSection = (section: NavSection) => {
    if (!section.roles) return true
    return section.roles.includes(currentRole)
  }

  const canSeeItem = (item: NavItem) => {
    if (!item.roles) return true
    return item.roles.includes(currentRole)
  }

  return (
    <div className="flex h-screen bg-dark-950">
      {/* Sidebar */}
      <aside className="w-[260px] bg-dark-900/80 border-r border-dark-700/40 flex flex-col backdrop-blur-md shadow-sidebar">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-dark-700/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-gold flex items-center justify-center shadow-glow-gold">
              <span className="text-dark-900 font-display font-bold text-sm">21</span>
            </div>
            <div>
              <h1 className="text-base font-display font-bold text-white tracking-tight">21Go</h1>
              <p className="text-[10px] text-gold-500/70 font-medium tracking-widest uppercase">CRM Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          {NAV_SECTIONS.filter(canSeeSection).map((section, si) => (
            <div key={si}>
              {section.label && (
                <p className="text-[10px] font-semibold text-dark-400 uppercase tracking-[0.15em] pt-5 pb-2 px-3">
                  {section.label}
                </p>
              )}
              {section.label === 'Comercial' && ['admin', 'gestor', 'vendedor'].includes(currentRole) && (
                <PipesNavItem isActive={isActive} />
              )}
              {section.items.filter(canSeeItem).map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path + item.label}
                    to={item.path}
                    className={active ? 'sidebar-link-active' : 'sidebar-link-inactive'}
                  >
                    <Icon size={18} className={active ? 'text-gold-400' : ''} />
                    <span>{item.label}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400" />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

          {/* Financeiro — admin/gestor only */}
          {['admin', 'gestor'].includes(currentRole) && (
            <div className="border-t border-dark-700/30 mt-4 pt-4">
              <Link
                to="/billing"
                className={isActive('/billing') ? 'sidebar-link-active' : 'sidebar-link-inactive'}
              >
                <CreditCard size={18} className={isActive('/billing') ? 'text-gold-400' : ''} />
                <span>Financeiro</span>
              </Link>
            </div>
          )}
        </nav>

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-dark-700/30">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-dark-700/30 transition-colors group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/20 flex items-center justify-center text-xs font-semibold text-gold-400 flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-gray-200 truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[11px] text-gray-500 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-1.5 text-gray-500 hover:text-red-400 rounded-lg hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-dark-700/30 bg-dark-900/40 backdrop-blur-md flex items-center justify-between px-6 flex-shrink-0">
          {/* Search */}
          <div className={`relative transition-all duration-300 ${searchFocused ? 'w-96' : 'w-72'}`}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar..."
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="w-full pl-9 pr-3 py-2 bg-dark-800/40 border border-dark-700/40 rounded-xl text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-gold-500/30 focus:ring-1 focus:ring-gold-500/20 transition-all"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-gray-500 bg-dark-700/50 px-1.5 py-0.5 rounded-md border border-dark-600/30 font-mono">
              /
            </kbd>
          </div>

          {/* Right Actions */}
          <div className="flex items-center gap-2">
            {/* Role Selector */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-dark-800/60 border border-dark-700/40 hover:border-dark-600 transition-colors"
              >
                <Shield size={14} className={ROLE_LABELS[currentRole].color} />
                <span className={`text-xs font-medium ${ROLE_LABELS[currentRole].color}`}>
                  {ROLE_LABELS[currentRole].label}
                </span>
                <ChevronDown size={12} className="text-gray-500" />
              </button>
              {roleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-40 bg-dark-800 border border-dark-700/40 rounded-xl shadow-lg z-20 py-1">
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <button
                        key={role}
                        onClick={() => handleRoleChange(role)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-dark-700/50 transition-colors ${
                          currentRole === role ? 'text-gold-400' : 'text-gray-300'
                        }`}
                      >
                        <Shield size={14} className={ROLE_LABELS[role].color} />
                        {ROLE_LABELS[role].label}
                        {currentRole === role && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-gold-400" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-6 bg-dark-700/40 mx-1" />

            <button className="relative p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-dark-700/40 transition-colors">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-gold-500 rounded-full" />
            </button>
            <button className="relative p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-dark-700/40 transition-colors">
              <Settings size={18} />
            </button>
            <div className="w-px h-6 bg-dark-700/40 mx-1" />
            <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-dark-700/40 transition-colors">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-gold-500/20 to-gold-600/10 border border-gold-500/20 flex items-center justify-center text-[11px] font-semibold text-gold-400">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <span className="text-sm text-gray-300 font-medium">{user?.firstName}</span>
              <ChevronDown size={14} className="text-gray-500" />
            </button>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

function PipesNavItem({ isActive }: { isActive: (path: string) => boolean }) {
  const location = useLocation()
  const { data: pipes, isLoading } = usePipes()
  const isOnPipesArea = location.pathname.startsWith('/pipes')
  const [expanded, setExpanded] = useState(isOnPipesArea)

  const headerActive = isActive('/pipes')
  const activePipes = pipes || []

  return (
    <div>
      <div className="flex items-center">
        <Link
          to="/pipes"
          className={`flex-1 ${headerActive && location.pathname === '/pipes' ? 'sidebar-link-active' : 'sidebar-link-inactive'}`}
        >
          <LayoutGrid size={18} className={headerActive ? 'text-gold-400' : ''} />
          <span>Funil de Vendas</span>
        </Link>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="p-2 text-gray-500 hover:text-gold-400 transition-colors"
          aria-label={expanded ? 'Recolher' : 'Expandir'}
        >
          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      </div>

      {expanded && (
        <div className="ml-7 mt-1 space-y-0.5 border-l border-dark-700/30 pl-3">
          {isLoading && (
            <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-gray-500">
              <Loader2 size={12} className="animate-spin" /> carregando...
            </div>
          )}
          {!isLoading && activePipes.length === 0 && (
            <p className="px-3 py-1.5 text-xs text-gray-500 italic">Nenhum funil ainda</p>
          )}
          {activePipes.map((pipe) => {
            const path = `/pipes/${pipe.id}/kanban`
            const active = location.pathname === path
            return (
              <Link
                key={pipe.id}
                to={path}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs transition-colors ${
                  active ? 'bg-gold-500/10 text-gold-400 font-medium' : 'text-gray-400 hover:text-gray-200 hover:bg-dark-700/30'
                }`}
              >
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: pipe.color }} />
                <span className="truncate">{pipe.name}</span>
              </Link>
            )
          })}
          <Link
            to="/pipes"
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs text-gray-500 hover:text-gold-400 transition-colors"
          >
            <span className="w-2 h-2 rounded-full border border-gray-500 flex-shrink-0" />
            <span>Gerenciar funis...</span>
          </Link>
        </div>
      )}
    </div>
  )
}
