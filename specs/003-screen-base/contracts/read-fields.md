# Contrato: campos que `read.js` lê

Tudo só por propriedade: nenhuma função do jogo é chamada e nada é gravado. `src/keeper/read-only.test.ts` passa a cobrir
os campos novos com um motor em que toda função lança erro quando chamada.

## Globais (`gameAttributes.h`, salvo indicação)

| Campo da leitura | Origem | Valor ausente |
| --- | --- | --- |
| `scene` | `engine.scene.name` | `null` |
| `attack` | `AttackSelected` | `null` |
| `bag` | `InventorySelected` | `null` |
| `ol1`, `ol3`, `ol18`, `ol19` | `OptionsList[n]` | `null` |
| `ola489` | `OptionsListAccount[489]` | `null` |
| `nd37` | `NONdummies[37]` | `null` |
| `hole` | `Holes[0][i]`, com `i` = posição de `UserInfo[0]` em `GetPlayersUsernames` | `null` |

`GetPlayersUsernames` é usado só para achar `i`: nenhum nome sai na leitura.

## Comportamentos (`behaviors`)

Caminho: `PixelHelperActor[n].behaviors.cache.h["ActorEvents_<ator>"].script.<campo>`. A chave é `H<n>.<campo>[<índice>]`,
ou `H<n>.<campo>` para campo simples. Só entram valores número, texto ou booleano; o resto vira `null`.

| n | Ator | Campo | Índices |
| --- | --- | --- | --- |
| 0 | 29 | `_MenuType2TabPage` | simples |
| 0 | 29 | `_AnvilTabSelected` | simples |
| 0 | 29 | `_TabIndex0to5` | simples |
| 1 | 116 | `_GeneralINFO` | 17, 36 |
| 2 | 167 | `_GeneralInfo` | 0 |
| 3 | 201 | `_GenINFO` | 8, 15, 68, 81 |
| 4 | 229 | `_GenInfo` | 0, 23 |
| 5 | 232 | `_GenINFO` | 1, 17, 72 |
| 6 | 312 | `_GenINFO` | 2, 42, 61, 76, 109, 111, 117 |
| 7 | 340 | `_GenINFO` | 35, 38, 75 |
| 8 | 481 | `_GenINFO` | 3, 5, 43, 45, 57 |
| 21 | 510 | `_GenINFO` | 16, 51, 59 |
| 22 | 548 | `_GenINFO` | 8, 54, 62, 82 |
| 23 | 577 | `_GenINFO` | 18, 70, 76 |
| 24 | 623 | `_GenINFO` | 5, 9, 57, 146 |
| 25 | 670 | `_GenINFO` | 42, 213 |
| 26 | 713 | `_GenINFO` | 49, 124 |
| 27 | 741 | `_GenINFO` | 0, 19, 116, 142, 212 |

O nome do campo muda por comportamento (`_GenINFO`, `_GenInfo` ou `_GeneralINFO`) e é o desta tabela. Um comportamento que
ainda não existe, como na seleção de personagem, não gera chave nem erro.

Fora do leitor: `_NPCtalkingTo`, `ARC.*`, as sondas de diálogo, `OptionsList[9]` e `PixelHelperActor[18]`.
