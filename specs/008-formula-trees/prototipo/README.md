# Protótipo da 008: o custo das árvores no app

12/11/2026. Código descartável, fora do `just check`. Mede, antes do `/speckit-plan`, o "como" que estava incerto. A bancada usada é a BASELINE-3.1 (commit 3abbb53), fora do repositório; o retrato é uma cópia sem nome de personagem no nome do arquivo (`lab\out\retrato-character-9.json`, FR-032). Todas as saídas pesadas (gravações, árvores montadas) foram para a pasta temporária do sistema, nunca para o repositório. Nenhum script imprime nome de personagem, valor da conta ou trecho do código do jogo.

Máquina: a do Vinicius, Windows 11, Node 24.13. Os tempos são de uma máquina e servem como ordem de grandeza.

## Resumo das decisões para o plan

| # | Pergunta | Medida | Decisão |
|---|---|---|---|
| 1 | Gravar o Drop Rate cabe no worker do app? | Com 1 GB (o limite de hoje do worker): **estoura a memória**. Com 8 GB: 12,3 s a frio, pico de heap 1.326 MB, RSS 1.864 MB, 16,9 MB de gravação, 23.928 nós gravados | O worker de árvores precisa do **seu próprio limite, de 2 GB**. O de 1 GB continua só para o worker da Stats |
| 1b | Onde vai o tempo da gravação? | Instrumentar e carregar 0,67 s; subir o jogo 0,17 s; rodar o jogo (ajudantes, raiz, construtores) **2,5 s**; montagem fora do contexto (elos, nomes, contas, saída) **9,9 s** | O custo é da montagem, que na bancada é código de pesquisa. Os 5 s só valem com um porte enxuto da montagem; por isso o **plano B é o padrão**: a raiz e o primeiro nível saem primeiro, e cada ramo é montado quando abre |
| 2 | "Tudo ao vivo" cabe em 1 s? | Contexto quente: os 437 números do catálogo que dá para chamar direto levam **2,52 s por ciclo** (refazer o estado 88 ms + calcular); 407 calcularam, 14 falharam, 16 sem bloco. Os 11 da Stats: 0,10 s | **Não cabe** (o catálogo inteiro, ~1.100 números, daria uns 6 s por ciclo). Vale o plano B da FR-008: ao vivo o que está à vista (painel aberto, grupo aberto da aba Formulas, painel lateral, Pin), o resto ao abrir. Um painel de ~30 números custa ~0,2 s por ciclo e cabe |
| 3 | Qual parser? | espree 11.2.0: 248 KB embutido, 1,7 s para o N.js inteiro. acorn 8.19.0: **115 KB**, 2,2 s. **Árvore sintática idêntica** (5.413.962 nós, mesmo hash) | **acorn** (dependência nova, só com o sim do Vinicius no plan). A paridade dos ⓘ medida com o espree vale igual, porque a árvore é a mesma. Vai em `devDependencies`, embutido no `calculator.js` |
| 4 | Quantas linhas perdem nome sem a 007? | Montagem do Drop Rate com e sem o dicionário e o catálogo de nomes da 007 (as tabelas do jogo ficam): 2.414 × 2.401 linhas; **1.985 com o mesmo nome (82%)**, 415 com nome diferente (17%; 112 delas são linhas `shown earlier`, que saem com o clarify), 14 em ramos que mudaram de forma. A montagem cai de 33,7 s para 16,2 s sem as consultas à 007 | Cerca de **300 linhas distintas** dependem de um nome que hoje vem da 007. O plan leva esses nomes como uma tabela própria (chamada → nome, com prova por referência), conferida pelo Vinicius, porque o índice da 007 não vai ao app |
| 5 | Personagem inativo | Troca de personagem refazendo o estado: as 46 chaves do personagem no `PlayerDATABASE` vão para o topo, e `UserInfo[0]` muda. **Os 11 personagens dão número** (~135 ms de cálculo cada) | Funciona, com dois cuidados para o plan: a cópia de **`PostOfficeInfo`** no `PlayerDATABASE` tem outro formato e quebra a conta (fica de fora da troca); **`ObolEquippedMap`** e **`ObolEquippedOrder`** mudam o valor até no personagem ativo, porque a cópia do `PlayerDATABASE` está atrasada em relação ao estado vivo. O valor de um inativo **não tem como ser conferido** sem entrar com ele no jogo (roteiro abaixo) |
| 6 | O worker da Stats fica mais pesado com o código de árvore? | Worker com o parser embutido: boot 17,5 → 21,5 ms, heap 6,2 → 7,1 MB (mediana de 10) | Diferença desprezível perto do boot do contexto do jogo (> 600 ms, ADR 0007): **o mesmo `calculator.js`** serve aos dois workers |

## O que não foi medido aqui

- **A leitura do ator vivo** (kills por hora, comida AFK de combate, rocha do Spelunking, tabuleiro do Minehead): precisa do jogo aberto. Proposta: um roteiro curto com o Vinicius e o jogo rodando, antes do plan, que lê os campos do ator pelo leitor de hoje e mede o custo por leitura.
- **Se o valor de um personagem inativo está certo:** no mesmo roteiro, entrar com 2 ou 3 personagens no jogo e comparar o Drop Rate da tela com o que a troca de estado calcula.
- **A árvore sem compactação** (sem `shown earlier`): a gravação já é sem compactação (23.928 nós); o número de linhas da árvore montada sem compactar é o da base (5.024 no Drop Rate). O custo de desenhar 5.024 linhas na janela fica para o plan (a árvore só desenha os ramos abertos).

## Roteiro com o jogo aberto (antes do plan, cerca de 15 min)

Mede o que o protótipo offline não alcança: a leitura do ator vivo e se o valor de um personagem inativo está certo. Usa a sessão do laboratório (`lab\sessao.cjs`), que abre o jogo pelo canal do depurador, pausa uma vez e depois só lê propriedades, e segue `docs\product\roteiro-testes-no-jogo.md` §1, §3 e §7 (como abrir, não fechar a janela do teste, `soltar` no fim).

| Passo | O Vinicius | O Claude |
| --- | --- | --- |
| 1 | Anota a opção de inicialização da Steam, troca pela linha da sessão do laboratório e clica em Jogar | Copia `ator-vivo.js` para `lab\` |
| 2 | Entra num personagem A, vai a um mapa de combate com alvo AFK e avisa | Manda `run ator-vivo.js` e `retrato` pelo `lab\cmd.txt` e lê o resultado em `lab\out\` |
| 3 | Troca para um personagem B, de outra classe, e avisa | Manda `retrato` de novo |
| 4 | Digita `soltar`, fecha o jogo e restaura a opção da Steam | Offline: calcula o Drop Rate de B pela troca de estado sobre o retrato de A e compara com o de B ativo no retrato de B. Os dois retratos são apagados no fim (§8 do roteiro) |

Decide: se a leitura dos quatro campos do ator cabe a cada ciclo (a meta é a mesma da leitura de hoje, poucos ms) e se a troca de estado dá o valor certo para um inativo (0 diferenças) ou se o seletor de personagem precisa de mais chaves.

### Resultado do roteiro (13/11, 14h37–14h40)

Sessão do laboratório: uma pausa só (~283 ms), mapa de combate com alvo AFK, dois retratos (personagem A ativo; um minuto depois, personagem B ativo) e as `_vars` do dia. Os retratos ficam em `lab\out\`, fora do repositório, até a pesquisa usá-los como gabarito; depois são apagados.

**Ator vivo (`ator-vivo.js`):** os quatro campos foram achados só por propriedade (`behaviors.cache.h["ActorEvents_N"].script`): `_MonsterType` (texto, o código do monstro), `_MonsterHPtot` e `_RespawnTime` (números) e `_TargetEnemy` (vazio em AFK). Leitura: **6,2 ms** com a ida e volta pelo canal, menos de 1 ms dentro do jogo. **Decisão:** cabe em cada ciclo de leitura, como os comportamentos que o leitor já lê.

**Personagem inativo (`compare-inactive.cjs`):** o personagem calculado pela troca das 45 chaves (sem `PostOfficeInfo`) contra o mesmo personagem ativo, nos dois sentidos:

| Número | Diferença (B inativo no retrato A) | Diferença (A inativo no retrato B) |
| --- | ---: | ---: |
| Drop Rate | 75,5% | 75,6% |
| Accuracy | 59,0% | 59,4% |
| HP | 53,2% | 53,1% |
| Damage Max | 15,0% | 14,8% |
| AFK gains (Fighting) | 7,0% | 7,4% |
| LUK | 0,88% | 1,22% |
| STR, AGI, WIS, MP | < 0,5% | < 0,5% |

**Decisão:** a troca só das chaves do personagem **não basta**. Os atributos de base quase batem; o que depende de mapa, de talento de classe e dos caches que o jogo calcula para o ativo (`DNSM`) erra muito. O seletor de personagem (FR-020) precisa do conjunto completo de estado de um inativo: o mapa e o alvo AFK de cada um, e quais caches o jogo refaz por personagem. Pedido à bancada, com estes dois retratos como gabarito (0 diferenças é a meta). Até lá, o plan trata o inativo como a fase de maior risco.

## Como rodar

Da raiz do repositório, com a bancada e o jogo da bancada na máquina do Vinicius:

| Item | Comando |
|---|---|
| 1 | `node specs/008-formula-trees/prototipo/measure-record.ts` |
| 1b | `node --max-old-space-size=8192 -r ./specs/008-formula-trees/prototipo/phases.cjs build-tree.cjs <saída>` (na pasta da bancada) |
| 2 | `node --max-old-space-size=4096 specs/008-formula-trees/prototipo/measure-live.cjs` |
| 3 | `node --max-old-space-size=8192 specs/008-formula-trees/prototipo/measure-parser.ts` (precisa de `pnpm install` nesta pasta) |
| 4 | `node specs/008-formula-trees/prototipo/measure-names.ts` e depois `compare-names.ts` |
| 5 | `node --max-old-space-size=8192 specs/008-formula-trees/prototipo/measure-inactive.cjs` (e `find-swap-keys.cjs` para o diagnóstico) |
| 6 | `node specs/008-formula-trees/prototipo/measure-boot.ts` |

Arquivos de apoio: `peak.cjs` (pico de memória), `phases.cjs` (tempo por fase), `no007.cjs` (desliga a 007), `load-game.cjs` (sobe o jogo com o retrato, como o `lab\comparar.cjs`, sem imprimir nada do save).

## Achados para a bancada (não bloqueiam o app)

- O `instrument.cjs` acha o espree por um caminho fixo de um worktree antigo (`spec-006-investigate-formula-474e26`). Se esse worktree for apagado, a gravação da bancada para.
- O `lab\comparar.cjs` imprime o nome do personagem ativo. O protótipo usa o `load-game.cjs`, que não imprime.
