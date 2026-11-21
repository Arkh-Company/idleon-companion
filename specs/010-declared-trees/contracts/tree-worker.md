# Contrato: worker de árvores com a forma declarada

Muda `specs/008-formula-trees/contracts/tree-worker.md` e o `log` de `specs/009-system-mould/contracts/tree-node.md`, os
dois congelados. O que não está aqui continua como lá: início, limites, vida, `values`, conferência do main.

## Pedidos

| Direção | Mensagem | O que muda |
| --- | --- | --- |
| host → worker | `{ type: "tree", id, request: { type: "number", id, character }, mosaic }` | O `id` é um id do catálogo de 289. O worker grava como hoje, extrai o gabarito, roda a trava no modo `runtime` e monta a árvore inteira pela receita. Sem receita válida para o id: `refused: "unknownNumber"` (FR-029) |
| host → worker | `{ type: "tree", id, request: { type: "expand", treeId, nodeId } }` | Devolve o nível guardado da árvore montada; não grava de novo |
| host → worker | `{ type: "shape", id, treeId, mosaic }` | As partes `[pieceKey, nome]` da árvore declarada inteira, com as fontes de outras classes de fora |
| worker → host | `{ type: "treeResult", id, tree, alerts? }` | `alerts` toma o lugar de `log: "chainOpen"` (abaixo) |

## A árvore que sai

O mesmo `CalcTreeNode` da 009, sem campo novo:

- **Raiz:** `role: "root"`, `formula` com os pools juntados (FR-016), `pieceKey` da chamada raiz.
- **Primeiro nível:** os pools da receita, `role: "pool"`, `poolKind` e `combine` (`sum` ou `percent` no Additive,
  `product` no Multi), `pieceKey: null`, `kids: "lazy"` (todos começam fechados, FR-013).
- **Dentro do pool:** os grupos, `role: "system"`, nome "emoji nome" da tabela de sistemas, `combine`, `poolKind: null`,
  `pieceKey: null`.
- **Fontes e filhos:** `role: "row"`, nome da receita, `leaf` de um dos 9 tipos nas folhas (nunca `unknown`), `fmt` pelo
  pool ("+" ou "%" no que soma, "x" no que multiplica), `pieceKey` da referência resolvida (research R12), `formula`
  ("How it adds up") montado na hora da expressão gravada.
- **Ids:** `<id do número>/<índice do pool>/<id do sistema>/<chave>/<chave>…`.
- **Valores:** do gabarito (pools e termos) e da gravação (filhos). Uma fonte declarada que o jogo não usou nesta
  gravação vem com 0 no Additive e 1 no Multi, como as linhas "At 0" e "At ×1" da 008.
- **Classe:** as fontes de outras classes não saem; um grupo só sai se tiver ao menos uma fonte da classe do
  personagem (FR-002a).

## Alertas (`alerts`)

- **Quando:** só na resposta de um `number`, e só quando a trava `runtime` achou diferença.
- **Forma:** até 50 itens `{ level, kind, diff }` ([data-model.md](../data-model.md), "Alerta de fechamento").
- **No main:** `tree-host.ts` confere a forma (o `kind` da lista, o `level` até o tamanho máximo de um id de nó, o `diff`
  um número finito ou uma `refKey` até 200 caracteres sem nome de personagem). Cada alerta válido vira uma entrada do
  log, `{ event: "treeNotClosing", id, level, kind, diff }`. Um alerta fora da forma é descartado, e a árvore segue.
- **A árvore não muda:** nenhum alerta acrescenta linha nem muda um valor (FR-015, FR-019).
- **O `log: "chainOpen"` sai,** junto com o caso `chainOpen` do `FormulaLog`.

## O que não muda

O host, os limites (2 GB, 120 s para subir, 30 s por pedido), a fila de um pedido por vez, o reenvio do último `number`
antes de um `expand` num worker novo, o `values` e a conferência do main (`tree-check.ts`).
