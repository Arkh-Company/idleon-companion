# Data Model: Árvores declaradas

As entidades da spec, com os nomes do código entre parênteses. O formato exato dos arquivos está em
[contracts/](contracts/). O nó que a janela recebe é o `TreeNode` da 008 e da 009, sem campo novo
([contracts/tree-worker.md](contracts/tree-worker.md)).

## Onde cada entidade vive

| Entidade | Vive em | Vai ao Git? |
| --- | --- | --- |
| Número do catálogo | `docs/catalogo/numeros.json` (a fonte) e `src/shared/number-catalog.json` (o do app, gerado) | sim |
| Receita (`Blueprint`) | `src/calculator/blueprints/<lote>/<id>.blueprint.json` | sim |
| Tabela de sistemas (`SystemEntry`) | `src/calculator/blueprints/systems.json` | sim |
| Revisão (`Review`): resultado da trava e aprovação | `src/calculator/blueprints/<lote>/<id>.review.json` | sim, sem valores |
| Regra de forma (`ShapeRule`) | `docs/arvores/regras-de-forma.md` (registro) e `src/calculator/declared/shape-rules.ts` (checagens) | sim |
| Gabarito (`AnswerKey`) | memória do worker; `TREES_OUT` na conferência real | nunca |
| Resultado da trava (`LockResult`) | memória; `TREES_OUT/lock/` | nunca, só o resumo na revisão |
| Alerta de fechamento (`ClosureAlert`) | log estruturado do app; `TREES_OUT/alerts.json` | nunca |
| Árvore montada (`CalcTreeNode`) | memória do worker e da janela; `TREES_OUT/trees/` | nunca |
| Imagem da árvore | `TREES_OUT/img/` | nunca |
| Relatório de mudanças (`ChangeReport`) | `TREES_OUT/changes.json` | nunca |

`TREES_OUT` é uma pasta do PC do Vinicius, fora do repositório (a variável vem do `.env.example`, sem valor).

## Número do catálogo (app)

O `CatalogNumber` de `src/shared/tree-catalog.ts` não muda de forma. Muda o conteúdo: os 289 números de destino
`arvore`, com o `id` do catálogo validado (research R18).

| Campo | De onde vem |
| --- | --- |
| `id` | `numeros.json` `id` |
| `name` | `numeros.json` `nome` |
| `group` | `numeros.json` `mundo`: `Personagem` → `Character`, `Conta` → `Account`, `W1`…`W7` iguais |
| `system`, `screen`, `notShown`, `live` | `scripts/catalog/app-fields.json` |

Regra: todo número do catálogo do app tem uma receita, e toda receita tem um número no catálogo (teste de CI).

## Receita (`Blueprint`)

A forma declarada de um número. Só referências, nomes do jogo com prova, tipos de folha e chaves; nunca valor, conta ou
código do jogo (FR-007).

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | string | O id do catálogo; igual ao nome do arquivo |
| `root` | `{ name, nameProof, ref }` | A chamada do jogo sob a raiz (`ref.call`); o nome é o do catálogo |
| `pools` | `BlueprintPool[]` | Na ordem da conta do jogo (FR-002c); nunca vazio |

### Pool (`BlueprintPool`)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `kind` | `"additive"` \| `"multi"` | Dois pools seguidos nunca têm o mesmo `kind` (FR-002c) |
| `weight` | `1` \| `0.01`, opcional | Só no Additive: `0.01` quando o jogo soma em % e divide a soma por 100; o padrão é 1 |
| `groups` | `BlueprintGroup[]` | Na ordem do gabarito (FR-013a) |

O nome na tela é o da 009: "Additive pool", "Multi pool", com número quando há mais de um do mesmo tipo.

### Grupo de sistema (`BlueprintGroup`)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `system` | string | Um id de `systems.json`; nunca "Other" (FR-006) |
| `sources` | `BlueprintNode[]` | Pelo menos uma; na ordem do gabarito |

Regras:
- O grupo aparece mesmo com uma fonte só ou com contribuição 0 (FR-014).
- Um grupo some só quando todas as fontes dele são de outras classes (FR-002a).
- As fontes de um grupo têm o mesmo peso; um grupo com pesos misturados é recusado pela checagem de receita.

### Nó (`BlueprintNode`): fonte, constante, filho e folha

O mesmo tipo serve para a fonte de um pool, a constante solta, o filho e a folha.

| Campo | Tipo | Regra |
| --- | --- | --- |
| `key` | string (slug) | Única entre os irmãos; forma o id do nó (research R12) |
| `name` | string | Texto do jogo, em inglês (FR-004, FR-018); nunca "no name yet" nem "Game value" |
| `nameProof` | `{ table, row }` ou `{ names }` | Onde o nome está no texto do jogo: tabela e linha, ou a chave da tabela de nomes; nunca a citação |
| `ref` | `Ref` | Obrigatório, menos numa constante |
| `constant` | number, opcional | Só numa constante solta de pool (o `+ 2`, o `× 1.2`); sem `ref`; folha `fixedValue` |
| `weight` | number, opcional | Só numa fonte de Additive, quando difere do pool (a curva da LUK entra com peso 1 num pool de 0.01) |
| `classes` | number[], opcional | Só numa fonte: os ids de classe do jogo que podem ter a fonte (FR-002a); ausente = todas |
| `condition` | `BlueprintNode`, opcional | O que liga ou desliga o nó sem entrar na conta (`cond && (...)`, research R3); folha `condition` |
| `termPart` | `{ system }`, opcional | Só num filho: a segunda fonte de um termo de duas fontes (FR-002b), com o sistema dela |
| `children` | `BlueprintNode[]`, opcional | Os filhos até a folha; sem filhos, o nó é folha |
| `leaf` | `LeafKind`, obrigatório sem `children` | Um dos 9 (abaixo); proibido com `children` |
| `conditionKind` | `ConditionKind`, opcional | Só com `leaf: "condition"`: `owned`, `done`, `active`, `equalsValue`, `max`, `limit` (contrato da 008) |

Tipos de folha (`LeafKind`, os da 008 sem o `unknown`): `level` (Level), `quantity` (Quantidade), `fixedValue` (Valor
fixo), `rawBonus` (Bônus cru), `condition` (Condição), `choice` (Escolha), `tier` (Tier), `record` (Recorde),
`investedPoints` (Pontos investidos). Galho, progresso e contexto não são folha (FR-005).

### Referência (`Ref`)

| Forma | Exemplo | Uso |
| --- | --- | --- |
| `{ call, args }` | `{ "call": "GetTalentNumber", "args": [1, 655] }` | Uma chamada de bloco do jogo, com o modo e os argumentos como o jogo os passa ("0" texto não é 0) |
| `{ read }` | `{ "read": "OptionsListAccount[189]" }` | Um caminho lido do estado ou de uma tabela do jogo (tabela e linha) |

Regras (FR-003, research R5):
- Nunca uma expressão: um `read` é um caminho de nomes e índices; um `call` é um nome de bloco e átomos.
- `{character}` no lugar do índice do personagem da árvore; `*` para qualquer personagem (o melhor, ou a soma).
- Nenhum índice de personagem escrito por extenso.

### Chave da referência (`refKey`)

A chave que liga um nó da receita a um termo do gabarito e a um nó da gravação, a mesma do protótipo: `Bloco(args)` com
os argumentos em JSON, ou o caminho. Ela só existe em memória; a receita guarda o `Ref` estruturado.

## Pedaço de receita (`BlueprintPiece`)

Uma parte que se repete em várias receitas (Star Signs de um stat, o LUK, Alchemy…), escrita uma vez em
`src/calculator/blueprints/pieces/<id>.piece.json` e chamada pelas receitas (Open Questions, 23/11).

| Campo | Tipo | Regra |
|---|---|---|
| `id` | texto | Igual ao nome do arquivo; único entre os pedaços |
| `params` | texto[] | Nomes sem repetir, nunca `character`; usados como `{nome}` nas referências |
| `combine` | `sum` ou `product` | Como os filhos se juntam; obrigatório em todo nó com filhos dentro do pedaço, menos num nível de chamada que fecha pela própria conta gravada (o Seraph) |
| `each` | `{ list, as }` | Opcional: um filho por item da lista gravada; `list` é um caminho com um `[*]` (nunca o índice do personagem), `as` é um nome (nunca `character`) |
| `children` | nós de receita | Os filhos, com `{param}` e `[{as}]` nas referências |

No `BlueprintNode`, `piece: { name, args }` fica no lugar de `children`, `leaf`, `combine` e `each`. A carga preenche os
parâmetros e passa cada caminho pelas checagens do ref; recusa parâmetro que falta ou sobra, pedaço que não existe, pedaço
que chama a si mesmo, id repetido e `{nome}` não declarado. A linha que chama o pedaço pega o valor da sua referência e
fecha pela conta dos filhos sobre as folhas gravadas, ligadas pelo lugar; reprova com `notClosing`, `childNoValue` ou
`leafHasChildren`, nunca com `openingRefused`; um nível de chamada sem `combine` (o Seraph) fecha pela própria conta
gravada e reprova também pelos erros de cobertura dessa conta (`undeclaredPart`, `childOutside`, `conditionMismatch`).

**Pedaço com forma de receita** (Open Questions, 23/11): um pedaço pode ter `pools` no lugar de `combine`, `each` e
`children`, com as regras dos pools da receita (lugares `<nó>/pools/<n>/groups/<g>/sources/<s>`); `pools` só dentro de um
pedaço, e `combine` só é obrigatório sem `pools`. A receita de outro número serve de pedaço sem parâmetros, pelo id; um
id igual entre pedaço e receita é recusado. Uma fonte de pool com `each` e sem `combine` vai sem `ref` nem `constant`,
com um filho-modelo, repetido por parcela do gabarito que casa com o `[*]` (o item é o índice do caminho; um item em duas
parcelas é `rootForm` na fonte). O pedaço com `pools` fecha pelo gabarito da chamada da linha ou do autor do cache e
reprova como a raiz: `poolOrder` na linha; `missingSource`, `extraSource`, `groupOrder` e `notClosing` em
`<linha>/pool:<n>`; `rootForm` na linha sem gabarito. No gabarito, uma corrente somada num laço tem uma parcela por volta,
cada uma lida no seu lugar gravado; uma volta sem passo no seu lugar recusa com o motivo. Numa fonte de pool, `each.as` pode
ser uma lista de nomes, um por `[*]` (dois índices, como `EquipmentMap[*][*]`); o filho-modelo sem `ref` é folha `fixedValue`
(a base fixa escolhida por teste, T176) ou `choice` (o item cuja chave leu a tabela do jogo, T179).

## Tabela de sistemas (`SystemEntry`)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `id` | string | Único; o que a receita cita |
| `name` | string | Em inglês, o nome do sistema no jogo |
| `emoji` | string | Um por sistema; o grupo mostra "emoji nome" |
| `proof` | string | Onde o sistema está no jogo (bloco, tela ou tabela), por referência |

Semeada pela tabela da 009 (`tree/systems.ts`, a ordem e os emojis da V1), sem a entrada "Other".

## Gabarito (`AnswerKey`)

O que a gravação entrega de um número (FR-008). Só em memória ou em `TREES_OUT`.

| Campo | Tipo | Regra |
| --- | --- | --- |
| `root` | string | A `refKey` da chamada raiz |
| `final` | number | O valor final gravado |
| `form` | `"chain"` \| `"expression"` | A forma da raiz (research R1); outra forma falha com o motivo |
| `accumulator` | string \| null | O caminho escrito na forma `chain` |
| `pools` | `AnswerPool[]` | Escritas seguidas do mesmo tipo juntadas |
| `pollution` | `{ [tipo]: contagem }` | O que o rastro tinha e o gabarito ignorou ou atravessou |

`AnswerPool`: `kind`, `value` (no primeiro, o valor; nos outros, o que soma ou o fator), `after` (o acumulador depois),
`steps` (os índices dos passos), `error` (a diferença relativa entre as partes e o valor) e `terms`.

`AnswerTerm`: `kind` (`"source"` \| `"constant"`), `ref` (a `refKey` principal), `refs` (todas, na ordem do código),
`nodes` (o nó gravado de cada uma, null numa leitura), `value`, `weight` e `via` (as variáveis de passagem atravessadas).

A chave de uma fonte na trava é (índice do pool, `ref`, ocorrência no pool).

## Resultado da trava (`LockResult`)

| Campo | Tipo | Regra |
| --- | --- | --- |
| `ok` | boolean | Só no modo `check`: verdadeiro sem nenhum erro |
| `errors` | `LockError[]` | Cada um com `kind`, `where` (o id do nó ou `pool:<n>`) e, quando cabe, `expected` e `got` |
| `counts` | objeto | Níveis fechados, níveis fechados pelo valor gravado (research R6), folhas, nós com filhos |

`LockError.kind`: `poolOrder`, `missingSource`, `extraSource`, `groupOrder`, `sourceOrder`, `notClosing`,
`undeclaredPart`, `childOutside`, `childNoValue`, `conditionMismatch`, `leafType`, `pending`, `classMismatch`,
`rootForm`, `leafHasChildren` (Open Questions, 22/11), `openingRefused` (a abertura de um nível recusada:
o cache sem autor, com mais de um autor ou somado em voltas, as voltas que não se separam pelo lugar; 23/11), `characterWritten` (um argumento de chamada que, pelo código no
lugar da chamada, é o índice do personagem atual, escrito por extenso em vez de `{character}`; research R5; 23/11).

Os textos de reprovação (US2) são montados desses campos: "fonte que falta: <ref> (pool 1 Additive)", "ordem dos
pools errada: a ordem esperada é …", "nível não fecha: <nível>: as partes dão X, o valor gravado é Y", "folha com filhos na gravação: <folha>: o primeiro é
<filho>".

## Alerta de fechamento (`ClosureAlert`)

O resultado do modo `runtime` (research R16).

| Campo | Tipo | Regra |
| --- | --- | --- |
| `level` | string | `root`, `pool:<n>` ou o id do nó |
| `kind` | `"notClosing"` \| `"missingInGame"` \| `"extraInGame"` \| `"poolOrder"` | — |
| `diff` | number \| string | A diferença relativa num `notClosing`; a `refKey` da fonte num `missingInGame` ou `extraInGame`; a ordem do jogo num `poolOrder` |

No log do app: `{ event: "treeNotClosing", id, level, kind, diff }`. Nunca nome de personagem nem código do jogo.

## Revisão (`Review`)

Uma por receita, ao lado dela. Formato em [contracts/review.md](contracts/review.md).

| Campo | Tipo | Regra |
| --- | --- | --- |
| `blueprintSha` | string | sha256 da receita canônica que a revisão viu |
| `lock` | `{ ok, gameSha, at }` \| null | A última trava sobre o jogo real; `gameSha` é o sha256 do `N.js` |
| `verdict` | `"approved"` \| `"fix"` \| null | A resposta do Vinicius na galeria |
| `note` | string \| null | Só com `fix`; até 2.000 caracteres; sem nome de personagem |
| `history` | `{ at, verdict, note, blueprintSha }[]` | As respostas anteriores, para a FR-025 |

## Estados de uma receita

```text
esboço ──▶ rascunho ──▶ escrita ──▶ trava ok ──▶ aprovada
 (raiz)    (gerada)     (sem         │  ▲          │
                         pendência)  ▼  │          ▼
                                trava falha    corrigir + nota ──▶ (muda a receita ou uma regra) ──▶ trava de novo
```

- **Esboço:** só `id` e `root`; é o que a sonda das raízes lê (Fase 2).
- **Rascunho:** o que o gerador escreve, com pendências.
- **Escrita:** sem pendência; ainda não passou na trava.
- **Trava ok:** `review.lock.ok` sobre o `blueprintSha` atual; só aí a árvore ganha cartão na galeria (FR-011).
- **Aprovada:** `review.verdict === "approved"` sobre o `blueprintSha` atual. Qualquer mudança na receita derruba os
  dois: o hash muda, e a árvore volta à trava e à galeria (FR-025).

## Regra de forma (`ShapeRule`)

| Campo | Onde | Regra |
| --- | --- | --- |
| número | registro e código | `R01`, `R02`…; nunca reaproveitado |
| frase, exemplo | registro | Em português |
| checagem | código | Uma função; `scope: "blueprint"` (roda no CI) ou `"tree"` (roda na conferência real) |
| estado | registro | `vale`, ou `substituída por Rnn` (continua no registro, sem checagem ativa) |
| tensão | código | Os números das regras que puxam no sentido contrário (research R13) |

Resultado de uma rodada: por regra, as árvores que passam e as que falham, e a lista de conflitos
`{ tree, node, rules: [Rxx, Ryy] }`.

## Relatório de mudanças (`ChangeReport`)

O que uma mudança de receita ou de regra mudou nas árvores, comparando a rodada nova com a anterior pelo id do nó
(FR-022, FR-024b).

| Campo | Regra |
| --- | --- |
| `cause` | A receita ou a regra que mudou, quando a rodada sabe; senão "rodada" |
| `trees` | Quantas árvores mudaram |
| `byKind` | Contagem por tipo: `name`, `added`, `removed`, `value` |
| `perTree` | Por árvore, a lista das mudanças, cada uma com o tipo e o id do nó |

## Arquivos salvos do jogador

`marks.json`, `pins.json` e `tree-shapes.json` passam à versão 2. A forma de dentro é a da 008; mudam os ids e as
chaves, que seguem as receitas. A versão 1 é apagada na primeira abertura
([contracts/saved-files.md](contracts/saved-files.md)).
