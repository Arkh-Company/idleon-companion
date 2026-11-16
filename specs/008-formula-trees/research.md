# Research: Árvores de fórmula ao vivo e painéis por sistema (008)

Base: o BASELINE-4 da bancada (commit `99d1772`, 13/11/2026), as medidas do [protótipo](prototipo/README.md) e o handoff da pesquisa (`docs\product\handoff-008-executor.md`, fora do repositório). As decisões do brainstorming e do clarify estão na spec; aqui ficam o "como" e as dez perguntas que a spec marcou `to plan`.

BANCADA = `C:\Users\Vinicius\idleon-companion\research\run\formula-006`; SCRATCH = a pasta de rascunho da sessão da pesquisa. As duas ficam fora do repositório e só são lidas na máquina do Vinicius.

## R1. O worker das árvores (Open Questions: o worker, o host novo, o pedido por número e os tetos)

- **Decision:** um segundo `Worker` do mesmo `calculator.js`, iniciado com `init` em modo árvore, com um host novo (`createTreeHost`) e limites próprios:
  - heap de **2 GB** (o de 1 GB continua para o worker da Stats);
  - tempo de boot e de gravação medidos de novo na primeira fase, sobre o `calculator.js` compilado.

  O worker fica vivo até o jogo fechar ou chegar um `gameFiles` novo. Uma troca de personagem, o leitor solto ou o `stop()` do pipeline descartam o pedido e a árvore guardada, mas não encerram o worker. Um prazo estourado encerra só aquele pedido (`unavailable`) e sobe outro worker no pedido seguinte, sem a trava do host da Stats.

  A janela pede por **id de número** (`{ type: "number", id, character }`). O main valida o id contra o catálogo em `src/shared/`, e o worker resolve o id na chamada exata do jogo (bloco + argumentos, com a aridade do jogo). O `boot()` do `engine.ts` vai para um `src/calculator/boot.ts` compartilhado, sem copiar o código de isolamento.
- **Rationale:**
  - Protótipo, item 1: com 1 GB a gravação do Drop Rate estoura a memória; com 8 GB, o pico é de 1.326 MB.
  - Item 6: o código de árvore no mesmo arquivo custa 4 ms e 0,9 MB no boot do worker da Stats.
  - O host da Stats encerra o worker a cada troca de personagem (`stats-pipeline.ts`, `forget()` → `host.reset()`), o que pagaria o boot e a instrumentação de novo.
  - O pedido por id respeita a regra `nothing-imports-the-calculator`: só o calculador sabe que `dropRate` é `TotalStats("Drop_Rarity")`.
- **Alternatives considered:**
  - Um bundle próprio (`tree-calculator.js`): pede entrada nova no `electron.vite.config.ts` e no `asarUnpack`, e só se confere no `just package`.
  - Copiar o host da Stats: mataria o worker a cada troca.
  - Subir o worker a cada pedido: pagaria ~2 s de boot por árvore.

## R2. O parser do código do jogo (Open Questions: o parser)

- **Decision:** **acorn 8.19.0**, em `devDependencies`, embutido no `calculator.js`, sem `import()` dinâmico. Aprovado pelo Vinicius em 13/11.

  Conferência da constituição:

  | Item | Resultado |
  | --- | --- |
  | Licença | MIT |
  | Dependências | Nenhuma |
  | Último lançamento | Outubro de 2026 |
  | Issues abertas | Casos de borda de sintaxe ("use strict" seguido de `++`, função rotulada no Anexo B) e uma de desempenho com blocos muito aninhados. Nenhuma toca o código do jogo, que o protótipo analisou inteiro em 2,2 s |
- **Rationale:** o espree, sobre o qual a paridade dos ⓘ da bancada foi medida, é construído sobre o acorn. O protótipo (item 3) deu árvore sintática idêntica: 5.413.962 nós, mesmo hash. O acorn tem 115 KB contra 248 KB do espree.
- **Alternatives considered:**
  - espree: mesma árvore, o dobro do tamanho e duas dependências a mais.
  - Nenhum parser: sem "How it adds up" (FR-006).

## R3. Nomes sem o índice da 007 (Open Questions: quantas linhas perdem nome)

- **Decision:** o app leva as regras de nome da bancada portadas como tabelas com prova por referência, e uma **tabela de nomes resolvidos**, gerada do export da bancada (`SCRATCH\r4-k0\t3\names-export.json`, refeito sobre o BASELINE-4): chamada → nome em inglês → prova (bloco e caminho, nunca texto do jogo). O Vinicius confere essa tabela antes da fase do Drop Rate. Uma chamada que nenhuma regra nem a tabela nomeia mostra um nome genérico e `no name yet`.
- **Rationale:** no protótipo (item 4), 17% das linhas do Drop Rate mudam de nome sem a 007, cerca de 300 distintas. O índice da 007 não vai ao app (constituição, `docs\product\…indice-njs-fora-do-repo`), mas os nomes provados são do projeto, não do jogo.
- **Alternatives considered:** aceitar os ~300 `no name yet` (tela muito pior para o iniciante); levar o índice inteiro (guarda o N.js; proibido).

## R4. "Tudo ao vivo" e o plano B (Open Questions: o custo de tudo ao vivo e a forma do plano B)

- **Decision:** vale o **plano B** da FR-008.
  - **Ao vivo**, a cada mosaico novo, só o que está à vista: os números do painel aberto, o grupo aberto da aba Formulas, os números fixados e a raiz da árvore aberta no painel lateral. O cálculo é por chamada simples, como a Stats, sem gravar.
  - **A árvore** é gravada quando o jogador a abre e a cada Refresh. O worker monta e devolve a raiz e o primeiro nível. Cada ramo é montado quando o jogador o abre, sobre a gravação guardada do mesmo mosaico.
  - **A Stats** fica num worker só dela e segue abaixo de 1 s.
- **Rationale:**
  - Protótipo, item 2: um ciclo de 437 números leva 2,52 s, uns 6 s para o catálogo inteiro; os 11 da Stats levam 0,10 s.
  - Item 1b: rodar o jogo na gravação leva 2,5 s, e a montagem da bancada 9,9 s. A montagem por ramo divide o custo.
  - Um painel típico, de ~30 números, custa ~0,2 s por ciclo.
- **Alternatives considered:**
  - Tudo ao vivo sempre: medido, não cabe.
  - Rodízio de fundo: CPU gasta ao lado do jogo o tempo todo, para números que ninguém está olhando.

## R5. Personagem inativo (Open Questions: a leitura e o cálculo dos personagens inativos)

- **Decision:** a referência da bancada (`SCRATCH\r4-i1\inactive.cjs`, `buildInactive`), portada para o worker. Os passos:
  1. Regravar o personagem ativo no `PlayerDATABASE`, como o jogo faz (`add_new_player_to_database`).
  2. Aplicar a troca do jogo (`LoadPlayerInfo`):
     - as 33 chaves de mesmo nome e os números (`CurrentMap`, `AFKtarget`, HP, MP…);
     - um índice só de `ObolEquippedOrder`, `ObolEquippedMap` e `PostOfficeInfo[3]`;
     - as chaves de outro nome (`Cards[2]` ← `CardEquip`, `Cards[3]` ← `CSetEq`, `PrayersActive` ← `Prayers`, `PlacedTraps` ← `PldTraps`, `TimeAway.Player` ← `PlayerAwayTime`).
  3. Refazer os caches de cena (Lab, `EveryScene.init`, `TotalStats("calcEtcBonuses")`), zerando a memória do `TotalStats` antes de cada passo.
  4. Calcular.

  O ativo é calculado com o `DNSM` vivo, sem reconstruir. Uma lista com formato inesperado faz o cálculo parar e avisar. A leitura não muda: o leitor já traz o `PlayerDATABASE` inteiro, pela leitura lenta.
- **Rationale:**
  - O roteiro com o jogo (13/11) mostrou que trocar só as 45 chaves erra até 75,5% no Drop Rate.
  - A referência da bancada dá 0 diferença nos 11 números, nos dois sentidos. O app não reproduziu: os retratos foram apagados antes.
  - Custo: ~130 ms por inativo num contexto quente.
- **Alternatives considered:** a troca simples de chaves (errada); não oferecer o seletor (contra a FR-020).
- **Risk:** só os 11 números da Stats e dois personagens têm gabarito. O plano põe uma tarefa `[sessão]` com o jogo, para conferir números do catálogo de um inativo entrando com ele.

## R6. Leitura dos atores de mapa e das peças da leitura rápida (Open Questions)

- **Decision:**
  - **Atores de mapa:** a leitura de cada fatia ganha só os campos de ator que as 40 árvores de jogo vivo leem (`SCRATCH\r4-l1\atores-vivos.json`). O caminho é o mesmo que o `read.js` já usa (`behaviors.cache.h["ActorEvents_N"].script[campo]`), só propriedades. Esses campos entram no catálogo da leitura (`src/shared/reading-catalog.md`) como linhas novas, com o impacto provado.
  - **Painéis de sistema:** cada painel declara os seus números, e as peças de que eles dependem passam à leitura rápida pela regra da 005 (FR-012 e FR-016: só com impacto provado, medido).
- **Rationale:** roteiro com o jogo: os 4 campos do primeiro monstro e do jogador foram lidos em 6,2 ms com a ida e volta pelo canal, menos de 1 ms dentro do jogo. A 005 manda declarar os números de cada feature.
- **Alternatives considered:**
  - Ler o mapa inteiro de atores: pesado e sem impacto provado.
  - Deixar o jogo vivo fora: decidido contra no brainstorming.

## R7. A auditoria das candidatas na bancada (Open Questions)

- **Decision:** feita. O BASELINE-4 (`99d1772`) traz o estado de 1.835 árvores do catálogo (`BANCADA\systems\CATALOGO-008-status.json`): ok, defeito com a causa, jogo vivo, não é stat, constante, gravar com -1 ou com argumento real.

  O catálogo do app entra **só com as árvores `ok`** desse arquivo. As outras ficam listadas, com a causa, e entram quando a bancada as corrigir, como ajuste pontual (uma regra, com a prova). As regras novas da rodada 4 que o porte segue:
  - uma árvore por gravação própria;
  - sub-caso de cache gravado com o argumento que força a remontagem (-1 ou 999);
  - linha por membro com um membro real;
  - raiz nunca é folha muda;
  - constantes de curva nomeadas pelo papel;
  - ⓘ com 3 algarismos significativos.
- **Rationale:** a regra do projeto é auditar todas as linhas antes de entregar, nunca por amostra.
- **Alternatives considered:** entrar com as candidatas sem auditoria (decidido contra pelo Vinicius).

## R8. ADR 0008 e o `ARCHITECTURE.md` (Open Questions)

- **Decision:** o ADR 0008 ([docs/adr/0008-a-second-worker-records-formula-trees.md](../../docs/adr/0008-a-second-worker-records-formula-trees.md), escrito neste plano) registra o worker de árvores. Ele emenda o 0006 e o 0007 com a linha `Amended by 0008`, sem reescrever o texto deles:
  - **o 0006:** o N.js reescrito por nós, com o parser, só com chamadas a `__X` definido dentro do contexto; o risco aceito continua o mesmo;
  - **o 0007:** dois contextos de vida longa, um por worker, com limites próprios.

  O `ARCHITECTURE.md` ganha:
  - o worker de árvores, o host, o painel lateral e a janela que alarga;
  - os painéis por sistema sobre o `CompanionModule`;
  - os arquivos salvos (marcas, números fixados, formas de árvore);
  - os canais `formula:*`;
  - a nota de que o contrato de módulo `module:<id>:*` da spec 001 continua reservado e sem uso.
- **Rationale:** a constituição pede uma tarefa de `ARCHITECTURE.md` para cada fronteira nova, e a decisão do worker é difícil de desfazer.
- **Alternatives considered:** nenhuma.

## R9. Os consertos pequenos antes da primeira fatia (Open Questions)

- **Decision:** cinco mudanças à parte, cada uma com o seu PR, pelo `/implementar` com um texto de quatro partes. Os textos estão no [plan.md](plan.md), seção "Antes da primeira fatia":
  1. `fix: companion level bonus` (`CompanionLVz`);
  2. `fix: status bar live region`;
  3. `feat: text zoom`;
  4. `fix: drop rate rounding`;
  5. `chore: ignore game data files` (os padrões novos do `.gitignore`, aprovados em 13/11).
- **Rationale:** valem para o app inteiro, não só para as árvores, e o `AGENTS.md` pede o diff só do que a tarefa pede.
- **Alternatives considered:** dentro da 008 (diff maior e misturado).

## R10. O NR-G e a frase-resposta do Drop Rate (Open Questions)

- **Decision:** instalado no BASELINE-4. As correções do Golden Food passaram:

  | Linha | Antes | Depois |
  | --- | --- | --- |
  | Kebabs | 561,83 | 56.083,46 |
  | Jam e Peanut | 842,25 | 84.125,18 |
  | Ribs | 1.122,67 | 112.166,91 |

  O total e a soma de conferência do Drop Rate continuam iguais (2.797.522,899738952 e 845,9508). A frase-resposta usa a base nova.
- **Rationale:** `BASELINE-4-READY.txt`, seção dos valores.
- **Alternatives considered:** nenhuma.

## R11. Itens aprovados pelo Vinicius em 13/11 (arquivos do critério de pronto e testes existentes)

| Item | Decisão |
| --- | --- |
| Receita `just parity` | Nova no `justfile`. Roda a paridade App = bancada (SC-002) só na máquina do Vinicius, com o retrato e as árvores por variável de ambiente; fica fora do `just check` e do CI |
| Testes da 004 e da 005 que esperam `unavailable` com o jogo fechado | Passam a esperar a última leitura com "last reading N s ago" (FR-022). Mudança de comportamento pedida, não teste enfraquecido |
| Os seis testes de isolamento do `engine.test.ts` | Viram uma tabela rodada sobre os dois workers; nenhuma asserção sai |
| `.gitignore` | `retrato-*.json`, `tree-*.json`, `*.sqlite` (o conserto 5 de R9) |
| acorn | R2 |

## R12. Arquivos salvos na máquina do jogador

- **Decision:** três arquivos JSON novos na pasta de dados do app (a mesma do `settings.json`), cada um com versão e conferido ao ler (FR-041):

  | Arquivo | Conteúdo | Requisito |
  | --- | --- | --- |
  | `marks.json` | Por número de personagem, até 3 marcas com nome e os valores | FR-025 |
  | `pins.json` | Os ids dos números fixados, sem valores | FR-036 |
  | `tree-shapes.json` | Por versão do jogo (sha256 do N.js), a forma de cada árvore: nomes de parte e chaves, sem valores | FR-029 |

  Nenhum leva nome de personagem, da conta ou da guilda (FR-010a).
- **Rationale:** o `settings.json` já mora ali, com o mesmo padrão de ler, conferir e gravar (`src/main/settings.ts`).
- **Alternatives considered:** `localStorage` da janela (a janela não deve guardar dado; validação fica longe do main).

## R13. A medição do farm

- **Decision:**
  - **Taxas:** XP, gold e itens por hora saem da diferença entre leituras do personagem ativo: o XP do skill do mapa, o dinheiro e o inventário. Ficam só em memória.
  - **A contagem** é uma máquina de estados pequena:
    - parada até o personagem entrar num mapa que não é cidade;
    - contando nesse mapa;
    - pausada na cidade;
    - recomeçando em outro mapa que não é cidade.
  - **"Cidade":** os mapas-cidade vêm da tabela de mapas do jogo, lida pelo keeper (`game-tables.ts`), com a regra provada por referência.
  - **Durante a implementação:** a cidade é a cena cujo nome contém "Town" (`Reading.scene`, que o keeper já lê por propriedade), a mesma regra do jogo, provada nas leituras capturadas (mapas 0, 50…300). O XP mostrado é o do skill que mais ganhou no período, e só ganhos contam (aceito pelo Vinicius em 14/11). Os nomes dos itens vêm da tabela de itens do jogo instalado, lida pelo keeper como mapas e monstros (aceito pelo Vinicius em 14/11).
- **Rationale:** a FR-028 pede só medido, sem fórmula; o leitor já traz o mapa, o personagem e as peças de inventário e de XP.
- **Alternatives considered:** usar a fórmula AFK do jogo (decidido contra no clarify).

## R14. Diferenças deliberadas do porte em relação à bancada (durante a implementação)

- **O ⓘ de um cache aberto** é devolvido por cada abertura, não fica numa variável do módulo (`LAST_WRITER_FORMULA` da bancada). Na bancada, um cache de várias voltas que lê outro cache pode mostrar o ⓘ do cache de dentro na linha de fora, com o "= valor" de uma parte no lugar do total. A paridade (T028) pode mostrar essa diferença; ela é um seguimento na bancada.
- **O ⓘ tem 3 algarismos significativos** em todo o app (a bancada usa 6 na F3-R1); com números grandes, um ⓘ que não fecha sai como regra.
- **As leituras da F3-R1 abrem sob a raiz**; na bancada, abrem sem nada acima. Só muda quando a própria raiz escreveu o cache.
- **Nomes (US1c, fases 24 e 25):** um nome sem prova ou genérico nunca dá nome a uma parte nem a um galho, e não há "Part N"; a constante "Base 5" fica fora do `ownName`; o `CACHE_NAMES` e o NR-G 2e da raiz ficam fora; o progresso de um valor de trabalho vale quando quem lê é quem escreveu; um item sem texto deixa a volta sem nome (a bancada escreve o id, que é código); uma batalha sem o texto do monstro fica "Battle N win"; o tipo vindo da lista `NAMES` vale só numa folha ainda sem tipo (a bancada sobrescreve no fim — a T028 mostra se dá diferença); as duas regras do `NAMES` que olham o nome de uma linha sem código ficam fora (dão o mesmo nome que a linha já tem).
- **Rename e passadas do finish (US1c, fase 27):** o ⓘ do `Dungon()` não usa ";" e o porquê diz "(N.js Dungon)" em vez do nome do bloco, porque o host recusaria a árvore inteira; o ⓘ da OPUS3-F5 sai como regra de duas linhas com 3 algarismos; uma coluna de monstro sem texto de tabela fica com o nome que tinha (a bancada escreve o id, que é código); o `oneOfEach` não junta uma leitura que uma regra de bug do jogo marca (FR-016); da `rename` ficam fora o "Total of the earlier turns" (o app abre a entrada do laço no escritor), as regras de bolha que olham o nome do pai escrito como soma com números (ESS, MealSpdz, TotalSTR, MainframeBonus), o "Part N" do Spelunking, a abertura do `SpelunkyUpgTOT` no seu push, o ": start value" e a parte da regra 67 que renomeia a linha do próprio pet; o app nunca dá "Multi" (`structurePass`) nem "Fixed multi"; a primeira linha da árvore não passa pela `aboveRenames` (nenhuma regra renomeia ali). A T028 lista essas diferenças como aceitas.
- **Passadas que renomeiam o pai e `structurePass` (US1c, fase 28):** o nível de cada linha é montado quando ela ganha lugar (a bancada monta a árvore inteira), então os conflitos de peça contam já na montagem da raiz; o nome de um grupo "At 0 (N)"/"At ×1 (N)" é sempre o do app (FR-014), e só as linhas dele recebem o `kidNames`; o `structurePass` não funde num grupo nem num filho cujo nível está cortado (o corte continua à vista); a regra 4 não roda sob um pai sem nome provado; um nome vago, de soma ou sem prova toma o nome provado do filho e nunca um nome genérico; a linha fundida leva o ⓘ do filho ("min(A, 10)" em vez de "min(Game value, 10)"); o `talentMulti` não é portado porque o termo "1 + talento ÷ 100" já vira o galho R1-PATCH com a curva do talento no ⓘ. A T028 lista essas diferenças como aceitas.
