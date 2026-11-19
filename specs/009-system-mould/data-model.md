# Data Model: Molde por sistema nas árvores de fórmula

Muda o nó da árvore da 008 (`TreeNode`, `src/shared/formula-tree.ts`; `CalcTreeNode`, `src/calculator/tree-contract.ts`). Nenhum arquivo salvo muda de forma.

## TreeNode: campos novos e valores novos

| Campo | Tipo | Regra |
| --- | --- | --- |
| `role` | ganha `"pool"` e `"system"` | `pool`: uma etapa da conta do jogo (FR-005). `system`: um grupo de sistema dentro de um pool (FR-002) |
| `combine` | `"sum"` \| `"product"` \| `"onePlusPercent"` \| `"max"` \| `"min"` \| `"percent"`, opcional | Só em `pool` e `system`: como as linhas de dentro dão o valor do nó. A janela usa isso para refazer o valor ao vivo e o da marca (research R5). Nas outras linhas o campo não aparece, nem como null (decisão de 17/11). `max`/`min`: só nos grupos de uma raiz com `max`/`min` no topo, sem pool (decisão de 17/11). `percent`: a soma das linhas ÷ 100, para os bônus em % que o jogo soma e divide por 100 antes de entrar num pool (FR-017, decisão de 17/11) |
| `poolKind` | `"additive"` \| `"multi"` \| null, opcional | Só em `pool` e `system` (`system` leva null): diz se a etapa soma os bônus antes (`additive`) ou multiplica tudo (`multi`) |
| `emoji` | não existe | O emoji é parte do `name` do grupo ("⚗️ Alchemy"); nenhum campo novo |

Regras:
- **Primeiro nível:** os nós `pool`, na ordem da conta (FR-005).
- **Dentro de um `pool`:** os nós `system`, na ordem da FR-004.
- **Dentro de um `system`:** as fontes, com "Small", "At 0" e "At ×1" da 008 (FR-014 da 008).
- **Chave de peça:** `pool` e `system` têm `pieceKey: null` (research R8).
- **Ids:** `pool` e `system` seguem o caminho de nomes da 008, como em `raiz/Additive pool/⚗️ Alchemy`.
- **Fonte única:** um `system` com uma única fonte de mesmo valor não é emitido; a fonte fica direto no pool (FR-006).
- **Tudo em "Other":** quando todas as fontes de um pool caem em "Other", ele não leva o grupo "Other"; as fontes ficam direto (FR-001).
- **Passo achatado:** uma linha sem código e sem nome provado não existe mais no nível. As partes dela estão no nível de cima, e o `formula` do nó de cima traz a conta inteira (FR-007).
- **Fonte sem cálculo:** um `system` com uma fonte de valor null tem `value: null` e `flags.unavailable: true` (FR-013).

## Regra de sistema

| Campo | Regra |
| --- | --- |
| bloco | O bloco do jogo que a fonte chama, ou o bloco que escreve o cache que ela lê |
| sistema | O nome do sistema, com o emoji, da lista da V1 ou novo |
| prova | Uma referência ao jogo ou à bancada, sem código citado (CHK018 da 008) |

Uma fonte sem regra vai para "🔹 Other". A tabela fica no worker, ao lado do `tagOf`.

## Estado da janela (não sai da máquina)

| Estado | Onde | Valor inicial |
| --- | --- | --- |
| Changes ligado e a base (`"live"` ou o nome de uma marca) | `settings.json` (research R6) | desligado |
| Base "live" | Memória da janela: os valores por peça no momento em que o botão foi ligado | — |
| Fatia ligada | `settings.json` | desligada |
