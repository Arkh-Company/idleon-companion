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

### Session 2026-11-17

- Q: Que nome um pool leva numa árvore que não é o Drop Rate? → A: Primeiro "pela fonte que mais pesa"; depois, vendo exemplos, o Vinicius trocou para o nome pela etapa da conta, e por fim definiu o modelo de pools abaixo (FR-005).
- Q: O que é um pool? → A: Os pools da árvore são os pools do próprio jogo, na ordem da conta: um "Additive pool" soma os seus bônus antes de a soma entrar na conta (o bônus é diluído), e um "Multi pool" multiplica tudo. Saber em que pool cada bônus entra mostra se ele multiplica tudo ou se é diluído numa soma. Vale também quando a raiz só multiplica ou só soma. Os nomes usam "Multi" e "Additive", não "Multiplier" (FR-005).
- Q: Um grupo de sistema que soma 0 ou multiplica ×1 vai para onde? → A: Fica no lugar, na ordem da V1, com o seu valor 0 ou ×1; não vai para "At 0"/"At ×1" (FR-004).
- Q: Os grupos de sistema começam abertos ou fechados quando a árvore abre? → A: Todos fechados (FR-012).
- Q: O resumo de duas linhas acima da árvore (a resposta curta da 008) continua? → A: Não, sai da tela; a árvore começa direto nos pools (FR-001).
- Q: Como a fatia de cada linha aparece? → A: Escondida por padrão; um botão mostra ou esconde, e ligada aparece só o número ("26%"), sem "of total" (FR-014).
- Q: Como o app mostra o que mudou (Refresh, jogo, marca)? → A: Um botão "Changes", desligado por padrão. Ligado, cada linha mostra uma seta com quanto mudou ("▲ +10%" ou "▼ −3%"), ao vivo, contra o momento em que foi ligado ou contra uma marca escolhida. O "was …" depois do Refresh, a linha que acende sozinha e o "mark …" escrito saem (FR-013).

### Session 2026-11-17 (revisão da spec)

- Q: Numa linha "×", a seta do Changes mostra o quê? → A: A diferença no multiplicador ("▲ +0.12" quando ×1.20 vira ×1.32); nas linhas "+%", a diferença em pontos ("▲ +10%") (FR-013).
- Q: A faixa "Game changed · Refresh" continua? → A: Não. A árvore mostra os valores em tempo real, então não precisa de Refresh; ao ligar o Changes em "live", o app guarda a árvore como estava no clique e compara a partir dali (FR-013, FR-015).
- Q: A marca escolhida no Changes fica salva quando o app fecha? → A: Não; ao abrir o app, o Changes ligado começa em "live" (FR-013).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - De onde vem o meu Drop Rate, por sistema (Priority: P1)

O jogador abre o Drop Rate na Stats. Logo no topo da árvore, em vez de uma cadeia de passos sem nome, ele vê os grupos da V1: os pools da conta (LUK Scaling, Additive Pool, Total Sum, Post-Processing) e, dentro deles, um grupo por sistema com emoji ("🃏 Cards", "⚗️ Alchemy", "🐾 Companions"...), cada um com o seu valor. Abrindo um grupo, vê as fontes daquele sistema; abrindo uma fonte, vê a conta dela como hoje.

**Why this priority**: É a árvore mais aberta e a que mostrou o problema; a V1 da bancada é a referência que o Vinicius aprovou.

**Independent Test**: Com o retrato do personagem 9 sobre o jogo instalado, a árvore do Drop Rate tem no primeiro nível os mesmos pools e grupos da página V1 da bancada, na mesma ordem e com os mesmos valores, e nenhuma linha `no name yet` de passo de conta.

**Acceptance Scenarios**:

1. **Given** o Drop Rate aberto, **When** a árvore aparece, **Then** o jogador vê no primeiro nível os pools da V1, fechados, e dentro deles os grupos por sistema na ordem da V1, cada um com o seu valor.
2. **Given** um grupo de sistema, **When** o jogador o abre, **Then** as fontes daquele sistema aparecem na ordem do jogo, e a soma (ou o produto) delas dá o valor do grupo.
3. **Given** um grupo com uma única fonte de mesmo valor, **When** a árvore aparece, **Then** só a fonte aparece, sem o grupo em volta (regra "Friends" da V1).
4. **Given** o worker não consegue montar a árvore do Drop Rate, **When** o jogador a abre, **Then** ele vê "unavailable" como na 008, e nunca uma árvore parcial com pools vazios.

---

### User Story 2 - Toda árvore agrupada por sistema (Priority: P2)

O jogador abre qualquer número do catálogo, como o HP máximo, um número de Smithing ou um bônus de Summoning. O primeiro nível são os pools do próprio jogo, na ordem da conta, e dentro de cada pool as fontes ficam agrupadas por sistema. Pelo pool, o jogador vê se um multiplicador multiplica tudo (Multi pool) ou se é diluído numa soma antes (Additive pool).

**Why this priority**: O Vinicius escolheu a regra geral para as 716 árvores, não um molde só do Drop Rate.

**Independent Test**: Nas 716 árvores, montadas sobre o jogo instalado, nenhum primeiro nível tem linha de passo de conta sem nome, e cada nível soma (ou multiplica) até o pai.

**Acceptance Scenarios**:

1. **Given** uma árvore cuja raiz só multiplica fontes, **When** ela aparece, **Then** cada fator do jogo é um pool ("Multi pool N" quando multiplica tudo, "Additive pool" quando soma bônus antes), com os sistemas dentro (FR-005).
2. **Given** uma árvore cuja raiz soma e depois multiplica, **When** ela aparece, **Then** o topo tem um Additive pool e um Multi pool na ordem da conta, o ⓘ da raiz diz "Additive pool × Multi pool", e os grupos por sistema ficam dentro de cada pool.
3. **Given** uma fonte cujo sistema o app não conhece, **When** a árvore aparece, **Then** ela fica no grupo "🔹 Other", no fim.
4. **Given** uma raiz cuja conta a regra dos pools não consegue ler (por exemplo, um `max` ou uma condição no topo), **When** a árvore aparece, **Then** o jogador vê as fontes direto no primeiro nível, agrupadas por sistema, sem pool inventado e sem árvore vazia.

---

### User Story 3 - Nenhum degrau sem nome por dentro (Priority: P3)

Em qualquer nível, uma conta intermediária que o jogo não nomeia, como "Game value + 0.3", não vira linha. As partes dela aparecem direto na linha de cima, e a conta inteira continua no ⓘ dessa linha.

**Why this priority**: Fecha o resto dos 1.625 galhos sem nome. Sem isso, o topo fica limpo e o "no name yet" volta um nível abaixo.

**Independent Test**: Nas 716 árvores, nenhuma linha de galho de conta (sem código do jogo) tem o selo `no name yet`; cada linha cujas partes subiram tem um ⓘ que fecha com os números delas.

**Acceptance Scenarios**:

1. **Given** uma fonte cuja conta tem passos intermediários sem nome, **When** o jogador a abre, **Then** vê só as partes com nome (ou as leituras), e o ⓘ da fonte mostra a conta inteira.
2. **Given** um passo de conta que tem nome provado, **When** a árvore aparece, **Then** ele continua como linha.
3. **Given** um passo sem nome que guarda uma parte com selo de bug do jogo ou de corte, **When** o passo é achatado, **Then** o jogador continua vendo o selo na parte que subiu.

### Edge Cases

- **Mesmo sistema nos dois lados:** uma fonte aparece numa soma e noutra fonte num produto, e as duas são do mesmo sistema. Cada pool MUST ter o seu próprio grupo daquele sistema.
- **Grupo com valor neutro:** um grupo que soma 0 ou multiplica ×1 fica no lugar dele na ordem dos grupos, com o valor 0 ou ×1 (FR-004).
- **Passo achatado com nome por forma:** um nome só por forma (como "Multiplier") MUST NOT segurar a linha; só um nome provado segura.
- **Fonte de cache:** uma fonte lida de um cache do jogo MUST ir para o sistema do bloco que escreve o cache; sem escritor, MUST ir para "Other".
- **Pins, marcas e radar:** usam chaves de peça e de número do catálogo, que continuam iguais. Uma marca feita antes da 009 ainda compara os valores das mesmas peças.
- **Número que precisa do jogo vivo:** sem o ator no mapa, ele MUST continuar "Needs the live map" (FR-023 da 008), sem grupos.
- **Raiz que a regra dos pools não lê:** o primeiro nível MUST mostrar as fontes agrupadas por sistema, sem pool (US2, cenário 4).
- **Falha do worker no meio do molde:** a árvore MUST ficar "unavailable" como na 008; nunca sai uma árvore parcial.
- **Preferências ilegíveis:** um arquivo de preferências que falta ou não abre MUST deixar os dois botões desligados, sem aviso e sem apagar o arquivo.
- **Marca apagada com o Changes ligado contra ela:** a comparação MUST voltar para "live", guardando a árvore daquele momento.
- **Mais de 200 partes abertas com o Changes ligado:** as partes além do limite ao vivo da 008 MUST NOT mostrar seta, nem uma seta falsa (NFR-003).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: O primeiro nível de toda árvore do catálogo MUST agrupar as fontes da conta da raiz por sistema, no lugar dos passos do jogo. Isso substitui a frase "os passos do jogo como primeiro nível da árvore" da FR-006 da 008; a resposta curta de duas linhas acima da árvore (FR-006 da 008) MUST sair da tela: a árvore começa direto nos pools. O resto da FR-006 continua valendo. Quando todas as fontes de uma árvore caem em "Other", o primeiro nível mostra as fontes direto, sem o grupo "Other".
- **FR-002**: Cada grupo de sistema MUST levar o nome do sistema com o seu emoji (por exemplo, "⚗️ Alchemy") e o seu valor (a fatia só aparece com o botão da FR-014), e a soma ou o produto das fontes de dentro MUST dar o valor do grupo. O valor do grupo MUST sair no mesmo formato das partes da 008 ("×1.06" para o que multiplica, "+80%" para o que soma). O leitor de tela MUST anunciar a linha de um pool ou grupo com o nome, o valor, a fatia quando ela está ligada e "N sources", como as linhas da treeview da 008.
- **FR-003**: O sistema de uma fonte MUST vir de uma regra com prova por referência (o bloco do jogo que a fonte chama ou o que escreve o cache que ela lê). Uma fonte sem regra MUST ir para "🔹 Other". Uma fonte nunca vai para um sistema por palpite.
- **FR-004**: Os grupos MUST seguir a ordem da V1 da bancada. Os sistemas fora da V1 vêm depois, na ordem em que aparecem na conta, e "Other" por último. Um grupo de sistema que soma 0 ou multiplica ×1 MUST ficar no lugar dele nessa ordem, com o valor 0 ou ×1, e não vai para "At 0"/"At ×1". Dentro de um grupo, MUST valer a ordem do jogo, com os grupos "Small", "At 0" e "At ×1" da FR-014 da 008 para as fontes.
- **FR-005**: O primeiro nível de toda árvore MUST ser os pools do próprio jogo, na ordem em que o jogo calcula, com os grupos por sistema dentro de cada pool. Um pool cujos bônus o jogo soma antes de a soma entrar na conta MUST se chamar "Additive pool"; um pool que multiplica tudo MUST se chamar "Multi pool"; com mais de um do mesmo tipo, eles levam um número na ordem da conta ("Multi pool 1", "Multi pool 2"). O ⓘ da raiz MUST mostrar como os pools se juntam (por exemplo, "Additive pool × Multi pool 1 × Multi pool 2"). Vale também quando a raiz só soma ou só multiplica. No Drop Rate, os pools MUST ser os da V1 (LUK Scaling, Additive Pool, Total Sum, Post-Processing). Um fator do jogo que soma bônus de dois sistemas antes de multiplicar é um Additive pool com os dois sistemas dentro. O nome nunca usa código do jogo.
- **FR-006**: Um grupo com uma única fonte de mesmo valor MUST mostrar só a fonte.
- **FR-007**: Em qualquer nível, um galho de conta sem nome provado (sem código do jogo e sem nome provado) MUST NOT virar linha: as partes dele sobem para a linha de cima, e o ⓘ dessa linha MUST mostrar a conta inteira e fechar com os números das partes. Um nome só por forma (como "Multiplier" ou "Fixed +2") não segura a linha.
- **FR-008**: Cada nível MUST somar (ou multiplicar) até o pai, como na 008. Nenhuma fonte e nenhum valor MUST sumir da tela por causa do molde.
- **FR-009**: As chaves de peça e de número que os Pins, as marcas, o radar de patch e "Where this goes" usam MUST continuar as mesmas da 008.
- **FR-010**: A árvore do Drop Rate MUST sair igual à V1 da bancada sobre o mesmo retrato: os mesmos pools, os mesmos grupos na mesma ordem e com os mesmos valores, e as mesmas fontes em cada grupo. A comparação MUST ser um teste rodado pela receita de paridade da 008, fora da CI.
- **FR-011**: Os grupos e os pools MUST seguir as regras de honestidade e de texto da 008: nenhum código do jogo no nome (FR-012a), nenhum nome de personagem, só átomos na saída do worker (FR-010) e a conferência do main antes da janela (FR-010b).
- **FR-012**: Quando a árvore abre, todos os pools e grupos de sistema MUST começar fechados; o jogador abre cada um.
- **FR-013**: A árvore MUST ter um botão "Changes", desligado por padrão. Ligado, cada linha (pool, grupo, fonte e partes) MUST mostrar uma seta com quanto o valor mudou: verde para cima e vermelha para baixo; numa linha "+%", a diferença em pontos ("▲ +10%"); numa linha "×", a diferença no multiplicador ("▲ +0.12"). O jogador escolhe contra o que comparar: "live", que guarda a árvore como estava no clique e compara a partir dali, ou uma marca gravada ("Mark before" da 008). A escolha da marca MUST NOT ficar salva: ao abrir o app, o Changes ligado começa em "live". Desligado, nenhuma marca de mudança aparece. Isso substitui, na árvore, o "was …" depois do Refresh, a linha que acende com "Game changed" e o "mark …" escrito da 008. Quando uma fonte de dentro não pôde ser calculada, o grupo MUST ficar "unavailable" e o resto da árvore segue, como na 008.
- **FR-014**: A fatia de cada linha MUST ficar escondida por padrão; um botão mostra ou esconde. Ligada, cada linha mostra só o número da fatia ("26%"), sem texto extra.
- **FR-015**: Os valores da árvore aberta MUST se atualizar em tempo real, sem botão de Refresh. A faixa "Game changed · Refresh" da 008 MUST sair. Quando o jogo muda a forma da árvore (uma fonte aparece ou some), a árvore MUST se refazer sozinha.

### Non-Functional Requirements

- **NFR-001 (tempo)**: Com o molde, a árvore do Drop Rate MUST abrir em até 5 s, o mesmo limite da SC-005 da 008, e a Stats MUST continuar abaixo de 1 s com a árvore aberta (SC-004 da 008).
- **NFR-002 (ao vivo)**: Os valores e as setas da árvore aberta MUST se atualizar a cada leitura do jogo (1 s), como os valores ao vivo da 008.
- **NFR-003 (limite)**: O app MUST acompanhar ao vivo até 200 partes da árvore aberta, o limite da 008; além disso, a parte mostra o último valor montado e nenhuma seta.
- **NFR-004 (acessibilidade)**: Os botões "Changes" e fatia MUST ser alcançáveis pelo teclado e lidos pelo leitor de tela com o nome e o estado (ligado ou desligado); as linhas seguem a FR-002.
- **NFR-005 (registro)**: Uma falha do molde MUST deixar uma linha de log com um rótulo e o id do catálogo, nunca um nome nem um valor (como o `treeRejected` da 008).

### Security & Privacy

- **SEC-001 (só leitura)**: O molde MUST NOT chamar função do jogo nem gravar no save; ele só reorganiza a árvore já gravada.
- **SEC-002 (sem rede)**: Nada desta feature MUST usar a rede.
- **SEC-003 (sem código do jogo)**: O nome de um pool ou de um grupo MUST NOT ter código do jogo (FR-012a da 008); a conferência do main recusa a árvore que tiver.
- **SEC-004 (sem nome de personagem)**: Nenhum nome de personagem MUST aparecer em pool, grupo, log, preferência salva, teste ou documento.
- **SEC-005 (preferências)**: As preferências salvas MUST ser só os dois estados dos botões (ligado ou desligado), nesta máquina; nenhum valor da árvore, nenhuma marca escolhida.
- **SEC-006 (entrada da janela)**: O main MUST aceitar da janela, para as preferências, só esses dois estados e nada mais.

### Key Entities

- **Pool:** uma etapa da conta do jogo: um Additive pool (soma os bônus antes) ou um Multi pool (multiplica tudo), na ordem da conta. Tem um nome (os da V1 no Drop Rate; nas outras árvores, "Additive pool"/"Multi pool N", FR-005), um valor, uma fatia e os grupos de sistema dentro.
- **Grupo de sistema:** um sistema do jogo, com emoji e nome, dentro da raiz ou de um pool. Tem um valor (a soma ou o produto das suas fontes), uma fatia e as fontes.
- **Regra de sistema:** liga um bloco do jogo, ou uma leitura, a um sistema, com prova por referência.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Medido no jogo instalado, nas 716 árvores do catálogo, 0 linhas de galho de conta mostram `no name yet` (hoje são 1.625).
- **SC-002**: O Drop Rate sobre o retrato do personagem 9 tem 0 diferenças com a V1 da bancada em pools, grupos, ordem, valores e fontes por grupo.
- **SC-003**: Nas 716 árvores, cada nível soma (ou multiplica) até o pai, com 0 exceções, e nenhuma fonte some.
- **SC-004**: Em 5 segundos, um jogador que nunca viu o app diz qual sistema mais pesa no Drop Rate dele, pelo primeiro nível da árvore. É o teste dos 5 segundos da 008, repetido.

### How each requirement is checked

| Requisito | Como é conferido |
| --- | --- |
| FR-001, FR-005, FR-006 | Teste de unidade dos pools e do molde no jogo inventado: os pools, os nomes e a ordem; a fonte única; tudo em "Other" |
| FR-002, FR-004, FR-012 | Teste do molde (ordem, valor, grupo neutro) e teste da janela (fechados, formato do valor, leitor de tela) |
| FR-003 | Teste da tabela de sistemas: cada entrada com prova, bloco desconhecido vai para "Other"; a sonda conta as fontes em "Other" |
| FR-007 | Teste do achatamento: o ⓘ fecha, nome por forma não segura, nome provado segura; SC-001 pela sonda |
| FR-008 | Teste de que cada nível fecha com o pai; SC-003 pela sonda |
| FR-009 | Teste de que pool e grupo não têm peça, e de que uma marca da 008 compara por peça |
| FR-010 | Teste de paridade com a V1 (`just parity`, fora da CI); SC-002 |
| FR-011, SEC-001 a SEC-006 | Teste da conferência do main (papéis, campos, sem peça em pool, sem código no nome) e do canal de preferências |
| FR-013, FR-014, FR-015 | Teste das setas (formatos, base "live" e marca, fonte sem cálculo), dos botões e da árvore ao vivo sem Refresh |
| NFR-001, NFR-002 | Medido no jogo real (quickstart, com o jogo aberto) |
| NFR-003 | Teste: parte além do limite sem seta |
| NFR-004 | Teste da janela: os botões no teclado e o leitor de tela |
| NFR-005 | Teste: a falha do molde gera a linha de log sem nome nem valor |

### Definition of Done

A verificação da 009 termina quando todas estas condições valem:
1. `just check` verde, com todos os testes acima.
2. `just parity` com 0 diferenças na V1 (SC-002).
3. A sonda das 716 árvores com 0 galhos de conta sem nome (SC-001) e 0 níveis que não fecham (SC-003).
4. O roteiro com o jogo aberto (`quickstart.md`) feito com o app empacotado, incluindo a NFR-001 e a NFR-002.
5. O teste dos 5 segundos (SC-004), com o resultado no `registro.md`.

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
| Como um pool ganha nome numa árvore que não é o Drop Rate? | resolved | Pelos pools do próprio jogo: "Additive pool" (soma antes) e "Multi pool" (multiplica tudo), na ordem da conta (Vinicius, 17/11) (FR-005) |
| Como se distinguem dois pools do mesmo tipo? | resolved | Padrão do agente: um número na ordem da conta, "Multi pool 1", "Multi pool 2" (FR-005) |
| Um grupo de sistema com valor neutro (0 ou ×1) vai para "At 0"/"At ×1" como uma parte, ou fica no lugar? | resolved | Fica no lugar, com o valor 0 ou ×1 (Vinicius, 17/11) (FR-004) |
| Os grupos de sistema começam abertos ou fechados? | resolved | Todos fechados (Vinicius, 17/11) (FR-012) |
| Em que formato aparece o valor de um grupo de sistema (CHK002)? | resolved | Padrão do agente: o mesmo das partes da 008, "×1.06" para o que multiplica e "+80%" para o que soma (FR-002) |
| O que o leitor de tela anuncia numa linha de pool ou grupo (CHK003)? | resolved | Padrão do agente: nome, valor, a fatia quando ligada e "N sources", como a treeview da 008 (FR-002) |
| A resposta curta do topo muda com o molde (CHK004)? | resolved | Sai da tela; a árvore começa nos pools (Vinicius, 17/11) (FR-001) |
| Uma raiz que só multiplica tem pool (CHK014)? | resolved | Sim: cada fator do jogo é um pool (Vinicius, 17/11) (FR-005, US2) |
| Um fator que soma bônus de dois sistemas antes de multiplicar aparece como? | resolved | Um Additive pool com os dois sistemas dentro (Vinicius, 17/11) (FR-005) |
| Como um grupo se comporta no Refresh, em "Game changed" e com uma marca (CHK015, CHK016)? | resolved | Botão "Changes" desligado por padrão; ligado, setas ao vivo contra o momento em que ligou ou contra uma marca; substitui "was", o acender e o "mark" escrito (Vinicius, 17/11) (FR-013) |
| Como a fatia de cada linha aparece? | resolved | Escondida por padrão, num botão; ligada, só o número ("26%") (Vinicius, 17/11) (FR-014) |
| O que aparece quando todas as fontes caem em "Other" (CHK017)? | resolved | Padrão do agente: as fontes direto no primeiro nível, sem o grupo "Other" (FR-001) |
| E uma fonte que não pôde ser calculada dentro de um grupo (CHK018)? | resolved | Padrão do agente: o grupo fica "unavailable" e o resto segue, como na 008 (FR-013) |
| Numa linha "×", a seta do Changes mostra o quê? | resolved | A diferença no multiplicador, "▲ +0.12" (Vinicius, 17/11) (FR-013) |
| A faixa "Game changed · Refresh" continua? | resolved | Não; a árvore mostra os valores em tempo real, e o "live" guarda a árvore do clique (Vinicius, 17/11) (FR-013, FR-015) |
| A marca escolhida no Changes fica salva? | resolved | Não; o Changes ligado começa em "live" (Vinicius, 17/11) (FR-013) |
| O que acontece quando o jogo muda a forma da árvore aberta (uma fonte aparece ou some)? | resolved | Padrão do agente: a árvore se refaz sozinha, sem botão (FR-015) |
