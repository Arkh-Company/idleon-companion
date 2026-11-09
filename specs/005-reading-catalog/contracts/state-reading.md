# Contrato: leitura do estado no jogo

Substitui, na 005, a tabela de regras de [`specs/004-data-base/contracts/state-reading.md`](../../004-data-base/contracts/state-reading.md). O resto daquele contrato continua valendo: só propriedades, nenhum getter, nada na página, `_vars` da lista fechada.

| Regra | Valor |
| --- | --- |
| Tamanho máximo de uma fatia | 25 KB; uma peça maior vai sozinha |
| Intervalo | uma leitura a cada 83 ms, 12 por segundo; nunca duas em voo, somando a leitura de 1 s |
| Vagas a cada segundo | 3 para a fatia `ações`, 7 para as outras fatias da rápida, 2 para a lenta |
| Quando uma classe não tem o que ler | a vaga vai para a outra |
| Primeira volta de um personagem | todas as vagas, até ler rápida e lenta inteiras |
| Agrupamento | por `Grupo` do catálogo, na ordem dele |
| Peça fora do catálogo | lenta |
| Sentinela | personagem e mapa em toda fatia |
| Sem personagem | sem leitura de estado |
| Ida e volta longa | pula a próxima vaga |

## `state-slice.js`

Recebe caminhos de 1, 2 ou 3 níveis. O terceiro nível é só `["PlayerDATABASE", personagem, subchave]`, percorrido com `Object.getOwnPropertyDescriptor` como os demais. Os testes com armadilhas passam a cobrir esse caminho.

## `StateSlice`

Forma igual à da 004, com `cycles: { fast, all }` no lugar de `{ formula, all }` e `StatePath` com o terceiro nível.

## Mosaico no app

- `belongs` aceita o terceiro nível só em `PlayerDATABASE`, e continua recusando `__proto__`.
- Personagem inteiro chegando descarta as subchaves guardadas dele.
