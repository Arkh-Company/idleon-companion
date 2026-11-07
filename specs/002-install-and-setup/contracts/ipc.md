# Contrato: IPC janela ↔ app (mudanças da 002)

As regras da 001 valem para todos os canais novos (FR-030): canais fixos, `guardIpc` (só a página da própria janela),
formato conferido em `src/main/payloads.ts`; a janela fala só por `window.companion`.

| Canal | Direção | Conteúdo | Notas |
| --- | --- | --- | --- |
| `steam:state` | janela → main (invoke) | → `SteamState` | Lê os arquivos na hora; não muda nada |
| `steam:setup` | janela → main (invoke) | sem corpo → `SetupProgress` final | Configura a conta mais recente (acrescentar nunca apaga, então não há confirmação extra além do clique). Recusa com `game-open` se o jogo estiver aberto |
| `steam:remove` | janela → main (invoke) | sem corpo → `SetupProgress` final | Tira a parte do companion de todas as contas configuradas |
| `steam:progress` | main → janela | `SetupProgress` | Cada passo do fluxo (FR-029) |
| `reader:release` | janela → main | sem corpo | Vira `{ "type": "release" }` no elo |
| `reader:reconnect` | janela → main | sem corpo | Vira `{ "type": "reconnect" }` no elo |
| `update:state` | main → janela | `UpdateState` | Repetido ao assinante atrasado, como `status:update` |
| `update:install` | janela → main | sem corpo | Só age com `canInstall`; senão ignora |

O preload guarda o último `update:state` e o repete a quem assinar depois (o mesmo padrão de `context:update`).
