# O vitest sai com 1 sem nenhum teste falhando

## Sintoma

O `just test` ou o `just check` termina com exit code 1, e nenhum teste aparece vermelho. No fim da saída, o vitest diz `Worker exited unexpectedly with exit code 3221225477`. Às vezes um arquivo inteiro de teste não roda, e cada vez é um arquivo diferente (já foram `FormulasTab.test.tsx`, `FarmStrip.test.tsx` e `read-only.test.ts`). Rodar de novo, sem mudar nada, passa.

## Causa

O código 3221225477 é o 0xC0000005 do Windows: uma violação de acesso à memória dentro do próprio Node, num worker do vitest, quase sempre ao iniciar, antes do primeiro teste. Não é um teste nem o código do app: o arquivo muda a cada vez, e a queda aparece nos relatórios desde a feature 003, com código que nem toca o arquivo que caiu. É a mesma família das telas azuis que este PC dá quando muitos processos do vitest fecham juntos (0x153 com forks, 0x162 com threads). Até 19/11/2026, ela só foi vista neste PC, nunca no CI.

Não confunda com um teste que falha só na suíte inteira. Esse aparece vermelho, com o nome do teste. Foi o caso do `App.test.tsx` "a done progress switches to the 001 window", que corrigimos em 19/11: ele mandava o progresso antes de a tela de setup se inscrever.

## O que fazer

1. Confira na saída que nenhum teste ficou vermelho e que a linha diz `exit code 3221225477`. Se houver um teste vermelho, este runbook não é o caso: investigue o teste.
2. Rode o `just check` de novo, uma vez só. Nunca rode em laço nem em paralelo: muitos processos do vitest fechando juntos dão tela azul neste PC.
3. Se cair duas vezes seguidas, registre a data, o arquivo e a versão do Node (`node --version`) no relatório e pare. Para reduzir os workers (`--maxWorkers` no `justfile`) ou trocar a versão do Node (`mise.toml`), é preciso mexer no critério de pronto, e isso pede o sim do Vinicius.
