# Research: Base de dados (data-base)

Decisões técnicas da 004. As medidas vêm de [prototipo/README.md](prototipo/README.md), com o jogo real em 09/11/2026, e do relatório `.superpowers/reports/Leitura do jogo sem travar.md` (fora do git).

## R1. Como ler o estado sem travar o jogo (FR-001, FR-002)

**Decision**: leitura contínua em fatias de até 25 KB, uma a cada 250 ms, nunca duas em voo, por `Runtime.callFunctionOn` sobre a referência ao motor que o leitor já tem. A lista de chaves e o cursor ficam no guardião. A resposta é uma cópia só de valores simples, montada por percurso de descritores de propriedade.

**Rationale**: medido com o jogo aberto, a fatia de 25 KB custa 0,60 ms (p50) e 1,65 ms (p95) de função, contra 14,08 ms e 16,67 ms do retrato inteiro, e não piorou os quadros de forma visível em 6 pares de janelas. A 50 KB o p95 do quadro piorou nas 6 rodadas, em cerca de 1,9 ms. O Vinicius escolheu 25 KB.

**Alternatives considered**: retrato inteiro por evento (bloco maior que um quadro, reprovado para rodar sempre); só os campos dos 10 números (a lista cresceria a cada bloco, e a análise estática erra para os dois lados); save em disco (21 a 416 s atrás); `requestIdleCallback`, `addBinding`, `Proxy` ou setter (deixam código no jogo, colidem com o risco zero).

## R2. A ordem da rotação (FR-001)

**Decision**: duas classes de peças. A cada segundo, 3 fatias da classe `formula` e 1 da classe `other`. A classe `formula` é uma lista fixa de 148 chaves de topo em `src/shared/state.ts`, tirada da análise estática das fórmulas, mais o personagem ativo, os dois bônus de `DNSM` e os `_vars`. É usada só como prioridade: nenhuma chave fica de fora.

**Rationale**: as chaves das fórmulas somam cerca de 179 KB, e o personagem ativo cerca de 46 KB: cerca de 10 fatias, que giram em menos de 5 s. As demais giram em cerca de 20 s, porque cada outro personagem, com cerca de 46 KB, é uma fatia só. Tela e personagem continuam com a leitura de 1 s que já existe. Atende o alvo de FR-001 sem classe a mais.

**Alternatives considered**: rotação simples, cerca de 7 s para tudo, fora do alvo de 5 s. Prioridade por frequência de mudança exige comparar e guardar histórico, sem ganho medido.

## R3. Coerência do mosaico (FR-022)

**Decision**: cada fatia leva o sentinela (personagem e mapa). Se o sentinela mudar, o app descarta o que tinha. Filhos de `PlayerDATABASE` e subchaves de `DNSM` são peças separadas. Chaves de topo que o protótipo não mostrou divergir não ganham agrupamento especial.

**Rationale**: o protótipo mostrou números idênticos entre mosaico e retrato inteiro com a personagem parada. O risco em combate fica medido no roteiro, e o sentinela cobre o caso que misturaria personagens.

**Alternatives considered**: agrupar por dependência entre chaves, sem dado que diga quais grupos importam.

## R4. Quando calcular

**Decision**: o primeiro cálculo de um personagem espera uma volta inteira, de todas as peças. Depois, o app calcula quando a classe `formula` completou um ciclo desde o último cálculo e algum valor mudou, com pelo menos 5 s entre um cálculo e o próximo. Um cálculo por vez; o mais novo substitui o que esperava. Roda com a aba fechada também (decisão do Vinicius).

**Rationale**: o custo do cálculo fica fora da linha do jogo, mas é de cerca de 2,4 s de um núcleo; sem o intervalo, em combate, ele ocuparia um núcleo quase o tempo todo. Sem a volta inteira, o primeiro cálculo leria chaves ainda ausentes e poderia dar um número errado. Comparar valores evita trabalho à toa.

**Alternatives considered**: um cálculo por fatia, sem ganho e sem mosaico completo.

## R5. Onde o cálculo roda (FR-008, FR-010)

**Decision**: num `worker_threads` criado pelo processo principal do app, a partir de `src/calculator/`, com entrada própria no build. O guardião não tem cálculo nenhum.

**Rationale**: o guardião caindo fecha o jogo; o cálculo caindo só tira os números do app. `worker.terminate()` encerra um cálculo travado.

**Alternatives considered**: no guardião (rejeitado: risco ao jogo); `child_process` ou `utilityProcess` (mais isolamento de falha, mais código e canal próprio; ver R7 para o que cada um cobre).

## R6. Como o processo isolado recebe os arquivos do jogo (Open Questions, "to plan")

**Decision**: o guardião publica no elo a pasta `resources` do jogo que ele lançou. O processo principal do app lê `app.asar/distBuild/static/game/N.js` e `app.asar/distBuild/static/game/lib/default.pak` com o `fs` do Electron, que entende asar, e transfere os bytes ao worker. O worker nunca recebe caminho nem `fs`.

**Rationale**: o guardião já sabe qual executável lançou. O worker sem caminho não tem o que abrir, e a transferência evita duas cópias de 71 MB.

**Alternatives considered**: o guardião mandar os bytes pelo elo (71 MB num canal de linhas); o app localizar o jogo pela Steam (pode achar outra instalação).

## R7. Como o `N.js` fica sem caminho até a rede (Open Questions, "to plan")

**Decision**: quatro camadas. (1) O código do jogo roda num contexto `node:vm` criado com `codeGeneration: { strings: false, wasm: false }`. (2) Nenhum objeto do Node ou do host entra no contexto: stubs e pontes são criados dentro dele, para que `constructor.constructor` seja o do contexto, com geração de código desligada. (3) `XMLHttpRequest`, `fetch`, `WebSocket` e `navigator.sendBeacon` existem só como stubs que lançam erro, e a ponte do Firebase responde como vazia. (4) O worker nasce com `env` vazio, sem `stdin`, e com `resourceLimits`. Teste: um código de jogo inventado que tenta rede pelos caminhos conhecidos não alcança nada.

**Rationale**: `node:vm` sozinho não é barreira de segurança. O código executado é o do jogo oficial, não de um atacante, e no texto dele há 0 `fetch`, 0 `WebSocket`, 0 `require` e 3 menções a `XMLHttpRequest`; o que se quer impedir é rede por engano. Há 1 `eval(` no texto, e o cálculo não passa por ele: em 09/11/2026, com a geração de código desligada, os 11 valores saíram iguais. Para `constructor.constructor` ser o do contexto, o objeto dado a `vm.createContext` não pode ter protótipo (`Object.create(null)`).

**Alternatives considered**: permission model do Node, no processo inteiro e não por worker; `utilityProcess` com a sandbox do Chromium, que não roda o Node completo que o motor precisa. O risco que sobra é um escape deliberado do `vm`, aceito porque o código é o do próprio jogo.

## R8. Tempo máximo de um cálculo (Open Questions, "to plan")

**Decision**: 2 s por número e 15 s para o conjunto; 60 s para inicializar o motor. Passou disso: `worker.terminate()`, e a aba mostra "Calculator unavailable" até o próximo início do jogo.

**Rationale**: medido no laboratório: 210 ms para carregar o código e cerca de 2,2 s para inicializar e calcular os 11 valores, com cerca de 106 MB de heap. Os limites dão folga de cerca de 7 vezes em máquina mais lenta. O protótipo de pesquisa já usa 2 s por chamada.

**Alternatives considered**: sem limite (um travamento deixa a aba calculando para sempre).

## R9. Formato dos números na aba (Open Questions, "to plan")

**Decision**: arredondar para cima, como o jogo. Com separador de milhar até 999 bilhões (`2,797,522`), `T` para trilhões (`351T`) e notação `E` com 2 casas truncadas acima disso (`1.49E33`). Damage em uma linha: `mínimo – máximo`. Drop Rate com `x`, AFK Gains com `%`.

**Rationale**: reproduz o que a tabela do A6 mostra no Player Info. A aba é simples por pedido do Vinicius e será refeita em outra feature.

**Alternatives considered**: usar o formatador do jogo na cópia, que chamaria mais código dele sem necessidade.

## R10. `_vars` na rotação (FR-006, FR-007)

**Decision**: a busca pelo closure com `Runtime.getProperties` roda uma vez por carga do jogo, com o limite de 3000 objetos e da lista fechada de 27 chaves, e guarda só a referência ao objeto que as contém, num `objectGroup` próprio. A cada ciclo, relê essas chaves. A referência é solta ao parar.

**Rationale**: a busca completa inspeciona dezenas de objetos perto de onde o token pode estar; repeti-la a cada ciclo não traz nada. Nada fora da lista sai da função que filtra.

**Alternatives considered**: refazer a busca inteira a cada ciclo; uma vez por sessão, sem atualizar votos e Tome (o Vinicius escolheu a rotação).

## R11. Conferência com `StatList` (FR-023)

**Decision**: depois de calcular, comparar STR, AGI, WIS e LUK com as posições 0 a 3 de `PersonalValuesMap.h.StatList` do personagem ativo, que o jogo grava a cada 30 s. Vale como igual até 1% ou 1 ponto de diferença. Uma diferença que dura mais de 35 s marca o número como "unavailable".

**Rationale**: é o único detector de patch de graça. A ordem das posições foi conferida no retrato de 09/11/2026, em que as 4 bateram exatamente. `StatList` pode estar até 30 s atrás, e trocar um equipamento não pode virar "unavailable".

**Alternatives considered**: sem conferência (um patch daria números errados em silêncio).

## R12. O que fica de fora

Pipe em CBOR, `SharedObject.data`, leitura do `.log` do LevelDB e `Tracing` em produção: nenhum tem número medido que os peça. A rede continua proibida fora do atualizador, e nada disso mexe nessa regra.

## R13. ADR

O [ADR 0006](../../docs/adr/0006-game-code-runs-in-an-isolated-worker.md) registra a exceção a "nunca executar o arquivo do jogo". A emenda da constituição sai em branch e PR próprios, antes da primeira linha de código desta feature.

## R14. De onde vêm as tabelas que ficam fora do retrato (FR-004)

**Decision**: `CustomLists` e `CustomMaps` são montadas no worker chamando as funções estáticas sem argumentos das classes `scripts.CustomLists*` e `scripts.CustomMaps*` do jogo instalado, como o próprio jogo faz; itens, monstros e diálogos, pelas classes de definição; `PixelHelperActor` começa vazio.

**Rationale**: no laboratório essas tabelas vinham do save local, e o app não lê o save. Conferido em 09/11/2026: sem o save, com um estado inicial vazio, os 11 valores saíram iguais aos de com o save.

**Alternatives considered**: ler as tabelas do jogo em execução (2,4 MB e 2,2 MB, fora do limite de uma fatia); ler o save do disco (mais um arquivo de conta, sem necessidade).
