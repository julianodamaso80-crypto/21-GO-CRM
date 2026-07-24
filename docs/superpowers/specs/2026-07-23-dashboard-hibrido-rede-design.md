# Dashboard Híbrido da Rede — Design

data: 2026-07-23
projeto: 21Go CRM
tags: [dashboard, rede, multinivel, placas, unilevel]
tipo: decisão

## Contexto

O Dashboard hoje é alimentado pelo funil interno (cards/leads do Kanban), que está
zerado porque a operação de leads ainda não roda. Os números **reais** da empresa do
consultor já existem no módulo **Minha Rede** (`/api/rede/*`), alimentado por SGA + Power:
placas próprias + do time, boletos pagos, inadimplência, árvore de consultores.

O dono quer que o Dashboard reflita isso de forma inteligente e prática, com um **seletor
de visão**: Minha Rede, Meus Consultores, Meus Associados. Herói = **placas ponderadas**.

## Decisão

Dashboard Híbrido com 3 visões trocáveis (estado na URL `?view=`), alimentado por **um
endpoint agregador novo e aditivo** `GET /api/dashboard/rede`, que reusa as funções puras
já testadas do módulo rede (`calcularPlacar`, `calcularRamos`, `cargaPublicada`,
`resolverRaizDoUsuario`). Não altera `/api/dashboard/stats`, não exige migration.

### Modelo de tempo
Por **ciclo mensal** (contrato/pagamento), não pelo seletor de dias — placa conta por mês
(contrato mês X + boleto pago mês Y). Default = ciclo com mais placas pagas na carga
publicada (robusto quando a carga trocar de mês). Seletor de ciclo entre os disponíveis.

### Backend — `GET /api/dashboard/rede?contrato&pagamento&raiz`
Resolve a raiz (consultor: a própria via `userId`; admin: `?raiz`), lê a carga publicada,
deriva o ciclo, e devolve as 3 visões calculadas:

- **rede**: `Placar` (proprias, equipe, bruto, ponderado, foraDoAlcance, porNivel,
  consultoresProduzindo, valorTotal) + `inadimplentes {qtd, valor}` + `pessoasPorNivel`.
- **consultores**: total (downline), ativos, bloqueados, produzindo, pessoasPorNivel,
  `top[]` (top 10 do time por placas do ramo, exclui a raiz).
- **associados**: placasPagas, receita, ticketMedio, associadosDistintos,
  inadimplentes {qtd, valor}, `recentes[]` (amostra de placas pagas do ciclo).
- **ciclo** {contrato, pagamento, atualizadoEm} + **ciclosDisponiveis[]**.

Retorna `null` (→ 404) quando o usuário não tem rede vinculada ou não há carga publicada.

### Frontend — `DashboardPage`
Ganha o seletor de visão no topo. `useDashboardRede()` (React Query). Quem tem rede
vinculada vê o híbrido; quem recebe 404 cai no dashboard de funil atual (fallback —
nada quebra). Herói ponderado em destaque máximo na visão Rede.

## Limitação assumida
A carga atual cobre **um único ciclo** (mai→jun). Evolução mês-a-mês real fica para depois
(exige coletar histórico no sync). Mostra o ciclo atual com riqueza total.

## Deploy
Aditivo. Build local → push main → build docker via SSH (crm21go.site) → validar 200 +
números (324,5 ponderado) com JWT do Rodrigo.
