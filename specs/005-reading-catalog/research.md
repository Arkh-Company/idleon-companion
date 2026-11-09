# Research: Catálogo de leitura

Decisões da 005. Os números vêm de [`prototipo/README.md`](prototipo/README.md), medidos em 09/11/2026 no PC do Vinicius.

## R1. Qual é o limite numérico de leituras por segundo? (linha `to plan`, CHK004)

- **Decision**: 12 leituras por segundo, de até 25 KB, nunca duas em voo. A resposta do Vinicius, em 09/11: "sai do segundo protótipo com medição de quadros".
- **Rationale**: em 8 pares contra a janela sem leitura, 12 por segundo teve p95 do quadro +0,68 ms (5 de 8 pares piores) e p99 +0,08 ms (4 de 8). O jogo sozinho oscila de 17 a 36 ms de p95. Cada leitura custa 1,33 ms de p95 e não cresce com a frequência. Com 8 por segundo, o pior caso passa de 1 s.
- **Alternatives considered**: 4 por segundo (a volta da rápida leva mais de 1 s); 8 por segundo (mesmo efeito medido de 12, sem caber no alvo).

## R2. Como cumprir menos de 1 s? (linha `to plan`)

- **Decision**: mais leituras por segundo e cálculo enxuto, como o Vinicius decidiu em 09/11. A conta do pior caso fica assim:

| Etapa | Fatia de ações | Demais fatias da rápida |
| --- | ---: | ---: |
| Esperar a leitura da fatia | 0,33 s | 0,71 s |
| Confirmar na leitura seguinte (R7) | 0,33 s | não se aplica |
| Cálculo em andamento e intervalo | 0,16 s | 0,16 s |
| Cálculo | 0,10 s | 0,10 s |
| **Total** | **0,92 s** | **0,97 s** |

- **Rationale**: cada mudança precisa percorrer leitura, espera e cálculo. Só a soma dá o alvo, e é o SC-001 que a confere com o app pronto.
- **Alternatives considered**: ler só os campos que importam em cada peça, mantendo 4 por segundo. Exige a análise de dependência que o Vinicius dispensou e ainda precisaria enxugar o cálculo. Prioridade só para equipamento: deixava os demais bônus em até 5 s, rejeitada pelo Vinicius.

## R3. Como as 12 vagas se dividem?

- **Decision**: 3 para a fatia de ações, 7 para as demais fatias da rápida e 2 para a lenta, a cada segundo. Isso mantém as 10 da rápida e as 2 da lenta medidas no protótipo.
- **Rationale**: a fatia de ações tem 17,4 KB e é a única confirmada em duas leituras (R7). As outras cerca de 5 fatias, com 7 vagas, dão a volta em 0,71 s. A lenta tem cerca de 29 fatias e dá a volta em cerca de 15 s.
- **Alternatives considered**: rodízio igual, sem vagas fixas para ações: a fatia de ações esperaria até 0,6 s e a confirmação passaria de 1 s.

## R4. Como o catálogo vive no repositório?

- **Decision**: uma tabela Markdown, `src/shared/reading-catalog.md`, importada como texto (`?raw`, como `context.js`) e lida por `src/shared/reading-catalog.ts`. É a fonte única: as listas de leitura saem dela (FR-017). As colunas são as do FR-002 e mais `Grupo`, o conteúdo que vem junto na fatia (FR-018).
- **Rationale**: uma tabela só serve a quem lê e ao código, sem duas cópias para divergir. O teste confere as regras do FR-012 a FR-014 linha a linha, o que cobre o SC-006.
- **Alternatives considered**: JSON ou TypeScript com uma tabela gerada ao lado (duas fontes); gerador do catálogo no produto (nada pede isso hoje: `prototipo/catalogo.cjs` fica de referência).

## R5. O que a leitura rápida traz?

- **Decision**: toda peça com impacto provado num número mostrado, salvo as de outros personagens: 97 peças, 120 KB (`prototipo/catalogo.md`). Peça ausente do catálogo vai para a lenta (FR-014).
- **Rationale**: decisão do Vinicius em 09/11. Uma ação pode ocorrer dentro de uma peça que também muda sozinha, como mover um objeto no Research, e a regra por peça não enxerga isso.
- **Alternatives considered**: separar por "muda só com ação": rejeitada pelo Vinicius por ignorar as mecânicas.

## R6. Como o cálculo roda?

- **Decision**: variação 4 do protótipo. O jogo carrega uma vez num contexto só, e cada cálculo põe o mosaico inteiro de novo, recria os atores, reroda os ajudantes, reaplica os valores simples e os bônus, e tira os números direto do estado, sem serializar nem restaurar. Falha ou limite de tempo recriam o worker, como hoje. Ver ADR 0007.
- **Rationale**: 135 de 135 pares iguais a um cálculo do zero, com p50 de 91 ms e p95 de 99 ms. Por fase: estado 9 ms, ajudantes 78 ms, números 5 ms.
- **Alternatives considered**: aplicar só as peças que mudaram (70 de 135 pares iguais; os ajudantes derivam do estado inteiro); não recriar os atores (134 de 135); contexto novo a cada cálculo (carregar o jogo custa mais de 600 ms); dois contextos para não esperar o cálculo em andamento (desnecessário a 99 ms).

## R7. Quando o número é publicado?

- **Decision**: depois da primeira volta (FR-021), o app calcula sempre que uma peça da rápida muda, com no máximo um cálculo em voo e 60 ms entre o fim de um e o início do próximo; o mosaico mais novo substitui o que esperava. Mudança na fatia de ações só vai ao cálculo quando a leitura seguinte dessa fatia a confirma igual.
- **Rationale**: o grupo B muda o tempo todo; sem intervalo, o cálculo ocuparia um núcleo inteiro. A confirmação cumpre "num passo só" (cenário 3 da US1), porque o jogo refaz os caches depois de trocar o item. Ela só existe na fatia de ações, a única onde cabe no alvo. Se a medição do SC-001 mostrar valor intermediário em outra fatia, volta como pergunta.
- **Alternatives considered**: calcular em cada leitura (um núcleo cheio); confirmar em todas as fatias (passa de 1 s); intervalo fixo de 2 s, como em `fix/stats-latency` (descumpre o alvo).

## R8. Como ler só uma subchave do personagem em uso?

- **Decision**: `StatePath` ganha um terceiro nível, `["PlayerDATABASE", personagem, subchave]`, só lido por propriedade em `state-slice.js`. A primeira volta e a lenta continuam lendo o personagem inteiro. No mosaico, quando chega o personagem inteiro, as subchaves guardadas dele são descartadas, e vale o que foi lido por último.
- **Rationale**: `Personagem.SkillLevels` tem impacto, mas o personagem inteiro tem 46 KB, acima do teto e do orçamento da rápida.
- **Alternatives considered**: copiar `SkillLevels` do topo para o personagem (nada prova que são iguais a todo momento).

## R9. Como fica a primeira volta?

- **Decision**: ao entrar num personagem, todas as vagas vão para a primeira volta, inteira: uma passada da rápida e depois a lenta, cerca de 35 leituras. Depois passa à divisão de R3.
- **Rationale**: o primeiro número aparece em cerca de 3 s, em vez de cerca de 19 s, e o custo por segundo no jogo é o mesmo já medido. Nada é mostrado antes de terminar (FR-021).
- **Alternatives considered**: manter a divisão de R3 na primeira volta (cerca de 15 s para o primeiro número).

## R10. Como apontar o que um patch mudou?

- **Decision**: uma função pura, `diffInventory`, compara os nomes de um estado real com o catálogo, e o script `scripts/reading-inventory.ts <retrato.json>` imprime só os nomes novos e os que sumiram. Personagens saem como `Personagem` e `OutrosPersonagens`.
- **Rationale**: cumpre o FR-022 com o mínimo. Peça nova já cai na lenta sem quebrar nada; o script só serve para decidir o que medir.
- **Alternatives considered**: tela ou log no app (nada pede isso, e o app não tem log hoje).

## R11. Relação com `fix/stats-latency`

- **Decision**: o fix não vira PR. O intervalo de 2 s e o `DNSM` inteiro na rápida dele são substituídos por R3, R5 e R7.
- **Rationale**: a 005 troca a mesma parte do código, com regras medidas.
- **Alternatives considered**: abrir o fix antes (trabalho que a 005 desfaz logo depois).
