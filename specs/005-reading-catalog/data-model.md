# Data Model: Catálogo de leitura

Nada novo no disco do jogador. O catálogo fica no repositório, e o mosaico continua só na memória do app.

## Peça do catálogo (`CatalogRow`)

Uma linha de `src/shared/reading-catalog.md`.

| Campo | Tipo | Regra |
| --- | --- | --- |
| `name` | texto | Único. `Chave`, `DNSM.x`, `Personagem.x`, `OutrosPersonagens.x` ou `_vars.x`; nunca o nome de um personagem |
| `type` | texto | lista, mapa, número, texto, objeto, vazio ou não copiável |
| `bytes` | inteiro ≥ 0 | Tamanho num estado real |
| `nature` | enum | dado de origem, cache derivado, tabela fixa, rascunho ou interface (FR-003) |
| `numbers` | lista | Ids de `NUMBER_IDS` que a peça afeta; `nenhum`, `não medido` ou `só quebra` quando não há impacto |
| `changesOn` | texto | Ações do roteiro em que mudou, ou `não mudou` |
| `mechanic` | texto | Mecânica; `a conferir` quando há dúvida |
| `feature` | texto | Feature que usa a peça, ou `—` |
| `reading` | enum | `rápida` ou `lenta` |
| `group` | texto | Grupo de conteúdo; só a leitura rápida usa. `ações` é o grupo com prioridade |

**Regras verificadas por teste (FR-012 a FR-017, SC-004, SC-006):**

- `reading` é `rápida` se, e só se, `numbers` tem um número declarado por uma feature e o nome não começa com `OutrosPersonagens.`.
- Toda linha tem todas as colunas preenchidas.
- Nenhuma linha traz valor da conta, nome de jogador ou trecho do código do jogo (FR-004).

## Caminho de uma peça (`StatePath`)

| Forma | Linha do catálogo | Leitura |
| --- | --- | --- |
| `[chave]` | `chave` | a do catálogo |
| `["DNSM", x]` | `DNSM.x` | a do catálogo |
| `["PlayerDATABASE", atual, x]` | `Personagem.x` | rápida, quando o catálogo diz |
| `["PlayerDATABASE", atual]` | personagem inteiro | lenta e primeira volta |
| `["PlayerDATABASE", outro]` | `OutrosPersonagens.*` | lenta |
| `["_vars"]` | `_vars.*` | lenta |
| qualquer outro | nenhuma | lenta (FR-014) |

## Leitura e fatia

| Entidade | Campos | Regra |
| --- | --- | --- |
| Leitura (`StateClass`) | `fast` ou `slow` | Só duas (FR-013). Substitui `formula` e `other` |
| Fatia | peças de um grupo, até 25 KB | Uma peça maior vai sozinha. Grupo maior que o teto vira leituras seguidas |
| Vaga | 12 por segundo | 3 para `ações`, 7 para as outras fatias `fast`, 2 para `slow` (R3) |

## Número mostrado

`NUMBER_IDS`, em `src/shared/state.ts`, é o que a Stats declara (FR-016). Uma feature nova acrescenta seus ids.

## Estado do mosaico (`state-store.ts`)

| Estado | Entra quando | O que acontece | Sai quando |
| --- | --- | --- | --- |
| Sem personagem | sentinela sem personagem, ou `clear` | Nada é lido nem mostrado | Chega um personagem |
| Primeira volta | personagem novo | Todas as vagas leem tudo; nenhum número | Rápida e lenta lidas inteiras → Ao vivo |
| Ao vivo | primeira volta completa | Peça da rápida mudou → calcula | Personagem muda → Primeira volta; fonte parada → Parado |
| Confirmando | mudança na fatia `ações`, em Ao vivo | Espera a leitura seguinte da fatia; igual → calcula; diferente → espera de novo | Confirmou → Ao vivo |
| Troca de mapa | sentinela com mapa novo, em Ao vivo | Descarta a volta parcial da rápida, como na 004 | Uma volta inteira da rápida → Ao vivo |
| Parado | nenhuma fatia dentro do prazo de 30 s da 004 | Os números somem da aba como hoje | Chega fatia → Primeira volta |
