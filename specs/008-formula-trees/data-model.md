# Data Model: árvores de fórmula e painéis por sistema (008)

O contrato mora em `src/shared/formula-tree.ts` e é re-exportado por `src/shared/index.ts`. O calculador não pode importar de `src/shared/`, por causa da regra `calculator-alone`, então ele leva uma **cópia** dos literais e dos tipos, com prefixo (`CalcTreeNode`). A cópia é fixada pelos dois lados:
- os literais por `toEqual`, como o `TARGETS` × `NUMBER_IDS` de hoje;
- a forma por um teste de tipo (`expectTypeOf`), que **primeiro prova que falha** quando um campo da cópia muda.

O tipo é recursivo; se o teste não acusar a mudança, a comparação passa a ser `Omit<…, "kids">`.

## Literais

| Nome | Valores |
| --- | --- |
| `LEAF_KINDS` | `level`, `quantity`, `fixedValue`, `rawBonus`, `condition`, `choice`, `tier`, `record`, `investedPoints`, `unknown` |
| `CONDITION_KINDS` | `owned`, `done`, `active`, `equalsValue`, `max`, `limit` |
| `NODE_ROLES` | `root`, `step`, `system`, `subsystem`, `pool`, `bucket`, `atZero`, `atOne`, `small`, `piece`, `row` |
| `LEAF_FAMILY` | `level`/`quantity`/`investedPoints`/`tier`/`record` → `grows`; `condition`/`choice` → `pick`; `fixedValue`/`rawBonus` → `set`; `unknown` → nenhuma (FR-013) |

## TreeNode (uma linha da árvore)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | texto | Único na árvore: o caminho de nomes, com `#n` nas repetições (uma parte repetida abre de novo, FR-015) |
| `pieceKey` | texto ou nulo | Bloco + JSON dos argumentos (+ índice do personagem). A mesma chave é a mesma parte em qualquer árvore (FR-009). Nulo nas linhas de molde (grupo, "At 0", "At ×1") |
| `name` | texto | Em inglês, palavras de jogador. Sem nome provado: nome genérico e `flags.unnamed` (FR-012a). Na tela pode levar nome real de personagem ou guilda (FR-010) |
| `value` | número, sim/não ou nulo | Nulo = `unavailable` |
| `was` | número, sim/não ou nulo, opcional | Valor da árvore anterior ou da marca, posto pelo diff (FR-024, FR-025) |
| `fmt` | `x`, `%`, `+` ou nulo | Formato do valor |
| `leaf` | um de `LEAF_KINDS`, ou nulo | Só nas folhas (FR-013) |
| `condition` | um de `CONDITION_KINDS`, ou nulo | Só nas folhas `condition` |
| `why` | texto ou nulo | Motivo de um `?`, frase de jogador |
| `formula` | `[nomes, números]` ou nulo | "How it adds up". Só átomos; um termo sem nome aparece como o caminho do jogo (FR-012a); 3 algarismos significativos |
| `code` | texto ou nulo | Bloco e argumentos ou caminho, só em "Game details" |
| `role` | um de `NODE_ROLES` | |
| `share` | 0..1 ou nulo | Peso no pai (Share S); nulo em condição e em `unknown` |
| `shareMode` | `sum`, `product`, `productZero`, `cap`, `capZero`, `mixed`, `condition`, `unknown` ou nulo | O modo do pai |
| `cap` | `overTheCap` ou `notReached`, opcional | Num teto: o lado que não conta agora (FR-012) |
| `maxReached` | `{ share: 0..1, max: number }`, opcional | Curva de retorno decrescente com máximo provado (FR-015a): "62% reached · max +40%" |
| `feeds` | número, opcional | Quantos números do catálogo usam esta parte; só se ≥ 2 (FR-027) |
| `flags` | objeto | `unknown`, `unnamed`, `unavailable`, `fromCache`, `fromGame`, `runtime`, `truncated`, `closed` (grupo fechado), `progress` (passo de laço, contado à parte), `gameBug` (id da regra, nunca texto livre) |
| `kids` | `TreeNode[]` ou `"lazy"` | `"lazy"` = ramo ainda não montado, que o worker monta ao abrir (research R4) |

## FormulaTree (main → janela)

| Estado | Campos |
| --- | --- |
| `none` | Nenhuma árvore aberta |
| `waiting` | "Waiting for the game": sem leitura ou sem personagem (FR-034) |
| `calculating` | O pedido |
| `unavailable` | O pedido; a falha não leva texto do jogo |
| `diverged` | O pedido e o texto da Stats: "Breakdown unavailable" (FR-019) |
| `ready` | `request`, `title`, `rootText` (escrito pelo main com o formatador da linha da Stats), `statsValue`, `character` (número), `activeCharacter`, `calculatedAt`, `gameChanged`, `checkedOnThisGame` (faixa de versão, FR-018), `stale` (jogo fechado, FR-022), `comparingWith` (nome da marca ou nulo), `counts`, `root` |

## TreeRequest (janela → main → worker)

| Tipo | Campos | Regra |
| --- | --- | --- |
| `number` | `id` (do catálogo), `character` (número; o ativo por padrão) | O main valida o `id` contra `src/shared/tree-catalog.ts` antes de mandar ao worker |
| `expand` | `treeId`, `nodeId` | Monta um ramo `"lazy"` sobre a gravação guardada do mesmo mosaico |

## Catálogo de números (`src/shared/tree-catalog.ts`)

| Campo | Regra |
| --- | --- |
| `id` | Único e estável (o slug da bancada) |
| `group` | Durante a implementação: o grupo da aba Formulas, na ordem da FR-038 (Character, Account, W1…W7, depois as skills na ordem do jogo), vindo da curadoria da bancada |
| `system` | O sistema ou a skill, dentro do grupo (segundo nível da aba Formulas) |
| `screen` | O nome da tela no catálogo de telas da 003, ou nulo (sem painel: só a aba Formulas) |
| `notShown` | `null` ou um de `cost`, `cap`, `chance`, `rate` (grupos fechados do painel, FR-004) |
| `live` | Sim quando precisa de campo de ator de mapa (FR-023) |

A chamada do jogo de cada id **não** fica aqui. Ela fica no calculador, em `tree-roots.ts`, fixada contra este catálogo por teste. Entram só as árvores `ok` do BASELINE-4 (research R7).

## Marca (`marks.json`)

`{ version, characters: { [index]: [{ name, takenAt, values: { [pieceKey]: number | boolean } }] } }`, até 3 por personagem (FR-025, FR-037). O personagem é o número, nunca o nome.

## Número fixado (`pins.json`)

`{ version, pins: [{ treeId, nodeId | null }] }`, até 5, sem valores (FR-036).

## Forma de árvore (`tree-shapes.json`)

`{ version, gameSha, trees: { [catalogId]: [pieceKey, name][] } }`: a forma da última versão do jogo vista, sem valores (FR-029). Um `gameSha` novo compara as formas e acende a faixa do radar (FR-035).

## Medição de farm (só memória)

| Estado | Entra quando | Sai para |
| --- | --- | --- |
| `idle` | Início, troca de personagem | `counting` ao entrar num mapa que não é cidade |
| `counting(map)` | Mapa que não é cidade | `paused(map)` na cidade; `counting(outro)` em outro mapa que não é cidade (recomeça) |
| `paused(map)` | Cidade | `counting(map)` ao voltar ao mesmo mapa (continua); `counting(outro)` em outro mapa (recomeça) |
| (qualquer) | Jogo fechado, app reiniciado | `idle` (não guarda nada) |

As taxas guardam o início, o tempo contado e os totais de XP, gold e itens desde a entrada no mapa (FR-028).

## Transições do painel e do painel lateral

- **Painel do sistema:** troca sempre que a tela de um sistema com painel abre. Ao sair para uma tela sem painel, fica no último (FR-003, FR-033). A troca não move o foco (FR-039) e é anunciada uma vez (FR-040).
- **Painel lateral:** fechado → aberto (a janela vai a 840 px) → outra árvore (troca o conteúdo) → fechado pelo ✕ (a janela volta a 420 px, e o foco volta ao número que o abriu). A tela do jogo nunca muda o painel lateral (FR-005).
