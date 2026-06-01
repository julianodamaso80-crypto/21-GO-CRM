import { Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from './store/auth-store'

// Pages
import { DashboardPage } from './pages/dashboard/DashboardPage'
import { LeadsPage } from './pages/leads/LeadsPage'
import { AssociadosPage } from './pages/associados/AssociadosPage'
import { InboxPage } from './pages/inbox/InboxPage'
import { AITrainingPage } from './pages/ai/AITrainingPage'
import { AskAIPage } from './pages/ai/AskAIPage'
import { PipeBuilderPage } from './pages/pipes/PipeBuilderPage'
import { PipesListPage } from './pages/pipes/PipesListPage'
import { KanbanPage } from './pages/pipes/KanbanPage'
import { LoginPage } from './pages/auth/LoginPage'
import { WebhooksPage } from './pages/webhooks/WebhooksPage'
import { AutomationsPage } from './pages/automations/AutomationsPage'
import { AnalyticsPage } from './pages/analytics/AnalyticsPage'
import { NPSPage } from './pages/nps/NPSPage'
import { VehiclesPage } from './pages/vehicles/VehiclesPage'
import { ProjectsPage } from './pages/projects/ProjectsPage'
import { SinistrosPage } from './pages/sinistros/SinistrosPage'
import { CotacoesPage } from './pages/cotacoes/CotacoesPage'
import { IndicacoesPage } from './pages/indicacoes/IndicacoesPage'
import { TeamPage } from './pages/team/TeamPage'
import { TarefasPage } from './pages/tarefas/TarefasPage'
import { WhatsappPage } from './pages/whatsapp/WhatsappPage'

// Layouts
import { AppLayout } from './components/layouts/AppLayout'

function PrivateRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (!isAuthenticated) return <Navigate to="/login" replace />
  return <Outlet />
}

function PublicOnlyRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  if (isAuthenticated) return <Navigate to="/" replace />
  return <Outlet />
}

function ComingSoon({ title }: { title: string }) {
  return (
    <div className="p-6 flex flex-col items-center justify-center h-full min-h-[400px] page-enter">
      <div className="text-center">
        <div className="w-16 h-16 bg-gold-500/10 border border-gold-500/20 rounded-2xl flex items-center justify-center mx-auto mb-5">
          <span className="text-2xl">🚧</span>
        </div>
        <h2 className="text-xl font-display font-bold text-white mb-2">{title}</h2>
        <p className="text-gray-400">Modulo em desenvolvimento. Em breve disponivel.</p>
      </div>
    </div>
  )
}

export function Router() {
  return (
    <Routes>
      {/* Public routes */}
      <Route element={<PublicOnlyRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      {/* Protected routes */}
      <Route element={<PrivateRoute />}>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/leads" element={<LeadsPage />} />

          {/* Associados (antigo /patients e /contacts) */}
          <Route path="/associados" element={<AssociadosPage />} />
          <Route path="/patients" element={<Navigate to="/associados" replace />} />
          <Route path="/contacts" element={<Navigate to="/associados" replace />} />

          {/* Veiculos */}
          <Route path="/vehicles" element={<VehiclesPage />} />

          {/* Novos modulos */}
          <Route path="/cotacoes" element={<CotacoesPage />} />
          <Route path="/tarefas" element={<TarefasPage />} />
          <Route path="/sinistros" element={<SinistrosPage />} />
          <Route path="/indicacoes" element={<IndicacoesPage />} />
          <Route path="/hinova" element={<ComingSoon title="Integracao Hinova SGA" />} />

          {/* Mantidos */}
          <Route path="/nps" element={<NPSPage />} />
          <Route path="/inbox" element={<Navigate to="/whatsapp" replace />} />
          <Route path="/whatsapp" element={<WhatsappPage />} />
          <Route path="/ai" element={<AITrainingPage />} />
          <Route path="/ask-ai" element={<AskAIPage />} />
          <Route path="/pipes" element={<PipesListPage />} />
          <Route path="/pipes/new-ai" element={<PipeBuilderPage />} />
          <Route path="/pipes/:pipeId/kanban" element={<KanbanPage />} />
          <Route path="/deals" element={<Navigate to="/pipes" replace />} />
          <Route path="/webhooks" element={<WebhooksPage />} />
          <Route path="/automations" element={<AutomationsPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/equipe" element={<TeamPage />} />
        </Route>
      </Route>

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
