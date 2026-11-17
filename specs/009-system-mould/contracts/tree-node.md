# Contract: o nó da árvore com pools e grupos de sistema

Muda o contrato `specs/008-formula-trees/contracts/tree-worker.md`, mensagem `treeResult`. O resto daquele contrato continua valendo.

## O que o worker manda

O mesmo `CalcTreeNode` da 008, com estes campos a mais (`data-model.md`):

- `role`: além dos papéis da 008, aceita `"pool"` e `"system"`.
- `combine`: `"sum"`, `"product"` ou `"onePlusPercent"` em `pool` e `system`; null nas outras linhas.
- `poolKind`: `"additive"` ou `"multi"` em `pool`; null nas outras linhas.

O primeiro nível de uma árvore de número é a lista de `pool` (FR-005). O nó `expand` de um pool ou grupo ainda fechado segue a regra de expand da 008: o worker manda o nível guardado.

## A conferência do main (`tree-check.ts`, FR-010b da 008)

- Aceita os papéis novos e os campos novos com estes valores, e nenhum outro.
- O nome de um `pool` passa pelo mesmo crivo de texto dos outros nomes.
- O nome de um `system` passa pelo mesmo crivo, com o emoji no começo.
- `pieceKey` de `pool` e `system` MUST ser null. Um pool ou grupo com peça é recusado, porque não pode entrar em pin, marca nem radar.

## Exemplo (valores ilustrativos)

```json
{
  "id": "forgeStats_2",
  "name": "Forge stats 2",
  "value": 12160,
  "formula": [["Additive pool", "×", "Multi pool"], [760, 16, 12160]],
  "kids": [
    {
      "id": "forgeStats_2/Additive pool",
      "role": "pool", "poolKind": "additive", "combine": "sum",
      "name": "Additive pool", "value": 760, "pieceKey": null,
      "kids": "lazy"
    },
    {
      "id": "forgeStats_2/Multi pool",
      "role": "pool", "poolKind": "multi", "combine": "product",
      "name": "Multi pool", "value": 16, "pieceKey": null,
      "kids": "lazy"
    }
  ]
}
```
