# Contrato: leitura do estado no jogo

Tudo só por propriedade: nenhuma função do jogo é chamada, nenhum getter é acionado, nada fica na página entre leituras.

| Regra | Valor |
| --- | --- |
| Tamanho máximo de uma fatia | 25 KB; uma peça maior vai sozinha |
| Intervalo | uma leitura a cada 250 ms; nunca duas em voo, somando a leitura de 1 s |
| Ordem | 3 fatias `formula` + 1 `other` por segundo |
| Sentinela | personagem e mapa em toda fatia |
| Sem personagem | sem leitura de estado |
| Ida e volta longa | pula a próxima vaga |

`state-slice.js` recebe os caminhos em `arguments`, e `state-list.js` lista as chaves. São funções só de leitura, cobertas pelo teste com armadilhas, como `read.js`. Funções da linguagem usadas: `Object.keys`, `Object.getOwnPropertyDescriptor`, `Object.getPrototypeOf`, `Array.isArray`, `WeakSet`. Nada de `JSON.stringify` em objeto do jogo.

## `_vars`

| Etapa | Regra |
| --- | --- |
| Localizar | uma vez por carga do jogo, por `Runtime.getProperties` a partir de `[[Scopes]]`; limite de 3000 objetos; sem chamar a função |
| Guardar | só a referência ao objeto que contém as chaves, num `objectGroup` próprio |
| Reler | a cada ciclo, só as 27 chaves da lista fechada |
| Registrar | nada: nenhum valor nem nome de propriedade fora da lista vai para log ou elo |
