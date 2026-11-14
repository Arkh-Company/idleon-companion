# Contrato: host ↔ worker de árvores

O worker de árvores é uma segunda instância do `calculator.js` (research R1). O contrato da 005 (`specs/005-reading-catalog/contracts/calculator.md`) continua valendo para o worker da Stats e não é editado aqui; este arquivo cita só as mensagens novas.

## Início

| Direção | Mensagem | Regra |
| --- | --- | --- |
| host → worker | `{ type: "init", mode: "tree", code, pak }` | Os bytes do `N.js` e do `default.pak`, lidos de novo pelo host de árvores (`readGameFiles`), porque os do worker da Stats foram transferidos. Um `init` sem `mode` responde como hoje |
| worker → host | `{ type: "ready" }` ou `{ type: "failed" }` | A instrumentação (acorn) roda sobre o `N.js` original, depois da troca da âncora e do `lazyDnsmKeys`; o resultado só existe em memória (FR-011) |

## Pedidos

| Direção | Mensagem | Regra |
| --- | --- | --- |
| host → worker | `{ type: "tree", id, request: { type: "number", id, character }, mosaic }` | O mosaico em texto JSON, o mesmo par mosaico × resultado que a Stats usou para o ativo (paridade, FR-019) |
| host → worker | `{ type: "tree", id, request: { type: "expand", treeId, nodeId } }` | Monta um ramo sobre a gravação guardada; não refaz o estado |
| host → worker | `{ type: "values", id, ids: string[], mosaic }` | O "ao vivo do que está à vista": só calcula os números, sem gravar (research R4) |
| worker → host | `{ type: "treeResult", id, tree }`, `{ …, refused: "unknownNumber" }` ou `{ …, failed: true }` | Só átomos (FR-010). A gravação crua nunca sai; ela é serializada dentro do contexto e lida com `JSON.parse` no worker |
| worker → host | `{ type: "valuesResult", id, values: { [id]: number \| null } }` | Um número por id; nulo = `unavailable` |

Durante a implementação: o `formula` de um nó é `[termos, números]`. Os termos são a linha com nomes partida em nomes, números do código e operadores; um nome ou caminho de filho fica inteiro, mesmo com parênteses. Os operadores são os sinais (`× ÷ + − - * / ^ :`), os parênteses, a vírgula e os nomes de conta (`min`, `max`, `pow`, `floor`, `ceil`, `round`, `abs`, `sqrt`, `log`, `log10`, `log₁₀`). Os números são todos os da linha com números, em ordem, sem a vírgula de milhar, com o resultado por último. Cada termo que não é operador leva o próximo número.

Durante a implementação: o host guarda o último pedido `number` (com o mosaico) e o reenvia, com a resposta descartada, a um worker novo antes de um `expand`; assim um ramo abre depois de uma falha ou do jogo fechado.

## Limites e vida

| Item | Valor |
| --- | --- |
| Heap do worker | 2 GB (`resourceLimits.maxOldGenerationSizeMb`) |
| Prazo de um pedido de árvore | Medido na fase 2 sobre o `calculator.js` compilado (o protótipo deu 12,3 s a frio na bancada; a meta é 5 s com o contexto quente) |
| Vida | Até o jogo fechar ou um `gameFiles` novo. A troca de personagem e o leitor solto só descartam o pedido e a árvore guardada |
| Falha | Prazo estourado ou falha nativa: aquele pedido fica `unavailable`, uma nova tentativa sobe outro worker, e a Stats não é tocada (FR-017) |
| Em voo | Um pedido por vez; um novo substitui o que esperava |

## O que o host confere antes de passar à janela (FR-010b)

- A forma: os campos do `TreeNode`, com os tipos certos.
- O tamanho: teto de nós por resposta.
- Os textos: só nomes de parte e textos de tabelas do jogo, nunca trecho de código.

O que falhar vira `unavailable`, e o caso vai para o log estruturado sem valores nem nomes.
