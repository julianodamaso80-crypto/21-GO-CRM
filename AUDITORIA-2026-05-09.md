# Auditoria 21Go CRM — Estado de ponta a ponta

**Data:** 2026-05-09
**Branch:** main (commit `2bf24e6`)
**Repo:** https://github.com/julianodamaso80-crypto/21-GO-CRM

---

## 1. O que é o projeto

CRM proprietário da **21Go**, associação de proteção veicular do Rio (20+ anos de mercado). Substitui Hinova SGA/SGC/PowerCRM. **1 sistema, 4 roles** (admin / gestor / vendedor / operacao), com sidebar e visibilidade de dados filtrados por role. Stack web (Vite SPA) + API REST (Fastify) + Postgres (Supabase) + Evolution API (WhatsApp).

Cobre 4 pilares:
1. **Retenção** — NPS, ouvidoria, anti-churn
2. **Inteligência** — squad de 11 agentes IA (pré-venda, pós-venda, sinistros, SEO, etc.)
3. **Crescimento** — tráfego pago + SEO + landing pages
4. **Indicação** — Member Get Member com desconto acumulativo

---

## 2. Stack & infraestrutura

### Backend
- **Runtime:** Node 20 + TypeScript 5
- **Framework:** Fastify 4.26
- **ORM:** Prisma 5.9.1
- **DB:** PostgreSQL via Supabase (`noawceqgqfwtpnrzmvdo.supabase.co`, sa-east-1, plano FREE)
- **Real-time:** Socket.io
- **Auth:** JWT + refresh token
- **Filas:** Bull + Redis (⚠️ Redis offline em produção — filas mortas)
- **Storage:** Cloudflare R2 (PDFs de cotação)
- **Hospedagem:** Easypanel @ `167.71.31.77` (DigitalOcean), projeto `social-21go`, serviço `crm-21go`

### Frontend
- **React 18 + Vite 5** (SPA, porta 5173 em dev)
- **State servidor:** TanStack Query 5
- **State global:** Zustand (só auth) + persist
- **Estilização:** Tailwind 3.4 + design system custom (azul royal `#1B4DA1` + laranja `#E07620`, dark luxuoso)
- **UI:** lucide-react, sonner, recharts, react-hook-form + zod, react-dnd
- **Tipografia:** Outfit (display) + DM Sans (body) + JetBrains Mono (placas)

### URLs
- **CRM frontend+API:** `https://crm21go.site` + `https://www.crm21go.site`
- **Site público:** `https://21go.site` (Next.js 16, separado, mesmo Supabase)
- **DNS:** Cloudflare (TTL 60s)
- **SSL:** Let's Encrypt automático via Traefik do Easypanel

### Env vars críticas (nomes, sem valores)
```
DATABASE_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
JWT_SECRET, REFRESH_TOKEN_SECRET
EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, EVOLUTION_WEBHOOK_SECRET
OPENAI_API_KEY, ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, DEFAULT_AI_PROVIDER
GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CONVERSION_ACTION
META_PIXEL_ID, META_ACCESS_TOKEN
APIBRASIL_TOKEN (placa + FIPE)
SMTP_HOST/USER/PASS, STORAGE_TYPE
PUBLIC_WEBHOOK_URL, BACKEND_URL, FRONTEND_URL, CORS_ORIGIN
```

---

## 3. Modelo de dados — 31 tabelas Prisma

**Multi-tenant**: quase todas têm `companyId` (root: `companies`).

### Núcleo CRM
| Tabela | Função |
|---|---|
| `companies` | Tenant raiz |
| `users` | Login + role (admin/gestor/vendedor/operacao) |
| `refresh_tokens` | JWT refresh com TTL |
| `audit_logs` | Compliance LGPD (quem fez o quê, antes/depois) |

### Vendas / Funil
| Tabela | Função |
|---|---|
| `leads` | Prospects pré-venda (FIPE consultado, status funil, gclid/fbp pra Ads CAPI) |
| `cotacoes` | Cotações formais (FIPE × taxa plano + admin) |
| `plate_lookups` | Cache de consulta placa (API Brasil) |
| `pipes` + `phases` + `cards` + `field_definitions` + `card_field_values` | Kanban genérico estilo Pipefy |
| `tasks` | Atividades de vendas (ligação/whatsapp/reunião/visita), Pipedrive-style |
| `indicacoes` | MGM (referral lead → associado convertido) |

### Operação / Pós-venda
| Tabela | Função |
|---|---|
| `associados` | Membros ativos (CPF, RG, status, hinova_id) |
| `vehicles` | Veículos protegidos (placa, FIPE, plano) |
| `sinistros` | Ocorrências (roubo/colisão/incêndio/terceiros) |
| `oficinas` | Rede credenciada |
| `vistorias` | Inspeção (adesão/periódica/sinistro) |
| `boletos` | Faturas (Hinova SGC ID) |
| `nps_surveys` | Pesquisas pós-evento |
| `ouvidoria` | Reclamação/sugestão/denúncia (anônimo opcional) |

### Comunicação
| Tabela | Função |
|---|---|
| `conversations` | Inbox (whatsapp/chat/email) |
| `messages` | Mensagens da conversa (idempotência via `whatsappMessageId @unique`) |
| `whatsapp_instances` | 1 por user, par com Evolution |

### IA & automações
| Tabela | Função |
|---|---|
| `ai_agents` | Squad (chief + 10 especialistas), provider + systemPrompt + RBAC granular |
| `knowledge_bases` + `knowledge_documents` | RAG dos agentes |
| `automacoes` | Triggers + conditions + actions (JSON) — ⚠️ executor não implementado |

### Gestão interna
| Tabela | Função |
|---|---|
| `projetos` | Kanban de tarefas internas |

---

## 4. Backend — módulos

26 módulos em `backend/src/modules/`. Padrão `service.ts → controller.ts → routes.ts`.

### Funcionando em produção ✅
`auth`, `users`, `leads`, `associados`, `vehicles`, `cotacoes`, `sinistros`, `vistorias`, `inbox`, `whatsapp`, `webhook-evolution`, `pipes`, `tasks`, `contacts`, `nps`, `indicacoes`, `ouvidoria`, `projects`, `analytics`, `dashboard`, `search`, `upload`, `webhooks`.

### Com problemas conhecidos ⚠️
- **`ai`** — controller chama métodos que não existem no service (`getDocumentForCascade`, `findKBByCollection`, `findDocumentByHash`). Squad 21Go inacessível pelo painel, mas dados de agentes estão no banco.
- **`plate-lookup`** — depende de Bull queue que precisa de Redis. Redis offline em prod → follow-up automático de 5min e reengajamento não dispara. Lead entra, mas não é nutrido.
- **`automations`** — schema existe, executor não. Triggers são gravados e ignorados.
- **`billing`** — schema Stripe configurado, env vars existem, integração desconectada das rotas reais.

### Módulos que MEXI nesta sessão (commit `2bf24e6`)
- `inbox/inbox.controller.ts` — corrigido bug "Nenhuma mensagem" (chamava método inexistente)
- `inbox/inbox.service.ts` — vendedor passa a ver fila não-atribuída + atribuídas a ele; ordem com `NULLS LAST`; emit socket no envio; métodos `updateConversationStatus` e `markAsRead` adicionados
- `whatsapp/*` — novo `POST /whatsapp/reconfigure-webhook` (atualiza URL do webhook em instância já conectada sem desconectar)
- `lib/evolution-client.ts` — novos métodos `setWebhook`, `findWebhook`, `findMessages`, `findChats`

---

## 5. Frontend — páginas

20 páginas funcionais + 1 placeholder (`/hinova` → ComingSoon). Todas em `frontend/src/pages/`.

### Por domínio
| Página | Estado | Observação |
|---|---|---|
| Dashboard | ✅ | KPIs com recharts |
| Associados | ✅ | CRUD + drawer + stats |
| Veículos | ✅ | Filtros, vistorias inline |
| Leads | ✅ | Funil (novo→cotacao→fechado), tarefas integradas |
| Tarefas | ✅ | 3 vistas: Hoje / Calendário / Kanban |
| Funil de Vendas (Pipes) | ✅ | List + Kanban (drag-drop) + Builder com IA |
| Cotações | ✅ | FIPE + 3 planos |
| Sinistros | ✅ | Workflow (aberto→oficina→pronto→encerrado) |
| Indicações (MGM) | ✅ | Gamificação Bronze/Prata/Ouro/Diamante |
| WhatsApp | ✅ | QR + chat + real-time socket |
| Inbox | ✅ | Atualmente redireciona pra /whatsapp |
| IA & Treinamento | ✅ | KBs + agentes + chat + analytics |
| Analytics | ✅ | 8 tabs (Funnel, LTV, ROI, Sources, Campaigns, Trends...) |
| NPS | ✅ | Score + pie chart promoter/passive/detractor |
| Automações | ✅ | UI pronta, executor backend faltando |
| Webhooks | ✅ | CRUD + logs |
| Projects | ✅ | Kanban interno |
| Billing | ✅ | UI 4 tabs, integração Stripe pendente |
| Equipe & Acessos | ✅ | Team + roles + deactivate |
| Hinova SGA | ⚠️ | Placeholder "em desenvolvimento" |

### Sidebar dinâmica por role
- Renderizada em `frontend/src/components/layouts/AppLayout.tsx`
- Array `NAV_SECTIONS` define `roles: string[]` por seção e por item
- Funções `canSeeSection` e `canSeeItem` filtram pelo `user.role.name` (Zustand)
- Header tem **Role Selector** (dev tool) que troca o role no Zustand sem persistir no backend — útil pra simular cada visão

| Role | Acessa |
|---|---|
| **admin** | Tudo |
| **gestor** | Tudo exceto Webhooks, Equipe, Vistorias, Indicações |
| **vendedor** | Dashboard, Associados, Leads, Tarefas, Cotações, Indicações, WhatsApp, IA |
| **operacao** | Dashboard, Sinistros, Vistorias |

---

## 6. Hooks de dados (frontend/src/hooks/)

| Hook | Estratégia |
|---|---|
| `useContacts`, `useLeads`, `useUsers`, `useAnalytics`, `useNPS`, `useBilling`, `useDashboard`, `useProjects`, `useAutomations`, `useWebhooks` | Cache 5 min, sem polling |
| `useTasks`, `useKanban`, `useCards` | Cache 30s–2min, sem polling |
| `useConversations`, `useMessages`, `useInbox` | **Polling 15-30s** ⚠️ |
| `useWhatsapp` (status) | Polling enquanto desconectado |
| `useSocketEvent`, `useTypingIndicator` | Real-time via Socket.io |

**Observação:** Socket está conectado e funcionando, mas a maior parte da UI ainda usa polling. Real-time só está plugado em CardDrawer (mexido hoje) e typing indicator. Migrar Inbox/Tarefas/Kanban pra socket seria ganho rápido.

---

## 7. Integrações externas

| Integração | Estado | Notas |
|---|---|---|
| **Evolution API (WhatsApp)** | ✅ Produção | Webhook recebe `MESSAGES_UPSERT`, `CONNECTION_UPDATE`. Envia texto. Idempotência via `whatsappMessageId @unique`. |
| **Google Ads CAPI** | ✅ Produção | Offline conversions via gclid |
| **Meta CAPI** | ✅ Produção | Offline conversions via fbp/fbc |
| **API Brasil (placa+FIPE)** | ✅ Produção | Cache em `plate_lookups` |
| **Cloudflare R2** | ✅ Produção | PDFs de cotação |
| **Anthropic Claude** | ⚠️ Mock | SDK instalado, prompt no banco, controller bugado |
| **OpenAI / Google Gemini** | ⚠️ Mock | Configurados em env, não usados em rotas |
| **Stripe** | ⚠️ Stub | Schema + env, sem integração |
| **Hinova SGA/SGC** | ❌ Stub | Apenas campos `hinovaId`/`hinovaBoletoId`. Zero lógica de sync. |
| **SMTP (Gmail)** | ⚠️ Parcial | Usado em follow-up de cotação |
| **Redis** | ❌ Offline | Bull queues mortas em prod |

---

## 8. Real-time (Socket.io)

### Backend (`backend/src/websocket/socket.service.ts`)
**Eventos servidor → cliente:**
- `inbox:new_message` (emitido pelo webhook E pelo envio próprio agora)
- `inbox:message_read`
- `typing:started`, `typing:stopped`
- `conversation:updated`, `conversation:assigned`

**Eventos cliente → servidor:**
- `join_room` / `leave_room`
- `message:read`
- `typing:start` / `typing:stop`

**Auth:** JWT no handshake, decodifica em `socket.data.userId/companyId/email`.

**Rooms automáticos:** `company:${companyId}`, `user:${userId}`, `conversation:${id}`, `inbox:${companyId}`.

### Frontend (`frontend/src/contexts/SocketContext.tsx`)
- Provider envolve todo App
- Auto-join `company:${companyId}` em connect/reconnect
- Hook genérico `useSocketEvent(event, callback)`
- 5 retentativas, delay 1-5s, timeout 20s

---

## 9. RBAC

**Modelo:** campo `User.role` string (4 valores). Existe também tabela `roles` mas o projeto opera com string direto.

**Aplicação atual:**
- Sidebar: filtragem 100% via `canSeeSection/canSeeItem` lendo `user.role`
- API: filtros manuais por módulo (`Lead.vendedorId`, `Conversation.assignedToId`, `Sinistro.responsavelId`, etc.)
- Middleware `check-permission.ts` existe mas **não compila** (TS error: `role` não existe no objeto Prisma) — segurança fina não aplicada

**AIAgent tem RBAC granular** (não plugado a outros recursos):
- `allowedRoles: string[]`
- `allowedScopes: string[]` (associados, leads, analytics, etc.)
- `permissions: { canCreateLeads, canTransferToHuman, ... }`

---

## 10. Estado real do banco (snapshot 2026-05-09)

```
Empresa:              company-21go
Users:                ~8 (admin, gestor, vendedor x3, operacao, etc.)
Leads:                1.532
Associados:           ~poucos (precisa migrar do Hinova)
Conversations WApp:   1.661 (todas atribuídas a Leticya)
Messages:             10.992 (importadas hoje da Evolution; total Evolution: 16.786)
WhatsAppInstances:    1 ativa (`21gosite`, Leticya, CONNECTED)
```

**Situação real-time:** webhook funcionando, mensagens novas chegam em <1s, atribuição automática pra Leticya OK depois do fix do `evolutionName` no banco (era `21gosite2`, virou `21gosite`).

---

## 11. Bugs e débitos conhecidos

### 🔴 Bloqueantes (afetam funcionamento percebido)
1. **`/whatsapp` clica conversa → "Nenhuma mensagem"** — fix aplicado no commit `2bf24e6`, **aguarda deploy** no Easypanel
2. **AI não compila** — métodos faltantes no service (`getDocumentForCascade` etc.). Squad 21Go inacessível.
3. **Redis offline** — Bull queues não rodam, follow-up automático de cotação morto.

### 🟠 Avisos
1. Middleware RBAC `check-permission.ts` não compila — segurança fina não aplicada
2. `automacoes` tem schema mas zero executor
3. Stripe schema OK mas integração desconectada
4. Hinova é stub puro (campos sem lógica)
5. Socket.io subutilizado (maior parte da UI usa polling)
6. ~12 warnings TS (imports não usados) em frontend e backend
7. `EVOLUTION_WEBHOOK_SECRET` não setado em produção — webhook aceita sem checar header

### 🟢 Cobertura de testes
2 arquivos `*.test.ts` (ai + pipes). Vitest instalado. Cobertura mínima.

---

## 12. O que mudou nesta sessão (2026-05-09)

### Descobertas críticas
1. **Webhook da Evolution apontava pro site público** (`21go.site/api/webhooks/evolution`) em vez do CRM. Reconfigurado pra `crm21go.site/api/webhook/evolution` via curl direto.
2. **Sessão WhatsApp estava `close`** (caída). Usuário re-escaneou QR.
3. **Mismatch de nome**: instância na Evolution chamava `21gosite`, no banco do CRM estava `21gosite2`. Webhook nunca conseguia mapear pra usuário. UPDATE no banco corrigiu.
4. **Filtro vendedor invisível**: `inbox.service.ts` mostrava só conversas atribuídas. Vendedora "Leticya" tinha 0 conversas atribuídas → enxergava vazio. Corrigido no código (vê fila aberta) + UPDATE em massa no banco atribuindo as 500 conversas pra ela.
5. **Bug "Nenhuma mensagem"**: controller chamava `inboxService.getMessages` (não existe). Corrigido pra `getConversationMessages`.

### Implementações
- **Importador de histórico WhatsApp** (`backend/import-history.tmp.js`, ad-hoc) — puxou 10.992 mensagens de 16.786 disponíveis na Evolution. As que sobraram são mídias/sem texto/sem fone.
- **Optimistic update no Kanban** — drag-and-drop deixou de esperar 10s pelo servidor
- **Optimistic message no chat** — input limpa imediatamente, mensagem aparece de cara
- **Listener `inbox:new_message` no CardDrawer** — chat atualiza em tempo real sem polling
- **`POST /whatsapp/reconfigure-webhook`** + botão `📡 Wifi` na UI pra reconfigurar webhook em instância existente
- **Métodos novos no `evolution-client.ts`**: `setWebhook`, `findWebhook`, `findMessages`, `findChats`
- **`NULLS LAST` no orderBy de conversations** — conversas sem mensagem afundam pro fim

### Aplicado direto no banco (sem deploy)
- 500 conversas WhatsApp atribuídas a Leticya (`assignedToId` UPDATE)
- 252 conversas vazias com `lastMessageAt = createdAt` pra não poluírem o topo
- `WhatsappInstance.evolutionName` corrigido `21gosite2` → `21gosite`

---

## 13. Próximos passos sugeridos

### P0 — pra fechar o ciclo "WhatsApp como CRM"
1. **Deploy do backend no Easypanel** (commit `2bf24e6`) — desbloqueia o "Nenhuma mensagem"
2. **Setar `PUBLIC_WEBHOOK_URL=https://crm21go.site` no Easypanel** — sem isso, instâncias novas não terão webhook configurado corretamente
3. **Setar `EVOLUTION_WEBHOOK_SECRET` no Easypanel** — webhook está aceitando qualquer chamada sem auth
4. **Importador como rota oficial** — `POST /whatsapp/import-history` em vez de script ad-hoc; botão na UI

### P1 — saneamento
5. **Consertar `ai.controller.ts`** — implementar métodos faltantes ou remover endpoints. Sem isso, agente IA é vitrine.
6. **Resolver Redis** — escolher: (a) ativar Redis no Easypanel, (b) trocar Bull por scheduler nativo (cron do Fastify)
7. **Migrar polling pra socket** — Inbox e Tarefas, ganho de UX e custo
8. **Compilar TypeScript limpo** — frontend e backend zerados

### P2 — funcionalidades novas (alinhadas ao Master Plan)
9. **Hinova integration real** — sync `Associado.hinovaId` ↔ Hinova SGA; `Boleto.hinovaBoletoId` ↔ SGC
10. **Executor de `automacoes`** — worker que processa triggers
11. **Stripe ativação** — boletos e mensalidades
12. **Round-robin** de atribuição (hoje toda conversa nova vai pra dono da instância)

---

## 14. Como rodar localmente

```bash
# Frontend (porta 5173)
cd frontend && npm run dev

# Backend MOCK sem banco (porta 3333)
cd backend && npm run dev:mock

# Backend REAL contra Postgres (precisa DATABASE_URL no .env)
cd backend && npm run dev

# Prisma
cd backend
npx prisma generate
npx prisma migrate dev --name nome
npx prisma studio   # GUI do banco
```

---

## 15. Documentos do projeto

- `CLAUDE.md` (raiz) — bíblia/master plan: visão de produto, 4 pilares, 11 agentes IA, regras de ouro
- `brand-guide.md` (raiz) — design system completo (cores, tipo, componentes)
- `21go-squad/agents/*.md` — system prompts dos 11 agentes IA
- `backend/prisma/schema.prisma` — modelo de dados completo
- `frontend/tailwind.config.js` — tokens visuais

---

**Auditoria gerada em sessão de 2026-05-09. Reflete commit `2bf24e6` e o estado vivo do banco no momento.**
