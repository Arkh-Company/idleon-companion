# Protótipo da 010: gabarito, receita escrita à mão e trava (Drop Rate)

Protótipo descartável. Nada aqui é código de produto, e nada aqui guarda valor do personagem: a gravação, o gabarito
com valores, as medidas e o resultado da trava vão só para a pasta de rascunho da sessão (`scratchpad/proto010/`).

## O que foi testado

Três perguntas, sobre o `dropRate` do retrato `retrato-character-9.json`, com a cópia do jogo da pasta de rascunho:

1. **Gabarito** (`gravar.ts`, `gabarito.ts`, `gabarito.test.ts`): o gravador real (`bootRecorder(...).record` com
   `TREE_ROOTS`, `TREE_RECIPE`, `EXTRA_ROOTS` e `FOLLOW_CALLS`) grava o número; os passos do bloco raiz saem do
   `makeSteps`. A extração só lê esses passos e as escritas da raiz, e tira: a corrente de pools (onde o jogo soma e
   onde multiplica, na ordem), as fontes de cada pool com o valor, e o valor final.
2. **Receita escrita à mão** (`receita-dropRate.json`): pools na ordem do jogo, grupos por sistema com emoji, fontes
   com nome do texto do jogo e referência ao código, filhos até a folha com um dos 9 tipos.
3. **Trava** (`trava.ts`, `trava.test.ts`): a receita contra o gabarito, em três casos.

Como rodar (uma vez, nunca em laço):

```
cd 'C:\Users\Vinicius\ClaudeCowork\idleon-companion\.claude\worktrees\loving-mahavira-72bd90' && pnpm exec vitest run --pool=threads --dir specs/010-declared-trees/prototipo
```

Resultado da última rodada: 2 arquivos, 4 testes, todos passaram, 4,9 s no total.

## Números medidos

Medidos com `performance.now()` dentro do teste, em 4 rodadas (a faixa é o menor e o maior valor):

| Etapa | Tempo |
|---|---|
| Boot do gravador (instrumentar o N.js e subir o contexto) | 1,3 a 1,5 s |
| Gravação do Drop Rate (`record`) | 2,4 a 3,1 s |
| `makeSteps` do nó raiz | 20 a 28 ms |
| **Extração do gabarito** (só lê os passos) | **1 a 5 ms** (2,2 ms na última rodada) |
| Trava da receita inteira | 9 a 15 ms |

A gravação tem 52.520 nós. O bloco raiz (`TotalStats("Drop_Rarity",0,0)`) tem 13 passos e 6 checagens.

### O gabarito

- Corrente de pools: **Additive → Multi → Additive → Multi** (o jogo escreve o acumulador `DNSM.TotStatMAP.Drop_Rarity`
  8 vezes; escritas seguidas do mesmo tipo viram um pool só).
  1. Additive (escritas 1 e 2): 53 fontes + 2 constantes (o `+ 1` e o `+ 2` do pacote bun_v). As fontes em % entram
     com peso 1/100; a curva da LUK entra com peso 1.
  2. Multi (escrita 3): 1 fonte, o talento 328 da Workbench.
  3. Additive (escrita 4): 1 constante, o `+ 0.3`.
  4. Multi (escritas 5 a 8): 18 fontes + 1 constante (o `× 1.2` do pacote bun_p).
- **72 fontes e 4 constantes.** Cada pool fecha com o valor gravado com erro relativo de até 1,5e-13; a corrente dá o
  valor final com erro de 1,8e-16.
- Cada fonte é um termo da conta, com a referência principal (`Bloco(args)` ou o caminho lido), as outras
  referências do mesmo termo, o valor e o peso. Exemplo: `GetTalentNumber(1,655)` com a segunda referência
  `OptionsListAccount[189]`, porque o jogo multiplica os dois no mesmo termo.

### Comparação com a árvore 0.9

Fonte da 0.9: `check09/dump-depois.json` (o Multi pool 3 veio de `out-09.txt`, porque o dump parou no orçamento de
2.500 linhas antes dele). Sonda: `scratchpad/proto010/comparar09.mjs`.

| | Gabarito | Árvore 0.9 |
|---|---|---|
| Primeiro nível | 4 pools | 7 itens: 4 "Additive/Multi pool", o talento 328 solto, o `+0.3` solto e mais 2 pools |
| Fontes | 72 | 74 linhas de fonte (mais 1 grupo 🎽 sem filhos na saída de 2 níveis) |
| Constantes | 4 | 17 ("Fixed", "Base 1", "Percent to number", "Cap 1.3"...) |

As diferenças, uma por uma:

- **Os pools da 0.9 não são os do jogo.** O "Additive pool 2" (Mama Troll, 1,5) e o "Multi pool 2" (Unagi Nigiri e
  Gold Bangle, 1,15) são pedaços de fatores `(1 + ...)` de dentro da mesma multiplicação. O "Multi pool 1" (9,77) e o
  "Multi pool 3" (152,7) também são pedaços dela. No código, depois do `+0.3` há uma corrente só de multiplicações.
- **4 linhas da 0.9 são a segunda referência de um termo do gabarito:** Kingdom stats (`RoyalG("TotalStatz")`, que
  multiplica o talento 239), Mama Troll: version (`CompLV2(132)`), Gold Bangle (`JellyOperation(14)`, somado ao
  Unagi) e Glunko The Massive (`Companions(160)`, que multiplica o Mallay).
- **2 fontes do gabarito não aparecem na saída da 0.9** (`EtcBonuses("99")` e `EtcBonuses("91")`), mas estão dentro do
  grupo 🎽 Equipment do Multi pool 3, que a saída de 2 níveis não abriu. Na prática, as duas árvores têm o mesmo
  conjunto de fontes. A diferença está nos cortes (pools e termos) e nas constantes.

## A poluição do rastro

O que o rastro do bloco raiz tinha e o gabarito precisou ignorar ou atravessar, com a contagem no Drop Rate:

| Poluição | Contagem | O que o gabarito fez |
|---|---|---|
| Escrita de rascunho em `DummyNumbersStatManager` (contadores de laço do preâmbulo) | 50 | ignorou; e tirou esses caminhos das variáveis de passagem (um contador valia 5 e casava por engano com `OptionsListAccount[189]`) |
| Acumulador sem nome (`val`) nos passos 7 a 12 | 6 | achou pelo valor da escrita anterior |
| Acumulador lido pelo caminho (`read`) | 1 | idem |
| Checagens do preâmbulo do bloco (Gallery, Dungeon), de outro ramo | 5 | ignorou |
| Checagem de ramo da conta (`1000 > DropRateLUK`) | 1 | ignorou (não muda o valor) |
| Passos do preâmbulo comum de `TotalStats`, fora da corrente | 3 | ignorou |
| Constante solta no pool (`+1`, `+2`, `+0.3`, `×1.2`) | 4 | virou termo "constante" |
| Passo condicionado sem a condição no rastro (`bun_v`, `OptionsListAccount[232]`, `bun_p`) | 3 | a condição não aparece em `checks`, porque o jogo escreve `cond && (...)` e o `instrument` só marca `if` e `?:` |
| Passos seguidos do acumulador juntados num pool | 4 | 8 escritas viraram 4 pools |
| Cache DNSM lido como fonte (`BoxRewards`, `AlchBubbles`, `StarSigns`, `FamBonusQTYs`, `AlchVials`) | 5 | virou fonte com a leitura como referência |
| Variável de passagem sem nome (`val` casado pelo valor que a raiz escreveu) | 3 | atravessou (`DNSM.DropRateLUK`, 2 vezes, e a curva da LUK) |
| Variável de passagem lida pelo caminho (`DNSM.DropRateLUK2`) | 1 | atravessou: as 27 fontes dela entram no pool 1 |
| Divisão da soma inteira por 100 | 1 | atravessou, com peso 1/100 nos termos |
| Cópia do total em outro caminho (`NormzDR_GlunkC`) | 1 | ignorou |

As 3 maiores, pelo trabalho que deram: **as variáveis de passagem** (sem atravessá-las, metade do pool 1 vira uma
fonte só, `DropRateLUK2`), **o acumulador sem nome** (sem ele não dá para saber onde um pool começa) e **as condições
`cond && (...)` que o rastro não guarda** (o `+2`, o `+0.3` e o `×1.2` aparecem sem a condição).

## A trava nos 3 casos

A trava confere: a ordem dos pools; toda fonte e toda constante do gabarito na receita (pela referência e pela
ocorrência dentro do pool); a ordem dos grupos e das fontes (FR-013a: pela primeira fonte de cada grupo no gabarito);
o fechamento da raiz e de cada pool com diferença relativa até 1e-6; abaixo da fonte, que cada filho declarado esteja
entre as partes que o jogo gravou para o pai e tenha valor na gravação; e que toda folha tenha um dos 9 tipos.

| Caso | Resultado | O que a trava disse |
|---|---|---|
| Receita correta | **passou** | 0 erros; 5 níveis fecharam com o valor gravado (raiz e 4 pools); 35 nós com filhos cobertos; 60 folhas com tipo; 50 nós marcados "a descer" |
| Sem a fonte `Summoning("WinBonus",9,0)` | **reprovou** | `fonte que falta: Summoning("WinBonus",9,0) (pool 1 Additive, valor 668.85)` e `nível não fecha: pool 1 Additive: as partes dão 841.2622741, o valor gravado é 847.9507741` |
| Pools 1 e 2 trocados | **reprovou** | `ordem dos pools errada: a ordem esperada é Additive → Multi → Additive → Multi; a receita tem Multi → Additive → Additive → Multi` |

A cobertura também lista as partes que o jogo usou num nó aberto e a receita não declara: 19 no total. São as curvas
(`ArbitraryCode5Inputs("decay",...)`, 4 vezes), o `getLOG`, o `Dungon()` de contexto, as leituras dos outros
personagens no talento 328 (o jogo pega o melhor dos 10), os contadores `GurtBonuzz` e um `AllTalentLVz` de outro
personagem. Hoje é aviso, não erro.

## A receita escrita à mão

- **Tempo:** cerca de 40 minutos para declarar as 72 fontes e as 4 constantes, nomear, agrupar em 47 grupos (31 no pool 1, 14 no pool 4) e descer
  35 nós até a folha. Usei o despejo dos passos gravados de cada fonte (`scratchpad/proto010/passos-das-fontes.txt`)
  como guia e conferi no N.js pelo njs-index. Sem esse despejo, cada bloco pede uma leitura própria do N.js (o
  `TotalStats` sozinho tem 1.515 linhas formatadas).
- **Profundidade:** desci até a folha a curva da LUK (um nível; a LUK é um número próprio, "a descer"), o Boss Battle
  Spillover (talento 655 × recorde), o Gold Charm, o Trove (sigilo 11), as 4 fontes de carta do `DropRateLUK2`, o
  Faux Jewels, o Summoning: Drop Rate (11 filhos), o Tome: Drop Rate, as 2 conquistas, as 6 companions do pool 1 e o
  pool 2 inteiro (talento 328 até os pontos e a tabela). As 18 fontes do pool 4 descem um nível. 30 fontes do pool 1
  ficaram "a descer".
- **Fórmulas fora do repositório:** a primeira versão trazia a fórmula de cada nó (35 fórmulas) e, com ela, **40
  níveis fecharam** com o valor gravado (raiz, 4 pools e 35 nós). Só que a fórmula é a conta do N.js transcrita, e
  código do jogo não pode ficar no repositório. Tirei as fórmulas da receita do repositório. A versão com fórmulas
  ficou em `scratchpad/proto010/receita-com-formulas.json`. Sem fórmula, abaixo do pool a trava confere a cobertura,
  não a conta.

O que o código não deixou claro:

- As condições `cond && (...)` do fim do `TotalStats` (o `+2`, o `+0.3`, o `×1.2`, o chip, a masmorra, o mapa 216).
  O rastro não as guarda, e foi preciso ler o N.js para declarar a condição de cada constante.
- A precedência do primeiro pool: `1.4 × LUK` não é dividido por 100; o resto da soma é.
- `DropRateLUK` e `DropRateLUK2` são variáveis do código, não sistemas do jogo: as fontes delas vão para os grupos de
  cada sistema.
- As curvas de talento passam a tabela como argumento de `ArbitraryCode5Inputs("decay", x, y, nível)`. A referência
  à tabela só aparece como leitura de texto (`CustomLists.TalentDescriptions[655][1][0]` = "25").
- O `getbonus2(1,328,-1)` pega o melhor personagem: a referência `PlayerDATABASE[1].SkillLevels[328]` que escrevi vale
  para este save, não para outro.
- Os nomes: o catálogo de nomes do njs-index não tem vários (`Companions(168)`, `GetTalentNumber(1,655)`). Tirei-os da
  saída da árvore 0.9, que lê as tabelas de texto do jogo. O nome de `OptionsListAccount[189]` (recorde de boss) está
  marcado "nome a provar", e os sistemas e emojis são escolha minha, a revisar.

## Decisão para o plano

**O gabarito sai limpo no nível da raiz:** pools, fontes e valores saem da gravação em cerca de 2 ms, sem chamar o
jogo, e fecham com erro de 1e-13. A forma que funcionou:

```
Gabarito {
  raiz: "TotalStats(\"Drop_Rarity\",0,0)", final, acumulador: "DNSM.TotStatMAP.Drop_Rarity",
  pools: [{ kind: "Additive" | "Multi", value, depois, passos: [índices], erro,
            termos: [{ kind: "fonte" | "constante", ref, refs, nos, value, peso, via }] }],
  poluicao: { tipo: contagem }
}
```

A chave de uma fonte na trava é (pool, ref, ocorrência). O valor nunca vai para a receita.

O plano precisa resolver:

1. **A regra dos pools:** escritas seguidas do mesmo tipo no acumulador são um pool só. Isso dá 4 pools para o Drop
   Rate, e a 0.9 mostrava 7 itens. Vale para as 289 árvores? Confirmar num número de outra forma (um que substitui o
   valor, como o `Holes2("Cglunko_DR")` do mapa 216).
2. **A fórmula não pode morar na receita.** A receita fica com referências, nomes, grupos e tipos de folha; a conta
   vem da gravação. Abaixo do pool, "cada nível fecha" (SC-001) vira cobertura: os filhos declarados são as partes que
   o jogo gravou. A alternativa é a trava montar a fórmula em tempo de execução a partir dos passos gravados (`Expr`),
   sem guardá-la. A spec precisa dizer qual das duas vale.
3. **As condições `cond && (...)`:** ou o `instrument` passa a marcar o `&&` como checagem, ou a receita declara a
   condição (como aqui) e a trava só confere que a leitura existe.
4. **O termo com duas referências** (talento × recorde, Sushi + Jelly, Mallay × Glunko): aqui é uma fonte com a
   segunda referência como filho. A 0.9 mostrava linhas separadas. Decidir qual é a regra.
5. **Referências que dependem do personagem** (`PlayerDATABASE[1]`, o melhor personagem do `getbonus2`): a receita
   precisa de um padrão (`PlayerDATABASE[*]`) ou de um tipo "Escolha".
6. **As partes que não são folha:** curvas (`ArbitraryCode5Inputs`), `getLOG` e contexto (`Dungon`, mapa atual) na
   lista branca da trava, para a cobertura não reprovar por elas.
7. **A escala:** um número só tem 72 fontes e 4 constantes, e descer à mão 35 nós levou cerca de 40 minutos. Para 289
   números, vale gerar o rascunho da receita a partir do gabarito (pools, fontes, ordem e referências) com os nomes das
   tabelas de texto, e deixar o trabalho à mão para os grupos, os emojis, os tipos de folha e os nomes sem prova.
