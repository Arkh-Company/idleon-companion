# Protótipo da 005: cálculo em contexto vivo e catálogo de leitura

Código descartável. Lê a cópia local do jogo e retratos reais de fora do repositório. Nada aqui tocou o jogo em execução, salvo o roteiro jogado pelo Vinicius.

## Parte A: o cálculo cabe no alvo de 1 s?

**Teste.** Manter um contexto com o jogo já carregado e, a cada retrato novo, atualizar o estado e refazer os 11 números. Cada resultado foi comparado com um cálculo completo do zero sobre o mesmo retrato. Foram 136 retratos reais do roteiro, 135 pares. Critério aprovado: números iguais em todos os pares e p95 de até 500 ms.

| Variação | O que faz | Pares iguais | p50 | p95 | Máximo |
| --- | --- | ---: | ---: | ---: | ---: |
| 1 | Aplica só as peças que mudaram | 70 de 135 | 106 ms | 127 ms | 138 ms |
| 2 | Recarrega o estado e reroda os ajudantes, sem recriar os atores | 134 de 135 | 329 ms | 406 ms | 467 ms |
| 3 | Recarrega o estado, recria os atores e reroda todos os ajudantes | **135 de 135** | **277 ms** | **346 ms** | 467 ms |

Script: `node specs/005-reading-catalog/prototipo/vivo.cjs v3 uma`. Medido em Node, no PC do Vinicius, com restauração única.

**Decisão: variação 3.** O jogo carrega uma vez só, e cada cálculo põe o estado inteiro de novo, recria os atores, reroda os ajudantes e restaura o retrato uma vez antes dos 11 números.

O que os números mostraram:

- Aplicar só as peças que mudaram erra, porque os ajudantes derivam valores do estado inteiro.
- A premissa "rerodar ajudantes custa 1.905 ms" estava errada para um contexto já aquecido: a primeira carga levou cerca de 630 ms e as seguintes cerca de 300 ms.
- Restaurar antes de cada número custava cerca de 500 ms a mais e não mudou nenhum resultado (variação 1, com 5 pares: 594 ms contra 98 ms, e os mesmos erros).
- Na variação 3, o estado final difere do cálculo do zero só em 5 peças de rascunho e interface, sem efeito nos números.

**Conta do alvo de 1 s, estimada, ainda não medida no jogo.** A fatia do grupo A abaixo tem 12,8 KB e cabe numa leitura só. Lida 2 vezes por segundo, ela espera até 0,5 s; somando 0,35 s do cálculo, dá cerca de 0,85 s.

## Parte B: catálogo

[`catalogo.md`](catalogo.md) tem 684 peças: 247 de topo, 308 do `DNSM`, 51 do personagem em uso, 51 dos outros personagens (agrupados) e 27 `_vars`. Só nomes, tipos e tamanhos. O script recusa gravar se aparecer nome de personagem.

| Etapa | Como foi feita | Resultado |
| --- | --- | --- |
| 1. Inventário | União das peças dos 136 retratos e de um retrato de uma sessão mais longa | 684 peças |
| 2. Natureza | Quem lê e quem grava cada peça, no texto do jogo local | 282 dado de origem, 110 cache derivado, 244 rascunho, 32 tabela fixa, 16 interface |
| 3. Impacto | Uma peça alterada por vez, recálculo, 2 estados (parado e com o item fora) | 101 com impacto, 551 sem, 1 só quebra, 31 não medidas |
| 4. Quando muda | Peças que mudaram entre retratos, por janela do roteiro | Coluna "Muda em" |
| 5. Mecânica | Nome da peça e das rotinas que a usam | 41 das 101 peças com impacto marcadas "a conferir" |

Alterações usadas na etapa 3: dobrar, zerar e inverter; nas peças com texto, também reordenar nomes válidos e trocar por `Blank`. Remoção só quando nada disso mudava o valor. Nenhuma deriva: o contexto continuou igual ao cálculo do zero nas 1.278 medições e nas 345 da passada de texto. Scripts: `impacto.cjs` e `catalogo.cjs`.

As 101 peças com impacto, em [`revisar.md`](revisar.md):

| Grupo | Peças | Tamanho | Leitura pela regra atual |
| --- | ---: | ---: | --- |
| A. Muda só com ação do jogador | 11 | 12,8 KB | Rápida |
| B. Muda também com o personagem parado | 25 | 76,6 KB | Rápida |
| C. Não mudou nas ações do roteiro | 65 | 79,4 KB | Lenta |

**Decisões para o plano.**

- O grupo A forma a fatia de maior frequência: equipamento, obols e os caches ligados a eles.
- O grupo B fica na leitura rápida, em fatias por conteúdo, com frequência menor; ele custa perto de 4 leituras.
- O grupo C é pergunta aberta na spec: o roteiro não cobriu todas as ações do dia a dia. Exemplo: ele tirou e recolocou o mesmo item, e por isso `EquipmentMap` não mudou, embora troque ao pôr outro item.

## Limites

- Só um personagem e uma classe.
- Comida ficou fora do roteiro, porque não é ação do jogador, e a coleta de AFK não foi jogada.
- Retratos a cada 3 s e leitura em rodízio: a mudança de uma peça pode cair na janela seguinte à da ação. Os dois trechos "parado" são etapas canceladas do roteiro.
- Os primeiros retratos têm o estado ainda incompleto (34 entradas do `DNSM` no primeiro); o `DNSM` cresce até 277 entradas neste roteiro e passou de 300 numa sessão mais longa. As 31 peças só vistas nessa sessão não foram medidas e ficam na lenta.
- A natureza das entradas do `DNSM` sem impacto é aproximada: o jogo grava e lê a maioria na mesma função. Ela não decide a leitura.
- O impacto só vale para as situações dos 2 estados, como já registrado na spec.
