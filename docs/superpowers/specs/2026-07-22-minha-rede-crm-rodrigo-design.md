---
data: 2026-07-22
projeto: 21Go CRM
tags: [rede, multinivel, unilevel, placas, inadimplencia, power-crm, sga, ux]
tipo: decisão
---

# Minha Rede no CRM — árvore do time e controle de pagamento (acesso do Rodrigo)

## Contexto

O consultor **Rodrigo Souza de Lima** (Power CRM id 100280, CPF 151.837.367-40, login
`rodrigo@gmail.com` no CRM) precisa enxergar dentro do CRM duas coisas que hoje só existem
espalhadas entre o painel do Power e a API do SGA:

1. **A base dele** — todo mundo que ele chamou, direta ou indiretamente, com quem chamou
   quem, quem está ativo e quem está bloqueado.
2. **O controle de pagamento** — quais placas do ciclo foram pagas e quais estão com boleto
   atrasado, dele e do time, para poder cobrar.

O plano de remuneração é **unilevel**: venda própria vale 1 placa, venda de qualquer pessoa
do nível 1 ao 6 vale 0,5 placa. Do sétimo nível em diante não paga.

Este spec cobre o lado CRM. A coleta e a apuração dos números estão especificadas em
`docs/superpowers/specs/2026-07-22-rede-multinivel-placas-design.md`, e este documento
**resolve a divergência que aquele deixou em aberto** (ver "A base é 764").

## Decisões

### A base é 764, não 173

Aquele spec registrou uma divergência entre uma lista manual de 173 pessoas e a árvore por
id da API (764) sem cravar qual valia. Fica cravado agora: **vale a árvore por id, 764
pessoas na downline (765 com o Rodrigo)**.

Provas levantadas em 22/07:

- `responsibleUser` é o único campo de vínculo que o registro do Power tem. Não existe
  campo separado de patrocinador/indicador — conferido no JSON cru do Rodrigo e de um
  direto dele.
- O filtro `managerIds` bate 100% com esse campo, em todos os pontos testados:
  `managerIds=[100280]` devolve 25 pessoas e as 25 têm `responsibleUser = "Rodrigo Souza"`;
  `[162417]` devolve 61, todas com `"Marcio Cristiano de Souza"`; `[117982]` devolve 46,
  todas com `"Alexandre Duarte"`.
- **170 dos 172** nomes da lista manual estão dentro dos 764. Não são duas bases: a lista
  manual é um recorte incompleto da mesma árvore, que parou no nível 4 e perdeu 10 dos 25
  diretos — e cada direto perdido leva junto a sub-rede inteira abaixo dele.

Distribuição atual: N1=25, N2=126, N3=245, N4=256, N5=98, N6=12, N7=2. Ativos 682,
bloqueados 82, com CPF válido 762.

Os bloqueados entram na base. Quem está bloqueado hoje vendeu placa no mês apurado, e
esconder isso quebra a conferência do ciclo.

### Inadimplente é boleto vencido e não pago

Não é "placa que não apareceu na lista de pagos" (isso é ausência de dado, não
inadimplência) nem a situação cadastral do veículo. É o boleto que **venceu e não foi
quitado**, com dias de atraso contados.

O SGA suporta isso direto: `POST /listar/boleto-associado/periodo` aceita
`data_vencimento_inicial` / `data_vencimento_final` e `codigo_situacao_boleto`. As
situações válidas vêm de `GET /listar/situacao-boleto/ativo` e devem ser lidas da API na
implementação, nunca chutadas.

### Coleta e leitura são separadas

Power e SGA são lentos. Medido em 22/07: a árvore da rede levou ~20 min (765 chamadas), as
placas de um mês ~10 min (8 situações × 30 dias), os boletos de um mês 32 páginas. Isso não
pode acontecer com o Rodrigo esperando na tela.

- **Coleta** — job em background, disparado por botão, visível só para admin. Checkpoint
  retomável (os coletores já gravam incremental).
- **Leitura** — a tela lê exclusivamente as tabelas espelho do Supabase. Nunca chama Power
  nem SGA. Resposta em milissegundos.

Job noturno automático foi descartado: o Bearer do painel do Power expira em ~10h e é
colado à mão, então o job falharia na maioria das noites e o erro só apareceria como número
errado na tela do Rodrigo.

### A carga publica tudo ou não publica nada

A coleta escreve em staging e só promove para publicado quando terminou inteira e os
totais conferiram. Falhou no meio, o Rodrigo continua vendo a carga anterior íntegra, com o
carimbo de quando ela foi feita. Nunca uma rede pela metade, nunca um placar quebrado.

Foi exatamente esse o erro que aconteceu na coleta de junho: o token do SGA caiu no fim e o
total saiu 3.473 quando o certo era 3.549. Sem o staging, esse número teria virado tela.

### A rede é dado espelhado, não usuário do CRM

Os 764 não viram registros em `users`. Eles não logam, não têm email próprio garantido, e
criá-los poluiria a gestão de acessos e o RBAC. A rede é tabela espelho; o vínculo com o
CRM existe só na raiz, pelo `user_id` do Rodrigo.

### Acesso

O Rodrigo vê a própria rede e o próprio placar. Admin vê qualquer raiz e é o único que
enxerga o botão de atualizar. Nenhum outro papel tem a tela.

## Modelo de dados

Três tabelas novas no Supabase, todas com `company_id` (multi-tenant, regra do projeto) e
todas criadas por DDL aditiva com `CREATE TABLE IF NOT EXISTS` — nunca `drizzle-kit push`,
nunca seed contra produção.

`rede_consultores` — uma linha por pessoa da rede
: `id`, `company_id`, `power_id`, `cpf`, `nome`, `nome_tratamento`, `email`, `celular`,
  `funcao`, `cooperativa`, `codigo_voluntario`, `patrocinador_power_id`, `nivel_raiz`,
  `raiz_power_id`, `caminho` (linha completa da raiz até a pessoa, para busca e breadcrumb),
  `status` (`ativo` | `bloqueado`), `user_id` (nulo, exceto na raiz), `carga_id`.

`rede_placas` — uma linha por placa do ciclo
: `id`, `company_id`, `cpf_consultor`, `codigo_veiculo`, `placa`, `associado`,
  `telefone_associado`, `data_contrato`, `mes_contrato`, `data_pagamento`, `mes_pagamento`,
  `data_vencimento`, `dias_atraso`, `valor`, `situacao_veiculo`, `situacao_boleto`,
  `status` (`paga` | `inadimplente`), `carga_id`.

`rede_cargas` — histórico de cada sincronização
: `id`, `company_id`, `raiz_power_id`, `iniciada_em`, `concluida_em`, `disparada_por`,
  `etapa`, `status` (`rodando` | `publicada` | `falhou`), `totais` (jsonb com pessoas,
  placas, pagas, inadimplentes), `erro`, `publicada` (bool).

O `carga_id` é o que permite a troca atômica: publicar é marcar a carga nova como publicada
e a anterior como não publicada, numa transação. As leituras sempre filtram pela carga
publicada.

## Arquitetura

```
Power CRM ──managerIds──►  coletor de rede    ─┐
                                               ├─► staging (carga_id) ─► publica ─► tabelas
SGA /listar/veiculo ─────►  coletor de placas ─┤                                     espelho
SGA /listar/boleto... ───►  coletor de boletos ┘                                        │
                                                                                        ▼
                                                            GET /api/rede/*  ──►  Minha Rede
```

### Camada 1 — Coletores

Os coletores já existem e são somente leitura, no projeto `21 GO - SGA HINOVA`:
`timePorId.js`, `placasContratoMes.js`, `boletosPagosPeriodo.js`, `redePlacas.js`. Eles
migram para o backend do CRM como um módulo `rede/sync`, preservando o comportamento
retomável e as armadilhas já documentadas (`inicio_paginacao` é número de página e não
offset; 500 por página; período de boleto limitado a 31 dias; uma chamada por vez).

### Camada 2 — API

```
GET  /api/rede/arvore?raiz=<powerId>          árvore da rede, com placas por ramo
GET  /api/rede/placar?contrato=YYYY-MM&pagamento=YYYY-MM
GET  /api/rede/placas?status=paga|inadimplente&contrato=&pagamento=&consultor=&nivel=
GET  /api/rede/cargas                          histórico e data da última publicação
POST /api/rede/sync                            dispara a coleta (admin)
GET  /api/rede/sync/:id                        progresso do job
```

A árvore sai por CTE recursiva sobre `rede_consultores`. O placar e as listas saem de
`rede_placas` agregado por `cpf_consultor` cruzado com o nível da pessoa.

Escopo: o consultor só resolve a raiz pelo próprio `user_id` do token; admin pode passar
`raiz`. Toda query filtra por `company_id`.

### Camada 3 — Tela

Rota nova `Minha Rede`, com duas abas: **Rede** e **Pagamento**.

## Aba Rede — três modos de visualização

Busca única no topo e filtros compartilhados (status, nível) atravessando os três modos.
Digitou um nome, a árvore abre sozinha no caminho até a pessoa.

**Modo Árvore (padrão)** — responde "quem é da base de quem". Abre só o N1 e expande sob
demanda, então nunca renderiza 764 nós de uma vez. Cada nó mostra as placas próprias e as
**placas do ramo** (a pessoa mais tudo abaixo dela) — é isso que faz o multinível ficar
óbvio: um direto que vende pouco pode carregar um sub-time enorme.

**Modo Níveis** — responde "de onde vem meu dinheiro". Barras por nível com pessoas,
placas e o ponderado de cada faixa. N1–N6 destacados; N7 esmaecido com legenda "fora do
alcance".

**Modo Tabela** — responde "quem está vendendo e quem sumiu". Lista plana, ordenável por
qualquer coluna, com quem chamou e a linha completa (`Rodrigo › Marcos › Alexandre`).

Em todos: cor por nível (o azul institucional clareia conforme desce, escala já existente
em `MyTeamView.tsx`), status ativo/bloqueado direto do Power, e cada pessoa é clicável para
a aba Pagamento já filtrada nela.

## Aba Pagamento

Seletor de dois meses no topo — **contrato em** / **pagamento em** — abrindo em maio → junho,
que é o ciclo conferido. Trocar o mês recalcula sobre o dado já carregado, sem recoletar.

Placar, com a regra unilevel explicada na própria tela:

```
   40 placas suas          ×1,0  =  40,0
  569 placas do time       ×0,5  = 284,5
  ──────────────────────────────────────
  609 placas contadas          →  324,5 ponderadas
```

Duas listas com a mesma estrutura, mostrando **placa, associado e telefone** mais quem
vendeu e o nível (sem isso ele não distingue venda própria de venda de time):

- **Pagas** — o que fechou o ciclo.
- **Inadimplentes** — boleto vencido e não pago, com dias de atraso e botão de WhatsApp
  direto para o associado.

Filtros idênticos nas duas: busca por placa/associado/telefone, filtro por consultor, por
nível, e alternador "só minhas / só do time / tudo". Exportação CSV respeitando o filtro
aplicado.

## Regra de cálculo

Por consultor, considerando apenas placas com pagamento confirmado:

```
placas_ponderadas = próprias × 1,0 + Σ (placas de cada membro em N1..N6) × 0,5
```

O nível é relativo à raiz: quem é N2 do Rodrigo é N1 de quem o chamou. Placas de N7 ou mais
fundo ficam **fora do bruto e fora do ponderado** — aparecem à parte, marcadas como fora do
alcance, para o Rodrigo ver que existem sem nunca somá-las ao placar.

A placa só conta quando o boleto foi pago. O CRM não oferece marcação manual de pagamento
nesta contagem: se o SGA não reconhece, não conta.

## Tratamento de erro

- **Token do Power expirado (~10h)** — o job para na etapa da rede, marca a carga como
  falhou e pede o token novo. Não publica, não mistura com dado velho.
- **Token do SGA caindo no meio** — mesma coisa. Foi o que produziu 3.473 em vez de 3.549
  em junho; o staging impede que isso vire tela.
- **Consultor sem placa** — entra na rede com zero. É o caso de quem não vendeu, e é
  correto mostrá-lo.
- **Placa sem CPF de voluntário** — fica fora do cálculo e é reportada na contagem de
  descartes da carga, nunca somada a alguém por aproximação.
- **Ciclo recursivo no cadastro do Power** (A gerente de B e B de A) — trava de visitados no
  coletor, já implementada.
- **Casamento Power × SGA** — sempre por CPF (`cpf_voluntario` × `registration`). Nunca por
  nome: na apuração manual anterior um "Leonardo da Cruz Ferreira" entrou no lugar de um
  "Leonardo da Cruz Gonçalves".

## Verificação

| Prova | Esperado | Fonte independente |
|---|---:|---|
| Pessoas na base do Rodrigo | 764 | árvore por id, 22/07 |
| Diretos (N1) | 25 | filtro `managerIds=[100280]` |
| Placas contrato maio + pago junho | 609 | conferência manual do cliente: 603 |
| Consultores com ≥1 placa no ciclo | 118 | apuração de 22/07 |
| Placas próprias do Rodrigo no ciclo | 40 | apuração de 22/07 |
| Ponderado do ciclo | 324,5 | 40×1,0 + 569×0,5 |
| Nenhum N7+ no ponderado | 0 | regra do plano |
| Placas contratadas em junho (base) | 3.549 | coleta completa de 22/07 |

## Fora de escopo

- Cálculo de valor em reais da comissão — a entrega é em placas.
- Rede de outros consultores. A estrutura suporta outras raízes, mas nada é importado antes
  de alguém pedir.
- Sincronização automática agendada.
- Qualquer escrita no SGA ou no Power. Ambos são somente leitura.
- Criação de usuários do CRM para os membros da rede.

## Links relacionados

- `docs/superpowers/specs/2026-07-22-rede-multinivel-placas-design.md`
- `21 GO - SGA HINOVA/docs/BASE-CONHECIMENTO-SGA.md`
- `21 GO - CONTROLE DE ACESSO/docs/GUIA-ACHAR-TIME-E-PAGAMENTOS.md`
- [[MEMORIA-21Go]]
