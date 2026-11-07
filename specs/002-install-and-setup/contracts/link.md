# Contrato: elo guardião ↔ app (mudanças da 002)

O elo da 001 continua (`\\.\pipe\idleon-companion`, uma mensagem JSON por linha). Entram duas mensagens do app para o
guardião e um valor novo de `Status.reader`.

| Mensagem | Direção | Efeito no guardião |
| --- | --- | --- |
| `{ "type": "release" }` | app → guardião | Com o leitor ativo: para o leitor, espera soltar a referência (`Runtime.releaseObjectGroup`) e desanexar da página (`Target.detachFromTarget`); o canal do depurador continua aberto. Publica `{ game: "running", reader: "released" }`. Sem leitor ativo: ignora. |
| `{ "type": "reconnect" }` | app → guardião | Com `reader: "released"` e o jogo aberto com o canal: começa um leitor novo (`connecting`, uma pausa, `attached`). Em qualquer outro estado: ignora. |

- O decodificador de linhas aceita só esses dois tipos novos, sem campos; qualquer outra coisa segue sendo descartada.
- Um `release` seguido de `reconnect` antes de a soltura terminar espera a soltura (sem duas sessões ao mesmo tempo).
- Logs do guardião: `released` e `reconnect` (com o `id` do jogo), como os outros rótulos.
- Nada disso chama função do jogo nem grava no save: o leitor novo é o mesmo da 001.
