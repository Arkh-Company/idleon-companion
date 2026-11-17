# Contract: preferências de vista da árvore (IPC)

Um canal novo, validado em `payloads.ts` como os da 008 (`specs/008-formula-trees/contracts/ipc.md`). Os outros canais não mudam.

| Canal | Direção | Payload | Resposta | Regra |
| --- | --- | --- | --- | --- |
| `view:get` | janela → main | `{}` | `{ changes: boolean, share: boolean }` | O que está em `settings.json`. Falta ou arquivo ruim: os dois `false` |
| `view:set` | janela → main | `{ changes: boolean, share: boolean }` | `null` | Só essas duas chaves, só booleanos. Grava em `settings.json` como o zoom da 0.7 (escrita inteira, `.tmp` + rename) |

A base da comparação ("live" ou uma marca) não é salva: ao abrir, o botão "Changes" ligado começa em "live" (research R6).
