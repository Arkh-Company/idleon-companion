# Feature Specification: Árvores declaradas

**Feature Branch**: `spec/010-declared-trees`

**Created**: 2026-11-20

**Status**: Draft

**Input**: Desenho aprovado pelo Vinicius no brainstorming de 20/11/2026: recomeçar do zero a camada de forma das árvores de fórmula. Cada um dos 289 números com destino "arvore" do catálogo validado ganha uma receita declarada, escrita a partir do código do jogo, guiada e conferida por um gabarito tirado da gravação. Os valores continuam vindo da gravação; o app só lê receitas.

## Contexto

Os valores das árvores sempre bateram com o jogo, porque o app roda o código do próprio jogo e grava a conta. O que quebrava era a **forma**: o app adivinhava pools, grupos e nomes aplicando centenas de regras locais sobre um rastro de gravação poluído (passos sem nome, caches, checagens, constantes soltas). Cada correção numa família de árvores quebrava outra; duas regras que conflitavam foram resolvidas em silêncio e causaram a regressão da 0.9.0 (a FR-007 da 009 contra a FR-018, e a família 21 contra "o sistema sempre aparece como filho"); e nada conferia a forma nas árvores reais.

Esta feature troca a forma adivinhada por uma forma **declarada**. O catálogo validado (`docs/catalogo/numeros.json`, regras em `docs/catalogo/regras.md`) diz quais números ganham árvore: os 289 com destino `arvore`. Para cada um, uma receita declara a forma; a gravação entrega só um gabarito (ordem dos pools, fontes que entraram, valores) para guiar e conferir a receita.

## Clarifications

### Session 2026-11-20

- Q: Num número que depende da classe do personagem, como a receita trata as fontes que só algumas classes têm? → A: Uma receita por número com todas as fontes; cada fonte de classe leva a classe dela e só aparece para o personagem que pode ter (mockup `mockup-classe.html`, opção B).
- Q: Em que ordem os lotes de receitas chegam à galeria? → A: W1 → W7, depois Personagem, depois Conta: a ordem do catálogo.
- Q: O que acontece com os Pins e marcas salvos nas árvores antigas? → A: Um aviso, uma vez, e eles são apagados; nada é levado para a árvore nova.
- Q: Os padrões do agente (tolerância, ordem dos grupos, sistema só de outra classe, cartão da galeria, contagem, onde fica a aprovação, aviso dos Pins, versão só com as 289) valem? → A: Confirmados todos (mockup `mockup-galeria.html`).
- Q: Até onde a imagem da galeria abre a árvore? → A: Até as folhas: a árvore inteira aberta.

### Session 2026-11-20 (depois do protótipo)

- Q: Abaixo do pool, a trava confere se a conta de cada fonte fecha, ou só se os filhos existem na gravação? → A: Remonta a conta a partir da gravação, na hora de conferir, e confere o fechamento em todos os níveis, sem guardar a conta.
- Q: Quando o jogo junta duas fontes antes de pôr no pool (talento 239 × Kingdom stats), aparece uma linha só ou linhas separadas? → A: Uma linha só, com o nome da primeira fonte, e a segunda fonte como filho, com o sistema dela.
- Q: Contas seguidas do mesmo tipo viram um pool só? → A: Sim: cada trecho seguido de somas é um Additive pool, e cada trecho seguido de multiplicações é um Multi pool (no Drop Rate, 4 pools).
- Q: O radar de patch da 008 continua? → A: Não; ele sai, e o alerta de fechamento (FR-019) faz o papel dele (decidido durante o plano).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Abrir um número e ver por que ele tem esse valor (Priority: P1)

O jogador abre qualquer um dos 289 números do catálogo e vê a árvore: os pools do jogo no primeiro nível, na ordem em que o jogo calcula; dentro deles, um grupo por sistema com emoji; dentro dos grupos, as fontes com o nome do jogo; e cada fonte descendo até a folha. Todo nível fecha com o pai, e a raiz fecha com o valor do jogo.

**Why this priority**: é o produto ("Por que meu número é esse"). Sem a árvore declarada e fechada, nada mais desta feature tem uso.

**Independent Test**: com o jogo instalado e um retrato real, abrir o Drop Rate: o primeiro nível são os pools na ordem do jogo, cada pool e grupo fecha com os filhos, a raiz bate com o valor do jogo, e não há linha sem nome do jogo nem grupo "Other".

**Acceptance Scenarios**:

1. **Given** um número do catálogo com receita aprovada, **When** o jogador o abre, **Then** a árvore mostra os pools declarados na ordem do jogo, com os grupos por sistema dentro, e cada nível fecha com o pai.
2. **Given** uma fonte com nível, curva e multiplicadores, **When** o jogador a abre, **Then** os filhos descem até a folha, cada folha com um dos 9 tipos de folha, e a curva e as checagens de ramo aparecem no ⓘ.
3. **Given** um sistema que contribui com uma única fonte, **When** a árvore aparece, **Then** o grupo do sistema aparece mesmo assim, com a fonte dentro.
4. **Given** a árvore aberta e o jogo mudando um valor, **When** chega a leitura seguinte, **Then** os valores se atualizam ao vivo sem mudar a forma.

---

### User Story 2 - Receita conferida contra o jogo antes de chegar à tela (Priority: P1)

Cada receita é escrita a partir da leitura do código do jogo e guiada pelo gabarito da gravação daquele número. Antes de qualquer receita chegar à galeria, uma trava confere: a ordem dos pools é a do jogo, toda fonte do gabarito está na receita, e cada nível fecha com o valor gravado. Receita que não passa volta para quem a escreveu.

**Why this priority**: é a garantia que faltava. Sem ela, a forma declarada pode esquecer fonte ou inventar ordem, e o erro só aparece na mão do jogador.

**Independent Test**: tirar de uma receita do Drop Rate uma fonte que o gabarito tem: a trava reprova a receita e diz qual fonte falta; trocar a ordem de dois pools: a trava reprova e diz a ordem do jogo.

**Acceptance Scenarios**:

1. **Given** uma receita que omite uma fonte do gabarito, **When** a trava roda, **Then** a receita é reprovada com o nome da fonte que falta.
2. **Given** uma receita com os pools fora da ordem do jogo, **When** a trava roda, **Then** a receita é reprovada com a ordem esperada.
3. **Given** uma receita cujo nível não fecha com o valor gravado, **When** a trava roda, **Then** a receita é reprovada com o nível, o valor declarado e o valor do jogo.

---

### User Story 3 - Aprovar as árvores na tela real, numa galeria por mundo e sistema (Priority: P2)

O Vinicius aprova as árvores sobre a imagem que o próprio app gera a partir da gravação real, numa galeria por mundo, dividida por sistema, com "Aprova" e "Corrigir + nota" em cada árvore, como as páginas de inventário que ele usou para validar o catálogo. Cada correção vira uma mudança de receita ou de regra de forma, e a mudança passa por todas as árvores.

**Why this priority**: a 0.9 saiu porque ninguém olhou as árvores reais e o que se aprovava era um desenho. A galeria fecha esse buraco, mas depende das US1 e US2.

**Independent Test**: gerar a galeria do W1, aprovar uma árvore e pedir correção em outra com nota; a aprovação e a nota ficam guardadas, e a correção aparece como pendência daquela receita ou de uma regra.

**Acceptance Scenarios**:

1. **Given** as receitas de um mundo aprovadas pela trava, **When** a galeria é gerada, **Then** cada árvore aparece como a tela do app, agrupada por sistema, com "Aprova" e "Corrigir + nota".
2. **Given** uma correção pedida, **When** ela é tratada, **Then** a mudança fica registrada como mudança de receita ou de regra, e a galeria seguinte mostra quantas árvores ela mudou.

---

### User Story 4 - Regras de forma conferidas em todas as árvores, sem conflito em silêncio (Priority: P2)

Cada regra de forma (por exemplo "o sistema sempre aparece como filho" ou "nenhum grupo Other") tem um número e uma checagem que roda nas 289 árvores reais. Quando duas regras não podem passar juntas numa árvore, a checagem mostra a árvore e os dois números, e a decisão vai para o Vinicius.

**Why this priority**: as regressões vieram de regras que brigavam e foram resolvidas sem ninguém saber. A checagem torna isso impossível.

**Independent Test**: rodar as checagens sobre as 289 árvores; montar à mão uma receita que obedeça uma regra e fira outra: a checagem aponta a árvore e os dois números.

**Acceptance Scenarios**:

1. **Given** as 289 árvores, **When** as checagens rodam, **Then** cada regra informa as árvores que passam e as que falham.
2. **Given** duas regras incompatíveis numa árvore, **When** as checagens rodam, **Then** o relatório mostra a árvore e os dois números de regra como conflito a decidir, e nenhuma das duas é ignorada.

---

### User Story 5 - Atualização do jogo que muda uma conta (Priority: P3)

Quando uma atualização do jogo acrescenta ou tira uma fonte de um número, a árvore continua mostrando o que a receita declara, e um alerta fora da árvore (no registro e nas checagens) aponta o número, o nível e a diferença entre a receita e o jogo.

**Why this priority**: o jogo muda com frequência; a receita precisa avisar quando ficou velha, sem poluir a tela do jogador.

**Independent Test**: com uma gravação em que o jogo tem uma fonte a mais que a receita, abrir o número: a árvore não mostra linha extra, e o registro e as checagens trazem o alerta com o número, o nível e a diferença.

**Acceptance Scenarios**:

1. **Given** uma receita sem uma fonte que o jogo passou a ter, **When** o número é aberto, **Then** a árvore não ganha linha nova e o alerta aparece no registro e nas checagens.

---

### User Story 6 - Troca da forma antiga pela declarada (Priority: P3)

A forma adivinhada sai do app. Os Pins e as marcas que apontavam para peças das árvores antigas deixam de valer, e o app avisa isso uma vez, em vez de mostrar peças erradas.

**Why this priority**: recomeçar do zero significa não carregar as chaves e as regras da forma antiga.

**Independent Test**: abrir o app com um Pin e uma marca salvos na versão anterior: o app avisa que eles deixaram de valer e não mostra peça quebrada.

**Acceptance Scenarios**:

1. **Given** Pins e marcas da versão anterior, **When** o app abre pela primeira vez na versão nova, **Then** um aviso diz que eles deixaram de valer, eles são apagados, e o aviso não volta nas aberturas seguintes.

### Edge Cases

- **Número que varia por classe** (talentos de classe, por exemplo): o gabarito vem da gravação do personagem aberto; a receita declara todas as fontes, cada fonte de classe marcada com a classe dela, e o personagem só vê as fontes da classe dele. O grupo do sistema aparece sempre.
- **Fonte com valor zero ou ×1 no gabarito**: continua na árvore, no seu lugar, com o valor em cinza (FR-016 da 009).
- **Número que precisa do jogo vivo no mapa**: continua "Needs the live map", sem árvore parcial.
- **Fonte que o gabarito traz e que não tem nome nas tabelas de texto do jogo**: a receita não é aprovada pela trava até ter um nome provado; nunca "no name yet" nem "Game value".
- **Regra de forma nova**: entra com número e checagem, roda nas 289 árvores, e o relatório diz quantas mudaram antes da aprovação.

## Requirements *(mandatory)*

### Functional Requirements

**Receitas**

- **FR-001**: Cada um dos 289 números com destino `arvore` em `docs/catalogo/numeros.json` MUST ter exatamente uma receita declarada, e nenhum número fora desse destino ganha receita nesta feature.
- **FR-002**: A receita MUST declarar a forma inteira da árvore: os pools (Additive ou Multi) na ordem do jogo, os grupos por sistema com emoji dentro de cada pool, as fontes dentro dos grupos e os filhos de cada fonte até a folha.
- **FR-002c**: Os pools MUST seguir os trechos da conta do jogo na raiz: cada trecho seguido de somas é um Additive pool, cada trecho seguido de multiplicações é um Multi pool, e cada troca de soma para multiplicação, ou o contrário, abre um pool novo. Um pedaço de uma mesma multiplicação nunca vira pool próprio (no Drop Rate: Additive, Multi, Additive, Multi).
- **FR-002a**: Cada número MUST ter uma receita só, mesmo quando varia por classe. Uma fonte que só algumas classes têm MUST levar a classe na receita e MUST aparecer só para o personagem dessa classe; o grupo do sistema aparece sempre que tiver ao menos uma fonte que a classe do personagem pode ter, e some só quando todas as fontes dele são de outras classes.
- **FR-002b**: Quando o jogo junta duas fontes num termo só antes de pôr no pool (por exemplo, um talento multiplicado pelo Kingdom stats, ou Sushi somado a Jelly), a receita MUST declarar uma linha só, com o nome da primeira fonte, e a segunda fonte como filho, com o emoji do sistema dela; o termo nunca aparece como duas linhas soltas no pool.
- **FR-003**: Cada fonte da receita MUST apontar para o ponto do código do jogo onde entra, por referência: o nome do bloco, o modo e, quando houver, a tabela e a linha; nunca uma expressão, uma linha ou um trecho do código.
- **FR-004**: Todo nome na receita MUST vir do texto do jogo, com prova; nenhum nome é inventado, e nenhuma linha usa "no name yet", "Game value" ou nome feito só da forma da conta.
- **FR-005**: Toda folha MUST ter um dos 9 tipos de folha (Level, Quantidade, Valor fixo, Bônus cru, Condição, Escolha, Tier, Recorde, Pontos investidos); galho, progresso e contexto não são folha.
- **FR-006**: Toda fonte MUST pertencer a um sistema real do jogo, com prova; não existe grupo "Other".
- **FR-007**: As receitas MUST ficar no repositório e conter só referências e texto do jogo, nunca código do jogo, gravação ou árvore montada.

**Gabarito e trava**

- **FR-008**: Para cada número, a gravação MUST entregar um gabarito com a ordem dos pools na raiz (onde o jogo soma e onde multiplica), a lista das fontes que entraram na conta com o valor de cada uma, e o valor final. A extração MUST só ler: nunca chama função do jogo em execução nem grava no save.
- **FR-009**: A forma da árvore MUST NOT ser tirada do rastro da gravação; o rastro serve só para montar o gabarito e para dar os valores.
- **FR-010**: Uma trava MUST conferir cada receita contra o gabarito: a ordem dos pools, a presença de toda fonte do gabarito e o fechamento de cada nível com o valor gravado, da raiz até a folha. Abaixo do pool, a trava MUST remontar a conta de cada nível a partir dos passos gravados, na hora de conferir, e MUST NOT guardar essa conta na receita nem no repositório (a receita guarda só a forma, os nomes e as referências). Uma receita que falha MUST ser reprovada com o motivo (fonte que falta, ordem esperada ou nível que não fecha, com os dois valores).
- **FR-011**: Só receitas aprovadas pela trava MUST chegar à galeria.

**Na tela do app**

- **FR-012**: Na hora de mostrar uma árvore, o app MUST só ler a receita e preencher os valores com a gravação; ele MUST NOT deduzir forma.
- **FR-013**: A árvore MUST manter o visual da 009: pools no primeiro nível, grupos por sistema com emoji, ⓘ, botão Changes e fatia escondida por padrão, todos os pools e grupos começando fechados, o mesmo formato de valor ("+80%" no que soma, "×1.06" no que multiplica) e as mesmas regras de acessibilidade da treeview (nome, valor, fatia quando ligada e "N sources" lidos pelo leitor de tela).
- **FR-013a**: Dentro de um pool, os grupos de sistema MUST seguir a ordem em que o jogo os soma ou multiplica, a ordem do gabarito; dentro de um grupo, as fontes seguem a mesma ordem.
- **FR-014**: Todo sistema que influi num valor MUST aparecer como filho, mesmo com uma única fonte ou com contribuição 0; a regra "grupo de uma fonte só some" (família 21) e a regra "passo sem nome sobe" (FR-007 da 009) deixam de existir.
- **FR-015**: Cada nível MUST fechar com o pai (soma ou produto), e a raiz MUST fechar com o valor do jogo. Quando um nível não fecha (FR-019), cada linha continua mostrando o valor do jogo, e a diferença aparece só no alerta.
- **FR-016**: A curva e as checagens de ramo MUST ir para o ⓘ da linha, e o ⓘ da raiz MUST mostrar como os pools se juntam, como na 009; cada multiplicador é a sua própria linha × que abre nos filhos.
- **FR-017**: Os valores da árvore aberta MUST se atualizar ao vivo, como na 009, sem mudar a forma.
- **FR-018**: As árvores MUST estar em inglês.
- **FR-019**: Quando o valor do jogo e a receita não fecham num nível, a árvore MUST NOT ganhar linha extra; o app MUST registrar um alerta estruturado, com rótulo e o id do número, contendo só o número, o nível e a diferença (nunca código do jogo nem nome de personagem), e as checagens MUST mostrar o mesmo alerta.

**Regras de forma**

- **FR-020**: Cada regra de forma MUST ter um número, uma frase, um exemplo e uma checagem que roda sobre as 289 árvores reais; uma regra substituída continua registrada e marcada como substituída.
- **FR-021**: Quando duas regras não podem passar juntas numa árvore, as checagens MUST reportar a árvore e os dois números como conflito a decidir pelo Vinicius; nenhuma regra é desligada ou priorizada sem a decisão dele.
- **FR-022**: Uma mudança de regra ou de receita MUST mostrar, antes da aprovação, quantas árvores mudaram e o que mudou em cada uma, agrupado por tipo de mudança (nome, linha nova, linha removida, valor).

**Aprovação**

- **FR-023**: O app MUST gerar a imagem de cada árvore a partir da gravação real, igual à que o jogador vê, com a árvore inteira aberta até as folhas: pools, grupos, fontes e os filhos de cada fonte. Na tela do app tudo continua começando fechado (FR-013); só a imagem da galeria abre tudo.
- **FR-024**: Uma galeria por mundo (W1 a W7, Personagem e Conta), dividida por sistema, MUST mostrar as imagens com "Aprova" e "Corrigir + nota" em cada árvore, e guardar as respostas. Cada cartão MUST mostrar o nome do número, o sistema, a imagem da árvore, os dois botões e o campo de nota; os botões e o campo MUST ser alcançáveis pelo teclado e ter nome para o leitor de tela. A galeria de um mundo MUST abrir em até 5 s.
- **FR-024b**: O topo da galeria MUST mostrar, para a última mudança de receita ou de regra, quantas árvores mudaram, agrupadas por tipo de mudança (FR-022), e quantos números do mundo ainda não têm receita aprovada pela trava; esses números não ganham cartão até passarem na trava.
- **FR-024c**: A aprovação e a nota de cada árvore MUST ficar registradas junto da receita, no repositório; as imagens MUST ficar só no PC do Vinicius.
- **FR-024a**: Os lotes de receitas MUST chegar à galeria na ordem do catálogo: W1, W2, W3, W4, W5, W6, W7, Personagem e Conta.
- **FR-025**: Cada "Corrigir + nota" MUST virar uma mudança de receita ou de regra registrada, e a árvore volta à galeria depois da mudança.
- **FR-026**: As capturas e as conferências sobre a gravação real MUST rodar no PC do Vinicius, fora da CI, porque os dados reais não podem ir à CI.

**Troca da forma antiga**

- **FR-027**: A montagem de forma adivinhada atual MUST sair do app ao fim da feature.
- **FR-028**: As chaves das peças MUST seguir as receitas. Pins e marcas da versão anterior MUST ser apagados, e o app MUST avisar isso uma vez, na primeira abertura da versão nova; nada é levado para as peças novas, nem pelo nome. O aviso MUST ser uma faixa no topo do app com o texto "Pins and marks from the old trees were removed: the trees were rebuilt.", que some ao ser fechada e não volta. Apagar MUST tocar só os dados que o próprio app salvou.
- **FR-029**: A versão do app com as árvores declaradas MUST sair só com as 289 receitas aprovadas; um número sem receita não abre árvore.

### Non-Functional Requirements

- **NFR-001 (tempo)**: A árvore do Drop Rate MUST abrir em até 5 s, o limite da 009, e a Stats MUST continuar abaixo de 1 s com a árvore aberta.
- **NFR-002 (ao vivo)**: Os valores da árvore aberta MUST se atualizar a cada leitura do jogo (1 s).
- **NFR-003 (máquina)**: Os testes MUST rodar com um processo de trabalho por vez em threads, porque o PC do Vinicius dá tela azul quando muitos processos de teste fecham juntos; a conferência das 289 árvores reais MUST rodar num processo só.
- **NFR-004 (honestidade)**: Nenhum código do jogo, gravação, árvore montada, imagem de árvore da galeria ou nome de personagem MUST entrar no Git; receitas, notas e alertas não levam nome de personagem; o jogo é só lido, e nada desta feature, galeria e gerador de imagens incluídos, usa a rede.

### Key Entities

- **Número do catálogo**: um dos 289 números com destino `arvore`, com id, nome, mundo, sistema, tipo e prova (já existe em `docs/catalogo/numeros.json`).
- **Gabarito**: o que a gravação entrega de um número: ordem dos pools, fontes que entraram com valor, valor final.
- **Receita**: a forma declarada de um número: pools, grupos por sistema, fontes, filhos, nomes do jogo, tipos de folha e referências ao código.
- **Pool**: um passo da conta do jogo, Additive (soma antes de entrar) ou Multi (multiplica).
- **Grupo de sistema**: os bônus de um sistema real do jogo dentro de um pool, com emoji.
- **Fonte**: um bônus que entra na conta, com nome do jogo e o ponto do código.
- **Folha**: o fim de um ramo, com um dos 9 tipos de folha.
- **Regra de forma**: número, frase, exemplo, checagem e estado (vale, substituída).
- **Alerta de fechamento**: número, nível e diferença entre a receita e o jogo.
- **Aprovação**: a resposta do Vinicius a uma árvore na galeria (aprova, ou corrigir com nota).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: As 289 árvores do catálogo têm receita, e as 289 passam na trava: em cada nível, as partes fecham com o valor gravado, com diferença relativa de até 0,0001%.
- **SC-002**: As 289 árvores estão aprovadas pelo Vinicius na galeria, sobre a imagem real do app.
- **SC-003**: Nenhuma árvore tem linha "no name yet", "Game value" ou grupo "Other" (0 ocorrências nas 289).
- **SC-004**: Toda regra de forma tem número e checagem, e a última rodada das checagens sobre as 289 árvores termina sem falha nem conflito aberto.
- **SC-005**: A árvore do Drop Rate abre em até 5 s.
- **SC-006**: Numa gravação em que o jogo tem uma fonte que a receita não tem, o alerta aparece no registro e nas checagens em 100% dos casos, e a árvore não ganha linha extra.
- **SC-007**: Uma correção feita para uma árvore mostra, antes da aprovação, a contagem de árvores mudadas; nenhuma mudança de forma vai para o app sem essa contagem.

## Assumptions

- A gravação atual (o processo isolado que roda o código do jogo instalado) continua a fonte dos valores e é a base do gabarito; ela não muda de comportamento nesta feature, só ganha a extração do gabarito.
- O visual da tela de árvore da 009 continua; o que muda é o que está por trás dela.
- As tabelas de texto do jogo e o índice do código usado no catálogo bastam para dar nome e referência às fontes; o que faltar vira pendência da receita, nunca palpite.
- As receitas são escritas por agentes a partir do código do jogo e do gabarito, e revisadas pelo Vinicius na galeria.
- O catálogo de `docs/catalogo/` (branch `feat/catalogo-de-numeros`) entra na `main` junto com esta spec.

## Out of Scope *(mandatory)*

- Painel de farm, planejador de custos e tela de alvo atual: são os outros destinos do catálogo e ficam para features futuras.
- Mudança no visual da árvore: o visual é o da 009.
- Troca de linguagem ou de plataforma: continua TypeScript com Electron.
- Árvores para números fora do destino `arvore` (os 214 "dentro de árvore" aparecem dentro das árvores, não como árvore própria).
- O radar de patch da 008: sai com a forma deduzida; uma atualização do jogo que muda uma conta aparece no alerta de fechamento (FR-019).
- Forma automática na hora de mostrar, mesmo com correções declaradas: é o modelo que quebrou e foi descartado no brainstorming.

## Open Questions *(mandatory)*

| Question | State | Answer |
| --- | --- | --- |
| Escopo da feature | resolved | O motor e as 289 receitas numa feature só (Vinicius, brainstorming de 20/11). |
| Como as receitas nascem | resolved | Escritas a partir do código do jogo, guiadas e conferidas pelo gabarito da gravação (mistura escolhida no brainstorming). |
| O que o jogador vê quando a árvore não fecha | resolved | Nada a mais na árvore; só um alerta fora dela, no registro e nas checagens. |
| Como o Vinicius aprova | resolved | Galeria por mundo, dividida por sistema, sobre a imagem real do app. |
| Número que varia por personagem ou classe: uma receita com todas as fontes possíveis, ou uma receita por classe? | resolved | Uma receita com todas as fontes; a fonte de classe só aparece para quem pode ter (FR-002a). |
| Em que ordem os lotes de receitas chegam à galeria (por mundo, por sistema, pelos números mais usados)? | resolved | W1 → W7, Personagem, Conta (FR-024a). |
| Pins e marcas antigos: só avisar que deixaram de valer, ou tentar levar para a peça equivalente quando o nome bater? | resolved | Só avisar, uma vez, e apagar (FR-028). |
| Quanto de diferença ainda conta como "fecha com o jogo" (SC-001, FR-010, FR-015)? | resolved | Padrão do agente: diferença relativa de até 0,0001% (1 em 1 milhão) entre a soma ou o produto das partes e o valor gravado; acima disso, o nível não fecha. |
| Em que ordem ficam os grupos de sistema dentro de um pool (ux CHK010)? | resolved | Padrão do agente: na ordem em que o jogo os soma ou multiplica, a ordem do gabarito; as fontes de um grupo também (FR-013a). |
| Um sistema cujas fontes são todas de outras classes aparece para o personagem (ux CHK012)? | resolved | Padrão do agente: não; o grupo aparece sempre que tiver ao menos uma fonte que a classe pode ter, e some só quando todas são de outras classes (FR-002a). |
| O que cada cartão da galeria mostra, como se usa pelo teclado e em quanto tempo a galeria abre (ux CHK004, CHK017, CHK019)? | resolved | Padrão do agente: nome do número, sistema, imagem, "Aprova", "Corrigir + nota" e o campo de nota; botões e campo alcançáveis pelo teclado e com nome para o leitor de tela; a galeria de um mundo abre em até 5 s (FR-024). |
| Onde a galeria mostra a contagem de árvores mudadas e o que acontece com os números sem receita aprovada (ux CHK005, CHK007)? | resolved | Padrão do agente: no topo da galeria, para a última mudança, agrupada por tipo; os números sem receita aprovada pela trava aparecem só como contagem, sem cartão (FR-024b). |
| Onde ficam a aprovação e a nota de cada árvore (security CHK006)? | resolved | Padrão do agente: junto da receita, no repositório; as imagens ficam só no PC do Vinicius (FR-024c). |
| Qual o texto e o lugar do aviso dos Pins e marcas antigos (ux CHK006)? | resolved | Padrão do agente: uma faixa no topo do app, "Pins and marks from the old trees were removed: the trees were rebuilt.", que some ao ser fechada e não volta (FR-028). |
| O que o jogador vê num número sem receita aprovada (ux CHK016)? | resolved | Padrão do agente: a versão com as árvores declaradas só sai com as 289 receitas aprovadas; sem receita, o número não abre árvore (FR-029). |
| A imagem da galeria mostra a árvore aberta até onde: só os pools e grupos, até as fontes, ou até as folhas (ux CHK009, CHK011)? | resolved | Até as folhas: a árvore inteira aberta (FR-023). |
| Abaixo do pool, "cada nível fecha" (FR-010, FR-015, SC-001) é a conferência da conta, com a trava remontando a conta a partir dos passos gravados sem guardá-la, ou só a conferência de que os filhos declarados são as partes que o jogo gravou? | resolved | A trava remonta a conta dos passos gravados na hora, sem guardar, e confere todos os níveis (FR-010). |
| Um termo que junta duas fontes (talento × recorde, Sushi + Jelly) aparece como uma linha com a segunda fonte como filho, ou como linhas separadas? | resolved | Uma linha, com a segunda fonte como filho (FR-002b). |
| Escritas seguidas do mesmo tipo formam um pool só (no Drop Rate dá 4 pools; a 0.9 mostrava 7 itens no primeiro nível)? | resolved | Sim: um pool por trecho seguido do mesmo tipo (FR-002c). |
| O radar de patch da 008 continua com a forma declarada? | resolved | Não: sai, e o alerta de fechamento faz o papel dele (Out of Scope, FR-019). |
| O app ainda lê os nomes do jogo em tempo de execução? | resolved | durante a implementação: não. Só o N.js (e trechos dele) fica fora do repositório; nome, imagem e qualquer outro dado do jogo podem entrar prontos (Vinicius, 21/11). A receita traz os nomes escritos e o app só põe os números; `src/calculator/names/`, `game-names.ts` e `names-reader.js` saem do worker do app com a forma antiga na T135 (se o gerador de rascunho ainda os usar, ficam só nele, que roda no PC do Vinicius); o `nameProof` passa a ser opcional (a T013 não recusa mais a ausência dele). |
| A raiz pode ter algo por cima dos pools? | resolved | durante a implementação: sim, uma camada de topo (sonda das raízes, 21/11). Arredondamento, piso e teto são uma linha cada, com antes → depois: 🔵 Rounded, ⬇️ Rounded down, ⬆️ Rounded up, 🔒 Cap N, 🔓 Floor N; o `min` do jogo é Cap e o `max` é Floor. Os pools ficam abaixo, pela FR-002c (ex.: Anvil Capacity) (Vinicius, 21/11). |
| Uma condição que muda a conta aparece como? | resolved | durante a implementação: se depende do alvo (caldeirão, item, ilha, upgrade), a árvore mostra só o caminho padrão; se depende do personagem ou da conta (ferramenta, talento, progresso), uma linha ❓ com cada caminho embaixo e os filhos de cada um até as folhas; o que vale com valor, os outros apagados ("não usado") (ex.: Mining Speed) (Vinicius, 21/11). |
| Uma divisão no topo aparece como? | resolved | durante a implementação: linha ➗ no primeiro nível, como o pool do divisor, com os grupos de sistema e as constantes dentro, nunca um pool (ex.: Egg Time) (Vinicius, 21/11). |
| O que o ⓘ mostra? | resolved | durante a implementação: a fórmula como equação matemática e "Com os seus valores" (a mesma conta com os números e o resultado); no caminho apagado, "Se valesse agora" (Vinicius, 21/11). |
| Fonte de um sistema fora da tabela de sistemas? | resolved | durante a implementação: a tabela ganha 17 sistemas: Event Shop, Salt Lick, Dungeons (com Flurbo Shop), Tasks (com Merit Shop), Islands, Jade Emporium, Construction, Fishing, Worship, Cooking, Zenith Market, Food, Smithing, Catching, Death Note, Breeding e Minigames (Darts e Hoops); constante é linha, nunca sistema (Vinicius, 21/11). |
| Termo que o jogo lê, mas que nenhuma fonte dá? | resolved | durante a implementação: não aparece na árvore; se um patch criar a fonte, o alerta de fechamento (FR-019) avisa (ex.: o carimbo SmithExp) (Vinicius, 21/11). |
| Número que é a soma de muitas chamadas? | resolved | durante a implementação: raiz "soma de chamadas": o gabarito grava cada chamada e soma, e a árvore agrupa por sistema (ex.: Tome Score, as 124 linhas) (Vinicius, 21/11). |
| O catálogo muda com a sonda das raízes? | resolved | durante a implementação: saem `alch-brew-per-hour` e `alch-liquid-rate` (painel de farm); `alch-bubble-cost-reduction` vira Bits e Item; `farm-market-cost-reduction` vira Day e Night; `vault-max-lv` vira os níveis por troca do Glimbo; `farm-exotic-lv-qty` vira o multiplicador; em 22/11, saem também `gfood-quantity` (contador; já aparece nas árvores da Golden Food) e `storage-slots-total`; `talents-max-level` vira a soma de Max Book LV e All Talent LV; `constr-build-rate` roda a rotina do Cog Board na cópia de gravação; o catálogo fica com 287 árvores (Vinicius, 21 e 22/11). |
| Num `min`/`max` sem constante, qual lado é o teto? | resolved | durante a implementação: o lado cujo valor vem das escritas da própria raiz é o valor e o outro é o teto; quando nenhum vem da raiz, o teto é o lado que começa com a constante do jogo (Food not consume: `90 + …`/`98 + …`; Crop value: `10000 × …`); fora disso, a raiz é recusada com o motivo, nunca escolhida pela ordem (Vinicius, 22/11). |
| Números que dependem de um alvo e não tinham chamada própria (quarta sonda)? | resolved | durante a implementação: `obols-stat-multi` vira 4 árvores, uma por stat (STR, AGI, WIS, LUK); `stats-mob-respawn` fica com a parte de todos os mundos (Holes, Shrines, Chips, Star Signs); `talents-points-per-tab` vira 6 árvores, uma por aba; `summ-unit-stats` é o dano da unidade (`UnitDMG`); `signs-seraph-multi` roda a conta do Star Signs na cópia; o catálogo fica com 295 árvores (Vinicius, 22/11). |
| O número que o jogo calcula dentro de um laço, num custo infinito ou numa primeira escrita com divisão? | resolved | durante a implementação: (1) a raiz sem número aceita `part`, e a mesma parte em cada volta do laço, com os mesmos termos e o mesmo valor, conta como uma só (Seraph multi; no Mob respawn, a parte vem da linha ➗, em %); (2) a gravação guarda o custo infinito e o corte `K < x && (x = K)` é um Cap K (Bubble cost Bits e Item); (3) uma divisão na primeira escrita vira linha ➗ da raiz quando as escritas seguintes só multiplicam, senão recusa (New bubble chance) (Vinicius, 22/11). |
