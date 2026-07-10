import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Users, MessageSquare, Brain,
  LayoutGrid, LogOut, Webhook, Zap, BarChart3,
  SmilePlus, FileText, AlertTriangle, Link2,
  Bell, ChevronDown, ClipboardList, Settings,
  Shield, Wrench, UserCog, UsersRound, ListChecks, Sun, Moon, Sparkles,
} from 'lucide-react'
import { useAuthStore, type UserRole } from '../../store/auth-store'
import { useState, useEffect } from 'react'
import { usePipes } from '../../hooks/usePipes'
import { GlobalSearch } from '../GlobalSearch'
import { SocketStatusBadge } from '../SocketStatusBadge'
import { useTheme } from '../../contexts'

// Ao ABRIR o CRM (carregamento da página), sempre cair no Dashboard — mesmo que
// a URL salva/bookmark aponte pra outra tela. Reseta a cada reload (module state),
// então a navegação normal dentro da sessão continua livre.
let hasBootedToDashboard = false

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
      { path: '/equipe', icon: UsersRound, label: 'Meu Time' },
      { path: '/nps', icon: SmilePlus, label: 'Satisfacao (NPS)', roles: ['admin', 'gestor'] },
    ],
  },
  {
    label: 'Comercial',
    roles: ['admin', 'gestor', 'vendedor'],
    items: [
      { path: '/tarefas', icon: ListChecks, label: 'Tarefas' },
      { path: '/cotacoes', icon: FileText, label: 'Cotacoes', roles: ['admin', 'gestor'] },
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
      { path: '/whatsapp', icon: MessageSquare, label: 'WhatsApp' },
    ],
  },
  {
    label: 'Ferramentas',
    roles: ['admin', 'gestor', 'vendedor'],
    items: [
      { path: '/ask-ai', icon: Sparkles, label: 'Pergunte à IA' },
      { path: '/ai', icon: Brain, label: 'IA & Treinamento', roles: ['admin', 'gestor'] },
      { path: '/automations', icon: Zap, label: 'Automacoes', roles: ['admin', 'gestor'] },
      { path: '/webhooks', icon: Webhook, label: 'Webhooks', roles: ['admin'] },
      { path: '/hinova', icon: Link2, label: 'Hinova (SGA)', roles: ['admin', 'gestor'] },
      { path: '/projects', icon: ClipboardList, label: 'Projetos', roles: ['admin', 'gestor'] },
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
  const [roleMenuOpen, setRoleMenuOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  const currentRole = (user?.role?.name as UserRole) || 'admin'

  // No primeiro render após carregar a página, força o Dashboard.
  useEffect(() => {
    if (!hasBootedToDashboard) {
      hasBootedToDashboard = true
      if (location.pathname !== '/') {
        navigate('/', { replace: true })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar — Azul Institucional oficial 21Go (#293C82 = blue-500 do manual) */}
      <aside className="w-[260px] bg-blue-500 flex flex-col shadow-sidebar relative z-10">
        {/* Logo block — logomarca oficial 21Go sobre o navy (wordmark branco). Clique volta pro Dashboard. */}
        <div className="h-16 flex items-center px-5 border-b border-blue-400/30 bg-blue-500">
          <Link to="/" className="flex items-center h-full py-2" title="Ir para o Dashboard">
            <img
              src="/logo21go-trim.png"
              alt="21Go Proteção Patrimonial"
              className="h-full w-auto object-contain"
              style={{ filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.25))' }}
            />
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-hide">
          {NAV_SECTIONS.filter(canSeeSection).map((section, si) => (
            <div key={si}>
              {section.label && (
                <p className="font-mono text-[10px] font-bold uppercase text-blue-200/60 tracking-[0.2em] pt-5 pb-2 px-3">
                  {section.label}
                </p>
              )}
              {section.label === 'Comercial' && ['admin', 'gestor', 'vendedor'].includes(currentRole) && (
                <>
                  <FunilLink keyword="consultor" label="Funil dos Consultores" isActive={isActive} />
                  <FunilLink keyword="associado" label="Funil dos Associados" isActive={isActive} />
                </>
              )}
              {section.items.filter(canSeeItem).map((item) => {
                const Icon = item.icon
                const active = isActive(item.path)
                return (
                  <Link
                    key={item.path + item.label}
                    to={item.path}
                    className={`group ${active ? 'sidebar-nav-active' : 'sidebar-nav-inactive'}`}
                  >
                    <Icon size={18} className={active ? 'text-orange-400' : 'text-blue-200/70 group-hover:text-white transition-colors'} />
                    <span>{item.label}</span>
                    {active && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-dot-pulse" />
                    )}
                  </Link>
                )
              })}
            </div>
          ))}

        </nav>

        {/* User Profile */}
        <div className="px-3 py-3 border-t border-blue-400/30">
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-blue-600/40 transition-colors duration-200 ease-smooth group">
            <div className="w-9 h-9 rounded-xl bg-orange-500/20 border border-orange-400/40 flex items-center justify-center text-xs font-bold text-orange-300 flex-shrink-0">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{user?.firstName} {user?.lastName}</p>
              <p className="text-[11px] text-blue-200/60 truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              title="Sair"
              className="p-1.5 text-blue-200/60 hover:text-white rounded-lg hover:bg-error/20 transition-all duration-200 ease-smooth opacity-0 group-hover:opacity-100"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header — Azul Institucional oficial 21Go (#293C82 = blue-500) */}
        <header className="h-16 bg-blue-500 flex items-center justify-between px-6 flex-shrink-0 shadow-sm relative z-10">
          {/* Global Search */}
          <GlobalSearch />

          {/* Right Actions — navy header com elementos claros */}
          <div className="flex items-center gap-2">
            {/* Status de conexao real-time */}
            <SocketStatusBadge />

            <div className="w-px h-6 bg-blue-300/30 mx-1" />

            {/* Role Selector */}
            <div className="relative">
              <button
                onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/60 border border-blue-300/30 hover:border-blue-300/50 hover:bg-blue-600/80 transition-all duration-200 ease-smooth"
              >
                <Shield size={14} className="text-orange-300" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-orange-200">
                  {ROLE_LABELS[currentRole].label}
                </span>
                <ChevronDown size={12} className="text-blue-200/70" />
              </button>
              {roleMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setRoleMenuOpen(false)} />
                  <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg z-20 py-1 animate-fade-in-down">
                    {(Object.keys(ROLE_LABELS) as UserRole[]).map((role) => (
                      <button
                        key={role}
                        onClick={() => handleRoleChange(role)}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-slate-50 transition-colors duration-150 ease-smooth ${
                          currentRole === role ? 'text-blue-700 font-semibold' : 'text-slate-700'
                        }`}
                      >
                        <Shield size={14} className={currentRole === role ? 'text-orange-500' : 'text-slate-400'} />
                        {ROLE_LABELS[role].label}
                        {currentRole === role && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-500 animate-dot-pulse" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="w-px h-6 bg-blue-300/30 mx-1" />

            <button
              onClick={toggleTheme}
              title={theme === 'light' ? 'Mudar para escuro' : 'Mudar para claro'}
              aria-label="Alternar tema"
              className="p-2 rounded-xl text-blue-200/70 hover:text-white hover:bg-blue-600/40 transition-all duration-200 ease-smooth"
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            <button className="relative p-2 rounded-xl text-blue-200/70 hover:text-white hover:bg-blue-600/40 transition-all duration-200 ease-smooth">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full animate-dot-pulse" />
            </button>
            <button className="relative p-2 rounded-xl text-blue-200/70 hover:text-white hover:bg-blue-600/40 transition-all duration-200 ease-smooth">
              <Settings size={18} />
            </button>
            <div className="w-px h-6 bg-blue-300/30 mx-1" />
            <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl hover:bg-blue-600/40 transition-all duration-200 ease-smooth">
              <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-[11px] font-bold text-white border-2 border-orange-300/50">
                {user?.firstName?.[0]}{user?.lastName?.[0]}
              </div>
              <div className="text-left leading-tight">
                <p className="text-xs text-white font-semibold">{user?.firstName}</p>
                <p className="text-[10px] text-blue-200/70 uppercase tracking-wider">{ROLE_LABELS[currentRole].label}</p>
              </div>
              <ChevronDown size={14} className="text-blue-200/70" />
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

// Link direto pro kanban de um funil especifico, identificado por palavra-chave
// no nome do pipe (ex: 'consultor' acha "Funil de Consultores"). Se o pipe nao
// existir ainda, leva pra /pipes pra criar.
function FunilLink({
  keyword,
  label,
  isActive,
}: {
  keyword: string
  label: string
  isActive: (path: string) => boolean
}) {
  const { data: pipes } = usePipes()
  const pipe = (pipes || []).find((p) => p.name.toLowerCase().includes(keyword))
  const path = pipe ? `/pipes/${pipe.id}/kanban` : '/pipes'
  const active = isActive(path) || (!!pipe && isActive(`/pipes/${pipe.id}`))

  return (
    <Link
      to={path}
      className={`group ${active ? 'sidebar-nav-active' : 'sidebar-nav-inactive'}`}
      title={pipe ? '' : 'Funil ainda nao criado — clique pra gerenciar'}
    >
      <LayoutGrid size={18} className={active ? 'text-orange-400' : 'text-blue-200/70 group-hover:text-white transition-colors'} />
      <span>{label}</span>
      {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400 animate-dot-pulse" />}
    </Link>
  )
}
