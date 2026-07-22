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

O primeiro time a rodar é o de **Rodrigo Souza de Lima** (id 100280 no Power CRM,
voluntário 115 no SGA), pelo login `rodrigo@gmail.com` criado no CRM.

Trabalho anterior relevante: o projeto **21 GO - CONTROLE DE ACESSO** já apurou esse
mesmo recorte manualmente e documentou o caminho em `docs/GUIA-ACHAR-TIME-E-PAGAMENTOS.md`
e `docs/RELATORIO-PLACAS-POR-TIME-SGA.md`. Este spec parte dali, corrige o que estava
frágil e automatiza o que era manual.

## O que é uma placa contada

**Contrato no mês X + pagamento no mês Y.** A placa entra quando o boleto dela foi pago.
Contratou e não pagou, não conta.

Três precisões que mudam o número:

1. **A data é a do veículo, não a do associado.** Em proteção veicular cada placa é um
   contrato. Um associado de 2024 que põe placa nova em maio conta como venda de maio.
   Usar `data_contrato_associado` erra em ~26% (447 em vez de 602).
2. **Todas as situações (1..8), não só a ativa.** Placa vendida em maio pode estar
   cancelada hoje e ainda assim foi venda de maio. Só a situação 1 perde ~20%.
3. **O cruzamento é por `codigo_veiculo`**, a chave que aparece nos dois lados (no
   veículo e dentro do boleto). Nunca por placa nem por nome do cliente.

## Decisões

### A rede vem do Power CRM, por ID do gerente

O usuário confirmou: **gerente = quem chamou**. A hierarquia do Power é a própria rede de
comissionamento, não uma estrutura de gestão paralela.

A navegação é pelo filtro `managerIds` do endpoint `POST /company/userListFilter` — o mesmo
que alimenta a tela Minha Empresa → Usuários. Descendo nível a nível por id, com trava
anti-ciclo, e **incluindo bloqueados** (quem está bloqueado hoje vendeu no mês apurado).

Não montar por nome: `responsibleUser` guarda o **nome de tratamento** (`name`), não o
`fullName` — Rodrigo Souza de Lima aparece como "Rodrigo Souza". Foi isso que fazia
`timeArvore.js` e `vendasTime.js` devolverem downline vazia para ele, e é por isso que o
arquivo `vendas_time_rodrigo_souza_junho.csv` (479 vendas, 111 vendedores) **não é o time
dele** e não deve ser usado como referência.

### O casamento entre Power e SGA é por CPF

`POST /listar/veiculo` devolve `cpf_voluntario` em cada veículo; o painel do Power devolve
`registration`. Casar por CPF elimina homônimo e apelido, e dispensa a tabela de aliases
mantida à mão nos scripts antigos.

Casar por nome não serve para valor financeiro: na apuração anterior 165 de 173 bateram
(95%) e **um casou com a pessoa errada** — um "Leonardo da Cruz Ferreira" entrou no lugar
de um "Leonardo da Cruz Gonçalves".

### A rede é dado espelhado, não usuário do CRM

Os membros do time não viram registros em `users`. Eles não logam, não têm email próprio
garantido, e criá-los poluiria a gestão de acessos. A rede vira tabela espelho; o vínculo
com o CRM acontece só na raiz.

### Escopo: o time do Rodrigo

3.331 consultores existem no Power. Sincronizamos apenas a downline do Rodrigo e ele
próprio. A estrutura suporta outros líderes depois, mas nada é importado antes de alguém
pedir.

### A placa entra pelo SGA, nunca por marcação manual

Se o SGA não reconhece o pagamento, a placa não conta. O CRM não oferece botão de "marcar
como pago" para esta contagem.

## Divergência conhecida: 173 × 764

A apuração anterior usou uma lista de **173 pessoas** (`scratch_time_oficial.txt`), montada
à mão filtrando o painel nome por nome. A navegação por id via API devolve **764**.

| | Lista manual (21/07) | Árvore por ID (22/07) |
|---|---|---|
| Diretos (N1) | 22 | 25 |
| Total | 173 | 764 |
| Níveis | 4 | 7 |

A explicação mais provável é que a coleta manual parou cedo: já no N1 faltam 3 pessoas, e
cada uma carrega a sub-rede inteira abaixo dela.

**O impacto no resultado é pequeno**, e isso é o mais importante: as placas de maio do time
dão **853** pela árvore de 764, contra **840** apuradas com a lista de 173. Diferença de 13
placas (1,5%). Os 607 membros a mais quase não vendem — a produção vem essencialmente das
mesmas pessoas. Os dois caminhos se confirmam mutuamente.

## Arquitetura

### Camada 1 — Coleta (projeto `21 GO - SGA HINOVA`, offline)

```
Power CRM  ──managerIds──►  time_por_id_<lider>.json   (764 pessoas: id, nível, CPF)
                                        │
SGA /listar/veiculo ──►  placas_contrato_<mes>.json    (4.061 placas de maio + cpf_voluntario)
                                        │  cruza por CPF (consultor)
SGA /listar/boleto-associado/periodo ──► boletos_pagos_<mes>.json  (placas quitadas)
                                        │  cruza por codigo_veiculo (placa)
                                        ▼
                              placas_<lider>_<mes>_<mes>.{json,csv}
```

Scripts (todos somente leitura, com checkpoint retomável):

| Script | Função |
|---|---|
| `src/timePorId.js` | monta a cascata por id do gerente, com trava anti-ciclo |
| `src/placasContratoMes.js` | placas contratadas no mês, situações 1..8, dia a dia |
| `src/boletosPagosPeriodo.js` | placas com pagamento no período |
| `src/redePlacas.js` | cruza tudo e aplica a regra unilevel |
| `src/timeMultinivel.js` | versão por nome — mantida só para conferência |
| `src/varrerVoluntarios.js` | mapa CPF → código/adesões do SGA, por varredura de códigos |

Regra do cálculo, por consultor:

```
placas_ponderadas = próprias × 1,0 + Σ (placas de cada membro em N1..N6) × 0,5
```

O nível é relativo: quem é N2 do Rodrigo é N1 de quem o chamou.

### Armadilhas da API do SGA (custaram números errados)

- **`inicio_paginacao` é o NÚMERO DA PÁGINA, não o offset.** Passar `pagina * 500` devolve
  erro ou nada. Conferido: página 1 traz registros novos, offset 500 dá 406.
- **500 por página.** Com 3.000 a resposta estoura a memória.
- **Boletos: período máximo de 31 dias.** Um mês por execução.
- **Uma chamada por vez.** Concorrência satura a API e começa a falhar.
- **`data_contrato` do `/listar/veiculo` filtra por dia exato** — varrer dia a dia sai
  muito mais barato que paginar a base inteira.
- **Endpoints que *listam* voluntários exigem permissão de cooperativa** que o login atual
  não tem (`/listar/voluntario/:situacao`, `/listar/voluntario-por-data-cadastro`,
  `/buscar/voluntario/:cpfOuCodigo` → 406). Já
  `GET /listar/situacao-adesao-voluntario/:codigo` e `POST /listar/placas-por-voluntario/`
  respondem normalmente. Como `/listar/veiculo` já traz `cpf_voluntario`, a varredura de
  voluntários deixou de ser necessária para este cálculo.

### Camada 2 — Banco (Supabase)

Duas tabelas novas, ambas com `company_id` (multi-tenant, regra do projeto):

`rede_consultores` — uma linha por pessoa da rede
: `id`, `company_id`, `power_id`, `cpf`, `nome`, `nome_tratamento`, `codigo_voluntario`,
  `patrocinador_power_id`, `nivel_raiz`, `raiz_cpf`, `status`, `user_id` (nulo, exceto na
  raiz), `sincronizado_em`.

`rede_placas` — uma linha por placa contabilizada
: `id`, `company_id`, `cpf_consultor`, `codigo_veiculo`, `placa`, `associado`,
  `data_contrato`, `data_pagamento`, `mes_referencia`, `valor`, `situacao`,
  `sincronizado_em`.

Migration **aditiva** (`CREATE TABLE IF NOT EXISTS`), via DDL explícita — nunca
`drizzle-kit push` nem seed contra produção.

### Camada 3 — API

`GET /api/rede/minha?contrato=YYYY-MM&pagamento=YYYY-MM`

Resolve o consultor raiz pelo `user_id` do token, monta a subárvore por CTE recursiva sobre
`rede_consultores` e devolve:

```json
{
  "raiz": { "nome": "...", "codigoVoluntario": 115 },
  "placar": { "proprias": 0, "equipe": 0, "ponderado": 0, "consultoresProduzindo": 0 },
  "porNivel": [{ "nivel": 1, "pessoas": 25, "placas": 0 }],
  "membros": [{ "nome": "...", "nivel": 2, "placas": 0 }]
}
```

Escopo de acesso: o consultor vê a própria rede; admin vê qualquer uma.

### Camada 4 — Tela

`MyTeamView.tsx` já tem a árvore, a cor por nível e a constante `PAY_DEPTH = 6`. Acrescenta:

- Cabeçalho com o placar: **próprias**, **meia-placa do time**, **total ponderado**.
- Coluna de placas em cada card de membro.
- Marcação do corte no N6 (N7+ esmaecido, legenda "fora do alcance").
- Indicação de quantas placas foram contratadas e **não** pagas no mês — é o dinheiro que
  está na mesa e depende de cobrança.

## Tratamento de erro

- **Consultor sem placa** — entra na rede com 0. É o caso de quem não vendeu, e é correto.
- **Placa sem CPF de voluntário** — fica fora do cálculo e é reportada na contagem de
  descartes, nunca somada a alguém por aproximação.
- **Coleta interrompida** — checkpoint por dia/página permite retomar sem refazer.
- **Token do painel Power expirado (~10h)** — a sincronização falha pedindo renovação; não
  usa dump velho fingindo que está fresco.
- **Divergência com a apuração manual** — o script reporta a diferença em vez de publicar
  o número silenciosamente.

## Verificação

| Prova | Esperado | Fonte independente |
|---|---|---|
| Placas de maio na base | ~4.058 | apuração manual anterior (obtido: 4.061) |
| Placas de maio do time | ~840 | apuração manual (obtido: 853 pela árvore por id) |
| Contrato maio + pago junho | ~602 | conferência manual do cliente: 603 |
| Consultores com ≥1 placa | ~117 | apuração manual |
| Rodrigo: placas ativas | 681 | duas rotas do SGA |
| Nenhum N7+ no ponderado | 0 | regra do plano |

## Fora de escopo

- Cálculo de valor em reais da comissão (a entrega é em placas).
- Sincronização automática agendada — a primeira carga é manual e conferida.
- Rede dos outros consultores fora do time do Rodrigo.
- Qualquer escrita no SGA ou no Power CRM. Ambos são somente leitura.

## Links relacionados

- `21 GO - CONTROLE DE ACESSO/docs/GUIA-ACHAR-TIME-E-PAGAMENTOS.md`
- `21 GO - CONTROLE DE ACESSO/docs/RELATORIO-PLACAS-POR-TIME-SGA.md`
- `21 GO - SGA HINOVA/docs/BASE-CONHECIMENTO-SGA.md`
- [[MEMORIA-21Go]]
