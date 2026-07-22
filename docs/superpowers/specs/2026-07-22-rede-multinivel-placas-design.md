---
data: 2026-07-22
projeto: 21Go CRM
tags: [rede, multinivel, unilevel, placas, sga, hinova, power-crm]
tipo: decisão
---

# Rede multinível e contagem de placas — Minha Rede

## Contexto

A 21Go remunera consultores por um plano **unilevel**: cada consultor conta 100% do que
vende e 50% do que a equipe vende, do nível 1 ao nível 6. A partir do 7º nível não há
ganho. Cada dono conta os seis níveis a partir de si mesmo, então o corte desce em
diagonal — quem está mais abaixo alcança mais fundo que quem está acima.

Na unidade de medida do negócio isso vira **placa**: uma venda própria vale 1 placa, uma
venda da equipe vale 0,5 placa. Duas vendas da equipe equivalem a uma placa própria.

Hoje esse número não existe em lugar nenhum. O CRM tem a árvore de time (`users.manager_id`
com CTE recursiva) mas nenhuma contagem; o projeto `21 GO - SGA HINOVA` tem os relatórios de
placas mas nenhuma noção de nível; e os scripts de rede que existem estavam devolvendo
downline vazia por um bug de casamento de nome.

O primeiro time a rodar é o de **Rodrigo Souza de Lima** (voluntário SGA 115), pelo login
`rodrigo@gmail.com` criado no CRM.

## Descobertas que sustentam o desenho

### 1. O campo de patrocínio do Power CRM guarda o nome de tratamento

`responsibleUser` contém o `name` (nome de tratamento), não o `fullName`. Rodrigo Souza de
Lima aparece como `"Rodrigo Souza"`. Os scripts `timeArvore.js` e `vendasTime.js` casavam
contra `fullName` e por isso devolviam 0 diretos para ele — quando na verdade são 25.

Consequência: o arquivo `vendas_time_rodrigo_souza_junho.csv` (479 vendas, 111 vendedores)
**não é o time do Rodrigo** e não deve ser usado como referência.

### 2. Casar por nome é frágil; casar por CPF é exato

A base do Power tem 56 nomes de tratamento duplicados (115 pessoas). "ALEXANDRE" identifica
5 pessoas distintas. Um BFS por nome cola sub-redes que não se relacionam: 86 das 765
pessoas da downline do Rodrigo entram por um nó ambíguo.

O SGA expõe o CPF do voluntário e o Power expõe o CPF do consultor (`registration`).
**O CPF é a chave de casamento.** Elimina homônimo e apelido de uma vez, e dispensa a
tabela de aliases que os scripts antigos mantinham à mão.

### 3. Os endpoints que listam voluntários estão bloqueados; o por código não está

| Endpoint | Resultado |
|---|---|
| `GET /listar/voluntario/:situacao` | 406 — "Usuário não possui permissão em nenhuma cooperativa" |
| `POST /listar/voluntario-por-data-cadastro` | 406 — mesma permissão (com data em DD/MM/YYYY) |
| `GET /buscar/voluntario/:cpfOuCodigo` | 406 — "Parâmetros Inválidos" |
| `GET /listar/situacao-adesao-voluntario/:codigo` | **200** — nome, CPF, e todas as adesões |
| `POST /listar/placas-por-voluntario/` | **200** — placas por código (`participa_fechamento` = Y/N) |

O caminho viável é varrer `situacao-adesao-voluntario` por código. A faixa útil vai de 1 a
~1999 (2000 em diante retorna 406). Cada resposta traz `codigo_voluntario`,
`nome_voluntario`, `cpf_voluntario`, `quantidade_adesoes` e a lista de adesões com veículo,
situação e data de adesão — tudo em uma chamada, sem depender da permissão de cooperativa.

### 4. Números de referência do Rodrigo (vol. 115)

- 681 placas ativas (participam do fechamento) e 349 canceladas/inativas — 1030 adesões.
- 373 associados com boleto pago em junho.
- Downline no Power: 765 pessoas em 7 níveis (N1=25, N2=126, N3=245, N4=256, N5=99, N6=12,
  N7=2); 679 por vínculo confiável; 684 ativas.
- Junho, casando por nome (cobertura parcial): 15 placas próprias + 507 da downline N1–N6,
  com 122 consultores do time produzindo.

O dono do negócio estima **~602 placas e ~172 consultores produzindo em junho**. A diferença
para os 522/122 acima é exatamente o que o casamento por nome perde, e é o que a passagem
para CPF precisa recuperar. **Esse é o critério de aceite do cálculo.**

## Decisões

### A rede é dado espelhado, não usuário do CRM

Os 765 membros do time não viram registros em `users`. Eles não logam, não têm email
próprio garantido, e criá-los poluiria a gestão de acessos e a tabela de autenticação.

A rede vira uma tabela espelho, sincronizada a partir do Power CRM + SGA. O vínculo com o
CRM acontece só na raiz: o usuário `rodrigo@gmail.com` aponta para o voluntário 115.

### O escopo é o time do Rodrigo, não a base inteira

3.331 consultores existem no Power. Sincronizamos apenas a downline do Rodrigo e ele
próprio — 766 registros. A estrutura suporta outros líderes depois, mas nada é importado
antes de alguém pedir.

### A placa entra pelo SGA, nunca por marcação manual

A fonte de verdade é a adesão no SGA. O CRM não oferece botão de "marcar como pago" para
esta contagem — se o SGA não reconhece, a placa não conta.

### Período de apuração: mês fechado

O placar mostra um mês por vez (primeiro alvo: junho/2026), pela `data_adesao` da placa.
Carteira acumulada fica de fora desta entrega.

## Arquitetura

### Camada 1 — Coleta (projeto `21 GO - SGA HINOVA`, offline)

```
usuarios_power_<data>.json ──┐
  (árvore, CPF, nome)        ├──► casamento por CPF ──► rede_rodrigo.json
voluntarios_sga.json ────────┘                          (766 pessoas, nível,
  (código, CPF, adesões)                                 código SGA, placas do mês)
```

Scripts:
- `src/timeMultinivel.js` — monta a cascata a partir de um líder, corrigindo o casamento
  para `name` e marcando cada vínculo como `confiavel` ou `ambiguo`. **Já existe.**
- `src/varrerVoluntarios.js` — varre `situacao-adesao-voluntario` 1..1999 com retomada por
  checkpoint e faixas paralelas. **Já existe.**
- `src/redePlacas.js` — casa por CPF, aplica a regra unilevel, exporta JSON + Excel. **A criar.**

Regra do cálculo, por consultor:

```
placas_ponderadas = próprias × 1,0 + Σ (placas de cada membro em N1..N6) × 0,5
```

Cada consultor calcula os seis níveis a partir de si mesmo. O nível é relativo: quem é N2 do
Rodrigo é N1 de quem o chamou.

### Camada 2 — Banco (Supabase)

Duas tabelas novas, ambas com `company_id` (multi-tenant, regra do projeto):

`rede_consultores` — uma linha por pessoa da rede
: `id`, `company_id`, `cpf`, `nome`, `nome_tratamento`, `codigo_voluntario`,
  `patrocinador_cpf`, `nivel_raiz` (nível em relação à raiz sincronizada),
  `raiz_cpf`, `status`, `vinculo` (`confiavel` | `ambiguo`), `user_id` (nulo, exceto na raiz),
  `sincronizado_em`.

`rede_placas` — uma linha por placa contabilizada
: `id`, `company_id`, `cpf_consultor`, `codigo_veiculo`, `placa`, `situacao`,
  `data_adesao`, `mes_referencia`, `sincronizado_em`.

A migration é **aditiva** (`CREATE TABLE IF NOT EXISTS`), aplicada via DDL explícita —
nunca `drizzle-kit push` nem seed contra produção.

### Camada 3 — API

`GET /api/rede/minha?mes=YYYY-MM`

Resolve o consultor raiz pelo `user_id` do token, monta a subárvore por CTE recursiva sobre
`rede_consultores` e devolve:

```json
{
  "raiz": { "nome": "...", "codigoVoluntario": 115, "placasProprias": 15 },
  "placar": { "proprias": 15, "equipe": 507, "ponderado": 268.5, "mes": "2026-06" },
  "porNivel": [{ "nivel": 1, "pessoas": 25, "placas": 93, "produzindo": 12 }],
  "membros": [{ "nome": "...", "nivel": 2, "placas": 3, "vinculo": "confiavel" }]
}
```

Escopo de acesso segue a regra vigente: o consultor vê a própria rede; admin vê qualquer uma.

### Camada 4 — Tela

`MyTeamView.tsx` já tem a árvore, a cor por nível e a constante `PAY_DEPTH = 6`. Acrescenta:

- Cabeçalho com o placar do mês: **próprias**, **meia-placa do time**, **total ponderado**.
- Coluna de placas em cada card de membro.
- Marcação visual do corte no N6 (N7+ aparece esmaecido, com legenda "fora do alcance").
- Aviso discreto nos membros com `vinculo = ambiguo`, para o consultor saber que aquele
  ramo veio de um nome duplicado e pode não ser dele.

## Tratamento de erro

- **Voluntário sem CPF no SGA** — cai para casamento por nome e é marcado como `ambiguo`.
  Nunca é descartado em silêncio.
- **Consultor do Power sem voluntário correspondente** — entra na rede com 0 placas. É o
  caso de quem nunca vendeu, e é o comportamento correto.
- **Varredura interrompida** — o checkpoint por faixa permite retomar sem refazer.
- **Token do painel Power expirado (~10h)** — a sincronização falha explicitamente pedindo
  renovação; não usa dump velho fingindo que está fresco.
- **Divergência com o esperado** — se o total de junho ficar longe de ~602 placas / ~172
  consultores, o script reporta a diferença em vez de publicar o número.

## Verificação

1. Rodrigo tem 25 diretos e 765 na downline (7 níveis) — confere com `timeMultinivel.js`.
2. Rodrigo tem 681 placas ativas e 1030 adesões — confere com o SGA em duas rotas
   independentes (`placas-por-voluntario` e `situacao-adesao-voluntario`).
3. Junho fecha em ~602 placas brutas e ~172 consultores produzindo.
4. Nenhum membro em N7+ entra no ponderado.
5. A tela do login `rodrigo@gmail.com` mostra a rede dele e só a dele.

## Fora de escopo

- Cálculo de valor em reais da comissão (a entrega é em placas).
- Sincronização automática agendada — a primeira carga é manual e conferida.
- Rede dos outros 3.331 consultores.
- Carteira acumulada (só mês fechado).
- Qualquer escrita no SGA ou no Power CRM. Ambos são somente leitura.

## Links relacionados

- `21 GO - SGA HINOVA/docs/BASE-CONHECIMENTO-SGA.md`
- `21 GO - SGA HINOVA/docs/rede-multinivel.pdf`
- [[MEMORIA-21Go]]
