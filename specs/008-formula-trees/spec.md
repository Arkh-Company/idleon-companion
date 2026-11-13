# Feature Specification: Árvores de fórmula ao vivo e painéis por sistema (formula-trees)

**Feature Branch**: `spec/008-formula-trees`

**Created**: 2026-11-12

**Status**: Draft

**Input**: desenho aprovado pelo Vinicius no brainstorming de 12/11/2026, a partir da entrada da 008 (v5.1, base BASELINE-3.1, commit 3abbb53 da bancada), das respostas de 12/11 e do levantamento das árvores por sistema. Anexos: [design.md](design.md) (a tela, a acessibilidade e os cenários de teste) e [catalogo-de-arvores.md](catalogo-de-arvores.md) (cada árvore possível, por sistema, com o estado).

## Por que esta feature

A missão do app (constituição 1.3.0, emenda do PR #26) é mostrar ao jogador, ao vivo e ao lado do jogo, onde ele está, como os sistemas calculam seus números e quanto ele ganha enquanto joga. Hoje o app mostra 11 números na aba Stats e não diz de onde nenhum deles vem.

A bancada de pesquisa já provou, contra o código do próprio jogo, as árvores de fórmula ("de onde vem este número") de centenas de números. São 528 provadas e mais de 500 possíveis: os stats, cada skill e cada sistema. O app já reconhece a tela de cerca de 100 sistemas. As ferramentas da comunidade reescrevem as fórmulas à mão, divergem do jogo e não acompanham a tela aberta.

O Vinicius quer "muito mais que os 11 stats", com as palavras dele:
- a árvore de todo número que dá para provar;
- um painel para cada sistema, que aparece sozinho quando o sistema aparece no jogo.

São dois públicos: o jogador com pouca experiência, que precisa entender em segundos, e o endgame que otimiza.

**Regra central: o número é o do jogo.** O código do jogo calcula tudo, isolado e sem rede (ADR 0006). As regras da bancada só nomeiam e explicam o que o jogo calculou, e nada é reescrito à mão.

## Clarifications

### Session 2026-11-12 (brainstorming)

- Q: Até onde vai a 008? → A: Todas as árvores do levantamento, menos as 52 "sem bloco". Entram as candidatas e as que precisam do jogo vivo. As candidatas passam antes por gravação e auditoria na bancada, e a 008 espera essa auditoria antes do plano.
- Q: Como as árvores ficam em dia? → A: Tudo ao vivo, sempre. Se o protótipo mostrar que não cabe, o plano B é ao vivo só o que está à vista e o resto ao abrir.
- Q: O que o painel de um sistema mostra? → A: Os dois: em cima os números que o jogo não mostra, embaixo a árvore do sistema. Todo número do painel abre a própria árvore, inclusive o gilded chance.
- Q: Quando a tela de um sistema abre no jogo? → A: O companion troca sempre para o painel daquele sistema.
- Q: Onde a árvore abre? → A: Num painel lateral. A janela alarga de 420 para cerca de 840 px e volta ao fechar. O painel lateral não muda quando o jogador troca de sistema no jogo: só fecha no ✕, e só muda quando ele toca em outra árvore.
- Q: Em que ordem os sistemas entram? → A: Os prontos primeiro.
- Q: O que entra de Stamps? → A: Custo e teto, passou do nível, gilded e exaltados. Bribes ficam fora.
- Q: Quais extras entram? → A: Where this goes, Pin, Antes/depois, Radar de patch e o acompanhador de farm.
- Q: Como mostrar quantos números uma peça alimenta? → A: Uma bolinha com o número, só quando a peça alimenta 2 ou mais números conhecidos.
- Q: O acompanhador de farm mede ou calcula? → A: Só medido: o que de fato aconteceu enquanto o jogador jogava.
- Q: E as árvores "sem bloco" e as de "jogo vivo"? → A: As sem bloco ficam fora como número próprio. As de jogo vivo entram, lendo os campos do ator ao vivo, só por leitura.

### Session 2026-11-12 (respostas às perguntas da entrada, ainda valendo)

- Q: A cópia instrumentada do código do jogo pede emenda? → A: Cabe, sem emenda. A cópia existe só em memória, provada por teste.
- Q: Como a Stats vira porta? → A: A tabela continua tabela, e só o número da linha vira botão.
- Q: E se a raiz da árvore diferir da Stats? → A: É defeito. A tela mostra só o número da Stats e "Breakdown unavailable", e o caso fica registrado. A paridade vale para o personagem ativo.
- Q: E com o jogo fechado ou com troca de personagem? → A: Na troca, recalcula. Com o jogo fechado, a árvore e a Stats ficam com a última leitura e "last reading N s ago" (isso muda a 004).
- Q: Como a árvore se abre? → A: Expande no lugar, como pastas. Na 008, isso vale dentro do painel lateral.
- Q: E o personagem? → A: Abre no ativo, com um seletor para os outros. Um inativo leva a faixa "not the active character".
- Q: Os rótulos? → A: Aprovados: `saved by the game`, `no name yet`, `shown earlier`, só "parts", `repeated step`, `changes while you play`. Ficam como estão o `?` e o `Raw bonus`.

## User Scenarios & Testing *(mandatory)*

Os números de exemplo são do retrato da bancada, e o personagem aparece sempre como "Character N (class)". Nenhum teste escreve esses números à mão: todos vêm do arquivo de base (BASELINE-3.1) ou do jogo falso dos testes.

### User Story 1 - Por que meu Drop Rate é X? (Priority: P1)

Na aba Stats, o jogador toca no valor do Drop Rate. A janela alarga, e o painel lateral abre a árvore. No topo aparece a resposta curta: o valor, igual ao da Stats, e uma frase com a maior parte de cada etapa. Depois vêm as três etapas do jogo. O jogador abre os ramos no lugar, até a folha.

**Why this priority**: é a pergunta que a feature responde, e é o motor de todas as outras histórias.

**Independent Test**: com o jogo falso, tocar no valor abre a árvore. A raiz é igual ao número da Stats, e cada nó aberto mostra as suas partes.

**Acceptance Scenarios**:

1. **Given** a aba Stats com números, **When** o jogador toca no valor do Drop Rate, **Then** a janela alarga e o painel lateral mostra a árvore, com a raiz igual ao texto da Stats, caractere por caractere.
2. **Given** a árvore aberta, **When** o jogador abre um ramo, **Then** os filhos aparecem logo abaixo dele, na ordem do jogo, e vários níveis cabem na mesma tela.
3. **Given** o retrato da base congelada, na máquina do Vinicius, **When** se compara a árvore do app com a da bancada, **Then** há 0 diferenças em valor, tipo, ⓘ e "?". Os nomes também batem, menos os da lista aprovada de linhas que dependem do índice da 007.
4. **Given** o painel lateral aberto, **When** o jogador toca no ✕, **Then** o painel fecha e a janela volta a 420 px.

---

### User Story 2 - Todos os números provados (Priority: P2)

A aba Formulas mostra o catálogo de todos os números que têm árvore, agrupados por sistema e por skill, cada um com o valor ao vivo. Um toque abre a árvore no painel lateral. A Stats continua com as suas 10 linhas e 11 números, e a linha Damage abre duas árvores, Min e Max.

**Why this priority**: o Vinicius quer todos os números, não só os 11. É a mesma árvore da US1, aplicada ao catálogo inteiro.

**Independent Test**: com o jogo falso, os números da aba Formulas são os do catálogo declarado. Os 11 números da Stats aparecem nele com o mesmo valor da Stats, e um toque abre a mesma árvore que a Stats abre.

**Acceptance Scenarios**:

1. **Given** a aba Formulas, **When** o jogador abre o grupo de uma skill, **Then** cada número do grupo aparece com o valor ao vivo e abre a sua árvore.
2. **Given** um número que está na Stats e na aba Formulas, **When** o jogador o abre pelas duas portas, **Then** a árvore é a mesma.
3. **Given** os 11 números da Stats, **When** se compara a raiz de cada um com a Stats no mesmo estado, **Then** são iguais.

---

### User Story 3 - O painel segue a tela do jogo (Priority: P3)

O jogador abre Stamps no jogo. O companion troca sozinho para o painel de Stamps:
- em cima, os números que o jogo não mostra;
- embaixo, a árvore do sistema, com de onde vem cada bônus, quanto pesa e o que vale zero.

Fechou a tela no jogo e abriu outra de um sistema com painel, o companion troca de novo. O painel lateral que estiver aberto não muda.

**Why this priority**: é o "painel que aparece quando o sistema aparece", o segundo pedido do Vinicius. Começa pelos sistemas prontos.

**Independent Test**: com o jogo falso, uma leitura da tela de um sistema com painel faz a janela mostrar aquele painel. Uma árvore aberta no painel lateral continua a mesma.

**Acceptance Scenarios**:

1. **Given** o companion em qualquer aba, **When** a tela de Stamps abre no jogo, **Then** o companion mostra o painel de Stamps.
2. **Given** o painel lateral com a árvore do Drop Rate, **When** a tela de Stamps abre no jogo, **Then** o painel de Stamps aparece e o painel lateral continua com o Drop Rate.
3. **Given** um sistema sem tela reconhecida (por exemplo Rift ou Companions), **When** o jogador procura a árvore dele, **Then** ela está na aba Formulas.
4. **Given** todo sistema do catálogo com tela reconhecida, **When** essa tela abre, **Then** existe um painel para ele.

---

### User Story 4 - Números que o jogo não mostra (Priority: P4)

No painel de Stamps, o jogador vê:
- o custo exato do próximo nível de cada carimbo;
- quais carimbos não cabem no teto de capacidade;
- quais passaram do nível, com o déficit;
- a chance dourada;
- quantos carimbos estão exaltados.

Cada um desses números abre a própria árvore. O mesmo vale para os números que o jogo não mostra nos outros sistemas do catálogo.

**Why this priority**: é a metade de cima do painel, que responde "por que não sobe", e depende da auditoria das candidatas na bancada.

**Independent Test**: com o jogo falso, cada número "não mostrado" declarado no catálogo aparece no painel com valor ou selo, e um toque abre a árvore dele.

**Acceptance Scenarios**:

1. **Given** o painel de Stamps, **When** o jogador toca na chance dourada, **Then** o painel lateral abre a árvore dela.
2. **Given** um custo que o jogo devolve como lista (material e quantidade), **When** ele aparece no painel, **Then** mostra o material e a quantidade, e a árvore explica a quantidade.
3. **Given** um valor que o jogo guarda pronto, sem conta (como o teto de nível), **When** ele aparece, **Then** leva o selo `from the game`, sem árvore embaixo.

---

### User Story 5 - Ler a árvore: conta, tipos e honestidade (Priority: P5)

Numa linha, o jogador abre "How it adds up" e vê a conta com nomes e com números.

- **Toda folha tem o selo do tipo**, com uma frase do que o tipo é e de como mudá-lo. Os tipos são Level, Quantity, Fixed value, Raw bonus, Condition, Choice, Tier, Record e Invested points.
- **Todo caso que não fecha tem um selo com texto**, e o resto da árvore continua (tabela em FR-012).
- **Em cada nó aberto**, as partes que valem 0 vão para "At 0 (N)" e as que pesam quase nada para "Small (N)". As duas linhas começam fechadas, e nada some.

**Why this priority**: é o que torna a árvore legível para o iniciante e confiável para quem valida.

**Independent Test**: o jogo falso produz cada tipo e cada caso de honestidade, e cada um aparece com o seu texto.

**Acceptance Scenarios**:

1. **Given** um ramo com ⓘ na bancada, **When** ele aparece no app, **Then** tem ⓘ, e o resultado escrito é igual ao valor da linha.
2. **Given** uma folha com tipo, **When** ela aparece, **Then** mostra o selo e a frase.
3. **Given** um nó aberto, **When** se somam as partes mostradas, "Small" e o resto, **Then** o total é o do pai, e os membros de "At 0" são os mesmos da bancada.

---

### User Story 6 - Comparar: ao vivo e Antes/depois (Priority: P6)

O jogador tira um item no jogo. A Stats muda em menos de 1 s. A árvore aberta mostra "Game changed · Refresh", e no Refresh cada linha que mudou mostra "was …". Antes de uma troca maior, o jogador toca em "Mark before", troca equipamento e talentos, e a árvore mostra cada diferença desde a marca.

**Why this priority**: troca no jogo e vê qual linha mudou, que é a dor do endgame.

**Independent Test**: um roteiro de 10 trocas de item. Depois de cada Refresh, a raiz é igual à Stats. Com uma marca, as diferenças mostradas são as do estado marcado contra o atual.

**Acceptance Scenarios**:

1. **Given** uma árvore aberta, **When** só um contador de kills ou um timer muda, **Then** "Game changed" não acende.
2. **Given** uma marca, **When** o jogador muda um item que pesa no número, **Then** a linha do item mostra o valor da marca e o atual.

---

### User Story 7 - Pin (Priority: P7)

O jogador fixa um número ou uma folha, como o gilded chance. Ele fica sempre visível na barra do companion e acende quando muda.

**Why this priority**: acompanhar um número enquanto joga, sem abrir nada.

**Independent Test**: com o jogo falso, um número fixado aparece na barra, e a mudança de valor o acende.

**Acceptance Scenarios**:

1. **Given** um número fixado, **When** o valor muda no jogo, **Then** a barra mostra o novo valor e o marca como mudado.

---

### User Story 8 - Where this goes (Priority: P8)

Numa peça que alimenta 2 ou mais números conhecidos, uma bolinha mostra quantos. Por exemplo, um carimbo que entra no Drop Rate e no Damage. Um toque lista quais números ela alimenta, e cada um abre a sua árvore.

**Why this priority**: mostra o peso de uma peça na conta inteira, a partir das peças que já estão provadas.

**Independent Test**: no jogo falso, uma peça usada em 3 números mostra a bolinha "3", e uma usada em 1 não mostra nada.

**Acceptance Scenarios**:

1. **Given** uma peça que aparece em várias árvores (a mesma chamada do jogo com os mesmos argumentos), **When** ela é mostrada, **Then** a bolinha diz em quantos números ela está.

---

### User Story 9 - Acompanhador de farm (Priority: P9)

Enquanto o jogador farma, o companion mede, a partir do que observa:
- o XP por hora;
- os itens por hora;
- o gold por hora.

**Why this priority**: é a parte nova da missão, "quanto ele ganha enquanto joga".

**Independent Test**: com o jogo falso, uma sequência de estados com XP, itens e gold subindo dá a taxa por hora esperada.

**Acceptance Scenarios**:

1. **Given** o jogador farmando, **When** o XP sobe, **Then** o acompanhador mostra o XP por hora medido.
2. **Given** o jogo fechado ou o companion reiniciado, **When** o acompanhador volta, **Then** a medição recomeça, porque não guarda histórico em disco.

---

### User Story 10 - Radar de patch (Priority: P10)

Depois de uma atualização do jogo, o companion mostra quais árvores mudaram de forma desde a versão anterior. Por exemplo: "3 new parts in Drop Rate". Os valores continuam vindo do jogo vivo.

**Why this priority**: mostra o que o patch mexeu nas contas, coisa que nenhuma ferramenta faz.

**Independent Test**: com duas versões do jogo falso, uma árvore com uma parte a mais aparece no radar com a diferença.

**Acceptance Scenarios**:

1. **Given** a forma guardada da versão anterior, **When** o jogo atualiza, **Then** o radar lista as árvores que mudaram e o que mudou: partes novas, partes que sumiram e nomes.
2. **Given** a forma guardada em disco, **When** ela é revisada, **Then** contém só nomes de parte e chaves. Nunca valor, save ou nome de personagem.

---

### User Story 11 - Outro personagem (Priority: P11)

No seletor, o jogador escolhe um personagem que não está ativo. A árvore dele abre com a faixa "not the active character".

**Why this priority**: compara personagens sem trocar no jogo.

**Independent Test**: com o jogo falso de dois personagens, a árvore do inativo mostra a faixa e não é comparada com a Stats.

**Acceptance Scenarios**:

1. **Given** dois personagens, **When** o jogador escolhe o inativo, **Then** a árvore abre com a faixa e sem a marca de paridade.

---

### User Story 12 - Números que precisam do jogo vivo (Priority: P12)

Os números que dependem de algo que só existe no mapa aberto aparecem calculados com o jogo aberto. Exemplos: kills por hora (HP do monstro), comida AFK de combate, a rocha do Spelunking, o tabuleiro do Minehead.

**Why this priority**: completa o catálogo com os 40 números que hoje saem vazios fora do jogo.

**Independent Test**: com o jogo falso, um ator de mapa lido dá o número. Sem o ator, o número fica `unavailable`, com o motivo.

**Acceptance Scenarios**:

1. **Given** o jogador num mapa de combate, **When** ele abre o kills por hora, **Then** a árvore mostra o valor calculado com o ator lido.
2. **Given** um ator ausente, **When** o número é pedido, **Then** ele aparece `unavailable`, com uma frase de jogador sobre o porquê.

---

### User Story 13 - Conferir com outra ferramenta (Priority: P13)

Em "Game details", o jogador vê a chamada do jogo e copia a linha.

**Why this priority**: serve a quem valida contra planilhas e wiki.

**Independent Test**: o texto copiado tem só o nome da linha, a chamada e o número.

**Acceptance Scenarios**:

1. **Given** uma linha aberta, **When** o jogador toca em Copy, **Then** a área de transferência recebe o nome, a chamada e o número, e nada mais.

---

### Edge Cases

| Caso | O que acontece |
| --- | --- |
| Primeiro pedido da sessão | A tela mostra o número e "Preparing the breakdown". O protótipo fixa o tempo máximo |
| Um ramo está sendo calculado (plano B) | O topo e os ramos já abertos ficam na tela. Só a linha que está abrindo mostra "calculating this part…" |
| Troca de personagem ativo | A árvore se refaz para o novo personagem. A do anterior nunca aparece |
| O jogo fecha | A árvore, a Stats e os painéis ficam com a última leitura e "last reading N s ago" |
| A raiz difere da Stats (personagem ativo) | Defeito: a tela mostra só o número da Stats e "Breakdown unavailable", e o caso fica registrado |
| Chega um pedido novo durante um cálculo | O novo substitui o que esperava. Nunca há dois cálculos do mesmo número em voo |
| Patch do jogo com o app aberto | Os valores seguem certos. Uma faixa avisa que as regras de nome e de tipo são de outra versão, e o radar registra a forma nova |
| Contadores que mudam o tempo todo | Kills e timers não acendem "Game changed" |
| Tela de um sistema abre com o painel lateral aberto | O painel do sistema aparece, e o painel lateral não muda |
| Sistema que o retrato não tem (classe que nenhum personagem usa) | Os números valem 0 e aparecem como tal. Nada some |
| Número que precisa do jogo vivo, fora do mapa certo | `unavailable`, com o motivo |
| Uma falha nativa no cálculo da árvore | `unavailable`, uma nova tentativa, e a Stats intacta |
| Zoom de 200% (210 px CSS no painel lateral) | Nada rola na horizontal, e o recuo tem teto |

## Requirements *(mandatory)*

### Functional Requirements

**Portas e telas**

- **FR-001**: O valor de cada linha da Stats MUST virar botão, e a Stats MUST continuar uma tabela. Os testes da 004 continuam iguais, e um teste novo cobre o botão.
- **FR-002**: A aba Formulas MUST listar todos os números do catálogo, agrupados por sistema e por skill, sem busca livre. Os 11 da Stats estão entre eles, com o mesmo valor.
- **FR-003**: Todo sistema do catálogo com tela reconhecida pelo catálogo de telas do app MUST ter um painel. Quando essa tela abre no jogo, o companion MUST mostrar o painel dela. Sistemas sem tela reconhecida MUST estar na aba Formulas.
- **FR-004**: O painel de um sistema MUST mostrar em cima os números que o jogo não mostra, declarados para ele no catálogo, e embaixo a árvore do sistema. Todo número do painel MUST abrir a própria árvore.
- **FR-005**: A árvore MUST abrir num painel lateral, alargando a janela, e MUST voltar ao tamanho anterior quando o painel fecha. O painel lateral MUST mudar só quando o jogador toca em outra árvore ou no ✕, nunca porque a tela do jogo mudou.
- **FR-006**: A árvore MUST expandir no lugar, com vários níveis na mesma tela, na ordem do jogo. Ela MUST trazer a resposta curta antes de qualquer lista, as etapas, as partes, "How it adds up" e "Game details" (design.md, Parte 2).

**Catálogo e cálculo**

- **FR-007**: O catálogo MUST conter as árvores do levantamento ([catalogo-de-arvores.md](catalogo-de-arvores.md)) menos as "sem bloco". Uma árvore candidata ou gravada sem conta só entra no app depois de gravada e auditada linha a linha na bancada.
- **FR-008**: Todo número do catálogo MUST ficar em dia ao vivo enquanto o jogo roda. Se o protótipo mostrar que não cabe, o plano B MUST valer: ao vivo o que está à vista (painel aberto, grupo aberto, painel lateral e Pin), e o resto ao abrir. Em qualquer caso, a Stats MUST seguir abaixo de 1 s, e pedir árvores MUST nunca atrasar nem derrubar a Stats.
- **FR-009**: A mesma chamada do jogo, com os mesmos argumentos, MUST ser a mesma parte em qualquer árvore e em qualquer gravação.
- **FR-010**: Do cálculo MUST sair só dado: nomes de parte, argumentos, números, sim/não, operadores e textos de tabelas do jogo. MUST NOT sair trecho do código, literal de string do código nem nome de personagem. O personagem aparece como "Character N (class)".
- **FR-011**: A cópia instrumentada do código do jogo MUST existir só em memória e MUST NOT ser escrita em disco, com teste.
- **FR-012**: Cada caso que não fecha MUST ter um selo com texto, e o resto da árvore continua. Os ids são os do dado; o texto vem da tabela C7 do design.md:

  | Selo (dado) | Texto na tela |
  | --- | --- |
  | `unknown` | `?` |
  | `unnamed` | `no name yet` |
  | `unavailable` | `unavailable` |
  | `fromCache` | `saved by the game` |
  | `fromGame` | `from the game` |
  | `runtime` | `changes while you play` |
  | `truncated` | `stopped here` |
  | `binding: false` | rótulo em aberto (Open Questions) |
  | `productZero` | `zeroes the total` |
  | `sameAs` | `shown earlier` |
  | `progress` | `repeated step` |
  | `gameBug` | `game bug: counted twice` |
  | `unchecked` | faixa C18 |

- **FR-013**: Toda folha com tipo MUST mostrar o selo do tipo e a frase do tipo.
- **FR-014**: Cada nó aberto MUST mostrar as partes que mais pesam nele, na ordem do jogo, mais "Small (N)", "At 0 (N)" e "Show all N parts". As partes mostradas, "Small" e o resto MUST somar o pai. Os limites (5 a 10 partes, 90% da parcela) são propostas para o protótipo.
- **FR-015**: Uma parte que já apareceu na árvore MUST virar `shown earlier`, com o valor, e levar à primeira ocorrência.
- **FR-016**: Um bug conhecido do jogo MUST aparecer como o jogo o calcula, com o selo e a explicação.
- **FR-017**: Uma falha no cálculo de uma árvore MUST deixá-la `unavailable`, tentar mais uma vez e não afetar a Stats.
- **FR-018**: As regras de nome e de tipo MUST levar a versão do jogo em que foram conferidas. Com outra versão, a tela MUST avisar e continuar mostrando os valores.

**Paridade, personagem e jogo fechado**

- **FR-019**: Para o personagem ativo, a raiz de cada número que também está na Stats MUST ser igual ao número da Stats no mesmo estado. Se divergir, a tela MUST mostrar só o número da Stats e "Breakdown unavailable", e o caso MUST ficar num log estruturado, sem valores da conta nem nomes.
- **FR-020**: Um seletor de personagem MUST abrir no ativo. Um personagem inativo MUST mostrar a faixa "not the active character" e ficar fora da paridade da FR-019.
- **FR-021**: Na troca do personagem ativo, as árvores e os painéis MUST se refazer para o novo. A árvore do anterior MUST NOT aparecer.
- **FR-022**: Com o jogo fechado, a Stats, as árvores e os painéis MUST ficar com a última leitura e mostrar "last reading N s ago". Isso muda a 004, e os testes dela que esperam `unavailable` com o jogo fechado mudam com o sim do Vinicius.
- **FR-023**: Os números que dependem de um ator de mapa MUST ser calculados com os campos do ator lidos ao vivo, só por leitura de propriedade. Sem o ator, ficam `unavailable`, com o motivo.

**Comparação e extras**

- **FR-024**: "Game changed · Refresh" MUST acender só quando muda a raiz ou uma parte de um nó aberto. No Refresh, cada linha que mudou MUST mostrar "was …".
- **FR-025**: O jogador MUST poder marcar um ponto (Antes/depois), e a árvore MUST mostrar cada diferença entre o estado marcado e o atual.
- **FR-026**: O jogador MUST poder fixar um número ou uma folha (Pin). O fixado MUST ficar visível na barra e acender quando muda.
- **FR-027**: Uma peça que alimenta 2 ou mais números do catálogo MUST mostrar uma bolinha com a quantidade. Um toque MUST listar esses números, e cada um abre a sua árvore. Uma peça de 1 número só MUST NOT mostrar a bolinha.
- **FR-028**: O acompanhador de farm MUST medir o XP, os itens e o gold por hora a partir do que observa no estado do jogo, em memória, durante a sessão. Ele MUST NOT calcular a taxa por fórmula, nem guardar histórico em disco.
- **FR-029**: O radar de patch MUST guardar em disco a forma de cada árvore (nomes de parte e chaves), nunca valores, save ou nome de personagem. Depois de uma atualização do jogo, MUST listar as árvores que mudaram de forma e o que mudou.
- **FR-030**: Em "Game details", Copy MUST copiar só o nome da linha, a chamada e o número.

**Acessibilidade e privacidade**

- **FR-031**: A árvore MUST caber a 210 px CSS (zoom de 200% no painel lateral), com recuo limitado e sem rolagem horizontal. Ela MUST seguir o padrão ARIA de treeview inteiro e ter contraste AA nos dois temas (design.md §3.8). Toda cor de selo MUST vir com texto.
- **FR-032**: Nada do jogo nem do save MUST entrar no repositório: nem código, nem gravações, nem árvores montadas, nem retratos, nem o índice da 007. A prova de cada regra MUST ser uma referência, nunca uma frase do jogo citada, e um teste falha se uma regra tiver uma string que não seja referência.

### Key Entities

- **Árvore**: a explicação de um número, para um personagem, num estado do jogo.
- **Nó**: uma linha que pode ser aberta no lugar.
- **Parte (Tree piece)**: uma chamada do jogo com os seus argumentos. É a mesma em qualquer árvore.
- **Folha**: uma parte sem filhos, de um dos 9 tipos.
- **Selo**: a marca de um tipo de folha ou de um caso de honestidade.
- **Parcela**: quanto uma parte pesa no nó.
- **Catálogo de árvores**: a lista dos números que têm árvore, cada um com o sistema ou a skill, a chamada, o estado na bancada, a tela onde aparece e se é "não mostrado".
- **Painel de sistema**: o que o companion mostra para um sistema: os números não mostrados e a árvore do sistema.
- **Marca (Antes/depois)**: um estado guardado em memória para comparar.
- **Número fixado (Pin)**: um número ou uma folha visível na barra.
- **Forma de árvore**: os nomes de parte e as chaves de uma árvore, sem valores, guardados para o radar de patch.
- **Medição de farm**: as taxas por hora observadas na sessão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Raiz = Stats: 0 diferenças nos 11 números, num roteiro de 10 trocas de item, e nenhum "Breakdown unavailable" no roteiro.
- **SC-002**: App = bancada: 0 diferenças linha por linha (valor, tipo, ⓘ, "?") em cada árvore provada do catálogo, sobre o retrato da base congelada. É uma tarefa `[sessão]`, e o resumo entra no `registro.md`.
- **SC-003**: Nada vaza: o teste da FR-010 passa, nenhum nome de personagem aparece, e a cópia instrumentada nunca toca o disco.
- **SC-004**: Tudo segue como antes: os testes de só-leitura da 004 e da 005 passam, e a Stats fica abaixo de 1 s com as árvores ao vivo e o painel lateral aberto.
- **SC-005**: Tempo: a árvore do Drop Rate abre em até 5 s (proposta, que o protótipo confirma). O painel de um sistema aparece em até 1 s depois de a tela abrir no jogo.
- **SC-006**: Cobertura: todo sistema do catálogo com tela reconhecida tem painel, e todo número do catálogo abre a sua árvore pela aba Formulas.
- **SC-007**: Honestidade contada: nenhuma linha fica sem valor ou selo, em nenhuma árvore do catálogo.
- **SC-008**: Teste dos 5 segundos, num roteiro manual: uma pessoa que joga e nunca viu o app diz o valor do Drop Rate e a maior parte.
- **SC-009**: Efeito no jogo: com tudo ao vivo, o jogo não perde mais quadros que na linha de base da 005.

## Assumptions

- Valem a 004 e a 005: a leitura é só por propriedade, o cálculo é isolado e sem rede, o jogo falso roda os testes e a Stats fica em dia em menos de 1 s.
- A base congelada é o BASELINE-3.1 (3abbb53). Uma correção da pesquisa que toque uma árvore chega como ajuste pontual, com a prova.
- A bancada grava e audita as candidatas e as gravadas sem conta antes do plano. A sessão da pesquisa é dona dessa auditoria.
- O catálogo de telas da 003 é a fonte de "qual sistema está aberto". As telas que faltam ficam pela aba Formulas até uma spec de telas as acrescentar.
- O personagem nos exemplos, testes e documentos é sempre "Character N (class)".
- A tela segue o design.md. O mockup da bancada é só ilustração, e quando diverge vale o design.md.
- Os consertos pequenos que vêm antes da primeira fatia têm PR próprio: os companions "+" (`CompanionLVz`), a voz da barra de status, o zoom do texto, o arredondamento do Drop Rate e os padrões novos do `.gitignore`.

## Out of Scope *(mandatory)*

- **Da constituição (nunca):** chamar função do jogo em execução, gravar no save, usar a rede para o jogo, automatizar cliques ou distribuir arquivos, texto ou tabelas do jogo.
- **Cautelas:** nenhuma árvore pré-gravada distribuída, e o índice da 007 só na bancada.
- **Ranking ou recomendação** ("faça isto primeiro", "melhor próximo gasto"): pede outra emenda.
- **Bribes** no painel de Stamps.
- **As 52 "sem bloco" como número próprio.** Elas continuam aparecendo como parte, dentro das árvores que as usam. Reescrever a conta à mão diverge do jogo.
- **Busca livre** e pedido de árvore por chamada livre.
- **Caçador de zeros** da conta inteira.
- **Histórico de valores em disco.** O radar guarda só a forma, e o farm só mede na sessão.
- **Simulador e "what-if"**, e comparação com o Idleon Toolbox.
- **Telas novas no catálogo da 003.** Os sistemas sem tela ficam na aba Formulas.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| A frase-resposta do topo: três linhas do design (com "At zero for now") ou duas? | open | |
| Cada cartão das etapas mostra a operação, o total até ali, ou os dois? | open | |
| Os multiplicadores ×1: grupo próprio "At ×1 (N)" ou junto do "At 0"? | open | |
| No ⓘ, o termo sem nome aparece como nome genérico ou como código? | open | |
| Teclado na árvore: o treeview do APG inteiro (uma parada) ou uma parada por linha? | open | |
| Como entra o teste dos 5 segundos (uma pessoa sem bloquear, cinco iniciantes, ou portão para abrir o app)? | open | |
| Aviso de outra versão do jogo: faixa no topo ou marca por linha? | open | |
| Uma folha Condition que vale "no" vai para "At 0"? | open | |
| O selo de repetição vale também para folhas, ou só para ramos? | open | |
| Os rótulos ainda abertos do design: `limit wins now`, `At zero for now`, `Game adjustments` e a família do `Raw bonus` | open | |
| O que o acompanhador de farm mostra (por personagem, por mapa, quais itens) e em que janela de tempo mede? | open | |
| Onde fica o Pin e quantos números cabem nele? | open | |
| Antes/depois: quantas marcas, e a marca sobrevive à troca de personagem? | open | |
| O que o painel de cada sistema mostra em cima: todo "não mostrado" do catálogo daquele sistema, ou uma seleção aprovada sistema a sistema? | open | |
| O worker das árvores, o host novo, o pedido por número e os tetos (lote 4) | to plan | Decidido em 12/11 que vai ao plano; o protótipo mede |
| O parser do código do jogo (dependência nova, só com o sim do Vinicius) | to plan | Lote 4.4; o protótipo mede |
| Quantas linhas perdem nome sem o índice da 007 | to plan | O protótipo mede; o Vinicius aprova a lista |
| A leitura e o cálculo dos personagens inativos | to plan | Lote 5; o plano mede o custo |
| O custo de "tudo ao vivo" e a forma do plano B | to plan | O protótipo mede |
| A leitura dos atores de mapa (jogo vivo) e as peças que entram na leitura rápida para cada painel | to plan | Medido como manda a 005 (FR-016) |
| A auditoria das candidatas na bancada: ordem e lotes | to plan | A sessão da pesquisa faz; o plano espera |
| O ADR 0008 (worker de árvores, emendas do 0006 e do 0007) e o ARCHITECTURE.md | to plan | Tarefas obrigatórias do plano |
| Os consertos pequenos antes da primeira fatia, cada um como texto de quatro partes para o /implementar | to plan | CompanionLVz, aria-live da barra, zoom, arredondamento do Drop Rate, .gitignore |
| O NR-G não consta como instalado no BASELINE-3.1, e a frase-resposta do Drop Rate depende dele | to plan | Conferir com a sessão da pesquisa antes da fatia do Drop Rate |
