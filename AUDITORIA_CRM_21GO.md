# 🔍 Auditoria Forense — CRM 21Go

> **Data:** 2026-05-11
> **Auditora:** Claude Code (Opus 4.7)
> **Branch:** `main` — HEAD em `dcd221e`
> **Modo:** Diagnóstico (zero alteração de código)
> **Escopo:** repo `c:/Users/damas/Documents/PROJETOS/21 GO/21 GO - CRM`
> **Foco principal:** problema crítico de latência de mensagens WhatsApp

---

## 📌 Resumo Executivo

O CRM 21Go é um sistema bem-estruturado (~26 módulos backend, ~20 páginas frontend, 31 tabelas Prisma) que está **operacional em produção** mas com uma falha grave de UX no canal WhatsApp. Auditoria identificou que o problema não tem **uma** causa raiz — é uma **soma de gargalos** que se compõem.

### Os 5 problemas mais críticos (por ordem de impacto no sintoma relatado):

| # | Severidade | Problema | Onde |
|---|---|---|---|
| 1 | 🔴 **P0** | **Socket.IO forçado a long-polling** (não WebSocket) — Traefik do Easypanel não faz upgrade WS. Eventos chegam, mas com jitter de 1-3s por evento, e qualquer hiccup mata o socket | [SocketContext.tsx:60](frontend/src/contexts/SocketContext.tsx#L60), commit `967a374` |
| 2 | 🔴 **P0** | **Quando o socket cai, fallback é polling de 15s** — explica perfeitamente o sintoma de "10-20s" relatado. Comentário do código diz 60s, mas o valor real é 15s — divergência entre doc e código | [useInbox.ts:21](frontend/src/hooks/useInbox.ts#L21) |
| 3 | 🔴 **P0** | **`listConversations` traz 1.661 conversas sem paginação a cada heartbeat** — query pesada que rodando a cada 15s pode causar bloqueio do socket polling no mesmo processo. Causa atrasos em cascata | [inbox.service.ts:72-93](backend/src/modules/inbox/inbox.service.ts#L72-L93) |
| 4 | 🟠 **P1** | **`sendMessage` é síncrono até o retorno da Evolution + delay anti-ban de 1000ms** — explica o atraso na visualização do envio (CRM → cliente). Frontend trava até o backend completar todo o pipeline | [inbox.service.ts:201-275](backend/src/modules/inbox/inbox.service.ts#L201-L275) + [evolution-client.ts:276](backend/src/lib/evolution-client.ts#L276) |
| 5 | 🟠 **P1** | **Rate limit muito baixo (100 req / 15 min)** combinado com heartbeat de 15s — usuário ativo com 2 abas atinge o teto rápido. Bloqueio gera "atualização que não vem" — pode explicar os outliers de 3 minutos | [server.ts:89-92](backend/src/server.ts#L89-L92) |

### O que está bom:
- Arquitetura modular, separação service/controller/routes consistente.
- Idempotência via `whatsappMessageId @unique` — sem duplicação.
- Multi-tenant com `companyId` filtrado em quase todas as queries.
- Cross-tenant guard no socket (`socket.service.ts:151-200`).
- Smoke test reproduzível (`backend/scripts/smoke-realtime.ts`).
- Webhook sempre retorna 200 (impede Evolution de desligar).

---

## 🔥 PARTE 1 — Diagnóstico do problema crítico (latência WhatsApp)

### Mapa do fluxo (estado atual real)

```
Cliente envia msg no WhatsApp
  │
  ├─► WhatsApp servers
  │     │
  │     └─► Evolution API (auto-hospedada, EVOLUTION_API_URL)
  │           │
  │           ├─ aplica delay anti-ban (?) — não medido
  │           │
  │           └─► POST https://crm21go.site/api/webhook/evolution
  │                 [header: x-evolution-secret]
  │                       │
  │                       ├─► Cloudflare (proxy?)
  │                       │     │
  │                       │     └─► Traefik (Easypanel @ 167.71.31.77)
  │                       │           │
  │                       │           └─► Fastify (crm-21go container)
  │                       │                 │
  │                       │                 ├─ valida x-evolution-secret
  │                       │                 ├─ handleMessageUpsert():
  │                       │                 │   - extractPhone
  │                       │                 │   - findUnique(whatsappMessageId)
  │                       │                 │   - findUnique(WhatsappInstance)
  │                       │                 │   - resolveCompanyId
  │                       │                 │   - findFirst(Associado)
  │                       │                 │   - findFirst(Lead) OR
  │                       │                 │   - create(Lead) + create(Card)
  │                       │                 │   - findFirst/create(Conversation)
  │                       │                 │   - create(Message)
  │                       │                 │   - updateMany(Conversation)
  │                       │                 │
  │                       │                 └─► socketService.emitToCompany(
  │                       │                        'inbox:new_message', ...)
  │                       │                                │
  │                       │                                ├─► Socket.IO server
  │                       │                                │     [transports=polling]
  │                       │                                │     pingInterval=25s
  │                       │                                │     pingTimeout=60s
  │                       │                                │           │
  │                       │                                │           └─► Cliente
  │                       │                                │                 (long-polling
  │                       │                                │                  next poll)
  │                       │                                │
  │                       │                                └─► useSocketEvent dispara
  │                       │                                    qc.invalidateQueries
  │                       │                                                │
  │                       │                                                └─► GET /api/conversations
  │                       │                                                    (lista 1.661 conversas)
```

**E paralelo:** TanStack Query roda `refetchInterval: 15000` como heartbeat — toda 15s puxa lista de conversas + mensagens da conversa aberta, independentemente do socket.

### Causa-raiz: é uma composição, não uma única coisa

#### Causa #1 (mais provável para o sintoma "10-20s") — Heartbeat de 15s mascarando socket morto/lento

O arquivo [frontend/src/hooks/useInbox.ts:21](frontend/src/hooks/useInbox.ts#L21):

```ts
const HEARTBEAT_MS = 1000 * 15  // 15s
```

E o relatório do Projeto Japão ([PROJETO-JAPAO-RELATORIO-FINAL.md:54](PROJETO-JAPAO-RELATORIO-FINAL.md#L54)) afirma "60s heartbeat" — mas o código real, depois do commit `967a374`, está em **15s**.

**Sintoma observado bate matematicamente:** quando o socket está com problema (polling lento, conexão pendurada, Traefik bufferizando), o tempo até a atualização aparecer é o intervalo do heartbeat. **10-20s do sintoma ≈ 15s do heartbeat (com jitter)**.

#### Causa #2 — Long-polling em vez de WebSocket (commit `967a374`)

[frontend/src/contexts/SocketContext.tsx:60](frontend/src/contexts/SocketContext.tsx#L60):

```ts
transports: ['polling'],
```

Mensagem do commit `967a374` (texto original):

> O Traefik do Easypanel nao esta repassando o handshake WebSocket — todo client que tenta upgrade falha. Resultado: socket fica em ciclo de "tenta WS → falha → tenta de novo" e perde eventos no meio. Long-polling funciona estavel — eventos chegam < 1s — mas o cliente nao consegue estabilizar nele por causa do upgrade attempt.

**Tradução técnica:**
- Long-polling não é "tempo real". É HTTP requests em sequência. Cada evento que o servidor quer entregar **espera o próximo poll do cliente** (default ~25s no Socket.IO entre pings). Quando o evento chega entre pings, ele é entregue na próxima janela.
- O smoke test mediu 1.7s de latência. Mas a medição é em laboratório, com fetch direto. Na vida real, com aba do navegador em background, com várias queries TanStack disputando conexões HTTP/1.1 limitadas a 6 sockets paralelos, com Cloudflare buffer (se proxy ativo), com Traefik buffer, a latência **explode**.
- O `pingInterval: 25000` + `pingTimeout: 60000` no backend ([socket.service.ts:38-39](backend/src/websocket/socket.service.ts#L38-L39)) significa que se um poll demorar mais que 60s, o servidor considera o cliente desconectado. Aí o cliente reconecta, perde a sessão da room atual, e os eventos do meio se perdem **até o próximo invalidate via heartbeat**.

#### Causa #3 — Query de `listConversations` sem LIMIT

[backend/src/modules/inbox/inbox.service.ts:72-93](backend/src/modules/inbox/inbox.service.ts#L72-L93):

```ts
const conversations = await prisma.conversation.findMany({
  where,
  include: {
    associado: { select: { id: true, nome: true, ... } },
    lead: { select: { id: true, nome: true, ... } },
    assignedTo: { select: { id: true, firstName: true, lastName: true } },
    messages: {
      orderBy: { createdAt: 'desc' },
      take: 1,
      ...
    },
  },
  orderBy: { lastMessageAt: { sort: 'desc', nulls: 'last' } },
})
```

**Não tem `take` (limit) nem paginação.** A auditoria anterior (AUDITORIA-2026-05-09.md:264) anotou: **1.661 conversas no banco**. Cada heartbeat dispara essa query, que:
- Faz JOIN com 3 tabelas relacionadas.
- Carrega a última mensagem de cada conversa.
- Retorna ~1.661 objetos.
- Trafega pela rede (Cloudflare → Traefik → frontend).

Em Postgres Supabase plano FREE com pooler `aws-1`, isso pode levar 2-5s tranquilamente em carga. **Enquanto essa query está em vôo, o long-polling do socket disputa o mesmo limite de conexões HTTP/1.1 com o navegador (6 paralelas)**. Se o navegador estiver com Network full (várias abas, fetches do dashboard, etc.), o socket polling fica em fila — e aí os eventos que o servidor quer entregar ficam pendurados.

#### Causa #4 — Envio (CRM → cliente) com pipeline síncrono pesado

[backend/src/modules/inbox/inbox.service.ts:201-275](backend/src/modules/inbox/inbox.service.ts#L201-L275):

1. Frontend chama `POST /api/conversations/:id/messages`.
2. Backend faz `findFirst(Conversation)` com 2 includes.
3. Backend faz `findFirst(WhatsappInstance)`.
4. Backend chama **Evolution API com `delay: 1000` (anti-ban)** — [evolution-client.ts:276](backend/src/lib/evolution-client.ts#L276):
   ```ts
   { number, text, delay: params.delayMs ?? 1000 }
   ```
   **Esse delay de 1s é instrução pra Evolution segurar o envio antes de mandar pro WhatsApp — mas o backend espera o response.** Adiciona ~1s mínimo no caminho.
5. Se Evolution retornar 401/403, faz auto-heal (fetchInstanceApiKey + retry) — pode adicionar +1s.
6. `prisma.message.create()`.
7. `prisma.conversation.update()`.
8. `socketService.emitToCompany(...)` — vai pro long-polling.
9. Retorna pro frontend.

**No melhor caso, ~1.5-2.5s só de pipeline backend. No pior (auto-heal), 3-5s.** Frontend tem optimistic update no `useSendMessage.onSuccess`, mas o `inbox:new_message` que confirma só chega depois disso.

#### Causa #5 — Rate limit + 2 abas + heartbeat

[backend/src/server.ts:89-92](backend/src/server.ts#L89-L92):

```ts
await fastify.register(rateLimit, {
  max: env.RATE_LIMIT_MAX_REQUESTS,        // default 100
  timeWindow: env.RATE_LIMIT_WINDOW_MS,    // default 900000ms (15min)
})
```

Cálculo: 1 vendedor logado, 1 aba do inbox aberta = 4 req/min de heartbeat (conversations + messages). + login + outras telas + Socket.IO polling (que **também conta no rate limit** já que vai pelo mesmo IP). Em 15 minutos, isso passa fácil de 100 requests. Quando estoura, o backend retorna **429**.

**Quando o frontend recebe 429, TanStack Query faz retry com backoff exponencial** ([App.tsx:9](frontend/src/App.tsx#L9): `retry: 1`). Mas o Socket.IO polling também é bloqueado.

**Isso explica os outliers de 3 minutos do sintoma** — usuário ativo por algumas dezenas de minutos satura o rate limit, fica sem atualização por mais 15 min até o window resetar.

#### Causa #6 (potencial) — Cloudflare proxy bufferizando long-polling

A memória do projeto ([MEMORIA-21Go.md:35](C:\Users\damas\Documents\OBSIDIAN\Meu segundo cerebro\ClaudeCode\Memoria\MEMORIA-21Go.md#L35)) diz "DNS via Cloudflare (TTL 60s)". **Não está claro se o proxy está ATIVADO (laranja)** ou só DNS (cinza).

Se proxy estiver ativo, Cloudflare faz buffer agressivo em long-polling de Socket.IO — é problema documentado. **Pergunta para confirmar com você.**

#### Causa #7 — `EVOLUTION_WEBHOOK_SECRET` precisa estar setado E a Evolution precisa estar mandando o header

[backend/src/modules/webhook-evolution/webhook-evolution.routes.ts:23-37](backend/src/modules/webhook-evolution/webhook-evolution.routes.ts#L23-L37):

Se a env `EVOLUTION_WEBHOOK_SECRET` estiver setada no Easypanel **mas a Evolution não estiver enviando o header `x-evolution-secret`**, o webhook responde 401 e a mensagem **nunca é processada**. Cliente fica sem ver nada vir, até o webhook ser reconfigurado.

A Evolution só passa o header se a instância foi criada/reconfigurada com `webhook.headers` no body. O método [evolution-client.ts:174-198](backend/src/lib/evolution-client.ts#L174-L198) faz isso — mas só roda se você apertar o botão **📡 Wifi** na UI ou criar instância nova. Instâncias antigas (`21gosite` da Leticya, ativa desde antes do Projeto Japão) **podem não ter o header configurado**.

### Tentativas anteriores de correção (cronológica)

| Commit | Tentativa | Resultado |
|---|---|---|
| `2bf24e6` | Real-time + bug "Nenhuma mensagem" + reconfig webhook | Parcial — corrigiu vários bugs colaterais |
| `0af9726` (Fase 5 Japão) | Substituiu polling 15-30s por socket + heartbeat de **60s** | Funcionou em smoke test, mas não em prod |
| `967a374` | "Força polling no socket + reduz heartbeat fallback" | Mitigação — diagnosticou que WS não sobe e voltou heartbeat pra 15s. **Pelo histórico, foi aqui que o problema atual estabilizou** |
| `f525c1d` | Adiciona smoke test + badge de status do socket | Observabilidade — não corrige |
| `dcd221e` | Limpa código morto (Stripe, contacts, RBAC quebrado) | Saneamento — sem efeito na latência |

**Padrão das tentativas:** todas trataram sintomas (polling vs WS, heartbeat 60→15s, badge), nenhuma atacou as **causas compostas** — especialmente a query gigante sem LIMIT, o pipeline síncrono do `sendMessage`, e a infraestrutura (Cloudflare/Traefik) que estrangula o long-polling.

---

## 📋 PARTE 2 — Auditoria 360° do projeto

### 1. Mapa do projeto

**Stack:**
- **Backend:** Node 20, TypeScript 5, Fastify 4.26, Prisma 5.9.1, Socket.IO 4.6.1, Bull 4.12.2, ioredis 5.3.2, JWT 9.0.3, Zod, OpenAI/Anthropic/Google AI SDKs, Puppeteer-core 23.10.4 (PDF cotação).
- **Frontend:** React 18.2, Vite 5.1, TanStack Query 5.20, Socket.IO-client 4.8.3, axios, Zustand (auth), React Router 6, Tailwind 3.4.
- **Banco:** PostgreSQL via Supabase (`noawceqgqfwtpnrzmvdo.supabase.co`, sa-east-1, plano FREE), pooler aws-1.
- **Real-time:** Socket.IO **forçado a polling** (Traefik não faz upgrade).
- **Storage:** Cloudflare R2 (PDFs).
- **Hospedagem:** Easypanel @ `167.71.31.77` (DigitalOcean), projeto `social-21go`, serviço `crm-21go`.
- **DNS:** Cloudflare (TTL 60s). **Proxy: status desconhecido.**
- **SSL:** Let's Encrypt automático via Traefik.

**Estrutura de pastas (resumo):**

```
21 GO - CRM/
├── backend/
│   ├── src/
│   │   ├── server.ts              # Entry: Fastify + bootstrap
│   │   ├── server.mock.ts         # Backend mock para dev
│   │   ├── config/                # env, database (Prisma)
│   │   ├── middlewares/           # auth, error-handler
│   │   ├── lib/                   # evolution-client (Evolution API SDK)
│   │   ├── modules/
│   │   │   ├── auth/              # JWT + refresh
│   │   │   ├── users/             # CRUD users
│   │   │   ├── associados/        # Membros ativos
│   │   │   ├── leads/             # Prospects funil
│   │   │   ├── inbox/             # Conversations + sendMessage
│   │   │   ├── whatsapp/          # WhatsApp Instance CRUD + reconfigure
│   │   │   ├── webhook-evolution/ # Receptor webhook Evolution
│   │   │   ├── webhooks/          # Webhooks genéricos saída
│   │   │   ├── realtime/          # /api/realtime/health + /stats
│   │   │   ├── ai/                # Squad agentes (PARCIAL — 503 ingest)
│   │   │   ├── pipes/             # Kanban Pipefy-like
│   │   │   ├── tasks/             # Atividades de vendas
│   │   │   ├── vehicles/, sinistros/, cotacoes/, vistorias/
│   │   │   ├── indicacoes/        # MGM
│   │   │   ├── plate-lookup/      # FIPE + queue Bull (DESLIGADA)
│   │   │   ├── nps/, ouvidoria/, dashboard/, analytics/
│   │   │   ├── projects/, search/, upload/, automations/
│   │   │   └── ...
│   │   ├── websocket/             # socket.service + types
│   │   └── utils/                 # logger, AppError
│   ├── prisma/                    # schema.prisma + migrations
│   ├── scripts/                   # smoke-realtime, smoke-pdf, etc
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.tsx                # Router + providers
│   │   ├── Router.tsx
│   │   ├── contexts/              # SocketContext, NotificationProvider, ThemeProvider
│   │   ├── hooks/                 # 17 hooks (useInbox, useSocketEvent, etc)
│   │   ├── pages/                 # 20+ pages
│   │   ├── services/              # API clients
│   │   ├── store/                 # Zustand auth
│   │   ├── components/            # AppLayout, SocketStatusBadge, etc
│   │   └── styles/
│   └── tailwind.config.js
├── shared/types/                  # Types compartilhados
├── 21go-squad/agents/             # Markdowns dos 11 agentes IA
├── docs/, scripts/, krob-tracking-stack/
├── CLAUDE.md                      # Master plan (bíblia)
├── brand-guide.md
├── Dockerfile, nixpacks.toml, railway.json
└── package.json (workspace root)
```

### 2. Inventário de funcionalidades

Pelo menu, 23 funcionalidades. Classificação detalhada na seção 3.

**Identifiquei estes módulos:**

| Categoria | Itens |
|---|---|
| **Vendas** | Dashboard, Leads, Funil Consultores, Funil Associados, Tarefas, Cotações |
| **Comunicação** | WhatsApp, Inbox |
| **Operação** | Associados, Veículos, Sinistros, Vistorias |
| **Crescimento** | Indicações (MGM), Analytics, Tráfego, NPS, Ouvidoria |
| **IA** | IA & Treinamento (squad 11 agentes), Tradutor (não localizado), Cursos (não localizado) |
| **Infraestrutura** | Automações, Webhooks, Projetos (Kanban interno), Equipe & Acessos |
| **Externos (links)** | Email, Ferramentas, Empresas, Drive, Clientes, N8N, Claude Code, Inteligência Artificial |

**Sobre "Tradutor, Tráfego, Email, Cursos, Ferramentas, Inteligência Artificial, Empresas, Drive, Clientes, N8N, Projetos, Claude Code"** — alguns são módulos internos (Projetos = Kanban interno; Analytics = "Tráfego"), outros parecem **atalhos externos no sidebar** (Drive, N8N, Claude Code, Email = links pra apps externos). Confirmar com você.

### 3. Teste funcional (sem execução — análise estática)

> ⚠️ **Não rodei o sistema localmente.** Análise abaixo é estática (leitura de código). Para teste real, preciso de credenciais de dev — ver seção "Perguntas".

| Funcionalidade | Estado provável | Evidência |
|---|---|---|
| Auth (login/refresh) | ✅ Funciona | Reset de senhas confirmado em 2026-05-04, módulo testado |
| Dashboard | ✅ Funciona | `useDashboardStats` cache 5min, sem polling agressivo |
| Associados | ✅ Funciona | CRUD completo, drawer com tabs |
| Veículos | ✅ Funciona | CRUD + vistorias inline |
| Leads | ✅ Funciona | Funil + tarefas integradas |
| Funil Consultores / Associados | ✅ Funciona | Kanban com drag-drop |
| Tarefas | ✅ Funciona | 3 vistas (Hoje/Calendar/Kanban) |
| **WhatsApp / Inbox** | ⚠️ **Funciona com problemas** | **Causa raiz analisada na Parte 1** — delays 10-20s+ |
| Cotações | ✅ Funciona | FIPE + 3 planos + PDF |
| Sinistros | ✅ Funciona | Workflow aberto→encerrado |
| Indicações (MGM) | ✅ Funciona | Gamificação Bronze/Prata/Ouro/Diamante |
| **IA & Treinamento** | ⚠️ **UI ok, ingest 503** | Fase 3 Japão (`a80d1cd`) deixou stubs honestos — botões ingest retornam `AI_INGEST_UNAVAILABLE`. Squad inacessível pelo painel. Dados de agentes no banco |
| Analytics | ✅ Funciona | 8 tabs (Funnel, LTV, ROI, etc.) |
| NPS | ✅ Funciona | Score + pie chart |
| **Automações** | ⚠️ **UI ok, executor faltando** | Schema existe, worker nunca foi implementado |
| Webhooks | ✅ Funciona | CRUD + logs |
| Projects | ✅ Funciona | Kanban interno |
| Equipe & Acessos | ✅ Funciona | Team + roles |
| Ouvidoria | ✅ Funciona | Site público posta aqui |
| **Reengajamento worker** | ⚠️ **Roda mas Redis off** | `startReengajamentoWorker` chamado em `server.ts:278` — Redis desligado, queue neutralizada via `ENABLE_FOLLOWUP_QUEUE != true` ([quote-queue.ts](backend/src/modules/plate-lookup/quote-queue.ts)) |
| Hinova SGA | ❌ **Stub** | Campos `hinovaId` no schema, zero lógica |
| Stripe / Billing | ❌ **Removido** | Commit `dcd221e` removeu completamente |

### 4. Análise de qualidade de código

**Padrões:**
- Consistente: estrutura `service → controller → routes` em todos os módulos.
- Tailwind direto (sem CSS modules) no frontend, conforme CLAUDE.md.
- TanStack Query em hooks dedicados (`useX.ts`).
- Idempotência em pontos críticos (`whatsappMessageId @unique`).

**Erros TypeScript pré-existentes:** ~50 erros `tsc --noEmit` no backend (relatório do Projeto Japão), em módulos NÃO tocados. Não afetam build (`tsup` ignora), mas afetam autocompletar/refactor. Distribuídos em analytics, contacts (removido), leads, nps, ouvidoria, pipes, plate-lookup, webhooks.

**Code smells encontrados:**

1. [inbox.service.ts:72-93](backend/src/modules/inbox/inbox.service.ts#L72-L93) — query sem LIMIT (crítico).
2. [inbox.service.ts:201-275](backend/src/modules/inbox/inbox.service.ts#L201-L275) — `sendMessage` é função de ~75 linhas com múltiplas responsabilidades (validar conv, validar instance, chamar Evolution com auto-heal, gravar, atualizar conv, emitir socket).
3. [webhook-evolution.service.ts:116-332](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L116-L332) — `handleMessageUpsert` faz ~6 queries em série, sem transação. Sob carga (várias mensagens simultâneas), pode causar dirty reads.
4. [inbox.service.ts:215-253](backend/src/modules/inbox/inbox.service.ts#L215-L253) — auto-criação de Card no Kanban dentro do try/catch silencioso. Se falhar, lead fica sem card sem ninguém saber.
5. [App.tsx:9](frontend/src/App.tsx#L9) — `staleTime: 5 min` global é alto pra cache que mistura dados em tempo real e cadastro.

**Comentários:**
- Backend tem comentários úteis sobre **por quê** (ex.: porque não usar AppError 5xx em sendMessage por causa do Traefik). Bom padrão.
- Frontend tem alguns comentários estáveis sobre Projeto Japão.

**Logs e observabilidade:**
- `logger.ts` baseado em Pino.
- Smoke test em [scripts/smoke-realtime.ts](backend/scripts/smoke-realtime.ts) — bom, mas só roda manualmente.
- Sem APM (DataDog, Sentry, OpenTelemetry).
- Sem dashboard de logs centralizados (Easypanel CLI apenas).
- **Sem timestamp instrumentado no fluxo crítico** — não dá pra ver "webhook chegou em T0, banco gravou em T+200ms, socket emitiu em T+250ms, cliente recebeu em T+8s" sem adicionar instrumentação.

### 5. Segurança

**Pontos bons:**
- JWT com `JWT_SECRET` em env, refresh tokens persistidos no DB com TTL.
- Bcrypt no password.
- Webhook Evolution com validação por header (`x-evolution-secret`).
- Cross-tenant guard no socket ([socket.service.ts:151-200](backend/src/websocket/socket.service.ts#L151-L200)) — bloqueia join em rooms de outra company.
- `companyId` filtrado em quase todas as queries.
- Helmet ativo (mas com `contentSecurityPolicy: false`).
- CORS com whitelist ([server.ts:64-87](backend/src/server.ts#L64-L87)).

**Pontos de atenção:**
1. **Tokens vazados em commits antigos** — commit `dcd221e` removeu tokens, mas é importante validar histórico:
   - `DEPLOY_EASYPANEL.md` continha Cloudflare API token (memória diz que precisa girar).
   - Senha Easypanel exposta em mesmo documento (precisa girar).
2. **JWT_SECRET no `backend/.env`** — não está no git (no `.env.example` está placeholder), mas o smoke test [scripts/smoke-realtime.ts:42-46](backend/scripts/smoke-realtime.ts#L42-L46) lê do `.env`, o que sugere que o arquivo existe localmente. Confirmar se não está commitado.
3. **`EVOLUTION_WEBHOOK_SECRET` em modo soft** — se não setado, aceita tudo ([webhook-evolution.routes.ts:38-43](backend/src/modules/webhook-evolution/webhook-evolution.routes.ts#L38-L43)).
4. **Helmet com `contentSecurityPolicy: false`** — sem CSP, vulnerável a XSS se houver alguma renderização não-sanitizada (não vi instâncias gravantes, mas auditoria de páginas individuais não foi feita).
5. **CORS permite Railway preview URLs** (`origin.endsWith('.railway.app')`) — pode ser excesso de generosidade se não usa mais Railway.
6. **Sem CSRF protection** explícito — protegido implicitamente pelo header `Authorization` (JWT), mas se algum endpoint usar cookies, fica exposto.
7. **Rate limit 100 req / 15 min** — bom contra ataques, ruim pra UX (ver causa #5 do delay).
8. **Sem WAF visível** — só Cloudflare DNS (não confirmado se proxy/WAF ativos).
9. **Auth middleware** — não vi o arquivo `middlewares/authenticate.ts` em detalhe, mas tem 1 uso em `realtime.routes.ts:24`.

### 6. Performance

**Achados críticos:**
1. **Queries N+1 potenciais:**
   - `listConversations` faz includes em 4 tabelas — Prisma deveria mergear, mas com 1.661 conversas, a serialização é pesada.
   - `inbox.service.ts:147-167` `getConversationMessages` faz include + findFirst — duas queries separadas.
2. **Sem índices visíveis no schema** para queries críticas:
   - `Conversation.lastMessageAt` (ordenação) — sem `@@index` declarado.
   - `Message.conversationId` — vem do FK, índice automático.
   - `Message.whatsappMessageId` — `@unique` cria índice.
   - **Confirmar via `\d conversation` no Postgres** se tem índice em `lastMessageAt`.
3. **Bundle frontend:** sem análise concluída, mas o `package.json` traz 47 deps. Vale rodar `vite-bundle-analyzer`.
4. **Imagens / mídias:** mensagens carregam `mediaBase64` no banco ([webhook-evolution.service.ts:292](backend/src/modules/webhook-evolution/webhook-evolution.service.ts#L292)) — base64 inflado em ~33% vs binário. Pra mídia grande, esse modelo vai te custar caro no Supabase free (limite de 500MB). **Migração futura: salvar em R2 e referenciar URL.**
5. **Cache HTTP:** sem `Cache-Control` visível nas rotas — recursos cacheáveis (FIPE, planos) deveriam ter.
6. **Redis offline** — Bull queue neutralizada. Nada bloqueante, mas worker de reengajamento e follow-up de cotação não rodam.

### 7. Dependências

**Backend (`backend/package.json`):** ~30 deps, atualizadas. Pontos:
- `bull@4.12.2` — desatualizado vs BullMQ 5.x (Bull em modo legado, mas funcional).
- `puppeteer-core@23.10.4` — version recente.
- `socket.io@4.6.1` — 4.x stable.
- `stripe` removido em `dcd221e`.

**Frontend (`frontend/package.json`):** ~25 deps:
- `react@18.2`, `react-router-dom@6` — OK.
- `socket.io-client@4.8.3` — major bate com server (4.x).
- `@tanstack/react-query@5.20` — atualizado.
- `recharts`, `lucide-react`, `sonner`, `react-hook-form`, `zod` — todos OK.

**Sem `npm audit` rodado** (não executei). Recomendo rodar antes de uma release.

### 8. Infraestrutura e deploy

- **Hospedagem:** Easypanel em DigitalOcean droplet `167.71.31.77`. Painel HTTP (`:3000`) — **inseguro**, deveria estar atrás de VPN/HTTPS.
- **Domínio:** `crm21go.site` + `www.crm21go.site`. DNS na Cloudflare.
- **CI/CD:** sem `.github/workflows/` no repo. Deploy é manual (rebuild via Easypanel UI).
- **Healthchecks:** `/health` (Fastify) + `/api/health/queue` + `/api/webhook/evolution` (GET).
- **Logs centralizados:** não. Só Easypanel UI mostra stdout.
- **Monitoramento / alertas:** nenhum visível.
- **Backup banco:** confiando no Supabase free tier (não confirmado se está com backup ativo).
- **Frontend servido pelo backend:** `fastify-static` serve `frontend/dist` ([server.ts:217-245](backend/src/server.ts#L217-L245)). SPA fallback configurado.

---

## 🎯 PARTE 3 — Lista priorizada de problemas

### 🔴 P0 — Crítico (cliente percebe, bloqueia uso)

| # | Item | Esforço estimado |
|---|---|---|
| P0.1 | **Latência WhatsApp** — combinação de heartbeat de 15s + long-polling + query sem LIMIT + Cloudflare possível. Plano de ataque em camadas: (a) paginar `listConversations` com `take: 50` + cursor, (b) verificar se Cloudflare está em modo proxy e mover pra "DNS only", (c) configurar Traefik para fazer upgrade WS no `/socket.io/`, (d) reduzir heartbeat pra 30s depois de validar socket estável. | Médio-alto |
| P0.2 | **Pipeline síncrono do `sendMessage`** — fazer envio async: gravar Message primeiro (com status `sending`), retornar pro frontend, processar Evolution em background, atualizar status. UX percebe envio instantâneo. | Alto |
| P0.3 | **Webhook Evolution sem header em instâncias antigas** — confirmar via `GET /api/webhook/evolution/stats` se há rejeitados. Se sim, apertar 📡 Wifi pra reconfigurar. | Baixo |
| P0.4 | **Rate limit 100 req / 15 min** — subir pra 500 ou 1000 (ou só 60 req/min sem janela longa) para o IP do usuário não bater teto. | Trivial |

### 🟠 P1 — Alto (afeta produtividade, dor recorrente)

| # | Item |
|---|---|
| P1.1 | Heartbeat de 15s pode ser deixado para o caso de "socket morto" — atual valor mascara o problema real. Subir para 60s **depois** de o socket estar saudável. |
| P1.2 | `WhatsappInstance.evolutionName` — instância da Leticya foi corrigida manualmente para `21gosite` (memória 2026-05-09). Garantir que webhook está apontando para `https://crm21go.site/api/webhook/evolution` com header secret. |
| P1.3 | Squad IA (11 agentes) — funcionalidade vitrine. Ingest retorna 503. Implementar de verdade ou esconder no menu. |
| P1.4 | Automações — UI funciona, executor não. Idem: implementar ou esconder. |
| P1.5 | Redis offline — Bull queue desligada. Decidir: ativar Redis ou trocar por scheduler nativo. |
| P1.6 | Mídias base64 no banco — migrar para R2 antes de estourar quota Supabase free. |

### 🟡 P2 — Médio (saneamento, débito técnico)

| # | Item |
|---|---|
| P2.1 | ~50 erros TS `tsc --noEmit` em backend (analytics, leads, pipes, etc.). Zerar. |
| P2.2 | Hinova SGA/SGC — stub puro. Decisão de produto: integrar ou remover campos. |
| P2.3 | Sem APM (Sentry, DataDog, OpenTelemetry). Adicionar para ver latências reais. |
| P2.4 | CI/CD ausente. Adicionar GitHub Actions com build + tests + deploy. |
| P2.5 | Cobertura de testes ~zero (2 arquivos). Subir cobertura crítica (auth, sendMessage, webhook). |
| P2.6 | Painel Easypanel exposto em HTTP `:3000` — mover atrás de VPN ou bloquear no firewall. |
| P2.7 | Round-robin de atribuição de conversa (memória 2026-05-09). |

### 🟢 P3 — Baixo (cosmético, melhoria futura)

| # | Item |
|---|---|
| P3.1 | Brand guide vs manual oficial divergem (cores). Sincronizar. |
| P3.2 | Comentário em `useInbox.ts` diz 60s mas valor é 15s. Atualizar doc. |
| P3.3 | Hinova SGA com `ComingSoon` no menu — pode confundir vendedor. |
| P3.4 | Backup Supabase — confirmar política. |

---

## ❓ PARTE 4 — Perguntas que preciso que você responda

Para fechar o plano de ação, eu **preciso** dos seguintes esclarecimentos:

### Sobre infraestrutura (Cloudflare/Traefik) — bloqueante pra causa #1

1. **Cloudflare está em modo "Proxied" (laranja) ou "DNS Only" (cinza) para `crm21go.site`?**
   Como ver: painel Cloudflare → DNS → ícone laranja vs cinza ao lado do registro.
2. **Já tentou configurar Traefik para fazer WebSocket upgrade no `/socket.io/`?** Se eu te ajudar com o YAML, você consegue aplicar no Easypanel?
3. **Você tem acesso SSH ao droplet `167.71.31.77`?** Para investigar logs do Traefik diretamente, se a #1 não resolver.
4. **Qual o plano atual do Supabase?** O FREE limita CPU e queries. Considerar upgrade se a query sem LIMIT está estrangulando.

### Sobre WhatsApp / Evolution — para confirmar causa #7

5. **Você consegue rodar agora `curl https://crm21go.site/api/webhook/evolution/stats` (sem auth)?** Os contadores `accepted` e `rejected` vão dizer se webhook está sendo rejeitado por secret.
6. **A Evolution API está hospedada onde?** Mesmo droplet ou outro servidor? Latência entre Evolution e CRM importa.
7. **Você ainda usa a instância `21gosite` (Leticya)?** Se sim, o botão 📡 Wifi (reconfigure-webhook) foi apertado depois do Projeto Japão? Sem isso, o header secret pode não estar plugado.

### Sobre prioridades

8. **Quando o cliente envia uma mensagem, qual é o objetivo de SLA?** <1s? <2s? <5s? Define o quão agressiva fica a otimização.
9. **Mídia no WhatsApp (foto, vídeo, áudio) — qual é a frequência?** Se é alta, P1.6 vira P0.
10. **Quantos vendedores ativos simultâneos no CRM em pico?** Define se rate limit precisa subir mais ou menos.
11. **Você quer manter Redis offline e neutralizar a queue, ou ativar Redis e fazer queue funcionar?** Decisão de infra/custo.

### Sobre teste real do problema

12. **Posso instrumentar temporariamente o backend com `console.time` em pontos do `handleMessageUpsert` + emit do socket, fazer deploy, e mandar uma mensagem real?** Sem isso, o diagnóstico é probabilístico. Com isso, sei exatamente onde estão os ms.
13. **Tem credenciais de dev (DATABASE_URL, JWT_SECRET, EVOLUTION_WEBHOOK_SECRET) que eu posso usar pra rodar localmente apontando pra Supabase de prod ou um clone?** Sem rodar o sistema, todo o teste funcional foi estático.
14. **Posso rodar `npx tsx backend/scripts/smoke-realtime.ts --target=https://crm21go.site` ou você prefere rodar?** Esse script já existe e mede a latência fim-a-fim. Resultado dá o número exato.

---

## 🏁 Recomendação tática (depois do seu OK)

Sequência sugerida de **diagnóstico ativo** (em ordem, antes de qualquer mudança grande):

1. Bater no `/stats` do webhook (item 5 acima) — 30 segundos.
2. Confirmar status do Cloudflare proxy (item 1) — 1 minuto.
3. Rodar o smoke-realtime contra prod (item 14) — 5 minutos.
4. Inspecionar índices reais do Postgres: `\d "Conversation"` no Supabase — 2 minutos.
5. Abrir o CRM em prod, abrir DevTools → Network filtrado por `socket.io`, e mandar uma mensagem real do seu celular pro número da Leticya. Anotar os tempos.

Com esses 5 itens, vamos saber **exatamente** se a causa principal é:
- (a) Cloudflare bufferizando — fix: desproxiar.
- (b) Webhook rejeitado — fix: reconfigurar Evolution.
- (c) Query lenta — fix: paginar.
- (d) Pipeline síncrono do envio — fix: tornar async.

Não há valor em corrigir tudo de uma vez sem medir antes — quebrar mais do que conserta é o risco real.

---

**Aguardando seu OK para entrar em modo de correção.**
