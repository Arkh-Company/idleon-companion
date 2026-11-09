# Contrato: worker do cálculo

Entrada própria no build, criada pelo processo principal do app. Sem `env`, sem `stdin`, com `resourceLimits`.

| Direção | Mensagem | Conteúdo |
| --- | --- | --- |
| app → worker | `init` | bytes do `N.js` e do `default.pak` (transferidos) |
| worker → app | `ready` ou `failed` | o motor inicializou ou não |
| app → worker | `calc` | um mosaico completo, com `vars` e bônus |
| worker → app | `result` | `CalcResult` |

## Regras

- O código do jogo roda num contexto `node:vm` com `codeGeneration: { strings: false, wasm: false }`.
- Nenhum objeto do Node ou do host entra no contexto: stubs são criados dentro dele.
- `XMLHttpRequest`, `fetch`, `WebSocket` e `sendBeacon` são stubs que lançam erro; a ponte do Firebase responde vazia.
- O estado é restaurado antes de cada número; depois da inicialização dos ajudantes, os valores simples e os bônus são reaplicados.
- `CloudSAVE` e `SaveGamee` viram funções vazias e nunca rodam.
- Limites: 2 s por número, 15 s por conjunto, 60 s para inicializar. Passou: `terminate()` e `unavailable`.
- Um número que falha sozinho volta como `null`.
