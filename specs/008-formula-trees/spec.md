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
- Q: Os rótulos? → A: Aprovados: `saved by the game`, `no name yet`, `shown earlier`, só "parts", `repeated step`, `changes while you play`. Ficam como estão o `?` e o `Raw bonus`. (O `shown earlier` saiu depois, no clarify: FR-015.)

### Session 2026-11-12

- Q: O que o painel de cada sistema mostra em cima, nos números que o jogo não mostra? → A: Todos os "não mostrado" do catálogo daquele sistema, em grupos que começam fechados (Costs, Caps, Chances, Rates), e o jogador abre cada um.
- Q: O que o acompanhador de farm mede, e em que janela de tempo? → A: Começa a contar quando o personagem entra num mapa novo que não é cidade. Na cidade, a contagem pausa; de volta ao mesmo mapa, continua; outro mapa que não é cidade recomeça.
- Q: Que forma tem a frase-resposta no topo de cada árvore? → A: Duas linhas curtas: a maior parte que soma, com a fatia entre parênteses ("Largest added bonus: Golden Food (66%).") e o maior multiplicador ("Largest multiplier: Equipment ×31.8."). O que vale 0 fica só no "At 0 (N)" da lista.
- Q: Onde ficam os números fixados com Pin, e quantos cabem? → A: Numa faixa sob a barra de status, até 5 números, que quebra em duas linhas quando passa de 3. O que acabou de mudar fica destacado, e um toque abre a árvore.
- Q: A árvore tem cartões de etapas acima dela? → A: Não. Os cartões repetiam a árvore. A árvore começa direto nos passos do jogo, na ordem do jogo, e é uma árvore pura: cada linha mostra só o próprio valor, e o total aparece só no topo. Nenhum passo se chama "fixed": cada um leva o nome do bônus no jogo, e sem nome provado leva `no name yet`. (Isso substitui a resposta da rodada 1 sobre os cartões e encerra a pergunta do nome da etapa do meio.)
- Q: Que rótulo leva a parte que não conta num teto (min/max)? → A: Dois rótulos que dizem qual lado e por quê: `over the cap` no valor que passou do teto, quando o teto vence; `not reached` no teto, quando o valor fica abaixo dele.
- Q: Nos bônus de retorno decrescente (curva que se aproxima de um máximo sem chegar), o que a linha mostra? → A: Quanto do máximo o jogador já atingiu, em texto ao lado do nome, sem barra: "62% reached · max +40%". O máximo sai da própria conta do jogo; uma curva sem máximo não mostra nada.
- Q: Em que família de cor fica o selo `Raw bonus`? → A: "Set by the game" (cinza), com a frase "Set by the game: the bonus this source gives." O que o jogador controla (ter o companion, equipar o item) aparece nas linhas ao lado, como Condition ou Choice. Um companion que o jogador tem fica ativo o tempo todo: não é escolha.
- Q: Os multiplicadores que valem ×1 ficam num grupo próprio ou junto do "At 0"? → A: Grupo próprio, "At ×1 (N) · no effect yet"; o "At 0 (N)" fica só para as partes que somam.
- Q: No "How it adds up", o que aparece no lugar de um termo sem nome provado? → A: O código do jogo como está (por exemplo `OptionsListAccount[189]`). Na lista de partes, a linha continua com nome de jogador e `no name yet`.
- Q: Uma folha de condição que vale "no" vai para o grupo "At 0"? → A: Não. Ela fica na lista, na ordem do jogo, com o selo e o "no". O "At 0" só junta as partes que valem 0.
- Q: O selo `shown earlier` vale também para folhas? → A: Não há `shown earlier`: uma parte repetida abre do mesmo jeito que na primeira vez, ramo ou folha. (Isso substitui a decisão de 12/11 de compactar as repetições; sem ela, o Drop Rate da base tem 5.024 linhas em vez de 2.414, e a paridade compara com a forma sem compactação.)
- Q: Quantas marcas o Antes/depois guarda, e a marca sobrevive à troca de personagem? → A: Até 3 marcas com nome, por personagem. A marca é uma foto dos números num momento, que a árvore compara com o agora.
- Q: As marcas do Antes/depois ficam depois de fechar o app? → A: Sim: ficam salvas mesmo com o app fechado e só apagam quando o jogador dá Clear.
- Q: Como a árvore avisa que os nomes e selos foram conferidos noutra versão do jogo? → A: Uma faixa só, no topo da árvore: "Names and tags were checked on an older game version. Values are live." Nenhuma marca por linha.
- Q: Como o teclado anda pela árvore? → A: O padrão de árvore inteiro: a árvore é uma parada de Tab; ↑/↓ andam de linha em linha, → abre o ramo, ← fecha ou sobe um nível, Home/End vão ao início e ao fim, Enter abre a conta da linha.
- Q: Como entra o teste dos 5 segundos? → A: É feito na máquina do Vinicius, com o app real, num roteiro manual; o resultado fica em `specs/008-formula-trees/teste-5s.md`.
- Q: Nomes de personagem, da guilda e textos do jogo podem aparecer? → A: Na tela do app, sim, como estão: é a máquina do próprio jogador, e a aba Screen map já mostra o nome do personagem. Fora da tela (log, arquivo salvo, teste, documento, repositório), nunca: ali o personagem é "Character N (class)" ou o seu número.
- Q: O caminho do retrato usado na paridade pode aparecer no log e no `registro.md`? → A: Sim, com o arquivo do retrato renomeado para não ter nome de personagem; o conteúdo do retrato nunca aparece.
- Q: Onde aparece o aviso do radar de patch? → A: Numa faixa sob a barra de status, em todas as abas, até o jogador fechá-la.
- Q: Onde aparece o acompanhador de farm? → A: Numa faixa sempre visível sob a barra de status, em todas as abas, enquanto o personagem farma (por exemplo "Farming 12 min · XP 1.2M/h · Gold 48K/h · Items ▸").

## User Scenarios & Testing *(mandatory)*

Os números de exemplo são do retrato da bancada. Nos exemplos desta spec, o personagem aparece como "Character N (class)"; na tela do app, aparece pelo nome real (FR-010). Nenhum teste escreve esses números à mão: todos vêm do arquivo de base (BASELINE-3.1) ou do jogo falso dos testes.

### User Story 1 - Por que meu Drop Rate é X? (Priority: P1)

Na aba Stats, o jogador toca no valor do Drop Rate. A janela alarga, e o painel lateral abre a árvore. No topo aparece a resposta curta: o valor, igual ao da Stats, a maior parte que soma e o maior multiplicador. Logo abaixo vêm os passos do jogo, na ordem do jogo, cada um com o nome do bônus. O jogador abre os ramos no lugar, até a folha.

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
4. **Given** um bônus de retorno decrescente com máximo de +40% que hoje dá +24.8%, **When** a linha aparece, **Then** ela mostra "62% reached · max +40%".

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
2. **Given** o jogador entra num mapa novo que não é cidade, **When** a contagem começa, **Then** ela parte de zero naquele mapa.
3. **Given** uma contagem em andamento, **When** o jogador vai à cidade e volta ao mesmo mapa, **Then** a contagem pausa na cidade e continua de onde estava.
4. **Given** o jogo fechado ou o companion reiniciado, **When** o acompanhador volta, **Then** a medição recomeça, porque não guarda histórico em disco.

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
- **FR-004**: O painel de um sistema MUST mostrar em cima todos os números que o jogo não mostra declarados para ele no catálogo, em grupos que começam fechados (Costs, Caps, Chances, Rates), e embaixo a árvore do sistema. Todo número do painel MUST abrir a própria árvore.
- **FR-005**: A árvore MUST abrir num painel lateral, alargando a janela de 420 para 840 px (o painel lateral tem a mesma largura da janela de hoje), para o lado que tiver espaço na tela (a direita, se couber), e MUST voltar ao tamanho anterior quando o painel fecha. O painel lateral MUST mudar só quando o jogador toca em outra árvore ou no ✕, nunca porque a tela do jogo mudou.
- **FR-006**: A árvore MUST expandir no lugar, com vários níveis na mesma tela, na ordem do jogo. Ela MUST trazer a resposta curta antes de qualquer lista e, logo abaixo, os passos do jogo como primeiro nível da árvore, sem cartões de etapa; depois as partes, "How it adds up" e "Game details" (design.md, Parte 2). Cada linha MUST mostrar só o próprio valor, e cada passo MUST levar o nome do bônus no jogo, nunca um nome genérico como "fixed"; sem nome provado, `no name yet`. A resposta curta MUST ter duas linhas: a maior parte que soma, com a fatia entre parênteses, e o maior multiplicador. Exemplo: "Largest added bonus: Golden Food (66%). Largest multiplier: Equipment ×31.8." Uma árvore sem soma ou sem multiplicador mostra só a linha que tem. O que vale 0 fica no "At 0 (N)", não na resposta.
**Catálogo e cálculo**

- **FR-007**: O catálogo MUST conter as árvores do levantamento ([catalogo-de-arvores.md](catalogo-de-arvores.md)) menos as "sem bloco". Uma árvore candidata ou gravada sem conta só entra no app depois de gravada e auditada linha a linha na bancada.
- **FR-008**: Todo número do catálogo MUST ficar em dia ao vivo enquanto o jogo roda. Se o protótipo mostrar que não cabe, o plano B MUST valer: ao vivo o que está à vista (painel aberto, grupo aberto, painel lateral e Pin), e o resto ao abrir. Em qualquer caso, a Stats MUST seguir abaixo de 1 s, e pedir árvores MUST nunca atrasar nem derrubar a Stats.
- **FR-009**: A mesma chamada do jogo, com os mesmos argumentos, MUST ser a mesma parte em qualquer árvore e em qualquer gravação.
- **FR-010**: Do cálculo MUST sair só dado: nomes de parte, argumentos, números, sim/não, operadores e textos de tabelas do jogo. MUST NOT sair trecho do código nem literal de string do código. Nomes de personagem, o nome da guilda e textos livres do estado do jogo podem sair para a tela do app, como estão: a tela é do jogador, na máquina dele.
- **FR-010a**: Nomes de personagem, da conta e da guilda e textos livres do jogo MUST NOT ir para log, arquivo salvo (marcas, números fixados, formas de árvore), teste, documento ou o repositório. Nesses lugares, o personagem MUST aparecer como "Character N (class)" ou pelo seu número.
- **FR-010b**: Tudo o que passa do cálculo isolado para a janela MUST ser conferido antes de aparecer (forma, tamanho e valores permitidos pela FR-010). O que falhar na conferência deixa a árvore `unavailable`.
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
  | `binding: false` | `over the cap` (o valor que passou do teto) ou `not reached` (o teto que não foi atingido) |
  | `productZero` | `zeroes the total` |
  | `progress` | `repeated step` |
  | `gameBug` | `game bug: counted twice` |
  | `unchecked` | faixa C18 |

- **FR-012a**: Nas linhas da árvore e na resposta curta MUST NOT aparecer código do jogo: uma parte sem nome provado mostra um nome genérico de jogador com `no name yet`. Dentro de "How it adds up", um termo sem nome provado MUST aparecer como o caminho do jogo, como está (por exemplo `OptionsListAccount[189]`). Esse caminho é nome de estado, nunca trecho do código.
- **FR-013**: Toda folha com tipo MUST mostrar o selo do tipo e a frase do tipo, com a cor da família do tipo (design.md C4). O `Raw bonus` MUST ficar na família "Set by the game", com a frase "Set by the game: the bonus this source gives."
- **FR-014**: Cada nó aberto MUST mostrar as partes que mais pesam nele, na ordem do jogo, mais "Small (N)", "At 0 (N)" (partes que somam e valem 0; uma Condition que vale "no" não entra, fica na lista na ordem do jogo), "At ×1 (N) · no effect yet" (multiplicadores que valem ×1) e "Show all N parts". Os grupos começam fechados. As partes mostradas, "Small" e o resto MUST somar o pai. Os limites (5 a 10 partes, 90% da parcela) são propostas para o protótipo.
- **FR-015**: Uma parte que já apareceu na árvore MUST abrir de novo do mesmo jeito que na primeira vez, com os mesmos filhos e valores. Não há linha de repetição.
- **FR-015a**: Uma linha cuja conta é uma curva de retorno decrescente com máximo (as curvas que a bancada reconhece) MUST mostrar, em texto ao lado do nome, quanto do máximo já foi atingido e o máximo: "62% reached · max +40%". O máximo MUST sair dos parâmetros da própria conta do jogo. Uma curva sem máximo, ou não reconhecida, MUST NOT mostrar a porcentagem.
- **FR-016**: Um bug conhecido do jogo MUST aparecer como o jogo o calcula, com o selo e a explicação.
- **FR-017**: Uma falha no cálculo de uma árvore MUST deixá-la `unavailable`, tentar mais uma vez e não afetar a Stats.
- **FR-018**: As regras de nome e de tipo MUST levar a versão do jogo em que foram conferidas. Com outra versão, a tela MUST mostrar uma faixa só, no topo da árvore ("Names and tags were checked on an older game version. Values are live."), sem marca por linha, e MUST continuar mostrando os valores.

**Paridade, personagem e jogo fechado**

- **FR-019**: Para o personagem ativo, a raiz de cada número que também está na Stats MUST ser igual ao número da Stats no mesmo estado. Se divergir, a tela MUST mostrar só o número da Stats e "Breakdown unavailable", e o caso MUST ficar num log estruturado, sem valores da conta nem nomes.
- **FR-020**: Um seletor de personagem MUST abrir no ativo. Um personagem inativo MUST mostrar a faixa "not the active character" e ficar fora da paridade da FR-019.
- **FR-021**: Na troca do personagem ativo, as árvores e os painéis MUST se refazer para o novo. A árvore do anterior MUST NOT aparecer.
- **FR-022**: Com o jogo fechado, a Stats, as árvores e os painéis MUST ficar com a última leitura e mostrar "last reading N s ago". Isso muda a 004, e os testes dela que esperam `unavailable` com o jogo fechado mudam com o sim do Vinicius.
- **FR-023**: Os números que dependem de um ator de mapa MUST ser calculados com os campos do ator lidos ao vivo, só por leitura de propriedade. Sem o ator, ficam `unavailable`, com o motivo.

**Comparação e extras**

- **FR-024**: "Game changed · Refresh" MUST acender só quando muda a raiz ou uma parte de um nó aberto. No Refresh, cada linha que mudou MUST mostrar "was …".
- **FR-025**: O jogador MUST poder guardar até 3 marcas com nome por personagem (Antes/depois). Uma marca é a foto dos números num momento. Com uma marca escolhida, a árvore MUST mostrar cada diferença entre a marca e o agora, com o valor da marca e o atual. As marcas MUST ficar salvas na máquina do jogador, mesmo com o app fechado, e só somem quando ele as apaga (Clear). Trocar de personagem não as apaga. O arquivo das marcas MUST NOT ter nome de personagem (o personagem é o seu número) e nunca entra no repositório.
- **FR-026**: O jogador MUST poder fixar até 5 números ou folhas (Pin). Os fixados MUST ficar numa faixa sob a barra de status, que quebra em duas linhas quando passa de 3. Cada um mostra o nome curto e o valor, MUST ficar destacado quando muda e abre a própria árvore com um toque.
- **FR-027**: Uma peça que alimenta 2 ou mais números do catálogo MUST mostrar uma bolinha com a quantidade. Um toque MUST listar esses números, e cada um abre a sua árvore. Uma peça de 1 número só MUST NOT mostrar a bolinha.
- **FR-028**: O acompanhador de farm MUST medir o XP, os itens e o gold por hora do personagem ativo a partir do que observa no estado do jogo, em memória. A contagem MUST começar quando o personagem entra num mapa novo que não é cidade; na cidade ela MUST pausar, de volta ao mesmo mapa MUST continuar, e noutro mapa que não é cidade MUST recomeçar. Ele MUST NOT calcular a taxa por fórmula, nem guardar histórico em disco. As taxas MUST aparecer numa faixa sob a barra de status, visível em todas as abas, sempre (parada, com "Farm: waiting for a map"; durante a implementação, aprovado pelo Vinicius em 14/11) ("Farming 12 min · XP 1.2M/h · Gold 48K/h · Items ▸"); "Items ▸" abre a lista de itens por hora. Na cidade, a faixa mostra a contagem pausada.
- **FR-029**: O radar de patch MUST guardar em disco a forma de cada árvore (nomes de parte e chaves), nunca valores, save ou nome de personagem. Depois de uma atualização do jogo, MUST listar as árvores que mudaram de forma e o que mudou.
- **FR-030**: Em "Game details", Copy MUST copiar só o nome da linha, a chamada e o número.

**Acessibilidade e privacidade**

- **FR-031**: A árvore MUST caber a 210 px CSS (zoom de 200% no painel lateral), com recuo limitado e sem rolagem horizontal. A mesma regra MUST valer para o painel principal, a faixa do Pin, a faixa do farm, a faixa do radar e a aba Formulas. Ela MUST seguir o padrão ARIA de treeview inteiro: uma parada de Tab; ↑/↓ andam de linha em linha, → abre o ramo, ← fecha ou sobe um nível, Home/End vão ao início e ao fim, Enter abre a conta da linha. Ela MUST ter contraste AA nos dois temas (design.md §3.8). Toda cor de selo MUST vir com texto.
- **FR-032**: Nada do jogo nem do save MUST entrar no repositório: nem código, nem gravações, nem árvores montadas, nem retratos, nem o índice da 007. A prova de cada regra MUST ser uma referência, nunca uma frase do jogo citada, e um teste falha se uma regra tiver uma string que não seja referência. O retrato do jogador usado na paridade MUST ser lido por um caminho em variável de ambiente, na máquina do Vinicius. O caminho pode aparecer em log, relatório e `registro.md`, e por isso o arquivo do retrato MUST ter um nome sem nome de personagem (por exemplo `retrato-character-9.json`). O conteúdo do retrato MUST NOT aparecer em nenhum desses lugares.

**Telas, estados e acessibilidade dos extras**

- **FR-033**: Ao sair de uma tela de sistema para uma tela sem painel (mapa, cidade, menu), o companion MUST continuar no último painel de sistema.
- **FR-034**: Antes da primeira leitura, ou sem personagem escolhido, a aba Formulas, os painéis e o painel lateral MUST mostrar "Waiting for the game", sem número de outro personagem.
- **FR-035**: Depois de uma atualização do jogo, uma faixa sob a barra de status, visível em todas as abas, MUST dizer quantas árvores mudaram de forma ("Game updated: 3 trees changed · Show"); "Show" lista o que mudou, e a faixa fica até o jogador fechá-la.
- **FR-036**: Todo número que abre uma árvore MUST ter como ser fixado (Pin), e cada número da faixa MUST ter como ser solto. Um sexto pin MUST ser recusado com "Up to 5 pins: unpin one first." Os números fixados (só quais são, nunca valores) MUST continuar fixados depois de fechar o app.
- **FR-037**: No topo da árvore, "Mark before" MUST pedir um nome (sugerindo "Mark 1", "Mark 2"…). Um seletor MUST escolher com qual marca a árvore compara, e cada marca MUST ter Clear. Uma quarta marca do mesmo personagem MUST ser recusada com "Up to 3 marks: clear one first."
- **FR-038**: A aba Formulas MUST ordenar os grupos assim: Character, Account, os mundos de W1 a W7 na ordem do jogo e as skills pela ordem do jogo. Dentro de cada grupo vale a ordem do catálogo.
- **FR-039**: Quando o painel troca sozinho, o foco do teclado MUST NOT mudar de lugar. Ao abrir o painel lateral, o foco MUST ir para o título dele; ao fechar, MUST voltar para o número que o abriu.
- **FR-040**: A troca automática de painel MUST ser anunciada uma vez ao leitor de tela, na região viva da página ("Stamps panel"). "Game changed" segue o design.md §3.8. A mudança de um número fixado MUST NOT ser anunciada; ela aparece só na faixa.
- **FR-041**: Um arquivo salvo (marcas, números fixados, formas de árvore) que não puder ser lido, estiver corrompido ou vier de outra versão do app MUST ser deixado de lado. O app começa vazio naquele item e avisa uma vez ("Saved marks could not be read and were reset"), sem cair.

### Key Entities

- **Árvore**: a explicação de um número, para um personagem, num estado do jogo.
- **Nó**: uma linha que pode ser aberta no lugar.
- **Parte (Tree piece)**: uma chamada do jogo com os seus argumentos. É a mesma em qualquer árvore.
- **Folha**: uma parte sem filhos, de um dos 9 tipos.
- **Selo**: a marca de um tipo de folha ou de um caso de honestidade.
- **Parcela**: quanto uma parte pesa no nó.
- **Catálogo de árvores**: a lista dos números que têm árvore, cada um com o sistema ou a skill, a chamada, o estado na bancada, a tela onde aparece e se é "não mostrado".
- **Painel de sistema**: o que o companion mostra para um sistema: os números não mostrados e a árvore do sistema.
- **Marca (Antes/depois)**: uma foto dos números num momento, com nome, por personagem (até 3), salva na máquina até o jogador apagar.
- **Número fixado (Pin)**: um número ou uma folha visível na barra.
- **Forma de árvore**: os nomes de parte e as chaves de uma árvore, sem valores, guardados para o radar de patch.
- **Medição de farm**: as taxas por hora observadas na sessão.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Raiz = Stats: 0 diferenças nos 11 números, num roteiro de 10 trocas de item, e nenhum "Breakdown unavailable" no roteiro.
- **SC-002**: App = bancada: 0 diferenças linha por linha (valor, tipo, ⓘ, "?") em cada árvore provada do catálogo, sobre o retrato da base congelada. É uma tarefa `[sessão]`, e o resumo entra no `registro.md`.
- **SC-003**: Nada vaza: o teste da FR-010 passa, nenhum nome de personagem, da conta ou da guilda aparece em log, arquivo salvo, teste, documento ou no repositório (FR-010a), e a cópia instrumentada nunca toca o disco.
- **SC-004**: Tudo segue como antes: os testes de só-leitura da 004 e da 005 passam, e a Stats fica abaixo de 1 s com as árvores ao vivo e o painel lateral aberto.
- **SC-005**: Tempo: a árvore do Drop Rate abre em até 5 s (proposta, que o protótipo confirma). O painel de um sistema aparece em até 1 s depois de a tela abrir no jogo.
- **SC-006**: Cobertura: todo sistema do catálogo com tela reconhecida tem painel, e todo número do catálogo abre a sua árvore pela aba Formulas.
- **SC-007**: Honestidade contada: nenhuma linha fica sem valor ou selo, em nenhuma árvore do catálogo.
- **SC-008**: Teste dos 5 segundos, num roteiro manual na máquina do Vinicius, com o app real: olhando a árvore do Drop Rate por 5 segundos, quem testa diz o valor e a maior parte. O resultado fica em `specs/008-formula-trees/teste-5s.md`, e o teste não segura o merge.
- **SC-009**: Efeito no jogo: com tudo ao vivo, o jogo não perde mais quadros que na linha de base da 005.

## Assumptions

- Valem a 004 e a 005: a leitura é só por propriedade, o cálculo é isolado e sem rede, o jogo falso roda os testes e a Stats fica em dia em menos de 1 s.
- A base congelada é o BASELINE-3.1 (3abbb53). Uma correção da pesquisa que toque uma árvore chega como ajuste pontual, com a prova.
- A bancada grava e audita as candidatas e as gravadas sem conta antes do plano. A sessão da pesquisa é dona dessa auditoria.
- O catálogo de telas da 003 é a fonte de "qual sistema está aberto". As telas que faltam ficam pela aba Formulas até uma spec de telas as acrescentar.
- O personagem nos exemplos, testes e documentos é sempre "Character N (class)".
- Toda a interface e o conteúdo das árvores (nomes, contas, notas e selos) ficam em inglês.
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
- **Histórico de valores em disco.** O radar guarda só a forma, e o farm só mede na sessão. A única exceção são as marcas do Antes/depois, que o jogador cria e apaga (FR-025).
- **Simulador e "what-if"**, e comparação com o Idleon Toolbox.
- **Telas novas no catálogo da 003.** Os sistemas sem tela ficam na aba Formulas.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| A frase-resposta do topo: três linhas do design (com "At zero for now") ou duas? | resolved | Duas linhas curtas, sem a linha de zeros (FR-006) |
| Cada cartão das etapas mostra a operação, o total até ali, ou os dois? | resolved | Não há cartões: a árvore começa nos passos do jogo, árvore pura (FR-006) |
| Os multiplicadores ×1: grupo próprio "At ×1 (N)" ou junto do "At 0"? | resolved | Grupo próprio, "At ×1 (N) · no effect yet" (FR-014) |
| No ⓘ, o termo sem nome aparece como nome genérico ou como código? | resolved | Como código, dentro do "How it adds up"; na lista, nome genérico com `no name yet` (FR-012a) |
| Teclado na árvore: o treeview do APG inteiro (uma parada) ou uma parada por linha? | resolved | O treeview inteiro, uma parada de Tab (FR-031) |
| Como entra o teste dos 5 segundos (uma pessoa sem bloquear, cinco iniciantes, ou portão para abrir o app)? | resolved | Na máquina do Vinicius, com o app real, roteiro manual; resultado em teste-5s.md (SC-008) |
| O teste dos 5 segundos segura o merge? | resolved | Confirmado pelo Vinicius: não; é um roteiro manual registrado em teste-5s.md, e o portão da 008 são os testes automáticos (SC-008) |
| Aviso de outra versão do jogo: faixa no topo ou marca por linha? | resolved | Faixa no topo, sem marca por linha (FR-018) |
| Uma folha Condition que vale "no" vai para "At 0"? | resolved | Não: fica na lista, na ordem do jogo (FR-014) |
| O selo de repetição vale também para folhas, ou só para ramos? | resolved | Nenhum: uma parte repetida abre do mesmo jeito, ramo ou folha (FR-015) |
| Que nome tem a etapa do meio (hoje `Game adjustments`)? | resolved | Não há etapa do meio: cada passo leva o nome do bônus no jogo, nunca "fixed"; sem nome, `no name yet` (FR-006) |
| Que rótulo leva a parte que não vale num teto, min/max (hoje `limit wins now`)? | resolved | `over the cap` no valor acima do teto; `not reached` no teto não atingido (FR-012) |
| Em que família de cor fica o selo `Raw bonus`? | resolved | "Set by the game" (cinza); ter ou equipar fica nas linhas Condition ou Choice (FR-013) |
| Nos bônus de retorno decrescente, o que a linha mostra? | resolved | "62% reached · max +40%", em texto, com o máximo da própria conta (FR-015a) |
| O rótulo `At zero for now` ainda existe? | resolved | Não: a resposta curta não tem a linha de zeros (FR-006) |
| O que o acompanhador de farm mostra (por personagem, por mapa, quais itens) e em que janela de tempo mede? | resolved | O personagem ativo; começa ao entrar num mapa novo que não é cidade, pausa na cidade e continua no mesmo mapa (FR-028) |
| Onde fica o Pin e quantos números cabem nele? | resolved | Faixa sob a barra de status, até 5, quebrando em duas linhas (FR-026) |
| Antes/depois: quantas marcas, e a marca sobrevive à troca de personagem? | resolved | Até 3 marcas com nome por personagem (FR-025) |
| As marcas do Antes/depois ficam depois de fechar o app? | resolved | Sim: ficam salvas na máquina até o jogador dar Clear, sem nome de personagem (FR-025) |
| O que o painel de cada sistema mostra em cima: todo "não mostrado" do catálogo daquele sistema, ou uma seleção aprovada sistema a sistema? | resolved | Todos, em grupos fechados (Costs, Caps, Chances, Rates) (FR-004) |
| Onde aparece o acompanhador de farm? (ux CHK003) | resolved | Numa faixa sempre visível sob a barra de status, enquanto farma (FR-028) |
| Em que língua ficam a interface e as árvores? (ux CHK013) | resolved | Inglês, como decidido no brainstorming (Assumptions) |
| Texto livre do estado e identificadores da conta podem sair do cálculo? (security CHK001) | resolved | Na tela, sim, como estão, inclusive o nome real do personagem; nunca em log, arquivo salvo, teste, documento ou repositório (FR-010, FR-010a) |
| O retrato do jogador pode aparecer em log, relatório ou registro.md? (security CHK002) | resolved | O caminho pode aparecer, com o arquivo renomeado sem nome de personagem; o conteúdo nunca (FR-032) |
| O que acontece se um resultado levaria um pedaço de nome de personagem? (security CHK003) | resolved | Na tela, o nome aparece; nunca vai para log, arquivo salvo, teste, documento ou repositório (FR-010a) |
| O que acontece com um arquivo salvo ilegível, corrompido ou de outra versão? (security CHK005) | resolved | Confirmado pelo Vinicius: é deixado de lado, o item começa vazio e o app avisa uma vez, sem cair (FR-041) |
| O que sai do cálculo é conferido antes de aparecer? (security CHK015) | resolved | Confirmado pelo Vinicius: sim (forma, tamanho, valores permitidos); falhou, `unavailable` (FR-010b) |
| O que o companion mostra ao sair de um sistema para uma tela sem painel? (ux CHK001) | resolved | Confirmado pelo Vinicius: continua no último painel de sistema (FR-033) |
| O que as telas novas mostram antes da primeira leitura ou sem personagem? (ux CHK002) | resolved | Confirmado pelo Vinicius: "Waiting for the game", sem número de outro personagem (FR-034) |
| Onde e quando aparece o radar de patch? (ux CHK004) | resolved | Faixa sob a barra de status, em todas as abas, "Game updated: 3 trees changed · Show", até o jogador fechar (FR-035) |
| Como se fixa e se solta um número, e o que acontece no sexto? (ux CHK005) | resolved | Confirmado pelo Vinicius: todo número com árvore pode ser fixado; o sexto é recusado com "Up to 5 pins: unpin one first."; os fixados continuam depois de fechar o app, sem valores (FR-036) |
| Como se cria, nomeia, escolhe e apaga uma marca, e o que acontece na quarta? (ux CHK006) | resolved | Confirmado pelo Vinicius: "Mark before" pede um nome ("Mark 1"…), um seletor escolhe a marca, cada uma tem Clear; a quarta é recusada com "Up to 3 marks: clear one first." (FR-037) |
| Em que ordem ficam os grupos da aba Formulas? (ux CHK007) | resolved | Confirmado pelo Vinicius: Character, Account, W1 a W7 e as skills, na ordem do jogo (FR-038) |
| Quanto a janela alarga, e para que lado? (ux CHK008) | resolved | Confirmado pelo Vinicius: de 420 para 840 px, para o lado com espaço (a direita, se couber) (FR-005) |
| Para onde vai o foco na troca automática e ao abrir e fechar o painel lateral? (ux CHK015) | resolved | Confirmado pelo Vinicius: a troca não move o foco; abrir põe o foco no título do painel lateral; fechar devolve ao número que o abriu (FR-039) |
| O que o leitor de tela anuncia na troca automática e na mudança de um pin? (ux CHK016) | resolved | Confirmado pelo Vinicius: a troca é anunciada uma vez ("Stamps panel"); a mudança de um pin não é anunciada (FR-040) |
| O zoom de 200% vale para o painel principal, as faixas e a aba Formulas? (ux CHK017) | resolved | Confirmado pelo Vinicius: sim, a mesma regra dos 210 px, também para a faixa do radar (FR-031) |
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
| O porte da montagem da bancada (cerca de 11 mil linhas no BASELINE-4) cabe nos módulos previstos na T022, e a tabela de nomes (T023) pode ser estática? | resolved | durante a implementação: não. A US1 vira três fatias: gravador e raiz com o primeiro nível (T016, T018, T021, T024); porte fiel da montagem por tema, em quantos módulos de até 400 linhas precisar (T017, T022); e os nomes (T023) depois de a bancada refazer o export sobre o BASELINE-4, com os nomes que vêm das tabelas do jogo resolvidos no worker sobre o jogo instalado e a tabela estática só com nomes em inglês provados por referência (FR-032). Decidido pela sessão com a instrução do Vinicius de seguir a recomendação, em 14/11 |
| O que conta como árvore pronta no catálogo (T007)? | resolved | durante a implementação: só a árvore gravada e auditada linha a linha na bancada (FR-007), pelo estado de cada frente; a curadoria (597 árvores, 35 do jogo vivo) e as 12 dúvidas estão na bancada, em CATALOGO-008-app.md. O catálogo entra na fase da US2. Decidido pela sessão com a instrução do Vinicius de seguir a recomendação, em 14/11 |
| Os números de Stamps que a US4 pede (custo do próximo nível, teto, nível passado, exaltado) entram já? | resolved | durante a implementação: ainda não. No levantamento são candidatas (StampCostss, StampOverLevel) ou sem bloco (o teto), e a FR-007 pede gravação e auditoria na bancada antes. A US4 fecha com os números do catálogo; a raiz que devolve lista (material e quantidade) e a raiz de valor guardado sem conta só entram quando a bancada trouxer esses números. Decidido pela sessão com a instrução do Vinicius de seguir a recomendação, em 14/11 |
| O "embaixo, a árvore do sistema" da FR-004, se o catálogo não tem raiz de sistema inteiro? | resolved | durante a implementação: embaixo dos grupos fechados, o painel lista os outros números do sistema no catálogo, cada um abrindo a sua árvore. Uma raiz de sistema inteiro (a página de sistema da bancada) entra quando a bancada a trouxer. Decidido pela sessão com a instrução do Vinicius de seguir a recomendação, em 14/11 |
| O Pin fixa folhas, além de números (FR-026)? | resolved | durante a implementação: não. O Pin fixa só números do catálogo; uma linha da árvore não tem valor ao vivo próprio. Decidido pelo Vinicius em 14/11 |
| As 211 árvores da F5 marcadas "entra", mas com defeito de nome na auditoria, entram no catálogo? | resolved | durante a implementação: sim, entram já (o catálogo vai a cerca de 783); a linha sem nome provado mostra o nome genérico com `no name yet` (FR-012a) até a US1c. Decidido pelo Vinicius em 14/11 |
| A faixa do farm aparece só enquanto o personagem farma (FR-028)? | resolved | durante a implementação: não, a faixa fica sempre visível, como o Vinicius escolheu no clarify (rodada 4); parada, mostra "Farm: waiting for a map", sem região viva. Aprovado pelo Vinicius em 14/11 |
