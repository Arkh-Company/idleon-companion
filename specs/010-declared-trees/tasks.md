# Tasks: Árvores declaradas

**Input**: Design documents from `specs/010-declared-trees/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md, prototipo/README.md

**Tests**: Tests are mandatory. Cada fase escreve os testes primeiro, e eles falham antes de o código existir. Os testes
de CI usam o jogo inventado (`src/calculator/fixtures/fake-game.js`, `fake-mosaic.ts`) e receitas inventadas em
`src/calculator/fixtures/blueprints/`. As conferências sobre o jogo real (a sonda das raízes, a trava das 289, a galeria e
as imagens) rodam só no PC do Vinicius, fora da CI, pelas receitas `just trees`, `just draft` e `just gallery`: são
tarefas `[sessão]`, uma rodada por vez, nunca em laço.

**Testes, um processo por vez (NFR-003)**: só `just test-one <arquivo>`, `just test` ou
`pnpm exec vitest run --pool=threads <alvo>`; nunca dois processos de teste ao mesmo tempo. O PC dá tela azul.

**Nada no Git (FR-007, NFR-004)**: nenhum código do jogo, gravação, gabarito, árvore montada, imagem, conta remontada ou
nome de personagem. Receitas e revisões só com referências, texto do jogo, hashes e vereditos; o resto vai para
`TREES_OUT`, fora do repositório.

**Organization**: Done gate, Setup e Fundação; depois uma fase por história, na ordem do plano: o piloto do Drop Rate
(US2, a trava; US1, a montagem), a galeria (US3), as regras de forma (US4), os lotes W1 → W7, Personagem e Conta (US1 a US3
em escala), o alerta (US5), a troca na tela (US1), os arquivos salvos (US6) e o Polish, que tira `src/calculator/tree/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: pode rodar em paralelo (arquivos diferentes, sem dependência).
- **[Story]**: a história da spec (US1 … US6).
- **[sessão]**: logo depois do ID. A sessão aplica a tarefa, não o Executor: um arquivo do portão de pronto (Fase 0), ou
  uma rodada sobre o jogo real no PC do Vinicius.
- **Parada:** a fase para ali até a resposta do Vinicius.

---

## Phase 0: Done gate

**Purpose**: as mudanças no portão de pronto que as fases seguintes usam. A sessão aplica cada uma com o sim do Vinicius
para cada edição (AGENTS.md) e faz o commit antes da Fase 1. Cada mudança funciona antes de o código existir.

**Independent Test**: com as três mudanças e sem nenhum arquivo de `declared/`, `just check` passa; `just trees roots`
termina sem teste e sem erro (`--passWithNoTests`); `just --list` mostra `trees`, `draft` e `gallery` e não mostra mais
`parity`.

- [X] T001 [sessão] Receitas `trees`, `draft` e `gallery` no `justfile`, e a receita `parity` sai (contracts/real-trees-run.md, contracts/gallery.md; FR-026, NFR-003)
  - Files: `justfile`
  - Signatures:
    - `trees target`: `pnpm exec vitest run --pool=threads --dir src --passWithNoTests src/calculator/declared/real-trees.integration.test.ts`, com `TREES_TARGET` = o alvo e `TREES_MODE` = `roots` quando o alvo é `roots`, senão `check`;
    - `draft target`: o mesmo arquivo, com `TREES_MODE=draft`;
    - `gallery lot`: monta a ferramenta (`pnpm exec vite build --config scripts/gallery/vite.config.ts`) e roda `pnpm exec electron` sobre `TREES_OUT/gallery-app/main.js <lote>`.
  - Regras:
    - o alvo e o lote passam por uma regex no `justfile`, como o `github`: id do catálogo (`[a-z0-9-]`, até 80), `w1` … `w7`, `character`, `account`, `all`, `roots` e, só na galeria, `pilot`; qualquer outro texto é recusado com erro;
    - `TREES_GAME_DIR`, `TREES_SNAPSHOT` e `TREES_OUT` vêm do ambiente do terminal, como o `PARITY_*` de hoje; o `just` não lê `.env`;
    - um comentário diz: um processo só, nunca duas rodadas juntas, nunca em laço; fora do `check` e da CI;
    - a receita `parity` sai: a paridade com a bancada não é usada na 010, e o `parity.integration.test.ts` continua no `just test` (se pula sem as variáveis) até sair com o código dele na Fase 11.
  - Cases: `just check` passa; `just trees roots` sem o arquivo de teste passa sem teste; `just trees "x; rm"` é recusado pela regex.
- [X] T002 [sessão] Regra `declared-not-guessed` no `.dependency-cruiser.cjs` (research R17; FR-009, FR-027)
  - Files: `.dependency-cruiser.cjs`
  - Signatures: a regra `declared-not-guessed` (`name`, `comment`, `severity`, `from`, `to`) na lista `forbidden`
  - Regra: de `^src/calculator/(declared|recorded|names)/` para `^src/calculator/(tree/|tree-build\.ts$|tree-roots\.ts$|root-calls\.json$|parity)`, `severity: "error"`, testes incluídos.
  - Por quê: o motor novo não cresce sobre a forma adivinhada, e `recorded/` e `names/` (que ficam depois da Fase 11) não podem depender do que sai.
  - Cases: `just arch` passa hoje (as três pastas ainda não existem); um import de `tree/` dentro de `declared/` faz o `just arch` falhar.
- [X] T003 [sessão] Configuração de montagem da galeria em `scripts/gallery/vite.config.ts` (contracts/gallery.md; FR-023, FR-024, NFR-004)
  - Files: `scripts/gallery/vite.config.ts` (`vite.config.*` em qualquer pasta é portão)
  - Signatures: `export default defineConfig(...)` com as quatro entradas e `build.outDir` em `TREES_OUT/gallery-app/`
  - Monta o main da ferramenta (Node), o preload (CommonJS, para `sandbox`) e as duas páginas (`tree-page.html`, `gallery-page.html`) em `TREES_OUT/gallery-app/`; recusa montar sem `TREES_OUT`; nenhum plugin que use a rede; os caminhos das entradas são texto, então o `tsc` e o `eslint` passam antes de os arquivos existirem.
  - Cases: `just check` passa sem nenhum outro arquivo em `scripts/gallery/`.

**Checkpoint**: `just check` passa; a Fase 0 tem o seu commit antes da Fase 1.

Verify: `just check` - passa; `just trees roots` - "No test files found", saída 0.

---

## Phase 1: Setup (caracterizar e mover o que fica)

**Purpose**: fixar a saída das peças que sobrevivem à feature e mudá-las de lugar sem mudar comportamento; preparar as
variáveis e o scan. A árvore da 0.9 segue igual.

**Independent Test**: os testes de caracterização passam antes e depois da mudança de pasta, sem nenhuma alteração; a
suíte inteira da 009 passa sem mudança de caso; `just arch` passa com `recorded/` e `names/` sem importar `tree/`.

- [X] T004 [P] Testes de caracterização das peças que ficam, em `src/calculator/kept-pieces.test.ts` (research R17)
  - Files: `src/calculator/kept-pieces.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases, sobre gravações do jogo inventado (`fake-game.js`, `fake-mosaic.ts`):
    - os passos de `makeSteps` de três blocos (uma corrente, uma expressão, um laço), em forma de dado: `Step.v`, o tipo de cada `Expr` e os caminhos lidos;
    - os nomes lidos das tabelas de texto (`readGameNames`, `useGameTables`, `tableText`, `nameOf`) de cinco códigos;
    - a classe dos talentos nos nomes (`clean` / `CLASS_OF` de `name-text.ts`: as marcas `~R`, `~G`, `~P`);
    - os imports apontam para os caminhos de hoje; a T005 e a T006 só trocam os caminhos.
- [X] T005 Mover `tree/steps.ts`, `tree/ast.ts` e `tree/math.ts` para `src/calculator/recorded/`, com os testes deles (research R17; depende de T004)
  - Files: `src/calculator/recorded/steps.ts`, `ast.ts`, `math.ts`, `steps.test.ts`, `math.test.ts`; os imports em `src/calculator/tree/*.ts`, `tree-build.ts` e `kept-pieces.test.ts`
  - Signatures: nenhuma muda (`makeSteps(rec: Recording, ops: readonly Op[])`, `Expr`, `Step`, `Check`, `near`).
  - Cases: `kept-pieces.test.ts` e os testes movidos passam sem mudança de caso; `recorded/` não importa nada de `tree/`.
- [X] T006 Mover os nomes para `src/calculator/names/` (research R17; depende de T004)
  - Files: `tree/names.ts`, `names-table.ts`, `table-names.ts`, `name-text.ts`, os JSON de nomes (`names-recipes.json`, `names-static.json`, `state-hashes.json`) e o fecho do que eles importam de `tree/` (hoje `renames.ts`, `rename-list.ts`, `state-names.ts`, `state-words.ts`, `merit-names.ts`, `killroy-names.ts`), com os testes; `src/calculator/game-names.ts` passa a importar de `names/`.
  - Signatures: nenhuma muda (`useGameNames`, `nameOf`, `resolveNames`, `useGameTables`, `tableText`, `isNameText`, `NAME_RECIPES`).
  - Cases: `kept-pieces.test.ts`, `game-names.test.ts`, `catalog-names.test.ts` e os testes movidos passam sem mudança de caso; `names/` não importa nada de `tree/` (`just arch`); cada arquivo segue abaixo de 400 linhas.
- [X] T007 [P] Testes da tabela de sistemas em `src/calculator/declared/systems.test.ts` (FR-006; data-model "Tabela de sistemas")
  - Files: `src/calculator/declared/systems.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - todo `id` é único e é um slug; todo `emoji` é único;
    - todo `name` passa no `isNameText` e está em inglês (FR-018);
    - todo `proof` é referência (bloco, tela ou tabela), sem aspas nem código (o mesmo crivo do `no-game-text.test.ts`);
    - nenhuma entrada "Other";
    - a ordem e os emojis da V1 (`V1_SYSTEMS` de hoje) são os mesmos;
    - `systemById("talents")` dá nome e emoji; um id desconhecido dá `null`.
- [X] T008 A tabela de sistemas vira `src/calculator/blueprints/systems.json`, lida por `src/calculator/declared/systems.ts` (research R8; depende de T007)
  - Files: `src/calculator/blueprints/systems.json`, `src/calculator/declared/systems.ts`, `src/calculator/tree/systems.ts` (passa a ler nome e emoji do JSON; o "Other" fica só nele, para a árvore antiga)
  - Signatures: `interface SystemEntry { id: string; name: string; emoji: string; proof: string }`; `SYSTEMS: readonly SystemEntry[]`; `systemById(id: string): SystemEntry | null`; `systemLabel(e: SystemEntry): string` ("🎯 Talents").
  - Semeada por `V1_SYSTEMS` e `EXTRA_SYSTEMS`, sem "Other". `tree/systems.test.ts` passa sem mudança de caso.
  - Cases: os da T007; `src/calculator/tree/systems.test.ts` passa sem mudança de caso.
- [X] T009 [P] O `no-game-text.test.ts` passa a varrer `specs/010-declared-trees` (contracts/blueprint.md; FR-003, FR-007)
  - Files: `src/main/no-game-text.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: `FOLDERS` ganha `specs/010-declared-trees`; as receitas em `src/calculator/blueprints/` já entram pelo `src`; um `proof` com aspas dentro de uma receita inventada de teste é acusado.
  - Se o protótipo congelado (`prototipo/`) falhar no scan, a falha vai ao Vinicius antes de qualquer exceção: a spec está congelada e não se edita.
- [X] T010 [P] `.env.example` ganha `TREES_GAME_DIR`, `TREES_SNAPSHOT` e `TREES_OUT`, sem valor (contracts/real-trees-run.md)
  - Files: `.env.example`
  - Signatures: nenhuma (configuração)
  - Um comentário por variável, como o `PARITY_*`: o que é, que o `just` não lê o arquivo, e que `TREES_OUT` fica fora do repositório. `TREES_TARGET` e `TREES_MODE` não entram: a receita os põe.
  - Cases: o `just setup` copia o arquivo sem erro; nenhuma das três variáveis tem valor; o `just secrets` passa.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/kept-pieces.test.ts` - passa; `just test-one src/calculator/declared/systems.test.ts` - passa; `just check` - passa.

---

## Phase 2: Foundational (receita, gabarito, revisão e a sonda das raízes)

**Purpose**: o formato da receita com a conferência na carga, as referências, o avaliador sem `eval`, o gabarito, a lista
das partes que não são folha, a revisão, os 289 esboços e a sonda das raízes no jogo real.

**⚠️ CRITICAL**: nenhuma história começa antes desta fase, e a fase só fecha com a decisão do Vinicius sobre as raízes
fora da regra.

**Independent Test**: no jogo inventado, o gabarito de uma raiz em corrente, de uma raiz em expressão e de uma raiz que
troca o acumulador sai certo ou recusado com o motivo; as 289 receitas-esboço carregam, uma por número `arvore`; no PC do
Vinicius, `just trees roots` escreve `TREES_OUT/roots.json` com a forma de cada raiz.

- [X] T011 [P] Testes das referências em `src/calculator/declared/refs.test.ts` (FR-003; research R5, R12)
  - Files: `src/calculator/declared/refs.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - `refKey({ call: "GetTalentNumber", args: [1, 655] }, 0)` → `GetTalentNumber(1,655)` na forma do protótipo; `"0"` texto e `0` número dão chaves diferentes;
    - `{ read: "PlayerDATABASE[{character}].SkillLevels[328]" }` com o personagem 3 → o caminho com `[3]`;
    - `*` casa a primeira leitura gravada de qualquer personagem e conta quantas casaram; nenhuma leitura → `null`, nunca 0;
    - `pieceKeyOf` de uma chamada = `JSON.stringify([personagem, bloco, ...args])`, igual à 008; de uma leitura = `JSON.stringify([personagem, caminho])`;
    - `nodeId("stats-drop-rate", 0, "talents", ["boss-battle-spillover", "talent-points"])` → `stats-drop-rate/0/talents/boss-battle-spillover/talent-points`;
    - `hasRawCharacterIndex("PlayerDATABASE[1].SkillLevels[3]")` é verdadeiro; com `{character}` ou `*` é falso;
    - `isPathRead` recusa operador, parêntese, aspas e espaço.
- [X] T012 As referências em `src/calculator/declared/refs.ts` (depende de T011)
  - Files: `src/calculator/declared/refs.ts`
  - Signatures: `type Ref = { call: string; args: readonly (string | number)[] } | { read: string }`; `refKey(ref: Ref, character: number): string`; `matchRead(pattern: string, recorded: readonly string[], character: number): { path: string; matches: number } | null`; `pieceKeyOf(ref: Ref, character: number): string`; `nodeId(numberId: string, pool: number, system: string, keys: readonly string[]): string`; `hasRawCharacterIndex(read: string): boolean`; `isPathRead(read: string): boolean`.
  - Cases: os da T011, que esta tarefa faz passar.
- [X] T013 [P] Testes da receita e da conferência na carga em `src/calculator/declared/blueprint.test.ts` (FR-002, FR-002a–c, FR-003–FR-007, FR-018; contracts/blueprint.md)
  - Files: `src/calculator/declared/blueprint.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases, cada regra da conferência com um caso que passa e um que é recusado com o motivo:
    - `id` diferente do nome do arquivo; `pools` vazio; dois pools seguidos do mesmo `kind`;
    - `system` fora de `systems.json`; "Other" recusado;
    - `key` fora do slug ou repetida entre irmãos;
    - `name` vazio, "no name yet" ou "Game value" (o `nameProof` é opcional: spec, Open Questions, 21/11);
    - `ref` e `constant` juntos, ou nenhum dos dois;
    - `leaf` com `children`, ou sem os dois; `leaf` fora dos 9 tipos (o `unknown` da 008 é recusado);
    - `conditionKind` sem `leaf: "condition"`; `classes` ou `weight` fora de fonte de pool; `termPart` fora de filho;
    - `ref.read` com operador ou índice de personagem por extenso; `ref.args` com objeto;
    - chave fora das listadas;
    - os estágios: só `id` e `root` → `sketch`; com `pending` (lista `{ where, kind: "name" | "system" | "leaf" | "descend" }`) e `name: null` só onde a pendência diz → `draft`; a forma inteira sem `pending` → `complete`;
    - um grupo com pesos misturados é recusado.
- [X] T014 A receita em `src/calculator/declared/blueprint.ts` (depende de T012, T013)
  - Files: `src/calculator/declared/blueprint.ts`
  - Signatures: `Blueprint`, `BlueprintPool`, `BlueprintGroup`, `BlueprintNode`, `LeafKind` (os 9), `ConditionKind` (os da 008); `parseBlueprint(raw: unknown, ctx: { fileId: string; systemIds: ReadonlySet<string> }): { ok: true; stage: "sketch" | "draft" | "complete"; blueprint: Blueprint } | { ok: false; reason: string }`.
  - A calculadora não importa `src/shared/` (`calculator-alone`): a conferência de que o id está no catálogo fica no teste de CI (T023, T124), não na carga.
  - O campo `pending` dos rascunhos completa o contrato (contracts/blueprint.md lista as chaves da receita completa; o rascunho do research R7 precisa de onde guardar as pendências).
  - Cases: os da T013, que esta tarefa faz passar.
- [X] T015 [P] Testes do avaliador em `src/calculator/declared/expr-eval.test.ts` (FR-010; research R2)
  - Files: `src/calculator/declared/expr-eval.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: soma, produto, divisão, potência e menos unário sobre um `Expr` gravado; as funções de `Math` que o `makeSteps` grava (`min`, `max`, `floor`, `ceil`, `pow`, `log`); uma referência trocada pelo valor do filho; uma referência sem valor → `null`; um operador desconhecido → `null`, nunca uma exceção; divisão por zero → `null`; nenhum `eval` nem `Function` (o teste lê o arquivo e procura os dois).
- [X] T016 O avaliador em `src/calculator/declared/expr-eval.ts` (depende de T015)
  - Files: `src/calculator/declared/expr-eval.ts`
  - Signature: `evalExpr(e: Expr, valueOf: (e: Expr) => number | undefined): number | null` (`Expr` de `recorded/steps.ts`).
  - Cases: os da T015, que esta tarefa faz passar.
- [X] T017 [P] Blocos novos no jogo inventado e receitas inventadas para eles (lição 4 da 009; depende de T013)
  - Files: `src/calculator/fixtures/fake-game.js`, `src/calculator/fixtures/blueprints/*.blueprint.json`, `src/calculator/fixtures/recording-fixture.ts` (gravação feita à mão; não importa `tree/tree-fixture.ts`, que sai na Fase 11)
  - Signatures: `recordingOf(nodes, writes): Recording` em `recording-fixture.ts`; os blocos `Blocks._customBlock_<Nome>` do jogo inventado
  - Blocos, cada um conferido com a conta real no N.js (njs-index) antes de virar fixture, com linhas curtas (o scan da T009):
    - uma raiz em corrente com acumulador sem nome, variável de passagem, contadores de rascunho, soma dividida por 100, constantes soltas e `cond && (...)` (o `_customBlock_TreeDrop` de hoje serve de base);
    - uma raiz em expressão (soma, depois produto);
    - uma raiz que troca o valor do acumulador (fora da regra);
    - um termo de duas fontes (talento × recorde);
    - uma curva (`decay`) com argumentos que casam um a um, e outra com dois argumentos do mesmo valor;
    - uma leitura do melhor personagem (`*`) e uma do personagem da árvore (`{character}`);
    - uma fonte que só uma classe tem;
    - uma fonte declarada que a gravação não usa.
  - Cases: cada bloco roda no gravador do jogo inventado sem erro; cada receita inventada carrega no `parseBlueprint` no estágio `complete`; o scan da T009 passa sobre o `fake-game.js`.
- [X] T018 Testes do gabarito em `src/calculator/declared/answer-key.test.ts` (FR-002c, FR-008, FR-009; research R1, R9; depende de T017)
  - Files: `src/calculator/declared/answer-key.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - a corrente do bloco de forma Drop Rate dá Additive → Multi → Additive → Multi, com escritas seguidas do mesmo tipo num pool só;
    - cada pool fecha com o valor gravado (erro relativo ≤ 1e-6) e a corrente dá o `final`;
    - a raiz em expressão dá os pools pelo operador de cima (`form: "expression"`);
    - a raiz que troca o acumulador é recusada com `rootForm` e o motivo "forma de raiz fora da regra dos pools";
    - as escritas de rascunho são ignoradas, o acumulador sem nome é achado pelo valor, as variáveis de passagem são atravessadas (`via`);
    - a soma dividida por 100 dá peso 0.01 aos termos;
    - uma constante solta vira termo `constant`; o termo de duas fontes tem `refs` na ordem do código;
    - `pollution` conta cada tipo;
    - a extração só lê: a gravação passada é a mesma depois (`structuredClone` antes e `toEqual` depois), e nada do contexto do jogo é chamado.
- [X] T019 O gabarito em `src/calculator/declared/answer-key.ts` e `answer-key-terms.ts` (depende de T016, T018)
  - Files: `src/calculator/declared/answer-key.ts` (a corrente, as formas de raiz e os pools), `src/calculator/declared/answer-key-terms.ts` (os termos, as passagens e o `/ 100`)
  - Signatures: `interface AnswerKey { root: string; final: number; form: "chain" | "expression"; accumulator: string | null; pools: AnswerPool[]; pollution: Record<string, number> }`; `AnswerPool`, `AnswerTerm` (data-model.md); `answerKey(rec: Recording, ops: readonly Op[]): AnswerKey | { error: "rootForm"; reason: string }`.
  - Porta o `gabarito.ts` do protótipo; cada arquivo abaixo de 400 linhas.
  - Cases: os da T018, que esta tarefa faz passar; cada arquivo abaixo de 400 linhas.
- [X] T020 [P] Testes primeiro, depois a lista das partes que não são folha em `src/calculator/declared/not-leaves.ts` (research R6; FR-016)
  - Files: `src/calculator/declared/not-leaves.test.ts`, `src/calculator/declared/not-leaves.ts`
  - Signatures: `interface NotLeaf { match: { call: string; mode?: string } | { read: string }; role: "curve" | "log" | "context" | "loopCounter" | "otherCharacter"; reason: string }`; `NOT_LEAVES: readonly NotLeaf[]`; `notLeafOf(key: string, character: number): NotLeaf | null` (a entrada `otherCharacter` só casa um índice diferente de `character`).
  - Cases: a curva `decay`, o `getLOG`, a masmorra e o mapa atual, o `GurtBonuzz` e a leitura de outro personagem casam; uma chamada comum não casa; toda entrada tem `reason`; nenhuma entrada é um texto do jogo.
- [X] T021 [P] Testes primeiro, depois a revisão em `src/calculator/declared/review.ts` (contracts/review.md; FR-024c, FR-025)
  - Files: `src/calculator/declared/review.test.ts`, `src/calculator/declared/review.ts`
  - Signatures: `interface Review { version: 1; blueprintSha: string; lock: { ok: boolean; gameSha: string; at: string } | null; verdict: "approved" | "fix" | null; note: string | null; history: ReviewEntry[] }`; `parseReview(raw: unknown): Review | null`; `blueprintSha(raw: unknown): string` (sha256 da forma canônica: chaves em ordem, sem espaço); `withLock(prev: Review | null, sha: string, lock: Review["lock"]): Review`; `withVerdict(prev: Review, verdict, note, sha, at): Review`; `reviewJson(r: Review): string`; `saoPauloTime(d: Date): string`.
  - Cases:
    - a mesma receita reformatada (outra indentação, outra ordem de chaves) tem o mesmo hash; um nome mudado tem outro;
    - uma resposta nova empurra a anterior para `history`, com o hash que ela viu;
    - uma mudança de hash zera `lock` e `verdict` para a receita atual;
    - nota só com `fix`, até 2.000 caracteres;
    - o horário sai no fuso `America/Sao_Paulo`;
    - o `reviewJson` já sai como o prettier o deixaria (o teste formata com o `prettier` instalado e compara), para o `just fmt-check` não acusar o que a ferramenta grava.
- [X] T022 Carga das receitas em `src/calculator/declared/blueprints.ts` e a API em `src/calculator/declared/index.ts` (research R8; depende de T014)
  - Files: `src/calculator/declared/blueprints.ts`, `src/calculator/declared/blueprints-load.test.ts`, `src/calculator/declared/index.ts`
  - Signatures: `loadBlueprints(files: Readonly<Record<string, unknown>>): { complete: ReadonlyMap<string, Blueprint>; refused: { file: string; reason: string }[]; stages: ReadonlyMap<string, "sketch" | "draft" | "complete"> }`; `BLUEPRINTS` (o `import.meta.glob` eager de `../blueprints/**/*.blueprint.json`); `blueprintOf(id: string): Blueprint | null` (só `complete`).
  - Cases: um esboço e um rascunho não são servidos (`blueprintOf` → `null`, o que vira `unknownNumber`); uma receita recusada não derruba as outras; os `*.review.json` nunca são importados.
- [X] T023 Teste "uma receita por número" em `src/calculator/declared/blueprints.test.ts` (FR-001, FR-024a; depende de T022)
  - Files: `src/calculator/declared/blueprints.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: cada número `arvore` de `docs/catalogo/numeros.json` tem exatamente um `<id>.blueprint.json`, na pasta do lote do `mundo` dele (`W1` → `w1` …, `Personagem` → `character`, `Conta` → `account`); nenhum arquivo a mais; todo arquivo carrega num estágio; o nome do arquivo é o id.
- [X] T024 Commit de dados com os 289 esboços (só `id` e `root`) em `src/calculator/blueprints/<lote>/` (plan Fase 2; depende de T023)
  - Files: `src/calculator/blueprints/{w1…w7,character,account}/<id>.blueprint.json` (289)
  - Signatures: nenhuma (dados).
  - A raiz casada com o `root-calls.json` de hoje pela chamada; o que não casar, escrito a partir da `prova` do catálogo. O script que gera os esboços fica fora do repositório. Commit só de dados, separado da lógica (lição 3 da 008).
  - Cases: `just test-one src/calculator/declared/blueprints.test.ts` passa; o scan da T009 passa sobre os 289.
- [X] T025 A conferência real no modo `roots` em `src/calculator/declared/real-trees.integration.test.ts`, com os ajudantes em `real-trees-run.ts` (contracts/real-trees-run.md; FR-026, NFR-003; depende de T019, T022)
  - Files: `src/calculator/declared/real-trees-run.test.ts` (primeiro), `src/calculator/declared/real-trees-run.ts`, `src/calculator/declared/real-trees.integration.test.ts`
  - Signatures: `treesEnv(env: NodeJS.ProcessEnv): { gameDir: string; snapshot: string; out: string; target: string; mode: "check" | "draft" | "roots" } | null`; `targetIds(target: string, catalog: readonly { id: string; lot: string }[]): string[]` (na ordem do catálogo); `rootCallOf(bp: Blueprint): RootCall`; `summaryLine(id: string, outcome): string`.
  - Cases (no `real-trees-run.test.ts`, em CI):
    - sem uma das três variáveis → `null`, e o teste de integração se pula;
    - `w1` dá os 22 ids na ordem; `all` os 289; um id fora do catálogo é recusado;
    - no modo `check`, um esboço ou rascunho de `all` não é travado: conta como "sem receita escrita" no resumo (as medidas do fim de cada lote rodam sobre as receitas já escritas);
    - a linha do resumo leva só o id, o resultado e o tempo; nunca um nome de personagem (o retrato do teste tem um, e ele não aparece);
    - toda saída cai dentro de `TREES_OUT`; um id com `..` ou `/` é recusado.
  - O modo `roots` sobe o gravador uma vez, grava só a raiz de cada esboço, em série, e escreve `TREES_OUT/roots.json` (a forma de cada raiz, o motivo das que ficaram fora, e os números que pedem o mapa vivo) e `summary.txt`. Um arquivo, um processo, nenhuma rede.
- [X] T026 [sessão] Sonda das raízes: `just trees roots` no PC do Vinicius (research R1; FR-002c) — **Parada:** as raízes fora da regra vão ao Vinicius numa tabela (id, nome, forma, motivo), antes da pergunta
  - Files: `TREES_OUT/roots.json` (fora do repo); `spec.md` só se a resposta esclarecer a regra (linha `resolved`, "durante a implementação"); a resposta que muda o escopo vira feature nova.
  - Signatures: nenhuma (rodada)
  - Expected: as 289 raízes classificadas; o tempo e a memória da rodada anotados em `registro.md`.


### Fase 2b: as raízes fora da regra (decisão do Vinicius na T026, 21/11; spec, Open Questions de 21/11)

- [X] T143 [P] Testes do gabarito com a camada de topo em `src/calculator/declared/answer-key.test.ts` (FR-002c; spec, Open Questions 21/11)
  - Cases, no jogo inventado (blocos novos em `fake-game.js`, como na T017):
    - `round(min(C, a × b))` → camada `[round, cap C]` e um Multi pool; o mesmo com `floor`, `ceil` e `max(c, x)` (floor);
    - `cond ? 0 : a + b` (portão) → camada `[cond]` e um Additive pool; o caminho que não rodou fica sem valor;
    - `K ÷ (1 + Σ ÷ 100)` → constante K e um divisor ➗ com as fontes;
    - a ordem das camadas é a do código, de fora para dentro;
    - uma raiz que só lê um valor ou devolve uma constante → `form: "leaf"`, sem pool.
- [X] T144 O gabarito com a camada de topo em `src/calculator/declared/answer-key.ts` e `answer-key-terms.ts` (depende de T143)
  - Signatures: `AnswerKey` ganha `top: TopLayer[]` com `TopLayer = { kind: "round" | "floor" | "ceil" | "cap" | "floor-min" | "cond" | "div"; value?: number; before: number; after: number }`; `form` ganha `"leaf"`.
  - Regra: a camada é tirada antes da regra dos pools; o resto segue a FR-002c sem mudança. Nada de palpite: uma forma que não for camada conhecida continua `outOfRule` com o motivo.
- [X] T145 Testes e código de duas formas de raiz novas em `src/calculator/declared/blueprint.ts`, `answer-key.ts` e `real-trees-run.ts` (spec, Open Questions 21/11; ADR 0010: a receita nunca guarda conta)
  - **Soma de chamadas** (Tome Score): `root` aceita `{ combine: "sum"; calls: { call: string; args: (number | string)[] }[] }`; o gabarito grava cada chamada e soma.
  - **Parte de uma chamada** (Glimbo, Vault, Exotic, Market Day e Night, Bubble cost Bits e Item): `root` aceita `{ call, args, part: <referência ao passo gravado> }`; o gabarito grava a chamada original e o valor da raiz é o do passo indicado (o redutor dentro do custo, por exemplo), tirado da gravação; nenhuma conta fica na receita.
  - **Marcador na cópia de gravação** (Brew Speed): `root` aceita `scratch: { [atributo]: valor }`, posto só na cópia do jogo usada para gravar, antes da chamada (o `gimmeBrewSPDnonLiquid`); nunca no save, nunca no app em execução.
  - Cases: duas chamadas inventadas somadas; uma parte de chamada inventada (o fator de um produto) com o valor do passo; um marcador que muda o caminho de um bloco inventado; uma chamada que falha vira `error` da raiz, não da rodada; o `parseBlueprint` recusa `calls` vazio e `part` que não é referência.
- [X] T146 [P] `src/calculator/blueprints/systems.json` ganha os 17 sistemas, depois de `weekly-boss` (FR-006; spec, Open Questions 21/11)
  - 🎟️ Event Shop · 🧂 Salt Lick · 🏯 Dungeons (com Flurbo Shop) · 📋 Tasks (com Merit Shop) · 🏝️ Islands · 💠 Jade Emporium · 🏗️ Construction · 🎣 Fishing · 🛐 Worship · 🍳 Cooking · 🏪 Zenith Market · 🍖 Food · 🔨 Smithing · 🦋 Catching · 📓 Death Note · 🏟️ Breeding · 🎪 Minigames (Darts e Hoops).
  - Cases: os testes da T007 passam (id slug, emoji único, nome em inglês, prova por referência); `tree/systems.test.ts` passa sem mudança de caso (os novos entram depois dos extras).
- [X] T147 Commit de dados: os esboços com a raiz certa e o catálogo (depende de T145; spec, Open Questions 21/11)
  - Files: `src/calculator/blueprints/<lote>/*.blueprint.json`; `docs/catalogo/numeros.json` e `src/shared/number-catalog.json` só nos ids que mudam.
  - Catálogo: saem `alch-brew-per-hour` e `alch-liquid-rate` (destino painel de farm); `alch-bubble-cost-reduction` vira `-bits` e `-item`; `farm-market-cost-reduction` vira `-day` e `-night`; continua com 289.
  - Raízes: a tabela de raízes corrigidas da sonda (pasta de trabalho da 010, `raizes-corrigidas.md`), com a forma "parte de uma chamada" nos casos sem chamada própria; as raízes que são só leitura do save ficam para a T149.
  - Cases: o teste "uma receita por número" (T023) passa com os ids novos.
- [X] T148 [P] A sonda vê o zero do acumulador posto no começo de um laço `for` (`arcade-ball-bonus`, `research-insight-rate`) em `answer-key.ts` (research R1)
  - Cases: um bloco inventado com o zero no init do `for` dá `chain`, não `outOfRule`.
- [X] T150 [P] Folha só com prova também quando uma leitura e uma chamada filha têm o valor final (`answer-key.ts:326`): a chamada filha com o valor final vence ("a raiz só repassa uma chamada"); teste com um bloco inventado que lê um atributo 7 e devolve uma chamada que dá 7 (revisão da continuação, 22/11)
- [X] T151 Portão e dois caminhos fora do `return` (as 21 raízes da segunda sonda: Mining e Chop Speed, Multi-Ore, Gilded Stamp Chance…): o gabarito acha a condição gravada dentro do último passo e a trata como a camada ❓ (spec, Open Questions 21/11: alvo = só o caminho padrão, estado = ❓ com os caminhos); teste com um bloco inventado `x = cond ? a : b; return x * k`
- [X] T152 Raiz "rotina na cópia" (`constr-build-rate`): `root` aceita `{ routine: <evento do jogo>, sum: <caminho do estado> }`; o gravador roda o evento só na cópia de gravação e a raiz é a soma do estado que ele escreve; o Total Build Rate é a soma das casas do Cog Board × (1 + % das engrenagens) (spec, Open Questions 22/11); teste com um evento inventado
- [X] T153 Commit de dados: `talents-max-level` vira a soma de `WorkbenchStuff(maxBookLv)` e `RunCodeOfTypeXforThingY(AllTalentLV)`; saem `gfood-quantity` e `storage-slots-total` do catálogo (287); o `part` passa a escolher **termos do pool gravado** (por referência) e o valor da raiz é o produto deles (pool Multi) ou a soma (pool Additive): o jogo multiplica o redutor solto junto do custo (Market Day e Night, Glimbo, Exotic, Bubble cost Bits e Item), então não há subexpressão só com ele; os argumentos: Vault com um upgrade da lista do Glimbo (`VaultUpgMaxLV`, 2) e Exotic com um preço diferente de 0 (`ExoticLVQTY`, 1000); as chaves gravadas estão em `lab/trees-out/part-keys.json` no PC do Vinicius
- [X] T154 A camada de topo geral (segunda sonda, 22/11; formas já decididas em 21/11): (1) `A ÷ B` com qualquer numerador: o numerador segue a regra dos pools e cada fator de `B` vira uma linha ➗ no primeiro nível (numeradas quando há mais de uma), com os grupos de sistema e as constantes dentro; (2) `min`/`max` cujo limite não é constante: Cap ou Floor com o limite como linha que abre nas fontes dele; `min`/`max` aninhados viram uma camada cada; (3) `pow` com uma constante: a curva vai para o ⓘ do termo (FR-016), sem pool próprio. Testes com blocos inventados no jogo falso, um por forma; o teste da T151 ganha o caminho "sim" (`TreeOwned: 1`) e o `TreeGateChain` (achado da revisão)
- [X] T155 O `part` também escolhe um termo que contém todas as referências (o fator `(1 + (Grid + VIP)/100)` do Vault, o `(1 + (Grimoire + Troll)/100)` do Tome bonus) e procura nos pools de uma corrente (o custo de bolha que o jogo acumula num caminho de rascunho e depois só lê); teste com um bloco inventado de cada
- [X] T156 A receita da rotina do Cog Board (`constr-build-rate`): o evento `WorkbenchStuff2` do ator ajudante 8 (`ActorEvents_481`), com o texto de disparo que monta as casas dos personagens e o que aplica os % das engrenagens; a raiz é a soma do `a` de cada casa da cópia do tabuleiro, que tem que fechar com o Total Build Rate da aba BUILD
- [X] T157 A regra do teto pela constante (spec, Open Questions 22/11): num `min`/`max` sem constante e sem lado vindo da raiz, o teto é o lado que começa com uma constante do jogo (`90 + …`, `10000 × …`); fora disso, recusa. Testes com blocos inventados das duas formas e um caso ambíguo recusado
- [X] T158 Os passos que o gabarito ainda recusa na quarta sonda: o primeiro passo de corrente que é um `max`/`min` (Trap collect all, New bubble chance, Arcade ball: a camada vale também num passo da corrente), a corrente igual ao último passo do Legend talent max LV, o zero do laço do Research insight, e o redutor do Bubble cost Bits e Item, que é uma curva (`0,75^n`) dentro da conta acumulada (a curva vira termo, FR-016); um bloco inventado de cada, sem palpite
- [X] T159 A raiz aceita uma lista curta de números como argumento (`TotalTalentPoints([0,0,0,0,0,0])`, até 8 números) e o índice de um item do resultado; teste no `parseBlueprint` e no gravador inventado
- [X] T160 Commit de dados (spec, Open Questions 22/11): `summ-unit-stats` = `Summoning("UnitDMG",-1,0)`; `obols-stat-multi` vira `-str`, `-agi`, `-wis`, `-luk` (o multiplicador de cada um dentro de `TotalStats`, com o `part` nos termos do talento e do Super Bit); `talents-points-per-tab` vira `-1` … `-6`; o catálogo com 295 (a tabela da pasta de trabalho, `raizes-sem-numero.md`)
- [X] T161 `signs-seraph-multi` e `stats-mob-respawn` (spec, Open Questions 22/11): a conta fica dentro de um bloco que não devolve o número (o Seraph numa variável do `StarSigns`; a soma comum do respawn dentro do `performETCaction`, que só grava o `RespawnTime` de cada monstro); a raiz precisa de uma forma "rotina + parte" ou do caminho onde a soma fica; sem chute
- [X] T162 O que a quinta sonda ainda recusa: (1) o `part` e o `item` só olham as chamadas e as listas da própria raiz, nunca as que outros blocos chamaram na mesma gravação (Obol stat multi: o `TotalStats` roda mais de uma vez; Talent points per tab: a lista de pontos sai mais de uma vez); (2) o `part` acha uma referência dentro de um termo composto (o Super Bit dentro do termo do talento) e dentro da curva da conta acumulada (Bubble cost); (3) um lado `min`/`max` cujos argumentos começam com constante conta como "começa com constante" (Food not consume: `min(90 + …, 98 + …)`); (4) o primeiro passo da corrente do New bubble chance; um bloco inventado de cada, sem palpite
- [X] T163 `stats-mob-respawn` vira 7 árvores, uma por mundo (spec, Open Questions 22/11, sexta sonda): `stats-mob-respawn-w1` … `-w7`, cada uma com a linha ➗ inteira das voltas do `performETCaction("MonsterRespawnTimeReset")` daquele mundo (a parte comum mais a conquista e as tarefas do mundo; no W7, 0,65 × a parte comum mais o Spelunk); a receita declara qual volta é de qual mundo por referência, nunca pela ordem; as voltas do mesmo mundo têm de dar os mesmos termos e o mesmo valor, senão recusa; cavernas e rift ficam fora; o catálogo com 301 (commit de dados próprio); um bloco inventado no `fake-game.js`
- [X] T149 [sessão] Sonda das raízes de novo: `just trees roots` no PC do Vinicius (depende de T143–T148) — **Parada:** se sobrar raiz fora da regra, a tabela vai ao Vinicius.

**Checkpoint**: `just check` passa; a decisão das raízes fora da regra está registrada.

Verify: `just test-one src/calculator/declared/answer-key.test.ts` - passa; `just test-one src/calculator/declared/blueprints.test.ts` - passa; `just check` - passa; `just trees roots` (PC do Vinicius) - `roots.json` com 289 raízes, 0 sem forma.

---

## Phase 3: User Story 2 - Receita conferida contra o jogo antes de chegar à tela (Priority: P1)

**Goal**: a trava confere a receita contra o gabarito (ordem dos pools, presença, ordem, fechamento de cada nível com a
conta remontada na hora) e reprova com o motivo; o Drop Rate é a primeira receita completa e passa na trava sobre o jogo
real (FR-010, FR-011).

**Independent Test**: no jogo inventado, uma receita sem uma fonte, outra com os pools trocados e outra com um nível que
não fecha são reprovadas com o motivo da US2; no PC do Vinicius, `just trees stats-drop-rate` passa, e as duas
reprovações da US2 aparecem no jogo real.

### Tests for User Story 2 (write first)

- [X] T027 [P] [US2] Testes da trava no pool em `src/calculator/declared/lock.test.ts` (FR-010, FR-013a, FR-002a; depende de T017, T019)
  - Files: `src/calculator/declared/lock.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases (cada reprovação com o texto do data-model):
    - a receita inventada correta passa, com `counts`;
    - sem uma fonte do gabarito → `missingSource`, "fonte que falta: <ref> (pool 1 Additive)", e o pool 1 `notClosing` com os dois valores;
    - os pools 1 e 2 trocados → `poolOrder`, "ordem dos pools errada: a ordem esperada é Additive → Multi → …";
    - um nível que não fecha → `notClosing` com o nível, o valor declarado e o valor do jogo;
    - uma fonte declarada que o gabarito não tem → `extraSource`;
    - grupos ou fontes fora da ordem do gabarito → `groupOrder` / `sourceOrder`;
    - uma constante (`+ 2`, `× 1.2`) casa pelo valor e pela posição;
    - a tolerância: diferença relativa de 1e-6 fecha, de 2e-6 não (SC-001);
    - uma receita com `pending` → `pending`, sempre reprovada;
    - uma fonte de outra classe ausente da gravação não é `missingSource`; a mesma fonte presente na gravação de um personagem de outra classe é `classMismatch`.
- [X] T028 [P] [US2] Testes da descida em `src/calculator/declared/lock-levels.test.ts`, começando por cadeias de dois níveis (lição 5 da 008; FR-010, FR-002b, FR-005, FR-016; research R2–R6; depende de T017, T019)
  - Files: `src/calculator/declared/lock-levels.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - uma fonte com dois níveis de filhos fecha em cada nível pela expressão gravada remontada;
    - uma referência da expressão sem filho declarado → `undeclaredPart`; um filho que a expressão não usa → `childOutside`; um filho sem valor na gravação → `childNoValue`;
    - a curva com argumentos que casam um a um fecha pela conta inteira; a curva ambígua fecha pelo valor gravado e conta em "fechado pelo valor gravado";
    - a condição `&&` declarada: verdadeira com o termo presente passa; falsa com o termo presente → `conditionMismatch`; a leitura da condição ausente da gravação → `conditionMismatch`;
    - o termo de duas fontes sem o filho `termPart` → `undeclaredPart`; com ele, fecha pela expressão do termo;
    - `{character}` resolve para o personagem gravado; `*` sem nenhuma leitura → `childNoValue`, nunca 0;
    - uma folha sem tipo → `leafType`;
    - o `LockResult` não guarda conta: o JSON dele não tem nenhum `Expr` nem texto de expressão, só nível, tipo e os dois valores (FR-010).

### Implementation for User Story 2

- [X] T029 [US2] A trava no pool em `src/calculator/declared/lock.ts` (depende de T027)
  - Files: `src/calculator/declared/lock.ts`
  - Signatures: `interface LockInput { blueprint: Blueprint; key: AnswerKey; rec: Recording; ops: readonly Op[]; character: number; characterClass: number | null }`; `lockBlueprint(input: LockInput, mode: "check"): LockResult`; `LockResult`, `LockError` (data-model.md); `lockMessage(e: LockError): string`.
  - Porta o `trava.ts` do protótipo (429 linhas) em dois arquivos, cada um abaixo de 400 linhas.
  - Cases: os da T027, que esta tarefa faz passar.
- [X] T030 [US2] A descida em `src/calculator/declared/lock-levels.ts` (depende de T016, T020, T028, T029)
  - Files: `src/calculator/declared/lock-levels.ts`
  - Signature: `lockLevels(node: BlueprintNode, recorded: RecNode, ctx: LevelContext): { errors: LockError[]; counts: LockResult["counts"] }`.
  - A conta remontada só existe em memória durante a chamada (FR-010).
  - Cases: os da T028, que esta tarefa faz passar.
- [ ] T031 [P] [US2] Teste da receita do Drop Rate em `src/calculator/declared/blueprints.test.ts` (depende de T023)
  - Files: `src/calculator/declared/blueprints.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: `stats-drop-rate` carrega no estágio `complete`; os pools são Additive, Multi, Additive, Multi; nenhum `read` com índice de personagem por extenso; toda fonte com `nameProof`.
- [ ] T032 [US2] A receita do Drop Rate em `src/calculator/blueprints/character/stats-drop-rate.blueprint.json` (research R15; depende de T014, T031)
  - Files: `src/calculator/blueprints/character/stats-drop-rate.blueprint.json`
  - Signatures: nenhuma (dados).
  - Traduzida de `prototipo/receita-dropRate.json` para a forma nova: `{character}` e `*` no lugar de `PlayerDATABASE[1]`; a condição de cada constante declarada (`bun_v`, `bun_p`, `OptionsListAccount[232]`); o termo de duas fontes com `termPart`; os nomes com prova das tabelas de texto (o "nome a provar" do recorde de boss resolvido, ou a receita fica em `draft`); as fontes "a descer" descidas até a folha; nenhuma fórmula.
  - Cases: os da T031; `just test-one src/calculator/declared/blueprints.test.ts` passa; o scan da T009 passa.
- [X] T033 [US2] O modo `check` da conferência real: grava, gabarito, trava, `lock/<id>.json`, `summary.txt` e o `lock` da revisão (contracts/real-trees-run.md; FR-002a, FR-010, FR-026; depende de T021, T025, T030)
  - Files: `src/calculator/declared/real-trees-run.ts`, `src/calculator/declared/real-trees-run.test.ts` (primeiro), `src/calculator/declared/real-trees.integration.test.ts`
  - Signatures: `reviewPath(blueprintsDir: string, id: string, lot: string): string`; `writeLock(dir: string, id: string, lot: string, sha: string, lock: Review["lock"]): void`; `classCharacters(snapshot): Map<number, number>` (um personagem de cada classe do retrato).
  - Cases:
    - o caminho da revisão sai só do id e do lote, nunca de texto de fora;
    - a revisão guarda só `blueprintSha` e `lock` (`ok`, `gameSha` = sha256 do `N.js`, `at`), nunca motivo nem valor;
    - um número com fonte de classe roda uma vez por classe do retrato (`inactiveMosaic`), e o resultado junta as rodadas;
    - o `summary.txt` traz o tempo de cada etapa e o pico de memória.
- [X] T164 [US2] A trava reprova a folha que tem filhos (spec, Open Questions 22/11): `leafHasChildren` quando, embaixo de uma fonte declarada como folha, a gravação mostra leitura do save ou chamada de bloco que lê o save (tabela do jogo não conta); teste primeiro em `lock-levels.test.ts` (uma folha com filho que lê o save reprova; uma folha que só lê tabela do jogo passa); antes da T032
  - Ordem (Vinicius, 22/11): a T059 e a T060 (o gerador de rascunho) vêm antes da T031 e da T032; a receita do Drop Rate sai do `just draft stats-drop-rate`.
- [ ] T034 [sessão] [US2] Conferência real do Drop Rate: `just trees stats-drop-rate` (FR-010, SC-001; depende de T032, T033)
  - Files: `src/calculator/blueprints/character/stats-drop-rate.review.json` (o `lock`); fora: `TREES_OUT/lock/`, `summary.txt`
  - Signatures: nenhuma (rodada)
  - Expected: passa, 0 erros; partes fechadas pelo valor gravado anotadas em `registro.md`; tempo e memória anotados.
- [ ] T035 [sessão] [US2] As duas reprovações da US2 no jogo real (quickstart, US2; depende de T034)
  - Files: `src/calculator/blueprints/character/stats-drop-rate.blueprint.json` (mudada e desfeita; nada vai ao commit); fora: `TREES_OUT/summary.txt`, `TREES_OUT/lock/`
  - Signatures: nenhuma (rodada)
  - Expected:
    - sem a fonte `Summoning WinBonus 9`: reprova com "fonte que falta" e o nível que não fecha;
    - com os pools 1 e 2 trocados: reprova com a ordem esperada;
    - as duas mudanças desfeitas (`git checkout` do arquivo), e a rodada seguinte passa de novo.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/lock.test.ts` - passa; `just test-one src/calculator/declared/lock-levels.test.ts` - passa; `just check` - passa; `just trees stats-drop-rate` (PC do Vinicius) - `summary.txt` com 1 passou, 0 reprovou.

---

## Phase 4: User Story 1 - O piloto montado: a árvore do Drop Rate pela receita (Priority: P1)

**Goal**: a receita, o gabarito e a gravação dão a árvore inteira no `CalcTreeNode` da 009: pools na ordem do jogo,
grupos por sistema com emoji, fontes até a folha, o ⓘ, e todo nível fechando (FR-002, FR-012–FR-016). A tela do app
ainda mostra a árvore da 0.9.

**Independent Test**: no jogo inventado, a árvore montada de uma receita inventada passa no `checkTree` do main, com os
pools, os grupos (mesmo de uma fonte só), a classe e o ⓘ certos; no PC do Vinicius, `TREES_OUT/trees/stats-drop-rate.json`
tem 4 pools, nenhum "Other" nem "no name yet", e a montagem cabe nos 5 s.

### Tests for User Story 1 (write first)

- [ ] T036 [P] [US1] Testes da montagem em `src/calculator/declared/assemble.test.ts` (FR-002, FR-002a, FR-002b, FR-012–FR-015, FR-018; research R11, R12; depende de T017, T019)
  - Files: `src/calculator/declared/assemble.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - a raiz `role: "root"`; o primeiro nível são os pools da receita, `role: "pool"`, com `poolKind` e `combine` (`sum` ou `percent` no Additive, `product` no Multi) e os nomes da 009 ("Additive pool 1", "Multi pool" sem número quando há um só);
    - dentro do pool, os grupos `role: "system"` com "emoji nome" da tabela, `pieceKey: null`, na ordem do gabarito (FR-013a);
    - um grupo de uma fonte só aparece, e um grupo com contribuição 0 também (FR-014);
    - uma fonte que a gravação não usou vale 0 no Additive e 1 no Multi, em cinza, no lugar dela;
    - a fonte de outra classe some; o grupo some só quando todas as fontes dele são de outras classes; trocar para um personagem de outra classe tira as fontes dela (FR-002a);
    - o termo de duas fontes é uma linha só, com a segunda fonte como filha e o emoji do sistema dela no nome (FR-002b);
    - ids `<id>/<pool>/<sistema>/<chave>…`; `pieceKey` da referência resolvida; `leaf` dos 9 tipos, nunca `unknown`; `fmt` pelo pool;
    - todo nível fecha com o pai, e a raiz com o `final`; quando não fecha, cada linha mostra o valor do jogo, sem linha a mais (FR-015);
    - os pools vão `kids: "lazy"` no primeiro envio, e `expand` devolve o nível guardado (FR-013);
    - a árvore passa no `checkTree` de `src/main/tree-check.ts` sem mudança dele (o contrato da 009).
- [ ] T037 [P] [US1] Testes do ⓘ em `src/calculator/declared/how-it-adds-up.test.ts` (FR-016; depende de T017)
  - Files: `src/calculator/declared/how-it-adds-up.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: o ⓘ de uma fonte sai da expressão gravada com os nomes dos filhos da receita; uma curva aparece pelo papel, com as constantes nomeadas; uma checagem de ramo vai ao ⓘ; o ⓘ da raiz junta os pools com os números; termos e números que não casam dão a forma de regra da 008; o texto nunca traz um nome de bloco nem um caminho do jogo (FR-012a da 008).

### Implementation for User Story 1

- [ ] T038 [US1] A montagem em `src/calculator/declared/assemble.ts` (depende de T029, T030, T036)
  - Files: `src/calculator/declared/assemble.ts`
  - Signatures: `assembleTree(input: LockInput & { systems: readonly SystemEntry[] }): { root: CalcTreeNode; expand(nodeId: string): CalcTreeNode | null; whole(): CalcTreeNode }` (`whole` é a árvore inteira aberta, para a galeria).
  - Só lê a receita e preenche os valores; nunca deduz forma (FR-009, FR-012). Abaixo de 400 linhas.
  - Cases: os da T036, que esta tarefa faz passar.
- [ ] T039 [US1] O ⓘ em `src/calculator/declared/how-it-adds-up.ts` (depende de T037)
  - Files: `src/calculator/declared/how-it-adds-up.ts`
  - Signatures: `howItAddsUp(e: Expr, names: (e: Expr) => string | null): CalcTreeNode["formula"]`; `rootFormula(pools: readonly { name: string; value: number; kind: "additive" | "multi" }[]): CalcTreeNode["formula"]`.
  - Cases: os da T037, que esta tarefa faz passar.
- [ ] T040 [US1] A conferência real escreve a árvore inteira em `TREES_OUT/trees/<id>.json` e guarda a anterior em `previous/trees/` (contracts/real-trees-run.md; FR-023; depende de T033, T038)
  - Files: `src/calculator/declared/real-trees-run.ts`, `src/calculator/declared/real-trees-run.test.ts` (primeiro), `src/calculator/declared/real-trees.integration.test.ts`
  - Signatures: `moveToPrevious(out: string, id: string): void`; `writeTree(out: string, id: string, tree: CalcTreeNode): void`
  - Cases: a árvore da rodada anterior vai para `previous/` antes de a nova ser escrita; um número reprovado na trava não ganha árvore nova; o `summary.txt` ganha o tempo da montagem.
- [ ] T041 [sessão] [US1] Piloto montado no jogo real: `just trees stats-drop-rate` (NFR-001, SC-003, SC-005; depende de T040)
  - Files: fora do repositório: `TREES_OUT/trees/stats-drop-rate.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature
  - Signatures: nenhuma (rodada)
  - Expected: `trees/stats-drop-rate.json` com 4 pools (Additive, Multi, Additive, Multi), grupos com emoji, nenhum "Other", "no name yet" nem "Game value"; o tempo da gravação à montagem abaixo de 5 s e o pico de memória anotados em `registro.md`.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/assemble.test.ts` - passa; `just test-one src/calculator/declared/how-it-adds-up.test.ts` - passa; `just check` - passa; `just trees stats-drop-rate` (PC do Vinicius) - passa, montagem abaixo de 5 s.

---

## Phase 5: User Story 3 - Aprovar as árvores na tela real, numa galeria (Priority: P2)

**Goal**: a imagem de cada árvore sai do `FormulaTree` de verdade, aberta até as folhas; a galeria mostra os cartões por
sistema, a contagem de mudanças no topo, e grava "Aprova" ou "Corrigir + nota" na revisão ao lado da receita
(FR-022–FR-025).

**Independent Test**: no jogo inventado, o relatório de mudanças conta nome, linha nova, linha removida e valor; a
resposta da galeria recusa veredito inválido, nota longa ou com nome de personagem e hash velho; no PC do Vinicius,
`just gallery pilot` abre o Drop Rate e grava a resposta no `stats-drop-rate.review.json`.

### Tests for User Story 3 (write first)

- [ ] T042 [P] [US3] Teste da prop `openAll` em `src/renderer/FormulaTree.test.tsx` (FR-013, FR-023)
  - Files: `src/renderer/FormulaTree.test.tsx`
  - Signatures: nenhuma (só teste)
  - Cases: com `openAll`, todos os pools, grupos, fontes e filhos aparecem abertos, sem pedir `expand`; sem a prop, como no app, todos os pools e grupos começam fechados (o caso da 009 continua).
- [ ] T043 [P] [US3] Testes do relatório de mudanças em `src/calculator/declared/changes.test.ts` (FR-022, FR-024b, SC-007)
  - Files: `src/calculator/declared/changes.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: duas rodadas iguais → 0 árvores; um nome mudado → `name`; um nó a mais → `added`; um a menos → `removed`; um valor diferente → `value`; uma árvore sem rodada anterior conta como mudada, toda `added`; `perTree` lista o id do nó de cada mudança; `cause` vem da rodada.
- [ ] T044 [P] [US3] Testes da resposta e do modelo da galeria em `src/calculator/declared/review.test.ts` e `src/calculator/declared/gallery-model.test.ts` (contracts/gallery.md; FR-011, FR-024, FR-024b, NFR-004)
  - Files: `src/calculator/declared/review.test.ts`, `src/calculator/declared/gallery-model.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - `checkReviewSave`: `verdict` fora de `approved` / `fix` é recusado; `fix` sem nota é recusado; nota acima de 2.000 caracteres é recusada; uma nota com o nome de um personagem do retrato, em qualquer caixa, é recusada; um id fora do lote aberto é recusado; um hash diferente do da receita atual → "a receita mudou: rode a trava de novo";
    - `galleryModel`: só ganha cartão o número com `lock.ok` no hash atual; os outros só contam no topo; as seções seguem o sistema do catálogo e os cartões a ordem do catálogo; um cartão aprovado no hash atual vem marcado; o topo traz a última mudança por tipo.

### Implementation for User Story 3

- [ ] T045 [US3] A prop `openAll` em `src/renderer/FormulaTree.tsx` (depende de T042)
  - Files: `src/renderer/FormulaTree.tsx`
  - Signature: `openAll?: boolean` nas props; só abre tudo, nunca é passada pela tela do app.
  - Cases: os da T042, que esta tarefa faz passar.
- [ ] T046 [US3] O relatório de mudanças em `src/calculator/declared/changes.ts`, escrito a cada rodada em `TREES_OUT/changes.json` (depende de T040, T043)
  - Files: `src/calculator/declared/changes.ts`, `src/calculator/declared/real-trees-run.ts`
  - Signature: `changeReport(previous: ReadonlyMap<string, CalcTreeNode>, next: ReadonlyMap<string, CalcTreeNode>, cause: string): ChangeReport`.
  - Cases: os da T043; a rodada escreve `TREES_OUT/changes.json` com a `cause`.
- [ ] T047 [US3] A resposta e o modelo da galeria em `src/calculator/declared/review.ts` e `gallery-model.ts` (depende de T021, T044)
  - Files: `src/calculator/declared/review.ts`, `src/calculator/declared/gallery-model.ts`
  - Signatures: `checkReviewSave(payload: unknown, ctx: { lotIds: ReadonlySet<string>; characterNames: readonly string[]; currentSha: (id: string) => string }): { ok: true; id: string; verdict: "approved" | "fix"; note: string | null } | { refused: string }`; `galleryModel(lot: string, catalog, reviews, shas, changes: ChangeReport | null): { top: GalleryTop; sections: GallerySection[] }`.
  - Cases: os da T044, que esta tarefa faz passar.
- [ ] T048 [US3] O portão das revisões em `src/calculator/declared/reviews.test.ts`, só a forma por enquanto (contracts/review.md; FR-024c)
  - Files: `src/calculator/declared/reviews.test.ts`
  - Signatures: nenhuma (só teste; `DONE_IDS` e `DONE_LOTS` são constantes do teste)
  - Cases: todo `*.review.json` passa no `parseReview`, tem um id do catálogo e uma receita ao lado; nenhuma nota passa de 2.000 caracteres; para cada id de `DONE_IDS` e cada lote de `DONE_LOTS` (as duas listas vazias agora), a revisão tem o hash da receita atual, `lock.ok: true` e `verdict: "approved"`.
- [ ] T049 [US3] A ferramenta da galeria em `scripts/gallery/` (contracts/gallery.md; FR-023, FR-024, NFR-004; depende de T045, T046, T047)
  - Files: `scripts/gallery/main.ts`, `scripts/gallery/preload.ts`, `scripts/gallery/tree-page.tsx`, `scripts/gallery/gallery-page.tsx`, `scripts/gallery/tree-page.html`, `scripts/gallery/gallery-page.html`, `scripts/gallery/gallery-page.test.tsx` (primeiro)
  - Signatures: `captureLot(lot: string): Promise<void>`; `slices(height: number, max?: number): { y: number; h: number }[]`; o canal `review:save` da ferramenta
  - Captura: lê `TREES_OUT/trees/<id>.json` dos números com `lock.ok` no hash atual; pula a imagem mais nova que o JSON; desenha com o `FormulaTree.tsx`, o `styles.css` e o `companion-stub.ts` de verdade, com `openAll`, numa janela fora da tela na largura do painel; `capturePage()` em fatias de até 8.000 px, em `TREES_OUT/img/<id>-<n>.png`.
  - Janela: `sandbox`, `contextIsolation`, sem `nodeIntegration`, CSP `default-src 'self'`, toda requisição http(s) cancelada pela sessão, nenhuma janela nova; `review:save` passa pelo `checkReviewSave` e grava com `withVerdict`; os nomes de personagem do retrato só em memória.
  - Cases (`gallery-page.test.tsx`, jsdom): cada cartão tem o nome do número, o sistema, as imagens em `loading="lazy"`, "Aprova", "Corrigir + nota" e o campo de nota; botões e campo nativos, com nome para o leitor de tela, na ordem do Tab; o topo mostra a contagem por tipo e os números sem trava.
- [ ] T050 [P] [US3] Teste de que a ferramenta da galeria não entra no instalador nem usa a rede, em `src/main/no-network.test.ts` (NFR-004)
  - Files: `src/main/no-network.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: o scan de rede passa a ler `scripts/gallery/` (nenhum `fetch`, `http`, `https`, `net`, `WebSocket`); o `electron-builder.yml` só empacota `out/**` (a galeria fica em `TREES_OUT/gallery-app/`).
- [ ] T051 [sessão] [US3] Galeria piloto: `just gallery pilot`, com o Drop Rate (research R15; FR-023–FR-025) — **Parada:** o Vinicius aprova ou pede correção
  - Files: `src/calculator/blueprints/character/stats-drop-rate.review.json` (`verdict`, `note`, `history`); `src/calculator/declared/reviews.test.ts` (`DONE_IDS` ganha `stats-drop-rate` depois da aprovação)
  - Signatures: nenhuma (rodada)
  - Expected: a galeria abre em até 5 s; Tab alcança os botões e o campo; cada "Corrigir + nota" vira mudança da receita (ou regra, na Fase 6), nova rodada da T034 e volta à galeria com a contagem de mudanças no topo; no fim, aprovado no hash atual.

**Checkpoint**: `just check` passa; o Drop Rate aprovado.

Verify: `just test-one src/calculator/declared/changes.test.ts` - passa; `just test-one src/calculator/declared/gallery-model.test.ts` - passa; `pnpm exec vitest run --pool=threads scripts/gallery/gallery-page.test.tsx` - passa; `just check` - passa; `just gallery pilot` (PC do Vinicius) - abre em até 5 s, resposta gravada.

---

## Phase 6: User Story 4 - Regras de forma conferidas em todas as árvores (Priority: P2)

**Goal**: cada regra de forma tem número, frase, exemplo, checagem e estado; as checagens de receita rodam no CI sobre
as 289, as de árvore na conferência real, e um conflito vai ao Vinicius com a árvore e os dois números (FR-020, FR-021).

**Independent Test**: o registro e o código estão amarrados nos dois sentidos; uma receita montada à mão que obedece uma
regra e fere outra dá um conflito com a árvore e os dois números; no PC do Vinicius, `TREES_OUT/rules.md` do Drop Rate
lista cada regra com quem passa e quem falha.

### Tests for User Story 4 (write first)

- [ ] T052 [P] [US4] Teste do registro em `src/calculator/declared/shape-rules-registry.test.ts` (FR-020)
  - Files: `src/calculator/declared/shape-rules-registry.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: toda regra `vale` de `docs/arvores/regras-de-forma.md` tem checagem em `SHAPE_RULES`; toda checagem tem regra no registro; regra `substituída por Rnn` não tem checagem ativa e aponta para uma regra que existe; números únicos e nunca reaproveitados; toda regra tem frase e exemplo.
- [ ] T053 [P] [US4] Testes das checagens e dos conflitos em `src/calculator/declared/shape-rules.test.ts` (FR-002a–c, FR-004–FR-006, FR-013a, FR-014, FR-015, FR-021, SC-003, SC-004)
  - Files: `src/calculator/declared/shape-rules.test.ts`, `src/calculator/fixtures/blueprints/conflict.blueprint.json`
  - Signatures: nenhuma (só teste)
  - Cases:
    - cada regra de partida com um caso que passa e um que falha;
    - duas regras que falham no mesmo nó da mesma árvore → um conflito;
    - uma regra que falha num nó onde uma regra em `tension` com ela passa → um conflito;
    - a receita montada à mão (`conflict.blueprint.json`) obedece uma regra e fere a outra: o relatório traz a árvore e os dois números (US4, cenário 2);
    - nenhuma regra é desligada nem priorizada: o relatório lista as duas.

### Implementation for User Story 4

- [ ] T054 [US4] O registro em `docs/arvores/regras-de-forma.md` (research R13)
  - Files: `docs/arvores/regras-de-forma.md`
  - Signatures: nenhuma (documento)
  - As regras de partida, com o número da FR: pools por trecho (FR-002c), termo de duas fontes (FR-002b), fonte de classe (FR-002a), nome do jogo com prova (FR-004), tipo de folha (FR-005), sistema real e sem "Other" (FR-006), ordem do gabarito (FR-013a), sistema sempre como filho (FR-014), cada nível fecha (FR-015), nenhum "no name yet" nem "Game value" (SC-003). Em português; colunas número, frase, exemplo, checagem, estado.
  - Cases: os da T052: cada regra com número, frase, exemplo, checagem e estado.
- [ ] T055 [US4] As checagens em `src/calculator/declared/shape-rules.ts` (depende de T052, T053, T054)
  - Files: `src/calculator/declared/shape-rules.ts`
  - Signatures: `interface ShapeRule { id: string; scope: "blueprint" | "tree"; tension: readonly string[]; check(subject): RuleFailure[] }`; `SHAPE_RULES: readonly ShapeRule[]`; `runShapeRules(subjects, scope): RulesReport` com `{ byRule: Record<string, { pass: string[]; fail: string[] }>; conflicts: { tree: string; node: string; rules: [string, string] }[] }`.
  - Cases: os da T052 e da T053, que esta tarefa faz passar.
- [ ] T056 [US4] As checagens de receita sobre as 289 no CI, em `src/calculator/declared/blueprints.test.ts` (FR-020, SC-004; depende de T055)
  - Files: `src/calculator/declared/blueprints.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: toda receita `complete` passa nas checagens `scope: "blueprint"`; os esboços e rascunhos passam pelas que cabem no estágio; um conflito de receita faz o teste falhar com a árvore e os dois números.
- [ ] T057 [US4] As checagens de árvore na conferência real: `TREES_OUT/rules.json` e `rules.md` (contracts/real-trees-run.md; depende de T040, T055)
  - Files: `src/calculator/declared/real-trees-run.ts`, `src/calculator/declared/real-trees-run.test.ts` (primeiro)
  - Signatures: `writeRules(out: string, report: RulesReport): void`
  - Cases: o `rules.md` lista por regra as árvores que passam e as que falham, e os conflitos; nenhum valor nem conta no arquivo.
- [ ] T058 [sessão] [US4] Rodada das regras sobre o Drop Rate: `just trees stats-drop-rate` (FR-021) — **Parada:** cada conflito vai ao Vinicius, com a tabela antes da pergunta
  - Files: fora: `TREES_OUT/rules.md`, `TREES_OUT/rules.json`; `docs/arvores/regras-de-forma.md` e as receitas, quando o Vinicius decide
  - Signatures: nenhuma (rodada)
  - Expected: `rules.md` sem falha; cada conflito decidido pelo Vinicius vira mudança de receita ou regra (substituída, nunca apagada), com a contagem de árvores mudadas antes da aprovação (FR-022).

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/shape-rules-registry.test.ts` - passa; `just test-one src/calculator/declared/shape-rules.test.ts` - passa; `just check` - passa; `just trees stats-drop-rate` (PC do Vinicius) - `rules.md` sem falha nem conflito aberto.

---

## Phase 7: Lotes de receitas (US1, US2 e US3 em escala)

**Purpose**: as 288 receitas que faltam, lote a lote, na ordem da FR-024a. Cada lote gera os rascunhos, completa as
receitas, passa na trava e passa na galeria. Os agentes de receita escrevem em paralelo e nunca rodam a conferência
real: a sessão roda uma rodada por vez e passa o resultado a eles (contracts/real-trees-run.md).

**Independent Test**: cada lote fecha sozinho (a sua sub-fase); a fase inteira fecha com `just trees all` dando 289
passaram e as 289 revisões aprovadas no hash atual, fixadas no CI por `DONE_LOTS`.

**O teste que falha primeiro, em cada lote**: a trava sobre os rascunhos recém-gerados reprova todos por pendência. O
lote só fecha quando a trava passa, o Vinicius aprova na galeria e o lote entra em `DONE_LOTS` no CI.

### Phase 7.0: O gerador de rascunho

**Independent Test**: no jogo inventado, o rascunho de um bloco tem os pools, as fontes, as constantes e os filhos na
ordem do gabarito, os nomes com prova e as pendências onde a máquina não prova; ele nunca passa na trava.

- [X] T059 [P] [US1] Testes do rascunho em `src/calculator/declared/draft.test.ts` (research R7; FR-004, FR-009; depende de T019)
  - Files: `src/calculator/declared/draft.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - os pools na ordem do gabarito; as fontes e as constantes de cada pool, na ordem, com a referência estruturada;
    - os filhos de cada fonte, um nível por vez, tirados das referências da expressão gravada, até as folhas que a gravação mostra; as partes da `not-leaves.ts` não viram filho;
    - o nome de cada linha das tabelas de texto, com a prova; sem prova → `name: null` e pendência `name`; o mesmo para `system`, `leaf` e `descend`;
    - a classe das fontes de talento;
    - `{character}` e `*` no lugar do índice do personagem; nenhum índice cru;
    - o rascunho carrega no estágio `draft` e a trava o reprova com `pending`;
    - um número com receita escrita não ganha rascunho (nunca sobrescreve);
    - o guia de passos (`stepsGuide`) só vai para `TREES_OUT`, e o rascunho não tem valor, conta nem texto de expressão;
    - o JSON do rascunho já sai como o prettier o deixaria.
- [X] T060 [US1] O gerador em `src/calculator/declared/draft.ts` e o modo `draft` da conferência real (contracts/real-trees-run.md; depende de T059)
  - Files: `src/calculator/declared/draft.ts`, `src/calculator/declared/real-trees-run.ts`, `src/calculator/declared/real-trees.integration.test.ts`
  - Signatures: `draftBlueprint(id: string, root: Blueprint["root"], key: AnswerKey, rec: Recording, ops: readonly Op[]): DraftBlueprint`; `stepsGuide(key: AnswerKey, rec: Recording, ops: readonly Op[]): string`.
  - Cases: os da T059; `just draft` sobre um id com receita escrita não toca o arquivo.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/draft.test.ts` - passa; `just check` - passa.

### Phase 7.1: Lote W1 (22 números)

**Independent Test**: os 22 números de W1 passam na trava sobre o jogo real e estão aprovados na galeria; o CI fixa o lote.

- [ ] T061 [sessão] [US1] Rascunho do lote W1: `just draft w1` e `just fmt`; depois `just trees w1` reprova os 22 por pendência (o teste que falha primeiro)
  - Files: `src/calculator/blueprints/w1/*.blueprint.json` (22 rascunhos); fora: `TREES_OUT/draft/<id>.steps.txt`
  - Signatures: nenhuma (dados).
  - Expected: `summary.txt` com 22 reprovados, motivo `pending`; `just check` passa (o estágio `draft` carrega).
- [ ] T062 [US1] Receitas do lote W1: agentes em paralelo, por sistema, completam os 22 rascunhos a partir de `TREES_OUT/draft/`, de `TREES_OUT/lock/` e do N.js (njs-index) (FR-002–FR-006, FR-018; depende de T061)
  - Files: `src/calculator/blueprints/w1/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: nenhuma pendência; todo nome com prova; todo sistema da tabela; toda folha com tipo; fonte de classe com `classes`; termo de duas fontes com `termPart`; condições declaradas; `just test-one src/calculator/declared/blueprints.test.ts` passa (carga e checagens de receita).
- [ ] T063 [sessão] [US2] Trava do lote W1: `just trees w1`, num processo só, e correções até os 22 passarem (FR-010, FR-021, SC-001)
  - Files: `src/calculator/blueprints/w1/*.review.json` (`lock`), receitas corrigidas; fora: `TREES_OUT/lock/`, `rules.md`, `alerts.json`, `changes.json`
  - Signatures: nenhuma (rodada)
  - Expected: 22 passaram; `rules.md` sem falha; cada conflito vai ao Vinicius com a tabela antes; partes fechadas pelo valor gravado anotadas, em queda.
- [ ] T064 [sessão] [US3] Galeria do lote W1: `just gallery w1` (FR-023–FR-025) — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/w1/*.review.json` (`verdict`, `note`, `history`)
  - Signatures: nenhuma (rodada)
  - Expected: abre em até 5 s; o topo traz as mudanças e "0 sem trava"; cada "Corrigir + nota" vira mudança de receita ou de regra registrada em `registro.md`, volta à T063 e à galeria com a contagem; no fim, 22 aprovadas no hash atual.
- [ ] T065 [US3] O lote W1 entra em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (FR-011, FR-024c; depende de T064)
  - Files: `src/calculator/declared/reviews.test.ts`; commit só com `src/calculator/blueprints/w1/` (receitas e revisões)
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
  - Cases: cada receita de W1 tem revisão com o hash atual, `lock.ok: true` e `verdict: "approved"`.
- [ ] T066 [sessão] [US2] Medida no fim do lote W1: `just trees all` sobre as receitas escritas (lição 1 da 009; FR-022)
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: `changes.json` sem mudança em árvores de lotes anteriores (cada uma que mudou volta à galeria do lote dela); tempo e memória da rodada em `registro.md`.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees w1` (PC do Vinicius) - 22 passaram, 0 reprovaram.

### Phase 7.2: Lote W2 (31 números)

**Independent Test**: os 31 números de W2 passam na trava e estão aprovados; o CI fixa o lote.

- [ ] T067 [sessão] [US1] Rascunho do lote W2: `just draft w2` e `just fmt`; `just trees w2` reprova os 31 por pendência
  - Files: `src/calculator/blueprints/w2/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 31 reprovados por `pending`; `just check` passa.
- [ ] T068 [US1] Receitas do lote W2, por agentes em paralelo (FR-002–FR-006, FR-018; depende de T067)
  - Files: `src/calculator/blueprints/w2/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T069 [sessão] [US2] Trava do lote W2: `just trees w2` e correções (FR-010, FR-021)
  - Files: `src/calculator/blueprints/w2/*.review.json`. Expected: 31 passaram; `rules.md` sem falha.
  - Signatures: nenhuma (rodada)
- [ ] T070 [sessão] [US3] Galeria do lote W2: `just gallery w2` — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/w2/*.review.json`. Expected: abre em até 5 s; 31 aprovadas no hash atual.
  - Signatures: nenhuma (rodada)
- [ ] T071 [US3] W2 em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (depende de T070)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/w2/`. Cases: os mesmos da T065.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T072 [sessão] [US2] Medida no fim do lote W2: `just trees all`
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: nenhuma árvore de W1 mudou sem voltar à galeria; tempo e memória em `registro.md`.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees w2` (PC do Vinicius) - 31 passaram.

### Phase 7.3: Lote W3 (29 números)

**Independent Test**: os 29 números de W3 passam na trava e estão aprovados; o CI fixa o lote.

- [ ] T073 [sessão] [US1] Rascunho do lote W3: `just draft w3` e `just fmt`; `just trees w3` reprova os 29 por pendência
  - Files: `src/calculator/blueprints/w3/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 29 reprovados por `pending`; `just check` passa.
- [ ] T074 [US1] Receitas do lote W3, por agentes em paralelo (depende de T073)
  - Files: `src/calculator/blueprints/w3/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T075 [sessão] [US2] Trava do lote W3: `just trees w3` e correções
  - Files: `src/calculator/blueprints/w3/*.review.json`. Expected: 29 passaram; `rules.md` sem falha.
  - Signatures: nenhuma (rodada)
- [ ] T076 [sessão] [US3] Galeria do lote W3: `just gallery w3` — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/w3/*.review.json`. Expected: abre em até 5 s; 29 aprovadas.
  - Signatures: nenhuma (rodada)
- [ ] T077 [US3] W3 em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (depende de T076)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/w3/`. Cases: os mesmos da T065.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T078 [sessão] [US2] Medida no fim do lote W3: `just trees all`
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: nenhuma árvore de W1 e W2 mudou sem voltar à galeria.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees w3` (PC do Vinicius) - 29 passaram.

### Phase 7.4: Lote W4 (22 números)

**Independent Test**: os 22 números de W4 passam na trava e estão aprovados; o CI fixa o lote.

- [ ] T079 [sessão] [US1] Rascunho do lote W4: `just draft w4` e `just fmt`; `just trees w4` reprova os 22 por pendência
  - Files: `src/calculator/blueprints/w4/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 22 reprovados por `pending`; `just check` passa.
- [ ] T080 [US1] Receitas do lote W4, por agentes em paralelo (depende de T079)
  - Files: `src/calculator/blueprints/w4/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T081 [sessão] [US2] Trava do lote W4: `just trees w4` e correções
  - Files: `src/calculator/blueprints/w4/*.review.json`. Expected: 22 passaram; `rules.md` sem falha.
  - Signatures: nenhuma (rodada)
- [ ] T082 [sessão] [US3] Galeria do lote W4: `just gallery w4` — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/w4/*.review.json`. Expected: abre em até 5 s; 22 aprovadas.
  - Signatures: nenhuma (rodada)
- [ ] T083 [US3] W4 em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (depende de T082)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/w4/`. Cases: os mesmos da T065.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T084 [sessão] [US2] Medida no fim do lote W4: `just trees all`
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: nenhuma árvore dos lotes anteriores mudou sem voltar à galeria.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees w4` (PC do Vinicius) - 22 passaram.

### Phase 7.5: Lote W5 (37 números)

**Independent Test**: os 37 números de W5 passam na trava e estão aprovados; o CI fixa o lote.

- [ ] T085 [sessão] [US1] Rascunho do lote W5: `just draft w5` e `just fmt`; `just trees w5` reprova os 37 por pendência
  - Files: `src/calculator/blueprints/w5/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 37 reprovados por `pending`; `just check` passa.
- [ ] T086 [US1] Receitas do lote W5, por agentes em paralelo (depende de T085)
  - Files: `src/calculator/blueprints/w5/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T087 [sessão] [US2] Trava do lote W5: `just trees w5` e correções
  - Files: `src/calculator/blueprints/w5/*.review.json`. Expected: 37 passaram; `rules.md` sem falha.
  - Signatures: nenhuma (rodada)
- [ ] T088 [sessão] [US3] Galeria do lote W5: `just gallery w5` — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/w5/*.review.json`. Expected: abre em até 5 s; 37 aprovadas.
  - Signatures: nenhuma (rodada)
- [ ] T089 [US3] W5 em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (depende de T088)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/w5/`. Cases: os mesmos da T065.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T090 [sessão] [US2] Medida no fim do lote W5: `just trees all`
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: nenhuma árvore dos lotes anteriores mudou sem voltar à galeria.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees w5` (PC do Vinicius) - 37 passaram.

### Phase 7.6: Lote W6 (61 números, o maior)

**Independent Test**: os 61 números de W6 passam na trava e estão aprovados; a galeria do maior lote abre em até 5 s.

- [ ] T091 [sessão] [US1] Rascunho do lote W6: `just draft w6` e `just fmt`; `just trees w6` reprova os 61 por pendência
  - Files: `src/calculator/blueprints/w6/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 61 reprovados por `pending`; `just check` passa.
- [ ] T092 [US1] Receitas do lote W6, por agentes em paralelo (depende de T091)
  - Files: `src/calculator/blueprints/w6/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T093 [sessão] [US2] Trava do lote W6: `just trees w6` e correções
  - Files: `src/calculator/blueprints/w6/*.review.json`. Expected: 61 passaram; `rules.md` sem falha; o pico de memória da rodada anotado.
  - Signatures: nenhuma (rodada)
- [ ] T094 [sessão] [US3] Galeria do lote W6: `just gallery w6` (research, "Medidas": o maior lote) — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/w6/*.review.json`. Expected: abre em até 5 s com 61 cartões (FR-024); 61 aprovadas.
  - Signatures: nenhuma (rodada)
- [ ] T095 [US3] W6 em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (depende de T094)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/w6/`. Cases: os mesmos da T065.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T096 [sessão] [US2] Medida no fim do lote W6: `just trees all`
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: nenhuma árvore dos lotes anteriores mudou sem voltar à galeria.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees w6` (PC do Vinicius) - 61 passaram; `just gallery w6` - abre em até 5 s.

### Phase 7.7: Lote W7 (48 números)

**Independent Test**: os 48 números de W7 passam na trava e estão aprovados; o CI fixa o lote.

- [ ] T097 [sessão] [US1] Rascunho do lote W7: `just draft w7` e `just fmt`; `just trees w7` reprova os 48 por pendência
  - Files: `src/calculator/blueprints/w7/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 48 reprovados por `pending`; `just check` passa.
- [ ] T098 [US1] Receitas do lote W7, por agentes em paralelo (depende de T097)
  - Files: `src/calculator/blueprints/w7/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T099 [sessão] [US2] Trava do lote W7: `just trees w7` e correções
  - Files: `src/calculator/blueprints/w7/*.review.json`. Expected: 48 passaram; `rules.md` sem falha.
  - Signatures: nenhuma (rodada)
- [ ] T100 [sessão] [US3] Galeria do lote W7: `just gallery w7` — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/w7/*.review.json`. Expected: abre em até 5 s; 48 aprovadas.
  - Signatures: nenhuma (rodada)
- [ ] T101 [US3] W7 em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (depende de T100)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/w7/`. Cases: os mesmos da T065.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T102 [sessão] [US2] Medida no fim do lote W7: `just trees all`
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: nenhuma árvore dos lotes anteriores mudou sem voltar à galeria.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees w7` (PC do Vinicius) - 48 passaram.

### Phase 7.8: Lote Personagem (32 números, o Drop Rate já aprovado)

**Independent Test**: os 32 números do lote Personagem passam na trava com um personagem de cada classe do retrato e
estão aprovados; o cartão do Drop Rate aparece já aprovado se o hash dele não mudou.

- [ ] T103 [sessão] [US1] Rascunho do lote Personagem: `just draft character` e `just fmt` (31 rascunhos; o Drop Rate já é receita escrita); `just trees character` reprova os 31 por pendência
  - Files: `src/calculator/blueprints/character/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 31 reprovados por `pending`, o Drop Rate passa; `just check` passa.
- [ ] T104 [US1] Receitas do lote Personagem, por agentes em paralelo, com atenção às fontes de classe (FR-002a; depende de T103)
  - Files: `src/calculator/blueprints/character/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; toda fonte de talento de classe com `classes`; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T105 [sessão] [US2] Trava do lote Personagem: `just trees character` e correções, com uma rodada por classe do retrato (FR-002a)
  - Files: `src/calculator/blueprints/character/*.review.json`. Expected: 32 passaram em todas as classes; nenhum `classMismatch`.
  - Signatures: nenhuma (rodada)
- [ ] T106 [sessão] [US3] Galeria do lote Personagem: `just gallery character` — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/character/*.review.json`. Expected: abre em até 5 s; o Drop Rate marcado se o hash não mudou; 32 aprovadas.
  - Signatures: nenhuma (rodada)
- [ ] T107 [US3] Personagem em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts` (sai `stats-drop-rate` de `DONE_IDS`), com o commit de dados do lote (depende de T106)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/character/`. Cases: os mesmos da T065.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T108 [sessão] [US2] Medida no fim do lote Personagem: `just trees all`
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: nenhuma árvore dos lotes anteriores mudou sem voltar à galeria.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa; `just trees character` (PC do Vinicius) - 32 passaram.

### Phase 7.9: Lote Conta (7 números)

**Independent Test**: os 7 números do lote Conta passam na trava e estão aprovados; as 289 estão em `DONE_LOTS`.

- [ ] T109 [sessão] [US1] Rascunho do lote Conta: `just draft account` e `just fmt`; `just trees account` reprova os 7 por pendência
  - Files: `src/calculator/blueprints/account/*.blueprint.json`; fora: `TREES_OUT/draft/`
  - Signatures: nenhuma (dados). Expected: 7 reprovados por `pending`; `just check` passa.
- [ ] T110 [US1] Receitas do lote Conta, por agentes em paralelo (depende de T109)
  - Files: `src/calculator/blueprints/account/*.blueprint.json`
  - Signatures: nenhuma (dados)
  - Cases: os mesmos da T062; `just test-one src/calculator/declared/blueprints.test.ts` passa.
- [ ] T111 [sessão] [US2] Trava do lote Conta: `just trees account` e correções
  - Files: `src/calculator/blueprints/account/*.review.json`. Expected: 7 passaram; `rules.md` sem falha.
  - Signatures: nenhuma (rodada)
- [ ] T112 [sessão] [US3] Galeria do lote Conta: `just gallery account` — **Parada:** o Vinicius aprova
  - Files: `src/calculator/blueprints/account/*.review.json`. Expected: abre em até 5 s; 7 aprovadas.
  - Signatures: nenhuma (rodada)
- [ ] T113 [US3] Conta em `DONE_LOTS` de `src/calculator/declared/reviews.test.ts`, com o commit de dados do lote (depende de T112)
  - Files: `src/calculator/declared/reviews.test.ts`, `src/calculator/blueprints/account/`. Cases: os mesmos da T065; os 9 lotes em `DONE_LOTS`.
  - Signatures: nenhuma nova (`DONE_LOTS` ganha o lote)
- [ ] T114 [sessão] [US2] Medida no fim dos lotes: `just trees all` sobre as 289 (SC-001, SC-004)
  - Files: fora: `TREES_OUT/changes.json`, `TREES_OUT/summary.txt`; o `registro.md` da feature; revisões de lotes anteriores só se uma árvore deles mudou
  - Signatures: nenhuma (rodada)
  - Expected: 289 passaram; `rules.md` sem falha nem conflito aberto; `changes.json` sem mudança não aprovada; tempo e memória da rodada inteira em `registro.md`.

**Checkpoint da Fase 7**: `just check` passa; as 289 receitas completas, travadas e aprovadas no hash atual.

Verify: `just test-one src/calculator/declared/reviews.test.ts` - passa, 9 lotes em `DONE_LOTS`; `just check` - passa; `just trees all` (PC do Vinicius) - 289 passaram, 0 reprovaram.

---

## Phase 8: User Story 5 - Atualização do jogo que muda uma conta (Priority: P3)

**Goal**: a trava no modo `runtime` vira alertas estruturados; o main os confere e grava no log como `treeNotClosing`;
a árvore nunca ganha linha (FR-015, FR-019). Só código, sem mudar a tela: pode correr junto com a Fase 7.

**Independent Test**: no jogo inventado, uma gravação com uma fonte a mais que a receita dá o alerta `extraInGame` com o
número, o nível e a diferença, e a árvore montada tem as mesmas linhas; o `tree-host` transforma o alerta numa entrada
de log e descarta um alerta fora da forma.

### Tests for User Story 5 (write first)

- [ ] T115 [P] [US5] Testes do modo `runtime` em `src/calculator/declared/lock-runtime.test.ts` (FR-019, SC-006; research R16; depende de T029)
  - Files: `src/calculator/declared/lock-runtime.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - uma fonte que o jogo passou a ter → `extraInGame` com a `refKey`; uma que o jogo deixou de usar → `missingInGame`; um nível que não fecha → `notClosing` com a diferença relativa; pools fora da ordem → `poolOrder` com a ordem do jogo;
    - até 50 alertas; nenhum nome de personagem nem expressão;
    - a árvore montada da mesma gravação tem as mesmas linhas da receita e mostra o valor do jogo em cada uma.
- [ ] T116 [P] [US5] Testes do alerta no main em `src/main/tree-host.test.ts` e `src/main/formula-answer.test.ts` (FR-019; contracts/tree-worker.md)
  - Files: `src/main/tree-host.test.ts`, `src/main/formula-answer.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases: um `treeResult` com `alerts` válidos vira uma entrada `{ event: "treeNotClosing", id, level, kind, diff }` por alerta; um `kind` fora da lista, um `level` maior que um id de nó, um `diff` não finito ou uma `refKey` acima de 200 caracteres ou com nome de personagem são descartados, e a árvore segue; mais de 50 alertas → só os 50 primeiros; um `treeResult` sem `alerts` não loga nada.

### Implementation for User Story 5

- [ ] T117 [US5] O modo `runtime` em `src/calculator/declared/lock.ts` (depende de T115)
  - Files: `src/calculator/declared/lock.ts` (ou `lock-runtime.ts`, se passar de 400 linhas)
  - Signatures: `lockBlueprint(input: LockInput, mode: "runtime"): ClosureAlert[]`; `interface ClosureAlert { level: string; kind: "notClosing" | "missingInGame" | "extraInGame" | "poolOrder"; diff: number | string }`.
  - Cases: os da T115, que esta tarefa faz passar.
- [ ] T118 [US5] O alerta no main: `src/main/tree-host.ts` e o `FormulaLog` de `src/main/formula-answer.ts` (depende de T116)
  - Files: `src/main/tree-host.ts`, `src/main/formula-answer.ts`, `src/main/pipelines.ts`, `src/main/formula-pipeline.ts`
  - Signatures: `onTree(id: number, tree: unknown, extra?: { log?: "chainOpen"; alerts?: unknown })`; `checkAlerts(raw: unknown, names: readonly string[]): ClosureAlert[]`; `FormulaLog` ganha `{ event: "treeNotClosing"; id: string; level: string; kind: string; diff: number | string }`. O `chainOpen` sai na troca (T123), com o motor antigo.
  - Cases: os da T116, que esta tarefa faz passar.
- [ ] T119 [US5] A conferência real escreve os alertas em `TREES_OUT/alerts.json` (SC-006; depende de T117)
  - Files: `src/calculator/declared/real-trees-run.ts`, `src/calculator/declared/real-trees-run.test.ts` (primeiro)
  - Signatures: `writeAlerts(out: string, alerts: Readonly<Record<string, ClosureAlert[]>>): void`
  - Cases: os mesmos alertas que o app grava, por número; um número sem alerta não entra.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/declared/lock-runtime.test.ts` - passa; `just test-one src/main/tree-host.test.ts` - passa; `just check` - passa.

---

## Phase 9: User Story 1 - A troca: o app mostra as árvores declaradas (Priority: P1)

**Goal**: o worker de árvores passa a usar `declared/`; o catálogo do app vira os 289; o portão das revisões exige as
289 aprovadas (FR-011, FR-012, FR-017, FR-029). **Mesmo release da Fase 10**: as chaves das peças mudam aqui, e a
limpeza dos Pins e marcas da 0.9 vem lá; o PR de versão só entra depois das duas.

**Independent Test**: no jogo inventado, um pedido `number` de um id do catálogo de 289 devolve a árvore declarada, um
`expand` devolve o nível guardado sem gravar de novo, um id sem receita completa dá `unknownNumber`, e uma gravação com
uma fonte a mais que a receita dá o alerta no log sem linha extra; a aba Fórmulas lista os 289 nos grupos da FR-038.

### Tests for User Story 1 (write first)

- [ ] T120 [P] [US1] Testes do motor declarado em `src/calculator/tree-engine.test.ts` e `src/calculator/index.test.ts` (FR-012, FR-017, FR-019, FR-029; contracts/tree-worker.md; depende de T038, T117)
  - Files: `src/calculator/tree-engine.test.ts`, `src/calculator/index.test.ts` (os casos que fixam a forma adivinhada são trocados pelos da receita, pela mudança aprovada na spec, FR-012 e FR-027; nenhum some sem um caso que confira o mesmo contrato)
  - Signatures: nenhuma (só teste)
  - Cases:
    - `number` grava, extrai o gabarito, roda a trava `runtime` e monta pela receita; os pools vêm `lazy`;
    - `expand` devolve o nível guardado sem gravar; um worker novo recebe o último `number` antes do `expand`;
    - id fora do catálogo ou receita não `complete` → `unknownNumber`;
    - `shape` caminha a árvore declarada inteira, sem as fontes de outras classes;
    - `values` não muda;
    - `alerts()` toma o lugar de `log()`; o `treeResult` leva `alerts` só quando há diferença;
    - a gravação inventada com uma fonte a mais que a receita: o alerta chega ao log, e a árvore não ganha linha (US5, SC-006).
- [ ] T121 [P] [US1] Testes do catálogo de 289 em `src/shared/tree-catalog.test.ts`, `src/calculator/catalog-names.test.ts`, `src/calculator/declared/blueprints.test.ts` e `src/main/formula-answer.test.ts` (FR-001, FR-029; research R18)
  - Files: os quatro acima
  - Signatures: nenhuma (só teste)
  - Cases:
    - o catálogo do app tem exatamente os 289 números `arvore` de `docs/catalogo/numeros.json`, com o `id` dele; os grupos na ordem Character, Account, W1 … W7;
    - toda receita tem número no catálogo, e todo número do catálogo tem receita `complete`;
    - o nome na tela é o `nome` do catálogo validado;
    - o Drop Rate da árvore nova (`stats-drop-rate`) continua conferido contra o número da Stats (`statsNumber`, a divergência da 008).
- [ ] T122 [P] [US1] Testes dos caminhos de falha com a árvore na tela (lição 5 da 009) em `src/main/formula-pipeline-branches.test.ts` e `src/main/formula-pipeline-host.test.ts`
  - Files: os dois acima
  - Signatures: nenhuma (só teste)
  - Cases: receita inválida (`unknownNumber`) → árvore indisponível com log; alerta → a árvore aberta não muda e o log ganha a entrada; falha do worker → indisponível e uma nova tentativa; jogo fechado → a última leitura (`stale`); troca de personagem para outra classe → a árvore refeita sem as fontes da classe anterior; um valor que muda ao vivo atualiza a linha sem mudar a forma (FR-017, NFR-002).

### Implementation for User Story 1

- [ ] T123 [US1] O `src/calculator/tree-engine.ts` passa a usar `declared/`, e o `chainOpen` sai (depende de T120)
  - Files: `src/calculator/tree-engine.ts`, `src/calculator/index.ts`, `src/main/tree-host.ts`, `src/main/formula-answer.ts`
  - Signatures: `createTreeEngine(code: string, pak: Uint8Array, blueprints?: ReadonlyMap<string, Blueprint>): TreeEngine`; `TreeEngine.alerts(): ClosureAlert[]` no lugar de `log()`; `FormulaLog` perde `chainOpen`.
  - Os valores da raiz, dos pools e dos termos vêm do gabarito; os dos filhos, da gravação; o `values` e o ao vivo como na 009 (FR-017).
  - Cases: os da T120 e da T122, que esta tarefa faz passar.
- [ ] T124 [US1] O catálogo de 289: `scripts/catalog/number-catalog.ts`, `scripts/catalog/app-fields.json` e o `src/shared/number-catalog.json` gerado (research R18; depende de T121)
  - Files: `scripts/catalog/number-catalog.ts`, `scripts/catalog/app-fields.json`, `src/shared/number-catalog.json` (gerado, nunca à mão), `src/shared/tree-catalog.ts` (o comentário do topo), `src/shared/stats-text.ts` (o elo dos ids novos da Stats)
  - Signature: `node scripts/catalog/number-catalog.ts` lê `docs/catalogo/numeros.json` e `app-fields.json` e escreve o JSON; o `app-fields.json` (sistema em inglês, `screen`, `notShown`, `live`) é semeado uma vez, casando cada número com o catálogo de hoje pela chamada da raiz, e o `live` conferido pela sonda das raízes (T026).
  - Cases: os da T121; rodar o gerador duas vezes dá o mesmo arquivo.
- [ ] T125 [US1] Os testes que dependem do catálogo passam a valer para os 289, sem enfraquecer o que eles fixam (depende de T124)
  - Files: `src/renderer/FormulasTab.test.tsx`, `src/renderer/SystemPanel.test.tsx`, `src/renderer/modules/system-panels.test.ts`, `src/renderer/SidePanel.test.tsx`, `src/renderer/PatchBand.test.tsx`, `src/main/feeds-index.test.ts`, `src/main/radar.test.ts`, `src/main/live-values.test.ts`, `src/main/formula-pipeline-feeds.test.ts`, `src/main/formula-pipeline-values.test.ts`, `src/main/pipelines-feeds.test.ts`
  - Signatures: nenhuma (testes)
  - Cada caso troca o id antigo por um id do catálogo de 289 com o mesmo papel (número da Stats, número vivo, número com painel); nenhum caso sai sem outro que confira o mesmo.
  - Cases: as mesmas afirmações de antes, sobre ids do catálogo de 289; a contagem de casos de cada arquivo não cai.
- [ ] T126 [US1] A faixa de versão passa a conferir o `gameSha` das revisões (research R19; FR-018 da 008)
  - Files: `src/main/version-band.ts` (`RULES_GAME_SHA` = o `lock.gameSha` comum às 289 revisões), `src/calculator/declared/reviews.test.ts` (primeiro: todas as revisões têm o mesmo `gameSha`, igual ao `RULES_GAME_SHA`)
  - Signatures: `RULES_GAME_SHA: string | null` (muda o valor, não a forma)
  - O app continua sem importar as revisões (contracts/review.md); o teste amarra as duas.
  - Cases: todas as revisões com o mesmo `gameSha`, igual ao `RULES_GAME_SHA`; o `version-band.test.ts` passa sem mudança de caso.
- [ ] T127 [US1] O portão das revisões ligado em `src/calculator/declared/reviews.test.ts` (FR-011, FR-029, SC-001, SC-002)
  - Files: `src/calculator/declared/reviews.test.ts`
  - Signatures: nenhuma (só teste; `DONE_LOTS` passa a vir do catálogo)
  - Cases: `DONE_LOTS` vira "todos os lotes do catálogo", tirado de `docs/catalogo/numeros.json`; uma receita mudada sem nova trava e nova aprovação deixa o CI vermelho.

**Checkpoint**: `just check` passa.

Verify: `just test-one src/calculator/tree-engine.test.ts` - passa; `just test-one src/shared/tree-catalog.test.ts` - passa; `just test-one src/calculator/declared/reviews.test.ts` - passa; `just check` - passa.

---

## Phase 10: User Story 6 - Troca da forma antiga: os Pins e marcas da 0.9 (Priority: P3)

**Goal**: os arquivos salvos passam à versão 2; na primeira abertura, os da versão 1 são apagados e, se havia ao menos um
Pin ou uma marca, a faixa aparece uma vez (FR-028). Mesmo release da Fase 9.

**Independent Test**: com um `pins.json` e um `marks.json` da versão 1 na pasta de dados, o main os apaga (com o `.tmp` e
o `.bad`), grava `oldTreesNotice: "pending"`, a janela mostra a faixa com o texto da FR-028, e depois de fechada ela não
volta; nenhum outro arquivo é tocado.

### Tests for User Story 6 (write first)

- [ ] T128 [P] [US6] Testes da limpeza em `src/main/old-trees.test.ts` (contracts/saved-files.md; FR-028)
  - Files: `src/main/old-trees.test.ts`
  - Signatures: nenhuma (só teste)
  - Cases:
    - versão 1 → apagado, com o `<nome>.tmp` e o `<nome>.bad`; nada levado para a versão 2;
    - versão 2 → nada muda; outra forma → vira `.bad`, como hoje;
    - `marks.json` ou `pins.json` com ao menos uma marca ou um pin → `oldTreesNotice: "pending"`; vazios → sem faixa; só o `tree-shapes.json` → sem faixa;
    - nenhum outro arquivo da pasta, nem fora dela, é tocado (a pasta do teste tem um arquivo a mais, que fica);
    - um arquivo travado → a limpeza segue com os outros, a próxima abertura tenta de novo, e o main não o lê como versão 2;
    - um erro de leitura, remoção ou gravação vira aviso no log; nunca cai.
- [ ] T129 [P] [US6] Testes da versão 2 e da chave nova em `src/main/saved-files.test.ts`, `src/main/saved-files-shapes.test.ts` e `src/main/settings.test.ts`
  - Files: os três acima
  - Signatures: nenhuma (só teste)
  - Cases: `marks.json`, `pins.json` e `tree-shapes.json` gravam e leem `version: 2`; um arquivo da versão 1 não é lido como válido; `oldTreesNotice` é chave só do main, fora de `Settings`, mantida quando o zoom ou a vista são gravados, e tirada pelo fechamento da faixa (`.tmp` + rename).
- [ ] T130 [P] [US6] Testes dos canais em `src/shared/types.test.ts`, `src/main/payloads.test.ts`, `src/preload/api.test.ts` e `src/preload/channel.test.ts` (contracts/ipc.md)
  - Files: os quatro acima
  - Signatures: nenhuma (só teste)
  - Cases: `IPC` ganha `notice:oldTrees` e `notice:dismissOldTrees`; o fechamento sem corpo é aceito e com qualquer payload é recusado; `notice:oldTrees` tem replay da última no preload, como o `radar:update`.
- [ ] T131 [P] [US6] Testes da faixa em `src/renderer/OldTreesBand.test.tsx` e `src/renderer/App.test.tsx` (FR-028)
  - Files: os dois acima
  - Signatures: nenhuma (só teste)
  - Cases: o texto exato "Pins and marks from the old trees were removed: the trees were rebuilt."; região `status`; botão "Close" com nome e alcançável pelo teclado; ao fechar, a faixa some e manda `notice:dismissOldTrees`; com `{ show: false }`, nada aparece; no `App`, a faixa fica no topo, no lugar das outras faixas.

### Implementation for User Story 6

- [ ] T132 [US6] A versão 2 em `src/main/saved-files.ts` e a chave em `src/main/settings.ts` (depende de T129)
  - Files: `src/main/saved-files.ts`, `src/main/settings.ts`
  - Signatures: `loadOldTreesNotice(file: string): boolean`; `saveOldTreesNotice(file: string, pending: boolean): boolean` (falso quando a gravação falhou).
  - Cases: os da T129, que esta tarefa faz passar.
- [ ] T133 [US6] A limpeza em `src/main/old-trees.ts`, chamada pelo `src/main/index.ts` antes de ler os três arquivos, e os canais (depende de T128, T130, T132)
  - Files: `src/main/old-trees.ts`, `src/main/index.ts`, `src/main/payloads.ts`, `src/shared/types.ts`, `src/preload/api.ts`
  - Signature: `cleanOldTrees(dataDir: string, log: (warning: string) => void): { notice: boolean }`.
  - Se o `settings.json` não puder ser gravado, a faixa aparece nesta sessão pelo resultado em memória.
  - Cases: os da T128 e da T130, que esta tarefa faz passar.
- [ ] T134 [US6] A faixa em `src/renderer/OldTreesBand.tsx`, no topo do `src/renderer/App.tsx` (depende de T131, T133)
  - Files: `src/renderer/OldTreesBand.tsx`, `src/renderer/App.tsx`
  - Signatures: `OldTreesBand(props: { show: boolean; onDismiss: () => void }): JSX.Element | null`
  - Cada arquivo abaixo de 400 linhas.
  - Cases: os da T131, que esta tarefa faz passar.

**Checkpoint**: `just check` passa; as Fases 9 e 10 entram no mesmo release.

Verify: `just test-one src/main/old-trees.test.ts` - passa; `just test-one src/renderer/OldTreesBand.test.tsx` - passa; `just check` - passa.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: tirar a forma adivinhada, documentar e conferir tudo no jogo real com o app empacotado.

**Independent Test**: `src/calculator/tree/` não existe, `just check` passa, e no PC do Vinicius o app empacotado abre o
Drop Rate em até 5 s, com 0 "no name yet", "Game value" e "Other" nas 289.

- [ ] T135 A saída da forma antiga, num commit próprio (FR-027; research R17; depende de T123)
  - Files: apagados com os testes deles: `src/calculator/tree-build.ts`, o resto de `src/calculator/tree/`, `src/calculator/tree-roots.ts`, `src/calculator/root-calls.json`, `src/calculator/parity*.ts`, e também `src/calculator/names/`, `game-names.ts` e `names-reader.js`, se o gerador de rascunho não os usar (nesse caso ficam só para ele, fora do worker do app: spec, Open Questions, 21/11); o tipo `TreeRoot` de que o `tree-recipe.ts` precisa muda para `tree-record.ts`; `.env.example` perde os `PARITY_*`.
  - Signatures: nenhuma nova; `TreeRoot` passa a ser exportado de `tree-record.ts`
  - Cases: `just check` passa; nenhum import para um arquivo apagado; `just arch` passa; a lista de testes apagados vai na descrição do PR, cada um com o código que ele testava.
- [ ] T136 [P] `ARCHITECTURE.md`: o motor declarado, as receitas como dado, a revisão, a ferramenta da galeria, as regras do dependency-cruiser e o que saiu (constituição, Architecture; depende de T135)
  - Files: `ARCHITECTURE.md`
  - Signatures: nenhuma (documentação)
  - A tabela de pastas ganha `declared/`, `blueprints/`, `recorded/`, `names/`, `scripts/gallery/` e `scripts/catalog/`, e perde `tree/`; liga as ADRs 0009 a 0012.
  - Cases: todo caminho e toda pasta citados existem depois da T135; nenhuma menção a `tree/` como pasta viva.
- [ ] T137 [P] `GLOSSARY.md`: Blueprint (receita), Answer key (gabarito), Lock (trava), Shape rule, Closure alert e Gallery; o ajuste de Pool, System group e Tree piece
  - Files: `GLOSSARY.md`
  - Signatures: nenhuma (documentação)
  - Cases: cada termo com uma frase e o nome no código (`blueprint`, `answerKey`, `lockBlueprint`, `ClosureAlert`).
- [ ] T138 [P] As ADRs 0009 a 0012 (escritas no plano) conferidas contra o que foi feito
  - Files: `docs/adr/0008-a-second-worker-records-formula-trees.md` (a nota de substituição parcial pela 0009), `docs/adr/0009` a `0012` só se algo mudou na implementação
  - Signatures: nenhuma (documentação)
  - Cases: cada ADR descreve o que o código faz depois da T135; a 0008 aponta para a 0009.
- [ ] T139 [sessão] Rodada final sobre o jogo real: `just trees all` (SC-001, SC-004, SC-006; depende de T127)
  - Files: `src/calculator/blueprints/**/*.review.json` (o `lock` da rodada); fora: `TREES_OUT/summary.txt`, `rules.md`, `alerts.json`; o `registro.md` da feature
  - Signatures: nenhuma (rodada)
  - Expected: 289 passaram; `rules.md` sem falha nem conflito aberto; `alerts.json` vazio no jogo do retrato; tempo e memória da rodada em `registro.md`.
- [ ] T140 [sessão] O app empacotado no jogo real, pelo quickstart (US1 a US6) (NFR-001, NFR-002, SC-003, SC-005; depende de T134, T139)
  - Files: nenhum arquivo do repositório; o instalador de `just package`; o `registro.md` da feature
  - Signatures: nenhuma (rodada)
  - Expected:
    - o Drop Rate em até 5 s e a Stats abaixo de 1 s com a árvore aberta;
    - os valores ao vivo a cada leitura de 1 s;
    - um Pin e uma marca da 0.9 dão a faixa uma vez;
    - a contagem de "no name yet", "Game value" e "Other" nas 289 árvores = 0;
    - o resultado em `registro.md`.
- [ ] T141 [sessão] Pendência do fim levada ao Vinicius: a regra `declared-not-guessed`, que fica sem objeto depois da T135
  - Files: `spec.md` (linha `resolved` de Open Questions, "durante a implementação", quando só esclarece); mudar a regra é mudança do portão, num PR próprio, com o sim dele.
  - Signatures: nenhuma (decisão)
  - Cases: a resposta registrada; nenhuma edição do portão nesta tarefa.

**Checkpoint**: `just check` passa.

Verify: `just check` - passa; `just trees all` (PC do Vinicius) - 289 passaram, 0 reprovaram; o app empacotado - Drop Rate em até 5 s, 0 "no name yet", "Game value" e "Other".

---

- [ ] T142 [US5] Tirar o radar de patch da 008 (spec Out of Scope; research R19; FR-019 assume o papel dele; depende de T120)
  - Files: `src/main/radar.ts`, `src/main/radar.test.ts`, `src/renderer/PatchBand.tsx` e o teste dele, `src/shared/types.ts` (`radar:update`, `radar:dismiss`, `RadarUpdate`), `src/preload/api.ts`, `src/renderer/App.tsx`, `src/main/pipelines.ts`, `src/main/formula-pipeline.ts`, `src/main/formula-pipeline-api.ts`, `src/main/saved-files.ts` (só o que é do radar)
  - Signatures: saem `radar:update`, `radar:dismiss` e `RadarUpdate`; o `tree-shapes.json` e o pedido `shape` ficam, porque Onde isto entra usa os dois.
  - Cases (testes primeiro): o IPC não tem mais os canais do radar; o preload não expõe `onRadar`; a janela não desenha a faixa do radar numa troca de versão do jogo; Onde isto entra continua lendo as formas.
  - Apagar `radar.test.ts` e o teste do `PatchBand` junto com o código que eles testam é mudança de teste existente: só com o sim do Vinicius, pedido na parada desta fase.

## Dependencies & Execution Order

### Phase Dependencies

- **Fase 0 (Done gate):** primeiro, com o commit antes de qualquer código.
- **Fase 1 (Setup):** depois da Fase 0.
- **Fase 2 (Fundação):** depois da Fase 1; bloqueia todas as histórias; fecha com a decisão das raízes (T026).
- **Fase 3 (US2):** depois da Fase 2.
- **Fase 4 (US1, piloto):** depois da Fase 3 (a montagem usa a trava).
- **Fase 5 (US3):** depois da Fase 4 (a galeria desenha a árvore montada).
- **Fase 6 (US4):** depois da Fase 4; as checagens de árvore leem a árvore montada.
- **Fase 7 (lotes):** depois das Fases 3 a 6; a 7.0 primeiro, depois os lotes em série, na ordem da FR-024a.
- **Fase 8 (US5):** depois da Fase 4; pode correr junto com a Fase 7 (só código).
- **Fase 9 (US1, a troca):** depois das Fases 7 e 8 (o portão exige as 289 aprovadas).
- **Fase 10 (US6):** depois da Fase 9; pode ser escrita junto com a Fase 7, mas só entra depois da 9; as duas no mesmo release.
- **Fase 11 (Polish):** por último.

### Within Each Phase

- Os testes primeiro, falhando; depois o código. Nos lotes, a trava sobre os rascunhos é o teste que falha primeiro.
- As dependências de cada tarefa estão na linha dela ("depende de …").
- Os dados (receitas e revisões) vão em commits próprios, separados da lógica.

### Parallel Opportunities

- Fase 1: T004, T007, T009 e T010.
- Fase 2: T011, T013, T015, T017, T020 e T021.
- Fase 3: T027, T028 e T031.
- Fase 4: T036 e T037.
- Fase 5: T042, T043, T044 e T050.
- Fase 6: T052 e T053.
- Fase 7: dentro de cada lote, os agentes de receita por sistema (T062, T068 …); a 7.0 (T059) pode começar junto com a Fase 6.
- Fases 7 e 8 juntas; a Fase 10 escrita durante a Fase 7.
- Fase 9: T120, T121 e T122. Fase 10: T128 a T131. Fase 11: T136, T137 e T138.
- Nunca em paralelo: duas rodadas `just trees`, `just draft` ou `just gallery`, nem dois processos de teste.

## Implementation Strategy

1. **MVP:** Fases 0 a 4: o Drop Rate de ponta a ponta no PC do Vinicius (gravação, gabarito, trava, montagem), o motor
   provado num número de verdade. O jogador ainda vê a árvore da 0.9.
2. **Aprovação e regras:** Fases 5 e 6, com o Drop Rate aprovado na galeria e as regras rodando.
3. **Escala:** Fase 7, lote a lote, cada um parando na galeria; a Fase 8 corre junto.
4. **Troca:** Fases 9 e 10, num release só, com as 289 aprovadas.
5. **Polish:** Fase 11 tira `src/calculator/tree/` e confere tudo no app empacotado.

Requirement coverage: toda FR, NFR e SC da spec é citada por ao menos uma tarefa acima.

## Notes

- **Pendências que vão ao Vinicius:** o sim de cada edição da Fase 0; as raízes fora da regra (T026); cada conflito de
  regras (T058 e as travas dos lotes); cada galeria (T051 e os lotes); as pendências do fim (T141).
- **Pontos que a implementação completa nos contratos:** o campo `pending` dos rascunhos (T014); a conferência do id do
  catálogo fica no CI, porque a calculadora não importa `src/shared/` (T014, T023); a faixa de versão lê um sha fixado
  por teste, porque o app não importa as revisões (T126).
- **Formatação:** todo JSON que as ferramentas gravam no repositório (rascunhos, revisões) já sai como o prettier o
  deixa, e o hash da receita é o da forma canônica, então `just fmt` nunca derruba uma aprovação.

## Review Focus

1. **Uma receita em esboço ou rascunho chegando à tela**: um jogador espera "sem árvore", nunca uma árvore com linhas sem
   nome ou pendentes. Fixado por "um esboço e um rascunho não são servidos" em `blueprints-load.test.ts`, tarefa T022,
   Fase 2, e por "receita não complete → unknownNumber" em `tree-engine.test.ts`, tarefa T120, Fase 9.
2. **Uma receita só reformatada perdendo a aprovação**: o Vinicius espera que `just fmt` ou outra ordem de chaves não
   derrube a galeria. Fixado por "a mesma receita reformatada tem o mesmo hash" em `review.test.ts`, tarefa T021, Fase 2.
3. **A referência `*` sem nenhuma leitura gravada** (nenhum personagem tem a fonte): o jogador espera a fonte em 0 ou ×1
   em cinza e a trava acusando, nunca um 0 silencioso que fecha por acaso. Fixado por "`*` sem nenhuma leitura →
   `childNoValue`" em `lock-levels.test.ts`, tarefa T028, Fase 3.
4. **Troca de personagem de outra classe com a árvore aberta**: o jogador espera que as fontes da classe anterior saiam,
   e que um grupo só some quando todas as fontes dele são de outras classes. Fixado por "trocar para um personagem de
   outra classe tira as fontes dela" em `assemble.test.ts`, tarefa T036, Fase 4, e pelo caminho de falha da T122, Fase 9.
5. **O Drop Rate perdendo a conferência contra a Stats na troca de ids** (`dropRate` → `stats-drop-rate`): o jogador
   espera o aviso de divergência da 008 como antes. Fixado por "`stats-drop-rate` continua conferido contra a Stats" em
   `formula-answer.test.ts`, tarefa T121, Fase 9.

### Security Criteria

- **T019** (gabarito): só lê a gravação; nunca chama função do jogo em execução nem grava no save (CHK001, FR-008).
- **T014, T024, T032 e os lotes** (receitas): só referência estruturada e texto do jogo com prova; nenhuma expressão,
  trecho de código, índice de personagem por extenso nem nome de personagem (CHK003, CHK006, FR-003, FR-007).
- **T029, T030, T033** (trava e conferência real): a conta remontada só em memória; a revisão leva só hash, `ok`,
  `gameSha` e horário; as saídas só em `TREES_OUT`, com o caminho tirado do id (CHK004, FR-010).
- **T025, T049, T050** (conferência real e galeria): nenhuma rede; a janela da galeria com `sandbox`, `contextIsolation`,
  CSP `default-src 'self'` e toda requisição http(s) cancelada; as imagens só em `TREES_OUT/img/` (CHK002, CHK005,
  NFR-004).
- **T021, T044, T047** (revisão e resposta da galeria): veredito da lista, nota até 2.000 caracteres e sem nome de
  personagem do retrato, revisão ao lado da receita, caminho tirado do id (CHK006, CHK007, FR-024c).
- **T128, T133** (limpeza): só os três arquivos do app e os `.tmp` / `.bad` deles, na pasta de dados do app (CHK008,
  FR-028).
- **T116, T118** (alertas): só número, nível, tipo e diferença, com rótulo e id; a forma conferida no main; nenhum código
  do jogo nem nome de personagem (CHK009, CHK010, FR-019).
