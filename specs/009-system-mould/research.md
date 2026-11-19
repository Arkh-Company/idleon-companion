# Research: Molde por sistema nas árvores de fórmula

Sem protótipo. A clarify fechou sem pergunta `to plan`. As decisões abaixo são de como construir.

## R1. Como achar os pools do jogo numa árvore qualquer

- **Decision (revista em 17/11, durante a implementação, decisão do Vinicius):** os pools seguem a **corrente de passos** do jogo, lida da montagem da 008 (`tree-build.ts`, os passos do bloco raiz), e não só a expressão do último passo.
  - **Somas seguidas** (passos que somam ao resultado anterior, e os termos somados de um passo) formam um **Additive pool**.
  - **Multiplicadores soltos seguidos** (cada fator é uma fonte que multiplica sozinha; a ordem não muda nada) se juntam num **único Multi pool**, com os grupos por sistema dentro.
  - **Multiplicador que soma bônus dentro** (um fator como `1 + (a + b) ÷ 100`, com mais de uma fonte) é o **seu próprio Multi pool**, com os bônus somados dentro (`combine: "onePlusPercent"`), porque ali eles se diluem.
  - **Troca de operação:** cada troca de + para × na corrente abre um pool novo.
  - **Números:** com mais de um pool do mesmo tipo, os nomes levam número na ordem da conta ("Additive pool 1", "Multi pool 2").
  - **Raiz de um passo só:** é o caso mais simples da mesma regra. Num produto de um passo, o fator que soma bônus é o Additive pool; os soltos formam o Multi pool.
  - **Drop Rate:** segue a mesma regra. A corrente dele (soma 846 → +2 → ×1.281 → +0.3 → ×1.2 → três passos de multiplicadores) dá Additive pool 1, Multi pool 1, Additive pool 2 e os Multi pools seguintes.
- **Rationale:** o jogador precisa ver a ordem em que o jogo calcula e onde um bônus é diluído numa soma. A regra lê a estrutura da conta sem molde à mão, e vale para toda árvore, inclusive as que têm corrente de passos (que a leitura só do último passo deixava sem pool).
- **Alternatives considered:**
  - **Pools da V1 no Drop Rate (LUK Scaling, Total Sum, Post-Processing):** foi feito na Fase 3 e descartado pelo Vinicius: estrutura só do Drop Rate, com dois pools sem regra de conta.
  - **Um Multi pool por fator:** descartado; multiplicadores soltos seguidos não mudam nada pela ordem, e o topo ficaria com dezenas de pools.
  - **Um pool por passo do jogo:** descartado; repetia Multi pools seguidos e dividia um sistema entre eles.

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

## R4. Prova do Drop Rate (SC-002)

- **Decision (revista em 17/11):** o Drop Rate é conferido pela paridade da 008 (`just parity`), que atravessa pools e grupos e compara fontes e valores com a bancada. A comparação de pools com a V1 (`compareMould`) sai, junto com a estrutura da V1.
- **Rationale:** os pools agora vêm da regra geral; a referência da bancada que continua valendo são as fontes e os valores.
- **Alternatives considered:** manter uma comparação de pools com a V1; não faz sentido sem a estrutura da V1.

## R5. O botão "Changes" e as setas ao vivo

- **Decision:**
  - **Onde vive:** o botão fica na janela, desligado por padrão.
  - **Base da comparação:** ao ligar em "live", a janela guarda a árvore como estava no clique: o valor de cada peça naquele momento (`pieceValues` da árvore aberta mais os valores ao vivo). Com uma marca escolhida, a base são os valores da marca. Uma marca apagada durante a comparação faz a base voltar para "live".
  - **Valores ao vivo:** as linhas com peça usam os valores que o main já manda para as partes abertas (`partsOf`, até 200 peças, desde a correção da 008). Um pool ou grupo não tem peça. O valor dele é refeito na janela a partir das fontes de dentro, pela regra de combinação que o nó traz (`combine`, em `data-model.md`).
  - **Seta:** usa a unidade da própria linha: em "+%", pontos percentuais ("▲ +10%"); em "×", a diferença no multiplicador ("▲ +0.12"). Decisão do Vinicius na revisão da spec.
  - **O que sai da árvore:** o "was", a linha que acende, o "mark" escrito e a faixa "Game changed · Refresh". A árvore aberta mostra os valores ao vivo, e uma mudança na forma da árvore faz o main pedir a árvore de novo sozinho (FR-015).
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
- **Desvio (T031, FR-018):** Desde a T031, a gravação chama o jogo em dois lugares, só leitura e ao lado da raiz: o multiplicador do Meritocracy (`EXTRA_ROOTS`) e, depois das raízes, o máximo de cada Legend Talent que a raiz chamou (`FOLLOW_CALLS`); no Drop Rate são 12 chamadas, sem custo medível na gravação (cerca de 3,1 s com e sem elas). A medida fica na sonda das 716 árvores.
