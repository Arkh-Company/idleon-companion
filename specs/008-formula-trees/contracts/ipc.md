# Contrato: janela ↔ main (canais novos da 008)

Canais próprios, como o `stats:update` da 004. O contrato de módulo `module:<id>:*` da spec 001 continua reservado e sem uso. Todo canal novo entra no objeto `IPC` de `src/shared/types.ts`, que o `types.test.ts` fixa inteiro. Cada pedido da janela é validado por uma função de `src/main/payloads.ts` antes de chegar a qualquer worker.

| Canal | Direção | Conteúdo | Validação |
| --- | --- | --- | --- |
| `formula:request` | janela → main (`invoke`) | `{ id, character? }` ou `{ treeId, nodeId }` (expand) | O `id` existe no catálogo; `character` é um número de personagem lido; responde na hora com `void`, ou rejeita com `formula:request: invalid request` |
| `formula:update` | main → janela | `FormulaTree` ([data-model.md](../data-model.md)) | Replay da última no preload, como o `stats:update`; `{ state: "none" }` na troca de personagem ativo e num `gameFiles` novo |
| `formula:close` | janela → main | — | Solta a árvore guardada e o replay |
| `formula:values` | janela → main | `{ ids: string[] }`: o que está à vista agora (painel, grupo); durante a implementação: os pins o main mantém à vista sozinho | Ids do catálogo, até um teto por pedido |
| `formula:liveValues` | main → janela | `{ values: { [id]: number \| null }, calculatedAt, stale }` | Replay da última |
| `panel:update` | main → janela | `{ system: string \| null }`: o sistema cuja tela está aberta, para a troca automática | Vem do contexto da tela (003); a janela troca de aba e anuncia (FR-040) |
| `marks:list` / `marks:save` / `marks:clear` | janela → main | Por número de personagem: listar; salvar `{ name }` (a marca leva os valores da árvore aberta); apagar por nome. Durante a implementação: `marks:list` devolve `{ marks, warning }`; `marks:save` e `marks:clear` devolvem `null` ou a frase para o jogador | Nome até 40 caracteres; até 3 por personagem (FR-037); nome repetido recusado |
| `pins:get` / `pins:set` | janela → main | A lista de números fixados. Durante a implementação: `pins:get` devolve `{ pins, warning }`; `pins:set` devolve `null` ou a frase para o jogador | Até 5 (FR-036) |
| `feeds:list` | janela → main | Durante a implementação: `{ pieceKey }` → os ids do catálogo que essa peça alimenta (FR-027) | O main valida a chave; a resposta só tem ids do catálogo |
| `farm:update` | main → janela | `{ state: "idle" \| "counting" \| "paused", minutes, xpPerHour, goldPerHour, items: [{ name, perHour }] }` | Só do personagem ativo (FR-028) |
| `radar:update` | main → janela | `{ changed: [{ catalogId, added, removed, renamed }] }` ou `null`; durante a implementação: `{ changed, checking, warning }`, com `checking` verdadeiro enquanto a varredura ainda compara, e o aviso de `tree-shapes.json` ilegível (FR-041) | Depois de um `gameSha` novo (FR-035) |
| `radar:dismiss` | janela → main | — | Fecha a faixa até o próximo patch; durante a implementação: uma mudança nova do mesmo patch reacende a faixa |
| `window:sidePanel` | janela → main | `{ open: boolean }` | Alarga ou volta a janela (FR-005), para o lado com espaço |
