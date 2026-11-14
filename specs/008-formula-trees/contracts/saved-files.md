# Contrato: arquivos salvos na máquina do jogador

Os três arquivos ficam na pasta de dados do app (`app.getPath("userData")`), ao lado do `settings.json`, e seguem o mesmo padrão de `src/main/settings.ts`: ler, conferir a forma, gravar inteiro. Nenhum vai para o repositório. Nenhum leva nome de personagem, da conta ou da guilda: o personagem é o seu número (FR-010a).

| Arquivo | Forma | Limites | Quem grava |
| --- | --- | --- | --- |
| `marks.json` | `{ version: 1, characters: { "<n>": [{ name, takenAt, values: { "<pieceKey>": number \| boolean } }] } }` | Até 3 marcas por personagem; nome até 40 caracteres; só valores, nunca nomes de linha | `marks:save`, `marks:clear` (FR-025, FR-037) |
| `pins.json` | `{ version: 1, pins: [{ treeId, nodeId: string \| null }] }` | Até 5; sem valores | `pins:set` (FR-036) |
| `tree-shapes.json` | `{ version: 1, gameSha, trees: { "<catalogId>": [[pieceKey, name], …] } }` | Só a última versão do jogo vista; sem valores. Durante a implementação: a `pieceKey` é guardada sem o índice do personagem, e partes com nome de personagem nunca entram | O main, depois de montar uma árvore numa versão nova (FR-029); durante a implementação, também pela varredura em segundo plano, uma árvore de cada vez. Durante a implementação: enquanto um patch está aberto, o arquivo guarda também `previous: { gameSha, trees }` (só as árvores antigas ainda não comparadas), `changed` e `dismissed`, até o jogador fechar a faixa |

## Conferência ao ler (FR-041)

- **Arquivo ilegível**, com JSON inválido, `version` desconhecida ou forma errada: é renomeado para `<nome>.bad` e deixado de lado. O item começa vazio, e a janela mostra o aviso uma vez:
  - "Saved marks could not be read and were reset";
  - "Saved pins could not be read and were reset";
  - "Saved tree shapes could not be read and were reset".
- **Valores fora dos limites** (mais de 3 marcas, mais de 5 pins, nome longo): o excedente é descartado na leitura, sem aviso.
- **Nunca cai:** um erro de leitura ou de gravação vira aviso, e o resto do app segue.
