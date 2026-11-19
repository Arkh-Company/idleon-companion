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

O jogador abre o Drop Rate na Stats. Logo no topo da árvore, em vez de uma cadeia de passos sem nome, ele vê os pools do jogo na ordem da conta (FR-005: "Additive pool 1", "Multi pool 1", "Additive pool 2", "Multi pool 2"…) e, dentro deles, um grupo por sistema com emoji ("🃏 Cards", "⚗️ Alchemy", "🐾 Companions"...), cada um com o seu valor. Abrindo um grupo, vê as fontes daquele sistema; abrindo uma fonte, vê a conta dela como hoje.

**Why this priority**: É a árvore mais aberta e a que mostrou o problema; a V1 da bancada é a referência que o Vinicius aprovou.

**Independent Test**: Com o retrato do personagem 9 sobre o jogo instalado, a árvore do Drop Rate tem no primeiro nível os pools da corrente do jogo (FR-005), cada pool fecha com o valor do jogo, as fontes são as mesmas da bancada, e nenhuma linha `no name yet` de passo de conta.

**Acceptance Scenarios**:

1. **Given** o Drop Rate aberto, **When** a árvore aparece, **Then** o jogador vê no primeiro nível os pools da corrente do jogo, fechados, e dentro deles os grupos por sistema na ordem da V1, cada um com o seu valor.
2. **Given** um grupo de sistema, **When** o jogador o abre, **Then** as fontes daquele sistema aparecem na ordem do jogo, e a soma (ou o produto) delas dá o valor do grupo.
3. **Given** um grupo com uma única fonte de mesmo valor, **When** a árvore aparece, **Then** só a fonte aparece, sem o grupo em volta (regra "Friends" da V1).
4. **Given** o worker não consegue montar a árvore do Drop Rate, **When** o jogador a abre, **Then** ele vê "unavailable" como na 008, e nunca uma árvore parcial com pools vazios.

---

### User Story 2 - Toda árvore agrupada por sistema (Priority: P2)

O jogador abre qualquer número do catálogo, como o HP máximo, um número de Smithing ou um bônus de Summoning. O primeiro nível são os pools do próprio jogo, na ordem da conta, e dentro de cada pool as fontes ficam agrupadas por sistema. Pelo pool, o jogador vê se um multiplicador multiplica tudo (Multi pool) ou se é diluído numa soma antes (Additive pool).

**Why this priority**: O Vinicius escolheu a regra geral para as 716 árvores, não um molde só do Drop Rate.

**Independent Test**: Nas 716 árvores, montadas sobre o jogo instalado, nenhum primeiro nível tem linha de passo de conta sem nome, e cada nível soma (ou multiplica) até o pai.

**Acceptance Scenarios**:

1. **Given** uma árvore cuja raiz só multiplica fontes, **When** ela aparece, **Then** os multiplicadores soltos ficam juntos num Multi pool, e cada multiplicador que soma bônus dentro fica no seu próprio Multi pool, com os sistemas dentro (FR-005).
2. **Given** uma árvore cuja raiz soma e depois multiplica, **When** ela aparece, **Then** o topo tem um Additive pool e um Multi pool na ordem da conta, o ⓘ da raiz diz "Additive pool × Multi pool", e os grupos por sistema ficam dentro de cada pool.
3. **Given** uma fonte cujo sistema o app não conhece, **When** a árvore aparece, **Then** ela fica no grupo "🔹 Other", no fim.
4. **Given** uma raiz cuja conta a regra dos pools não consegue ler (por exemplo, um `max` ou uma condição no topo), **When** a árvore aparece, **Then** o jogador vê as fontes direto no primeiro nível, agrupadas por sistema, sem pool inventado e sem árvore vazia. Num `max` ou `min` no topo, cada grupo faz a mesma conta da raiz sobre as suas fontes (o maior, ou o menor, de dentro), e a raiz é essa conta sobre os grupos, então o valor fecha até o pai.

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
- **FR-004**: Os grupos MUST seguir a ordem da V1 da bancada. Os sistemas fora da V1 vêm depois, na ordem em que aparecem na conta, e "Other" por último. Um grupo de sistema que soma 0 ou multiplica ×1 MUST ficar no lugar dele nessa ordem, com o valor 0 ou ×1, e não vai para "At 0"/"At ×1". Dentro de um grupo, MUST valer a ordem do jogo (FR-016).
- **FR-005**: O primeiro nível de toda árvore MUST ser os pools do próprio jogo, na ordem em que o jogo calcula, com os grupos por sistema dentro de cada pool. Um pool cujos bônus o jogo soma antes de a soma entrar na conta MUST se chamar "Additive pool"; um pool que multiplica tudo MUST se chamar "Multi pool"; com mais de um do mesmo tipo, eles levam um número na ordem da conta ("Multi pool 1", "Multi pool 2"). O ⓘ da raiz MUST mostrar como os pools se juntam (por exemplo, "Additive pool × Multi pool 1 × Multi pool 2"). Vale também quando a raiz só soma ou só multiplica. Os pools MUST seguir a corrente de passos do jogo (regra Y, decisão do Vinicius, 17/11, durante a implementação): somas seguidas formam um Additive pool; multiplicadores soltos seguidos (cada bônus multiplica sozinho, a ordem não muda nada) se juntam num único Multi pool, agrupado por sistema; um multiplicador que soma bônus dentro antes de multiplicar, como ×(1 + (a + b) ÷ 100), MUST ser o seu próprio Multi pool, com os bônus somados dentro, porque ali eles se diluem; cada troca de + para × abre um pool novo. Uma fórmula de um passo só é o caso mais simples da mesma regra. Toda árvore segue esta regra, o Drop Rate também; nenhuma usa molde feito à mão. O nome nunca usa código do jogo.
- **FR-006**: Um grupo com uma única fonte de mesmo valor MUST mostrar só a fonte.
- **FR-007**: Em qualquer nível, um galho de conta sem nome provado (sem código do jogo e sem nome provado) MUST NOT virar linha: as partes dele sobem para a linha de cima, e o ⓘ dessa linha MUST mostrar a conta inteira e fechar com os números das partes. Um nome só por forma (como "Multiplier" ou "Fixed +2") não segura a linha.
- **FR-008**: Cada nível MUST somar (ou multiplicar) até o pai, como na 008. Nenhuma fonte e nenhum valor MUST sumir da tela por causa do molde.
- **FR-009**: As chaves de peça e de número que os Pins, as marcas, o radar de patch e "Where this goes" usam MUST continuar as mesmas da 008.
- **FR-010**: A árvore do Drop Rate MUST ter as mesmas fontes da bancada, com os mesmos nomes, valores, tipos e sistemas (a bancada é a referência das fontes e dos nomes; o formato é o da 009), conferidas pela paridade da 008 (receita `just parity`, fora da CI), que atravessa os pools e os grupos. A estrutura de pools da V1 (LUK Scaling, Total Sum, Post-Processing) não é mais a referência (decisão do Vinicius, 17/11, durante a implementação).
- **FR-011**: Os grupos e os pools MUST seguir as regras de honestidade e de texto da 008: nenhum código do jogo no nome (FR-012a), nenhum nome de personagem, só átomos na saída do worker (FR-010) e a conferência do main antes da janela (FR-010b).
- **FR-012**: Quando a árvore abre, todos os pools e grupos de sistema MUST começar fechados; o jogador abre cada um.
- **FR-013**: A árvore MUST ter um botão "Changes", desligado por padrão. Ligado, cada linha (pool, grupo, fonte e partes) MUST mostrar uma seta com quanto o valor mudou: verde para cima e vermelha para baixo; numa linha "+%", a diferença em pontos ("▲ +10%"); numa linha "×", a diferença no multiplicador ("▲ +0.12"). O jogador escolhe contra o que comparar: "live", que guarda a árvore como estava no clique e compara a partir dali, ou uma marca gravada ("Mark before" da 008). A escolha da marca MUST NOT ficar salva: ao abrir o app, o Changes ligado começa em "live". Desligado, nenhuma marca de mudança aparece. Isso substitui, na árvore, o "was …" depois do Refresh, a linha que acende com "Game changed" e o "mark …" escrito da 008. Quando uma fonte de dentro não pôde ser calculada, o grupo MUST ficar "unavailable" e o resto da árvore segue, como na 008.
- **FR-014**: A fatia de cada linha MUST ficar escondida por padrão; um botão mostra ou esconde. Ligada, cada linha mostra só o número da fatia ("26%"), sem texto extra.
- **FR-017**: Dentro de um pool, em qualquer nível, as fontes MUST aparecer agrupadas por sistema: uma soma sem nome provado ("Multiplier from 23 sources") e um cache que a própria raiz escreve e que só junta fontes ("Drop Rate from LUK, second part") MUST se desfazer, e as fontes de dentro sobem para o pool e se agrupam por sistema (FR-002, FR-007); uma soma de bônus em % que o jogo divide por 100 se desfaz da mesma forma, e os grupos dela usam o modo de conta `percent` (soma ÷ 100), mostrando cada sistema em %. Uma fonte que é ela mesma um sistema calculado em corrente (por exemplo, a golden food dentro do Drop Rate: o grupo "🍔 Golden Food") MUST abrir com a regra da FR-005: os pools da corrente dela, com os sistemas que a alimentam agrupados dentro de cada pool; as partes da própria fonte (a quantidade da comida, as constantes do jogo) ficam como números no pool delas (decisão do Vinicius, 17/11, durante a implementação).
- **FR-018**: Cada fonte de bônus MUST mostrar a conta completa até o último filho possível: o nível que entra na conta é uma linha (com o ⓘ de como é somado); a curva vai no ⓘ, com as constantes nomeadas pelo papel; uma constante MUST ser linha quando é o bônus que aparece na tela do jogo (o bônus por nível de um talento, o bônus do nível 1 de uma carta) e, nos quatro casos do mockup de 18/11, as outras ficam só no ⓘ; nas demais árvores as constantes do código que já são linhas continuam linhas; as checagens de ramo ("Level ≤ 0", "is Prisma = 1", a escada "Sigil level < x.5") MUST NOT ser linhas e viram texto no ⓘ; cada multiplicador é a sua própria linha × e abre nos seus filhos; todo valor em que um sistema influi MUST mostrar esse sistema como filho, mesmo quando a contribuição é 0 (o Meritocracy multi abre no bônus do voto e nos sistemas que o multiplicam); um multiplicador que aparece de novo abre igual da primeira vez, como na 008 (decisão do Vinicius, 18/11).
- **FR-016**: Em nenhum nível da árvore MUST haver agrupamento automático de partes: os grupos "At 0", "At ×1" e "Small" e o botão "Show all N parts" da FR-014 da 008 MUST sair. Toda parte MUST aparecer no seu lugar, na ordem da conta do jogo; uma parte a 0 ou ×1 mostra o valor em cinza, e um 0 num produto mantém o aviso "zeroes the total" (decisão do Vinicius, 17/11, durante a implementação).
- **FR-015**: Os valores da árvore aberta MUST se atualizar em tempo real, sem botão de Refresh. A faixa "Game changed · Refresh" da 008 MUST sair. Quando o jogo muda a forma da árvore (uma fonte aparece ou some), a árvore MUST se refazer sozinha. As linhas que o jogador tinha aberto e que continuam existindo MUST ficar abertas. Quando um valor seguido muda, o app MUST pedir a árvore de novo em segundo plano (um pedido por vez, mantendo o que está aberto), para o ⓘ e a fatia fecharem com os valores ao vivo. Esse pedido MUST respeitar um intervalo de no mínimo 10 s desde a última árvore que chegou; entre um e outro, os valores ao vivo continuam chegando a cada leitura (NFR-002) e o pedido fica marcado para depois.

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

- **Pool:** uma etapa da conta do jogo: um Additive pool (soma os bônus antes) ou um Multi pool (multiplica tudo), na ordem da conta. Tem um nome ("Additive pool"/"Multi pool", com número na ordem da conta quando há mais de um do mesmo tipo, FR-005), um valor, uma fatia e os grupos de sistema dentro.
- **Grupo de sistema:** um sistema do jogo, com emoji e nome, dentro da raiz ou de um pool. Tem um valor (a soma ou o produto das suas fontes), uma fatia e as fontes.
- **Regra de sistema:** liga um bloco do jogo, ou uma leitura, a um sistema, com prova por referência.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Medido no jogo instalado, nas 716 árvores do catálogo, 0 linhas de galho de conta mostram `no name yet` (hoje são 1.625).
- **SC-002**: O Drop Rate sobre o retrato do personagem 9 tem 0 diferenças com a bancada na paridade da 008 (fontes e valores), e cada pool da corrente fecha com o valor do jogo.
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
- **Molde feito à mão por árvore:** nenhuma árvore tem molde à mão; o Drop Rate segue a regra geral da corrente (FR-005), como as outras.

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
| Os campos combine e poolKind são obrigatórios em toda linha ou opcionais? | resolved | durante a implementação: opcionais, só em pool e system, como was, cap e feeds da 008; nas outras linhas eles não aparecem (Vinicius, 17/11) |
| O filtro de nomes do main deve recusar um caminho como DNSM.X? | resolved | durante a implementação: o filtro fica como está (recusar texto com ponto derrubaria nomes do jogo como "Lv. 5"); um caminho do jogo como DNSM.X não deve chegar a nome, e as regras de nome não o produzem (Vinicius, 17/11) |
| Ligar o molde muda o primeiro nível das árvores que os testes da 008 conferem; como ligar? | resolved | durante a implementação: o molde fica sempre ligado; os testes da 008 passam a atravessar pool e grupo pelos ajudantes do tree-fixture, sem afrouxar asserção (Vinicius, 17/11) |
| Numa raiz com max ou min no topo, as fontes ficam soltas ou agrupadas? | resolved | durante a implementação: agrupadas por sistema; o grupo faz a mesma conta da raiz sobre as suas fontes (combine "max" ou "min"), e a raiz é essa conta sobre os grupos. Uma condição no topo espera a medida da sonda da T022 (Vinicius, 17/11) |
| Um fator ×1 do produto vira o seu próprio Multi pool ou vai para "At ×1"? | resolved | durante a implementação: cada um fica no lugar, na ordem da conta, com o valor ×1, como os grupos neutros (Vinicius, 17/11) |
| Os grupos "At 0", "At ×1" e "Small" e o botão "Show all" da 008 continuam dentro das fontes? | resolved | durante a implementação: não, saem de todos os níveis; toda parte aparece no seu lugar, na ordem da conta (Vinicius, 17/11) (FR-016) |
| Os pools do Drop Rate seguem a V1 (LUK Scaling, Total Sum, Post-Processing) ou a regra geral? | resolved | durante a implementação: a regra geral, que passa a seguir a corrente de passos (regra Y): somas seguidas = Additive pool; multiplicadores soltos seguidos = um Multi pool; multiplicador que soma bônus dentro = Multi pool próprio. Vale para toda árvore; a estrutura da V1 sai (Vinicius, 17/11) (FR-005, FR-010, SC-002) |
| Uma fonte que é um sistema com corrente (golden food) dentro de outra árvore abre como? | resolved | durante a implementação: como o topo, com os pools da corrente dela e os sistemas que a alimentam dentro; as somas sem nome e o cache que a raiz escreve se desfazem para os sistemas aparecerem no pool (Vinicius, 17/11) (FR-017) |
| A conta "soma ÷ 100" dos bônus em % ("Multiplier from 23 sources") fica como linha? | resolved | durante a implementação: não; o pool mostra os sistemas direto, cada um em %, e o app ganha o modo de conta `percent` (soma ÷ 100) para os grupos e as setas (Vinicius, 17/11) (FR-017) |
| Quando a árvore se refaz sozinha (FR-015), o que estava aberto continua aberto? | resolved | durante a implementação: sim; as linhas abertas que continuam existindo ficam abertas, só o que é novo aparece fechado (Vinicius, 17/11) (FR-015) |
| Com a árvore ao vivo, o ⓘ e a fatia ficam com os números da montagem? | resolved | durante a implementação: não; quando um valor seguido muda, a árvore é pedida de novo em silêncio, um pedido por vez, mantendo o que está aberto (Vinicius, 18/11) (FR-015) |
| Com um valor que muda a cada segundo, a remontagem em silêncio prende o worker; qual o ritmo? | resolved | durante a implementação: no máximo uma remontagem a cada 10 s; os valores ao vivo seguem a cada 1 s (Vinicius, 18/11) (FR-015, NFR-002) |
| A sonda das 716 árvores achou 435 sem pool nem grupo (raiz sem ⓘ legível), 306 galhos sem nome e 920 fontes em "Other"; a 009 fecha assim? | resolved | durante a implementação: não; a 009 é completada antes do fim (T025 a T028): toda árvore recebe o molde, os galhos sem nome somem, as constantes saem dos grupos e a tabela de sistemas cresce (Vinicius, 18/11) |
| As 261 árvores cuja conta não soma nem multiplica bônus (célula de tabela, leitura, contagem, divisão, potência, teto) recebem pool? | resolved | durante a implementação: não; ficam com a lista de fontes da 008 e o ⓘ da conta (Vinicius, 18/11) (FR-005) |
| Os 378 galhos sem nome que sobram (valores intermediários transformados, sem nome no jogo) | deferred | numa feature depois da 009, com a lista da sonda; o SC-001 desta feature fica com esse número medido (Vinicius, 18/11) |
| Nomes e emojis dos sistemas fora da V1 | resolved | durante a implementação: 🍲 Meals, 💰 Bribes, 🫧 Jelly Operator, ⚛️ Atom Collider, 🧭 Compass, 🎮 Gaming, 🔦 Spelunking, 🪤 Trapping, ⛵ Sailing, 🧪 Lab; o Arcade passa de 🎮 para 🕹️ para o Gaming ficar com o controle (Vinicius, 18/11) |
| Contra o que a paridade do Drop Rate compara, se o arquivo da bancada é a V1 feita à mão? | resolved | durante a implementação: a bancada é a referência das fontes e dos nomes (é o que ela pesquisou); o formato fica o da 009. A paridade compara fonte por fonte (nome, valor, tipo e sistema), sem comparar a estrutura, e o app passa a usar os nomes que a bancada tem e ele não tem (Vinicius, 18/11) (FR-010, SC-002) |
| Um talento multiplicado por uma contagem ("Boss Battle Spillover", "Graded Rate") cai em Other | resolved | durante a implementação: fica no sistema do talento (🎯 Talents), com o nome do talento, como na V1 (Vinicius, 18/11) (FR-003) |
| As 618 diferenças com a bancada atual (regras de nome, tipo e linha que a bancada ganhou depois do BASELINE-4 que o app portou) entram na 009? | resolved | durante a implementação: sim, portar tudo agora, família por família, com teste, valendo para todas as árvores (Vinicius, 18/11) (FR-010, SC-002) |
| Nome de leitura que a bancada deixa como caminho cru ("Dream[13]", "Holes[6][3]") | resolved | durante a implementação: nunca caminho cru; tudo tem nome no jogo, e onde a bancada ainda não achou, a gente investiga e traz o nome do jogo (Vinicius, 18/11) |
| Nomes de contador em que app e bancada discordam ("Minehead Opponents Defeated" × "Minehead counter") | resolved | durante a implementação: fica o texto do jogo, o do app (Vinicius, 18/11) |
| Prefixo do sistema no nome ("Arcade: Drop Rate" × "Drop Rate") | resolved | durante a implementação: fica o do app, com o prefixo (Vinicius, 18/11) |
| Nome das condições ("Achievement = -1" × "Achievement completed") | resolved | durante a implementação: fica o da bancada, o que a condição significa (Vinicius, 18/11) |
| As 17 árvores com um floor que corta (STR, AGI, WIS, LUK…) | resolved | durante a implementação: voltam a ter pool, com o floor à vista no ⓘ da raiz (Vinicius, 18/11) (FR-005, FR-008) |
| Talento, bubble, sigil e constantes da conta (Domeo Magmus) | resolved | durante a implementação: cada bônus mostra a conta completa até o último filho possível (FR-018): o nível que entra na conta é uma linha, com o ⓘ da soma; a curva fica no ⓘ com as constantes nomeadas; uma constante vira linha quando é o bônus que aparece na tela do jogo (o bônus por nível do talento, o bônus do nível 1 da carta); as checagens de ramo não são linhas; cada multiplicador é a sua linha × e abre nos filhos dele (Prisma, Meritocracy…). Exemplos aprovados no mockup de 18/11: Haungry For Gold, Shimmeron, Emoji Veggie, Domeo Magmus com "Bonus per level" (Vinicius, 18/11) |
| Constantes do código nas árvores fora dos quatro casos ("Base 1", "÷ 100", "Cap N"…) | resolved | durante a implementação: continuam linhas, como estão; todo valor em que um sistema influi mostra esse sistema como filho (o Meritocracy multi abre nos sistemas que o impactam) (Vinicius, 18/11) (FR-018) |
| Um multiplicador que aparece duas vezes (o Prisma multi no Shimmeron) | resolved | durante a implementação: abre igual nas duas vezes, como na 008; o "shown earlier" fica para depois (Vinicius, 18/11) (FR-018) |
| Os 12 bônus de família com o nome de outra classe (a chave 2 × c lida como a classe k) | resolved | durante a implementação: corrigir; a chave k do bônus de família é a classe k ÷ 2 (prova no N.js: TalentCalc, a tela de bônus de família, FamilyBonsuesREAL) (Vinicius, 18/11) |
| O máximo dos Points de um Legend Talent | resolved | durante a implementação: o máximo é o do jogo (`LegendTalent_MaxLV`), nunca uma lista nossa; o Points mostra "(max N)" e abre no filho "Max points", que abre nos sistemas que o formam (o máximo da tabela, o Research grid, a Menagerie). É uma exceção à FR-008: o máximo é um teto, não entra na conta, e o Points não fecha com ele; o Points nunca herda o ⓘ do máximo (Vinicius, 18/11) (FR-018) |
| "x% reached" numa curva multiplicada por outro fator (Bubble bonus = curva × Prisma) | resolved | durante a implementação: a linha abre nos filhos dela e o ⓘ mostra quanto do máximo a curva sozinha atingiu (Vinicius, 18/11) (FR-018) |
| Comentários no código com a conta do jogo | resolved | durante a implementação: a conta fica em notação de matemática, com as nossas palavras, sem trecho nem sintaxe do código do jogo (Vinicius, 18/11) |
| Sistemas em galhos que o jogo não rodou (só aparecem com uma chamada extra) | resolved | fora do escopo: uma feature depois acha esses galhos e trata todos de uma vez; na 009 fica só o Meritocracy e o máximo do Legend Talent (Vinicius, 18/11) |
| Peças com dois valores na paridade (a checagem código × valor da bancada) e a forma das cartas | resolved | durante a implementação, como regra para todas as árvores: uma leitura de caixa de rascunho mostra o número que o jogo usou naquele ponto e o nome do que ele é (nunca o de outra escrita na mesma caixa); a mesma caixa lida em momentos diferentes é uma peça diferente; nas cartas, o nível é a linha "Card level" e o bônus da tabela da carta é "Bonus per level", como no Domeo Magmus; as checagens de estrela ("Card stars < 7") vão para o ⓘ; "Cards collected" sem valor e "Formula of 2 sources" ganham valor e nome do jogo (Vinicius, 18/11) (FR-007, FR-010, FR-018) |
| A escrita exata de uma leitura dentro dos passos do escritor (caixa usada como contador: `CalcTalentDN2` nos bubbles Slab e Tome, `HoleozDN` no monumento do Holes) | deferred | numa correção própria logo depois do merge da 009 (`fix/scratch-write-identity`): levar a posição da leitura até a linha, dar os nomes do jogo já achados ("Base AGI and LUK per 100 items found, shown on The Slab", "% AGI for every 2000 Tome Completion Points over 5000", "x Wisdom / Justice / Bravery Bonuses Multi") e não perder a fonte de uma caixa que soma 0; até lá elas ficam com o nome genérico (Vinicius, 19/11) |
| Os testes da 008 da faixa "Game changed · Refresh", do "was", da linha que acende e do resumo mudam? | resolved | durante a implementação: os que só conferem o que a spec tira saem com o código; os que conferem algo que fica são reescritos com os mesmos campos (Vinicius, 17/11) (FR-001, FR-013, FR-015) |
| Os 12 testes da 008 da golden food aberta como ramo mudam? | resolved | durante a implementação: sim, passam a conferir os pools da corrente com as mesmas fontes e valores; as linhas antigas seguem testadas na golden food que não é corrente (Vinicius, 17/11) |
| Os sistemas que só dão bônus a outros números (Golden Food, Cards, Companions… 22 sem árvore e 7 com 1 ou 2) ganham árvore própria? | deferred | depois da 009, numa feature nova (Vinicius, 17/11) |
| Os nomes "log₁₀" e "Fixed ×0.05" das partes da golden food | deferred | o Vinicius quer arrumar depois (17/11) |
