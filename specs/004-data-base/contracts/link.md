# Contrato: elo guardião ↔ app (mudança)

Duas mensagens novas, guardião → app.

| Mensagem | Conteúdo |
| --- | --- |
| `{ "type": "gameFiles", "resources": string }` | a pasta `resources` do jogo lançado |
| `{ "type": "state", "slice": StateSlice }` | uma fatia ([data-model](../data-model.md)) |

- O app confere a forma com `linkState` e `linkGameFiles`. Forma errada é descartada, sem derrubar nada.
- Cliente novo recebe o último `gameFiles`. Fatias não são reenviadas: o mosaico se refaz em um ciclo.
- `keeper.log` não registra `state`, e `vars` vem só dentro das fatias, na lista fechada.
