# Contrato: linha de comando do executável

`IdleOn Companion.exe` (empacotado) ou `electron.exe "<repo>"` (desenvolvimento). `src/start/index.ts` decide pelo
primeiro argumento reconhecido:

| Argumentos | Papel | Saída |
| --- | --- | --- |
| `--keeper <exe do jogo> [args do jogo...]` | Guardião (sem janela, segura o canal, lê). Tudo depois de `--keeper` é a linha de comando da Steam, repassada ao jogo sem mudança | Termina depois do jogo |
| `--remove-from-steam` | Modo do desinstalador: tira a parte do companion de todas as contas configuradas, fechando e reabrindo a Steam; sem janela, sem trava de instância única | `0` feito ou nada a fazer · `2` jogo aberto · `3` a Steam não fechou · `4` arquivo da Steam ilegível |
| `--from-steam` | App aberto pelo guardião (a 001) | — |
| nenhum | App | — |

## Opção de inicialização gravada na Steam

- Empacotado: `"C:\Users\<user>\AppData\Local\Programs\IdleOn Companion\IdleOn Companion.exe" --keeper %command%`
  (mais o texto que o usuário já tinha, R5).
- Desenvolvimento: `"<repo>\node_modules\electron\dist\electron.exe" "<repo>" --keeper %command%`.
- Nunca um `.cmd` ou `.bat` (Task 12).
