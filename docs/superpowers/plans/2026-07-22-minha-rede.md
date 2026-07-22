# Minha Rede — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar ao consultor Rodrigo Souza de Lima, dentro do CRM, a árvore completa da rede dele (764 pessoas) e o controle de pagamento do ciclo (placas pagas e inadimplentes, dele e do time), com o placar do plano unilevel.

**Architecture:** Coleta e leitura são separadas. Coletores somente-leitura falam com Power CRM e SGA Hinova, gravam numa carga em staging identificada por `carga_id`, e só promovem essa carga a publicada quando terminam inteiras. A tela lê exclusivamente as tabelas espelho do Supabase, nunca chama API externa.

**Tech Stack:** Backend TypeScript + Fastify 4.26 + Prisma 5.9 + PostgreSQL (Supabase). Frontend React 18 + Vite + TanStack Query + Zustand + Tailwind. Testes com Vitest (estilo do projeto: funções puras, sem banco).

## Global Constraints

- **Spec de referência:** `docs/superpowers/specs/2026-07-22-minha-rede-crm-rodrigo-design.md`. Toda dúvida de regra de negócio se resolve lá.
- **Multi-tenant:** toda query Prisma filtra por `companyId`. Sem exceção.
- **Somente leitura em Power e SGA.** O único POST permitido no SGA é o de autenticação. Nenhuma escrita, nunca.
- **Migrations aditivas:** SQL idempotente com `IF NOT EXISTS`, no padrão de `backend/prisma/migrations/20260710_add_user_manager/migration.sql`. Nunca `drizzle-kit push`, nunca `prisma migrate` contra produção, nunca seed em produção.
- **Idioma:** todo texto de tela, comentário e mensagem de commit em português com acentuação correta.
- **Commits:** formato `tipo(escopo): descrição` em português.
- **Design system:** tokens de `frontend/tailwind.config.js` e regras de `brand-guide.md`. Azul `#1B4DA1` como identidade, laranja `#E07620` para ação. Reaproveitar as classes utilitárias já existentes (`card`, `input`, `badge-success`, `badge-neutral`, `badge-orange`, `shadow-card`, `shadow-cta-blue`, `border-hairline`, `page-enter`). Não criar sistema visual paralelo.
- **Escala de cor por nível:** reusar `LEVEL_COLORS` de `frontend/src/pages/team/MyTeamView.tsx:23`.
- **Constantes do plano unilevel:** `PAGA_ATE_NIVEL = 6`, `PESO_PROPRIO = 1.0`, `PESO_EQUIPE = 0.5`.
- **Armadilhas da API do SGA (violar = número errado):** `inicio_paginacao` é o NÚMERO DA PÁGINA (0,1,2…), não offset; máximo 500 por página; período de boleto limitado a 31 dias; uma chamada por vez (concorrência satura a API); `data_contrato` do `/listar/veiculo` filtra por dia exato, então varre-se dia a dia; coletar situações 1..8, não só a 1.
- **Casamento Power × SGA sempre por CPF** (`cpf_voluntario` × `registration`), nunca por nome.
- **Credenciais:** `.env` do backend. O Bearer do painel do Power (`POWER_APP_BEARER`) expira em ~10h e é colado à mão. Nunca logar token, senha ou CPF completo.
- **Raiz inicial:** Rodrigo Souza de Lima, `power_id` 100280, CPF `15183736740`, e-mail de login no CRM `rodrigo@gmail.com`.

## Números de verificação (usados nos testes de aceitação)

| Prova | Esperado |
|---|---:|
| Pessoas na base (downline) | 764 |
| Diretos N1 | 25 |
| Distribuição | N1=25, N2=126, N3=245, N4=256, N5=98, N6=12, N7=2 |
| Ativos / bloqueados | 682 / 82 |
| Placas contrato maio + pago junho | 609 |
| Próprias do Rodrigo no ciclo | 40 |
| Ponderado do ciclo | 324,5 |
| Consultores com ≥1 placa | 118 |
| Placas contratadas em junho (base toda) | 3.549 |

---

## File Structure

**Backend — módulo novo `backend/src/modules/rede/`**

| Arquivo | Responsabilidade |
|---|---|
| `rede.types.ts` | Tipos compartilhados do módulo (membro, placa, placar, carga). Sem lógica. |
| `unilevel.ts` | Função pura do plano de remuneração. Não conhece banco nem HTTP. |
| `arvore.ts` | Funções puras de montagem e navegação da árvore (níveis, caminho, trava anti-ciclo). |
| `clients/power.client.ts` | HTTP do painel do Power. Só `userListFilter`. |
| `clients/sga.client.ts` | HTTP do SGA Hinova: autenticação, `/listar/veiculo`, `/listar/boleto-associado/periodo`. |
| `sync/coletor-rede.ts` | Desce a hierarquia por `managerIds` e devolve os membros. |
| `sync/coletor-placas.ts` | Placas contratadas num mês, situações 1..8, dia a dia. |
| `sync/coletor-boletos.ts` | Boletos pagos num período e boletos vencidos em aberto. |
| `sync/sync.service.ts` | Orquestra os três coletores, grava staging, publica atomicamente. |
| `rede.service.ts` | Leitura: árvore, placar, listas de placas. Só banco. |
| `rede.controller.ts` | Handlers HTTP + resolução de escopo (raiz do token vs admin). |
| `rede.routes.ts` | Definição das rotas. |
| `unilevel.test.ts` | Testes da regra de remuneração. |
| `arvore.test.ts` | Testes de montagem da árvore, incluindo ciclo. |
| `sync/coletores.test.ts` | Testes de paginação e varredura (as armadilhas da API). |

**Backend — arquivos existentes a modificar**

| Arquivo | Mudança |
|---|---|
| `backend/prisma/schema.prisma` | 3 models novos |
| `backend/prisma/migrations/20260722_rede_multinivel/migration.sql` | DDL idempotente |
| `backend/src/server.ts:190` | registrar `redeRoutes` com prefixo `/api/rede` |

**Frontend — módulo novo `frontend/src/pages/rede/`** — detalhado na Fase B.

---

# FASE A — Dados e coleta (backend)

## Task 1: Tabelas da rede no banco

**Files:**
- Modify: `backend/prisma/schema.prisma` (fim do arquivo)
- Create: `backend/prisma/migrations/20260722_rede_multinivel/migration.sql`

**Interfaces:**
- Consumes: nada
- Produces: models Prisma `RedeConsultor`, `RedePlaca`, `RedeCarga`, com os nomes de campo usados por todas as tasks seguintes.

- [ ] **Step 1: Adicionar os models ao schema Prisma**

Ao fim de `backend/prisma/schema.prisma`:

```prisma
// ============================================================================
// REDE MULTINIVEL (espelho do Power CRM + SGA). Ver spec:
// docs/superpowers/specs/2026-07-22-minha-rede-crm-rodrigo-design.md
// Os membros da rede NAO sao usuarios do CRM: eles nao logam. So a raiz tem userId.
// ============================================================================

model RedeCarga {
  id           String    @id @default(uuid())
  companyId    String    @map("company_id")
  raizPowerId  Int       @map("raiz_power_id")
  iniciadaEm   DateTime  @default(now()) @map("iniciada_em")
  concluidaEm  DateTime? @map("concluida_em")
  disparadaPor String    @map("disparada_por") // userId do admin
  etapa        String    @default("rede") // rede | placas | boletos | publicando | fim
  status       String    @default("rodando") // rodando | publicada | falhou
  publicada    Boolean   @default(false)
  totais       Json?
  erro         String?

  consultores RedeConsultor[]
  placas      RedePlaca[]

  @@index([companyId, raizPowerId, publicada])
  @@map("rede_cargas")
}

model RedeConsultor {
  id                  String  @id @default(uuid())
  companyId           String  @map("company_id")
  cargaId             String  @map("carga_id")
  carga               RedeCarga @relation(fields: [cargaId], references: [id], onDelete: Cascade)

  powerId             Int     @map("power_id")
  cpf                 String
  nome                String
  nomeTratamento      String  @map("nome_tratamento")
  email               String?
  celular             String?
  funcao              String?
  cooperativa         String?
  codigoVoluntario    String? @map("codigo_voluntario")
  patrocinadorPowerId Int?    @map("patrocinador_power_id")
  nivelRaiz           Int     @map("nivel_raiz") // 0 = a propria raiz
  raizPowerId         Int     @map("raiz_power_id")
  caminho             String  // "Rodrigo Souza de Lima > Marcos Aurelio > Alexandre Duarte Campos"
  status              String  // ativo | bloqueado
  userId              String? @map("user_id")

  @@index([cargaId, nivelRaiz])
  @@index([cargaId, cpf])
  @@index([companyId, raizPowerId])
  @@map("rede_consultores")
}

model RedePlaca {
  id                String    @id @default(uuid())
  companyId         String    @map("company_id")
  cargaId           String    @map("carga_id")
  carga             RedeCarga @relation(fields: [cargaId], references: [id], onDelete: Cascade)

  cpfConsultor      String    @map("cpf_consultor")
  codigoVeiculo     String    @map("codigo_veiculo")
  placa             String
  associado         String
  telefoneAssociado String?   @map("telefone_associado")
  dataContrato      String    @map("data_contrato")   // YYYY-MM-DD
  mesContrato       String    @map("mes_contrato")    // YYYY-MM
  dataPagamento     String?   @map("data_pagamento")
  mesPagamento      String?   @map("mes_pagamento")
  dataVencimento    String?   @map("data_vencimento")
  diasAtraso        Int?      @map("dias_atraso")
  valor             Decimal?  @db.Decimal(12, 2)
  situacaoVeiculo   String?   @map("situacao_veiculo")
  situacaoBoleto    String?   @map("situacao_boleto")
  status            String    // paga | inadimplente

  @@index([cargaId, cpfConsultor])
  @@index([cargaId, mesContrato, mesPagamento])
  @@index([cargaId, status])
  @@map("rede_placas")
}
```

- [ ] **Step 2: Escrever a migration idempotente**

Criar `backend/prisma/migrations/20260722_rede_multinivel/migration.sql`:

```sql
-- Rede multinivel: espelho do Power CRM (pessoas) + SGA (placas do ciclo).
-- Aditiva e idempotente: pode rodar mais de uma vez, inclusive no SQL Editor do Supabase.

CREATE TABLE IF NOT EXISTS "rede_cargas" (
  "id"            text PRIMARY KEY,
  "company_id"    text NOT NULL,
  "raiz_power_id" integer NOT NULL,
  "iniciada_em"   timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluida_em"  timestamp(3),
  "disparada_por" text NOT NULL,
  "etapa"         text NOT NULL DEFAULT 'rede',
  "status"        text NOT NULL DEFAULT 'rodando',
  "publicada"     boolean NOT NULL DEFAULT false,
  "totais"        jsonb,
  "erro"          text
);
CREATE INDEX IF NOT EXISTS "rede_cargas_company_raiz_pub_idx"
  ON "rede_cargas"("company_id", "raiz_power_id", "publicada");

CREATE TABLE IF NOT EXISTS "rede_consultores" (
  "id"                    text PRIMARY KEY,
  "company_id"            text NOT NULL,
  "carga_id"              text NOT NULL REFERENCES "rede_cargas"("id") ON DELETE CASCADE,
  "power_id"              integer NOT NULL,
  "cpf"                   text NOT NULL,
  "nome"                  text NOT NULL,
  "nome_tratamento"       text NOT NULL,
  "email"                 text,
  "celular"               text,
  "funcao"                text,
  "cooperativa"           text,
  "codigo_voluntario"     text,
  "patrocinador_power_id" integer,
  "nivel_raiz"            integer NOT NULL,
  "raiz_power_id"         integer NOT NULL,
  "caminho"               text NOT NULL,
  "status"                text NOT NULL,
  "user_id"               text
);
CREATE INDEX IF NOT EXISTS "rede_consultores_carga_nivel_idx" ON "rede_consultores"("carga_id", "nivel_raiz");
CREATE INDEX IF NOT EXISTS "rede_consultores_carga_cpf_idx"   ON "rede_consultores"("carga_id", "cpf");
CREATE INDEX IF NOT EXISTS "rede_consultores_company_raiz_idx" ON "rede_consultores"("company_id", "raiz_power_id");

CREATE TABLE IF NOT EXISTS "rede_placas" (
  "id"                 text PRIMARY KEY,
  "company_id"         text NOT NULL,
  "carga_id"           text NOT NULL REFERENCES "rede_cargas"("id") ON DELETE CASCADE,
  "cpf_consultor"      text NOT NULL,
  "codigo_veiculo"     text NOT NULL,
  "placa"              text NOT NULL,
  "associado"          text NOT NULL,
  "telefone_associado" text,
  "data_contrato"      text NOT NULL,
  "mes_contrato"       text NOT NULL,
  "data_pagamento"     text,
  "mes_pagamento"      text,
  "data_vencimento"    text,
  "dias_atraso"        integer,
  "valor"              decimal(12,2),
  "situacao_veiculo"   text,
  "situacao_boleto"    text,
  "status"             text NOT NULL
);
CREATE INDEX IF NOT EXISTS "rede_placas_carga_cpf_idx"    ON "rede_placas"("carga_id", "cpf_consultor");
CREATE INDEX IF NOT EXISTS "rede_placas_carga_ciclo_idx"  ON "rede_placas"("carga_id", "mes_contrato", "mes_pagamento");
CREATE INDEX IF NOT EXISTS "rede_placas_carga_status_idx" ON "rede_placas"("carga_id", "status");
```

- [ ] **Step 3: Gerar o client e conferir que o schema compila**

Run: `cd backend && npx prisma generate && npm run type-check`
Expected: `Generated Prisma Client` e o type-check sem erro.

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20260722_rede_multinivel/migration.sql
git commit -m "feat(rede): tabelas espelho de consultores, placas e cargas"
```

---

## Task 2: Regra do plano unilevel (função pura)

**Files:**
- Create: `backend/src/modules/rede/rede.types.ts`
- Create: `backend/src/modules/rede/unilevel.ts`
- Test: `backend/src/modules/rede/unilevel.test.ts`

**Interfaces:**
- Consumes: nada
- Produces: `calcularPlacar(placas: PlacaContada[], niveisPorCpf: Map<string, number>): Placar` e as constantes `PAGA_ATE_NIVEL`, `PESO_PROPRIO`, `PESO_EQUIPE`. O tipo `Placar` é consumido por `rede.service.ts` (Task 8) e pelo frontend (Fase B).

- [ ] **Step 1: Escrever os tipos**

Criar `backend/src/modules/rede/rede.types.ts`:

```ts
/** Tipos do modulo Minha Rede. Ver spec 2026-07-22-minha-rede-crm-rodrigo-design.md */

/** Uma pessoa da rede, ja com o nivel relativo a raiz (0 = a propria raiz). */
export interface MembroRede {
  powerId: number
  cpf: string
  nome: string
  nomeTratamento: string
  email: string | null
  celular: string | null
  funcao: string | null
  cooperativa: string | null
  patrocinadorPowerId: number | null
  nivelRaiz: number
  caminho: string
  status: 'ativo' | 'bloqueado'
}

/** Uma placa ja atribuida a um consultor e com o desfecho de pagamento resolvido. */
export interface PlacaContada {
  cpfConsultor: string
  codigoVeiculo: string
  placa: string
  associado: string
  telefoneAssociado: string | null
  dataContrato: string
  mesContrato: string
  dataPagamento: string | null
  mesPagamento: string | null
  dataVencimento: string | null
  diasAtraso: number | null
  valor: number | null
  situacaoVeiculo: string | null
  situacaoBoleto: string | null
  status: 'paga' | 'inadimplente'
}

/** O placar do ciclo, ja com a regra unilevel aplicada. */
export interface Placar {
  proprias: number
  equipe: number
  bruto: number
  ponderado: number
  foraDoAlcance: number
  porNivel: Record<number, number>
  consultoresProduzindo: number
  valorTotal: number
}
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `backend/src/modules/rede/unilevel.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularPlacar, PAGA_ATE_NIVEL, PESO_PROPRIO, PESO_EQUIPE } from './unilevel'
import type { PlacaContada } from './rede.types'

const placa = (cpf: string, status: 'paga' | 'inadimplente' = 'paga', valor = 100): PlacaContada => ({
  cpfConsultor: cpf, codigoVeiculo: `v-${cpf}-${Math.random()}`, placa: 'AAA0A00',
  associado: 'Fulano', telefoneAssociado: null, dataContrato: '2026-05-10', mesContrato: '2026-05',
  dataPagamento: status === 'paga' ? '2026-06-05' : null, mesPagamento: status === 'paga' ? '2026-06' : null,
  dataVencimento: '2026-06-01', diasAtraso: status === 'paga' ? null : 30, valor,
  situacaoVeiculo: 'ATIVO', situacaoBoleto: null, status,
})

describe('calcularPlacar — plano unilevel da 21Go', () => {
  it('constantes do plano: paga ate o nivel 6, propria vale 1, equipe vale 0,5', () => {
    expect(PAGA_ATE_NIVEL).toBe(6)
    expect(PESO_PROPRIO).toBe(1.0)
    expect(PESO_EQUIPE).toBe(0.5)
  })

  it('venda propria vale 1 placa e venda de equipe vale 0,5', () => {
    const niveis = new Map([['raiz', 0], ['membro', 1]])
    const r = calcularPlacar([placa('raiz'), placa('membro'), placa('membro')], niveis)
    expect(r.proprias).toBe(1)
    expect(r.equipe).toBe(2)
    expect(r.bruto).toBe(3)
    expect(r.ponderado).toBe(2) // 1*1,0 + 2*0,5
  })

  it('ignora placa inadimplente no placar — so conta o que foi pago', () => {
    const niveis = new Map([['raiz', 0]])
    const r = calcularPlacar([placa('raiz'), placa('raiz', 'inadimplente')], niveis)
    expect(r.proprias).toBe(1)
    expect(r.bruto).toBe(1)
  })

  it('placa de N7 nao entra no bruto nem no ponderado, e e contada a parte', () => {
    const niveis = new Map([['raiz', 0], ['fundo', 7]])
    const r = calcularPlacar([placa('raiz'), placa('fundo')], niveis)
    expect(r.bruto).toBe(1)
    expect(r.ponderado).toBe(1)
    expect(r.foraDoAlcance).toBe(1)
  })

  it('descarta placa de quem nao esta na rede', () => {
    const niveis = new Map([['raiz', 0]])
    const r = calcularPlacar([placa('raiz'), placa('estranho')], niveis)
    expect(r.bruto).toBe(1)
    expect(r.consultoresProduzindo).toBe(1)
  })

  it('agrupa por nivel e soma o valor pago', () => {
    const niveis = new Map([['raiz', 0], ['a', 1], ['b', 2]])
    const r = calcularPlacar([placa('raiz', 'paga', 10), placa('a', 'paga', 20), placa('b', 'paga', 30)], niveis)
    expect(r.porNivel).toEqual({ 1: 1, 2: 1 })
    expect(r.valorTotal).toBe(60)
    expect(r.consultoresProduzindo).toBe(3)
  })

  it('reproduz o ciclo conferido do Rodrigo: 40 proprias + 569 de equipe = 609 brutas, 324,5 ponderadas', () => {
    const niveis = new Map<string, number>([['rodrigo', 0]])
    const placas: PlacaContada[] = []
    for (let i = 0; i < 40; i++) placas.push(placa('rodrigo'))
    for (let i = 0; i < 569; i++) {
      const cpf = `membro-${i % 117}`
      niveis.set(cpf, (i % 6) + 1)
      placas.push(placa(cpf))
    }
    const r = calcularPlacar(placas, niveis)
    expect(r.proprias).toBe(40)
    expect(r.equipe).toBe(569)
    expect(r.bruto).toBe(609)
    expect(r.ponderado).toBe(324.5)
  })
})
```

- [ ] **Step 3: Rodar o teste e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/rede/unilevel.test.ts`
Expected: FAIL — `Failed to resolve import "./unilevel"`.

- [ ] **Step 4: Implementar**

Criar `backend/src/modules/rede/unilevel.ts`:

```ts
import type { PlacaContada, Placar } from './rede.types'

/** Plano unilevel da 21Go: paga do nivel 1 ao 6. Do 7 em diante nao ha ganho. */
export const PAGA_ATE_NIVEL = 6
export const PESO_PROPRIO = 1.0
export const PESO_EQUIPE = 0.5

/**
 * Aplica a regra de remuneracao sobre as placas do ciclo.
 *
 * So placa paga entra no placar: contratou e nao pagou nao conta (e vira inadimplencia,
 * tratada em outra lista). Placa de quem esta abaixo do N6 fica fora do bruto e do
 * ponderado, mas e devolvida em `foraDoAlcance` pra tela poder mostrar que existe.
 *
 * `niveisPorCpf` mapeia CPF -> nivel relativo a raiz, onde 0 e a propria raiz.
 */
export function calcularPlacar(placas: PlacaContada[], niveisPorCpf: Map<string, number>): Placar {
  let proprias = 0
  let equipe = 0
  let foraDoAlcance = 0
  let valorTotal = 0
  const porNivel: Record<number, number> = {}
  const produzindo = new Set<string>()

  for (const p of placas) {
    if (p.status !== 'paga') continue

    const nivel = niveisPorCpf.get(p.cpfConsultor)
    if (nivel === undefined) continue // nao e da rede desta raiz

    if (nivel > PAGA_ATE_NIVEL) {
      foraDoAlcance++
      continue
    }

    if (nivel === 0) {
      proprias++
    } else {
      equipe++
      porNivel[nivel] = (porNivel[nivel] || 0) + 1
    }

    produzindo.add(p.cpfConsultor)
    valorTotal += p.valor ?? 0
  }

  return {
    proprias,
    equipe,
    bruto: proprias + equipe,
    ponderado: proprias * PESO_PROPRIO + equipe * PESO_EQUIPE,
    foraDoAlcance,
    porNivel,
    consultoresProduzindo: produzindo.size,
    valorTotal,
  }
}
```

- [ ] **Step 5: Rodar o teste e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/rede/unilevel.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/rede/rede.types.ts backend/src/modules/rede/unilevel.ts backend/src/modules/rede/unilevel.test.ts
git commit -m "feat(rede): regra do plano unilevel como funcao pura testada"
```

---

## Task 3: Montagem da árvore (função pura)

**Files:**
- Create: `backend/src/modules/rede/arvore.ts`
- Test: `backend/src/modules/rede/arvore.test.ts`

**Interfaces:**
- Consumes: `MembroRede` de `rede.types.ts` (Task 2)
- Produces: `montarArvore(raiz: NoRaiz, diretosDe: DiretosDe): Promise<MembroRede[]>` e `contarPorNivel(membros: MembroRede[]): Record<number, number>`. `DiretosDe` é `(powerId: number) => Promise<UsuarioPower[]>`, o que permite testar sem HTTP e é implementado pelo coletor da Task 5.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/modules/rede/arvore.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { montarArvore, contarPorNivel, type UsuarioPower } from './arvore'

const u = (id: number, nome: string, cpf = String(id).padStart(11, '0')): UsuarioPower => ({
  id, name: nome, fullName: nome, registration: cpf, email: `${id}@x.com`,
  companyUserMobile: '', officeString: 'Consultor', cooperativeString: 'Regional',
  active: true, responsibleUser: '',
})

describe('montarArvore', () => {
  it('desce nivel a nivel e marca o nivel relativo a raiz', async () => {
    const filhos: Record<number, UsuarioPower[]> = {
      1: [u(2, 'Leticia')],
      2: [u(3, 'Marcelo')],
      3: [u(4, 'Joao')],
    }
    const membros = await montarArvore(
      { powerId: 1, nome: 'Juliano' },
      async (id) => filhos[id] ?? [],
    )
    expect(membros.map((m) => [m.nome, m.nivelRaiz])).toEqual([
      ['Leticia', 1], ['Marcelo', 2], ['Joao', 3],
    ])
  })

  it('guarda o caminho completo da linha, pra tela mostrar quem chamou quem', async () => {
    const filhos: Record<number, UsuarioPower[]> = { 1: [u(2, 'Leticia')], 2: [u(3, 'Marcelo')] }
    const membros = await montarArvore({ powerId: 1, nome: 'Juliano' }, async (id) => filhos[id] ?? [])
    expect(membros[1].caminho).toBe('Juliano > Leticia > Marcelo')
    expect(membros[1].patrocinadorPowerId).toBe(2)
  })

  it('nao entra em loop quando o cadastro tem ciclo (A gerente de B e B de A)', async () => {
    const filhos: Record<number, UsuarioPower[]> = { 1: [u(2, 'B')], 2: [u(1, 'A')] }
    const membros = await montarArvore({ powerId: 1, nome: 'A' }, async (id) => filhos[id] ?? [])
    expect(membros).toHaveLength(1)
    expect(membros[0].nome).toBe('B')
  })

  it('nao duplica quem aparece em dois ramos', async () => {
    const filhos: Record<number, UsuarioPower[]> = {
      1: [u(2, 'B'), u(3, 'C')],
      2: [u(4, 'D')],
      3: [u(4, 'D')],
    }
    const membros = await montarArvore({ powerId: 1, nome: 'A' }, async (id) => filhos[id] ?? [])
    expect(membros.filter((m) => m.powerId === 4)).toHaveLength(1)
  })

  it('normaliza CPF e status a partir do registro do Power', async () => {
    const bloqueado = { ...u(2, 'B', '151.837.367-40'), active: false }
    const membros = await montarArvore({ powerId: 1, nome: 'A' }, async (id) => (id === 1 ? [bloqueado] : []))
    expect(membros[0].cpf).toBe('15183736740')
    expect(membros[0].status).toBe('bloqueado')
  })

  it('contarPorNivel devolve a distribuicao', () => {
    const membros = [{ nivelRaiz: 1 }, { nivelRaiz: 1 }, { nivelRaiz: 2 }] as any
    expect(contarPorNivel(membros)).toEqual({ 1: 2, 2: 1 })
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/rede/arvore.test.ts`
Expected: FAIL — `Failed to resolve import "./arvore"`.

- [ ] **Step 3: Implementar**

Criar `backend/src/modules/rede/arvore.ts`:

```ts
import type { MembroRede } from './rede.types'

/** Registro cru de usuario como o painel do Power devolve em /company/userListFilter. */
export interface UsuarioPower {
  id: number
  name: string
  fullName: string
  registration: string
  email: string
  companyUserMobile: string
  officeString: string
  cooperativeString: string
  active: boolean
  responsibleUser: string
}

export interface NoRaiz {
  powerId: number
  nome: string
}

export type DiretosDe = (powerId: number) => Promise<UsuarioPower[]>

const soDigitos = (s: string) => String(s || '').replace(/\D/g, '')

/**
 * Desce a hierarquia do Power em largura, a partir da raiz, ate acabar.
 *
 * O vinculo e o campo "Gerente" do Power (`responsibleUser`, filtrado por `managerIds`),
 * que na 21Go significa "quem chamou". Quem chamou quem e a propria rede de comissionamento.
 *
 * Inclui bloqueados de proposito: quem esta bloqueado hoje vendeu placa no mes apurado.
 *
 * A trava de visitados protege contra ciclo de cadastro (A gerente de B e B gerente de A),
 * que sem ela roda pra sempre.
 */
export async function montarArvore(raiz: NoRaiz, diretosDe: DiretosDe): Promise<MembroRede[]> {
  const visitados = new Set<number>([raiz.powerId])
  const membros: MembroRede[] = []
  let fila: Array<{ powerId: number; nome: string; nivel: number; caminho: string }> = [
    { powerId: raiz.powerId, nome: raiz.nome, nivel: 0, caminho: raiz.nome },
  ]

  while (fila.length) {
    const proxima: typeof fila = []
    for (const pai of fila) {
      const diretos = await diretosDe(pai.powerId)
      for (const d of diretos) {
        const id = Number(d.id)
        if (visitados.has(id)) continue
        visitados.add(id)

        const nome = d.fullName || d.name
        const caminho = `${pai.caminho} > ${nome}`
        membros.push({
          powerId: id,
          cpf: soDigitos(d.registration),
          nome,
          nomeTratamento: d.name,
          email: d.email || null,
          celular: d.companyUserMobile || null,
          funcao: d.officeString || null,
          cooperativa: d.cooperativeString || null,
          patrocinadorPowerId: pai.powerId,
          nivelRaiz: pai.nivel + 1,
          caminho,
          status: d.active ? 'ativo' : 'bloqueado',
        })
        proxima.push({ powerId: id, nome, nivel: pai.nivel + 1, caminho })
      }
    }
    fila = proxima
  }

  return membros
}

export function contarPorNivel(membros: Pick<MembroRede, 'nivelRaiz'>[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const m of membros) out[m.nivelRaiz] = (out[m.nivelRaiz] || 0) + 1
  return out
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/rede/arvore.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/rede/arvore.ts backend/src/modules/rede/arvore.test.ts
git commit -m "feat(rede): montagem da arvore multinivel com trava anti-ciclo"
```

---

## Task 4: Clientes HTTP do Power e do SGA

**Files:**
- Create: `backend/src/modules/rede/clients/power.client.ts`
- Create: `backend/src/modules/rede/clients/sga.client.ts`
- Modify: `backend/.env.example` (adicionar as variáveis)

**Interfaces:**
- Consumes: `UsuarioPower` de `arvore.ts` (Task 3)
- Produces:
  - `listarUsuariosPagina(page: number, size: number, filtro: FiltroPower): Promise<{ content: UsuarioPower[]; totalElements: number; totalPages: number }>`
  - `autenticarSga(): Promise<string>` (devolve o token)
  - `postSga<T>(path: string, body: unknown, token: string): Promise<T>`
  - `TokenExpiradoError` — classe de erro que o job da Task 7 usa para parar sem publicar.

- [ ] **Step 1: Escrever o cliente do Power**

Criar `backend/src/modules/rede/clients/power.client.ts`:

```ts
import type { UsuarioPower } from '../arvore'

/**
 * Painel interno do Power CRM. SOMENTE LEITURA.
 * O Bearer e o token de sessao do app.powercrm.com.br e EXPIRA em ~10h — quando expira,
 * o job para e pede token novo. Nunca logar o token.
 */

const BASE = (process.env.POWER_APP_BASE_URL || 'https://app.powercrm.com.br').replace(/\/+$/, '')

/** Erro que sinaliza "credencial vencida": o job para e nao publica carga pela metade. */
export class TokenExpiradoError extends Error {
  constructor(public readonly origem: 'power' | 'sga', status: number) {
    super(`Token do ${origem} expirado ou invalido (HTTP ${status}). Renove a credencial e rode de novo.`)
    this.name = 'TokenExpiradoError'
  }
}

export interface FiltroPower {
  managerIds?: number[]
  name?: string
  limitToBranches: unknown[]
  status: number
  office: number
  filterUser: boolean
  functions: null
  groupPermission: unknown[]
  cooperativeIds: unknown[]
  sortBy: null
  sortDirection: null
}

/** status: 0 = todos (ativos + bloqueados). Bloqueado entra na rede de proposito. */
export const FILTRO_BASE: FiltroPower = {
  limitToBranches: [], status: 0, office: 0, filterUser: true,
  functions: null, groupPermission: [], cooperativeIds: [],
  sortBy: null, sortDirection: null,
}

export interface PaginaPower {
  content: UsuarioPower[]
  totalElements: number
  totalPages: number
}

export async function listarUsuariosPagina(page: number, size: number, filtro: Partial<FiltroPower>): Promise<PaginaPower> {
  const bearer = process.env.POWER_APP_BEARER
  if (!bearer) throw new TokenExpiradoError('power', 0)

  const resp = await fetch(`${BASE}/company/userListFilter?page=${page}&size=${size}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${bearer}`,
      'content-type': 'application/json',
      'x-requested-with': 'XMLHttpRequest',
    },
    body: JSON.stringify({ ...FILTRO_BASE, ...filtro }),
  })

  if (resp.status === 401 || resp.status === 403) throw new TokenExpiradoError('power', resp.status)

  const txt = await resp.text()
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em userListFilter: ${txt.slice(0, 200)}`)
  return JSON.parse(txt) as PaginaPower
}
```

- [ ] **Step 2: Escrever o cliente do SGA**

Criar `backend/src/modules/rede/clients/sga.client.ts`:

```ts
import { TokenExpiradoError } from './power.client'

/**
 * SGA Hinova v2. SOMENTE LEITURA — o unico POST de escrita permitido e a autenticacao.
 * Nunca logar token, senha ou CPF completo.
 */

const BASE = (process.env.HINOVA_SGA_BASE_URL || 'https://api.hinova.com.br/api/sga/v2').replace(/\/+$/, '')

export async function autenticarSga(): Promise<string> {
  const resp = await fetch(`${BASE}/usuario/autenticar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      usuario: process.env.HINOVA_SGA_USUARIO,
      senha: process.env.HINOVA_SGA_SENHA,
      token: process.env.HINOVA_SGA_TOKEN,
    }),
  })
  if (!resp.ok) throw new TokenExpiradoError('sga', resp.status)
  const data = (await resp.json()) as { token?: string }
  if (!data.token) throw new TokenExpiradoError('sga', resp.status)
  return data.token
}

export async function postSga<T>(path: string, body: unknown, token: string): Promise<T> {
  const resp = await fetch(`${BASE}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  if (resp.status === 401) throw new TokenExpiradoError('sga', 401)
  const txt = await resp.text()
  if (!resp.ok) throw new Error(`HTTP ${resp.status} em ${path}: ${txt.slice(0, 200)}`)
  return JSON.parse(txt) as T
}
```

- [ ] **Step 3: Documentar as variáveis de ambiente**

Adicionar ao fim de `backend/.env.example`:

```
# --- Rede multinivel (somente leitura) ---
# Painel do Power CRM. O Bearer e o token de sessao do app.powercrm.com.br e expira em ~10h.
POWER_APP_BASE_URL=https://app.powercrm.com.br
POWER_APP_BEARER=
# SGA Hinova v2
HINOVA_SGA_BASE_URL=https://api.hinova.com.br/api/sga/v2
HINOVA_SGA_USUARIO=
HINOVA_SGA_SENHA=
HINOVA_SGA_TOKEN=
```

- [ ] **Step 4: Verificar que compila**

Run: `cd backend && npm run type-check`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/rede/clients backend/.env.example
git commit -m "feat(rede): clientes somente-leitura do Power CRM e do SGA"
```

---

## Task 5: Coletor da rede

**Files:**
- Create: `backend/src/modules/rede/sync/coletor-rede.ts`
- Test: `backend/src/modules/rede/sync/coletores.test.ts`

**Interfaces:**
- Consumes: `listarUsuariosPagina` (Task 4), `montarArvore` (Task 3)
- Produces: `coletarRede(raiz: NoRaiz): Promise<MembroRede[]>` e `diretosDePaginado(id, listar): Promise<UsuarioPower[]>` (exportada para teste).

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/modules/rede/sync/coletores.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { diretosDePaginado } from './coletor-rede'
import type { UsuarioPower } from '../arvore'

const fake = (id: number): UsuarioPower => ({
  id, name: `n${id}`, fullName: `n${id}`, registration: '00000000000', email: '',
  companyUserMobile: '', officeString: '', cooperativeString: '', active: true, responsibleUser: '',
})

describe('diretosDePaginado', () => {
  it('junta todas as paginas ate totalPages', async () => {
    const paginas = [
      { content: [fake(1), fake(2)], totalElements: 3, totalPages: 2 },
      { content: [fake(3)], totalElements: 3, totalPages: 2 },
    ]
    const chamadas: number[] = []
    const r = await diretosDePaginado(99, async (page) => { chamadas.push(page); return paginas[page] })
    expect(r.map((x) => x.id)).toEqual([1, 2, 3])
    expect(chamadas).toEqual([0, 1])
  })

  it('para quando a pagina volta vazia, mesmo que totalPages minta', async () => {
    const r = await diretosDePaginado(99, async (page) =>
      page === 0 ? { content: [fake(1)], totalElements: 99, totalPages: 50 } : { content: [], totalElements: 99, totalPages: 50 })
    expect(r).toHaveLength(1)
  })

  it('devolve vazio quando a pessoa nao tem ninguem abaixo', async () => {
    const r = await diretosDePaginado(99, async () => ({ content: [], totalElements: 0, totalPages: 0 }))
    expect(r).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/rede/sync/coletores.test.ts`
Expected: FAIL — `Failed to resolve import "./coletor-rede"`.

- [ ] **Step 3: Implementar**

Criar `backend/src/modules/rede/sync/coletor-rede.ts`:

```ts
import { listarUsuariosPagina, type PaginaPower } from '../clients/power.client'
import { montarArvore, type NoRaiz, type UsuarioPower } from '../arvore'
import type { MembroRede } from '../rede.types'

const POR_PAGINA = 200
const MAX_PAGINAS = 50 // trava de seguranca: ninguem tem 10.000 diretos

type BuscarPagina = (page: number) => Promise<PaginaPower>

/**
 * Diretos de um gerente, juntando as paginas.
 * Para tanto por `totalPages` quanto por pagina vazia — a API ja mentiu no totalPages antes.
 */
export async function diretosDePaginado(powerId: number, buscar: BuscarPagina): Promise<UsuarioPower[]> {
  const todos: UsuarioPower[] = []
  let page = 0
  let totalPages = 1
  do {
    const r = await buscar(page)
    const lote = r?.content ?? []
    if (!lote.length) break
    todos.push(...lote)
    totalPages = Number(r?.totalPages ?? 1)
    page++
  } while (page < totalPages && page < MAX_PAGINAS)
  return todos
}

/** Monta a rede inteira da raiz. Uma chamada por vez: concorrencia satura o Power. */
export async function coletarRede(raiz: NoRaiz): Promise<MembroRede[]> {
  return montarArvore(raiz, (powerId) =>
    diretosDePaginado(powerId, (page) => listarUsuariosPagina(page, POR_PAGINA, { managerIds: [powerId] })),
  )
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/rede/sync/coletores.test.ts`
Expected: PASS — 3 testes.

- [ ] **Step 5: Commit**

```bash
git add backend/src/modules/rede/sync/coletor-rede.ts backend/src/modules/rede/sync/coletores.test.ts
git commit -m "feat(rede): coletor da rede por managerIds, paginado"
```

---

## Task 6: Coletores de placas e de boletos

**Files:**
- Create: `backend/src/modules/rede/sync/coletor-placas.ts`
- Create: `backend/src/modules/rede/sync/coletor-boletos.ts`
- Modify: `backend/src/modules/rede/sync/coletores.test.ts` (acrescentar describes)

**Interfaces:**
- Consumes: `postSga`, `autenticarSga` (Task 4)
- Produces:
  - `diasDoMes(mes: string): string[]` — dias no formato `DD/MM/AAAA`
  - `coletarPlacasDoMes(mes: string, token: string): Promise<VeiculoSga[]>`
  - `coletarBoletosPagos(mes: string, token: string): Promise<Map<string, { dataPagamento: string; valor: number }>>`
  - `coletarBoletosVencidos(ateData: string, token: string): Promise<Map<string, BoletoAberto>>`

- [ ] **Step 1: Acrescentar os testes que falham**

Acrescentar ao fim de `backend/src/modules/rede/sync/coletores.test.ts`:

```ts
import { diasDoMes, paginarSga } from './coletor-placas'

describe('diasDoMes', () => {
  it('varre o mes dia a dia no formato do SGA, porque data_contrato filtra por dia exato', () => {
    const d = diasDoMes('2026-06')
    expect(d).toHaveLength(30)
    expect(d[0]).toBe('01/06/2026')
    expect(d[29]).toBe('30/06/2026')
  })

  it('respeita fevereiro', () => {
    expect(diasDoMes('2026-02')).toHaveLength(28)
  })
})

describe('paginarSga', () => {
  it('inicio_paginacao e o NUMERO DA PAGINA, nao o offset', async () => {
    const recebidos: number[] = []
    await paginarSga(async (pagina) => {
      recebidos.push(pagina)
      return pagina === 0 ? new Array(500).fill({ x: 1 }) : []
    })
    expect(recebidos).toEqual([0, 1]) // 0 e 1, nunca 0 e 500
  })

  it('para na primeira pagina incompleta', async () => {
    const recebidos: number[] = []
    const r = await paginarSga(async (pagina) => {
      recebidos.push(pagina)
      return pagina === 0 ? new Array(500).fill({ x: 1 }) : new Array(3).fill({ x: 2 })
    })
    expect(recebidos).toEqual([0, 1])
    expect(r).toHaveLength(503)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/rede/sync/coletores.test.ts`
Expected: FAIL — `Failed to resolve import "./coletor-placas"`.

- [ ] **Step 3: Implementar o coletor de placas**

Criar `backend/src/modules/rede/sync/coletor-placas.ts`:

```ts
import { postSga } from '../clients/sga.client'

/** Todas as situacoes: placa vendida em maio pode estar cancelada hoje e ainda foi venda de maio. */
export const SITUACOES = [1, 2, 3, 4, 5, 6, 7, 8]
export const POR_PAGINA = 500 // com 3000 a resposta estoura a memoria

export interface VeiculoSga {
  codigo_veiculo: string | number
  placa: string
  modelo?: string
  nome_associado: string
  telefone_associado?: string
  celular_associado?: string
  data_contrato: string
  descricao_situacao?: string
  codigo_voluntario?: string | number
  nome_voluntario?: string
  cpf_voluntario?: string
}

/** Dias do mes no formato DD/MM/AAAA. `mes` vem como YYYY-MM. */
export function diasDoMes(mes: string): string[] {
  const [ano, m] = mes.split('-').map(Number)
  const total = new Date(ano, m, 0).getDate()
  return Array.from({ length: total }, (_, i) =>
    `${String(i + 1).padStart(2, '0')}/${String(m).padStart(2, '0')}/${ano}`)
}

/**
 * Pagina uma listagem do SGA.
 * ARMADILHA: `inicio_paginacao` e o NUMERO DA PAGINA (0,1,2...), nao o offset.
 * Passar `pagina * 500` devolve 406 ou nada.
 */
export async function paginarSga<T>(buscarPagina: (pagina: number) => Promise<T[]>): Promise<T[]> {
  const todos: T[] = []
  let pagina = 0
  for (;;) {
    const lote = await buscarPagina(pagina)
    todos.push(...lote)
    if (lote.length < POR_PAGINA) break
    pagina++
  }
  return todos
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Placas CONTRATADAS no mes, todas as situacoes.
 * A data que vale e a do VEICULO: um associado de 2024 que poe placa nova em maio conta
 * como venda de maio. Usar a data do associado erra ~26%.
 * Varre dia a dia porque `data_contrato` filtra por dia exato — mais barato que paginar a base.
 * Uma chamada por vez: concorrencia satura a API e comeca a falhar.
 */
export async function coletarPlacasDoMes(
  mes: string,
  token: string,
  onProgresso?: (feitos: number, total: number) => void,
): Promise<VeiculoSga[]> {
  const dias = diasDoMes(mes)
  const total = SITUACOES.length * dias.length
  const porCodigo = new Map<string, VeiculoSga>()
  let feitos = 0

  for (const codigo_situacao of SITUACOES) {
    for (const data_contrato of dias) {
      const lote = await paginarSga<VeiculoSga>(async (pagina) => {
        const r = await postSga<{ veiculos?: VeiculoSga[] }>(
          '/listar/veiculo',
          { codigo_situacao, data_contrato, inicio_paginacao: pagina, quantidade_por_pagina: POR_PAGINA },
          token,
        )
        return r?.veiculos ?? []
      })
      for (const v of lote) porCodigo.set(String(v.codigo_veiculo), v)
      feitos++
      onProgresso?.(feitos, total)
      await sleep(80)
    }
  }

  return [...porCodigo.values()]
}
```

- [ ] **Step 4: Implementar o coletor de boletos**

Criar `backend/src/modules/rede/sync/coletor-boletos.ts`:

```ts
import { postSga } from '../clients/sga.client'
import { paginarSga, POR_PAGINA } from './coletor-placas'

interface BoletoSga {
  data_pagamento?: string
  data_vencimento?: string
  valor_pagamento?: string
  valor?: string
  descricao_situacao?: string
  nome_associado?: string
  veiculos?: Array<{ codigo_veiculo: string | number; placa?: string }>
}

export interface Pagamento {
  dataPagamento: string
  valor: number
}

export interface BoletoAberto {
  dataVencimento: string
  valor: number
  situacao: string | null
}

const primeiroDia = (mes: string) => `01/${mes.split('-')[1]}/${mes.split('-')[0]}`
const ultimoDia = (mes: string) => {
  const [ano, m] = mes.split('-').map(Number)
  return `${new Date(ano, m, 0).getDate()}/${String(m).padStart(2, '0')}/${ano}`
}

/**
 * Placas com boleto PAGO no mes, indexadas por codigo_veiculo.
 * O pagamento no SGA e POR PLACA: e o `codigo_veiculo` dentro de `veiculos[]` que liga
 * o pagamento a venda. Cruzar por placa ou por nome do cliente erra.
 * O periodo e limitado a 31 dias pela API — um mes por execucao.
 */
export async function coletarBoletosPagos(mes: string, token: string): Promise<Map<string, Pagamento>> {
  const pagos = new Map<string, Pagamento>()
  const lote = await paginarSga<BoletoSga>(async (pagina) => {
    const r = await postSga<{ boletos?: BoletoSga[] }>(
      '/listar/boleto-associado/periodo',
      {
        data_pagamento_inicial: primeiroDia(mes),
        data_pagamento_final: ultimoDia(mes),
        inicio_paginacao: pagina,
        quantidade_por_pagina: POR_PAGINA,
      },
      token,
    )
    return r?.boletos ?? []
  })

  for (const b of lote) {
    for (const v of b.veiculos ?? []) {
      pagos.set(String(v.codigo_veiculo), {
        dataPagamento: String(b.data_pagamento || '').slice(0, 10),
        valor: Number(b.valor_pagamento || b.valor || 0),
      })
    }
  }
  return pagos
}

/**
 * Boletos VENCIDOS e nao pagos no periodo — a definicao de inadimplente que o cliente usa:
 * "cliente nao pagou o boleto no mes, esta com boleto atrasado".
 * Filtra por data de vencimento e descarta o que tem data de pagamento preenchida.
 */
export async function coletarBoletosVencidos(mes: string, token: string): Promise<Map<string, BoletoAberto>> {
  const abertos = new Map<string, BoletoAberto>()
  const lote = await paginarSga<BoletoSga>(async (pagina) => {
    const r = await postSga<{ boletos?: BoletoSga[] }>(
      '/listar/boleto-associado/periodo',
      {
        data_vencimento_inicial: primeiroDia(mes),
        data_vencimento_final: ultimoDia(mes),
        inicio_paginacao: pagina,
        quantidade_por_pagina: POR_PAGINA,
      },
      token,
    )
    return r?.boletos ?? []
  })

  for (const b of lote) {
    if (b.data_pagamento) continue // pagou, nao e inadimplente
    for (const v of b.veiculos ?? []) {
      abertos.set(String(v.codigo_veiculo), {
        dataVencimento: String(b.data_vencimento || '').slice(0, 10),
        valor: Number(b.valor || 0),
        situacao: b.descricao_situacao || null,
      })
    }
  }
  return abertos
}

/** Dias de atraso de um vencimento (YYYY-MM-DD) ate a data de referencia. */
export function diasDeAtraso(dataVencimento: string, hoje: Date): number {
  const venc = new Date(`${dataVencimento}T00:00:00`)
  const dia = 24 * 60 * 60 * 1000
  return Math.max(0, Math.floor((hoje.getTime() - venc.getTime()) / dia))
}
```

- [ ] **Step 5: Rodar os testes e confirmar que passam**

Run: `cd backend && npx vitest run src/modules/rede/sync/coletores.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 6: Commit**

```bash
git add backend/src/modules/rede/sync/coletor-placas.ts backend/src/modules/rede/sync/coletor-boletos.ts backend/src/modules/rede/sync/coletores.test.ts
git commit -m "feat(rede): coletores de placas do mes e de boletos pagos e vencidos"
```

---

## Task 7: Orquestração da carga com staging e publicação atômica

**Files:**
- Create: `backend/src/modules/rede/sync/sync.service.ts`
- Test: `backend/src/modules/rede/sync/cruzamento.test.ts`

**Interfaces:**
- Consumes: coletores das Tasks 5 e 6, `calcularPlacar` (Task 2)
- Produces:
  - `cruzarPlacas(veiculos, pagos, vencidos, hoje): PlacaContada[]` — função pura, testada
  - `sincronizar(params: { companyId, raizPowerId, raizNome, disparadaPor, mesContrato, mesPagamento }): Promise<string>` — devolve o `cargaId`
  - `progressoDaCarga(cargaId, companyId)`

- [ ] **Step 1: Escrever o teste do cruzamento**

Criar `backend/src/modules/rede/sync/cruzamento.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { cruzarPlacas } from './sync.service'
import type { VeiculoSga } from './coletor-placas'

const veic = (cod: string, cpf: string): VeiculoSga => ({
  codigo_veiculo: cod, placa: `AAA${cod}`, nome_associado: 'Fulano de Tal',
  celular_associado: '(21) 99999-0000', data_contrato: '2026-05-10T00:00:00-0300',
  descricao_situacao: 'ATIVO', cpf_voluntario: cpf,
})

const HOJE = new Date('2026-07-22T12:00:00Z')

describe('cruzarPlacas', () => {
  it('marca como paga a placa cujo codigo_veiculo aparece nos pagos', () => {
    const r = cruzarPlacas([veic('10', '111')], new Map([['10', { dataPagamento: '2026-06-05', valor: 195.25 }]]), new Map(), HOJE)
    expect(r[0].status).toBe('paga')
    expect(r[0].mesPagamento).toBe('2026-06')
    expect(r[0].valor).toBe(195.25)
  })

  it('marca como inadimplente a placa com boleto vencido em aberto, com dias de atraso', () => {
    const r = cruzarPlacas([veic('10', '111')], new Map(), new Map([['10', { dataVencimento: '2026-06-22', valor: 195.25, situacao: 'EM ABERTO' }]]), HOJE)
    expect(r[0].status).toBe('inadimplente')
    expect(r[0].diasAtraso).toBe(30)
  })

  it('pagamento vence inadimplencia quando a placa aparece nos dois lados', () => {
    const r = cruzarPlacas(
      [veic('10', '111')],
      new Map([['10', { dataPagamento: '2026-06-05', valor: 10 }]]),
      new Map([['10', { dataVencimento: '2026-06-01', valor: 10, situacao: 'EM ABERTO' }]]),
      HOJE,
    )
    expect(r[0].status).toBe('paga')
  })

  it('descarta placa sem CPF de voluntario em vez de somar a alguem por aproximacao', () => {
    const semCpf = { ...veic('10', ''), cpf_voluntario: '' }
    const r = cruzarPlacas([semCpf], new Map(), new Map(), HOJE)
    expect(r).toHaveLength(0)
  })

  it('normaliza CPF, mes de contrato e telefone do associado', () => {
    const v = { ...veic('10', '151.837.367-40'), celular_associado: '(21) 97543-3883' }
    const r = cruzarPlacas([v], new Map(), new Map(), HOJE)
    expect(r[0].cpfConsultor).toBe('15183736740')
    expect(r[0].mesContrato).toBe('2026-05')
    expect(r[0].dataContrato).toBe('2026-05-10')
    expect(r[0].telefoneAssociado).toBe('(21) 97543-3883')
  })

  it('placa contratada, sem pagamento e sem boleto vencido fica de fora das duas listas', () => {
    const r = cruzarPlacas([veic('10', '111')], new Map(), new Map(), HOJE)
    expect(r).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/rede/sync/cruzamento.test.ts`
Expected: FAIL — `Failed to resolve import "./sync.service"`.

- [ ] **Step 3: Implementar**

Criar `backend/src/modules/rede/sync/sync.service.ts`:

```ts
import { randomUUID } from 'node:crypto'
import { prisma } from '../../../lib/prisma'
import { coletarRede } from './coletor-rede'
import { coletarPlacasDoMes, type VeiculoSga } from './coletor-placas'
import { coletarBoletosPagos, coletarBoletosVencidos, diasDeAtraso, type BoletoAberto, type Pagamento } from './coletor-boletos'
import { autenticarSga } from '../clients/sga.client'
import { listarUsuariosPagina } from '../clients/power.client'
import { contarPorNivel } from '../arvore'
import type { PlacaContada } from '../rede.types'

const soDigitos = (s?: string | null) => String(s || '').replace(/\D/g, '')

/**
 * Cruza as tres fontes numa lista de placas com desfecho resolvido.
 *
 * A chave do cruzamento e SEMPRE `codigo_veiculo` — e o numero que aparece nos dois lados
 * (no veiculo e dentro do boleto). Nunca por placa nem por nome do cliente.
 *
 * Pagamento vence inadimplencia: se a placa aparece nos dois lados, ela foi paga.
 * Placa sem CPF de voluntario e descartada, nunca atribuida por aproximacao.
 */
export function cruzarPlacas(
  veiculos: VeiculoSga[],
  pagos: Map<string, Pagamento>,
  vencidos: Map<string, BoletoAberto>,
  hoje: Date,
): PlacaContada[] {
  const out: PlacaContada[] = []

  for (const v of veiculos) {
    const cpfConsultor = soDigitos(v.cpf_voluntario)
    if (!cpfConsultor) continue

    const codigoVeiculo = String(v.codigo_veiculo)
    const dataContrato = String(v.data_contrato || '').slice(0, 10)
    const pago = pagos.get(codigoVeiculo)
    const vencido = vencidos.get(codigoVeiculo)
    if (!pago && !vencido) continue

    out.push({
      cpfConsultor,
      codigoVeiculo,
      placa: v.placa,
      associado: v.nome_associado,
      telefoneAssociado: v.celular_associado || v.telefone_associado || null,
      dataContrato,
      mesContrato: dataContrato.slice(0, 7),
      dataPagamento: pago?.dataPagamento ?? null,
      mesPagamento: pago ? pago.dataPagamento.slice(0, 7) : null,
      dataVencimento: vencido?.dataVencimento ?? null,
      diasAtraso: !pago && vencido ? diasDeAtraso(vencido.dataVencimento, hoje) : null,
      valor: pago?.valor ?? vencido?.valor ?? null,
      situacaoVeiculo: v.descricao_situacao ?? null,
      situacaoBoleto: vencido?.situacao ?? null,
      status: pago ? 'paga' : 'inadimplente',
    })
  }

  return out
}

interface ParamsSync {
  /** Gerado pelo controller para poder devolver o id na hora, antes da carga terminar. */
  cargaId?: string
  companyId: string
  raizPowerId: number
  raizNome: string
  raizCpf: string
  disparadaPor: string
  mesContrato: string
  mesPagamento: string
}

async function marcarEtapa(cargaId: string, etapa: string) {
  await prisma.redeCarga.update({ where: { id: cargaId }, data: { etapa } })
}

/**
 * Roda a carga inteira em staging e publica atomicamente no fim.
 *
 * Publica tudo ou nao publica nada: se qualquer etapa falhar, a carga fica com status
 * `falhou` e a carga publicada anterior continua intacta. Foi o token do SGA caindo no meio
 * que fez junho sair 3.473 em vez de 3.549 — sem isso, aquele numero teria virado tela.
 */
export async function sincronizar(p: ParamsSync): Promise<string> {
  const carga = await prisma.redeCarga.create({
    data: {
      id: p.cargaId ?? randomUUID(),
      companyId: p.companyId,
      raizPowerId: p.raizPowerId,
      disparadaPor: p.disparadaPor,
      etapa: 'rede',
      status: 'rodando',
    },
  })

  try {
    // 1) Rede
    const membros = await coletarRede({ powerId: p.raizPowerId, nome: p.raizNome })
    await prisma.redeConsultor.createMany({
      data: [
        {
          id: randomUUID(), companyId: p.companyId, cargaId: carga.id, powerId: p.raizPowerId,
          cpf: p.raizCpf, nome: p.raizNome, nomeTratamento: p.raizNome, email: null, celular: null,
          funcao: null, cooperativa: null, patrocinadorPowerId: null, nivelRaiz: 0,
          raizPowerId: p.raizPowerId, caminho: p.raizNome, status: 'ativo', userId: null,
        },
        ...membros.map((m) => ({
          id: randomUUID(), companyId: p.companyId, cargaId: carga.id, powerId: m.powerId,
          cpf: m.cpf, nome: m.nome, nomeTratamento: m.nomeTratamento, email: m.email,
          celular: m.celular, funcao: m.funcao, cooperativa: m.cooperativa,
          patrocinadorPowerId: m.patrocinadorPowerId, nivelRaiz: m.nivelRaiz,
          raizPowerId: p.raizPowerId, caminho: m.caminho, status: m.status, userId: null,
        })),
      ],
    })

    // 2) Placas e boletos
    await marcarEtapa(carga.id, 'placas')
    const token = await autenticarSga()
    const veiculos = await coletarPlacasDoMes(p.mesContrato, token)

    await marcarEtapa(carga.id, 'boletos')
    const pagos = await coletarBoletosPagos(p.mesPagamento, token)
    const vencidos = await coletarBoletosVencidos(p.mesPagamento, token)

    const cpfsDaRede = new Set([p.raizCpf, ...membros.map((m) => m.cpf)])
    const placas = cruzarPlacas(veiculos, pagos, vencidos, new Date())
      .filter((pl) => cpfsDaRede.has(pl.cpfConsultor))

    await prisma.redePlaca.createMany({
      data: placas.map((pl) => ({
        id: randomUUID(), companyId: p.companyId, cargaId: carga.id,
        cpfConsultor: pl.cpfConsultor, codigoVeiculo: pl.codigoVeiculo, placa: pl.placa,
        associado: pl.associado, telefoneAssociado: pl.telefoneAssociado,
        dataContrato: pl.dataContrato, mesContrato: pl.mesContrato,
        dataPagamento: pl.dataPagamento, mesPagamento: pl.mesPagamento,
        dataVencimento: pl.dataVencimento, diasAtraso: pl.diasAtraso, valor: pl.valor,
        situacaoVeiculo: pl.situacaoVeiculo, situacaoBoleto: pl.situacaoBoleto, status: pl.status,
      })),
    })

    // 3) Publicacao atomica: despublica a anterior e publica esta, na mesma transacao.
    await marcarEtapa(carga.id, 'publicando')
    const totais = {
      pessoas: membros.length,
      porNivel: contarPorNivel(membros),
      placas: placas.length,
      pagas: placas.filter((x) => x.status === 'paga').length,
      inadimplentes: placas.filter((x) => x.status === 'inadimplente').length,
      veiculosLidos: veiculos.length,
      descartadasSemCpf: veiculos.filter((v) => !soDigitos(v.cpf_voluntario)).length,
    }

    await prisma.$transaction([
      prisma.redeCarga.updateMany({
        where: { companyId: p.companyId, raizPowerId: p.raizPowerId, publicada: true },
        data: { publicada: false },
      }),
      prisma.redeCarga.update({
        where: { id: carga.id },
        data: { publicada: true, status: 'publicada', etapa: 'fim', concluidaEm: new Date(), totais },
      }),
    ])

    return carga.id
  } catch (err) {
    await prisma.redeCarga.update({
      where: { id: carga.id },
      data: { status: 'falhou', concluidaEm: new Date(), erro: (err as Error).message.slice(0, 500) },
    })
    throw err
  }
}

export async function progressoDaCarga(cargaId: string, companyId: string) {
  return prisma.redeCarga.findFirst({ where: { id: cargaId, companyId } })
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/rede/sync/cruzamento.test.ts`
Expected: PASS — 6 testes.

- [ ] **Step 5: Verificar o import do Prisma**

Run: `cd backend && grep -rn "export const prisma\|export { prisma" src/lib/`
Expected: confirma o caminho de `prisma`. Se o projeto exporta de outro lugar, ajustar o import no topo de `sync.service.ts` para o caminho real antes de seguir.

- [ ] **Step 6: Type-check e commit**

Run: `cd backend && npm run type-check`
Expected: sem erros.

```bash
git add backend/src/modules/rede/sync/sync.service.ts backend/src/modules/rede/sync/cruzamento.test.ts
git commit -m "feat(rede): carga em staging com publicacao atomica e cruzamento por codigo_veiculo"
```

---

## Task 8: Serviço de leitura

**Files:**
- Create: `backend/src/modules/rede/rede.service.ts`

**Interfaces:**
- Consumes: `calcularPlacar` (Task 2), models Prisma (Task 1)
- Produces:
  - `cargaPublicada(companyId, raizPowerId)`
  - `arvore(companyId, raizPowerId)` → `{ carga, membros, porNivel, placasPorCpf }`
  - `placar(companyId, raizPowerId, mesContrato, mesPagamento)` → `Placar`
  - `listarPlacas(companyId, raizPowerId, filtros)` → `PlacaContada[]`
  - `resolverRaizDoUsuario(companyId, userId)` → `{ powerId, nome, cpf } | null`

- [ ] **Step 1: Implementar**

Criar `backend/src/modules/rede/rede.service.ts`:

```ts
import { prisma } from '../../lib/prisma'
import { calcularPlacar } from './unilevel'
import type { Placar } from './rede.types'

/** A carga publicada e a unica fonte de leitura. Carga rodando nunca aparece na tela. */
export async function cargaPublicada(companyId: string, raizPowerId: number) {
  return prisma.redeCarga.findFirst({
    where: { companyId, raizPowerId, publicada: true },
    orderBy: { concluidaEm: 'desc' },
  })
}

/** Resolve qual raiz o usuario logado enxerga: a que aponta pro user_id dele. */
export async function resolverRaizDoUsuario(companyId: string, userId: string) {
  const raiz = await prisma.redeConsultor.findFirst({
    where: { companyId, userId, nivelRaiz: 0 },
    select: { powerId: true, nome: true, cpf: true },
  })
  return raiz
}

export interface FiltrosPlacas {
  mesContrato?: string
  mesPagamento?: string
  status?: 'paga' | 'inadimplente'
  cpfConsultor?: string
  nivel?: number
  escopo?: 'proprias' | 'equipe' | 'tudo'
  busca?: string
}

async function niveisPorCpf(cargaId: string): Promise<Map<string, number>> {
  const pessoas = await prisma.redeConsultor.findMany({
    where: { cargaId },
    select: { cpf: true, nivelRaiz: true },
  })
  return new Map(pessoas.map((p) => [p.cpf, p.nivelRaiz]))
}

export async function arvore(companyId: string, raizPowerId: number) {
  const carga = await cargaPublicada(companyId, raizPowerId)
  if (!carga) return null

  const membros = await prisma.redeConsultor.findMany({
    where: { cargaId: carga.id },
    orderBy: [{ nivelRaiz: 'asc' }, { nome: 'asc' }],
  })

  // Placas por CPF, para o card de cada pessoa e para o total do ramo.
  const agrupado = await prisma.redePlaca.groupBy({
    by: ['cpfConsultor', 'status'],
    where: { cargaId: carga.id },
    _count: { _all: true },
  })
  const placasPorCpf: Record<string, { pagas: number; inadimplentes: number }> = {}
  for (const g of agrupado) {
    const alvo = (placasPorCpf[g.cpfConsultor] ||= { pagas: 0, inadimplentes: 0 })
    if (g.status === 'paga') alvo.pagas = g._count._all
    else alvo.inadimplentes = g._count._all
  }

  const porNivel: Record<number, number> = {}
  for (const m of membros) if (m.nivelRaiz > 0) porNivel[m.nivelRaiz] = (porNivel[m.nivelRaiz] || 0) + 1

  return {
    carga: { id: carga.id, atualizadoEm: carga.concluidaEm, totais: carga.totais },
    membros,
    porNivel,
    placasPorCpf,
  }
}

export async function placar(
  companyId: string,
  raizPowerId: number,
  mesContrato: string,
  mesPagamento: string,
): Promise<Placar | null> {
  const carga = await cargaPublicada(companyId, raizPowerId)
  if (!carga) return null

  const placas = await prisma.redePlaca.findMany({
    where: { cargaId: carga.id, mesContrato, mesPagamento, status: 'paga' },
  })

  return calcularPlacar(
    placas.map((p) => ({
      cpfConsultor: p.cpfConsultor, codigoVeiculo: p.codigoVeiculo, placa: p.placa,
      associado: p.associado, telefoneAssociado: p.telefoneAssociado,
      dataContrato: p.dataContrato, mesContrato: p.mesContrato,
      dataPagamento: p.dataPagamento, mesPagamento: p.mesPagamento,
      dataVencimento: p.dataVencimento, diasAtraso: p.diasAtraso,
      valor: p.valor ? Number(p.valor) : null,
      situacaoVeiculo: p.situacaoVeiculo, situacaoBoleto: p.situacaoBoleto,
      status: p.status as 'paga' | 'inadimplente',
    })),
    await niveisPorCpf(carga.id),
  )
}

export async function listarPlacas(companyId: string, raizPowerId: number, f: FiltrosPlacas) {
  const carga = await cargaPublicada(companyId, raizPowerId)
  if (!carga) return { carga: null, placas: [] }

  const niveis = await niveisPorCpf(carga.id)
  const pessoas = await prisma.redeConsultor.findMany({
    where: { cargaId: carga.id },
    select: { cpf: true, nome: true, nivelRaiz: true },
  })
  const pessoaPorCpf = new Map(pessoas.map((p) => [p.cpf, p]))

  const placas = await prisma.redePlaca.findMany({
    where: {
      cargaId: carga.id,
      ...(f.mesContrato ? { mesContrato: f.mesContrato } : {}),
      ...(f.mesPagamento && f.status !== 'inadimplente' ? { mesPagamento: f.mesPagamento } : {}),
      ...(f.status ? { status: f.status } : {}),
      ...(f.cpfConsultor ? { cpfConsultor: f.cpfConsultor } : {}),
      ...(f.busca
        ? {
            OR: [
              { placa: { contains: f.busca, mode: 'insensitive' as const } },
              { associado: { contains: f.busca, mode: 'insensitive' as const } },
              { telefoneAssociado: { contains: f.busca } },
            ],
          }
        : {}),
    },
    orderBy: [{ dataContrato: 'asc' }, { associado: 'asc' }],
  })

  const comConsultor = placas
    .map((p) => {
      const pessoa = pessoaPorCpf.get(p.cpfConsultor)
      return {
        ...p,
        valor: p.valor ? Number(p.valor) : null,
        consultor: pessoa?.nome ?? '(fora da rede)',
        nivel: niveis.get(p.cpfConsultor) ?? null,
      }
    })
    .filter((p) => {
      if (f.nivel != null && p.nivel !== f.nivel) return false
      if (f.escopo === 'proprias' && p.nivel !== 0) return false
      if (f.escopo === 'equipe' && p.nivel === 0) return false
      return true
    })

  return { carga: { id: carga.id, atualizadoEm: carga.concluidaEm }, placas: comConsultor }
}
```

- [ ] **Step 2: Type-check**

Run: `cd backend && npm run type-check`
Expected: sem erros.

- [ ] **Step 3: Commit**

```bash
git add backend/src/modules/rede/rede.service.ts
git commit -m "feat(rede): servico de leitura da arvore, placar e listas de placas"
```

---

## Task 9: Rotas e controller

**Files:**
- Create: `backend/src/modules/rede/rede.controller.ts`
- Create: `backend/src/modules/rede/rede.routes.ts`
- Modify: `backend/src/server.ts` (registro da rota, junto das outras)

**Interfaces:**
- Consumes: `rede.service.ts` (Task 8), `sync.service.ts` (Task 7)
- Produces: os endpoints que o frontend da Fase B consome.

- [ ] **Step 1: Implementar o controller**

Criar `backend/src/modules/rede/rede.controller.ts`:

```ts
import { randomUUID } from 'node:crypto'
import type { FastifyRequest, FastifyReply } from 'fastify'
import * as service from './rede.service'
import { sincronizar, progressoDaCarga } from './sync/sync.service'
import { TokenExpiradoError } from './clients/power.client'

interface Autenticado { id: string; companyId: string; role?: string }

/**
 * Resolve qual raiz o pedido enxerga.
 * Consultor: so a propria (a que aponta pro user_id dele). Admin: qualquer uma, via ?raiz=.
 */
async function resolverRaiz(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as Autenticado
  const { raiz } = request.query as { raiz?: string }

  if (user.role === 'admin' && raiz) {
    return { companyId: user.companyId, raizPowerId: Number(raiz), user }
  }

  const minha = await service.resolverRaizDoUsuario(user.companyId, user.id)
  if (!minha) {
    reply.status(404).send({ message: 'Voce ainda nao tem rede vinculada.' })
    return null
  }
  return { companyId: user.companyId, raizPowerId: minha.powerId, user }
}

export async function getArvore(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await resolverRaiz(request, reply)
  if (!ctx) return
  const data = await service.arvore(ctx.companyId, ctx.raizPowerId)
  if (!data) return reply.status(404).send({ message: 'Nenhuma carga publicada para esta rede ainda.' })
  return reply.send(data)
}

export async function getPlacar(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await resolverRaiz(request, reply)
  if (!ctx) return
  const { contrato = '2026-05', pagamento = '2026-06' } = request.query as { contrato?: string; pagamento?: string }
  const data = await service.placar(ctx.companyId, ctx.raizPowerId, contrato, pagamento)
  if (!data) return reply.status(404).send({ message: 'Nenhuma carga publicada para esta rede ainda.' })
  return reply.send(data)
}

export async function getPlacas(request: FastifyRequest, reply: FastifyReply) {
  const ctx = await resolverRaiz(request, reply)
  if (!ctx) return
  const q = request.query as Record<string, string>
  const data = await service.listarPlacas(ctx.companyId, ctx.raizPowerId, {
    mesContrato: q.contrato,
    mesPagamento: q.pagamento,
    status: q.status as 'paga' | 'inadimplente' | undefined,
    cpfConsultor: q.consultor,
    nivel: q.nivel != null && q.nivel !== '' ? Number(q.nivel) : undefined,
    escopo: (q.escopo as 'proprias' | 'equipe' | 'tudo') || 'tudo',
    busca: q.busca,
  })
  return reply.send(data)
}

/**
 * Dispara a carga sem bloquear a resposta: a coleta leva ~30 min.
 * O id e gerado aqui pra poder ser devolvido na hora; o cliente acompanha por
 * GET /api/rede/sync/:id.
 */
function dispararCarga(params: Parameters<typeof sincronizar>[0]): string {
  const cargaId = randomUUID()
  void sincronizar({ ...params, cargaId }).catch((err) => {
    console.error('[rede] carga falhou:', (err as Error).message)
  })
  return cargaId
}

export async function postSync(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as Autenticado
  if (user.role !== 'admin') return reply.status(403).send({ message: 'Apenas admin pode atualizar os dados da rede.' })

  const body = request.body as {
    raizPowerId: number; raizNome: string; raizCpf: string; mesContrato: string; mesPagamento: string
  }

  try {
    const cargaId = dispararCarga({ ...body, companyId: user.companyId, disparadaPor: user.id })
    return reply.status(202).send({ cargaId })
  } catch (err) {
    if (err instanceof TokenExpiradoError) return reply.status(400).send({ message: err.message })
    throw err
  }
}

export async function getSync(request: FastifyRequest, reply: FastifyReply) {
  const user = (request as any).user as Autenticado
  const { id } = request.params as { id: string }
  const carga = await progressoDaCarga(id, user.companyId)
  if (!carga) return reply.status(404).send({ message: 'Carga nao encontrada.' })
  return reply.send(carga)
}
```

- [ ] **Step 2: Implementar as rotas**

Criar `backend/src/modules/rede/rede.routes.ts`:

```ts
import type { FastifyInstance } from 'fastify'
import { authenticate } from '../../middlewares/authenticate'
import { getArvore, getPlacar, getPlacas, postSync, getSync } from './rede.controller'

export async function redeRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', authenticate)

  fastify.get('/arvore', getArvore)
  fastify.get('/placar', getPlacar)
  fastify.get('/placas', getPlacas)
  fastify.post('/sync', postSync)
  fastify.get('/sync/:id', getSync)
}
```

- [ ] **Step 3: Registrar no servidor**

Em `backend/src/server.ts`, junto dos outros registros (perto da linha 190):

```ts
    await fastify.register(redeRoutes, { prefix: '/api/rede' })
```

e o import no topo, no bloco dos outros:

```ts
import { redeRoutes } from './modules/rede/rede.routes'
```

- [ ] **Step 4: Subir o backend e conferir que as rotas existem**

Run: `cd backend && npm run dev`
Em outro terminal: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3333/api/rede/arvore`
Expected: `401` (rota existe e exige autenticação — não `404`).

- [ ] **Step 5: Type-check e commit**

Run: `cd backend && npm run type-check && npx vitest run src/modules/rede`
Expected: type-check limpo, todos os testes do módulo passando.

```bash
git add backend/src/modules/rede/rede.controller.ts backend/src/modules/rede/rede.routes.ts backend/src/server.ts backend/src/modules/rede/sync/sync.service.ts
git commit -m "feat(rede): endpoints de arvore, placar, placas e sincronizacao"
```

---

## Task 10: Placas do ramo calculadas no backend

**Files:**
- Create: `backend/src/modules/rede/ramo.ts`
- Test: `backend/src/modules/rede/ramo.test.ts`
- Modify: `backend/src/modules/rede/rede.service.ts` (função `arvore`)

**Interfaces:**
- Consumes: `MembroRede` (Task 2)
- Produces: `calcularRamos(membros, placasPorCpf): Map<number, ResumoRamo>` onde `ResumoRamo` é `{ proprias: number; ramo: number; descendentes: number }`, indexado por `powerId`. A resposta de `GET /api/rede/arvore` passa a trazer `ramos`.

> **Por que no backend:** recomendação D.3 do documento de UX. O percurso sobre 764 nós roda uma vez por carga no servidor, não a cada render no navegador do Rodrigo. O número "placas do ramo" é o que faz o multinível ficar óbvio na tela, então precisa estar pronto quando a tela abre.

- [ ] **Step 1: Escrever o teste que falha**

Criar `backend/src/modules/rede/ramo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { calcularRamos } from './ramo'

// Rede: raiz 1 -> 2 -> 3, e 1 -> 4
const MEMBROS = [
  { powerId: 1, patrocinadorPowerId: null, cpf: 'c1' },
  { powerId: 2, patrocinadorPowerId: 1, cpf: 'c2' },
  { powerId: 3, patrocinadorPowerId: 2, cpf: 'c3' },
  { powerId: 4, patrocinadorPowerId: 1, cpf: 'c4' },
]

describe('calcularRamos', () => {
  it('soma as placas da pessoa mais tudo que esta abaixo dela', () => {
    const r = calcularRamos(MEMBROS, { c1: 10, c2: 5, c3: 2, c4: 1 })
    expect(r.get(1)).toEqual({ proprias: 10, ramo: 18, descendentes: 3 })
    expect(r.get(2)).toEqual({ proprias: 5, ramo: 7, descendentes: 1 })
    expect(r.get(3)).toEqual({ proprias: 2, ramo: 2, descendentes: 0 })
  })

  it('quem nao vendeu fica com zero, nao some', () => {
    const r = calcularRamos(MEMBROS, { c1: 1 })
    expect(r.get(4)).toEqual({ proprias: 0, ramo: 0, descendentes: 0 })
  })

  it('um direto que vende pouco pode carregar um ramo grande', () => {
    const r = calcularRamos(MEMBROS, { c2: 1, c3: 100 })
    expect(r.get(2)!.proprias).toBe(1)
    expect(r.get(2)!.ramo).toBe(101)
  })

  it('nao trava se o cadastro tiver ciclo', () => {
    const ciclico = [
      { powerId: 1, patrocinadorPowerId: 3, cpf: 'c1' },
      { powerId: 2, patrocinadorPowerId: 1, cpf: 'c2' },
      { powerId: 3, patrocinadorPowerId: 2, cpf: 'c3' },
    ]
    const r = calcularRamos(ciclico, { c1: 1, c2: 1, c3: 1 })
    expect(r.size).toBe(3)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd backend && npx vitest run src/modules/rede/ramo.test.ts`
Expected: FAIL — `Failed to resolve import "./ramo"`.

- [ ] **Step 3: Implementar**

Criar `backend/src/modules/rede/ramo.ts`:

```ts
export interface ResumoRamo {
  proprias: number
  ramo: number
  descendentes: number
}

interface NoMinimo {
  powerId: number
  patrocinadorPowerId: number | null
  cpf: string
}

/**
 * Placas proprias e placas do RAMO (a pessoa mais tudo abaixo dela) por powerId.
 *
 * O numero do ramo e o que torna o multinivel visivel: um direto que vende pouco pode
 * carregar um sub-time enorme, e sem esse numero a tela nao mostra isso.
 *
 * Calculado subindo pelo patrocinador — nao precisa montar arvore nem recursao.
 * A trava de visitados protege contra ciclo de cadastro.
 */
export function calcularRamos(membros: NoMinimo[], placasPorCpf: Record<string, number>): Map<number, ResumoRamo> {
  const out = new Map<number, ResumoRamo>()
  for (const m of membros) {
    const proprias = placasPorCpf[m.cpf] ?? 0
    out.set(m.powerId, { proprias, ramo: proprias, descendentes: 0 })
  }

  const paiDe = new Map<number, number | null>(membros.map((m) => [m.powerId, m.patrocinadorPowerId]))

  for (const m of membros) {
    const minhas = placasPorCpf[m.cpf] ?? 0
    const visitados = new Set<number>([m.powerId])
    let pai = paiDe.get(m.powerId) ?? null

    while (pai != null && !visitados.has(pai)) {
      visitados.add(pai)
      const alvo = out.get(pai)
      if (!alvo) break
      alvo.ramo += minhas
      alvo.descendentes += 1
      pai = paiDe.get(pai) ?? null
    }
  }

  return out
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd backend && npx vitest run src/modules/rede/ramo.test.ts`
Expected: PASS — 4 testes.

- [ ] **Step 5: Ligar na resposta da árvore**

Em `backend/src/modules/rede/rede.service.ts`, acrescentar o import no topo:

```ts
import { calcularRamos } from './ramo'
```

Dentro de `arvore`, logo antes do `return`, acrescentar:

```ts
  const soPagas: Record<string, number> = {}
  for (const [cpf, v] of Object.entries(placasPorCpf)) soPagas[cpf] = v.pagas
  const ramos = calcularRamos(
    membros.map((m) => ({ powerId: m.powerId, patrocinadorPowerId: m.patrocinadorPowerId, cpf: m.cpf })),
    soPagas,
  )
```

E trocar o objeto retornado por:

```ts
  return {
    carga: { id: carga.id, atualizadoEm: carga.concluidaEm, totais: carga.totais },
    membros,
    porNivel,
    placasPorCpf,
    ramos: Object.fromEntries(ramos),
  }
```

- [ ] **Step 6: Type-check e commit**

Run: `cd backend && npm run type-check && npx vitest run src/modules/rede`
Expected: tudo verde.

```bash
git add backend/src/modules/rede/ramo.ts backend/src/modules/rede/ramo.test.ts backend/src/modules/rede/rede.service.ts
git commit -m "feat(rede): placas do ramo calculadas no backend, uma vez por carga"
```

---

# FASE B — Tela (frontend)

> **Fonte de design:** `docs/superpowers/specs/2026-07-22-minha-rede-ux-recomendacoes.md`. Toda decisão visual, micro-copy e de interação sai de lá; a seção correspondente é citada em cada task. Onde este plano e aquele documento divergirem, vale o documento.

## Task 11: Serviço, tipos e hooks do frontend

**Files:**
- Create: `frontend/src/services/rede.service.ts`
- Create: `frontend/src/hooks/useRede.ts`
- Modify: `frontend/package.json` (dependência `@tanstack/react-virtual`)

**Interfaces:**
- Consumes: endpoints das Tasks 9 e 10
- Produces: `useArvoreRede()`, `usePlacar(contrato, pagamento)`, `usePlacas(filtros)`, `useSincronizar()`, `useProgressoCarga(cargaId)` e os tipos `MembroRede`, `ResumoRamo`, `Placar`, `PlacaLinha`, `ArvoreResponse`, `FiltrosPlacas` — consumidos por todas as telas das Tasks 13 a 18.

- [ ] **Step 1: Instalar a única dependência nova**

Run: `cd frontend && npm install @tanstack/react-virtual`
Expected: instala (~2 KB gzip, mesma família do TanStack Query já em produção).

- [ ] **Step 2: Escrever o service**

Criar `frontend/src/services/rede.service.ts`:

```ts
import { api } from '../lib/api'

export interface MembroRede {
  id: string
  powerId: number
  cpf: string
  nome: string
  nomeTratamento: string
  email: string | null
  celular: string | null
  funcao: string | null
  cooperativa: string | null
  patrocinadorPowerId: number | null
  nivelRaiz: number
  caminho: string
  status: 'ativo' | 'bloqueado'
}

export interface ResumoRamo {
  proprias: number
  ramo: number
  descendentes: number
}

export interface ArvoreResponse {
  carga: { id: string; atualizadoEm: string | null; totais: Record<string, any> | null }
  membros: MembroRede[]
  porNivel: Record<number, number>
  placasPorCpf: Record<string, { pagas: number; inadimplentes: number }>
  ramos: Record<number, ResumoRamo>
}

export interface Placar {
  proprias: number
  equipe: number
  bruto: number
  ponderado: number
  foraDoAlcance: number
  porNivel: Record<number, number>
  consultoresProduzindo: number
  valorTotal: number
}

export interface PlacaLinha {
  id: string
  placa: string
  associado: string
  telefoneAssociado: string | null
  cpfConsultor: string
  consultor: string
  nivel: number | null
  dataContrato: string
  dataPagamento: string | null
  dataVencimento: string | null
  diasAtraso: number | null
  valor: number | null
  status: 'paga' | 'inadimplente'
}

export interface FiltrosPlacas {
  contrato?: string
  pagamento?: string
  status?: 'paga' | 'inadimplente'
  consultor?: string
  nivel?: number
  escopo?: 'proprias' | 'equipe' | 'tudo'
  busca?: string
}

export interface CargaProgresso {
  id: string
  etapa: string
  status: 'rodando' | 'publicada' | 'falhou'
  iniciadaEm: string
  concluidaEm: string | null
  erro: string | null
  totais: Record<string, any> | null
}

export const redeService = {
  async arvore(): Promise<ArvoreResponse> {
    const { data } = await api.get('/rede/arvore')
    return data
  },
  async placar(contrato: string, pagamento: string): Promise<Placar> {
    const { data } = await api.get('/rede/placar', { params: { contrato, pagamento } })
    return data
  },
  async placas(f: FiltrosPlacas): Promise<{ carga: { atualizadoEm: string | null } | null; placas: PlacaLinha[] }> {
    const { data } = await api.get('/rede/placas', { params: f })
    return data
  },
  async sincronizar(body: {
    raizPowerId: number; raizNome: string; raizCpf: string; mesContrato: string; mesPagamento: string
  }): Promise<{ cargaId: string }> {
    const { data } = await api.post('/rede/sync', body)
    return data
  },
  async progresso(cargaId: string): Promise<CargaProgresso> {
    const { data } = await api.get(`/rede/sync/${cargaId}`)
    return data
  },
}
```

- [ ] **Step 3: Escrever os hooks**

Criar `frontend/src/hooks/useRede.ts`:

```ts
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { redeService, type FiltrosPlacas } from '../services/rede.service'

/** A arvore inteira vem de uma vez: sao 764 linhas do espelho, leitura barata. */
export function useArvoreRede() {
  return useQuery({
    queryKey: ['rede', 'arvore'],
    queryFn: () => redeService.arvore(),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function usePlacar(contrato: string, pagamento: string) {
  return useQuery({
    queryKey: ['rede', 'placar', contrato, pagamento],
    queryFn: () => redeService.placar(contrato, pagamento),
    staleTime: 5 * 60_000,
    retry: false,
  })
}

export function usePlacas(filtros: FiltrosPlacas, enabled = true) {
  return useQuery({
    queryKey: ['rede', 'placas', filtros],
    queryFn: () => redeService.placas(filtros),
    staleTime: 5 * 60_000,
    enabled,
    retry: false,
  })
}

export function useSincronizar() {
  return useMutation({
    mutationFn: redeService.sincronizar,
    onSuccess: () => toast.success('Sincronização iniciada. Você continua vendo os dados atuais até terminar.'),
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Não foi possível iniciar a sincronização.'),
  })
}

/** Enquanto a carga roda, pergunta o progresso a cada 10s. Para sozinho quando termina. */
export function useProgressoCarga(cargaId: string | null) {
  return useQuery({
    queryKey: ['rede', 'sync', cargaId],
    queryFn: () => redeService.progresso(cargaId!),
    enabled: !!cargaId,
    refetchInterval: (q: any) => (q.state.data?.status === 'rodando' ? 10_000 : false),
  })
}
```

- [ ] **Step 4: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/rede.service.ts frontend/src/hooks/useRede.ts frontend/package.json frontend/package-lock.json
git commit -m "feat(rede): service, tipos e hooks da tela Minha Rede"
```

---

## Task 12: Utilitários visuais e de formatação

**Files:**
- Create: `frontend/src/pages/rede/rede.utils.ts`
- Test: `frontend/src/pages/rede/rede.utils.test.ts`
- Create: `frontend/vitest.config.ts` (se ainda não existir)

**Interfaces:**
- Produces: `PAY_DEPTH`, `LEVEL_COLORS`, `levelColor(lvl)`, `levelTextColor(lvl)`, `soDigitos`, `waLink`, `dataPorExtenso`, `primeiroNome`, `mensagemLembrete`, `classeAtraso`, `formatarPlaca`, `paraCsv`, `baixarCsv`, `rotuloMes`, `ultimosMeses`. Usados pelas Tasks 13 a 17.

> **Correção obrigatória de acessibilidade** (seção F.3 do documento de UX): a escala `LEVEL_COLORS` hoje usa texto branco sobre a cor do nível, e a partir do N5 (`#7C9BD6`) o branco reprova WCAG AA — em N7 fica ilegível. `levelTextColor` resolve.

- [ ] **Step 1: Garantir que o Vitest roda no frontend**

Run: `cd frontend && ls vitest.config.ts 2>/dev/null || echo "criar"`

Se imprimir `criar`, criar `frontend/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
})
```

E acrescentar aos `scripts` de `frontend/package.json`:

```json
    "test": "vitest"
```

- [ ] **Step 2: Escrever o teste que falha**

Criar `frontend/src/pages/rede/rede.utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { levelTextColor, waLink, mensagemLembrete, dataPorExtenso, classeAtraso, paraCsv, ultimosMeses, rotuloMes } from './rede.utils'

describe('levelTextColor', () => {
  it('usa branco ate o N4 e azul escuro do N5 em diante, por contraste WCAG', () => {
    expect(levelTextColor(1)).toBe('#FFFFFF')
    expect(levelTextColor(4)).toBe('#FFFFFF')
    expect(levelTextColor(5)).toBe('#0C1228')
    expect(levelTextColor(7)).toBe('#0C1228')
  })
})

describe('waLink', () => {
  it('monta o link do WhatsApp com DDI 55 quando falta', () => {
    expect(waLink('(21) 99999-0000')).toBe('https://wa.me/5521999990000')
  })
  it('nao duplica o DDI quando ja veio', () => {
    expect(waLink('5521999990000')).toBe('https://wa.me/5521999990000')
  })
  it('devolve null quando o telefone e curto demais pra ser valido', () => {
    expect(waLink('9999')).toBeNull()
    expect(waLink(null)).toBeNull()
  })
})

describe('dataPorExtenso', () => {
  it('escreve a data por extenso, como manda o brand guide', () => {
    expect(dataPorExtenso('2026-06-15')).toBe('15 de junho')
  })
})

describe('mensagemLembrete', () => {
  it('usa enquadramento de cuidado, nao de cobranca, e cita placa e vencimento', () => {
    const m = mensagemLembrete('Maria Santos', 'Rodrigo Souza', 'ABC1D23', '2026-06-15')
    expect(m).toContain('Oi, Maria!')
    expect(m).toContain('Rodrigo Souza')
    expect(m).toContain('ABC1D23')
    expect(m).toContain('15 de junho')
    expect(m).toContain('manter sua proteção ativa')
    expect(m).not.toMatch(/cobran|dívida|inadimpl/i)
  })
})

describe('classeAtraso', () => {
  it('escala de temperatura: ate 14 neutro, 15 a 29 alerta, 30+ vermelho', () => {
    expect(classeAtraso(5)).toBe('text-dark-200')
    expect(classeAtraso(20)).toBe('badge-warning')
    expect(classeAtraso(32)).toBe('badge-danger')
  })
})

describe('paraCsv', () => {
  it('gera CSV com ponto e virgula e escapa aspas', () => {
    const csv = paraCsv([{ a: 'x"y', b: 1 }], [{ key: 'a', header: 'A' }, { key: 'b', header: 'B' }])
    expect(csv).toContain('"A";"B"')
    expect(csv).toContain('"x""y";"1"')
  })
})

describe('meses', () => {
  it('lista os ultimos meses do mais recente pro mais antigo', () => {
    expect(ultimosMeses(3, new Date(2026, 6, 22))).toEqual(['2026-07', '2026-06', '2026-05'])
  })
  it('rotula o mes por extenso', () => {
    expect(rotuloMes('2026-05')).toBe('Maio 2026')
  })
})
```

- [ ] **Step 3: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/rede/rede.utils.test.ts`
Expected: FAIL — módulo `./rede.utils` não encontrado.

- [ ] **Step 4: Implementar**

Criar `frontend/src/pages/rede/rede.utils.ts`:

```ts
/** Utilitarios da tela Minha Rede. Ver docs/superpowers/specs/2026-07-22-minha-rede-ux-recomendacoes.md */

/** Plano unilevel da 21Go: paga do nivel 1 ao 6. */
export const PAY_DEPTH = 6

/** Mesma escala do MyTeamView: o azul institucional clareia conforme desce. */
export const LEVEL_COLORS = ['#293C82', '#39519A', '#4A67B0', '#5E80C4', '#7C9BD6', '#9DB6E4', '#B9CBEC', '#CFDBF2']

export const levelColor = (lvl: number) => LEVEL_COLORS[Math.min(Math.max(lvl, 1) - 1, LEVEL_COLORS.length - 1)]

/**
 * Cor do texto sobre o chip do nivel.
 * A partir do N5 (#7C9BD6) o branco reprova WCAG AA — dai pra frente o texto vira azul escuro.
 */
export const levelTextColor = (lvl: number) => (lvl >= 5 ? '#0C1228' : '#FFFFFF')

export const soDigitos = (s?: string | null) => (s || '').replace(/\D/g, '')

export function waLink(telefone?: string | null): string | null {
  const d = soDigitos(telefone)
  if (d.length < 10) return null
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-06-15" -> "15 de junho". Datas por extenso, como manda o brand guide. */
export function dataPorExtenso(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-')
  return `${Number(dia)} de ${MESES[Number(mes) - 1]}`
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]

/**
 * Mensagem do botao "Lembrar".
 * Enquadramento de cuidado ("manter sua protecao ativa"), nunca de cobranca: converte mais
 * e nao queima o relacionamento do consultor com o associado.
 */
export function mensagemLembrete(associado: string, consultor: string, placa: string, vencimento: string): string {
  return `Oi, ${primeiroNome(associado)}! Aqui é o ${consultor}, da 21Go. `
    + `Vi que o boleto da placa ${placa} venceu no dia ${dataPorExtenso(vencimento)}. `
    + `Consegue regularizar pra manter sua proteção ativa? Qualquer dúvida me chama por aqui.`
}

/** Escala de temperatura do atraso: quanto mais velho, mais quente. */
export function classeAtraso(dias: number): string {
  if (dias >= 30) return 'badge-danger'
  if (dias >= 15) return 'badge-warning'
  return 'text-dark-200'
}

export const formatarPlaca = (p: string) => (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

export interface ColunaCsv<T> { key: keyof T & string; header: string }

/** CSV com ; e BOM — e o que o Excel em pt-BR abre sem perguntar nada. */
export function paraCsv<T extends Record<string, any>>(linhas: T[], colunas: ColunaCsv<T>[]): string {
  const cel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = colunas.map((c) => cel(c.header)).join(';')
  const body = linhas.map((l) => colunas.map((c) => cel(l[c.key])).join(';'))
  return '﻿' + [head, ...body].join('\r\n') + '\r\n'
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

/** "2026-05" -> "Maio 2026", pro seletor de ciclo. */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const nome = MESES[Number(m) - 1]
  return `${nome[0].toUpperCase()}${nome.slice(1)} ${ano}`
}

/** Ultimos N meses em YYYY-MM, do mais recente pro mais antigo. */
export function ultimosMeses(quantidade: number, base = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
```

- [ ] **Step 5: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/rede/rede.utils.test.ts`
Expected: PASS — 11 testes.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/pages/rede/rede.utils.ts frontend/src/pages/rede/rede.utils.test.ts frontend/vitest.config.ts frontend/package.json
git commit -m "feat(rede): utilitarios de cor acessivel, WhatsApp, datas e CSV"
```

---

## Task 13: Casca da página — cabeçalho persistente, abas e estados

**Files:**
- Create: `frontend/src/pages/rede/RedeEstados.tsx`
- Create: `frontend/src/pages/rede/RedeHeader.tsx`
- Create: `frontend/src/pages/rede/RedePage.tsx`

**Interfaces:**
- Consumes: `useArvoreRede`, `usePlacar` (Task 11); utilitários (Task 12)
- Produces:
  - `SkeletonRede`, `EstadoVazio({titulo, descricao, acao})`, `EstadoErro({onRecarregar})` — reusados nas Tasks 14 a 17
  - `RedeHeader(props)` — o placar persistente
  - `RedePage` — componente de rota, registrado na Task 18
  - **Contrato de estado:** aba, modo, ciclo, busca e filtros vivem na querystring (`useSearchParams`). Todos os componentes filhos recebem `params: URLSearchParams` e `setParam(chave, valor|null)`.

> **Seção B.1 do documento de UX.** Ordem de leitura: 1º o ponderado (é o salário dele), 2º o alerta de inadimplência (é o dinheiro na mesa), 3º o carimbo da carga (é a confiança no dado). Sem tilt 3D — é tela de trabalho diário, o efeito rouba atenção e custa performance.

- [ ] **Step 1: Escrever os estados reutilizáveis**

Criar `frontend/src/pages/rede/RedeEstados.tsx`:

```tsx
import type { ReactNode } from 'react'
import { UsersRound, RefreshCw, AlertTriangle } from 'lucide-react'

/** Skeleton comunica a estrutura que vem. Spinner sozinho em tela cheia, nunca. */
export function SkeletonRede() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="h-8 w-48 rounded-lg bg-dark-800 animate-shimmer" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="card h-24 animate-shimmer" />)}
      </div>
      <div className="card mt-5 p-0 overflow-hidden">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="h-14 border-b border-hairline animate-shimmer" />
        ))}
      </div>
    </div>
  )
}

export function EstadoVazio({ titulo, descricao, acao }: { titulo: string; descricao: string; acao?: ReactNode }) {
  return (
    <div className="card mt-5 p-12 text-center">
      <div className="mx-auto mb-4 grid place-items-center h-16 w-16 rounded-2xl bg-dark-700 border border-hairline">
        <UsersRound className="w-8 h-8 text-dark-400" />
      </div>
      <p className="text-dark-100 font-medium">{titulo}</p>
      <p className="text-dark-400 text-sm mt-1 max-w-sm mx-auto">{descricao}</p>
      {acao && <div className="mt-4">{acao}</div>}
    </div>
  )
}

export function EstadoErro({ onRecarregar }: { onRecarregar: () => void }) {
  return (
    <div className="card mt-5 p-12 text-center border-error/20">
      <AlertTriangle className="w-8 h-8 text-warning mx-auto mb-3" />
      <p className="text-dark-100 font-medium">Não conseguimos carregar sua rede.</p>
      <p className="text-dark-400 text-sm mt-1">Tente de novo em instantes.</p>
      <button onClick={onRecarregar} className="btn-secondary mt-4 inline-flex items-center gap-2">
        <RefreshCw className="w-4 h-4" /> Recarregar
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Escrever o cabeçalho persistente**

Criar `frontend/src/pages/rede/RedeHeader.tsx`:

```tsx
import { RefreshCw, AlertTriangle, Info } from 'lucide-react'
import type { Placar } from '../../services/rede.service'

interface Props {
  nome: string
  totalPessoas: number
  niveis: number
  ativas: number
  placar: Placar | undefined
  inadimplentes: number
  atualizadoEm: string | null
  isAdmin: boolean
  onSincronizar: () => void
  onVerInadimplentes: () => void
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

function carimbo(iso: string | null): string {
  if (!iso) return 'Sem sincronização ainda'
  const d = new Date(iso)
  const hora = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`
  return `Dados de ${d.getDate()} de ${MESES[d.getMonth()]}, ${hora}`
}

const SETE_DIAS = 7 * 24 * 60 * 60 * 1000

const TOOLTIP_PONDERADO =
  'Cada placa sua vale 1. Cada placa vendida pelo seu time, do nível 1 ao 6, vale 0,5. Só entram placas com boleto pago.'

export function RedeHeader(p: Props) {
  const velha = p.atualizadoEm ? Date.now() - new Date(p.atualizadoEm).getTime() > SETE_DIAS : false

  return (
    <header className="page-enter">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-white">Minha Rede</h1>
          <p className="text-sm text-dark-300 mt-0.5">
            {p.nome} · {p.totalPessoas} pessoas · {p.niveis} níveis · {p.ativas} ativas
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-dark-400">
          <span>{carimbo(p.atualizadoEm)}</span>
          {p.isAdmin && (
            <button onClick={p.onSincronizar} aria-label="Atualizar dados da rede" title="Atualizar dados da rede"
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30">
              <RefreshCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {velha && (
        <div className="badge-warning mt-3 flex items-center gap-2 w-fit">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>{`Estes números são de ${carimbo(p.atualizadoEm).replace('Dados de ', '').split(',')[0]}. O ciclo pode ter mudado desde então.`}</span>
          {p.isAdmin
            ? <button onClick={p.onSincronizar} className="underline underline-offset-2">Atualizar agora</button>
            : <span>Peça ao administrador para atualizar.</span>}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4 stagger-children">
        <div className="stat-card">
          <div className="stat-value font-mono tabular-nums">{p.placar?.proprias ?? '—'}</div>
          <div className="stat-label">SUAS · ×1,0</div>
        </div>
        <div className="stat-card">
          <div className="stat-value font-mono tabular-nums">{p.placar?.equipe ?? '—'}</div>
          <div className="stat-label">TIME · ×0,5</div>
        </div>
        <div className="stat-card card-blue" title={TOOLTIP_PONDERADO}>
          <div className="stat-value font-mono tabular-nums text-white flex items-center gap-1.5">
            {p.placar ? p.placar.ponderado.toLocaleString('pt-BR', { minimumFractionDigits: 1 }) : '—'}
            <Info className="w-3.5 h-3.5 opacity-60" aria-hidden />
          </div>
          <div className="stat-label text-white/70">PONDERADAS</div>
        </div>
        <button onClick={p.onVerInadimplentes}
          className="stat-card text-left hover:border-hairline-strong transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30">
          <div className="stat-value font-mono tabular-nums text-warning">{p.inadimplentes}</div>
          <div className="stat-label">BOLETO VENCIDO</div>
          <div className="text-[11px] text-dark-400 mt-1">Placas que só contam depois do pagamento</div>
          <span className="text-[11px] text-orange-400 font-medium">Ver quem lembrar →</span>
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 3: Escrever a página**

Criar `frontend/src/pages/rede/RedePage.tsx`:

```tsx
import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Network, Wallet } from 'lucide-react'
import { useAuthStore } from '../../store/auth-store'
import { useArvoreRede, usePlacar } from '../../hooks/useRede'
import { RedeHeader } from './RedeHeader'
import { SkeletonRede, EstadoVazio, EstadoErro } from './RedeEstados'
import { AbaRede } from './AbaRede'
import { AbaPagamento } from './AbaPagamento'
import { PainelSincronizacao } from './PainelSincronizacao'

/** Ciclo conferido com o cliente: contrato em maio, pagamento em junho. */
const CICLO_PADRAO = { contrato: '2026-05', pagamento: '2026-06' }

export type SetParam = (chave: string, valor: string | null) => void

/**
 * Minha Rede: a arvore do time e o controle de pagamento do ciclo.
 *
 * Todo o estado de navegacao (aba, modo, ciclo, busca, filtros) vive na querystring.
 * Trocar de aba nunca perde contexto — que e o defeito classico das telas de genealogia
 * de multinivel — e o Rodrigo pode mandar um link ja filtrado pra alguem.
 */
export function RedePage() {
  const me = useAuthStore((s) => s.user)
  const isAdmin = me?.role?.name === 'admin'
  const [params, setParams] = useSearchParams()

  const aba = params.get('aba') === 'pagamento' ? 'pagamento' : 'rede'
  const contrato = params.get('contrato') || CICLO_PADRAO.contrato
  const pagamento = params.get('pagamento') || CICLO_PADRAO.pagamento

  const setParam: SetParam = (chave, valor) => {
    const p = new URLSearchParams(params)
    if (valor === null || valor === '') p.delete(chave)
    else p.set(chave, valor)
    setParams(p, { replace: true })
  }

  const arvore = useArvoreRede()
  const placar = usePlacar(contrato, pagamento)

  const resumo = useMemo(() => {
    const membros = arvore.data?.membros ?? []
    const semRaiz = membros.filter((m) => m.nivelRaiz > 0)
    return {
      total: semRaiz.length,
      niveis: semRaiz.reduce((max, m) => Math.max(max, m.nivelRaiz), 0),
      ativas: semRaiz.filter((m) => m.status === 'ativo').length,
      inadimplentes: Object.values(arvore.data?.placasPorCpf ?? {}).reduce((s, v) => s + v.inadimplentes, 0),
    }
  }, [arvore.data])

  if (arvore.isLoading) {
    return <div data-theme="dark" className="min-h-full bg-dark-950"><SkeletonRede /></div>
  }

  if (arvore.isError) {
    const naoSincronizada = (arvore.error as any)?.response?.status === 404
    return (
      <div data-theme="dark" className="min-h-full bg-dark-950">
        <div className="p-6 max-w-7xl mx-auto">
          {naoSincronizada ? (
            <EstadoVazio
              titulo="Sua rede ainda não foi sincronizada."
              descricao={isAdmin
                ? 'Rode a primeira sincronização para trazer as pessoas e as placas do ciclo.'
                : 'Peça ao administrador para rodar a primeira sincronização.'}
            />
          ) : (
            <EstadoErro onRecarregar={() => arvore.refetch()} />
          )}
        </div>
      </div>
    )
  }

  const dados = arvore.data!
  const raiz = dados.membros.find((m) => m.nivelRaiz === 0)

  return (
    <div data-theme="dark" className="min-h-full bg-dark-950">
      <div className="p-6 max-w-7xl mx-auto">
        <RedeHeader
          nome={raiz?.nome ?? `${me?.firstName ?? ''} ${me?.lastName ?? ''}`.trim()}
          totalPessoas={resumo.total}
          niveis={resumo.niveis}
          ativas={resumo.ativas}
          placar={placar.data}
          inadimplentes={resumo.inadimplentes}
          atualizadoEm={dados.carga.atualizadoEm}
          isAdmin={isAdmin}
          onSincronizar={() => setParam('sync', '1')}
          onVerInadimplentes={() => {
            const p = new URLSearchParams(params)
            p.set('aba', 'pagamento')
            p.set('status', 'inadimplente')
            setParams(p, { replace: true })
          }}
        />

        {isAdmin && params.get('sync') === '1' && raiz && (
          <PainelSincronizacao raiz={raiz} contrato={contrato} pagamento={pagamento}
            onFechar={() => setParam('sync', null)} />
        )}

        <nav className="mt-5 inline-flex rounded-xl border border-hairline bg-dark-800 p-1" role="tablist"
          aria-label="Seções da Minha Rede">
          {([['rede', 'Rede', Network], ['pagamento', 'Pagamento', Wallet]] as const).map(([id, label, Icone]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setParam('aba', id)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
                aba === id ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'
              }`}>
              <Icone className="w-4 h-4" aria-hidden /> {label}
            </button>
          ))}
        </nav>

        {aba === 'rede'
          ? <AbaRede dados={dados} params={params} setParam={setParam} />
          : <AbaPagamento contrato={contrato} pagamento={pagamento} placar={placar.data}
              raizCpf={raiz?.cpf ?? ''} raizNome={raiz?.nome ?? ''} params={params} setParam={setParam} />}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

A tela ainda não compila — `AbaRede`, `AbaPagamento` e `PainelSincronizacao` chegam nas próximas tasks. Commitar assim mesmo mantém o histórico legível.

```bash
git add frontend/src/pages/rede/RedeEstados.tsx frontend/src/pages/rede/RedeHeader.tsx frontend/src/pages/rede/RedePage.tsx
git commit -m "feat(rede): casca da tela com placar persistente, abas e estados"
```

---

## Task 14: Aba Rede — modo Árvore

**Files:**
- Create: `frontend/src/pages/rede/AbaRede.tsx`
- Create: `frontend/src/pages/rede/ModoArvore.tsx`
- Create: `frontend/src/pages/rede/arvore.model.ts`
- Test: `frontend/src/pages/rede/arvore.model.test.ts`

**Interfaces:**
- Consumes: `ArvoreResponse`, `MembroRede`, `ResumoRamo` (Task 11); `levelColor`, `levelTextColor`, `waLink` (Task 12)
- Produces:
  - `arvore.model.ts`: `type NoArvore = { membro: MembroRede; filhos: NoArvore[] }`, `montarNos(membros, ramos): NoArvore[]`, `caminhosAteMatches(nos, termo): Set<number>`
  - `AbaRede({dados, params, setParam})` — o seletor de modo e a busca compartilhada
  - `ModoArvore({nos, ramos, placasPorCpf, busca, onAbrirPessoa})`

> **Seção B.2 do documento de UX.** Cinco mudanças sobre o `TeamTree.tsx` atual: filhos ordenados por placas do ramo (não por nome), placas na linha, corte de 30 filhos por nó com "mostrar mais", trilha sticky, e status legível (o `opacity: 0.5` atual torna bloqueado ilegível — e bloqueado ainda conta placa no ciclo). **"Expandir tudo" não existe nesta tela**: com 764 nós ele monta 5.000+ elementos e trava.

- [ ] **Step 1: Escrever o teste do modelo**

Criar `frontend/src/pages/rede/arvore.model.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { montarNos, caminhosAteMatches } from './arvore.model'
import type { MembroRede, ResumoRamo } from '../../services/rede.service'

const m = (powerId: number, nome: string, pai: number | null, nivel: number): MembroRede => ({
  id: String(powerId), powerId, cpf: `c${powerId}`, nome, nomeTratamento: nome,
  email: null, celular: null, funcao: null, cooperativa: null,
  patrocinadorPowerId: pai, nivelRaiz: nivel, caminho: nome, status: 'ativo',
})

const MEMBROS = [
  m(1, 'Rodrigo', null, 0),
  m(2, 'Ana', 1, 1),
  m(3, 'Bruno', 1, 1),
  m(4, 'Carla', 2, 2),
]

const ramos = (r: Record<number, number>): Record<number, ResumoRamo> =>
  Object.fromEntries(Object.entries(r).map(([k, v]) => [k, { proprias: 0, ramo: v, descendentes: 0 }]))

describe('montarNos', () => {
  it('aninha os filhos sob o patrocinador', () => {
    const nos = montarNos(MEMBROS, ramos({ 2: 0, 3: 0, 4: 0 }))
    expect(nos).toHaveLength(1)
    expect(nos[0].membro.nome).toBe('Rodrigo')
    expect(nos[0].filhos.map((f) => f.membro.nome).sort()).toEqual(['Ana', 'Bruno'])
    expect(nos[0].filhos.find((f) => f.membro.nome === 'Ana')!.filhos[0].membro.nome).toBe('Carla')
  })

  it('ordena os filhos por placas do ramo, decrescente — o ramo forte fica em cima', () => {
    const nos = montarNos(MEMBROS, ramos({ 2: 5, 3: 200, 4: 5 }))
    expect(nos[0].filhos.map((f) => f.membro.nome)).toEqual(['Bruno', 'Ana'])
  })

  it('desempata por nome quando o ramo tem o mesmo tamanho', () => {
    const nos = montarNos(MEMBROS, ramos({ 2: 7, 3: 7, 4: 0 }))
    expect(nos[0].filhos.map((f) => f.membro.nome)).toEqual(['Ana', 'Bruno'])
  })

  it('nao perde quem tem patrocinador fora da lista', () => {
    const orfao = [...MEMBROS, m(9, 'Orfao', 999, 1)]
    const nos = montarNos(orfao, ramos({}))
    const nomes = JSON.stringify(nos)
    expect(nomes).toContain('Orfao')
  })
})

describe('caminhosAteMatches', () => {
  it('devolve o match e todos os ancestrais dele, pra arvore abrir no caminho', () => {
    const nos = montarNos(MEMBROS, ramos({}))
    const manter = caminhosAteMatches(nos, 'carla')
    expect([...manter].sort()).toEqual([1, 2, 4])
  })

  it('acha por telefone tambem', () => {
    const comTel = MEMBROS.map((x) => (x.powerId === 3 ? { ...x, celular: '(21) 98888-1234' } : x))
    const nos = montarNos(comTel, ramos({}))
    expect([...caminhosAteMatches(nos, '988881234')].sort()).toEqual([1, 3])
  })

  it('termo vazio nao filtra nada', () => {
    const nos = montarNos(MEMBROS, ramos({}))
    expect(caminhosAteMatches(nos, '').size).toBe(0)
  })
})
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd frontend && npx vitest run src/pages/rede/arvore.model.test.ts`
Expected: FAIL — módulo `./arvore.model` não encontrado.

- [ ] **Step 3: Implementar o modelo**

Criar `frontend/src/pages/rede/arvore.model.ts`:

```ts
import type { MembroRede, ResumoRamo } from '../../services/rede.service'
import { soDigitos } from './rede.utils'

export interface NoArvore {
  membro: MembroRede
  filhos: NoArvore[]
}

/**
 * Aninha os membros sob o patrocinador e ordena cada nivel por placas do RAMO, decrescente.
 *
 * Ordenar por nome (como faz o TeamTree hoje) esconde exatamente o que importa: o direto
 * que produz. Empate volta pra ordem alfabetica.
 *
 * Quem tem patrocinador fora da lista sobe pra raiz em vez de sumir — dado ruim nao pode
 * apagar pessoa da tela.
 */
export function montarNos(membros: MembroRede[], ramos: Record<number, ResumoRamo>): NoArvore[] {
  const nos = new Map<number, NoArvore>()
  for (const m of membros) nos.set(m.powerId, { membro: m, filhos: [] })

  const raizes: NoArvore[] = []
  for (const m of membros) {
    const no = nos.get(m.powerId)!
    const pai = m.patrocinadorPowerId != null ? nos.get(m.patrocinadorPowerId) : undefined
    if (pai) pai.filhos.push(no)
    else raizes.push(no)
  }

  const ordenar = (lista: NoArvore[]) => {
    lista.sort((a, b) => {
      const ra = ramos[a.membro.powerId]?.ramo ?? 0
      const rb = ramos[b.membro.powerId]?.ramo ?? 0
      if (rb !== ra) return rb - ra
      return a.membro.nome.localeCompare(b.membro.nome, 'pt-BR')
    })
    for (const n of lista) ordenar(n.filhos)
  }
  ordenar(raizes)

  return raizes
}

/**
 * powerIds que devem continuar visiveis para um termo de busca: os que casam e todos os
 * ancestrais deles, pra arvore poder abrir no caminho ate a pessoa.
 */
export function caminhosAteMatches(nos: NoArvore[], termo: string): Set<number> {
  const manter = new Set<number>()
  const t = termo.trim().toLowerCase()
  if (!t) return manter
  const tDigitos = soDigitos(t)

  const casa = (m: MembroRede) =>
    m.nome.toLowerCase().includes(t) ||
    m.nomeTratamento.toLowerCase().includes(t) ||
    (m.email?.toLowerCase().includes(t) ?? false) ||
    (tDigitos.length >= 4 && soDigitos(m.celular).includes(tDigitos))

  const visitar = (no: NoArvore, ancestrais: number[]): boolean => {
    const filhosCasam = no.filhos.map((f) => visitar(f, [...ancestrais, no.membro.powerId])).some(Boolean)
    if (casa(no.membro) || filhosCasam) {
      manter.add(no.membro.powerId)
      for (const a of ancestrais) manter.add(a)
      return true
    }
    return false
  }

  for (const n of nos) visitar(n, [])
  return manter
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `cd frontend && npx vitest run src/pages/rede/arvore.model.test.ts`
Expected: PASS — 7 testes.

- [ ] **Step 5: Implementar o modo Árvore**

Criar `frontend/src/pages/rede/ModoArvore.tsx`:

```tsx
import { memo, useCallback, useState } from 'react'
import { ChevronRight, ChevronDown, MessageCircle, Phone } from 'lucide-react'
import type { MembroRede, ResumoRamo } from '../../services/rede.service'
import type { NoArvore } from './arvore.model'
import { levelColor, levelTextColor, waLink, soDigitos } from './rede.utils'

const FILHOS_POR_LOTE = 30 // corte de renderizacao: o DOM nunca passa de ~200 linhas

interface LinhaProps {
  no: NoArvore
  ramo: ResumoRamo | undefined
  aberto: boolean
  onAlternar: (powerId: number) => void
  onAbrirPessoa: (m: MembroRede) => void
  posicao: number
  total: number
}

const LinhaArvore = memo(function LinhaArvore({ no, ramo, aberto, onAlternar, onAbrirPessoa, posicao, total }: LinhaProps) {
  const m = no.membro
  const cor = levelColor(m.nivelRaiz)
  const wa = waLink(m.celular)
  const temFilhos = no.filhos.length > 0

  return (
    <div
      role="treeitem"
      aria-expanded={temFilhos ? aberto : undefined}
      aria-level={m.nivelRaiz}
      aria-posinset={posicao}
      aria-setsize={total}
      className="flex items-center gap-2 py-1.5 pr-2 rounded-lg hover:bg-dark-800/60 focus-visible:ring-2 focus-visible:ring-blue-500/30"
    >
      <button
        onClick={() => temFilhos && onAlternar(m.powerId)}
        aria-label={temFilhos ? (aberto ? `Recolher ${m.nome}` : `Expandir ${m.nome}`) : undefined}
        className={`shrink-0 grid place-items-center h-6 w-6 rounded-md ${temFilhos ? 'text-dark-300 hover:text-dark-50 hover:bg-dark-700' : 'opacity-0 pointer-events-none'}`}
      >
        {aberto ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      <span className="shrink-0 font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
        style={{ background: cor, color: levelTextColor(m.nivelRaiz) }}>
        N{m.nivelRaiz}
      </span>

      <button onClick={() => onAbrirPessoa(m)} className="min-w-0 flex-1 text-left">
        <span className="text-sm font-medium text-dark-50 truncate">{m.nome}</span>
      </button>

      <span className="shrink-0 font-mono tabular-nums text-[11px] text-dark-100">
        {ramo?.proprias ?? 0} {(ramo?.proprias ?? 0) === 1 ? 'placa' : 'placas'}
      </span>
      {temFilhos && (
        <span className="shrink-0 font-mono tabular-nums text-[11px] text-orange-400">
          · ramo {ramo?.ramo ?? 0}
        </span>
      )}
      {temFilhos && (
        <span className="shrink-0 font-mono text-[11px] text-dark-400">{no.filhos.length} diretos</span>
      )}

      <span className={`shrink-0 ${m.status === 'ativo' ? 'badge-success' : 'badge-danger'}`}>
        {m.status === 'ativo' ? <><span className="badge-dot" /> Ativo</> : 'Bloqueado'}
      </span>

      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" aria-label={`Chamar ${m.nome} no WhatsApp`}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
          <MessageCircle className="w-3.5 h-3.5" />
        </a>
      )}
      {m.celular && (
        <a href={`tel:${soDigitos(m.celular)}`} aria-label={`Ligar para ${m.nome}`}
          className="shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
          <Phone className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  )
})

interface RamoProps {
  nos: NoArvore[]
  ramos: Record<number, ResumoRamo>
  abertos: Set<number>
  manter: Set<number> | null
  onAlternar: (powerId: number) => void
  onAbrirPessoa: (m: MembroRede) => void
}

function Ramo({ nos, ramos, abertos, manter, onAlternar, onAbrirPessoa }: RamoProps) {
  const visiveis = manter ? nos.filter((n) => manter.has(n.membro.powerId)) : nos
  const [mostrar, setMostrar] = useState(FILHOS_POR_LOTE)
  const lote = visiveis.slice(0, mostrar)
  const restam = visiveis.length - lote.length

  return (
    <div role="group" className="pl-4 border-l border-hairline">
      {lote.map((no, i) => (
        <div key={no.membro.powerId}>
          <LinhaArvore
            no={no}
            ramo={ramos[no.membro.powerId]}
            aberto={abertos.has(no.membro.powerId) || !!manter}
            onAlternar={onAlternar}
            onAbrirPessoa={onAbrirPessoa}
            posicao={i + 1}
            total={visiveis.length}
          />
          {(abertos.has(no.membro.powerId) || !!manter) && no.filhos.length > 0 && (
            <Ramo nos={no.filhos} ramos={ramos} abertos={abertos} manter={manter}
              onAlternar={onAlternar} onAbrirPessoa={onAbrirPessoa} />
          )}
        </div>
      ))}
      {restam > 0 && (
        <button onClick={() => setMostrar((v) => v + FILHOS_POR_LOTE)}
          className="btn-ghost text-xs my-1">
          … mostrar mais {restam} {restam === 1 ? 'pessoa' : 'pessoas'}
        </button>
      )}
    </div>
  )
}

export function ModoArvore({
  nos, ramos, busca, onAbrirPessoa, manter,
}: {
  nos: NoArvore[]
  ramos: Record<number, ResumoRamo>
  busca: string
  manter: Set<number> | null
  onAbrirPessoa: (m: MembroRede) => void
}) {
  const [abertos, setAbertos] = useState<Set<number>>(new Set(nos.map((n) => n.membro.powerId)))

  const alternar = useCallback((powerId: number) => {
    setAbertos((atual) => {
      const novo = new Set(atual)
      if (novo.has(powerId)) novo.delete(powerId)
      else novo.add(powerId)
      return novo
    })
  }, [])

  if (manter && manter.size === 0) {
    return (
      <div className="card mt-4 p-12 text-center">
        <p className="text-dark-100 font-medium">Ninguém com esse nome, telefone ou placa na sua rede.</p>
      </div>
    )
  }

  return (
    <div className="card mt-4 overflow-x-auto" role="tree" aria-label="Árvore da sua rede">
      <Ramo nos={nos} ramos={ramos} abertos={abertos} manter={manter}
        onAlternar={alternar} onAbrirPessoa={onAbrirPessoa} />
      {busca && <p className="mt-3 text-xs text-dark-400">Mostrando os caminhos até quem casa com "{busca}".</p>}
    </div>
  )
}
```

- [ ] **Step 6: Implementar a Aba Rede (seletor de modo + busca compartilhada)**

Criar `frontend/src/pages/rede/AbaRede.tsx`:

```tsx
import { useMemo, useState, useEffect } from 'react'
import { Search, GitBranch, LayoutList, Table2 } from 'lucide-react'
import type { ArvoreResponse, MembroRede } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { montarNos, caminhosAteMatches } from './arvore.model'
import { ModoArvore } from './ModoArvore'
import { ModoNiveis } from './ModoNiveis'
import { ModoTabela } from './ModoTabela'
import { DrawerPessoa } from './DrawerPessoa'

type Modo = 'arvore' | 'niveis' | 'tabela'

export function AbaRede({ dados, params, setParam }: {
  dados: ArvoreResponse
  params: URLSearchParams
  setParam: SetParam
}) {
  const modo = (params.get('modo') as Modo) || 'arvore'
  const buscaUrl = params.get('busca') || ''
  const [busca, setBusca] = useState(buscaUrl)
  const [pessoa, setPessoa] = useState<MembroRede | null>(null)

  // Debounce de 200ms: sem isso a arvore recalcula o filtro a cada tecla, com 764 nos.
  useEffect(() => {
    const t = setTimeout(() => setParam('busca', busca || null), 200)
    return () => clearTimeout(t)
  }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps

  const nos = useMemo(() => montarNos(dados.membros, dados.ramos), [dados])
  const manter = useMemo(
    () => (buscaUrl ? caminhosAteMatches(nos, buscaUrl) : null),
    [nos, buscaUrl],
  )

  const MODOS: Array<[Modo, string, typeof GitBranch]> = [
    ['arvore', 'Árvore', GitBranch],
    ['niveis', 'Níveis', LayoutList],
    ['tabela', 'Tabela', Table2],
  ]

  return (
    <section className="page-enter">
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-xl border border-hairline bg-dark-800 p-1 self-start">
          {MODOS.map(([id, label, Icone]) => (
            <button key={id} onClick={() => setParam('modo', id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-all ${
                modo === id ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'
              }`}>
              <Icone className="w-4 h-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar na sua rede"
            placeholder="Buscar por nome, telefone ou placa…" className="input pl-10" />
        </div>
      </div>

      {modo === 'arvore' && (
        <ModoArvore nos={nos} ramos={dados.ramos} busca={buscaUrl} manter={manter}
          onAbrirPessoa={setPessoa} />
      )}
      {modo === 'niveis' && <ModoNiveis dados={dados} setParam={setParam} />}
      {modo === 'tabela' && (
        <ModoTabela dados={dados} params={params} setParam={setParam} onAbrirPessoa={setPessoa} />
      )}

      {pessoa && (
        <DrawerPessoa pessoa={pessoa} dados={dados} onFechar={() => setPessoa(null)}
          onVerPagamento={() => { setParam('aba', 'pagamento'); setParam('consultor', pessoa.cpf); setPessoa(null) }} />
      )}
    </section>
  )
}
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/pages/rede/arvore.model.ts frontend/src/pages/rede/arvore.model.test.ts frontend/src/pages/rede/ModoArvore.tsx frontend/src/pages/rede/AbaRede.tsx
git commit -m "feat(rede): modo arvore com ordem por ramo, corte por no e busca por caminho"
```

---

## Task 15: Modo Níveis e drawer da pessoa

**Files:**
- Create: `frontend/src/pages/rede/ModoNiveis.tsx`
- Create: `frontend/src/pages/rede/DrawerPessoa.tsx`

**Interfaces:**
- Consumes: `ArvoreResponse` (Task 11), `levelColor`/`levelTextColor`/`PAY_DEPTH`/`waLink` (Task 12), `SetParam` (Task 13)
- Produces: `ModoNiveis({dados, setParam})`, `DrawerPessoa({pessoa, dados, onFechar, onVerPagamento})` — ambos usados pelo `AbaRede` da Task 14.

> **Seção B.3 do documento de UX.** A decisão-chave: **a barra representa placas, não pessoas.** O gráfico de pessoas mostra onde a rede é grande; o de placas mostra onde ela produz — e a pergunta deste modo é sobre dinheiro. Pessoas viram rótulo numérico ao lado. Clicar na barra manda para a Tabela filtrada naquele nível.

- [ ] **Step 1: Implementar o modo Níveis**

Criar `frontend/src/pages/rede/ModoNiveis.tsx`:

```tsx
import { useMemo } from 'react'
import type { ArvoreResponse } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { levelColor, levelTextColor, PAY_DEPTH } from './rede.utils'

const TOOLTIP_N7 =
  'Fora do alcance: a partir do 7º nível as placas não entram na sua contagem. Elas aparecem aqui só para você ver que existem.'

export function ModoNiveis({ dados, setParam }: { dados: ArvoreResponse; setParam: SetParam }) {
  const linhas = useMemo(() => {
    const pessoasPorNivel: Record<number, number> = {}
    const placasPorNivel: Record<number, number> = {}
    let proprias = 0

    for (const m of dados.membros) {
      const placas = dados.placasPorCpf[m.cpf]?.pagas ?? 0
      if (m.nivelRaiz === 0) { proprias += placas; continue }
      pessoasPorNivel[m.nivelRaiz] = (pessoasPorNivel[m.nivelRaiz] || 0) + 1
      placasPorNivel[m.nivelRaiz] = (placasPorNivel[m.nivelRaiz] || 0) + placas
    }

    const niveis = Object.keys(pessoasPorNivel).map(Number).sort((a, b) => a - b)
    const maxPlacas = Math.max(1, ...niveis.map((n) => placasPorNivel[n] || 0))
    const ponderadoEquipe = niveis
      .filter((n) => n <= PAY_DEPTH)
      .reduce((s, n) => s + (placasPorNivel[n] || 0) * 0.5, 0)

    return {
      niveis,
      pessoasPorNivel,
      placasPorNivel,
      maxPlacas,
      proprias,
      total: proprias + ponderadoEquipe,
    }
  }, [dados])

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-dark-100">De onde vêm suas placas</h3>
        <span className="text-[11px] text-dark-400">Níveis 1–{PAY_DEPTH} contam · N{PAY_DEPTH + 1} fica fora</span>
      </div>

      <div className="space-y-1.5">
        {linhas.niveis.map((lvl) => {
          const placas = linhas.placasPorNivel[lvl] || 0
          const pessoas = linhas.pessoasPorNivel[lvl] || 0
          const paga = lvl <= PAY_DEPTH
          const largura = Math.max(4, (placas / linhas.maxPlacas) * 100)

          return (
            <div key={lvl}>
              {lvl === PAY_DEPTH + 1 && <div className="border-t border-dashed border-hairline my-2" />}
              <button
                onClick={() => { setParam('modo', 'tabela'); setParam('nivel', String(lvl)) }}
                title={paga ? undefined : TOOLTIP_N7}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-dark-700/50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
              >
                <span className="shrink-0 font-mono text-[11px] font-bold w-9 h-6 grid place-items-center rounded-md"
                  style={{ background: levelColor(lvl), color: levelTextColor(lvl) }}>
                  N{lvl}
                </span>
                <div className="flex-1 h-6 rounded-md bg-dark-700/60 overflow-hidden">
                  <div className="h-full rounded-md transition-all duration-500 ease-smooth"
                    style={{
                      width: `${largura}%`,
                      background: `linear-gradient(90deg, ${levelColor(lvl)}, ${levelColor(lvl)}bb)`,
                      opacity: paga ? 1 : 0.45,
                    }} />
                </div>
                <span className="shrink-0 font-mono text-[11px] text-dark-400 tabular-nums w-24 text-right">
                  {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}
                </span>
                <span className="shrink-0 font-mono text-sm font-bold text-dark-100 tabular-nums w-16 text-right">
                  {placas}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums w-28 text-right text-orange-400">
                  {paga
                    ? `→ ${(placas * 0.5).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}`
                    : 'fora do alcance'}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-hairline font-mono text-sm space-y-1">
        <p className="text-dark-300">
          Suas vendas próprias: <span className="text-dark-50">{linhas.proprias} placas × 1,0 = {linhas.proprias.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
        </p>
        <p className="text-dark-100 font-semibold">
          Total do ciclo: <span className="text-orange-400">{linhas.total.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} placas ponderadas</span>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implementar o drawer da pessoa**

Criar `frontend/src/pages/rede/DrawerPessoa.tsx`:

```tsx
import { X, MessageCircle, Phone, Mail, ArrowRight } from 'lucide-react'
import type { ArvoreResponse, MembroRede } from '../../services/rede.service'
import { levelColor, levelTextColor, waLink, soDigitos } from './rede.utils'

export function DrawerPessoa({ pessoa, dados, onFechar, onVerPagamento }: {
  pessoa: MembroRede
  dados: ArvoreResponse
  onFechar: () => void
  onVerPagamento: () => void
}) {
  const placas = dados.placasPorCpf[pessoa.cpf] ?? { pagas: 0, inadimplentes: 0 }
  const ramo = dados.ramos[pessoa.powerId]
  const wa = waLink(pessoa.celular)

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={`Detalhes de ${pessoa.nome}`}>
      <div className="absolute inset-0 bg-black/50" onClick={onFechar} />
      <aside className="drawer-panel relative w-full max-w-md h-full overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
              style={{ background: levelColor(pessoa.nivelRaiz), color: levelTextColor(pessoa.nivelRaiz) }}>
              N{pessoa.nivelRaiz}
            </span>
            <h2 className="mt-2 text-lg font-display font-bold text-white">{pessoa.nome}</h2>
            <p className="text-xs text-dark-400">{pessoa.funcao} · {pessoa.cooperativa}</p>
          </div>
          <button onClick={onFechar} aria-label="Fechar"
            className="shrink-0 h-8 w-8 grid place-items-center rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4">
          <span className={pessoa.status === 'ativo' ? 'badge-success' : 'badge-danger'}>
            {pessoa.status === 'ativo' ? 'Ativo no Power' : 'Bloqueado no Power'}
          </span>
        </div>

        <div className="mt-5">
          <p className="text-[11px] font-mono uppercase tracking-wider text-dark-400 mb-1">Linha completa</p>
          <p className="text-sm text-dark-200 break-words">{pessoa.caminho.replace(/ > /g, ' › ')}</p>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-5">
          {[
            ['Pagas', placas.pagas, 'text-dark-50'],
            ['Vencidas', placas.inadimplentes, 'text-warning'],
            ['Ramo', ramo?.ramo ?? 0, 'text-orange-400'],
          ].map(([rotulo, valor, cor]) => (
            <div key={rotulo as string} className="rounded-xl border border-hairline bg-dark-900/50 px-3 py-2.5 text-center">
              <div className={`font-mono text-xl font-bold tabular-nums ${cor}`}>{valor as number}</div>
              <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-dark-400">{rotulo as string}</div>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer"
              aria-label={`Chamar ${pessoa.nome} no WhatsApp`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
              <MessageCircle className="w-4 h-4" /> WhatsApp
            </a>
          )}
          {pessoa.celular && (
            <a href={`tel:${soDigitos(pessoa.celular)}`} aria-label={`Ligar para ${pessoa.nome}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
              <Phone className="w-4 h-4" /> {pessoa.celular}
            </a>
          )}
          {pessoa.email && (
            <a href={`mailto:${pessoa.email}`} aria-label={`Enviar e-mail para ${pessoa.nome}`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
              <Mail className="w-4 h-4" /> E-mail
            </a>
          )}
        </div>

        <button onClick={onVerPagamento} className="btn-secondary mt-6 w-full inline-flex items-center justify-center gap-2">
          Ver placas na aba Pagamento <ArrowRight className="w-4 h-4" />
        </button>
      </aside>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/rede/ModoNiveis.tsx frontend/src/pages/rede/DrawerPessoa.tsx
git commit -m "feat(rede): modo niveis por placas e drawer da pessoa"
```

---

## Task 16: Modo Tabela virtualizado

**Files:**
- Create: `frontend/src/pages/rede/ModoTabela.tsx`

**Interfaces:**
- Consumes: `@tanstack/react-virtual` (Task 11), `ArvoreResponse`, utilitários (Task 12), `SetParam` (Task 13)
- Produces: `ModoTabela({dados, params, setParam, onAbrirPessoa})` — usado pelo `AbaRede` da Task 14.

> **Seções B.4 e D.2 do documento de UX.** Virtualização com `@tanstack/react-virtual`, `overscan: 10`, linha de 56 px fixos (`.table-row` do `globals.css` já tem essa altura, então não precisa medir). Ordenação padrão por placas decrescente — produtores em cima, zeros no fim. O checkbox **"Só sem venda no ciclo"** é o filtro do "quem sumiu": ativo no Power, zero placa. É filtro dedicado porque é a pergunta nomeada do modo — não pode depender de o usuário descobrir "ordenar crescente".

- [ ] **Step 1: Implementar**

Criar `frontend/src/pages/rede/ModoTabela.tsx`:

```tsx
import { useMemo, useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Download, MessageCircle, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import type { ArvoreResponse, MembroRede } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { levelColor, levelTextColor, waLink, paraCsv, baixarCsv } from './rede.utils'

const ALTURA_LINHA = 56 // igual ao .table-row do globals.css

type Coluna = 'nome' | 'nivel' | 'placas' | 'ramo'

interface Linha {
  membro: MembroRede
  quemChamou: string
  placas: number
  vencidas: number
  ramo: number
}

export function ModoTabela({ dados, params, setParam, onAbrirPessoa }: {
  dados: ArvoreResponse
  params: URLSearchParams
  setParam: SetParam
  onAbrirPessoa: (m: MembroRede) => void
}) {
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: 'placas', asc: false })
  const nivelFiltro = params.get('nivel') ? Number(params.get('nivel')) : null
  const soSemVenda = params.get('semvenda') === '1'
  const busca = (params.get('busca') || '').trim().toLowerCase()
  const container = useRef<HTMLDivElement>(null)

  const linhas = useMemo<Linha[]>(() => {
    const nomePorPowerId = new Map(dados.membros.map((m) => [m.powerId, m.nome]))

    let out: Linha[] = dados.membros
      .filter((m) => m.nivelRaiz > 0)
      .map((m) => ({
        membro: m,
        quemChamou: m.patrocinadorPowerId ? (nomePorPowerId.get(m.patrocinadorPowerId) ?? '—') : '—',
        placas: dados.placasPorCpf[m.cpf]?.pagas ?? 0,
        vencidas: dados.placasPorCpf[m.cpf]?.inadimplentes ?? 0,
        ramo: dados.ramos[m.powerId]?.ramo ?? 0,
      }))

    if (nivelFiltro != null) out = out.filter((l) => l.membro.nivelRaiz === nivelFiltro)
    if (soSemVenda) out = out.filter((l) => l.placas === 0 && l.membro.status === 'ativo')
    if (busca) out = out.filter((l) => l.membro.nome.toLowerCase().includes(busca))

    const dir = ordem.asc ? 1 : -1
    out.sort((a, b) => {
      const cmp =
        ordem.col === 'nome' ? a.membro.nome.localeCompare(b.membro.nome, 'pt-BR')
        : ordem.col === 'nivel' ? a.membro.nivelRaiz - b.membro.nivelRaiz
        : ordem.col === 'ramo' ? a.ramo - b.ramo
        : a.placas - b.placas
      return cmp !== 0 ? cmp * dir : a.membro.nome.localeCompare(b.membro.nome, 'pt-BR')
    })

    return out
  }, [dados, nivelFiltro, soSemVenda, busca, ordem])

  const virtual = useVirtualizer({
    count: linhas.length,
    getScrollElement: () => container.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 10,
  })

  const ordenarPor = (col: Coluna) =>
    setOrdem((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === 'nome' }))

  const ariaSort = (col: Coluna): 'ascending' | 'descending' | 'none' =>
    ordem.col !== col ? 'none' : ordem.asc ? 'ascending' : 'descending'

  const exportar = () => {
    const csv = paraCsv(
      linhas.map((l) => ({
        nome: l.membro.nome, nivel: `N${l.membro.nivelRaiz}`, quemChamou: l.quemChamou,
        linha: l.membro.caminho, status: l.membro.status === 'ativo' ? 'Ativo' : 'Bloqueado',
        telefone: l.membro.celular ?? '', placas: l.placas, vencidas: l.vencidas, ramo: l.ramo,
      })),
      [
        { key: 'nome', header: 'Nome' }, { key: 'nivel', header: 'Nível' },
        { key: 'quemChamou', header: 'Quem chamou' }, { key: 'linha', header: 'Linha completa' },
        { key: 'status', header: 'Status' }, { key: 'telefone', header: 'Telefone' },
        { key: 'placas', header: 'Placas pagas' }, { key: 'vencidas', header: 'Boletos vencidos' },
        { key: 'ramo', header: 'Placas do ramo' },
      ],
    )
    baixarCsv('rede-pessoas.csv', csv)
    toast.success(`Arquivo exportado com ${linhas.length} pessoas.`)
  }

  const Cabecalho = ({ col, children }: { col: Coluna; children: React.ReactNode }) => (
    <th scope="col" aria-sort={ariaSort(col)}>
      <button onClick={() => ordenarPor(col)} className="inline-flex items-center gap-1 hover:text-dark-50">
        {children} <ArrowUpDown className="w-3 h-3 opacity-50" aria-hidden />
      </button>
    </th>
  )

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="inline-flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
          <input type="checkbox" checked={soSemVenda}
            onChange={(e) => setParam('semvenda', e.target.checked ? '1' : null)} />
          Só sem venda no ciclo
        </label>
        {nivelFiltro != null && (
          <button onClick={() => setParam('nivel', null)} className="badge-info">
            Nível {nivelFiltro} ×
          </button>
        )}
        <button onClick={exportar} className="btn-secondary ml-auto inline-flex items-center gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {linhas.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-dark-100 font-medium">
            {soSemVenda ? 'Todo mundo ativo vendeu neste ciclo.' : 'Ninguém com esse filtro na sua rede.'}
          </p>
          <button onClick={() => { setParam('busca', null); setParam('nivel', null); setParam('semvenda', null) }}
            className="btn-secondary mt-4">Limpar filtros</button>
        </div>
      ) : (
        <div className="table-container">
          <div ref={container} className="max-h-[65vh] overflow-auto">
            <table className="w-full">
              <thead className="table-header sticky top-0 z-10">
                <tr>
                  <Cabecalho col="nome">Nome</Cabecalho>
                  <Cabecalho col="nivel">Nível</Cabecalho>
                  <th scope="col">Quem chamou</th>
                  <th scope="col">Status</th>
                  <Cabecalho col="placas">Placas</Cabecalho>
                  <Cabecalho col="ramo">Ramo</Cabecalho>
                  <th scope="col">Contato</th>
                </tr>
              </thead>
              <tbody style={{ height: virtual.getTotalSize(), position: 'relative', display: 'block' }}>
                {virtual.getVirtualItems().map((item) => {
                  const l = linhas[item.index]
                  const wa = waLink(l.membro.celular)
                  return (
                    <tr key={l.membro.id} className="table-row"
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%',
                        height: ALTURA_LINHA, transform: `translateY(${item.start}px)`,
                        display: 'flex', alignItems: 'center',
                      }}>
                      <td className="flex-1 min-w-0">
                        <button onClick={() => onAbrirPessoa(l.membro)}
                          className="text-left text-sm font-medium text-dark-50 truncate hover:underline"
                          title={l.membro.caminho.replace(/ > /g, ' › ')}>
                          {l.membro.nome}
                        </button>
                      </td>
                      <td className="w-16">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: levelColor(l.membro.nivelRaiz), color: levelTextColor(l.membro.nivelRaiz) }}>
                          N{l.membro.nivelRaiz}
                        </span>
                      </td>
                      <td className="w-40 truncate text-sm text-dark-300">{l.quemChamou}</td>
                      <td className="w-28">
                        <span className={l.membro.status === 'ativo' ? 'badge-success' : 'badge-danger'}>
                          {l.membro.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="w-20 text-right font-mono tabular-nums text-sm text-dark-100">{l.placas}</td>
                      <td className="w-20 text-right font-mono tabular-nums text-sm text-orange-400">{l.ramo}</td>
                      <td className="w-16 text-right">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer"
                            aria-label={`Chamar ${l.membro.nome} no WhatsApp`}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-dark-500" title="Sem telefone no cadastro do Power">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-dark-400">
        Mostrando {linhas.length} de {dados.membros.length - 1} pessoas · ordenado por {
          { nome: 'nome', nivel: 'nível', placas: 'placas do ciclo', ramo: 'placas do ramo' }[ordem.col]
        }
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Verificar tipos**

Run: `cd frontend && npm run type-check`
Expected: erros apenas nos imports de `AbaPagamento` e `PainelSincronizacao`, que ainda não existem.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/rede/ModoTabela.tsx
git commit -m "feat(rede): modo tabela virtualizado com ordenacao e filtro de quem sumiu"
```

---

## Task 17: Aba Pagamento

**Files:**
- Create: `frontend/src/pages/rede/AbaPagamento.tsx`
- Create: `frontend/src/pages/rede/TabelaPlacas.tsx`

**Interfaces:**
- Consumes: `usePlacas` (Task 11); `classeAtraso`, `mensagemLembrete`, `waLink`, `paraCsv`, `baixarCsv`, `rotuloMes`, `ultimosMeses`, `levelColor`, `levelTextColor` (Task 12); `SetParam` (Task 13)
- Produces: `AbaPagamento({contrato, pagamento, placar, raizCpf, raizNome, params, setParam})`, usado pelo `RedePage` da Task 13; e `TabelaPlacas({placas, modo, raizCpf, raizNome})`.

> **Seção B.5 do documento de UX.** Ordem de leitura: 1º o placar com a conta explicada, 2º o segmentador Pagas/Vencidos **com contadores** (empilhar 609 linhas enterrava a lista que gera ação), 3º a lista. Placa em `font-mono` (o brand guide reserva a mono para placas). Vendas próprias marcadas como `Você` em laranja — é a distinção 1,0 × 0,5 encarnada na linha. Atraso com escala de temperatura e ordenação decrescente: quem está pior no topo. Botão **"Lembrar"**, nunca "Cobrar".

- [ ] **Step 1: Implementar a tabela de placas**

Criar `frontend/src/pages/rede/TabelaPlacas.tsx`:

```tsx
import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { MessageCircle } from 'lucide-react'
import type { PlacaLinha } from '../../services/rede.service'
import { classeAtraso, mensagemLembrete, waLink, levelColor, levelTextColor, dataPorExtenso } from './rede.utils'

const ALTURA_LINHA = 56

export function TabelaPlacas({ placas, modo, raizCpf, raizNome }: {
  placas: PlacaLinha[]
  modo: 'paga' | 'inadimplente'
  raizCpf: string
  raizNome: string
}) {
  const container = useRef<HTMLDivElement>(null)
  const virtual = useVirtualizer({
    count: placas.length,
    getScrollElement: () => container.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 10,
  })

  const linkLembrete = (p: PlacaLinha) => {
    const base = waLink(p.telefoneAssociado)
    if (!base || !p.dataVencimento) return null
    const texto = mensagemLembrete(p.associado, p.consultor || raizNome, p.placa, p.dataVencimento)
    return `${base}?text=${encodeURIComponent(texto)}`
  }

  return (
    <div className="table-container mt-3">
      <div ref={container} className="max-h-[60vh] overflow-auto">
        <table className="w-full">
          <thead className="table-header sticky top-0 z-10">
            <tr>
              <th scope="col" className="w-28">Placa</th>
              <th scope="col">Associado</th>
              <th scope="col" className="w-40">Telefone</th>
              <th scope="col" className="w-48">Vendedor</th>
              {modo === 'inadimplente'
                ? <><th scope="col" className="w-28 text-right">Atraso</th><th scope="col" className="w-24 text-right">Ação</th></>
                : <><th scope="col" className="w-32 text-right">Paga em</th><th scope="col" className="w-28 text-right">Valor</th></>}
            </tr>
          </thead>
          <tbody style={{ height: virtual.getTotalSize(), position: 'relative', display: 'block' }}>
            {virtual.getVirtualItems().map((item) => {
              const p = placas[item.index]
              const ehMinha = p.cpfConsultor === raizCpf
              const wa = linkLembrete(p)
              return (
                <tr key={p.id} className="table-row"
                  style={{
                    position: 'absolute', top: 0, left: 0, width: '100%',
                    height: ALTURA_LINHA, transform: `translateY(${item.start}px)`,
                    display: 'flex', alignItems: 'center',
                  }}>
                  <td className="w-28 font-mono text-sm text-dark-50 tracking-wide">{p.placa}</td>
                  <td className="flex-1 min-w-0 truncate text-sm text-dark-100">{p.associado}</td>
                  <td className="w-40 font-mono text-xs text-dark-300 tabular-nums">
                    {p.telefoneAssociado || <span className="text-dark-500" title="Sem telefone no cadastro">—</span>}
                  </td>
                  <td className="w-48 truncate text-sm">
                    {ehMinha
                      ? <span className="text-orange-400 font-semibold">Você</span>
                      : (
                        <span className="text-dark-300">
                          {p.consultor}
                          {p.nivel != null && p.nivel > 0 && (
                            <span className="ml-1.5 font-mono text-[10px] font-bold px-1 py-0.5 rounded"
                              style={{ background: levelColor(p.nivel), color: levelTextColor(p.nivel) }}>
                              N{p.nivel}
                            </span>
                          )}
                        </span>
                      )}
                  </td>
                  {modo === 'inadimplente' ? (
                    <>
                      <td className="w-28 text-right">
                        <span className={`font-mono tabular-nums text-sm ${classeAtraso(p.diasAtraso ?? 0)}`}>
                          {p.diasAtraso ?? 0} dias
                        </span>
                      </td>
                      <td className="w-24 text-right">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer"
                            aria-label={`Lembrar ${p.associado} pelo WhatsApp sobre a placa ${p.placa}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                            <MessageCircle className="w-3.5 h-3.5" /> Lembrar
                          </a>
                        ) : <span className="text-dark-500">—</span>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="w-32 text-right text-sm text-dark-300">
                        {p.dataPagamento ? dataPorExtenso(p.dataPagamento) : '—'}
                      </td>
                      <td className="w-28 text-right font-mono tabular-nums text-sm text-dark-100">
                        {p.valor != null ? p.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}
                      </td>
                    </>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Implementar a aba**

Criar `frontend/src/pages/rede/AbaPagamento.tsx`:

```tsx
import { useMemo, useState, useEffect } from 'react'
import { Search, Download, Info } from 'lucide-react'
import { toast } from 'sonner'
import type { Placar } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { usePlacas } from '../../hooks/useRede'
import { TabelaPlacas } from './TabelaPlacas'
import { SkeletonRede } from './RedeEstados'
import { paraCsv, baixarCsv, rotuloMes, ultimosMeses } from './rede.utils'

const NOTA_METODO =
  'Contamos toda placa com contrato no mês escolhido e boleto pago no mês seguinte, direto do SGA. '
  + 'Placa sem pagamento confirmado não entra. Por isso o número pode diferir de contagens feitas à mão.'

export function AbaPagamento({ contrato, pagamento, placar, raizCpf, raizNome, params, setParam }: {
  contrato: string
  pagamento: string
  placar: Placar | undefined
  raizCpf: string
  raizNome: string
  params: URLSearchParams
  setParam: SetParam
}) {
  const status = (params.get('status') as 'paga' | 'inadimplente') || 'paga'
  const escopo = (params.get('escopo') as 'proprias' | 'equipe' | 'tudo') || 'tudo'
  const consultor = params.get('consultor') || undefined
  const buscaUrl = params.get('q') || ''
  const [busca, setBusca] = useState(buscaUrl)
  const [verNota, setVerNota] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setParam('q', busca || null), 200)
    return () => clearTimeout(t)
  }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps

  const pagas = usePlacas({ contrato, pagamento, status: 'paga', escopo, consultor, busca: buscaUrl })
  const vencidas = usePlacas({ contrato, status: 'inadimplente', escopo, consultor, busca: buscaUrl })

  const lista = useMemo(() => {
    const bruto = (status === 'paga' ? pagas.data?.placas : vencidas.data?.placas) ?? []
    if (status !== 'inadimplente') return bruto
    return [...bruto].sort((a, b) => (b.diasAtraso ?? 0) - (a.diasAtraso ?? 0))
  }, [status, pagas.data, vencidas.data])

  const meses = ultimosMeses(14)

  const exportar = () => {
    const csv = status === 'inadimplente'
      ? paraCsv(
          lista.map((p) => ({ placa: p.placa, associado: p.associado, telefone: p.telefoneAssociado ?? '',
            vendedor: p.cpfConsultor === raizCpf ? 'Você' : p.consultor, nivel: p.nivel ?? '',
            vencimento: p.dataVencimento ?? '', atraso: p.diasAtraso ?? '' })),
          [{ key: 'placa', header: 'Placa' }, { key: 'associado', header: 'Associado' },
           { key: 'telefone', header: 'Telefone' }, { key: 'vendedor', header: 'Vendedor' },
           { key: 'nivel', header: 'Nível' }, { key: 'vencimento', header: 'Vencimento' },
           { key: 'atraso', header: 'Dias de atraso' }],
        )
      : paraCsv(
          lista.map((p) => ({ placa: p.placa, associado: p.associado, telefone: p.telefoneAssociado ?? '',
            vendedor: p.cpfConsultor === raizCpf ? 'Você' : p.consultor, nivel: p.nivel ?? '',
            pagamento: p.dataPagamento ?? '', valor: p.valor ?? '' })),
          [{ key: 'placa', header: 'Placa' }, { key: 'associado', header: 'Associado' },
           { key: 'telefone', header: 'Telefone' }, { key: 'vendedor', header: 'Vendedor' },
           { key: 'nivel', header: 'Nível' }, { key: 'pagamento', header: 'Pago em' },
           { key: 'valor', header: 'Valor' }],
        )
    const nome = `rede-${status === 'paga' ? 'pagas' : 'inadimplentes'}-${contrato}_${pagamento}.csv`
    baixarCsv(nome, csv)
    toast.success(`Arquivo exportado com ${lista.length} placas.`)
  }

  const carregando = status === 'paga' ? pagas.isLoading : vencidas.isLoading

  return (
    <section className="page-enter">
      <div className="mt-4 flex items-center gap-2 flex-wrap text-sm">
        <label className="text-dark-400">Contrato em</label>
        <select value={contrato} onChange={(e) => setParam('contrato', e.target.value)} className="input w-auto py-1.5">
          {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
        <span className="text-dark-500">→</span>
        <label className="text-dark-400">Pagamento em</label>
        <select value={pagamento} onChange={(e) => setParam('pagamento', e.target.value)} className="input w-auto py-1.5">
          {meses.map((m) => <option key={m} value={m}>{rotuloMes(m)}</option>)}
        </select>
      </div>

      <div className="card mt-4">
        <h3 className="text-[11px] font-mono uppercase tracking-wider text-dark-400">Como fechou o ciclo</h3>
        <div className="mt-3 font-mono text-sm space-y-1 tabular-nums">
          <p className="text-dark-200">
            <span className="inline-block w-16 text-right">{placar?.proprias ?? 0}</span> placas suas
            <span className="text-dark-500"> × 1,0 = </span>
            <span className="text-dark-50">{(placar?.proprias ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
          </p>
          <p className="text-dark-200">
            <span className="inline-block w-16 text-right">{placar?.equipe ?? 0}</span> placas do time (N1–N6)
            <span className="text-dark-500"> × 0,5 = </span>
            <span className="text-dark-50">{((placar?.equipe ?? 0) * 0.5).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
          </p>
          <div className="border-t border-hairline my-2" />
          <p className="text-dark-100 font-semibold">
            <span className="inline-block w-16 text-right">{placar?.bruto ?? 0}</span> placas contadas
            <span className="text-dark-500"> → </span>
            <span className="text-orange-400">{(placar?.ponderado ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: 1 })} ponderadas</span>
          </p>
        </div>
        <button onClick={() => setVerNota((v) => !v)}
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] text-dark-400 hover:text-dark-200">
          <Info className="w-3.5 h-3.5" /> Como contamos
          {(placar?.foraDoAlcance ?? 0) > 0 && ` · ${placar!.foraDoAlcance} placa(s) de N7 fora do alcance`}
        </button>
        {verNota && <p className="mt-2 text-xs text-dark-400 max-w-2xl">{NOTA_METODO}</p>}
      </div>

      <div className="mt-4 inline-flex rounded-xl border border-hairline bg-dark-800 p-1" role="tablist">
        {([['paga', 'Pagas', pagas.data?.placas.length], ['inadimplente', 'Boleto vencido', vencidas.data?.placas.length]] as const).map(([id, label, n]) => (
          <button key={id} role="tab" aria-selected={status === id} onClick={() => setParam('status', id)}
            className={`px-4 py-1.5 rounded-lg text-sm transition-all ${
              status === id ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'
            }`}>
            {label} · {n ?? '—'}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar placas" placeholder="Buscar por placa, associado ou telefone…" className="input pl-10" />
        </div>
        <div className="inline-flex rounded-xl border border-hairline bg-dark-800 p-1 self-start">
          {([['proprias', 'Minhas'], ['equipe', 'Do time'], ['tudo', 'Tudo']] as const).map(([id, label]) => (
            <button key={id} onClick={() => setParam('escopo', id)}
              className={`px-3 py-1.5 rounded-lg text-sm transition-all ${
                escopo === id ? 'bg-blue-500 text-white font-semibold' : 'text-dark-300 hover:text-dark-50 font-medium'
              }`}>{label}</button>
          ))}
        </div>
        <button onClick={exportar} className="btn-secondary inline-flex items-center gap-2 self-start">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {consultor && (
        <button onClick={() => setParam('consultor', null)} className="badge-info mt-3">
          Consultor filtrado ×
        </button>
      )}

      {carregando ? <SkeletonRede /> : lista.length === 0 ? (
        <div className="card mt-4 p-12 text-center">
          <p className="text-dark-100 font-medium">
            {status === 'inadimplente'
              ? 'Nenhum boleto vencido neste ciclo. Seu time está em dia.'
              : 'Nenhuma placa paga neste ciclo ainda. Os boletos pagos aparecem aqui assim que o SGA confirma.'}
          </p>
          {(buscaUrl || consultor) && (
            <button onClick={() => { setBusca(''); setParam('q', null); setParam('consultor', null) }}
              className="btn-secondary mt-4">Limpar busca</button>
          )}
        </div>
      ) : (
        <>
          <TabelaPlacas placas={lista} modo={status} raizCpf={raizCpf} raizNome={raizNome} />
          <p className="mt-3 text-xs text-dark-400">{lista.length} placas · filtro aplicado</p>
        </>
      )}
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/rede/AbaPagamento.tsx frontend/src/pages/rede/TabelaPlacas.tsx
git commit -m "feat(rede): aba pagamento com placar explicado, pagas e inadimplentes"
```

---

## Task 18: Painel de sincronização, rota e menu

**Files:**
- Create: `frontend/src/pages/rede/PainelSincronizacao.tsx`
- Modify: `frontend/src/Router.tsx`
- Modify: `frontend/src/components/layouts/AppLayout.tsx:44-48` (seção "Associados" do menu)

**Interfaces:**
- Consumes: `useSincronizar`, `useProgressoCarga` (Task 11), `MembroRede` (Task 11)
- Produces: `PainelSincronizacao({raiz, contrato, pagamento, onFechar})`, usado pelo `RedePage` da Task 13; e a rota `/rede`.

> **Seção E.6 do documento de UX.** Enquanto a carga roda, a tela continua servindo a carga publicada — o painel diz isso explicitamente, para o admin não achar que quebrou.

- [ ] **Step 1: Implementar o painel**

Criar `frontend/src/pages/rede/PainelSincronizacao.tsx`:

```tsx
import { useState } from 'react'
import { X, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import type { MembroRede } from '../../services/rede.service'
import { useSincronizar, useProgressoCarga } from '../../hooks/useRede'

const ETAPAS: Record<string, string> = {
  rede: 'etapa 1 de 3 (pessoas do Power)',
  placas: 'etapa 2 de 3 (placas do SGA)',
  boletos: 'etapa 3 de 3 (boletos do SGA)',
  publicando: 'publicando',
  fim: 'concluída',
}

export function PainelSincronizacao({ raiz, contrato, pagamento, onFechar }: {
  raiz: MembroRede
  contrato: string
  pagamento: string
  onFechar: () => void
}) {
  const [cargaId, setCargaId] = useState<string | null>(null)
  const sincronizar = useSincronizar()
  const progresso = useProgressoCarga(cargaId)

  const rodando = progresso.data?.status === 'rodando'

  return (
    <div className="card mt-4 border-blue-500/20">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-dark-100">Atualizar dados da rede</h3>
          <p className="text-xs text-dark-400 mt-0.5">
            Traz as pessoas do Power e as placas do SGA. Leva cerca de 30 minutos.
          </p>
        </div>
        <button onClick={onFechar} aria-label="Fechar painel"
          className="h-8 w-8 grid place-items-center rounded-lg border border-hairline text-dark-300 hover:text-dark-50 hover:bg-dark-700">
          <X className="w-4 h-4" />
        </button>
      </div>

      {progresso.data?.status === 'falhou' && (
        <div className="badge-warning mt-3 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            A sincronização parou na etapa {progresso.data.etapa}. Os dados anteriores continuam valendo.
            Motivo: {progresso.data.erro}
          </span>
        </div>
      )}

      {progresso.data?.status === 'publicada' && (
        <div className="badge-success mt-3 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" />
          Sincronização concluída. Recarregue a página para ver os números novos.
        </div>
      )}

      {rodando && (
        <div className="mt-3">
          <div className="badge-info flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            Sincronização em andamento — {ETAPAS[progresso.data!.etapa] ?? progresso.data!.etapa}.
            Você continua vendo os dados atuais até terminar.
          </div>
          <div className="mini-progress mt-2">
            <div className="mini-progress-track">
              <div className="mini-progress-fill"
                style={{ width: `${({ rede: 33, placas: 66, boletos: 90, publicando: 98, fim: 100 } as Record<string, number>)[progresso.data!.etapa] ?? 10}%` }} />
            </div>
          </div>
        </div>
      )}

      <button
        disabled={rodando || sincronizar.isPending}
        onClick={() => sincronizar.mutate(
          { raizPowerId: raiz.powerId, raizNome: raiz.nome, raizCpf: raiz.cpf, mesContrato: contrato, mesPagamento: pagamento },
          { onSuccess: (r) => setCargaId(r.cargaId) },
        )}
        className="btn-primary mt-4 inline-flex items-center gap-2 disabled:opacity-50"
      >
        <RefreshCw className="w-4 h-4" />
        {rodando ? 'Sincronizando…' : progresso.data?.status === 'falhou' ? 'Tentar de novo' : 'Sincronizar agora'}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Registrar a rota**

Em `frontend/src/Router.tsx`, acrescentar o import junto dos outros:

```tsx
import { RedePage } from './pages/rede/RedePage'
```

E a rota, dentro do bloco de rotas protegidas com `AppLayout`, logo depois da linha de `/associados`:

```tsx
          <Route path="/rede" element={<RedePage />} />
```

- [ ] **Step 3: Colocar no menu**

Em `frontend/src/components/layouts/AppLayout.tsx`, na seção `'Associados'`, logo abaixo do item `/equipe`, acrescentar:

```tsx
      { path: '/rede', icon: Network, label: 'Minha Rede', roles: ['admin', 'vendedor'] },
```

E acrescentar `Network` ao import de `lucide-react` no topo do arquivo.

- [ ] **Step 4: Subir o frontend e conferir**

Run: `cd frontend && npm run type-check && npm run build`
Expected: type-check limpo e build concluído.

Run: `cd frontend && npm run dev` e abrir `http://localhost:5173/rede`
Expected: a tela carrega. Sem carga publicada, mostra "Sua rede ainda não foi sincronizada."

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/rede/PainelSincronizacao.tsx frontend/src/Router.tsx frontend/src/components/layouts/AppLayout.tsx
git commit -m "feat(rede): painel de sincronizacao, rota /rede e item no menu"
```

---

# FASE C — Carga real e produção

## Task 19: Migration em produção e primeira carga conferida

**Files:**
- Nenhum arquivo de código. Esta task é operação sobre o banco e a API de produção.

**Interfaces:**
- Consumes: migration da Task 1, endpoint de sync da Task 9
- Produces: uma carga publicada para `raizPowerId = 100280`, conferida contra a tabela de verificação do topo deste plano.

> **REGRA 0 do projeto: produção nunca pode cair.** Conferir o baseline antes de tocar em qualquer coisa, e conferir de novo depois. A migration é aditiva (`CREATE TABLE IF NOT EXISTS`), então não altera nenhuma tabela existente.

- [ ] **Step 1: Baseline de produção antes de qualquer coisa**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://crm21go.site/login`
Expected: `200`. Se não for 200, **parar** e restaurar antes de seguir.

- [ ] **Step 2: Aplicar a DDL em produção**

Rodar o conteúdo de `backend/prisma/migrations/20260722_rede_multinivel/migration.sql` no SQL Editor do Supabase do projeto, ou via `$executeRawUnsafe` no container do backend. É idempotente: rodar duas vezes não quebra.

Conferir:

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('rede_cargas','rede_consultores','rede_placas');
```
Expected: 3 linhas.

- [ ] **Step 3: Vincular o Rodrigo ao usuário do CRM**

A raiz só é encontrada pelo `user_id`. Descobrir o id do usuário do login `rodrigo@gmail.com`:

```sql
SELECT id, email, role FROM users WHERE email = 'rodrigo@gmail.com';
```

Guardar esse id. Ele será gravado em `rede_consultores.user_id` da linha de nível 0 logo após a primeira carga:

```sql
UPDATE rede_consultores
   SET user_id = '<id-do-usuario>'
 WHERE nivel_raiz = 0 AND raiz_power_id = 100280;
```

- [ ] **Step 4: Colar o Bearer do Power e as credenciais do SGA no ambiente de produção**

O Bearer do painel do Power expira em ~10h: pegar um token fresco fazendo login em `app.powercrm.com.br` e copiando o header `authorization` de qualquer requisição. Setar `POWER_APP_BEARER`, `HINOVA_SGA_USUARIO`, `HINOVA_SGA_SENHA`, `HINOVA_SGA_TOKEN` nas variáveis do serviço e redeployar.

- [ ] **Step 5: Disparar a carga**

Logado como admin no CRM, abrir `/rede?sync=1` e clicar em "Sincronizar agora" com contrato `2026-05` e pagamento `2026-06`.

Acompanhar pelo painel. Expected: etapa 1 (~20 min), etapa 2 (~10 min), etapa 3 (~5 min), publicando.

- [ ] **Step 6: Conferir a carga contra os números conhecidos**

```sql
SELECT totais FROM rede_cargas WHERE publicada = true AND raiz_power_id = 100280;
```

Conferir contra a tabela de verificação do topo deste plano:

| Campo em `totais` | Esperado |
|---|---:|
| `pessoas` | 764 |
| `porNivel.1` | 25 |
| `porNivel.2` | 126 |
| `porNivel.3` | 245 |
| `porNivel.4` | 256 |
| `porNivel.5` | 98 |
| `porNivel.6` | 12 |
| `porNivel.7` | 2 |

E o placar:

```sql
SELECT count(*) FILTER (WHERE status='paga') AS pagas,
       count(*) FILTER (WHERE status='inadimplente') AS vencidas
  FROM rede_placas
 WHERE carga_id = (SELECT id FROM rede_cargas WHERE publicada AND raiz_power_id=100280)
   AND mes_contrato='2026-05';
```
Expected: `pagas` = 609 (a conferência manual do cliente deu 603; a diferença de 6 são pessoas que a lista manual não pegou).

**Se algum número divergir, não seguir para o Step 7.** Investigar primeiro: número errado nesta tela vira desconfiança no sistema inteiro.

- [ ] **Step 7: Conferir com o acesso do Rodrigo**

Logar como `rodrigo@gmail.com` e abrir `/rede`.

Conferir na tela:
- cabeçalho mostra `764 pessoas · 7 níveis · 682 ativas`
- placar mostra `40` / `569` / `324,5`
- modo Árvore abre com 25 diretos, ordenados por placas do ramo
- aba Pagamento → Pagas mostra 609 linhas com placa, associado e telefone
- aba Pagamento → Boleto vencido mostra a lista com dias de atraso e botão Lembrar
- o botão de sincronizar **não aparece** (ele não é admin)

- [ ] **Step 8: Verificação obrigatória de produção**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://crm21go.site/login`
Expected: `200`.

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://myiphone.online`
Expected: `200`.

---

## Task 20: Deploy

**Files:**
- Nenhum arquivo novo.

- [ ] **Step 1: Rodar tudo antes de subir**

Run: `cd backend && npm run type-check && npx vitest run && cd ../frontend && npm run type-check && npx vitest run && npm run build`
Expected: tudo verde. Se algo falhar, **não subir**.

- [ ] **Step 2: Subir a branch**

```bash
git push -u origin HEAD
```

- [ ] **Step 3: Deploy**

O CRM roda em Easypanel (Docker Swarm) no servidor `167.71.31.77`, sem webhook do GitHub. Deploy manual via SSH:

```bash
ssh -i ~/.ssh/claude_21go root@167.71.31.77 \
  'cd /etc/easypanel/projects/social-21go/crm-21go/code && git pull && docker build -t easypanel/social-21go/crm-21go:latest . && docker service update --force --image easypanel/social-21go/crm-21go:latest social-21go_crm-21go'
```

- [ ] **Step 4: Verificar que subiu (não presumir)**

Run: `curl -s -o /dev/null -w "%{http_code}\n" https://crm21go.site/login`
Expected: `200`.

Conferir o commit servido:

```bash
ssh -i ~/.ssh/claude_21go root@167.71.31.77 \
  'cid=$(docker ps -q -f name=social-21go_crm-21go | head -1); docker exec $cid sh -c "echo \$GIT_SHA"'
```
Expected: o SHA do commit que você acabou de subir.

- [ ] **Step 5: Abrir a tela em produção**

Abrir `https://crm21go.site/rede` logado como o Rodrigo e repetir as conferências do Step 7 da Task 19.

---

# Self-review do plano

**Cobertura do spec.** Cada seção do spec tem task correspondente:

| Requisito do spec | Task |
|---|---|
| Tabelas espelho com `company_id` | 1 |
| Regra unilevel 1,0 / 0,5 até N6 | 2 |
| Base = 764, navegação por `managerIds`, trava anti-ciclo, bloqueados incluídos | 3, 5 |
| Somente leitura no Power e no SGA | 4 |
| Armadilhas da API (página ≠ offset, 500/página, 31 dias, dia a dia, situações 1..8) | 5, 6 |
| Inadimplente = boleto vencido e não pago, com dias de atraso | 6, 7 |
| Cruzamento por `codigo_veiculo`, descarte de placa sem CPF | 7 |
| Staging + publicação atômica, falhou não publica | 7 |
| Escopo de acesso (consultor vê a própria, admin vê qualquer uma) | 9 |
| Placas do ramo | 10 |
| Três modos de visualização | 14, 15, 16 |
| Aba Pagamento com placa, associado, telefone | 17 |
| Filtros completos e exportação CSV | 16, 17 |
| Carimbo da carga e aviso de dado velho | 13 |
| Tabela de verificação conferida | 19 |

**Consistência de tipos.** `MembroRede`, `PlacaContada`, `Placar` e `ResumoRamo` são definidos nas Tasks 2 e 10 (backend) e espelhados na Task 11 (frontend) com os mesmos nomes de campo. `calcularPlacar` recebe `Map<string, number>` em ambos os pontos de uso. `SetParam` é definido na Task 13 e consumido nas 14 a 18. `ALTURA_LINHA = 56` aparece nas Tasks 16 e 17 com o mesmo valor, casando com `.table-row` do `globals.css`.

**Riscos conhecidos, registrados de propósito:**

1. **O usuário contestou a base de 764.** A decisão está registrada no spec com as três provas. Se ele reabrir a discussão, o número muda em um lugar só (o `raizPowerId` e o conjunto coletado), e a Task 19 é o ponto onde isso aparece antes de virar tela.
2. **Token do Power colado à mão.** É o ponto frágil da operação, e é por isso que o job noturno foi descartado. Se um dia houver login programático no Power, o agendamento vira viável sem mudar mais nada.
3. **`GET /api/rede/arvore` devolve 764 registros num payload só.** Medido: ~300 KB de JSON. Aceitável, e é o que permite a tela responder instantaneamente. Se a rede crescer muito além disso, paginar por nível é a saída — não antes.
