# Contrato: elo guardião ↔ app (mudança)

Uma mensagem nova, guardião → app. O resto do contrato continua como em `ARCHITECTURE.md`.

| Mensagem | Direção | Conteúdo |
| --- | --- | --- |
| `{ "type": "tables", "tables": GameTables }` | guardião → app | nomes de mapas e monstros do jogo instalado |

- O guardião publica uma vez por abertura do jogo, depois de `startApp()`. Sem texto do jogo, publica `maps: null` e
  `monsters: null`.
- Cliente novo recebe, nesta ordem: as últimas tabelas, o último status e a última leitura.
- O app confere a forma com `linkTables`: `maps` é `null` ou lista de textos, e `monsters` é `null` ou objeto de textos.
  Forma errada conta como não lida (`null`), nunca derruba o app.
- Ao receber `tables`, o app refaz o contexto com a última leitura.

## `keeper.log`

| Rótulo | Quando | Dados |
| --- | --- | --- |
| `unknown-screen-numbers` | o código tem números de `MenuType2` fora de `KNOWN_WINDOWS` | `numbers`: lista de números |
| `game-tables-unreadable` | uma das tabelas não pôde ser lida | `maps`, `monsters`: booleanos |
| `game-scan-failed` | a verificação lançou um erro | `error` |

Só números e booleanos: nada do arquivo do jogo e nenhum nome de jogador. Nada disso aparece para o jogador (FR-017).
