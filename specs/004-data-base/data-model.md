# Data Model: Base de dados (data-base)

## StatePiece

Uma unidade indivisível do estado.

| Campo | Tipo | Regra |
| --- | --- | --- |
| `path` | `[string]` ou `[string, string]` | chave de topo, ou mapa dividido (`PlayerDATABASE`, `DNSM`) + filho |
| `bytes` | `number` | tamanho medido na última leitura; define o empacotamento. Antes da primeira leitura, 25.000 para um filho de `PlayerDATABASE` e 2.000 para as demais |
| `cls` | `"formula" \| "other"` | só prioridade, nunca exclusão (R2) |

Chaves fora do retrato: `CustomLists`, `ItemDefinitionsGET`, `MonsterDefinitionsGET`, `DialogueDefGET`, `PixelHelperActor`, `CustomMaps`.

## StateSlice

O que uma leitura devolve e o elo leva.

| Campo | Tipo | Regra |
| --- | --- | --- |
| `sentinel` | `{ char: string \| null, map: number }` | lido em toda fatia; mudou o personagem, o mosaico recomeça; mudou o mapa, o ciclo parcial é descartado e o próximo cálculo espera uma volta inteira da classe `formula` (FR-022) |
| `pieces` | `{ path, value }[]` | até 25 KB, salvo uma peça maior, que vai sozinha; os `_vars` vão na peça `["_vars"]` |
| `at` | `number` | hora da leitura, no guardião |
| `cycles` | `{ formula: number, all: number }` | voltas completas desde a troca: o mapa zera `formula`, o personagem zera as duas |

`value` só tem número, texto, booleano, `null`, listas, objetos simples e `{ $m, $c }` para mapas Haxe; `{ $n }` para número não finito e `{ $x }` para o que não se copia. Getters nunca são acionados.

## StateMosaic (só na memória do app)

| Campo | Regra |
| --- | --- |
| `sentinel` | o do ciclo atual; `char === null` limpa tudo |
| `pieces` | valor mais novo por peça |
| `vars` | as chaves da lista fechada, e só elas |
| `companions`, `shiny` | `DNSM.CompanionBon` e `DNSM.ShinyBonusS`, na classe `formula` |
| `changedSinceCalc` | `true` quando algum valor da classe `formula` mudou |

Nunca vai para o disco nem para log.

## GameFiles

`{ resources: string }`, publicado pelo guardião. O processo principal do app lê os dois arquivos da instalação; os bytes vão ao worker, e o caminho não.

## CalcResult

| Campo | Tipo |
| --- | --- |
| `numbers` | um `number \| null` por número; `null` = falhou |
| `ms` | duração |

## Stats

O que a janela recebe.

| `state` | Campos | Aba |
| --- | --- | --- |
| `"none"` | nenhum | sem linhas; nada do personagem anterior |
| `"calculating"` | nenhum | "Calculating" (só antes do primeiro cálculo) |
| `"ready"` | `rows: { label, text }[]`, 10 linhas | os números, ou "unavailable" numa linha |
| `"unavailable"` | nenhum | "Calculator unavailable" |

## Transições de Stats

```text
none ──(primeira fatia do personagem)──▶ calculating ──(primeiro resultado)──▶ ready
ready ──(novo resultado)──▶ ready
calculating | ready ──(sentinela mudou de personagem)──▶ calculating
qualquer ──(sem personagem, reader solto ou desligado)──▶ none
calculating | ready ──(motor não inicializa, trava ou cai)──▶ unavailable
unavailable ──(novo início do jogo)──▶ none
```
