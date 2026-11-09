# Protótipo: ler o estado em fatias sem travar o jogo

Código descartável. A versão real é escrita pelo Executor em `src/`, com TDD.

## O que foi testado

Duas perguntas, com o jogo real aberto em 09/11/2026, numa sessão da Markhe (Royal Guardian), com o jogador em atividade normal:

1. Ler o estado inteiro em fatias, continuamente, faz o jogo perder quadros?
2. Um retrato montado em fatias dá os mesmos números que o retrato inteiro?

`medir.cjs` abre o jogo pelo canal do depurador, pausa uma vez para pegar o motor (330 ms) e depois só lê propriedades, sem deixar nada na página (`fatia.js`, `listar.js`). Os testes de `lib.test.ts` provam, com armadilhas, que a leitura não chama função do jogo nem aciona getter.

Comandos: `pnpm exec vitest run --dir specs/004-data-base/prototipo` (6 testes passam) e, com o jogo, a opção da Steam apontando para `medir.cjs`.

## Como foi medido

- 48 janelas de 20 s, em 6 rodadas: 4 condições (fatias de 5, 25 e 50 KB, e o retrato inteiro a cada 5 s), cada uma precedida de uma janela sem leitura. As fatias vão uma a cada 250 ms, nunca duas em voo.
- Quadros pelo `Tracing` do Chromium do jogo (`FireAnimationFrame`), janela a janela. O `Performance.getMetrics` não serve para isso: o `Frames` dele conta iframes, não quadros desenhados.
- Custo por chamada pelo tempo da função dentro do jogo. A estimativa pelo `TaskDuration` ficou com ruído maior que o sinal e não foi usada.
- Cada condição foi comparada com a janela sem leitura imediatamente anterior, porque o jogo oscila.

## Resultado

O estado tem 516 a 558 peças e 908 KB. A divisão natural deixa a maior peça com 49 KB.

| Condição | Fatias no ciclo | Função, p50 | Função, p95 | Função, máximo |
| --- | --- | --- | --- | --- |
| 5 KB | 77 (cerca de 19 s) | 0,16 ms | 1,70 ms | 2,44 ms |
| 25 KB | 29 (cerca de 7 s) | 0,60 ms | 1,65 ms | 3,23 ms |
| 50 KB | 21 (cerca de 5 s) | 1,23 ms | 1,82 ms | 2,86 ms |
| Retrato inteiro | 1 | 14,08 ms | 16,67 ms | 21,25 ms |

Diferença média contra a janela sem leitura anterior (6 pares por condição):

| Condição | Quadros a menos em 20 s | Quadros perdidos | p95 do quadro | p99 do quadro | Tarefas de 50 ms ou mais |
| --- | --- | --- | --- | --- | --- |
| 5 KB | 91,5 (sd 363) | +38,2 (sd 120) | +1,6 ms (sd 3,7) | +2,5 ms (sd 11) | +3,0 (sd 6,4) |
| 25 KB | -324,7 (sd 939) | +12,0 (sd 73) | -1,2 ms (sd 4,2) | -5,3 ms (sd 15) | +0,3 (sd 3,3) |
| 50 KB | 311,2 (sd 432) | -20,7 (sd 62) | +1,9 ms (sd 2,1), pior nas 6 | +14,8 ms (sd 31) | +3,5 (sd 9,3) |
| Retrato inteiro | 74,3 (sd 289) | -9,7 (sd 62) | 0,0 ms (sd 0,9) | +1,3 ms (sd 3,8) | +1,8 (sd 1,5), pior em 5 de 6 |

Sem leitura, entre janelas, o jogo teve em média 2812 quadros (sd 622), 195 perdidos (sd 89) e p95 de 10,9 ms.

**Mosaico:** com a personagem parada, o retrato em 21 fatias de 50 KB e o retrato inteiro deram resultado idêntico nos 11 valores calculados (Damage mínimo e máximo, HP, MP, Accuracy, STR, AGI, WIS, LUK, Drop Rate e AFK Gains), com 27 `_vars` e 94 companions.

## Decisões para o plano

- **Leitura contínua em fatias é viável.** Cada fatia custa de 8 a 88 vezes menos que o retrato inteiro por chamada, e todas ficam bem abaixo do limite combinado de 5 ms.
- **Tamanho recomendado: 25 KB.** A 5 KB o ciclo fica longo (19 s) sem ganho claro. A 50 KB o p95 do quadro piorou nas 6 rodadas, um sinal pequeno mas consistente. A 25 KB nada piorou de forma visível, e o ciclo fica em cerca de 7 s.
- **Mosaico serve** para o cálculo, com a personagem parada.
- **Quadros pelo trace**, em laboratório. Não usar `Tracing` em produção.
- **`_vars`:** 27 chaves foram lidas sem problema. A leitura na rotação ainda precisa de medição própria, porque esta sessão a fez uma vez só.

## O que não ficou provado

- O ruído do próprio jogo é maior que o efeito da leitura. Isto prova "não dá para ver diferença", não "custo zero".
- A serialização não foi isolada: o custo por chamada acima é o tempo da função; o resto só aparece somado nos quadros.
- O mosaico foi comparado com a personagem parada. Em combate, chaves podem mudar entre fatias.
- Uma sessão, uma máquina e uma classe. Com `FireAnimationFrame`, o jogo deu cerca de 140 quadros por segundo; não foi verificado se cada evento é um quadro desenhado na tela.
- CBOR na pipe não foi testado.
