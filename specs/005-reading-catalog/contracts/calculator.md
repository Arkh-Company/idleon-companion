# Contrato: worker do cálculo

Substitui, na 005, as regras abaixo de [`specs/004-data-base/contracts/calculator.md`](../../004-data-base/contracts/calculator.md). As mensagens `init`, `ready`, `failed`, `calc` e `result` não mudam.

| Regra | 004 | 005 |
| --- | --- | --- |
| Contexto `node:vm` | novo a cada cálculo | um só por worker, criado no `init` |
| Estado entre números | restaurado antes de cada número | números na ordem de `TARGETS`, direto do estado deixado pelos ajudantes |
| Atores dos ajudantes | criados uma vez por contexto | recriados a cada cálculo |
| Depois dos ajudantes | valores simples e bônus reaplicados; retrato serializado | valores simples e bônus reaplicados; sem serializar |
| Intervalo entre cálculos | `CALC_GAP_MS` de 5 s | 60 ms |

Continuam iguais: objeto sem protótipo, `codeGeneration` desligado, nenhum objeto do host no contexto, `CloudSAVE` e `SaveGamee` vazios, tabelas fora do retrato vindas das classes do próprio jogo, limites de 2 s por número, 15 s por conjunto e 60 s para iniciar, e `terminate()` com `unavailable` quando passar.

Uma exceção em cálculo devolve números `null`, e o cálculo seguinte tenta de novo sobre o mesmo contexto. Limite estourado recria o worker.
