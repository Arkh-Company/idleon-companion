---
description: "Task list for 008-formula-trees"
---

# Tasks: Árvores de fórmula ao vivo e painéis por sistema (formula-trees)

**Input**: Design documents from `/specs/008-formula-trees/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ (tree-worker, ipc, saved-files), quickstart.md, prototipo/README.md

**Tests**: Tests are mandatory. Every task writes its tests first, and they must fail before the implementation exists.

**Organization**: one phase per user story of the spec, in priority order, after the Done gate, Setup and Foundational phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1…US13)
- **[sessão]**: applied by the main session (done-gate file or a check with the real game), never by the Executor

## Before Phase 1 (outside this tasks.md)

The five small changes of plan.md, "Antes da primeira fatia", each go through `/implementar` with its four-part text and its own PR, merged into `main` before Phase 1:
- `fix: companion level bonus`;
- `fix: status bar live region`;
- `feat: text zoom`;
- `fix: drop rate rounding`;
- `chore: ignore game data files`.

The constitution amendment of PR #26 is merged before the spec PR.

Nothing of the game nor of the save enters the repository in any task. Tests use the invented game (`src/calculator/fixtures/fake-game.js`), with invented names. The character appears as "Character N (class)" in every test, log and document; on the app's screen it shows by its real name (FR-010).

---

## Phase 0: Done gate

**Purpose**: the done-gate file this feature needs, applied by the session with the user's confirmation before the first phase of code.

**Independent Test**: `just --list` shows `parity`, and `just check` still passes with no parity test yet.

- [X] T001 [sessão] Add the `parity` recipe to `justfile` (approved by Vinicius, 13/11)
  - Files: `justfile`
  - Recipe: `parity:` runs `pnpm exec vitest run src/calculator/parity.integration.test.ts`, outside `check` and CI.
  - With no test file yet, the recipe only lists; `just check` does not call it.

Verify: `just --list` - shows `parity`; `just check` - passes.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: the new dependency and the invented game that every later test uses.

**Independent Test**: the invented game produces every case the trees need, and the parser is bundled into `calculator.js` with no dynamic import.

- [X] T002 Add `acorn@8.19.0` as a devDependency (research R2)
  - Files: `package.json` (`pnpm add -D acorn@8.19.0`, which also updates the lockfile)
  - Tests: `src/calculator/bundle.test.ts` (new, like `no-network.test.ts`) fails on any `import(` in `src/calculator/**` that is not a test.
- [X] T003 [P] Extend the invented game with the tree cases
  - Files: `src/calculator/fixtures/fake-game.js`, `src/calculator/fixtures/fake-mosaic.ts`
  - Blocks to add (invented names and numbers only):
    - a block with state reads;
    - a cache written by a helper;
    - a loop;
    - a text value and two invented character names, one a prefix of the other;
    - a string literal in the code;
    - a block called twice;
    - a call with several sources;
    - a `min` cap;
    - a decay curve with a maximum;
    - a ×1 multiplier;
    - a Condition that is "no";
    - a map actor with `_MonsterHPtot`;
    - two characters, with `PlayerDATABASE` keys of both kinds (same name and other name, research R5).
  - Tests: `fake-game.test.ts` checks that each case exists by name.

Verify: `just test-one src/calculator/bundle.test.ts` - passes; `just check` - passes.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: the contract, the second worker, its host, the request path, the parity pair and the last reading with the game closed. Nothing visible yet.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

**Independent Test**: with the invented game, a `number` request for the Drop Rate goes window → main → tree host → tree worker and back as a `ready` tree whose root equals the Stats number of the same mosaic. The Stats keeps answering under 1 s meanwhile.

- [X] T004 Create the tree contract in `src/shared/formula-tree.ts` and its pinned copy in the calculator
  - Files: `src/shared/formula-tree.ts`, `src/shared/index.ts`, `src/calculator/tree-contract.ts`, `src/calculator/tree-contract.test.ts`
  - Types:
    - `TreeNode`, `FormulaTree`, `TreeRequest`;
    - `LEAF_KINDS`, `CONDITION_KINDS`, `NODE_ROLES`, `LEAF_FAMILY`.

    Exactly as [data-model.md](data-model.md): no `sameAs`; `kids: TreeNode[] | "lazy"`; `cap?: "overTheCap" | "notReached"`; `maxReached?: { share: number; max: number }`; `feeds?: number`.
  - Tests:
    - **First:** change one field of the copy (`share: number | null` → `number`) and one `flags` field, and see `just typecheck` fail. If it does not, compare `Omit<…, "kids">` and pin `kids` apart.
    - The literals are pinned with `toEqual`.
- [X] T005 Extract the boot of the game context into `src/calculator/boot.ts` (refactor only)
  - Files: `src/calculator/boot.ts`, `src/calculator/engine.ts`
  - Signature: `bootContext(script: string, pak: Uint8Array, limits: { startMs: number; numberMs: number }): Context`; `lazyDnsmKeys` and `anchored(code)` exported from `boot.ts`.
  - Tests: `engine.test.ts` green before and after, with no assertion changed.
- [X] T006 Turn the six isolation tests into one table run on both workers (approved by Vinicius, 13/11)
  - Files: `src/calculator/engine.test.ts`
  - Tests: `describe.each` over two adapters, `(mosaic) => number`: the Stats one (`calculate()[id]`) and the tree one (the root of a `number` request). No assertion leaves (CODING_STANDARDS, "Test tables live once").
- [ ] T007 Create the catalog of numbers in `src/shared/tree-catalog.ts` and the roots in `src/calculator/tree-roots.ts`
  - Files: `src/shared/tree-catalog.ts`, `src/calculator/tree-roots.ts`, `src/calculator/tree-roots.test.ts`
  - Data:
    - `TREE_CATALOG: { id; system; screen: string | null; notShown: null | "cost" | "cap" | "chance" | "rate"; live: boolean }[]`, only the trees `ok` in the bench's `CATALOGO-008-status.json` (BASELINE-4), in the game's order: Character, Account, W1…W7, skills (FR-038);
    - `TREE_ROOTS: Record<id, [block: string, args: (string | number)[]]>` with the game's arity (traps 12 and 14 of the handoff).
  - Tests:
    - every catalog id has one root, and vice versa;
    - the 11 Stats ids have the same block and first argument as `TARGETS`;
    - no root text is a phrase of the game (only block names and simple arguments).
- [X] T008 Add the `init` in tree mode and the `tree` message to the worker entry
  - Files: `src/calculator/index.ts`, `src/calculator/index.test.ts`
  - Messages: as [contracts/tree-worker.md](contracts/tree-worker.md). An `init` without `mode` and the `calc` message answer exactly as today.
  - Tests (new cases only; the current cases stay intact):
    - `init` with `mode: "tree"` answers `ready`;
    - `tree` answers `treeResult` with `tree`, `refused: "unknownNumber"` or `failed`;
    - a failure carries no game text.
- [X] T009 Create the tree host in `src/main/tree-host.ts`
  - Files: `src/main/tree-host.ts`, `src/main/tree-host.test.ts` (style of `calculator-host.test.ts`)
  - Signature: `createTreeHost(deps: { createWorker; readFiles; onTree(id, result); onValues(id, values); onUnavailable(id) }): { setFiles; request; values; dropCurrent; stop; replay }`
  - Limits: heap 2 GB (`resourceLimits.maxOldGenerationSizeMb: 2048`); start and request timeouts as constants, measured again in T026.
  - Tests:
    - a character change or a loose reader drops the request but does **not** terminate the worker;
    - only a new `setFiles` or the game closing terminates it;
    - a request timeout terminates the worker and marks only that request `unavailable`; the next one starts another worker, with no lock;
    - the `hasVars` guard (FR-015 of 005) runs before sending a mosaic;
    - the host reads the game files again (`readGameFiles`), because the Stats worker transferred its bytes;
    - never two requests in flight: a new one replaces the waiting one;
    - a worker that dies once leaves `unavailable`, tries once more, and never touches the Stats (FR-017).
- [X] T010 Make the Stats host say which mosaic a result came from
  - Files: `src/main/calculator-host.ts`, `src/main/calculator-host.test.ts`
  - Signature: `onResult(numbers: CalcNumbers, mosaicJson: string)`, with the mosaic captured in `next()`.
  - Tests: two `onDue` during one calculation; the pair result + mosaic is never mixed.
- [X] T011 Keep the last reading with the game closed (FR-022; the 004 and 005 tests change, approved by Vinicius 13/11)
  - Files: `src/main/stats-pipeline.ts`, `src/main/stats.ts`, `src/shared/types.ts` (`Stats` gains `stale`), `src/renderer/StatsPanel.tsx`, and the existing tests that expect `unavailable` with the game closed (`stats-pipeline*.test.ts`, `StatsPanel.test.tsx`, `stats-tab.test.tsx`)
  - Behavior: the pipeline keeps the last `CalcNumbers`, the texts and `calculatedAt` in memory, never on disk. With the game closed it sends `ready` with `stale: true`, and the tab shows "last reading N s ago".
  - Tests:
    - the changed tests still check the game-closed case, with the new answer;
    - a character change still clears (no number of another character).
- [X] T012 Create the formula pipeline in `src/main/formula-pipeline.ts`
  - Files: `src/main/formula-pipeline.ts`, `src/main/formula-pipeline.test.ts`, `src/main/payloads.ts` (`formulaRequestPayload`), `src/main/link-routes.ts` (replay)
  - Signature: `startFormulaPipeline(deps: { send(tree: FormulaTree); sendValues(...); treeHost; statsPair(): { numbers; mosaicJson } | null; log })`
  - Behavior:
    - the request uses the Stats' result + mosaic pair, never the last `onDue`;
    - root ≠ Stats for the active character gives `{ state: "diverged", statsText }` and a structured log entry with label and id, no values, no names (FR-019);
    - a character change sends `{ state: "none" }` and asks the new character's tree by itself (FR-021);
    - no reading or no character gives `waiting` (FR-034);
    - the game closed gives `stale: true` (FR-022).
  - Tests: each case above; `formulaRequestPayload` refuses an id outside `TREE_CATALOG`, a non-number character and a `__proto__` key.
- [X] T013 Check what leaves the tree worker before it reaches the window (FR-010b)
  - Files: `src/main/tree-check.ts`, `src/main/tree-check.test.ts`
  - Signature: `checkTree(raw: unknown, maxNodes: number): TreeNode | null`
  - Tests:
    - a node with an unknown field, a wrong type, a code snippet in `formula` or `name`, or more than `maxNodes` nodes gives `null`;
    - the pipeline turns `null` into `unavailable` plus a log entry without values or names.
- [X] T014 Add the IPC channels and the preload methods
  - Files: `src/shared/types.ts` (`IPC`, `CompanionApi`), `src/shared/types.test.ts` (the `IPC` object pinned whole), `src/preload/index.ts`, `src/renderer/companion-stub.ts`, `src/main/index.ts` (wiring only, through a tested function)
  - Channels: `formula:request`, `formula:update`, `formula:close`, `formula:values`, `formula:liveValues`, `panel:update`, `marks:list`, `marks:save`, `marks:clear`, `pins:get`, `pins:set`, `farm:update`, `radar:update`, `radar:dismiss`, `window:sidePanel`, as in [contracts/ipc.md](contracts/ipc.md)
  - Tests: the `IPC` table; the stub has every new method; `formula:update` replays the last tree.

Verify: `just test-one src/main/formula-pipeline.test.ts` - passes; `just check` - passes.

---

## Phase 3: User Story 1 - Por que meu Drop Rate é X? (Priority: P1) 🎯 MVP

**Goal**: tapping the Drop Rate in the Stats opens its tree in a side panel. The root equals the Stats and the short answer has two lines. The game's steps carry their bonus names, branches open in place, and tags, types and math are shown.

**Independent Test**: with the invented game, tapping the value opens the side panel. The root equals the Stats text character by character, and opening a branch shows its children right below it. On the Vinicius's machine, `just parity` gives 0 differences against the BASELINE-4 Drop Rate, without compaction.

### Tests for User Story 1

> Write these tests FIRST, ensure they FAIL before implementation.

- [X] T015 [P] [US1] Instrumentation test in `src/calculator/instrument.test.ts`
  - Cases:
    - each arithmetic operator and each `min max pow floor ceil round abs log sqrt` becomes a step;
    - a block that does not parse keeps its code and its number;
    - nothing is written to disk during instrumentation: `node:fs` spied, no call (FR-011).
- [X] T016 [P] [US1] Recorder test in `src/calculator/recorder.test.ts`
  - Cases:
    - calls with arguments and children;
    - state reads;
    - the link from a cache read to its writer;
    - the read cap does not count the game's searches;
    - a lazy `DNSM` map is still created with instrumentation on;
    - the recorder is installed before the game runs, with `__X` off during boot;
    - the recording leaves the context only as JSON text;
    - the record switch is off again in `finally`;
    - the same call with the same arguments is the same piece in two recordings in a different order (FR-009, the lego).
- [ ] T017 [P] [US1] Assembly tests in `src/calculator/tree/*.test.ts`, with a written recorded fixture `src/calculator/tree/tree-fixture.ts` (invented names)
  - Cases:
    - "built once" (`UNDER_ROOT`), and a conflict is counted;
    - each name and type rule, in order (the first rule that matches wins), with the type test next to the name test;
    - each ⓘ shape, with 3 significant digits;
    - `share` by shape: sum, product, product with 0, `min`/`max` cap;
    - a repeated piece opens again with the same children (FR-015);
    - several sources on one row;
    - a step never named "fixed" and a step without a proven name gives `no name yet`;
    - a cap row gets `overTheCap` or `notReached`;
    - a decay curve with a maximum gets `maxReached`, and a curve without one gets none (FR-015a);
    - a ×1 multiplier goes to `atOne`;
    - a Condition "no" stays in the list;
    - a value of 0 goes to `atZero`;
    - a term without a name inside the math is the game's path (FR-012a);
    - the root is never a silent leaf (bench rule 147).
- [X] T018 [P] [US1] Atoms-only test in `src/calculator/tree-atoms.test.ts`
  - Case: the `treeResult` JSON of the invented game with a text value, two invented character names (one a prefix of the other) and a string literal in the code contains no code literal and no code snippet. The names are allowed only in `name` fields shown on screen (FR-010) and are absent from logs.
- [X] T019 [P] [US1] Side panel and tree view tests in `src/renderer/FormulaTree.test.tsx` and `src/renderer/SidePanel.test.tsx`
  - Cases:
    - tapping the Stats value (a `<button>` inside the `<td>`; the 004 `rowheader`/`row` tests stay as they are) opens the panel and asks `window:sidePanel` open;
    - ✕ closes it, asks it closed and gives the focus back to the number;
    - the short answer has two lines and only the line that exists when a tree has no sum or no multiplier;
    - full ARIA treeview: one Tab stop, ↑ ↓ → ← Home End Enter, `aria-level` = depth;
    - "calculating this part…" on a lazy branch;
    - every leaf has a tag and the family color plus text (FR-013);
    - "At 0 (N)", "At ×1 (N) · no effect yet", "Small (N)" and "Show all N parts" start closed;
    - the text "62% reached · max +40%";
    - at 210 px CSS nothing scrolls sideways (FR-031).

### Implementation for User Story 1

- [X] T020 [US1] Implement the instrumentation in `src/calculator/instrument.ts`
  - Signature: `instrument(source: string): { source: string; ops: Op[] }`. `ops[].fnText` and the AST never leave the worker. It runs on the original `N.js`, after the anchor swap and `lazyDnsmKeys` (`boot.ts`).
- [X] T021 [US1] Implement the recorder in `src/calculator/recorder.js` (inside `node:vm`, imported `?raw`)
  - It is installed before `game.runInContext`, with `__X` off during boot.
  - It records only on request: calls, reads, writes; `RECOMPUTE` and `BUILDERS`; helpers; roots with the game's arity; the builders' pass; `@read`; links. It uses the fixed `Math.random` seed and the companion bridge from the mosaic.
  - It uses no `eval`, `new Function`, `fetch`, `XMLHttpRequest`, `WebSocket` or `sendBeacon`.
  - Keep it under 400 lines by hand: the lint does not count `.js`.
- [ ] T022 [US1] Port the assembly into `src/calculator/tree/` (modules up to 400 lines each)
  - Files: `pieces.ts` (built once, conflicts), `kinds.ts` (`KIND_PATHS` before `RULES`), `names.ts` (the name rules with proof by reference; Names 2 before Names 1), `formulas.ts` (shapes and curves, 3 significant digits, constants named by role), `share.ts` (Share S), `mould.ts` (the Drop Rate mould: the game's steps by bonus name), `game-bugs.ts` (rules with proof)
  - Source: bench at BASELINE-4 (`99d1772`), cited by function and branch, never by line number.
  - The bench's `formulaOf` leaks method names and string literals; the port keeps only the closed `MATH` list and numbers.
  - Every rule row has a `proof` that is a reference, never quoted game text. `src/calculator/tree/rules.test.ts` fails on a rule without proof or with a quoted proof (FR-032).
- [ ] T023 [US1] Add the names table in `src/calculator/tree/names-table.ts` (research R3)
  - Data: `{ [pieceKey]: { name: string; proof: string } }`, generated from the bench's names export redone on the BASELINE-4 and reviewed by Vinicius before this phase closes.
  - Tests: a call named by the table; a call no rule nor the table names gives a generic name and `flags.unnamed`.
- [X] T024 [US1] Build the root and the first level, then branches on expand (research R4)
  - Files: `src/calculator/tree-build.ts`, `src/calculator/index.ts`
  - Signatures: `buildTree(recording, request): TreeNode` with unopened branches as `kids: "lazy"`; `expandBranch(recording, nodeId): TreeNode`.
  - The recording is kept for the same mosaic until the next request.
  - Tests: an `expand` does not rebuild the state; `calculatedAt` does not change.
- [X] T025 [US1] The window: Stats value as button, side panel, tree view, tags, groups and states
  - Files: `src/renderer/StatsPanel.tsx`, `src/renderer/SidePanel.tsx`, `src/renderer/FormulaTree.tsx`, `src/renderer/AnswerHeader.tsx`, `src/renderer/LeafTag.tsx`, `src/renderer/styles.css`, `src/main/window-options.ts`, `src/main/side-panel.ts`
  - The window widens from 420 to 840 px toward the side with room on screen and returns on close (FR-005), in a tested `side-panel.ts`.
  - The tokens, components and accessibility come from `design.md`; on any conflict, the spec wins (stage cards are out, "shown earlier" is out).
- [ ] T026 [US1] [sessão] Measure the compiled `calculator.js` on the real game (lessons 004-3, 005-2)
  - Run the packaged worker on the installed game with the snapshot copy: Drop Rate root + first level time, heap peak, branch expand time.
  - Set the request timeout constants of T009 from these numbers.
  - Write the result in `registro.md`.
- [X] T027 [US1] Parity test with the bench in `src/calculator/parity.integration.test.ts` (run by `just parity`)
  - It skips by itself when `PARITY_BENCH_DIR`, `PARITY_SNAPSHOT` or `PARITY_GAME_DIR` is missing or a path does not exist (model: `reader.integration.test.ts`). Every test has an explicit timeout.
  - It converts the snapshot into the app's mosaic and compares every row of the Drop Rate tree with the bench's tree without compaction: value, type, ⓘ and "?", plus the names outside the reviewed list.
  - It also runs the bench's code × value check as a test.
  - Add the three variable names, with no values, to `.env.example`.
- [ ] T028 [US1] [sessão] Run `just parity` on the Vinicius's machine
  - Expected: 0 differences (SC-002). The summary goes to `registro.md`; the snapshot's path may appear there, its content never (FR-032).

**Checkpoint**: the Drop Rate tree works end to end and matches the bench.

Verify: `just test-one src/renderer/FormulaTree.test.tsx` - passes; `just check` - passes; `just parity` - 0 differences.

---

## Phase 4: User Story 2 - Todos os números provados (Priority: P2)

**Goal**: the Formulas tab lists every catalog number, grouped in the game's order, with live values for the open group. A tap opens the same tree as the Stats.

**Independent Test**: with the invented game, the Formulas tab shows the catalog groups in order. Opening a group calculates only its numbers. The 11 Stats numbers appear with the Stats value, and tapping one opens the same tree.

### Tests for User Story 2

- [ ] T029 [P] [US2] `src/renderer/FormulasTab.test.tsx`
  - Cases:
    - groups in `TREE_CATALOG` order;
    - groups start closed;
    - opening a group sends `formula:values` with only its ids;
    - a value tap opens the side panel with that id;
    - "Waiting for the game" before the first reading (FR-034);
    - the 004 test "has no field to fill in" still passes (no search box).
- [ ] T030 [P] [US2] `src/main/live-values.test.ts`
  - Cases:
    - each new mosaic recalculates only the ids in view (open panel, open group, pins, open root);
    - no recording;
    - the Stats keeps its own worker and its time under 1 s with live values on (SC-004, measured as `ms` in the invented game).

### Implementation for User Story 2

- [ ] T031 [US2] The `values` message in the worker and the live-values loop
  - Files: `src/calculator/index.ts`, `src/main/live-values.ts`, `src/main/formula-pipeline.ts`
  - Signature: `liveValues(deps): { setInView(ids: string[]): void; onMosaic(json: string): void }`
- [ ] T032 [US2] The Formulas tab
  - Files: `src/renderer/FormulasTab.tsx`, `src/renderer/App.tsx` (a third tab, "Formulas")

Verify: `just test-one src/renderer/FormulasTab.test.tsx` - passes; `just check` - passes.

---

## Phase 5: User Story 3 - O painel segue a tela do jogo (Priority: P3)

**Goal**: opening a system screen in the game switches the companion to that system's panel. The side panel does not change. Leaving to a screen without a panel keeps the last one.

**Independent Test**: with the invented game, a reading whose screen is a system with a panel makes the window show that panel. An open tree in the side panel stays the same, the keyboard focus does not move, and the switch is announced once.

### Tests for User Story 3

- [ ] T033 [P] [US3] `src/renderer/modules/system-panels.test.ts` and `src/renderer/SystemPanel.test.tsx`
  - Cases:
    - one `CompanionModule` per catalog system with a `screen`;
    - `matches(ctx)` is true for that screen's label (and its tabs);
    - the switch keeps the side panel;
    - leaving to a screen without a panel keeps the last one (FR-033);
    - the focus does not move (FR-039);
    - one polite announcement, "Stamps panel" (FR-040);
    - a system without a screen is only in the Formulas tab.

### Implementation for User Story 3

- [ ] T034 [US3] Generate the system modules from the catalog and switch on `panel:update`
  - Files: `src/renderer/modules/system-panels.ts`, `src/renderer/SystemPanel.tsx`, `src/renderer/App.tsx`, `src/main/context.ts` (sends `panel:update` from the identified screen)

Verify: `just test-one src/renderer/SystemPanel.test.tsx` - passes; `just check` - passes.

---

## Phase 6: User Story 4 - Números que o jogo não mostra (Priority: P4)

**Goal**: the top of each panel shows every "not shown" number of that system, in closed groups (Costs, Caps, Chances, Rates), each opening its own tree. Stamps is complete.

**Independent Test**: with the invented game, the Stamps panel shows the four groups closed. Opening one lists its numbers with value or tag, and tapping the gilded chance opens its tree. A cost given as a list shows material and quantity; a value kept by the game with no math shows `from the game`.

### Tests for User Story 4

- [ ] T035 [P] [US4] `src/renderer/SystemPanel.test.tsx` (not-shown groups) and `src/calculator/tree-build.test.ts` (list cost)
  - Cases:
    - four groups start closed;
    - only the open group's ids go live;
    - a list result `[material, quantity]` shows both, and its tree explains the quantity;
    - a stored value without math gets `fromGame` and no tree.

### Implementation for User Story 4

- [ ] T036 [US4] Not-shown groups in the panel and the list-result root in the worker
  - Files: `src/renderer/SystemPanel.tsx`, `src/calculator/tree-build.ts`, `src/calculator/tree-roots.ts` (the Stamps ids of the BASELINE-4: next level cost, capacity cap, over level, gilded chance, exalted)

Verify: `just test-one src/renderer/SystemPanel.test.tsx` - passes; `just check` - passes.

---

## Phase 7: User Story 5 - Ler a árvore: conta, tipos e honestidade (Priority: P5)

**Goal**: every honesty case has its tag and text, every leaf its type phrase, and the version band shows when the rules come from another game version.

**Independent Test**: the invented game produces each tag of FR-012, and each appears with its text. With rules of another sha256, the band shows and the values stay.

### Tests for User Story 5

- [ ] T037 [P] [US5] `src/renderer/TruthTag.test.tsx` and `src/main/version-band.test.ts`
  - Cases:
    - one per id of the FR-012 table (`?`, `no name yet`, `unavailable`, `saved by the game`, `from the game`, `changes while you play`, `stopped here`, `over the cap`/`not reached`, `zeroes the total`, `repeated step`, `game bug: counted twice`);
    - the band "Names and tags were checked on an older game version. Values are live." with no mark per row (FR-018);
    - a known game bug shows the game's value with the tag (FR-016).

### Implementation for User Story 5

- [ ] T038 [US5] Honesty tags, game-bug rule and version band
  - Files: `src/renderer/TruthTag.tsx`, `src/renderer/VersionBand.tsx`, `src/main/version-band.ts`
  - The rules' sha256 is the keeper's hash (`update-watch.ts`) carried in `gameFiles`, or the same hash computed in the tree worker with `node:crypto`.

Verify: `just test-one src/renderer/TruthTag.test.tsx` - passes; `just check` - passes.

---

## Phase 8: User Story 6 - Comparar: ao vivo e Antes/depois (Priority: P6)

**Goal**: "Game changed · Refresh" lights only when the root or a part of an open node changes, and Refresh shows "was …". Up to 3 named marks per character are saved until Clear.

**Independent Test**: a script of 10 item swaps in the invented game; after each Refresh, root = Stats. A kill counter alone does not light the band. A mark saved, the app restarted and the mark picked shows the mark value and the current one on each changed row.

### Tests for User Story 6

- [ ] T039 [P] [US6] `src/shared/formula-tree-compare.test.ts`
  - Cases:
    - diff by `pieceKey` fills `was`;
    - only order changed counts as no change;
    - a counter or timer change outside open nodes does not set `gameChanged` (FR-024).
- [ ] T040 [P] [US6] `src/main/saved-files.test.ts` (marks part)
  - Cases:
    - save with a name up to 40 characters;
    - a fourth mark refused with "Up to 3 marks: clear one first." (FR-037);
    - clear;
    - survives a character change and an app restart;
    - per character number, never a name (FR-010a);
    - a corrupted or old `marks.json` is renamed `.bad`, starts empty and warns once (FR-041).

### Implementation for User Story 6

- [ ] T041 [US6] The compare function and Game changed · Refresh
  - Files: `src/shared/formula-tree-compare.ts`, `src/main/formula-pipeline.ts`, `src/renderer/ChangeBadge.tsx`
  - Signature: `compareTrees(a: TreeNode, b: TreeNode): { changed: Set<string>; withWas: TreeNode }`
- [ ] T042 [US6] Marks saved on disk and the Mark before / Compare with UI
  - Files: `src/main/saved-files.ts`, `src/renderer/MarkBar.tsx`
  - Signature: `savedFiles(dir: string): { marks: { list(n); save(n, name, values); clear(n, name) }; pins: …; shapes: … }`, as [contracts/saved-files.md](contracts/saved-files.md)

Verify: `just test-one src/main/saved-files.test.ts` - passes; `just check` - passes.

---

## Phase 9: User Story 7 - Pin (Priority: P7)

**Goal**: up to 5 pinned numbers in a strip under the status bar, wrapping to two lines after 3, highlighted when they change, kept after the app closes.

**Independent Test**: pin a number in the invented game; a value change highlights it; a sixth pin is refused; after a restart the same pins are there, without values.

### Tests for User Story 7

- [ ] T043 [P] [US7] `src/renderer/PinStrip.test.tsx` and `src/main/saved-files.test.ts` (pins part)
  - Cases:
    - pin from any number with a tree, unpin from the strip;
    - a sixth refused with "Up to 5 pins: unpin one first." (FR-036);
    - wraps after 3;
    - highlight on change, with no screen-reader announcement (FR-040);
    - `pins.json` without values;
    - corrupted file gives the FR-041 behavior;
    - 210 px without sideways scroll.

### Implementation for User Story 7

- [ ] T044 [US7] The pin strip and its file
  - Files: `src/renderer/PinStrip.tsx`, `src/main/saved-files.ts`, `src/main/live-values.ts` (pins are in view)

Verify: `just test-one src/renderer/PinStrip.test.tsx` - passes; `just check` - passes.

---

## Phase 10: User Story 8 - Where this goes (Priority: P8)

**Goal**: a piece used by 2 or more catalog numbers shows a badge with how many; a tap lists them.

**Independent Test**: in the invented game, a piece used in 3 numbers shows "3" and one used in 1 shows nothing.

### Tests for User Story 8

- [ ] T045 [P] [US8] `src/main/feeds-index.test.ts`
  - Cases:
    - the index counts `pieceKey`s across the shapes of the catalog trees;
    - only ≥ 2 sets `feeds`;
    - the list opens each tree.

### Implementation for User Story 8

- [ ] T046 [US8] The feeds index and badge
  - Files: `src/main/feeds-index.ts` (built from `tree-shapes.json` and refreshed in the background, never per second), `src/renderer/FeedsBadge.tsx`

Verify: `just test-one src/main/feeds-index.test.ts` - passes; `just check` - passes.

---

## Phase 11: User Story 9 - Acompanhador de farm (Priority: P9)

**Goal**: XP, items and gold per hour, only measured, for the active character, starting on a new map that is not a town, paused in town, shown in a strip on every tab.

**Independent Test**: a sequence of invented states with XP, gold and items rising gives the expected rates. A town pauses the count; back on the same map it continues; another map restarts it; a closed game resets it.

### Tests for User Story 9

- [ ] T047 [P] [US9] `src/main/farm.test.ts` and `src/renderer/FarmStrip.test.tsx`
  - Cases: every transition of the farm table in [data-model.md](data-model.md) (`idle`, `counting(map)`, `paused(map)`); rates from differences only (no formula); town maps from the game's map table with the rule proven by reference; the strip text "Farming 12 min · XP 1.2M/h · Gold 48K/h · Items ▸"; nothing on disk.

### Implementation for User Story 9

- [ ] T048 [US9] The farm measure and strip
  - Files: `src/main/farm.ts`, `src/renderer/FarmStrip.tsx`
  - Signature: `farmTracker(): { onState(slice); onMap(map, isTown); snapshot(): FarmUpdate }`

Verify: `just test-one src/main/farm.test.ts` - passes; `just check` - passes.

---

## Phase 12: User Story 10 - Radar de patch (Priority: P10)

**Goal**: after a game update, a band under the status bar on every tab says how many trees changed shape; "Show" lists added, removed and renamed parts.

**Independent Test**: two versions of the invented game: a tree with one more part shows in the radar with the difference; the shapes file has no value and no name of character.

### Tests for User Story 10

- [ ] T049 [P] [US10] `src/main/radar.test.ts` and `src/renderer/PatchBand.test.tsx`
  - Cases: shapes saved per `gameSha` (names of parts and keys only); a new sha compares and lights the band "Game updated: 3 trees changed · Show"; dismiss until the next patch; corrupted file gives the FR-041 behavior.

### Implementation for User Story 10

- [ ] T050 [US10] The radar and its band
  - Files: `src/main/radar.ts`, `src/main/saved-files.ts` (shapes), `src/renderer/PatchBand.tsx`

Verify: `just test-one src/main/radar.test.ts` - passes; `just check` - passes.

---

## Phase 13: User Story 11 - Outro personagem (Priority: P11)

**Goal**: the character picker opens on the active one; an inactive character's tree carries "not the active character" and stays out of parity, with the bench's reference rebuild.

**Independent Test**: with the invented game of two characters, the inactive tree shows the band and is not compared with the Stats, and its numbers equal those of the same character made active (the invented game knows both).

### Tests for User Story 11

- [ ] T051 [P] [US11] `src/calculator/inactive.test.ts` and `src/renderer/CharacterPicker.test.tsx`
  - Cases:
    - the active character is written back to `PlayerDATABASE` first;
    - the swap moves the same-name keys and numbers, only one index of `ObolEquippedOrder`, `ObolEquippedMap` and `PostOfficeInfo[3]`, and the other-name keys (`Cards[2]` ← `CardEquip`, `Cards[3]` ← `CSetEq`, `PrayersActive` ← `Prayers`, `PlacedTraps` ← `PldTraps`, `TimeAway.Player` ← `PlayerAwayTime`);
    - scene caches are rebuilt with the `TotalStats` memory cleared before each step;
    - a list with an unexpected shape stops with a warning;
    - the active character uses the live `DNSM` with no rebuild;
    - the picker band and no parity (FR-020).

### Implementation for User Story 11

- [ ] T052 [US11] Port the inactive rebuild and the picker
  - Files: `src/calculator/inactive.ts` (from the bench's `inactive.cjs` `buildInactive`, research R5), `src/calculator/index.ts`, `src/renderer/CharacterPicker.tsx`
- [ ] T053 [US11] [sessão] Check inactive characters on the real game
  - Enter with two or three characters and compare the app's inactive numbers (Stats and a sample of the catalog) with the same character made active: 0 differences expected.
  - The snapshots stay in `lab\` and are deleted with Vinicius's yes.

Verify: `just test-one src/calculator/inactive.test.ts` - passes; `just check` - passes.

---

## Phase 14: User Story 12 - Números que precisam do jogo vivo (Priority: P12)

**Goal**: the 40 live-game numbers are calculated with the map actor's fields read live, by property only.

**Independent Test**: with the invented game's map actor, the number comes out; without the actor it is `unavailable` with a player's reason.

### Tests for User Story 12

- [ ] T054 [P] [US12] `src/keeper/state-slice.test.ts` (actor fields) and `src/calculator/live-actor.test.ts`
  - Cases:
    - the fields of `atores-vivos.json` (bench's L1) read through `behaviors.cache.h["ActorEvents_N"].script[field]`, properties only, no function call;
    - the reading catalog rule for the new rows passes;
    - a missing actor gives `unavailable` with "needs the live map".

### Implementation for User Story 12

- [ ] T055 [US12] Read the map actor's fields and feed them to the worker
  - Files: `src/keeper/state-slice.js`, `src/shared/reading-catalog.md` (new rows with proven impact), `src/calculator/context.js` (the actor answers from the mosaic instead of the bench's stub)

Verify: `just test-one src/calculator/live-actor.test.ts` - passes; `just check` - passes.

---

## Phase 15: User Story 13 - Conferir com outra ferramenta (Priority: P13)

**Goal**: Game details shows the game's call, and Copy copies only the row name, the call and the number.

**Independent Test**: Copy on a row puts exactly three tab-separated fields on the clipboard.

### Tests for User Story 13

- [ ] T056 [P] [US13] `src/renderer/GameDetails.test.tsx`
  - Cases: name, call and raw number (no thousands separator); "Copied" for 2 s through the page's polite region; no character name in the call (index only).

### Implementation for User Story 13

- [ ] T057 [US13] Game details and Copy
  - Files: `src/renderer/GameDetails.tsx`

Verify: `just test-one src/renderer/GameDetails.test.tsx` - passes; `just check` - passes.

---

## Phase 16: Polish & Cross-Cutting Concerns

**Purpose**: documentation, the end-to-end checks with the real game and the 5-second test.

**Independent Test**: `/zelador` finds nothing; the quickstart script passes on the Vinicius's machine.

- [ ] T058 [P] Update `ARCHITECTURE.md`
  - Contents:
    - the diagram;
    - the Calculator section (two workers, 2 GB tree worker, recorder, inactive rebuild);
    - the folder table;
    - the boundary table;
    - the IPC table (`formula:*`, `panel:update`, `marks:*`, `pins:*`, `farm:update`, `radar:*`, `window:sidePanel`);
    - the saved files;
    - the module contract `module:<id>:*` of spec 001, still reserved and unused.
- [ ] T059 [P] Update `GLOSSARY.md`
  - New terms, each with `_Avoid_`: Formula tree, Tree piece, Leaf, Leaf type, How it adds up, System panel, Mark, Pin, Side panel.
  - Calculator: now two workers.
- [ ] T060 [sessão] Run the quickstart with the packaged app on the real game (steps 1–9 of [quickstart.md](quickstart.md)) and write the result in `registro.md`
- [ ] T061 [sessão] The 5-second test on the Vinicius's machine, with the result in `specs/008-formula-trees/teste-5s.md` (SC-008; it does not hold the merge)
- [ ] T062 Privacy and repository check
  - A test or script run in `just check` fails if a file under `src/` or `specs/008-formula-trees/` holds a game table, a code snippet of the game or a quoted proof.
  - The session runs `privacy.cjs` against the snapshots before the code PR.

Verify: `just check` - passes; `/zelador` - no finding.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Before Phase 1:** the five small-change PRs and PR #26 merged.
- **Done gate (0) → Setup (1) → Foundational (2):** each blocks the next.
- **US1 (3):** needs Foundational. It is the MVP and carries the assembly every later story uses.
- **US2–US13 (4–15):** need US1, because they use the tree, the side panel and the assembly.
  - US3 needs US2 (live values).
  - US4 needs US3 (panels).
  - US6–US10 need US2.
  - US8 needs US10's shapes file or builds it alone.
  - US11 and US12 need only US1.
- **Polish (16):** after the stories wanted.

### Parallel Opportunities

- The test tasks marked [P] inside a phase run in parallel (different files).
- After US1, three streams can run apart: US11 and US12 (calculator), US9 and US10 (main), US13 (window).

## Parallel Example: User Story 1

```bash
Task: "Instrumentation test in src/calculator/instrument.test.ts"
Task: "Recorder test in src/calculator/recorder.test.ts"
Task: "Assembly tests in src/calculator/tree/*.test.ts"
Task: "Atoms-only test in src/calculator/tree-atoms.test.ts"
Task: "Side panel and tree view tests in src/renderer/FormulaTree.test.tsx"
```

## Implementation Strategy

### MVP First

1. The five small changes, then phases 0, 1 and 2.
2. Phase 3 (US1): the Drop Rate tree end to end, `just parity` with 0 differences.
3. **Stop and validate** with Vinicius before the catalog grows.

### Incremental Delivery

US2 (all proven numbers) → US3 and US4 (panels) → US5 and US6 → the extras (US7–US10) → US11 and US12 → US13 → Polish. Each phase ends with `just check` green and its own check.

## Review Focus

1. **A tree request while the Stats is calculating a newer mosaic:** a reasonable user expects the tree root to match the number on screen, never a mosaic one step older. Pinned by the "two `onDue` during one calculation" test, task T010 in Phase 2, and by the pair test of T012.
2. **The game patched with the app open:** a reasonable user expects values to stay right and only the band to warn. Pinned by the version band test, task T037 in Phase 7, plus a test in T013 where an unknown shape coming from a changed game gives `unavailable` and never a crash.
3. **A huge tree (5,000+ rows without compaction) in a 420 px window:** a reasonable user expects only the open branches to render and the window to stay responsive. Pinned by a test in T019 that opens a fixture tree of 5,000 rows and checks that only the root and the first level are in the DOM.
4. **A saved file edited by hand or half-written by a crash:** a reasonable user expects the app to start, reset that item and say so once. Pinned by the FR-041 cases of T040, T043 and T049.
5. **A character switch while a branch is being calculated:** a reasonable user expects the old character's branch never to appear. Pinned by a test in T012 where an `expand` result of the previous character is dropped after the `none`.

### Security Criteria

| Task | Criteria from `checklists/security.md` |
| --- | --- |
| T012 | CHK008: the parity-failure log has a label and an id, no values of the math, no names |
| T012, T014 | CHK015: requests validated at the main's edge (catalog id, character number) |
| T013 | CHK006, CHK015: only allowed values leave the worker; the shape is checked |
| T015, T020 | CHK007: the instrumented copy never touches the disk |
| T018 | CHK001: free text and names allowed only on screen, absent from logs |
| T023, T022 | CHK018: rules and names carry proof by reference, never game text |
| T027, T028 | CHK002: the snapshot read by an environment variable; its path may appear, its content never |
| T040, T043, T049 | CHK004, CHK005, CHK010, CHK011: saved files hold no names, only what the contract lists, and survive corruption |
| T054, T055 | CHK012, CHK013: actor fields by property only; no network |
| T052 | CHK014: the same privacy for inactive characters |
| T056 | CHK009: Copy limited to three fields |
| T062 | CHK018: no game table, snippet or quoted proof in the repository |
