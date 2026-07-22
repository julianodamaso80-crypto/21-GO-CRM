---
data: 2026-07-22
projeto: 21Go CRM
tags: [rede, multinivel, ux, design, arvore, tabela, inadimplencia, performance, acessibilidade]
tipo: decisão
---

# Minha Rede — Recomendações de UX/Design (diretor de design)

Documento de recomendações para a implementação do módulo **Minha Rede** (spec
`2026-07-22-minha-rede-crm-rodrigo-design.md`). Baseado na leitura integral dos dois specs,
do `brand-guide.md`, do código existente (`MyTeamView.tsx`, `TeamTree.tsx`, `TeamPage.tsx`,
`AssociadosTable.tsx`, `globals.css`, `tailwind.config.js`) e em pesquisa de padrões de
mercado (fontes ao final).

Números que dirigem tudo: **764 pessoas em 7 níveis** (N1=25, N2=126, N3=245, N4=256,
N5=98, N6=12, N7=2), **609 placas pagas** e dezenas de inadimplentes por ciclo. O Rodrigo
usa isso para **futucar a base, saber quem é de quem, quem está bloqueado e quem cobrar**.

---

## A. Diagnóstico do spec

### O que está bom (manter exatamente como está)

1. **Os três modos respondem três perguntas reais** — Árvore ("quem é de quem"), Níveis
   ("de onde vem meu dinheiro"), Tabela ("quem vende e quem sumiu"). É a divisão certa;
   não inventar um quarto modo.
2. **Expandir sob demanda a partir do N1** — é o padrão que GitHub (file tree), VS Code e
   Notion usam para hierarquias grandes: nunca renderizar o que não está aberto. Com 25
   diretos no primeiro nível, a tela abre instantânea.
3. **Placas do ramo em cada nó** — é a única forma de o multinível ficar óbvio. Um direto
   com 2 placas próprias pode carregar um ramo de 200. Sem esse número a árvore mente.
4. **Leitura só do espelho + carga atômica com carimbo** — resposta em milissegundos e
   nunca um número quebrado na tela. Decisão de arquitetura que É decisão de UX.
5. **Ciclo de dois meses (contrato/pagamento) recalculando client-side** — trocar mês sem
   recoletar mantém a sensação de instantâneo.
6. **WhatsApp direto na linha do inadimplente** — transforma leitura em ação. O
   `waLink()` de `MyTeamView.tsx` já resolve isso; reutilizar.
7. **Cor por nível já existente** (`LEVEL_COLORS` em `MyTeamView.tsx`/`TeamTree.tsx`) —
   escala harmônica do azul institucional. Reaproveitar como está, com uma correção de
   contraste (ver seção F).

### O que vai falhar na prática com 764 nós

1. **"Expandir tudo" do `TeamTree.tsx` atual.** Com 764 nós, o botão monta 764 `<Row>`
   recursivos com hover, gradiente e grupo de ações cada — mais de 5.000 elementos DOM.
   Vai travar em notebook mediano e morrer no celular. Ou o botão sai, ou a árvore
   expandida vira lista achatada virtualizada (recomendação em D).
2. **O grid de `MemberCard` do modo Níveis.** Cada card tem radial-gradient no hover,
   translate e ring. Filtrar "Nível 4" renderiza 256 cards de uma vez. O modo Níveis
   precisa deixar de ser "grid de cards de todo mundo" e virar "barras + drill" (seção B).
3. **Ordenação alfabética dos filhos** (`localeCompare` no `childrenMap` do
   `TeamTree.tsx`). Com 61 filhos sob o Marcio, a ordem alfabética esconde exatamente o
   que o Rodrigo quer ver: quem produz. **Ordenar filhos por placas do ramo, decrescente.**
   Essa é talvez a mudança de maior impacto por menor custo do módulo inteiro.
4. **As duas listas de placas empilhadas na aba Pagamento.** 609 pagas + inadimplentes em
   sequência vertical é um scroll sem fim onde a lista que importa (inadimplentes) fica
   embaixo. Devem ser **abas segmentadas dentro da aba Pagamento**, com contador em cada
   uma, inadimplentes como acesso mais rápido (ver B.4).
5. **Busca sem debounce.** O `keepSet` do `TeamTree.tsx` varre os 764 a cada tecla e
   força a árvore inteira aberta no caminho dos matches. Com debounce de 200 ms e índice
   de busca pré-minúsculo, resolve; sem, digitar engasga.

### O que falta no spec

1. **Onde fica o placar quando o Rodrigo está na aba Rede.** O spec põe o placar só em
   Pagamento. O placar é a razão de existir da tela — deve viver num **cabeçalho
   persistente acima das abas** (ver B.1).
2. **Senso de lugar em profundidade.** No N5, o Rodrigo está a 5 expansões da raiz. O
   spec prevê `caminho` no banco mas não diz onde aparece. Precisa de **trilha de
   ancestrais fixa (sticky) durante o scroll da árvore** — o padrão "sticky scroll" do
   VS Code / cabeçalho de seção sticky que `MyTeamView.tsx` já usa nos níveis.
3. **Definição visual de "quem sumiu".** O modo Tabela promete responder isso, mas nada
   marca o consultor **ativo no Power e com zero placa no ciclo** — que é o "sumido" de
   verdade (bloqueado é outro estado). Precisa de um filtro/coluna "Sem venda no ciclo".
4. **Comportamento mobile.** O spec não fala. O Rodrigo vai abrir isso no celular no
   meio de uma cobrança. Ver C.4.
5. **Estados de interface** — loading, erro, vazio, carga rodando, carga velha. O spec
   trata erro de coleta (backend) mas não o que o Rodrigo vê. Ver E e F.
6. **A nota "por que 609 e não 603".** O cliente conferiu 603 na mão; a tela vai mostrar
   609. Sem uma explicação de método a um clique de distância, a primeira reação será
   "o sistema está errado". Ver E.6.

---

## B. Layout de cada tela

### B.1 Cabeçalho persistente (acima das duas abas)

O olho vê, nesta ordem: **1º o número ponderado** (é o salário dele), **2º o alerta de
inadimplência** (é o dinheiro na mesa), **3º o carimbo da carga** (é a confiança no dado).
Nome e contagem de rede são contexto, não protagonistas — o Rodrigo já sabe quem ele é.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ Minha Rede                                   Dados de 22 de julho, 14h32 ⟳ │
│ Rodrigo Souza · 764 pessoas · 7 níveis · 682 ativas                        │
│                                                                            │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌─────────────────────┐ │
│ │     40       │ │    569       │ │   324,5      │ │ ⚠ 23 placas com     │ │
│ │ SUAS · ×1,0  │ │ TIME · ×0,5  │ │  PONDERADAS  │ │ boleto vencido      │ │
│ │              │ │              │ │  (destaque)  │ │ [Ver quem lembrar →]│ │
│ └──────────────┘ └──────────────┘ └──────────────┘ └─────────────────────┘ │
│                                                                            │
│ ┌─────────┬────────────┐                                                   │
│ │  Rede   │ Pagamento  │   ← abas                                          │
└─┴─────────┴────────────┴───────────────────────────────────────────────────┘
```

- Componentes reais: `.stat-card` + `.stat-value` + `.stat-label` do `globals.css`. O
  card do ponderado usa `.card-blue` (gradiente `#293C82 → #22326C` + `shadow-glow-blue`)
  para ser o único elemento "marca forte" da tela — hierarquia por exceção, não por
  gritaria.
- O card de inadimplência usa `badge-warning`/`text-warning` (`#FBBF24`), **não**
  `text-error`. Motivo: pesquisa de dunning mostra que enquadramento de perda ("placas
  que só contam depois do pagamento") converte melhor que enquadramento de culpa; o
  vermelho fica reservado para atraso ≥ 30 dias na lista (ver B.4). O botão do card leva
  direto à aba Pagamento → Inadimplentes.
- O carimbo da carga fica no canto superior direito em `text-dark-400 text-xs`, com o
  `⟳` (botão de sincronizar) visível **somente para admin**, como manda o spec.
- **Não** trazer o tilt 3D do hero de `MyTeamView.tsx` para cá. Esta é uma tela de
  trabalho diário com números; o efeito rouba atenção e custa performance. Manter o
  `bg-noise` sutil e o `page-enter`, nada além.

### B.2 Aba Rede — Modo Árvore (padrão)

Responde "quem é da base de quem". A base é o `TeamTree.tsx` existente, com cinco
mudanças.

```
[ Árvore | Níveis | Tabela ]   [🔍 Buscar por nome, telefone ou placa…]  [Ativos|Todos] [Nível ▾]
┌────────────────────────────────────────────────────────────────────────────┐
│ ★ Rodrigo Souza · VOCÊ            40 placas · rede 764 · ponderado 324,5   │  ← raiz fixa
├────────────────────────────────────────────────────────────────────────────┤
│ Rodrigo › Marcio › Alexandre                                    (sticky)   │  ← trilha ao rolar fundo
│                                                                            │
│ ▾ ● Marcio Cristiano      N1 ●Ativo    3 placas · ramo 214    61 diretos   │
│ │  ▾ ● Alexandre Duarte   N2 ●Ativo    8 placas · ramo 96     46 diretos   │
│ │  │    ● Carla Mendes    N3 ○Bloq.    2 placas               [wa] [tel]   │
│ │  │    ● João Pereira    N3 ●Ativo    0 placas                            │
│ │  │    … mostrar mais 26 pessoas                                          │
│ │  ▸ ● Renata Alves       N2 ●Ativo    1 placa · ramo 12      7 diretos    │
│ ▸ ● Antônio Ribeiro       N1 ●Ativo    12 placas · ramo 88    9 diretos    │
│ ▸ ● …                                                                      │
└────────────────────────────────────────────────────────────────────────────┘
```

Hierarquia visual da linha: **1º o nome** (`text-sm font-medium text-dark-50`), **2º as
placas do ramo** (é o que diferencia um direto valioso), **3º o status**. Nível e contagem
de diretos são metadados em `text-dark-400 font-mono text-[11px]`, como já está no
`TeamTree.tsx`.

As cinco mudanças sobre o `TeamTree.tsx`:

1. **Filhos ordenados por placas do ramo, decrescente** (empate: alfabético). O ramo
   mais forte sempre em cima.
2. **Placas na linha**: `3 placas · ramo 214`. Placas próprias em `font-mono
   tabular-nums text-dark-100`; ramo em `text-orange-400` — laranja é a cor de dinheiro
   /ação da marca e só aparece nesses números, o que cria a leitura "laranja = placas".
3. **Corte de renderização por nó**: nós com mais de 30 filhos renderizam 30 e um botão
   `… mostrar mais N pessoas` (`.btn-ghost` pequeno). Mantém o DOM bem abaixo de 200
   linhas em qualquer estado normal de navegação.
4. **Trilha sticky**: quando um ramo aberto sai do topo da viewport, os ancestrais do
   primeiro nó visível aparecem como linha compacta fixa
   (`sticky top-0 bg-dark-950/80 backdrop-blur-sm`, igual ao cabeçalho de nível do
   `MyTeamView.tsx`). Clicar num ancestral rola até ele.
5. **Status do Power**: `●Ativo` com `badge-success` + `badge-dot`; bloqueado com
   `badge-danger` sem esmaecer a linha inteira (o `opacity: 0.5` do `TeamTree.tsx` atual
   torna o texto ilegível e o bloqueado ainda conta placa no ciclo — ele precisa ser
   legível). Esmaecer só o avatar.

Busca: com termo ativo, mostrar **apenas os caminhos até os matches** (comportamento
atual do `keepSet`, que está certo), com o trecho casado em `<mark>` estilizado
`bg-orange-500/25 text-orange-200 rounded-sm`. A busca também aceita placa (procura em
`rede_placas` e abre o caminho até o consultor da placa).

Clique no nome (linha inteira, exceto botões) → painel lateral `drawer-panel` da pessoa:
dados de contato, caminho completo, placas do ciclo dela (pagas/vencidas) e botão
"Ver na aba Pagamento" já filtrado. Isso evita trocar de aba a cada "futucada".

### B.3 Aba Rede — Modo Níveis

Responde "de onde vem meu dinheiro". Evolução direta do bloco "Profundidade da rede" do
`MyTeamView.tsx`, que já tem a interação certa (clicar na barra filtra). Deixa de haver
grid de cards: **as barras são a visualização, e o clique manda para a Tabela filtrada**.

```
┌────────────────────────────────────────────────────────────────────────────┐
│ De onde vêm suas placas                 Níveis 1–6 contam · N7 fica fora   │
│                                                                            │
│  N1 ████████░░░░░░░░░░░░░  25 pessoas   118 placas  →  59,0 ponderadas     │
│  N2 ██████████████░░░░░░░ 126 pessoas   201 placas  → 100,5                │
│  N3 ██████████████████░░░ 245 pessoas   156 placas  →  78,0                │
│  N4 ███████████████████░░ 256 pessoas    72 placas  →  36,0                │
│  N5 ██████░░░░░░░░░░░░░░░  98 pessoas    19 placas  →   9,5                │
│  N6 █░░░░░░░░░░░░░░░░░░░░  12 pessoas     3 placas  →   1,5                │
│  ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄        │
│  N7 ▒░░░░ (esmaecido)       2 pessoas     1 placa   →  fora do alcance     │
│                                                                            │
│  Suas vendas próprias: 40 placas × 1,0 = 40,0                              │
│  Total do ciclo: 324,5 placas ponderadas                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

- **A barra representa placas, não pessoas.** É a decisão-chave deste modo: o gráfico de
  pessoas (atual) mostra onde a rede é grande; o de placas mostra onde ela produz — e a
  pergunta do modo é sobre dinheiro. Pessoas viram o rótulo numérico ao lado.
- Cor da barra: `levelColor(lvl)` existente. Ponderado por nível em `font-mono
  text-orange-400`.
- N7 separado por linha tracejada (`border-t border-dashed border-hairline`), barra com
  `opacity-45` (padrão já usado no `MyTeamView.tsx` para `!pays`), rótulo "fora do
  alcance" com tooltip explicativo (texto em E.5).
- Clique na barra → Modo Tabela com filtro de nível aplicado. Uma interação, zero card.

### B.4 Aba Rede — Modo Tabela

Responde "quem está vendendo e quem sumiu". Lista plana virtualizada dos 764, no padrão
`.table-container`/`.table-header`/`.table-row` do `globals.css` (mesma anatomia da
`AssociadosTable.tsx`).

```
[🔍 …]  [Nível ▾] [Status ▾] [☑ Só sem venda no ciclo]              [Exportar CSV]
┌────────────────────────────────────────────────────────────────────────────┐
│ NOME ↓          NÍVEL  QUEM CHAMOU     STATUS   PLACAS↓  RAMO   CONTATO    │
├────────────────────────────────────────────────────────────────────────────┤
│ Marcio Cristiano  N1   Rodrigo Souza   ●Ativo      3     214    [wa][tel]  │
│ Alexandre Duarte  N2   Marcio Cristi…  ●Ativo      8      96    [wa][tel]  │
│ Carla Mendes      N3   Alexandre Dua…  ○Bloq.      2       2    [wa][tel]  │
│ João Pereira      N3   Alexandre Dua…  ●Ativo      0       0    —          │
│ …                                                     (linhas virtuais)    │
└────────────────────────────────────────────────────────────────────────────┘
  Mostrando 764 pessoas · ordenado por placas do ciclo
```

- **Ordenação padrão: placas do ciclo, decrescente** — os produtores em cima, os zeros
  no fim. Cabeçalhos clicáveis com `aria-sort`; segunda ordenação estável por nome.
- Coluna "Quem chamou" mostra o pai direto; o caminho completo
  (`Rodrigo › Marcio › Alexandre`) vai em tooltip e no drawer — na célula ele estoura
  a largura e vira ruído.
- O checkbox **"Só sem venda no ciclo"** é o filtro do "quem sumiu": ativo no Power,
  zero placa. É filtro dedicado porque é a pergunta nomeada do modo — não pode depender
  de o usuário descobrir "ordenar por placas crescente".
- Cabeçalho sticky (`sticky top-0` no `thead`, o `.table-header` já tem fundo próprio) —
  investimento obrigatório em qualquer tabela que passa de uma viewport, padrão
  documentado por toda a literatura de tabela enterprise.

### B.5 Aba Pagamento

Responde "o que fechou e quem eu cobro". Hierarquia do olho: **1º o placar** (a conta do
ciclo, com a regra explicada), **2º o segmentador Pagas/Inadimplentes com contadores**,
**3º a lista**.

```
Contrato em [Maio 2026 ▾]  →  Pagamento em [Junho 2026 ▾]
┌────────────────────────────────────────────────────────────────────────────┐
│  COMO FECHOU O CICLO                                        (font-mono)    │
│    40 placas suas              × 1,0   =   40,0                            │
│   569 placas do time (N1–N6)   × 0,5   =  284,5                            │
│  ────────────────────────────────────────────────                          │
│   609 placas contadas              →   324,5 ponderadas                    │
│   ⓘ Como contamos · 1 placa de N7 fora do alcance                          │
└────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────┬──────────────────────────────┐
│  Pagas · 609             │  Boleto vencido · 23         │   ← segmentador interno
└──────────────────────────┴──────────────────────────────┘
[🔍 placa, associado ou telefone…] [Consultor ▾] [Nível ▾] [Minhas|Do time|Tudo] [CSV ↓]

(Inadimplentes)
┌────────────────────────────────────────────────────────────────────────────┐
│ PLACA     ASSOCIADO         TELEFONE        VENDEDOR (NÍVEL)  ATRASO↓ AÇÃO │
├────────────────────────────────────────────────────────────────────────────┤
│ ABC1D23   Maria Santos      (21) 9####-###  Marcio C.  (N1)   32 dias [wa] │
│ DEF4G56   Pedro Costa       (21) 9####-###  Você       (—)     18 dias [wa] │
│ …                                                                          │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Placa em `font-mono`** (JetBrains Mono) — o brand guide reserva a mono exatamente
  para placas. Formato `ABC1D23` sem hífen, uppercase.
- **Vendas próprias destacadas**: quando o vendedor é o Rodrigo, a célula mostra
  `Você` em `text-orange-400 font-semibold`. É a distinção 1,0 × 0,5 encarnada na linha.
- **Atraso com escala de temperatura**: 1–14 dias `text-dark-200`; 15–29 `badge-warning`;
  ≥ 30 `badge-danger`. A lista abre ordenada por atraso decrescente — quem está pior no
  topo, porque é cobrança mais urgente e mais difícil.
- **Botão da linha: "Lembrar" (WhatsApp)**, verde como os botões de WhatsApp existentes
  (`border-emerald-500/25 bg-emerald-500/10 text-emerald-400`). Abre o wa.me do
  **associado** com mensagem pré-preenchida (texto em E.4). "Lembrar", não "Cobrar" —
  gera a mesma ação sem tom de ameaça (princípio de dunning: enquadrar como cuidado,
  não como cobrança).
- Pagas usa a mesma tabela com colunas `PLACA · ASSOCIADO · TELEFONE · VENDEDOR (NÍVEL) ·
  PAGA EM · VALOR` — estrutura idêntica, só troca as duas últimas colunas.
- **Exportar CSV** (`.btn-secondary` com ícone `Download`): exporta o filtro aplicado,
  nome do arquivo `rede-inadimplentes-2026-05_2026-06.csv`. Toast (Sonner, já
  instalado) confirmando.
- Chegando da aba Rede com uma pessoa clicada, o filtro Consultor vem preenchido e um
  chip removível mostra `Consultor: Alexandre Duarte ×`.

---

## C. Decisões de interação

1. **O que expande**: só nós da árvore, um clique no chevron (área de toque 24 px mínimo;
   no mobile a linha inteira alterna). `Recolher tudo` permanece; **`Expandir tudo`
   sai** — com 764 nós ele é uma armadilha de performance e não responde nenhuma
   pergunta que a Tabela não responda melhor. Quem quer "ver tudo achatado" tem o modo
   Tabela a um clique.
2. **O que filtra e o que persiste**: busca, status (Ativos/Todos), nível e o ciclo
   (contrato/pagamento) são **estado compartilhado entre os três modos e as duas abas**,
   refletidos na querystring (`?q=&nivel=&status=&contrato=2026-05&pagamento=2026-06&aba=`).
   Trocar de modo nunca zera filtro — o cenário real é "achei o cara na árvore, quero
   ver as placas dele", e perder o contexto na troca é o erro clássico dos softwares de
   genealogia MLM. Querystring também dá link compartilhável e F5 sem perda.
3. **Clique na pessoa** (qualquer modo): abre o `drawer-panel` lateral com contato,
   caminho, placas do ciclo e atalho "Ver na aba Pagamento". Um clique a mais que o
   spec (que manda direto pra aba), porém sem arrancar o usuário do lugar onde estava —
   navegação de "futucar" precisa ser barata de desfazer. `Esc` fecha, foco retorna à
   linha de origem.
4. **Mobile** (o Rodrigo vai cobrar do celular):
   - Cabeçalho: os 4 stat cards viram carrossel horizontal com scroll-snap (padrão
     `overflow-x-auto` já usado em tabelas do CRM); ponderado primeiro.
   - Árvore: **até o N3 com indentação** (12 px por nível, metade do desktop); do N4 em
     diante a indentação para de crescer e a trilha sticky assume o senso de lugar.
     Indentação infinita em 360 px de largura esmaga o conteúdo — é o defeito número um
     dos genealogy trees de MLM em mobile.
   - Ações de contato sempre visíveis no mobile (o `opacity-0 group-hover:opacity-100`
     do `TeamTree.tsx` não existe no touch — trocar por `opacity-100` abaixo de `sm:`).
   - Tabelas: colunas Nome/Placa + valor principal + ação; o resto vai para o drawer da
     linha. Botões mínimos de 48 px de altura (regra mobile do brand guide).
5. **Busca**: debounce de 200 ms, mínimo de 2 caracteres, índice pré-computado
   (`useMemo` com nome+telefone+placa em minúsculas). `Ctrl+K` opcional se sobrar tempo;
   não é requisito.
6. **Troca de ciclo**: recalcula sobre os dados carregados (spec). Durante o recálculo,
   os números do placar fazem transição com `animate-fade-in` — sem skeleton, é
   client-side e instantâneo.

---

## D. Performance — estratégia concreta

Regra geral: **o DOM nunca passa de ~200 linhas**, seja qual for o modo. As técnicas, por
superfície:

1. **Árvore — renderização por expansão + corte por nó (progressive disclosure).**
   O `TeamTree.tsx` já só renderiza nós abertos; mantém-se. Somam-se: corte de 30 filhos
   com "mostrar mais" (B.2) e a remoção do "Expandir tudo". Com isso a árvore não
   precisa de virtualização — a matemática garante: pior caso razoável (caminho aberto
   até N7 com irmãos) fica abaixo de 150 linhas. Virtualizar árvore aninhada exigiria
   achatar a recursão em lista plana (como fazem MUI Rich Tree View e todos os tree
   grids virtualizados); é complexidade que só se paga se um dia existir "expandir tudo".
2. **Tabelas (764 pessoas / 609+ placas) — virtualização com `@tanstack/react-virtual`.**
   Dependência nova (~2 KB gzip), da mesma família do TanStack Query já em produção no
   projeto. Renderiza só as linhas na viewport com `overscan: 10`; a `.table-row` já tem
   altura fixa de 56 px no `globals.css`, o que torna a virtualização trivial (sem
   medição dinâmica). **Por que não paginação**: os dados já estão inteiros no cliente
   (leitura do espelho é barata), e paginar quebraria o "futucar" — ordenar, filtrar e
   rolar contínuo são exatamente o uso desta tela. Cabeçalho sticky convive com
   virtualização usando o padrão documentado do TanStack (container com `max-height`,
   `thead` sticky, corpo com transform).
3. **Agregados calculados uma vez, nunca por render.** Placas próprias, placas do ramo,
   contagens de descendentes e o índice de busca saem de **um único DFS memoizado**
   (`useMemo` sobre `[dadosDaCarga]`) — o `counts` do `TeamTree.tsx` já faz isso para
   contagens; estender para placas. Alternativa melhor ainda: o backend devolve
   `placasRamo` pronto por nó na resposta de `/api/rede/arvore` (a CTE recursiva já
   percorre tudo) — o cliente não repete a conta.
4. **Linhas memoizadas.** `React.memo` no componente de linha da árvore e da tabela, com
   handlers estáveis (`useCallback`). Sem isso, expandir um nó re-renderiza todas as
   linhas visíveis.
5. **Busca com debounce de 200 ms** sobre índice pré-minúsculo (C.5). O `keepSet` atual
   recalcula tudo por tecla; com debounce + índice, o custo cai para um `includes` por
   pessoa a cada 200 ms — imperceptível em 764 itens.
6. **Sem efeitos caros em listas**: nada de radial-gradient por hover, tilt 3D ou
   `backdrop-blur` dentro de linha repetida. Esses efeitos ficam restritos ao cabeçalho
   (1 elemento). `stagger-children` no máximo nos 4 stat cards, nunca em lista.

---

## E. Micro-copy (pronto para colar)

Tom do brand guide: direto, humano, protetor. "Você", frases curtas, sem jargão.

### E.1 Títulos e navegação

| Onde | Texto |
|---|---|
| Título da página | `Minha Rede` |
| Subtítulo | `764 pessoas · 7 níveis · 682 ativas` |
| Abas | `Rede` / `Pagamento` |
| Modos | `Árvore` / `Níveis` / `Tabela` |
| Stat cards | `SUAS · ×1,0` / `TIME · ×0,5` / `PONDERADAS` / `BOLETO VENCIDO` |
| Card inadimplência (linha 2) | `Placas que só contam depois do pagamento` |
| Botão do card | `Ver quem lembrar` |
| Segmentador Pagamento | `Pagas · 609` / `Boleto vencido · 23` |
| Filtro de escopo | `Minhas` / `Do time` / `Tudo` |
| Filtro "sumidos" | `Só sem venda no ciclo` |
| Exportar | `Exportar CSV` |
| Placar, linhas | `40 placas suas × 1,0 = 40,0` · `569 placas do time (N1–N6) × 0,5 = 284,5` · `609 placas contadas → 324,5 ponderadas` |

### E.2 Busca e filtros

- Placeholder aba Rede: `Buscar por nome, telefone ou placa…`
- Placeholder aba Pagamento: `Buscar por placa, associado ou telefone…`
- Resultado: `Mostrando 12 de 764 pessoas` / `23 placas · filtro aplicado`
- Chip de filtro vindo da árvore: `Consultor: Alexandre Duarte ×`

### E.3 Estados vazios

- Rede sem dados (primeira carga nunca rodou):
  `Sua rede ainda não foi sincronizada.` + (só admin vê) `Sincronizar agora` /
  (consultor vê) `Peça ao administrador para rodar a primeira sincronização.`
- Busca sem resultado: `Ninguém com esse nome, telefone ou placa na sua rede.` + botão
  `Limpar busca`
- Inadimplentes vazio: `Nenhum boleto vencido neste ciclo. Seu time está em dia.`
- Pagas vazio: `Nenhuma placa paga neste ciclo ainda. Os boletos pagos aparecem aqui
  assim que o SGA confirma.`
- "Só sem venda" vazio: `Todo mundo ativo vendeu neste ciclo.`
- Pessoa sem telefone (célula): `—` com tooltip `Sem telefone no cadastro do Power`

### E.4 Mensagem pré-preenchida do WhatsApp (botão Lembrar)

```
Oi, {primeiro nome}! Aqui é o {nome do consultor}, da 21Go. Vi que o boleto da placa
{PLACA} venceu no dia {data}. Consegue regularizar pra manter sua proteção ativa?
Qualquer dúvida me chama por aqui.
```

(Enquadramento de perda — "manter sua proteção" — em vez de cobrança. Datas por extenso
conforme o brand guide: `15 de junho`.)

### E.5 Regra do plano (tooltips)

- Tooltip do ponderado: `Cada placa sua vale 1. Cada placa vendida pelo seu time, do
  nível 1 ao 6, vale 0,5. Só entram placas com boleto pago.`
- N7: `Fora do alcance: a partir do 7º nível as placas não entram na sua contagem. Elas
  aparecem aqui só para você ver que existem.`

### E.6 Carga, erro e desatualização

- Carimbo normal: `Dados de 22 de julho, 14h32`
- Carga velha (> 7 dias): banner discreto `badge-warning` no topo:
  `Estes números são de 22 de julho. O ciclo pode ter mudado desde então.` + (admin)
  botão `Atualizar agora` / (consultor) `Peça ao administrador para atualizar.`
- Carga rodando (admin): `Sincronização em andamento — etapa 2 de 3 (placas do SGA).
  Você continua vendo os dados de 22 de julho até terminar.`
- Carga falhou (admin): `A sincronização parou na etapa {etapa}. Os dados de 22 de julho
  continuam valendo. Motivo: {erro}.` + `Tentar de novo`
- Erro de tela (API caiu): `Não conseguimos carregar sua rede. Tente de novo em
  instantes.` + `Recarregar` (nunca expor stack ou código de erro — regra do brand
  guide).
- Nota de método (o `ⓘ Como contamos` do placar): `Contamos toda placa com contrato no
  mês escolhido e boleto pago no mês seguinte, direto do SGA. Placa sem pagamento
  confirmado não entra. Por isso o número pode diferir de contagens feitas à mão.`
- Toast de CSV: `Arquivo exportado com {n} placas.`

---

## F. Acessibilidade e estados

### Semântica e teclado

1. **Árvore**: `role="tree"` no container, `role="treeitem"` + `aria-expanded` +
   `aria-level` + `aria-setsize`/`aria-posinset` nas linhas, filhos em `role="group"`.
   Navegação padrão APG: setas ↑↓ movem foco (roving tabindex — um único `tabIndex=0`),
   → expande/entra, ← recolhe/sobe, `Home`/`End`, `Enter` abre o drawer. Digitação
   incremental (typeahead) fica de fora — a busca cobre.
2. **Tabelas**: manter `<table>` semântica real (como `AssociadosTable.tsx`), `<th scope="col">`,
   `aria-sort="ascending|descending"` na coluna ordenada, botões de ordenação como
   `<button>` dentro do `th`. A virtualização não pode trocar `<table>` por `<div>`
   sem `role="table"`/`row`/`cell` equivalentes.
3. **Contraste — correção obrigatória na escala de nível.** `LEVEL_COLORS` usa texto
   branco sobre a cor do nível; a partir de `#7C9BD6` (N5) o branco reprova WCAG AA, e
   em `#B9CBEC`/`#CFDBF2` (N7+) fica ilegível. Regra: **N1–N4 texto branco; N5+ texto
   `text-blue-900` (`#0C1228`)** nos chips `N{n}`. Um utilitário
   `levelTextColor(lvl)` ao lado do `levelColor` resolve.
4. **Ícones com rótulo**: os botões só-ícone (wa/tel) precisam de `aria-label`
   (`Chamar Maria Santos no WhatsApp`) — hoje o `TeamTree.tsx` usa apenas `title`.
5. **Foco visível** em linhas da árvore e da tabela (`focus-visible:ring-2
   ring-blue-500/30`, mesmo anel do `.input`).
6. **`prefers-reduced-motion`**: desligar `page-enter`, stagger e `dot-pulse` (princípio
   já declarado no brand guide — aplicar de fato).

### Estados de interface

| Estado | Tratamento |
|---|---|
| Loading inicial | Skeleton com `animate-shimmer`: 4 blocos de stat card + 8 linhas fantasma. Nunca spinner sozinho em tela cheia — o skeleton comunica a estrutura que vem. |
| Carregado | `page-enter` no container; `stagger-children` só nos stat cards. |
| Vazio | Padrão `card p-12 text-center` com ícone 32 px em `text-dark-400` (o mesmo da `AssociadosTable.tsx`) + copy de E.3. |
| Erro | Card com `border-error/20`, copy de E.6, botão `Recarregar` (`.btn-secondary`). |
| Carga rodando (admin) | Banner `badge-info` + barra fina de progresso por etapa (`mini-progress` do `globals.css`); a tela continua servindo a carga publicada. |
| Carga velha | Banner `badge-warning` de E.6; nunca bloquear a tela. |
| Filtro sem resultado | Estado vazio com `Limpar busca` — sempre dar a saída. |

---

## G. Riscos e o que eu faria diferente do spec

1. **"Expandir tudo" é o maior risco técnico herdado** — removê-lo (C.1). Se o cliente
   insistir, a implementação correta é achatar + virtualizar, nunca o render recursivo
   atual.
2. **O spec manda o clique na pessoa direto para a aba Pagamento filtrada.** Eu discordo
   parcialmente: intercalar o drawer (C.3) preserva o contexto do "futucar". O atalho
   para a aba continua existindo — dentro do drawer.
3. **O spec não fixa ordenação da árvore** e o código atual ordena por nome. Sem a
   ordenação por produção, a tela responde "quem é de quem" mas falha em "onde está meu
   dinheiro" no modo em que o Rodrigo vai passar mais tempo. É a recomendação que eu
   defenderia com mais força.
4. **609 ≠ 603 vai gerar chamado.** A nota "Como contamos" (E.6) precisa entrar na v1,
   não como melhoria futura. Custa um tooltip; economiza uma crise de confiança.
5. **Placar ausente da aba Rede** (spec o põe só em Pagamento) — o cabeçalho persistente
   (B.1) corrige. Sem ele, o usuário alterna de aba só para ver o próprio número.
6. **CSV com telefone é dado pessoal.** Manter a exportação (necessidade real de
   cobrança), mas registrar no backend quem exportou o quê (`company_id`, usuário,
   filtro, timestamp). Barato agora, valioso se a LGPD bater à porta.
7. **Modo Níveis como grid de cards** (herança do `MyTeamView.tsx`) morreria de
   performance e não responde a pergunta do modo — barras de placas + drill para a
   Tabela (B.3) é mais simples de construir e mais útil.
8. **Risco de divergência visual**: a tela do time atual usa hero com tilt 3D e efeitos
   pesados. Minha Rede é uma tela de operação diária — sobriedade deliberada: os efeitos
   de marca ficam no cabeçalho, as listas são secas e rápidas. É o que Linear e Stripe
   (referências declaradas do projeto) fazem: brilho no chrome, silêncio no dado.

---

## Fontes da pesquisa

- Virtualização de árvores e tree grids: [MUI X Rich Tree View — Virtualization](https://mui.com/x/react-tree-view/rich-tree-view/virtualization/), [Syncfusion — Tree Grid virtualization](https://www.syncfusion.com/blogs/post/boosting-javascript-tree-grid-performance-virtualization), [Telerik — TreeView UI virtualization](https://www.telerik.com/products/wpf/documentation/controls/radtreeview/features/ui-virtualization)
- Tabelas virtualizadas com sticky: [TanStack Table — Virtualization Guide](https://tanstack.com/table/latest/docs/guide/virtualization), [TanStack — Virtualized Rows example](https://tanstack.com/table/v8/docs/framework/react/examples/virtualized-rows), [Guia sticky + TanStack Virtual](https://mashuktamim.medium.com/building-sticky-headers-and-columns-with-tanstack-virtualizer-react-a-complete-guide-12123ef75334)
- Padrões de tabela densa enterprise: [Pencil & Paper — Data Table UX Patterns](https://www.pencilandpaper.io/articles/ux-pattern-analysis-enterprise-data-tables), [Stéphanie Walter — Complex data tables resources](https://stephaniewalter.design/blog/essential-resources-design-complex-data-tables/), [Eleken — Table Design UX](https://www.eleken.co/blog-posts/table-design-ux)
- Genealogia MLM (o que dá errado): [PrimeMLM — Downline Visualization](https://primemlmsoftware.com/mlm-downline-visualization-tree-genealogy-mapping/), [Infinite MLM — Genealogy Tree](https://infinitemlmsoftware.com/blog/mlm-genealogy-tree/), [HybridMLM — Visualizing growth](https://www.hybridmlm.io/blogs/genealogy-tree-in-mlm-visualizing-growth-and-downline-potential/)
- Lazy load / expandir sob demanda: [lazy-tree-view (padrão de referência)](https://github.com/javierOrtega95/lazy-tree-view), [Wijmo — Lazy-loading TreeGrid](https://developer.mescius.com/wijmo/docs/Topics/Grid/TreeGrid/Lazy-Loading-TreeGrid)
- Acessibilidade de árvore: [W3C APG — Patterns](https://www.w3.org/WAI/ARIA/apg/patterns/), [MDN — ARIA tree role](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Roles/tree_role), [DigitalA11Y — Role=Tree](https://www.digitala11y.com/tree-role/), [UXPin — Keyboard navigation for complex widgets](https://www.uxpin.com/studio/blog/keyboard-navigation-patterns-complex-widgets/)
- Cobrança sem agressividade (dunning): [Maxio — What is Dunning](https://www.maxio.com/blog/what-is-dunning), [ChurnWard — Dunning best practices](https://churnward.com/blog/dunning-best-practices/), [Tratta — Automated payment reminders](https://www.tratta.io/blog/automated-payment-reminders)

## Links relacionados

- `docs/superpowers/specs/2026-07-22-minha-rede-crm-rodrigo-design.md`
- `docs/superpowers/specs/2026-07-22-rede-multinivel-placas-design.md`
- `brand-guide.md`
- `frontend/src/pages/team/MyTeamView.tsx` · `TeamTree.tsx` · `TeamPage.tsx`
- `frontend/src/styles/globals.css` · `frontend/tailwind.config.js`
- [[MEMORIA-21Go]]
