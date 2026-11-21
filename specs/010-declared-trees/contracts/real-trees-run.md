# Contrato: a conferência real (`just trees`) e o rascunho (`just draft`)

As duas rodam só no PC do Vinicius, fora da CI (FR-026), num processo só (NFR-003). As duas são o mesmo arquivo de teste
de integração, `src/calculator/declared/real-trees.integration.test.ts`, que se pula sozinho sem as variáveis abaixo, como
o `just parity`. As receitas do `justfile` são novas e mudam o portão de pronto: entram só com o sim do Vinicius.

## Variáveis (`.env.example`, sem valor)

| Variável | O que é |
| --- | --- |
| `TREES_GAME_DIR` | A pasta `distBuild/static/game` do jogo instalado, fora do `app.asar` (`N.js` e `lib/default.pak`) |
| `TREES_SNAPSHOT` | O retrato (`attrs` e `skipped`), num arquivo sem nome de personagem, com o `vars-*.json` ao lado |
| `TREES_OUT` | A pasta de saída, fora do repositório |
| `TREES_TARGET` | Posta pela receita do `just`: um id, um lote (`w1` … `w7`, `character`, `account`), `roots` ou `all` |
| `TREES_MODE` | Posta pela receita do `just`: `check`, `draft` ou `roots` |

## Receitas

| Receita | Modo | O que faz |
| --- | --- | --- |
| `just trees <alvo>` | `check` | Para cada número do alvo, na ordem do catálogo: grava, extrai o gabarito, roda a trava no modo `check`, monta a árvore inteira aberta, roda as checagens de árvore e as de receita. Nos números com fonte de classe, repete com um personagem de cada classe do retrato |
| `just draft <alvo>` | `draft` | Para cada número do alvo sem receita escrita: grava, extrai o gabarito e escreve o rascunho da receita (research R7) |
| `just trees roots` | `roots` | A sonda das raízes: só grava a raiz de cada uma das 289 receitas-esboço e classifica a forma (research R1) |

O vitest roda com `--pool=threads` e um arquivo só. O gravador sobe uma vez, e os números passam em série. Nunca duas
rodadas ao mesmo tempo, nunca em laço.

## Saídas

Tudo em `TREES_OUT`, nunca no repositório, menos o que a última linha da tabela diz.

| Caminho | Conteúdo |
| --- | --- |
| `trees/<id>.json` | A árvore montada inteira, aberta até as folhas (`CalcTreeNode`), com os valores do retrato; entrada da galeria |
| `previous/trees/<id>.json` | A árvore da rodada anterior, para o relatório de mudanças |
| `lock/<id>.json` | O `LockResult` inteiro: erros com nível, valor declarado e valor do jogo |
| `alerts.json` | Os alertas do modo `runtime` de cada árvore, os mesmos que o app grava no log (SC-006) |
| `rules.json` e `rules.md` | Por regra de forma, as árvores que passam e as que falham; a lista de conflitos `{ tree, node, rules }` (FR-021) |
| `changes.json` | O relatório de mudanças contra a rodada anterior, por tipo: `name`, `added`, `removed`, `value` (FR-022) |
| `roots.json` | Só no modo `roots`: a forma de cada raiz e o motivo das que ficaram fora da regra |
| `draft/<id>.steps.txt` | Só no modo `draft`: os passos gravados de cada fonte, o guia de quem escreve a receita |
| `summary.txt` | Uma linha por número: passou ou reprovou, com o primeiro motivo; o tempo de cada etapa e o pico de memória |
| **no repositório:** `<id>.review.json` | Só `blueprintSha` e `lock` (`ok`, `gameSha`, `at`); no modo `draft`, o `<id>.blueprint.json` do rascunho |

## Privacidade

- Nenhum nome de personagem em nenhuma saída: a gravação já troca o nome pelo índice, e o `summary.txt` só leva ids.
- Os `.steps.txt` e o `lock/` trazem a conta gravada: ficam só em `TREES_OUT`.
- O teste não usa rede.

## Uso pelos agentes de receita

Os agentes leem `lock/`, `rules.md` e `draft/` e escrevem receitas; nenhum deles roda a conferência real. A sessão roda
uma rodada por vez, depois que os agentes de um lote param, e passa o resultado a eles.
