# MASTER PLAN — 21Go CRM: Plataforma de Proteção Veicular

Este documento é a BÍBLIA do projeto. Leia INTEIRO antes de tocar em qualquer código.
Toda decisão de código, design, UX e arquitetura deve ser guiada por este documento.

---

## 1. O QUE É A 21Go

A 21Go é uma associação de proteção veicular no Rio de Janeiro com 20+ anos de mercado. NÃO é seguradora — funciona por mutualismo: todos os associados contribuem mensalmente para um fundo comum, e quando alguém sofre um sinistro (roubo, colisão, incêndio), o fundo cobre. Quanto mais associados, menor o rateio mensal para cada um.

### Planos
- **Básico**: Roubo/furto + Assistência 24h (guincho 200km)
- **Completo**: + Colisão + Incêndio + Carro reserva 7 dias
- **Premium**: + Terceiros R$100K + Vidros + Carro reserva 15 dias + Rastreamento

### Cálculo da mensalidade
`valor_mensal = valor_fipe × taxa_plano + R$35 (taxa admin)`
Taxas: Básico 1.8%, Completo 2.8%, Premium 3.8%

### Sistemas que a 21Go já usa
- **Hinova SGA**: gestão de associados e veículos
- **Hinova SGC**: boletos, cobranças, inadimplência
- **Hinova PowerCRM**: cotações e leads (básico)
- **WhatsApp**: atendimento manual (sem API ainda)
- **Instagram**: captação orgânica
- **Reclame Aqui**: nota 5.1 (precisa subir para 7.5+)

---

## 2. O QUE ESTAMOS CONSTRUINDO

Uma plataforma completa que substitui e integra tudo: CRM + IA + Operação + Growth. NÃO é apenas um CRM — é o sistema nervoso central da 21Go.

### 4 Pilares da transformação

**Pilar 1 — Retenção**: NPS automatizado, gestão Reclame Aqui, detecção de churn, onboarding 30 dias. Parar a sangria de clientes.

**Pilar 2 — Inteligência**: 11 agentes de IA especializados no coração da operação. Pré-venda 24/7, pós-venda proativo, briefing para gestores, gestão de sinistros inteligente, SEO data-driven.

**Pilar 3 — Crescimento**: Tráfego pago (Google Ads + Meta Ads), SEO, landing pages com cotação automática. Sair da invisibilidade online.

**Pilar 4 — Indicação**: Programa Member Get Member. 10% de desconto por indicação que fecha, acumulativo. 10 indicações = proteção gratuita.

---

## 3. QUEM USA O SISTEMA (1 app, 4 roles)

É UM sistema só. Mesmo login, mesma URL. O que muda é o menu lateral baseado na role do usuário.

### VENDEDOR (ex: Rodrigo, Carla, Thiago)
**Rotina**: Recebe leads qualificados pelo agente IA → liga/WhatsApp → move no funil → fecha adesão
**Vê**: Meus Leads, Funil/Kanban, Chat/WhatsApp, Cotação FIPE, Meu Desempenho
**NÃO vê**: Dashboard geral, Analytics, NPS, Financeiro, Sinistros, Config

### OPERAÇÃO (ex: Carlos mecânico, Pedro pintor, Ana vistoriadora)
**Rotina**: Abre app no celular → vê agenda do dia → atualiza status dos serviços → tira fotos
**Vê**: Minha Agenda, Sinistros atribuídos, Vistorias, Upload de fotos, Status de veículos
**NÃO vê**: Leads, Cotação, Dashboard, Financeiro, Analytics, MGM
**Importante**: Interface MOBILE-FIRST. Botões grandes, upload fácil, status com 1 toque.

### GESTOR (ex: Diretor comercial, gerente operacional)
**Rotina**: Briefing da manhã → Dashboard → age nos alertas → analisa campanhas → relatório do dia
**Vê**: Dashboard, Analytics, NPS, Ranking vendedores, Financeiro, MGM, Todos os leads, Automações, Projetos, Agentes IA, Sinistros (todos)
**Tela especial**: Aba Projetos (Kanban) para acompanhar evolução dos projetos com a FlowAI

### ADMIN
**Vê**: Tudo + Configurações do sistema, gestão de usuários, roles

### Regra de dados
- Vendedor só vê SEUS leads (filtrar por vendedor_id)
- Operação só vê SEUS sinistros/vistorias atribuídos
- Gestor e Admin veem tudo

---

## 4. OS 11 AGENTES DE IA

Cada agente tem um system prompt completo em `21go-squad/agents/`. Todos os 11 agentes estão instalados no módulo de IA do CRM.

| # | Agente | Icon | Função | Acesso | Framework base |
|---|--------|------|--------|--------|----------------|
| 1 | 21Go Chief | shield | Orquestrador — roteia para o agente certo | Todos | Routing por domínio |
| 2 | Pré-Venda | robot | Qualifica leads, cotação FIPE, atende 24/7 | vendedor, gestor | Hormozi CLOSER |
| 3 | Pós-Venda | handshake | Onboarding 30 dias, atendimento associados | vendedor, gestor | Hormozi Retention |
| 4 | Gestores | brain | Briefing manhã, relatório dia, consultas | gestor, admin | Data Chief + COO |
| 5 | Retenção | shield | Anti-churn, LTGP, segmentação por valor | gestor, admin | Hormozi + Peter Fader |
| 6 | Crescimento | rocket | MGM, viral loops, gamificação | gestor, admin | Sean Ellis (Dropbox) |
| 7 | Tráfego | target | Google Ads, Meta Ads, tráfego pago | gestor, admin | Pedro Sobral + Kasim |
| 8 | Operação | wrench | Agenda oficina, status serviço, vistorias | operação, gestor | Mobile-first |
| 9 | Financeiro | money | Boletos, inadimplência, MRR, projeções | gestor, admin | Integração Hinova SGC |
| 10 | Sinistros | alert | Abertura ao encerramento, oficinas, prazos | operação, gestor | Fluxo de 5 etapas |
| 11 | Danih (SEO) | search | SEO, keywords, blog, E-E-A-T, GEO, schema | gestor, admin | 7 mestres SEO integrados |

---

## 5. ESTADO ATUAL DO PROJETO

### O que JÁ foi feito:
- [x] Squad 21Go criada com 11 agentes (.md com system prompts)
- [x] Fase 1: 11 agentes instalados no módulo de IA do CRM (10 originais + Danih SEO)
- [x] Fase 2: Módulos de saúde removidos (Doctors, Appointments, Prontuário, Convênios)
- [x] Design system sofisticado aplicado (tema dark + dourado #C9A84C)
- [x] Módulo de Projetos (Kanban) criado
- [x] Dashboard adaptado para proteção veicular
- [x] NPS adaptado (removido referências a médicos)
- [x] 7 commits no GitHub, deploy configurado no Railway

### O que FALTA fazer (em ordem de prioridade):

**Arquitetura de Dominios:**
- **app.21go.site** → CRM interno (React+Fastify) — deploy Railway
- Cloudflare gerencia DNS

**URGENTE — Deploy:**
- [x] CRM rodando em app.21go.site (Railway)
- [ ] Configurar DNS no Cloudflare (app.21go.site -> Railway)

**Fase 3 — Contacts -> Associados:**
- [ ] Adaptar modelo Contact com campos veiculares (CPF, status, hinova_id, origem, UTM)
- [ ] Remover campos médicos
- [ ] Frontend: renomear tudo, tabela, formulário, drawer com tabs

**Fase 4 — Módulo Veículos:**
- [ ] Backend CRUD completo (placa, FIPE, plano, vistoria)
- [ ] Endpoint: GET /api/contacts/:id/vehicles
- [ ] Frontend: página + aba no drawer do associado

**Fase 5 — Leads + Sidebar por role:**
- [ ] Campos veiculares nos leads (placa, FIPE, cotação, etapa funil)
- [ ] Sidebar filtra menu por role do usuário logado
- [ ] RBAC middleware no backend

**Fase 6 — Módulos novos:**
- [ ] Sinistros (abertura, oficinas, status, fotos, timeline)
- [ ] Cotação FIPE (motor de cálculo automático)
- [ ] Member Get Member (link rastreável, desconto acumulativo)

**Fase 7 — Integrações:**
- [ ] WhatsApp Business API
- [ ] Hinova SGA/SGC/PowerCRM (API REST)
- [ ] Tabela FIPE (API externa)
- [ ] Google Ads + Meta Ads (pixel + conversões)

**Fase 8 — Agentes novos:**
- [ ] Instalar Agente Financeiro (money) no módulo de IA
- [ ] Instalar Agente Sinistros (alert) no módulo de IA

---

## 6. STACK TÉCNICA

- **Backend**: TypeScript, Fastify 4.26, Prisma 5.9.1, PostgreSQL
- **Frontend**: React 18, Vite, TanStack Query, Zustand, Tailwind CSS
- **Types**: Centralizados em shared/types/index.ts
- **Validação**: Zod (backend), React Hook Form (frontend)
- **IA**: Módulo em backend/src/modules/ai/ com CRUD de agentes
- **Padrão de módulos**: service -> controller -> routes (backend)
- **CRM Deploy**: Railway (Postgres + Redis + App) em app.21go.site — Cloudflare DNS

---

## 7. DESIGN SYSTEM

> **Referencia completa**: ver `brand-guide.md` na raiz do projeto.
> Toda decisao visual deve seguir o brand guide. Abaixo um resumo executivo.

Consultar **`brand-guide.md`** na raiz do projeto para a identidade visual completa.

Resumo rapido:
- **Tema**: Dark luxuoso (referencias: Linear App, Raycast, Vercel, Stripe)
- **Cor primaria**: Azul royal `#1B4DA1` (blue-500) -- identidade principal, sidebar, headers
- **Cor secundaria**: Laranja `#E07620` (orange-500) -- CTAs, logo, botoes de acao
- **Fundos**: `#060A14` (dark-950) -> `#0B1120` (dark-900) -> `#111827` (dark-800) -> `#1A1F35` (dark-700, cards)
- **Tipografia**: Outfit (display) + DM Sans (body) + JetBrains Mono (codigo/placas)
- **Tokens Tailwind**: `frontend/tailwind.config.js` (cores, sombras, animacoes, gradientes)
- **Componentes, tom de voz, icones, espacamento**: ver brand-guide.md

---

## 8. REGRAS DE OURO

1. **1 sistema, 4 roles** — sidebar muda por role, dados filtram por permissão
2. **Mobile-first para operação** — mecânico usa celular com mão suja
3. **Dados cruzam, telas não** — vendedor fecha -> vistoria aparece pra operação automaticamente
4. **Cada agente IA fala com um mundo** — pré-venda com vendedor, operação com mecânico, gestores com diretoria
5. **Receita primeiro** — sempre priorizar o que gera ou protege receita
6. **Mantenha o padrão** — mesmo estilo de código, mesma estrutura de módulos
7. **Commits frequentes** — mensagens descritivas em português
8. **Não atropele** — cada fase depende da anterior estar estável

---

## 9. STANDARDS DE CÓDIGO

### TypeScript
- **Type hints obrigatórios** em todas as funções públicas
- Usar types do `shared/types/index.ts` (nunca duplicar)
- `strict: true` no tsconfig

### React/Frontend
- **Componentes funcionais** apenas (sem classes)
- **Hooks customizados** para lógica de negócio (ex: `useContacts`)
- **Services** para chamadas API (ex: `contacts.service.ts`)
- **TanStack Query** para cache/estado servidor
- **Zustand** apenas para estado global (auth)
- **Tailwind CSS** para estilos (sem CSS modules)
- **Lucide React** para ícones
- **Sonner** para toasts

### Backend/Fastify
- **Estrutura modular:** module/service + controller + routes
- **Validação:** Zod schemas
- **Erros:** usar `AppError` para erros de negócio
- **Multi-tenant:** SEMPRE filtrar por `companyId`
- **RBAC:** verificar permissões antes de ações sensíveis

### Padrão de CRUD (usar Contacts como referência)
```
Backend:
  modules/{resource}/
    ├── {resource}.service.ts    # Lógica de negócio
    ├── {resource}.controller.ts # HTTP handlers
    └── {resource}.routes.ts     # Definição de rotas

Frontend:
  services/{resource}.service.ts  # Chamadas API
  hooks/use{Resource}.ts          # React Query hooks
  pages/{resource}/
    ├── {Resource}Page.tsx        # Página principal
    ├── {Resource}Table.tsx       # Tabela/lista
    ├── {Resource}Form.tsx        # Formulário
    └── {Resource}Drawer.tsx      # Modal lateral
```

### Bibliotecas Já Instaladas (usar!)
- **React DnD** - drag & drop (para Kanban)
- **Recharts** - gráficos (para Dashboard)
- **React Hook Form + Zod** - formulários com validação
- **date-fns** - manipulação de datas
- **Socket.io** - real-time (para chat/inbox)

---

## 10. COMMON COMMANDS

### Desenvolvimento
```bash
# Frontend (porta 5173)
cd frontend && npm run dev

# Backend MOCK (porta 3333) - SEM banco de dados
cd backend && npm run dev:mock

# Backend REAL (precisa PostgreSQL rodando)
cd backend && npm run dev
```

### Database (Prisma)
```bash
cd backend
npx prisma generate
npx prisma migrate dev --name nome_da_migration
npx prisma studio
npm run prisma:seed
```

### Build
```bash
cd frontend && npm run build
cd frontend && npm run type-check
cd backend && npm run build
cd backend && npm run test
```

---

## 11. API ENDPOINTS

### Implementados
```
POST   /api/auth/login
POST   /api/auth/register
POST   /api/auth/refresh
GET    /api/auth/me

GET    /api/contacts          # Paginação + busca
GET    /api/contacts/:id      # Com relacionamentos
POST   /api/contacts
PUT    /api/contacts/:id
DELETE /api/contacts/:id
GET    /api/contacts/tags
GET    /api/contacts/stats
```

### A implementar (mesmo padrão)
```
/api/leads
/api/vehicles
/api/sinistros
/api/pipes
/api/phases
/api/cards
/api/conversations
/api/webhooks
/api/automations
```

---

## 12. MULTI-TENANCY & RBAC

### Multi-tenancy
Todos os models têm `companyId`. NUNCA esquecer de filtrar por empresa:
```typescript
// CORRETO
const contacts = await prisma.contact.findMany({
  where: { companyId: user.companyId }
})

// ERRADO (vaza dados de outras empresas!)
const contacts = await prisma.contact.findMany()
```

### RBAC
Sistema de permissões: `resource:action:scope`
```
deals:read:own    -> só seus deals
deals:read:all    -> todos da empresa
deals:delete      -> pode deletar
settings:billing  -> acesso a faturamento
```
