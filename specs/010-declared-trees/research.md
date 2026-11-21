# Research: Árvores declaradas

Base: o protótipo em `prototipo/` (gabarito, receita do Drop Rate escrita à mão e trava), as duas rodadas de clarify e
o código de hoje (`src/calculator/tree-engine.ts`, `tree-build.ts`, `tree/`, o worker de árvores e a tela da 009).
Cada decisão diz o como; o quê está na spec.

Vocabulário: no texto, **receita**, **gabarito** e **trava**, como na spec. No código, em inglês e únicos na busca
(constituição, "Names are unique"): receita é `blueprint`, gabarito é `answerKey` e trava é `lock`
(`lockBlueprint`). O nome `recipe` já é da gravação (`Recipe`, `TREE_RECIPE`) e dos nomes (`NAME_RECIPES`), por isso
fica de fora.

## Os 7 pontos do protótipo

### R1. A regra dos pools

- **Decisão:**
  - **Regra:** a regra da FR-002c vale para as 289 árvores. O gabarito lê as escritas do acumulador da raiz, na ordem.
    Cada escrita vira um passo de soma ou de multiplicação, e passos seguidos do mesmo tipo formam um pool só. É o que o
    protótipo fez no Drop Rate: 8 escritas, 4 pools.
  - **Formas de raiz:** o gabarito classifica cada raiz numa de três formas:
    - **corrente:** existe um acumulador escrito mais de uma vez, e a última escrita é o valor final; é o caso do Drop
      Rate;
    - **expressão:** sem acumulador, a raiz devolve uma expressão. O gabarito parte a expressão pelo operador de cima,
      com a mesma regra: um trecho seguido de `+` é um Additive pool, e um trecho seguido de `×` é um Multi pool;
    - **fora da regra:** qualquer outra forma. O caso conhecido é uma escrita que troca o valor do acumulador em vez de
      somar ou multiplicar, como o `Holes2("Cglunko_DR")` do mapa 216.
  - **Sem palpite:** uma raiz fora da regra não ganha pool por palpite. O gabarito falha com o motivo "forma de raiz
    fora da regra dos pools", e o número fica sem receita até o Vinicius decidir.
  - **Sonda das raízes:** a Fase 2 roda uma sonda única sobre as 289 raízes, num processo só, antes de qualquer lote. A
    sonda conta quantas raízes caem em cada forma. As que ficarem fora da regra vão ao Vinicius de uma vez, numa tabela,
    na parada da fase.
  - **Decisão do Vinicius:** se ela só esclarecer a regra, vira uma linha `resolved` de Open Questions, marcada "durante
    a implementação"; se mudar o escopo, vira feature nova (constituição, Specs).
- **Justificativa:**
  - A regra já está na spec e foi medida no Drop Rate, com erro de 1e-13 por pool.
  - O que falta é saber se as outras 288 raízes cabem nela. Medir antes dos lotes evita a lição 1 da 009, quando a
    sonda das 716 árvores só rodou no fim e achou 435 árvores sem pool.
- **Alternativas:**
  - **Tratar a troca como um terceiro tipo de pool:** descartada. A spec só conhece Additive e Multi (FR-002c), e um
    tipo novo muda a tela e a spec.
  - **Deixar a receita declarar a corrente à mão quando o gabarito não lê:** descartada. A trava perderia a conferência
    da ordem dos pools, que é a garantia da US2.

### R2. A fórmula fica fora da receita: a trava remonta a conta na hora

- **Decisão:**
  - **O que a receita guarda:** só forma, nomes, tipos de folha e referências; nunca a conta.
  - **Como a trava remonta a conta:** a trava pega a expressão gravada de cada nó (os passos do `makeSteps`, o `Expr`
    com o valor de cada pedaço) e troca cada referência pelo valor do filho declarado que tem aquela referência. Depois
    avalia a expressão com um avaliador próprio, sem `eval` (`expr-eval.ts`), e compara o resultado com o valor gravado
    do nó.
  - **Tolerância:** diferença relativa de até 1e-6, a da SC-001.
  - **Nada fica guardado:** a conta remontada só existe em memória, durante a trava. Ela nunca vai para a receita, para o
    repositório nem para os relatórios: os relatórios levam só o nível, o valor declarado e o valor do jogo.
  - **Erros por nível:** a trava acusa três casos, cada um com o caminho do nó:
    - **parte não declarada:** uma referência da expressão que não é filho declarado nem parte da lista do R6;
    - **filho fora da conta:** um filho declarado que não está na expressão;
    - **nível que não fecha:** a expressão avaliada com os valores dos filhos dá outro valor.
  - **Primeiro nível de teste:** os testes da descida já começam com uma cadeia de dois níveis ou mais, pela lição 5 da
    008.
- **Justificativa:**
  - A FR-010 pede o fechamento em todos os níveis, sem guardar a conta.
  - A expressão gravada é a própria conta do jogo naquela gravação, e a trava cobre dois riscos:
    - **a cobertura** (parte não declarada e filho fora da conta) acha a fonte esquecida e a fonte inventada;
    - **a reavaliação** acha um `Expr` mal montado pelo `makeSteps`, como um `val` sem dono ou uma passagem mal casada.
  - O protótipo mostrou o custo: com fórmula, 40 níveis fecharam; sem fórmula, só a cobertura. Remontar na hora dá os 40
    níveis sem pôr código do jogo no Git.
- **Alternativas:**
  - **Só cobertura abaixo do pool:** descartada pela segunda rodada do clarify.
  - **Guardar a fórmula fora do repositório e conferir com ela:** descartada. Duas fontes da verdade, e uma delas é
    código do jogo transcrito numa pasta que alguém pode copiar.

### R3. As condições `cond && (...)`

- **Decisão:**
  - **A receita declara a condição:** o nó que um `cond && (...)` liga ou desliga leva um campo `condition`. A condição é
    um nó com referência, nome do jogo e folha do tipo Condição.
  - **A trava confere de duas formas:**
    - a leitura da condição existe na gravação do bloco;
    - o valor gravado da condição concorda com a presença do termo no gabarito: condição verdadeira e termo presente, ou
      condição falsa e termo ausente.
  - **O `instrument` não muda.**
- **Justificativa:**
  - A spec diz que a gravação não muda de comportamento nesta feature e só ganha a extração do gabarito (Assumptions).
  - Marcar o `&&` no `instrument` mudaria os passos de todos os blocos e a árvore antiga, que continua no ar até a troca
    da Fase 7.
  - A dupla conferência pega uma condição declarada errada sem tocar no gravador.
- **Alternativas:**
  - **O `instrument` marcar o lado esquerdo do `&&` como checagem:** descartada por ora. Ficaria dentro da ADR 0008, que
    só acrescenta chamadas `__X`, mas muda a gravação que a árvore antiga lê no meio da feature. Fica como melhoria
    depois da troca, se a trava achar condição que a dupla conferência não pega.

### R4. O termo de duas fontes

- **Decisão:**
  - **Uma linha só:** como na FR-002b, o termo vira uma linha, com o nome da primeira fonte e o valor do termo, que é o
    valor que entra no pool.
  - **Os filhos:** os filhos da linha são as referências do termo, na ordem do código:
    - o primeiro filho é a chamada da primeira fonte, com os filhos dela;
    - o segundo filho, marcado `termPart`, leva o sistema dele, e o emoji aparece no nome da linha, como "🏆 Boss battle
      best".
  - **Na trava:** a chave de uma fonte é (pool, referência principal, ocorrência). As outras referências do termo têm de
    estar entre os filhos `termPart`, e o termo fecha pela expressão gravada do termo, como no R2.
  - **Na tela:** a segunda fonte é uma linha filha, nunca um grupo do pool. A FR-014 vale assim: o sistema dela aparece
    como filho, pelo emoji, dentro da linha do termo.
- **Justificativa:** está decidido na spec. O protótipo já usava essa forma (talento 655 × recorde; Unagi + Gold Bangle;
  Mallay × Glunko), e a trava fechou.
- **Alternativas:** linhas separadas no pool, como a 0.9. Descartada pela spec: o pool somaria duas linhas que o jogo não
  soma.

### R5. Referências que dependem do personagem

- **Decisão:**
  - **Dois marcadores na referência:**
    - `{character}`: o personagem da árvore. Exemplo: `PlayerDATABASE[{character}].SkillLevels[328]`.
    - `*`: qualquer personagem. Serve quando o jogo pega o melhor ou soma todos, como o `getbonus2(1,328,-1)`, que pega
      o melhor dos personagens.
  - **Como a trava resolve:** `{character}` vira o índice do personagem gravado. Com `*`, vale a primeira leitura
    gravada que case com o padrão, e o nó guarda quantas leituras casaram.
  - **O nó da escolha:** um nó que escolhe entre personagens declara a folha Escolha, quando é folha. Quando é galho, a
    descida continua no personagem escolhido, e o ⓘ diz a escolha.
  - **Sem índice cru:** uma checagem de CI recusa receita com índice de personagem escrito por extenso, como
    `PlayerDATABASE[1]`. Nome de personagem nunca chega à receita, porque a gravação já troca o nome pelo índice.
- **Justificativa:** o protótipo escreveu `PlayerDATABASE[1]`, que vale só para aquele save. O marcador torna a receita
  igual para todo personagem e todo save, como pede a "uma receita por número" da FR-002a.
- **Alternativas:** uma receita por personagem, ou uma referência por save. Descartada pela FR-002a e pela NFR-004, que
  não admitem nada do save na receita.

### R6. As partes que não são folha

- **Decisão:**
  - **Lista no código:** uma lista fixa, `not-leaves.ts`, diz as partes que entram na conta sem ser linha. Cada entrada
    tem o bloco ou o caminho, o papel e a razão:
    - **curva:** `ArbitraryCode5Inputs` nos modos de curva, como `decay`;
    - **log:** `getLOG`;
    - **contexto:** a masmorra (`Dungon`) e o mapa atual;
    - **contador de laço:** `GurtBonuzz`;
    - **leitura de outro personagem:** a que entra numa escolha (R5).
  - **Como a trava trata uma parte transparente:** ela entra na expressão do pai, mas não vira filho. Os argumentos
    dela, como o topo e o meio da curva e o nível, são os filhos declarados do pai.
  - **Como uma parte transparente fecha:**
    - quando os parâmetros dela casam um a um com os argumentos da chamada, a trava remonta a expressão gravada da
      própria parte com os valores dos filhos, e o nível fecha pela conta inteira;
    - quando o casamento é ambíguo, como dois argumentos de mesmo valor, o nível fecha pelo valor gravado da parte. O
      relatório da trava conta esse caso como "fechado pelo valor gravado", um aviso visível e nunca silencioso.
  - **Na tela:** uma parte da lista aparece só no ⓘ da linha, como manda a FR-016 (a curva com as constantes nomeadas
    pelo papel).
  - **Entrada nova na lista:** só com a razão, e passa pelas checagens das 289 árvores, como uma regra de forma (R12).
- **Justificativa:**
  - O protótipo achou 19 partes não declaradas no Drop Rate, e todas eram desses cinco tipos.
  - Sem a lista, a trava reprova por elas. Com uma lista solta por receita, cada agente inventaria a sua.
- **Alternativas:**
  - **Declarar a curva como um nó da receita:** descartada. A FR-016 manda a curva para o ⓘ, e ela viraria uma linha.
  - **Fechar toda parte transparente pelo valor gravado:** descartada como padrão, porque não confere os filhos de baixo
    da curva. Fica só para o caso ambíguo, e com aviso.

### R7. A escala: rascunho da receita a partir do gabarito

- **Decisão:**
  - **O gerador:** `draft.ts` gera o rascunho de cada número a partir do gabarito. O rascunho traz:
    - os pools na ordem;
    - as fontes e as constantes de cada pool, na ordem, com a referência;
    - os filhos de cada fonte, um nível por vez, tirados das referências da expressão gravada do nó, até as folhas que a
      gravação já mostra;
    - o nome de cada linha, das tabelas de texto do jogo, com a prova;
    - a classe das fontes de talento, pela tabela de talentos por classe.
  - **Linha sem nome provado:** fica com `name: null` e a pendência `name`. O mesmo vale para sistema (`system`), tipo
    de folha (`leaf`) e descida (`descend`).
  - **O guia para o agente:** o gerador escreve, fora do repositório (`TREES_OUT`), um despejo dos passos gravados de
    cada fonte. Foi o guia que fez o protótipo levar 40 minutos.
  - **O trabalho à mão:** os agentes completam o que falta: os grupos por sistema, os emojis pela tabela de sistemas,
    os tipos de folha, os nomes sem prova e a descida até a folha.
  - **Pendência trava a receita:** uma receita com pendência nunca passa na trava, porque a FR-004 não admite "no name
    yet".
- **Justificativa:**
  - O Drop Rate levou 40 minutos à mão, com 72 fontes. As 289 receitas à mão, sem rascunho, não cabem na feature.
  - O que o gerador tira do gabarito é o que a trava confere, então o rascunho já nasce passando na ordem e na presença.
  - O trabalho humano fica onde a máquina não prova: o sistema e o nome.
- **Alternativas:**
  - **Gerar a receita inteira, com grupos e nomes pela forma:** descartada. É a forma adivinhada que a feature tira
    (Out of Scope).
  - **Receitas só à mão:** descartada pelo tempo medido no protótipo.

## O resto do como

### R8. O formato da receita, onde mora e como o app carrega

- **Decisão:**
  - **Formato:** um arquivo JSON por número, `<id>.blueprint.json`, com o id do catálogo. A forma está em
    [contracts/blueprint.md](contracts/blueprint.md):
    - a raiz com a chamada do jogo;
    - os pools; dentro deles, os grupos; dentro dos grupos, as fontes e as constantes;
    - os filhos de cada fonte até a folha.
    - Cada nó leva chave, nome, prova do nome, referência, tipo de folha, classe, condição e `termPart`.
  - **Chaves em inglês:** as chaves do JSON são identificadores e vão em inglês, pela constituição.
  - **Referência estruturada:** a referência é um objeto, `{ "call": "GetTalentNumber", "args": [1, 655] }` ou
    `{ "read": "OptionsListAccount[189]" }`, nunca uma expressão.
  - **Onde mora:** em `src/calculator/blueprints/<lote>/`, uma pasta por lote (`w1` … `w7`, `character`, `account`). A
    receita é dado da calculadora, e só ela conhece as chamadas do jogo (`nothing-imports-the-calculator`).
  - **A tabela de sistemas:** `src/calculator/blueprints/systems.json` tem nome, emoji, prova e ordem de cada sistema.
    Uma receita só cita o id do sistema, e o emoji sai da tabela; assim, o mesmo sistema tem sempre o mesmo emoji.
  - **Como o app carrega:** `blueprints.ts` importa os `*.blueprint.json` com `import.meta.glob` (eager), e o vite os
    põe dentro do `calculator.js`. Os arquivos de revisão (`*.review.json`) nunca são importados.
  - **Conferência na carga:** cada receita é conferida na carga por `parseBlueprint`. Uma receita fora da forma
    responde `unknownNumber` para aquele número, e um teste de CI lê todas.
  - **A chamada da raiz:** passa a morar na receita. O `root-calls.json` e o `tree-roots.ts` saem na Fase 7.
- **Justificativa:**
  - Um arquivo por número dá um diff que cabe numa leitura e um commit de dados por lote (lição 3 da 008).
  - A referência estruturada passa pelo `no-game-text.test.ts`, sem aspas de código dentro de texto, e responde à FR-003.
  - Morar na calculadora segue a ADR 0006 e a regra `calculator-alone`.
- **Alternativas:**
  - **Um JSON único com as 289:** descartada. O diff de um lote ficaria ilegível, e a revisão por arquivo se perderia.
  - **Receitas fora de `src/`, numa pasta `blueprints/` na raiz:** descartada. Fica longe de quem lê, e o scan do
    `no-game-text` teria de ganhar mais uma pasta.
  - **TypeScript em vez de JSON:** descartada. Dado não é código, e o gerador de rascunho escreve JSON.

### R9. O gabarito, como sai da gravação de hoje

- **Decisão:**
  - **Origem:** `answer-key.ts` porta o `gabarito.ts` do protótipo para o código de produto, com a mesma forma: raiz,
    valor final, acumulador, forma (R1), pools com tipo, valor, valor depois do pool, passos e erro, termos e poluição.
  - **Entrada:** a gravação de hoje, sem mudança: `bootRecorder(...).record` com o `TREE_RECIPE`, os `EXTRA_ROOTS` e os
    `FOLLOW_CALLS`, e os passos do nó raiz por `makeSteps`.
  - **Arquivos:** fica em dois arquivos, porque o do protótipo tem 333 linhas e cresce com a forma "expressão" do R1:
    - `answer-key.ts`: a corrente e os pools;
    - `answer-key-terms.ts`: abrir os termos, atravessar as passagens e o `/ 100`.
  - **Só leitura:** o gabarito lê a gravação e não chama nada do jogo (FR-008).
  - **Onde vivem os valores:** só em memória, no worker, ou em `TREES_OUT`, fora do repositório.
- **Justificativa:** o protótipo extraiu o gabarito em 1 a 5 ms, fechando com erro de 1e-13, sobre a gravação de hoje.
  Não há razão para mudar a entrada.
- **Alternativas:** um gravador novo, só da raiz. Descartada: a trava precisa dos nós de baixo para descer, e o gravador
  de hoje já entrega os dois.

### R10. A trava sobre as 289 árvores, num processo só

- **Decisão:**
  - **Origem:** `lock.ts` porta o `trava.ts` do protótipo, com o fechamento do R2 abaixo do pool. Fica em dois arquivos:
    - `lock.ts`: a ordem dos pools, a presença das fontes, a ordem dos grupos e das fontes e o fechamento do pool;
    - `lock-levels.ts`: a descida, o fechamento por nível, as partes transparentes e as condições.
  - **Dois modos:**
    - **`check`:** usado na conferência sobre o jogo real. Uma falha reprova a receita.
    - **`runtime`:** usado no app. Uma falha não reprova nada e vira alerta (R16).
  - **A conferência real:** é um teste de integração só, `src/calculator/declared/real-trees.integration.test.ts`,
    rodado por `just trees <alvo>`.
    - Se pula sozinho sem `TREES_GAME_DIR`, `TREES_SNAPSHOT` e `TREES_OUT`, como o `just parity`.
    - Sobe o gravador uma vez e passa pelas 289 em série, no mesmo processo e na mesma thread do vitest
      (`--pool=threads`, um arquivo só).
    - O alvo é um id, um lote ou `all`.
  - **Classes:** para cada número com fonte de classe, a conferência grava de novo com um personagem de cada classe que
    o retrato tem, pela reconstrução de personagem inativo (`inactive.ts`). Assim, a FR-002a é conferida em mais de uma
    classe.
  - **Saídas:** vão só para `TREES_OUT`: o resultado da trava, a árvore montada, os alertas, o relatório das regras e o
    relatório de mudanças ([contracts/real-trees-run.md](contracts/real-trees-run.md)).
  - **Para o repositório:** o arquivo de revisão do número leva só o hash da receita, o resultado e o hash do jogo
    (R14).
- **Justificativa:**
  - A NFR-003 pede um processo só, por causa da tela azul.
  - A conta: o boot leva cerca de 1,5 s e cada gravação de 2,4 a 3,1 s. Uma rodada inteira deve levar de 15 a 20
    minutos, a medir no piloto.
  - Cada agente de receita recebe o relatório da rodada e nunca roda a conferência real em paralelo.
- **Alternativas:**
  - **Um teste por número:** descartada. Seriam 289 arquivos, e o vitest abriria workers em paralelo.
  - **Um script Node fora do vitest:** descartada por ora. O gravador importa arquivos `?raw` pelo vite, que o Node puro
    não lê; o vitest já resolve isso, como no `just parity`.

### R11. Montagem da árvore na tela a partir da receita e dos valores

- **Decisão:**
  - **O caminho de um pedido `number`:** o worker de árvores faz, em ordem:
    1. grava, como hoje;
    2. extrai o gabarito;
    3. roda a trava no modo `runtime`;
    4. monta a árvore inteira pela receita (`assemble.ts`).
  - **De onde vêm os valores:**
    - **pool:** do gabarito, quando a corrente casa com a receita; senão, a combinação das linhas de dentro;
    - **termo de pool:** do gabarito;
    - **filho:** da referência resolvida na gravação;
    - **fonte declarada que o jogo não usou nesta gravação:** 0 no Additive e ×1 no Multi, em cinza, como diz o Edge
      Case.
  - **Classe:** uma fonte de outra classe some, e um grupo some só quando todas as fontes dele são de outras classes
    (FR-002a). A classe do personagem sai do mosaico.
  - **O mesmo contrato:** a árvore montada usa o `CalcTreeNode` de hoje.
    - **Papéis:** `pool`, `system` e `row`.
    - **Valores:** o `fmt` segue o pool: "+80%" no que soma, "×1.06" no que multiplica.
    - **`combine`:** `sum` ou `percent` no Additive, `product` no Multi.
    - **Folha:** o `leaf` é um dos 9 tipos, e nunca `unknown`.
  - **Pedidos `expand`:** a árvore inteira fica guardada no worker. Os pools continuam `lazy` no primeiro envio, para que
    tudo comece fechado (FR-013), e o `expand` devolve o nível guardado. A janela, o `tree-check.ts` e o
    `formula:update` não mudam.
  - **O ⓘ ("How it adds up"):** `how-it-adds-up.ts` o monta na hora, a partir da expressão gravada do nó, com os nomes
    dos filhos e as partes transparentes pelo nome do papel. O ⓘ da raiz junta os pools. Quando o número de termos não
    casa com o de números, o ⓘ vai na forma de regra, como na 008. A conta nunca é guardada.
  - **Ao vivo:** fica como na 009. O `values` recalcula as peças à vista e a raiz, e o main refaz a árvore em silêncio,
    no máximo a cada 10 s. A forma é a da receita, então não muda (FR-017).
- **Justificativa:**
  - A FR-012 pede que o app só leia a receita e preencha os valores.
  - Manter o `CalcTreeNode` e o `expand` deixa a janela, o main e os testes da 009 valendo, e a FR-013 pede o visual da
    009.
  - O tempo do Drop Rate fica na gravação (cerca de 3 s), mais 5 ms do gabarito e 15 ms da trava, abaixo dos 5 s da
    NFR-001.
- **Alternativas:**
  - **Montar a árvore no main:** descartada. A receita tem as chamadas do jogo, que só a calculadora conhece.
  - **Montar nível a nível, como a 008:** descartada. A receita já tem a forma inteira, e a trava precisa da árvore
    inteira para os alertas.

### R12. Chaves das peças, ids dos nós, limpeza dos Pins e marcas e a faixa de aviso

- **Decisão:**
  - **Chave de peça:** sai da referência da receita, resolvida para o personagem:
    - **chamada:** `JSON.stringify([personagem, bloco, ...args])`;
    - **leitura:** `JSON.stringify([personagem, caminho])`;
    - **pool, grupo e constante:** `null`.
  - **O formato é o mesmo da 008.** Assim, `values`, Onde isto entra e o radar continuam lendo a chave como hoje.
  - **Id do nó:** `<id do número>/<índice do pool>/<id do sistema>/<chave da fonte>/<chave do filho>…`. As chaves são
    as `key` da receita (slugs únicos entre irmãos), sem a referência crua.
  - **Versão 2 dos arquivos salvos:** `marks.json`, `pins.json` e `tree-shapes.json` passam à versão 2
    ([contracts/saved-files.md](contracts/saved-files.md)).
  - **Na primeira abertura, com um arquivo na versão 1:** `old-trees.ts` apaga o arquivo e o `.tmp` e o `.bad` dele, e
    nada é levado (FR-028). Um arquivo de outra versão segue a regra de hoje: vira `.bad`.
  - **A faixa:**
    - aparece só quando `marks.json` ou `pins.json` tinha ao menos uma marca ou um pin;
    - o `tree-shapes.json` é apagado sem aviso, porque é dado derivado;
    - a pendência fica em `settings.json`, numa chave só do main, `oldTreesNotice: "pending"`, como o zoom;
    - a janela recebe a faixa por um canal novo e a fecha por outro ([contracts/ipc.md](contracts/ipc.md));
    - fechar a faixa tira a chave, e a faixa não volta;
    - o texto é o da FR-028.
  - **Só os dados do app:** apagar toca só esses três arquivos, na pasta de dados do app.
- **Justificativa:**
  - A FR-028 manda apagar e avisar uma vez.
  - Manter o formato da chave evita mexer no `values`, no `feeds-index.ts` e no `radar.ts`, que não estão no escopo.
  - Guardar a pendência no `settings.json` faz o aviso sobreviver a um fechamento do app antes de o jogador ver a faixa.
- **Alternativas:**
  - **Chave nova, como `<número>/<caminho>`:** descartada. Quebra o `values` das peças e o Onde isto entra, que
    compartilham a peça entre números.
  - **Avisar sem apagar:** descartada pela spec.
  - **Pendência num arquivo próprio:** descartada. Seria mais um arquivo para conferir e apagar.

### R13. Registro numerado das regras de forma e as checagens

- **Decisão:**
  - **O registro:** fica em `docs/arvores/regras-de-forma.md`, em português, uma tabela com número (`R01`…), frase,
    exemplo, checagem e estado (`vale`, ou `substituída por Rnn`).
  - **As checagens:** ficam em `src/calculator/declared/shape-rules.ts`, uma função por número de regra.
  - **Dois testes:**
    - um teste de CI amarra o registro ao código nos dois sentidos: regra que vale tem checagem, checagem tem regra, e
      regra substituída não tem checagem ativa;
    - outro teste de CI roda as checagens que só precisam da receita sobre as 289 receitas.
  - **Dois tipos de checagem:**
    - **de receita:** rodam no CI, sobre as receitas. Exemplos: nenhum grupo "Other", toda folha com tipo, todo nome com
      prova, nenhum índice de personagem cru, o emoji da tabela;
    - **de árvore:** rodam na conferência real, sobre as árvores montadas. Exemplos: o sistema sempre aparece como filho,
      cada nível fecha, a ordem do gabarito.
  - **Conflito:** cada regra declara as regras com que ela puxa em sentido contrário (`tension`). O relatório marca
    conflito em dois casos:
    - duas regras falham no mesmo nó da mesma árvore;
    - uma regra falha num nó onde uma regra em tensão com ela passa.
  - **O relatório:** mostra a árvore, o nó e os dois números, e nenhuma regra é desligada nem priorizada. Ele vai para
    `TREES_OUT`, e a sessão leva cada conflito ao Vinicius por pergunta, com a tabela antes (FR-021).
  - **As regras de partida:** vêm da spec, cada uma com o número da FR. São elas: pools por trecho (FR-002c), termo de
    duas fontes (FR-002b), fonte de classe (FR-002a), nome do jogo com prova (FR-004), tipo de folha (FR-005), sistema
    real e sem "Other" (FR-006), ordem do gabarito (FR-013a), sistema sempre como filho (FR-014), cada nível fecha
    (FR-015) e nenhum "no name yet" nem "Game value" (SC-003).
  - **Regra nova:** entra pelo registro, roda nas 289 e mostra quantas árvores mudaram antes da aprovação (FR-022).
- **Justificativa:**
  - A FR-020 e a FR-021 pedem número, frase, exemplo, checagem e estado.
  - As regressões da 0.9 vieram de duas regras em tensão (a FR-007 da 009 contra a FR-018, e a família 21 contra o
    sistema como filho).
  - A tensão declarada deixa testável o cenário da US4: uma receita que obedece uma regra e fere a outra.
- **Alternativas:**
  - **Detectar conflito só por duas falhas no mesmo nó:** descartada. Não pega o caso da US4, em que uma passa e a outra
    falha.
  - **Registro só no código:** descartada. O Vinicius lê o registro, e o `docs/catalogo/regras.md` já é o padrão dele.

### R14. Galeria, imagens e aprovação

- **Decisão:**
  - **As imagens:** saem de uma ferramenta de desenvolvimento em Electron, em `scripts/gallery/`, montada pelo vite com
    configuração própria. A saída vai para `TREES_OUT/gallery-app/`, fora do repositório e do instalador. Ela roda com
    `just gallery <lote>`.
    - Para cada árvore do lote que passou na trava, a ferramenta desenha a árvore montada pela conferência real com o
      `FormulaTree.tsx` e o `styles.css` de verdade, numa janela fora da tela, com a árvore inteira aberta (FR-023).
    - Captura a imagem com `capturePage()`, em fatias de até 8.000 px de altura, e guarda os PNG em `TREES_OUT/img/`.
    - Só refaz a imagem de uma árvore que mudou desde a última captura.
  - **A tela:** o `FormulaTree` ganha uma prop `openAll`, usada só pela galeria. Na tela do app, tudo continua começando
    fechado (FR-013).
  - **A galeria:** abre numa janela da mesma ferramenta, com `sandbox`, `contextIsolation`, CSP `default-src 'self'` e
    toda requisição http(s) cancelada (NFR-004). Ela mostra:
    - no topo, a contagem de mudanças da última rodada por tipo e quantos números do lote ainda não passaram na trava
      (FR-024b);
    - os cartões divididos por sistema, cada um com o nome, o sistema, a imagem em carga preguiçosa, "Aprova",
      "Corrigir + nota" e o campo de nota.
  - **Teclado e leitor de tela:** botões e campo nativos, com rótulo, alcançáveis pelo teclado (FR-024).
  - **A resposta:** vai pelo IPC da ferramenta, que confere três coisas antes de gravar:
    - o veredito é `approved` ou `fix`;
    - a nota tem até 2.000 caracteres;
    - a nota não traz nenhum nome de personagem do retrato.
  - **Onde a resposta fica:** o arquivo de revisão, `<id>.review.json`, ao lado da receita
    ([contracts/review.md](contracts/review.md)), com o hash da receita aprovada.
  - **Aprovação vencida:** uma receita que muda depois da aprovação perde a aprovação, e a árvore volta à galeria
    (FR-025).
  - **Portão no CI:** um teste confere os arquivos de revisão. A partir da Fase 7, ele exige, para cada uma das 289,
    trava aprovada e aprovação do Vinicius sobre o hash atual da receita (FR-011, FR-029). Antes disso, só confere a
    forma dos arquivos.
- **Justificativa:**
  - A FR-023 pede a imagem igual à que o jogador vê, e só o componente de verdade, com o CSS de verdade, garante isso.
  - O Electron e o vite já são dependências.
  - Uma página estática não grava arquivo sem rede nem servidor, e a ferramenta grava direto ao lado da receita, como
    pede a FR-024c.
  - As imagens nunca saem do PC, pela NFR-004.
- **Alternativas:**
  - **HTML estático com `renderToStaticMarkup` e um botão de exportar as respostas:** descartada. Cada resposta exigiria
    um passo de importação, e uma árvore aberta inteira em HTML deixaria a galeria do W6 (61 árvores) acima dos 5 s.
  - **Um modo galeria dentro do app:** descartada. Levaria código de desenvolvimento ao instalador do jogador.
  - **Playwright:** descartada. Seria dependência nova, que baixa navegador pela rede.

### R15. Ordem dos lotes e o piloto do Drop Rate

- **Decisão:**
  - **O piloto:** o Drop Rate (`stats-drop-rate`, do lote Personagem) é o piloto do motor, como o Vinicius pediu. Ele
    passa por gabarito, trava, montagem, imagem e galeria antes do W1, numa galeria piloto só com ele.
  - **A aprovação do piloto:** a aprovação feita no piloto vale enquanto o hash da receita não mudar. No lote
    Personagem, o cartão dele aparece já aprovado.
  - **Os lotes:** depois do piloto, os lotes seguem a FR-024a: W1 (22), W2 (31), W3 (29), W4 (22), W5 (37), W6 (61),
    W7 (48), Personagem (32) e Conta (7).
  - **O ciclo de cada lote:**
    1. rascunho;
    2. agentes escrevendo as receitas em paralelo;
    3. uma rodada da trava, num processo só;
    4. correções;
    5. nova rodada;
    6. galeria;
    7. aprovações e correções;
    8. commit de dados do lote, só com as receitas e as revisões, com o teste de forma.
- **Justificativa:**
  - O motor precisa de um número de verdade antes de valer para 289.
  - O Drop Rate é o maior conhecido, com 72 fontes e 4 constantes, e já tem receita do protótipo.
  - A ordem dos lotes está na spec.
- **Alternativas:**
  - **Começar pelo W1, sem piloto:** descartada. O motor seria desenhado sobre os números mais simples.
  - **Um lote por sistema:** descartada pela spec.

### R16. O alerta estruturado de fechamento

- **Decisão:**
  - **O que é:** a trava no modo `runtime` devolve uma lista de alertas. Cada alerta tem:
    - o nível: o id do nó da receita, ou `root`, ou `pool:<n>`;
    - o tipo: `notClosing`, `missingInGame`, `extraInGame` ou `poolOrder`;
    - a diferença: relativa, num `notClosing`; numa fonte, a referência dela.
  - **Como chega ao main:** o worker manda a lista no `treeResult`, no campo `alerts`, que toma o lugar do `log:
    "chainOpen"` ([contracts/tree-worker.md](contracts/tree-worker.md)).
  - **O que o main faz:** `tree-host.ts` confere a forma: até 50 alertas, o nível com o tamanho máximo de um id de nó, a
    diferença um número finito. Depois grava cada alerta no log estruturado, como
    `{ event: "treeNotClosing", id, level, kind, diff }`.
  - **A árvore não muda:** cada linha mostra o valor do jogo, e a árvore não ganha linha nova (FR-015, FR-019).
  - **Nas checagens:** a conferência real escreve os mesmos alertas em `TREES_OUT/alerts.json` (SC-006).
  - **O que nunca entra:** nome de personagem e código do jogo.
- **Justificativa:**
  - A FR-019 pede o alerta com rótulo, id, nível e diferença, no registro e nas checagens.
  - A constituição pede log com rótulo e id.
  - O `FormulaLog` já existe; ele ganha só um caso.
- **Alternativas:** uma faixa para o jogador. Descartada: a spec quer o alerta fora da tela.

### R17. Saída da pasta `src/calculator/tree/`, aos poucos

- **Decisão:**
  - **Fase 1 (sem mudar comportamento):**
    - antes de mover, testes de caracterização fixam a saída das peças que ficam, sobre a gravação do jogo inventado:
      `makeSteps`, os nomes lidos das tabelas e a classe dos talentos;
    - depois, as peças que ficam se mudam com o comportamento intacto: `tree/steps.ts`, `tree/ast.ts` e `tree/math.ts`
      para `src/calculator/recorded/`; `tree/names*.ts`, `tree/table-names.ts` e `tree/name-text.ts` para
      `src/calculator/names/`; a tabela de sistemas para `systems.json`;
    - a árvore antiga segue no ar.
  - **Durante a feature:** uma regra do dependency-cruiser, `declared-not-guessed`, proíbe `src/calculator/declared/`
    de importar `src/calculator/tree/` e `tree-build.ts`. O motor novo não cresce em cima da forma adivinhada.
  - **Fase 7 (a troca):** o `tree-engine.ts` passa a usar `declared/`. Com a troca verde, um commit próprio apaga
    `tree-build.ts`, o que sobrou de `tree/`, `tree-roots.ts`, `root-calls.json`, `parity*.ts` e a receita
    `just parity`, cada teste junto com o código que ele testa. A lista de testes apagados fica na descrição do PR.
  - **Portão:** a receita `just parity`, as receitas novas do `justfile` e as regras do `.dependency-cruiser.cjs` mudam
    o portão de pronto, e cada uma pede o sim do Vinicius antes (AGENTS.md).
- **Justificativa:**
  - O relatório da 009 ensina a caracterizar antes de mover.
  - Apagar só depois da troca verde deixa a 0.9 funcionando em cada release do meio.
  - Apagar um teste junto com o código dele não enfraquece a suíte, porque o código testado deixa de existir.
- **Alternativas:**
  - **Apagar `tree/` no começo:** descartada. O app ficaria sem árvore até a Fase 7, e cada release do meio quebraria.
  - **Manter `tree/` como plano B:** descartada pela FR-027.

### R18. O catálogo de árvores do app passa a ser os 289

- **Decisão:**
  - **O arquivo:** o `src/shared/number-catalog.json` passa a ter os 289 números de destino `arvore`, com os ids do
    catálogo validado (`stats-drop-rate`).
  - **O gerador:** `scripts/catalog/number-catalog.ts` (Node 24 com tipos removidos, como o `scripts/reading-inventory.ts`)
    gera o arquivo a partir de `docs/catalogo/numeros.json` e de `scripts/catalog/app-fields.json`.
  - **O que o `app-fields.json` dá a cada id:** o que o catálogo validado não tem e o app precisa: o sistema em inglês
    para a aba, a tela (`screen`), o `notShown` e o `live`.
  - **De onde vem o `app-fields.json`:** é semeado uma vez, casando cada número com o catálogo de hoje pela chamada da
    raiz. O que não casar é escrito à mão, e o `live` é conferido pela sonda das raízes.
  - **Os grupos da aba Fórmulas:** seguem a FR-038 da 008: Character, Account e depois W1 a W7.
  - **Quando entra:** junto com a troca da Fase 7. Antes dela, o catálogo de 716 e a árvore antiga continuam no app.
- **Justificativa:**
  - A FR-001 e a FR-029 limitam as árvores aos 289.
  - O app precisa do sistema, da tela e do `live` para os painéis e para o "Needs the live map", e esses campos não
    estão no catálogo validado.
- **Alternativas:**
  - **Manter os 716 e abrir árvore só onde há receita:** descartada pela FR-029.
  - **Editar o JSON à mão:** descartada pela regra "não editar arquivo gerado".

### R19. O que fica igual e o que sai: Onde isto entra, faixa de versão e radar

- **Decisão:**
  - **Onde isto entra:** continua lendo as formas pelo pedido `shape`, que agora caminha a árvore declarada. O
    `tree-shapes.json` recomeça vazio na versão 2 (R12).
  - **A faixa de versão:** continua. O que muda é a fonte do "conferido nesta versão": a receita conferida pela trava
    num hash do jogo (`lock.gameSha` do arquivo de revisão) e o worker comparando esse hash com o do `N.js` aberto.
  - **O radar de patch da 008 sai** (decisão do Vinicius durante o plano, registrada na spec: Out of Scope e Open
    Questions). Com a forma declarada, ele só acenderia quando uma receita muda, nunca numa atualização do jogo; quem
    avisa de uma conta que mudou passa a ser o alerta de fechamento (R16, FR-019). A saída é a tarefa T142.
- **Justificativa:** Onde isto entra e a faixa de versão continuam úteis com a forma declarada; o radar ficaria morto.
- **Alternativas:** um radar de fontes novas (fonte do gabarito que a receita não tem, mesmo valendo 0). Descartada pelo
  Vinicius: o alerta de fechamento cobre o que muda o valor.

## Candidatas a ADR

Decisões difíceis de reverter, que surpreendem quem chega sem contexto e que vêm de uma troca real. Nenhuma ADR é
escrita no plano; cada uma vai ao Vinicius na Fase 7, com o resto da documentação.

1. **A forma da árvore é declarada por receita, e o app nunca deduz forma** (R8, R11).
   - **A troca:** a forma deduzida da gravação, com centenas de regras locais, contra a forma declarada por número,
     escrita uma vez e conferida.
   - **Por que é difícil reverter:** apaga a pasta `tree/` inteira (cerca de 36 mil linhas).
   - **Por que surpreende:** o app passa a ter 289 receitas de dado dentro da calculadora.
2. **A conta só existe na gravação, e a trava a remonta na hora sem guardar** (R2, R10, R14).
   - **A troca:** conferir a forma no CI contra não ter código do jogo no Git.
   - **A consequência:** a conferência dos valores só roda no PC do Vinicius, e o CI confere só os arquivos de revisão
     (hash da receita e resultado da trava).
   - **Por que surpreende:** o CI verde não prova que uma árvore fecha.
3. **As chaves das peças seguem as receitas, e os dados salvos das árvores antigas são apagados** (R12).
   - **Por que é difícil reverter:** apaga dados do jogador e passa os três arquivos à versão 2.
   - **Por que surpreende:** um jogador perde Pins e marcas numa atualização.
4. **O catálogo de árvores encolhe de 716 para os 289 do catálogo validado** (R18).
   - **Por que é difícil reverter:** 427 números saem da aba Fórmulas e dos painéis.
   - **Por que surpreende:** um número que abria na 0.9 deixa de abrir.

## Medidas a tomar durante a implementação

| Medida | Onde | Meta |
| --- | --- | --- |
| Formas das 289 raízes (corrente, expressão, fora da regra) | sonda da Fase 2 | 0 fora da regra, ou cada caso levado ao Vinicius |
| Tempo da árvore do Drop Rate no app (gravação, gabarito, trava, montagem) | Fase 3 e Fase 7, no jogo real | até 5 s (NFR-001) |
| Stats com a árvore aberta | Fase 7 | abaixo de 1 s (NFR-001) |
| Tempo e memória da rodada das 289 num processo | primeira rodada `all` | sem estourar a memória; tempo anotado no relatório |
| Abertura da galeria do maior lote (W6, 61 árvores) | Fase 6 | até 5 s (FR-024) |
| Partes fechadas pelo valor gravado (R6) | cada rodada da trava | número anotado e decrescente |
