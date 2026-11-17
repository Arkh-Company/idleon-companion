# Feature Specification: Molde por sistema nas árvores de fórmula

**Feature Branch**: `spec/009-system-mould`

**Created**: 2026-11-17

**Status**: Draft

**Input**: User description: "Molde por sistema nas árvores de fórmula (feature 009, sobre a 008 já publicada na 0.8.0): o primeiro nível de toda árvore mostra de onde vem o número por sistema, como a página V1 da bancada, e nenhum passo de conta sem nome aparece como linha."

## Por que esta feature

Na 008 (publicada na 0.8.0), o primeiro nível de cada árvore são os passos do jogo, na ordem do bloco raiz (FR-006 da 008). O jogo não dá nome à maior parte desses passos: eles são totais parciais de uma conta, e o app mostra cada um como uma linha "Game value" com o selo `no name yet`. No Drop Rate, o topo da árvore é uma cadeia de passos assim ("Game value × Multiplier × Drop Rate Multi × Shipinabottle vial", depois "Game value + 0.3", depois "1.2 × Game value"...).

Medido no jogo instalado (versão 0e47e87b, retrato do personagem 9), nas 716 árvores do catálogo sobram 1.625 galhos de conta sem nome, 424 deles no primeiro nível. Depois da tabela de nomes do #37, quase todo `no name yet` que resta é um passo de conta, não uma leitura.

O Vinicius quer que o jogador veja **de onde vem o número, por sistema** (Alchemy, Cards, Companions...), como na página V1 da bancada (`research/run/formula-006/screen-proposal/build-v1mold.cjs`, página `any/pages/droprate.html`), e que **nenhum degrau de conta sem nome apareça como linha**.

## Clarifications

### Session 2026-11-16/17 (brainstorming)

- Q: O molde por sistema vale para quais árvores? → A: Para as 716, por regra geral; o Drop Rate deve sair igual à V1 da bancada, como prova.
- Q: Os passos de conta sem nome de dentro das fontes, fora do primeiro nível, também somem? → A: Sim, todos são achatados: o passo sem nome não vira linha, as partes dele sobem para a linha de cima e a conta inteira fica no ⓘ do pai.
- Q: Onde o molde é montado? → A: Onde a árvore é montada (não só na hora de desenhar a janela), para cada nível somar o pai, os grupos terem valor e peso próprios e o Drop Rate poder ser comparado com a bancada linha por linha.
- Q: Mudança pequena ou spec nova? → A: Spec nova (009), porque muda a FR-006 da 008.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - De onde vem o meu Drop Rate, por sistema (Priority: P1)

O jogador abre o Drop Rate na Stats. Logo abaixo da resposta curta, em vez de uma cadeia de passos sem nome, vê os grupos da V1: os pools da conta (LUK Scaling, Additive Pool, Total Sum, Post-Processing) e, dentro deles, um grupo por sistema com emoji ("🃏 Cards", "⚗️ Alchemy", "🐾 Companions"...), cada um com o seu valor. Abrindo um grupo, vê as fontes daquele sistema; abrindo uma fonte, vê a conta dela como hoje.

**Why this priority**: É a árvore mais aberta e a que mostrou o problema; a V1 da bancada é a referência que o Vinicius aprovou.

**Independent Test**: Com o retrato do personagem 9 sobre o jogo instalado, a árvore do Drop Rate tem no primeiro nível os mesmos pools e grupos da página V1 da bancada, na mesma ordem e com os mesmos valores, e nenhuma linha `no name yet` de passo de conta.

**Acceptance Scenarios**:

1. **Given** o Drop Rate aberto, **When** a árvore aparece, **Then** o primeiro nível tem os pools da V1, e dentro deles os grupos por sistema na ordem da V1, cada um com valor e fatia.
2. **Given** um grupo de sistema, **When** o jogador o abre, **Then** as fontes daquele sistema aparecem na ordem do jogo, e a soma (ou o produto) delas dá o valor do grupo.
3. **Given** um grupo com uma única fonte de mesmo valor, **When** a árvore aparece, **Then** só a fonte aparece, sem o grupo em volta (regra "Friends" da V1).

---

### User Story 2 - Toda árvore agrupada por sistema (Priority: P2)

O jogador abre qualquer número do catálogo, como o HP máximo, um número de Smithing ou um bônus de Summoning. O primeiro nível agrupa as fontes por sistema, pela mesma regra do Drop Rate. Quando a conta da raiz mistura soma e multiplicação, o topo tem pools com um nome pelo papel na conta.

**Why this priority**: O Vinicius escolheu a regra geral para as 716 árvores, não um molde só do Drop Rate.

**Independent Test**: Nas 716 árvores, montadas sobre o jogo instalado, nenhum primeiro nível tem linha de passo de conta sem nome, e cada nível soma (ou multiplica) até o pai.

**Acceptance Scenarios**:

1. **Given** uma árvore cuja raiz só soma fontes, **When** ela aparece, **Then** o primeiro nível são os grupos por sistema, sem pool.
2. **Given** uma árvore cuja raiz mistura soma e multiplicação, **When** ela aparece, **Then** o topo tem um pool para cada parte da conta, com um nome pelo papel, e os grupos por sistema dentro de cada pool.
3. **Given** uma fonte cujo sistema o app não conhece, **When** a árvore aparece, **Then** ela fica no grupo "🔹 Other", no fim.

---

### User Story 3 - Nenhum degrau sem nome por dentro (Priority: P3)

Em qualquer nível, uma conta intermediária que o jogo não nomeia, como "Game value + 0.3", não vira linha. As partes dela aparecem direto na linha de cima, e a conta inteira continua no ⓘ dessa linha.

**Why this priority**: Fecha o resto dos 1.625 galhos sem nome. Sem isso, o topo fica limpo e o "no name yet" volta um nível abaixo.

**Independent Test**: Nas 716 árvores, nenhuma linha de galho de conta (sem código do jogo) tem o selo `no name yet`; cada linha cujas partes subiram tem um ⓘ que fecha com os números delas.

**Acceptance Scenarios**:

1. **Given** uma fonte cuja conta tem passos intermediários sem nome, **When** o jogador a abre, **Then** vê só as partes com nome (ou as leituras), e o ⓘ da fonte mostra a conta inteira.
2. **Given** um passo de conta que tem nome provado, **When** a árvore aparece, **Then** ele continua como linha.

### Edge Cases

- **Mesmo sistema nos dois lados:** uma fonte aparece numa soma e noutra fonte num produto, e as duas são do mesmo sistema. Cada pool tem o seu grupo daquele sistema.
- **Grupo com valor neutro:** um grupo que soma 0 ou multiplica ×1 vai para "At 0" ou "At ×1" (FR-014 da 008), como uma parte.
- **Passo achatado com nome por forma:** um passo achatado tinha um nome só por forma (como "Multiplier"). O nome por forma não segura a linha. Ele só segura quando é um nome provado.
- **Fonte de cache:** uma fonte lida de um cache do jogo vai para o sistema do bloco que escreve o cache. Quando ninguém escreve o cache, vai para "Other".
- **Pins, marcas e radar:** usam chaves de peça e de número do catálogo, que continuam iguais. Uma marca feita antes da 009 ainda compara os valores das mesmas peças.
- **Número que precisa do jogo vivo:** sem o ator no mapa, ele continua "Needs the live map" (FR-023 da 008), sem grupos.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O primeiro nível de toda árvore do catálogo MUST agrupar as fontes da conta da raiz por sistema, no lugar dos passos do jogo. Isso substitui a frase "os passos do jogo como primeiro nível da árvore" da FR-006 da 008; o resto da FR-006 continua valendo.
- **FR-002**: Cada grupo de sistema MUST levar o nome do sistema com o seu emoji (por exemplo, "⚗️ Alchemy"), o seu valor e a sua fatia, e a soma ou o produto das fontes de dentro MUST dar o valor do grupo.
- **FR-003**: O sistema de uma fonte MUST vir de uma regra com prova por referência (o bloco do jogo que a fonte chama ou o que escreve o cache que ela lê). Uma fonte sem regra MUST ir para "🔹 Other". Uma fonte nunca vai para um sistema por palpite.
- **FR-004**: Os grupos MUST seguir a ordem da V1 da bancada. Os sistemas fora da V1 vêm depois, na ordem em que aparecem na conta, e "Other" por último. Dentro de um grupo, MUST valer a ordem do jogo, com os grupos "Small", "At 0" e "At ×1" da FR-014 da 008.
- **FR-005**: Quando a conta da raiz mistura soma e multiplicação, o topo MUST ter um pool para cada parte da conta, com os grupos por sistema dentro. No Drop Rate, os pools MUST ser os da V1 (LUK Scaling, Additive Pool, Total Sum, Post-Processing); nas outras árvores, cada pool leva um nome pelo papel que tem na conta. A regra que dá esse nome fica para o plano, com a condição de nunca usar código do jogo.
- **FR-006**: Um grupo com uma única fonte de mesmo valor MUST mostrar só a fonte.
- **FR-007**: Em qualquer nível, um galho de conta sem nome provado (sem código do jogo e sem nome provado) MUST NOT virar linha: as partes dele sobem para a linha de cima, e o ⓘ dessa linha MUST mostrar a conta inteira e fechar com os números das partes. Um nome só por forma (como "Multiplier" ou "Fixed +2") não segura a linha.
- **FR-008**: Cada nível MUST somar (ou multiplicar) até o pai, como na 008. Nenhuma fonte e nenhum valor MUST sumir da tela por causa do molde.
- **FR-009**: As chaves de peça e de número que os Pins, as marcas, o radar de patch e "Where this goes" usam MUST continuar as mesmas da 008.
- **FR-010**: A árvore do Drop Rate MUST sair igual à V1 da bancada sobre o mesmo retrato: os mesmos pools, os mesmos grupos na mesma ordem e com os mesmos valores, e as mesmas fontes em cada grupo. A comparação MUST ser um teste rodado pela receita de paridade da 008, fora da CI.
- **FR-011**: Os grupos e os pools MUST seguir as regras de honestidade e de texto da 008: nenhum código do jogo no nome (FR-012a), nenhum nome de personagem, só átomos na saída do worker (FR-010) e a conferência do main antes da janela (FR-010b).

### Key Entities

- **Pool:** uma parte da conta da raiz, como as somas, os produtos ou o pós-processamento. Tem um nome pelo papel, um valor, uma fatia e os grupos de sistema dentro.
- **Grupo de sistema:** um sistema do jogo, com emoji e nome, dentro da raiz ou de um pool. Tem um valor (a soma ou o produto das suas fontes), uma fatia e as fontes.
- **Regra de sistema:** liga um bloco do jogo, ou uma leitura, a um sistema, com prova por referência.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Medido no jogo instalado, nas 716 árvores do catálogo, 0 linhas de galho de conta mostram `no name yet` (hoje são 1.625).
- **SC-002**: O Drop Rate sobre o retrato do personagem 9 tem 0 diferenças com a V1 da bancada em pools, grupos, ordem, valores e fontes por grupo.
- **SC-003**: Nas 716 árvores, cada nível soma (ou multiplica) até o pai, com 0 exceções, e nenhuma fonte some.
- **SC-004**: Em 5 segundos, um jogador que nunca viu o app diz qual sistema mais pesa no Drop Rate dele, pelo primeiro nível da árvore. É o teste dos 5 segundos da 008, repetido.

## Assumptions

- **A V1 como base:** a lista de sistemas da V1 da bancada (vinda do site de referência), com emoji e ordem, é a base dos grupos. Um sistema novo de uma árvore fora do Drop Rate entra pela mesma regra de prova.
- **`tagOf` como base:** a regra de sistema por bloco que a 008 já trouxe da bancada (`tagOf`) é o ponto de partida. Ela cresce para cobrir as fontes das 716 árvores.
- **Molde no worker:** o molde é montado onde a árvore é montada, no worker de árvores. A janela só desenha.
- **Medição fora do repositório:** a sonda que monta as 716 árvores sobre o jogo instalado já existe, fora do repositório, e mede SC-001 e SC-003.

## Out of Scope *(mandatory)*

- **Nomes novos para leituras soltas:** continuam como trabalho separado, que não é desta spec.
- **Números da Stats:** nada muda neles.
- **ⓘ com caminho do jogo:** a regra da FR-012a da 008 continua. Quando uma parte não tem nome, o ⓘ mostra o caminho do jogo.
- **Molde feito à mão por árvore:** só o Drop Rate segue a V1 exatamente. As outras árvores seguem a regra geral.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| O molde por sistema vale para quais árvores? | resolved | Para as 716, por regra geral; o Drop Rate igual à V1 é a prova (brainstorming, 16/11) |
| Os passos de conta sem nome de dentro das fontes também somem? | resolved | Sim, achatados em qualquer nível; a conta inteira fica no ⓘ do pai (FR-007) |
| O molde é montado no worker ou só na janela? | resolved | No worker (FR-008, FR-010) |
| Como um pool ganha nome numa árvore que não é o Drop Rate? | open | Proposta: um nome pelo papel na conta, como "Added", "Multiplied" ou "After the total"; a regra final fica para o plano (FR-005) |
| Um grupo de sistema com valor neutro (0 ou ×1) vai para "At 0"/"At ×1" como uma parte, ou fica no lugar? | open | Proposta: vai para "At 0"/"At ×1", como uma parte (Edge Cases) |
| Os grupos de sistema começam abertos ou fechados? | open | Proposta: fechados, como os grupos da FR-014 da 008, menos o de maior fatia |
