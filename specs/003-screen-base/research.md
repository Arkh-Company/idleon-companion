# Research: Base de telas (screen-base)

Decisões técnicas da 003. As medidas vêm de [prototipo/README.md](prototipo/README.md), do jogo instalado em 08/11/2026.

## R1. Como ler as tabelas de mapas e monstros (FR-014, FR-016)

**Decision**: expressões regulares sobre o texto do `N.js`, nunca executado. Mapas: as duas listas de texto
`MapDispName` e `MapName`, procuradas pelo nome do campo, porque o nome do objeto minificado muda entre builds. Monstros:
as chamadas `addNewMonster`, cujo objeto começa em `Name`. Qualquer sinal de formato novo descarta a tabela inteira
(nenhum achado, mais de uma candidata, listas de tamanhos diferentes, um monstro fora do formato). Id repetido: o último
vale, como no jogo. Sublinhado vira espaço. O id `Nothing` não é monstro: significa "sem alvo".

**Rationale**: o protótipo mediu 327 mapas e 418 ids, e os nomes batem com o catálogo da 001 em 327 de 327 mapas e 417 de
417 monstros. As tabelas e os números de tela custam cerca de 70 ms juntos, com o arquivo já na memória. Tudo ou nada é a
regra central aplicada à extração: uma tabela pela metade poderia dar um nome errado.

**Alternatives considered**: executar o `N.js` num sandbox (`node:vm`) daria as tabelas prontas, mas roda o código do
jogo no app, o que FR-014 proíbe. Ler `CustomLists` e `MonsterDefinitionsGET` por propriedade dentro do jogo tiraria o
trabalho do texto, mas aumenta a leitura ao vivo de 1 KB para centenas de KB e contraria a decisão de ler do arquivo.

## R2. Quando as tabelas são lidas (Open Questions, "to plan")

**Decision**: a cada abertura do jogo, sobre o mesmo texto que o vigia de update já carregou.

**Rationale**: o guardião já lê o `N.js` inteiro antes de lançar o jogo. Extrair de novo custa cerca de 70 ms e nenhum
acesso a mais ao disco, e o resultado está sempre de acordo com o jogo instalado.

**Alternatives considered**: ler só quando o hash muda exige guardar as tabelas em disco e tratar um cache perdido ou
velho, para economizar 70 ms por sessão.

## R3. Qual regra vale se duas casam (Open Questions, "to plan")

**Decision**: duas listas, nesta ordem: `overlays` (Character select, AFK Gains) e `screens` (janelas, abas, cavernas e
"None"). A primeira lista com alguma regra casada decide, e dentro dela vale a regra com mais condições. Empate vira
"Unknown screen". Um teste do catálogo recusa empate nos estados capturados.

**Rationale**: uma aba é a janela com uma condição a mais, então "mais condições" dá o resultado certo sem depender da
ordem de centenas de linhas. Os overlays precisam vir antes porque os campos de janela guardam valor antigo durante a
seleção de personagem, e a própria tela AFK Gains exige `OptionsList[18] == 0` para qualquer menu. No empate, a regra
central manda não adivinhar.

**Alternatives considered**: a primeira regra da lista vence, o que torna a ordem do arquivo parte do significado, e
inserir uma aba no lugar errado muda outra tela sem nenhum erro. Prioridade numérica em cada regra é o mesmo problema com
mais um campo a manter.

## R4. Forma das regras do catálogo (FR-001, FR-002, FR-003, FR-005, FR-006)

**Decision**: dados em JSON: `{ when, name, tabs?, proof }`. `when` só tem igualdade, em AND, sobre campos da leitura.
`name` é o caminho inteiro (`"Codex › Cards › Sets"`). `tabs: true` diz que essa tela tem abas: se ela vencer, o painel
acrescenta "› Unknown tab". `proof` é obrigatório, `foto:<id>` ou `sprite:<nome>`. As janelas do jogo sem prova ficam
numa lista à parte, `unprovenWindows`, sem nome.

**Rationale**: cada aba repete as condições da janela, então FR-005 (uma aba só vale junto da janela dela) sai da forma
da regra, sem código. Sem prova não há regra, então FR-003 não depende de disciplina: o teste exige `proof` em todas. O
mapa de telas é uma lista de igualdades, e nenhuma linha dele precisa de faixa.

**Alternatives considered**: regras em código TypeScript não dão para validar como dados nem contar. Árvore janela → aba
→ subtela repete a estrutura em cada nível e ainda precisaria de um caminho para condições em campos diferentes.

## R5. Onde cada parte fica (arquitetura)

**Decision**: o guardião extrai as tabelas e manda ao app pelo elo, numa mensagem nova `tables`. O catálogo de telas e a
identificação ficam em `src/shared/screens/`.

**Rationale**: o guardião já tem o texto do `N.js`, inclusive de dentro do `app.asar`, e FR-017 exige que ele conheça os
números do catálogo. A regra `keeper-alone` impede que ele importe `src/main`, então o catálogo precisa estar em
`src/shared`, que os dois processos já usam. Nenhuma fronteira nova.

**Alternatives considered**: o app ler o `N.js` sozinho repete a localização do jogo e a leitura do `app.asar`, e o
guardião ainda precisaria ler o arquivo para FR-017.

## R6. Campos novos do leitor (FR-007, FR-008)

**Decision**: `read.js` passa a devolver `scene`, `attack`, `bag`, `ol1`, `ol3`, `ol18`, `ol19`, `ola489`, `nd37`, `hole`
e `behaviors`, um objeto plano com a tabela de [contracts/read-fields.md](contracts/read-fields.md). Comportamento
ausente não gera chave. Fora: `_NPCtalkingTo`, `ARC.*`, as sondas de diálogo, `OptionsList[9]` e `otherPlayer`
(`PixelHelperActor[18]`, que pode trazer o nome de outro jogador e FR-007 não pede).

**Rationale**: é a lista do `lab\read.js`, medida em 1 KB e sem erro em quase 2 horas. Todo valor ausente vira `null`, porque
`returnByValue` descarta `undefined` e reprovaria a leitura inteira. `codexSel` continua sendo lido, para não remexer no
leitor da 001, mas sai do contexto, porque nada mais o mostra.

**Alternatives considered**: um campo `Reading` para cada comportamento, cerca de 50 propriedades para validar uma a uma
sem ganho nenhum, já que as regras só comparam igualdade.

## R7. Apagar o `names.json` (FR-012)

**Decision**: a cada início do app, `rmSync` com `force` nos três arquivos, cada um no próprio `try`. Sem marcador de
"já apaguei".

**Rationale**: a operação é idempotente. Rodar sempre cumpre "tentar de novo na próxima abertura" sem guardar estado.

**Alternatives considered**: guardar a versão em que apagou é um arquivo a mais para evitar três chamadas que não fazem
nada quando não há arquivo.

## R8. Quando a verificação roda (FR-018)

**Decision**: no fluxo do guardião, logo depois de `startApp()`, de forma síncrona. Falha é registrada e não interrompe
nada. A referência ao texto é solta logo depois.

**Rationale**: o jogo já foi lançado e leva vários segundos para carregar. A leitura só conecta cerca de 16 s depois de
abrir o jogo, então 70 ms síncronos não encontram nenhuma pausa do leitor. Se uma leitura chegar antes das tabelas, o
painel mostra "Unknown map" até elas chegarem, e o app refaz o contexto nessa hora.

**Alternatives considered**: um `worker_thread` para 70 ms que uma vez por sessão não disputam com nada.

## R9. Testes com dados capturados (FR-020, SC-001)

**Decision**: um JSON em `src/shared/screens/fixtures/captured-states.json`, gerado uma vez a partir de
`lab\out\estado.jsonl` e da seção 7 do mapa de telas, por um script descartável fora do repositório. Cada item tem a
leitura, o nome esperado e o número da foto. `char` vira `"Tester"` (ou `null` na seleção de personagem) e `codexSel` vira
`null`. Os 5 estados inconclusivos ficam de fora.

**Rationale**: a fixture é o critério de SC-001 e não precisa do jogo aberto. Os estados são números, e os únicos textos
de jogador são os dois campos removidos.

**Alternatives considered**: gerar em todo teste exigiria os arquivos de `lab\`, que não estão no repositório nem na CI.

## R10. Decisões que não viraram ADR

Nenhuma decisão desta feature é difícil de reverter: as regras são dados, a extração é um módulo pequeno, e a mensagem do
elo é interna. Nenhum ADR novo.
