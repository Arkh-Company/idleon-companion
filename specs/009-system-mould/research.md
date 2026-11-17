# Research: Molde por sistema nas árvores de fórmula

Sem protótipo. A clarify fechou sem pergunta `to plan`. As decisões abaixo são de como construir.

## R1. Como achar os pools do jogo numa árvore qualquer

- **Decision:** os pools saem da expressão da raiz, que a montagem da 008 já lê (`tree-build.ts`, os passos e termos do bloco raiz).
  - **Fator de produto:** cada fator do produto de topo é um pool.
    - Um fator que soma bônus antes de entrar na conta é um **Additive pool**: por exemplo `1 + (a + b) ÷ 100`, ou uma soma de termos com mais de uma fonte.
    - Um fator que é uma única fonte, ou uma conta de uma única fonte, é um **Multi pool**.
  - **Soma de topo:** os termos de uma soma de topo formam um Additive pool.
  - **Ordem e números:** os pools seguem a ordem da conta. Quando há mais de um do mesmo tipo, levam número: "Multi pool 1", "Multi pool 2".
  - **Drop Rate:** usa os pools da V1 por uma tabela com prova, ligada ao id do catálogo (`dropRate`). A bancada a monta à mão em `build-v1mold.cjs`: LUK Scaling, Additive Pool, Total Sum e Post-Processing.
- **Rationale:** o jogador precisa ver se um multiplicador multiplica tudo ou se é diluído numa soma (spec, Clarifications de 17/11). A estrutura da expressão diz isso sem exigir um molde feito à mão por árvore.
- **Alternatives considered:**
  - **Nome pelo papel genérico ("Added"/"Multiplied"):** o Vinicius trocou pelo modelo de pools do jogo.
  - **Nome pela fonte que mais pesa:** foi descartado na mesma rodada.
  - **Molde à mão para cada uma das 716 árvores:** não escala; fica só no Drop Rate.

## R2. Sistema de cada fonte

- **Decision:**
  - **Tabela única:** uma tabela `bloco do jogo → [sistema, emoji]` cresce a partir do `tagOf` já trazido da bancada (`src/calculator/tree/tags.ts`), cada entrada com prova por referência.
  - **Fonte de cache:** vai para o sistema do bloco que escreve o cache; sem escritor, vai para "Other".
  - **Ordem dos sistemas:** a da V1 (`build-v1mold.cjs` `V1`). Depois vêm os sistemas novos, na ordem em que aparecem na conta, e "Other" por último.
  - **Cobertura:** medida pela sonda das 716 árvores (`quickstart.md`). A tabela cresce até nenhuma fonte com bloco conhecido cair em "Other".
- **Rationale:** a regra já existe e tem prova; só precisa cobrir mais blocos. A FR-003 da spec proíbe palpite.
- **Alternatives considered:** inferir o sistema pelo nome da fonte. Foi descartado: o nome nem sempre diz o sistema e pode mudar com a tabela de nomes.

## R3. Achatar os passos de conta sem nome

- **Decision:**
  - **Passada nova:** entra na montagem, ao lado das passadas do `parentPasses` da 008 (`places.ts`). Uma linha sem código do jogo e sem nome provado é trocada pelas suas partes, que sobem um nível. Um nome só por forma ("Multiplier", "Fixed +2") ou o genérico não segura a linha.
  - **ⓘ da linha de cima:** é a expressão inteira com os nomes das partes, montada como os ⓘ da 008 (`formulaOut`). Fecha com os números ou vira regra, como hoje.
- **Rationale:** é o mesmo mecanismo do `structurePass` (filho único), aplicado ao passo sem nome. As regras de nome e de ⓘ da 008 continuam valendo.
- **Alternatives considered:** achatar só na janela. Foi descartado: o ⓘ e a soma até o pai saem da montagem.

## R4. Prova de que o Drop Rate é igual à V1 (SC-002)

- **Decision:**
  - **Export da bancada:** a bancada exporta a V1 sobre o mesmo retrato, com `TREE=<gravação> OUT=<arquivo> node screen-proposal/build-v1mold.cjs`, em `PARITY_BENCH_DIR/parity/dropRate-v1.json`.
  - **Teste novo:** um teste de integração da receita `just parity` compara só o primeiro e o segundo nível: pools, grupos, ordem, valores e as fontes de cada grupo por chave de peça.
- **Rationale:** a paridade linha a linha da 008 compara a árvore sem molde. A V1 é um molde, então precisa da sua própria comparação, que é o critério da spec.
- **Alternatives considered:** comparar a árvore inteira da V1. Foi descartado: abaixo das fontes, a V1 pula linhas que só repassam valor. A paridade da 008 já cobre esse nível.

## R5. O botão "Changes" e as setas ao vivo

- **Decision:**
  - **Onde vive:** o botão fica na janela, desligado por padrão.
  - **Base da comparação:** ao ligar, a base é o valor de cada peça naquele momento (`pieceValues` da árvore aberta mais os valores ao vivo). Com uma marca escolhida, a base são os valores da marca.
  - **Valores ao vivo:** as linhas com peça usam os valores que o main já manda para as partes abertas (`partsOf`, até 200 peças, desde a correção da 008). Um pool ou grupo não tem peça. O valor dele é refeito na janela a partir das fontes de dentro, pela regra de combinação que o nó traz (`combine`, em `data-model.md`).
  - **Seta:** usa a unidade da própria linha: em "+%", pontos percentuais ("▲ +10%"); em "×", variação relativa ("▲ +10%").
  - **O que sai da árvore:** o "was", a linha que acende e o "mark" escrito.
  - **O que fica:** "Game changed · Refresh" continua como faixa, porque a spec tira só a marcação por linha.
- **Rationale:** a decisão é do Vinicius (FR-013). Refazer o valor do grupo na janela não pede chamada nova ao jogo nem peça nova no catálogo.
- **Alternatives considered:**
  - **Valores de grupo pedidos ao worker:** foi descartado, porque o grupo não é uma chamada do jogo.
  - **Seta só em fonte:** também descartado, porque a spec pede seta em toda linha.

## R6. Os dois botões (Changes e fatia) entre sessões

- **Decision:** os dois botões ficam no `settings.json` do app, como o zoom de texto da 0.7, pelo mesmo canal.
- **Rationale:** é preferência de quem olha, não dado do jogo. O lugar já existe e é validado.
- **Alternatives considered:** só em memória. Foi descartado: o jogador religaria a cada abertura.

## R7. A resposta curta sai

- **Decision:** o resumo de duas linhas acima da árvore (`AnswerHeader` da 008) sai da tela. O título continua no painel.
- **Rationale:** é decisão do Vinicius (FR-001).

## R8. Chaves de Pin, marca, radar e "Where this goes"

- **Decision:** pool e grupo têm `pieceKey: null`, então não entram em pin, marca, radar nem feeds. As fontes continuam com as mesmas chaves da 008.
  - **Marca:** guarda só peças. O valor da marca de um grupo é refeito a partir das peças da marca (R5).
  - **Ids:** o id de pool e de grupo segue o caminho de nomes da 008 (`raiz/Additive pool/⚗️ Alchemy`), estável entre aberturas.
- **Rationale:** é a FR-009 da spec. Nenhum arquivo salvo muda de forma.

## R9. Custo

- **Decision:**
  - **Worker:** os pools e o achatamento são passadas lineares sobre linhas já montadas, sem chamada nova ao jogo. A medida no jogo real entra na sonda das 716 árvores (`quickstart.md`).
  - **Janela:** refazer o valor dos grupos é linear nas fontes à vista.
- **Rationale:** a montagem é o que custa (008, T026). O molde não monta nada novo.
