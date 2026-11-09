# Tasks: Catálogo de leitura (reading-catalog)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/state-reading.md), [quickstart.md](quickstart.md), [prototipo/](prototipo/README.md)

**Tests**: Tests are mandatory. Every phase writes its tests first, next to the code in `src/`, and sees them fail before
the implementation exists. `just check` passes at the end of every phase.

**Organization**: the catalog and the shared rules first; then the reading, the calculation and the mosaic of US1, in
that order; then US3 and US4, which build on the catalog. US2 is the catalog itself, delivered in Phase 1.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[USn]**: the user story of spec.md the task serves

## Rules for every phase

- Inside the running game only property reads run: no game function call, no getter, no write, no click, nothing left in
  the page between reads (FR-020).
- The game's code runs only in `src/calculator/`. No excerpt of the game's file in the repository, no player name, no
  account value (FR-004). Every "game code", number and character name in a test is invented.
- No network anywhere but `src/main/updates.ts`. Tests never need the game, Steam or the files of `lab\` and `research\`.
- Do not touch Steam or any game process.
- Identifiers and UI copy in English; code files up to 400 lines; other folders import shared code from
  `src/shared/index.ts`; `.ts` relative imports keep their extension.
- `src/calculator/` imports only Node built-ins and its own files, so its bundle stays one file.
- The Executor edits only `tasks.md` inside the spec folder. A hook that blocks is never worked around.
- Existing tests change only where a task says so, because the 005 replaces that behavior: `formula`/`other`,
  the 250 ms slot, the wait for a whole rotation, the 5 s gap and the fresh context per calculation. No other test
  is deleted or weakened.

---

## Phase 1: Foundational — the catalog and the shared rules (US2)

**Goal**: the catalog is one table in the repository and the reading lists come out of it; nothing reads by it yet.

**Independent Test**: choosing pieces at random finds each one with every column filled, and `catalogProblems` fails when
a reading diverges from the rule.

### Tests for Phase 1

- [X] T001 [P] Catalog rules tests in src/shared/reading-catalog-rules.test.ts
  - Files: `src/shared/reading-catalog-rules.test.ts`
  - Cases, all with invented rows: `parseCatalog` reads a table of 2 rows into `CatalogRow`, with `numbers` as a list and
    `nenhum`, `não medido` and `só quebra` as an empty list; a row with a missing column throws; `catalogName` maps
    `["Cards"]` to `Cards`, `["DNSM","x"]` to `DNSM.x`, `["PlayerDATABASE","A","x"]` to `Personagem.x` with character
    `"A"`, and `["PlayerDATABASE","A"]`, `["PlayerDATABASE","B"]` and `["_vars"]` to `null`; `classOf` is `fast` for a
    catalog row `rápida` and `slow` for a `lenta`, for a path outside the catalog (FR-014) and for a whole character;
    `groupOf` returns the row's group, and `null` outside `fast`; `catalogProblems` is empty for a right table and names
    the row when: `reading` is `rápida` with no declared number, `lenta` with a declared number and no `OutrosPersonagens.`
    prefix, `rápida` on an `OutrosPersonagens.` row, `nature` outside the 5 values, `reading` outside the 2 values, or a
    name repeated.
- [X] T002 [P] Real catalog test in src/shared/reading-catalog.test.ts
  - Files: `src/shared/reading-catalog.test.ts`
  - Cases: `catalogProblems(CATALOG, NUMBER_IDS)` is empty (SC-004, SC-006); every row has every column filled (FR-002);
    the fast rows sum 97 and the `ações` rows are 13; no row name has more than one dot-separated prefix from the 4 known
    ones; no cell of the file matches a list of invented character names used as a canary, and no `name` equals a key
    of `PlayerDATABASE` in the invented fixture (FR-004).
- [X] T003 [P] Shared types tests in src/shared/state.test.ts
  - Files: `src/shared/state.test.ts` (existing: the `classOf` cases of `formula`/`other` move to T001 and this file keeps what
    is left)
  - Cases: `StatePath` accepts 1, 2 and 3 levels; `NUMBER_IDS` still has the 11 ids in the same order as `TARGETS`.

### Implementation for Phase 1

- [X] T004 Create the catalog in src/shared/reading-catalog.md
  - Files: `src/shared/reading-catalog.md`
  - From `specs/005-reading-catalog/prototipo/catalogo.md`, every row, with the columns kept and one more at the end,
    `Grupo`: `ações` for the 11 rows of section A of `prototipo/revisar.md`, `EquipmentMap` and `DNSM.SetBonusTOTz`; for
    the other `rápida` rows, the `Mecânica` without " (a conferir)"; `—` for `lenta`. `Leitura` of `EquipmentMap` and
    `DNSM.SetBonusTOTz` is already `rápida`. Group rows of a group next to each other is not needed: the reader sorts.
- [X] T005 Catalog rules in src/shared/reading-catalog-rules.ts
  - Files: `src/shared/reading-catalog-rules.ts`
  - Signatures: `export interface CatalogRow { name; type; bytes: number; nature; numbers: string[]; changesOn; mechanic; feature; reading: "rápida" | "lenta"; group }`;
    `parseCatalog(text: string): CatalogRow[]`; `catalogName(path: StatePath, char: string | null): string | null`;
    `classOf(rows, path, char): StateClass`; `groupOf(rows, path, char): string | null`;
    `catalogProblems(rows, shownNumbers: readonly string[]): string[]`; `export const ACTIONS_GROUP = "ações"`.
  - Rules quoted from data-model.md: "`reading` é `rápida` se, e só se, `numbers` tem um número declarado por uma feature
    e o nome não começa com `OutrosPersonagens.`"; `nature` "dado de origem, cache derivado, tabela fixa, rascunho ou
    interface". No import with `?raw`: Node runs this file directly in T024.
- [X] T006 The catalog data in src/shared/reading-catalog.ts
  - Files: `src/shared/reading-catalog.ts`, `src/shared/index.ts`, `src/shared/raw.d.ts` when `*?raw` is not declared for
    this folder
  - Signatures: `export const CATALOG: readonly CatalogRow[]`, `parseCatalog` of the `?raw` import; `index.ts` re-exports
    this file and the rules. The `classOf` and `groupOf` of `index.ts` close over `CATALOG`.
- [X] T007 Shared types in src/shared/state.ts
  - Files: `src/shared/state.ts`, `src/shared/index.ts`
  - Changes: `StatePath` gets `[string, string, string]`; `StateClass` becomes `"fast" | "slow"`; `StateSlice.cycles` becomes
    `{ fast: number; all: number }`; `FORMULA_KEYS` and the old `classOf` are removed. `NUMBER_IDS` stays: it is what the
    Stats tab declares (FR-016).
  - Note: T010 and T018 change the users of the removed names; until then `just check` runs at the end of the phase with
    the state-reader and state-store kept compiling by mapping `formula` to `fast` and `other` to `slow` inside them.

Verify: `just test-one src/shared/reading-catalog-rules.test.ts` - all pass; `just check` - passes.

---

## Phase 2: US1 — reading 12 times a second, by the catalog

**Goal**: the keeper reads the fast pieces by content, 12 slots a second, and the first lap reads everything.

**Independent Test**: in the reader's fake game, after one second the reads match the slot pattern, a first lap reads every
piece before anything else, and a piece outside the catalog is read as `slow`.

### Tests for Phase 2

- [X] T008 [P] [US1] Third path level in src/keeper/state-read-only.test.ts
  - Files: `src/keeper/state-read-only.test.ts`
  - Cases: the traps of the existing suite (getter and function that throw when touched) also pass for
    `["PlayerDATABASE","A","x"]`; a missing character or subkey answers `null`; a level past the third answers `null`.
- [X] T009 [US1] Slot and lap tests in src/keeper/state-reader.test.ts and src/keeper/state-reader-fixture.ts
  - Files: `src/keeper/state-reader.test.ts`, `src/keeper/state-reader-fixture.ts` (the tick becomes 83 ms, and the invented
    keys come from a test catalog passed to the reader)
  - Cases: the slot pattern of T010 over 12 ticks: 3 `ações`, 7 other fast, 2 slow; no class with nothing to read gives its
    slot to the other; a new character gets every slot until fast and slow were read whole, and only then the pattern
    (FR-021); `cycles.fast` rises when a whole pass of the fast slices ends, and a map change zeroes it and restarts the pass;
    a character change restarts the first lap; a group over 25 KB becomes successive slices, and one piece over 25 KB goes
    alone; a fast subkey of the character travels as `["PlayerDATABASE", char, x]`; a piece the catalog does not know is
    read as `slow`; never two reads in flight, also with the 1 s screen read in the same turn.

### Implementation for Phase 2

- [X] T010 [US1] The schedule in src/keeper/state-reader.ts
  - Files: `src/keeper/state-reader.ts`; split it when it passes 400 lines
  - Signatures: `everyMs` defaults to `83`; `const SLOTS = ["actions","fast","slow","fast","actions","fast","fast","fast","actions","fast","slow","fast"]`;
    queues `actions`, `fast` and `slow`, built from the listed paths plus the `Personagem.x` fast rows as
    `["PlayerDATABASE", char, x]`; grouping sorts by `groupOf` and `pack`s each group up to `MAX_SLICE_BYTES`.
  - Removes `SLOTS_PER_OTHER`. A first lap uses every slot: `actions`, then `fast`, then `slow`, then `cycles.all` rises.
- [X] T011 [US1] The third level in src/keeper/state-slice.js
  - Files: `src/keeper/state-slice.js`
  - Change: a path of 3 levels reads `h`, then the child, then its `h`, then the subkey, all by `Object.getOwnPropertyDescriptor`.
    No other change to what it copies.

Verify: `just test-one src/keeper/state-reader.test.ts` - all pass; `just check` - passes.

---

## Phase 3: US1 — the lean calculation

**Goal**: the worker keeps the game loaded and answers in about 100 ms, with the numbers of a from-zero calculation.

**Independent Test**: in the engine tests, two calculations in a row boot the game once, and each one equals a calculation on
a fresh engine over the same mosaic.

### Tests for Phase 3

- [X] T012 [US1] Long-lived context tests in src/calculator/engine.test.ts and src/calculator/index.test.ts
  - Files: `src/calculator/engine.test.ts`, `src/calculator/index.test.ts` (existing: the cases that expected a fresh
    context per calculation and a restore before each number change to the new contract)
  - Cases, with the invented game: the game boots once for 3 calculations; mosaic A, then B, then A give the numbers of a
    fresh engine for each; a helper that throws leaves its numbers to fail alone, and the next calculation works; a
    number that throws is `null` alone; the actors are created again in each calculation (a counter of the fake game);
    numbers run in the order of `TARGETS`; the simple values and the bonuses are reapplied after the helpers;
    the context still has no host object and no generated code (the existing isolation cases keep passing).

### Implementation for Phase 3

- [X] T013 [US1] The calculation in src/calculator/context.js
  - Files: `src/calculator/context.js`
  - Reference: `prototipo/vivo.cjs`, mode `v4`. Changes: `helperPlan(lazyDnsm)` builds the steps and quiets the game only once;
    on later calls it adds the lazy maps to the new state and answers the same plan; `finishHelpers` becomes `reapply` only;
    `number(block, arg)` no longer restores; `snapshot` and `restore` are removed.
- [X] T014 [US1] One boot in src/calculator/engine.ts
  - Files: `src/calculator/engine.ts`
  - Change: `createEngine` boots once and keeps `{ sandbox, run }`; `calculate` sets `__mosaic`, runs `loadMosaic`, `helperPlan`,
    each `helperStep` with its time limit, `finishHelpers`, and the numbers. The ponytail note on fresh contexts goes.

Verify: `just test-one src/calculator/engine.test.ts` - all pass; `just check` - passes.

---

## Phase 4: US1 — a number for each change

**Goal**: after the first lap, each change of a fast piece reaches the tab in under 1 s, in one step on an item swap.

**Independent Test**: in the store tests, a changed fast piece asks for a calculation at once, and a changed `ações` slice only
after the next read of it comes the same.

### Tests for Phase 4

- [X] T015 [P] [US1] Mosaic tests in src/main/state-store.test.ts
  - Files: `src/main/state-store.test.ts` (existing: the cases of "a whole rotation and a change" change to the new rule)
  - Cases: nothing is due before the first lap ends (FR-021); after it, a changed fast piece outside `ações` is due in that
    same slice; a slow piece that changed is not due alone; an `ações` slice that changed is due only when the next read of
    that slice comes equal, and a different next read waits again (cenário 3 da US1); a map change waits for a rise of
    `cycles.fast` before anything is due; a character change wipes the mosaic and starts the first lap again; a
    `["PlayerDATABASE", char, x]` piece enters the mosaic under the character; a whole character arriving drops the stored
    subkeys of that character (R8); `__proto__` in any of the 3 levels is dropped; a 3-level path on another top key is dropped.
- [X] T016 [P] [US1] Host tests in src/main/calculator-host.test.ts
  - Files: `src/main/calculator-host.test.ts`, `src/main/calculator-host-fixture.ts`
  - Cases: after a result, the next calculation waits 60 ms (existing 5 s cases change); only the newest waiting mosaic is sent;
    one calculation in flight.
- [X] T017 [US1] Pipeline test in src/main/stats-pipeline.test.ts
  - Files: `src/main/stats-pipeline.test.ts`, `src/main/stats-pipeline-fixture.ts`
  - Cases: the fixture sends `cycles: { fast, all }`; the first number appears only after the first lap, and a changed fast piece
    reaches `tracker.result` with no new rotation.

### Implementation for Phase 4

- [X] T018 [US1] The mosaic in src/main/state-store.ts
  - Files: `src/main/state-store.ts`
  - Change: `belongs` and `mosaicJson` take the third level, only under `PlayerDATABASE`; the due rule of data-model.md, "Confirmando"
    included; a whole character drops its subkeys.
- [X] T019 [US1] The gap in src/main/calculator-host.ts
  - Files: `src/main/calculator-host.ts`
  - Change: `CALC_GAP_MS = 60`.

Verify: `just test-one src/main/state-store.test.ts` - all pass; `just check` - passes.

---

## Phase 5: US3 and US4 — a new feature and a game patch

**Goal**: declaring a new number points at the pieces it needs, and a patch's new or gone pieces can be listed.

**Independent Test**: an invented number makes the check fail until its pieces are in the fast reading, and an inventory with
one extra piece and one renamed piece lists both.

### Tests for Phase 5

- [X] T020 [P] [US3] Declared number test in src/shared/reading-catalog-rules.test.ts
  - Files: `src/shared/reading-catalog-rules.test.ts`
  - Cases: `catalogProblems(rows, [...ids, "inventedNumber"])` names the `lenta` row that affects `inventedNumber`, and is empty
    once the row is `rápida`.
- [X] T021 [P] [US4] Inventory tests in src/shared/reading-catalog-rules.test.ts
  - Files: `src/shared/reading-catalog-rules.test.ts`
  - Cases: `inventoryNames` of an invented state has top keys, `DNSM.x`, `Personagem.x`, `OutrosPersonagens.x` and only the closed
    `_vars` keys, with no character name; `diffInventory` lists a new piece and, for a renamed one, the new name in `added` and
    the old in `gone`; both lists are sorted.
- [X] T022 [P] [US4] Unknown piece test in src/keeper/state-reader.test.ts
  - Files: `src/keeper/state-reader.test.ts`
  - Cases: a key of the state outside the catalog goes in a slow slice, the rotation completes and no error is reported (FR-015).

### Implementation for Phase 5

- [X] T023 [US4] Inventory rules in src/shared/reading-catalog-rules.ts
  - Files: `src/shared/reading-catalog-rules.ts`
  - Signatures: `inventoryNames(state: { attrs: Record<string, unknown>; vars?: Record<string, unknown> }, char: string): string[]`;
    `diffInventory(rows, names): { added: string[]; gone: string[] }`.
- [X] T024 [US4] The inventory script in scripts/reading-inventory.ts
  - Files: `scripts/reading-inventory.ts`
  - Usage: `node scripts/reading-inventory.ts <state.json>`. Reads the catalog file and the state, and prints only the names of
    `added` and `gone`. Imports `src/shared/reading-catalog-rules.ts` directly, since plain Node has no `?raw`.
- [X] T025 [US3] How to add a number in src/shared/state.ts
  - Files: `src/shared/state.ts`
  - Change: a comment over `NUMBER_IDS` saying a feature declares its numbers here and the catalog check says what to promote.

Verify: `just test-one src/shared/reading-catalog-rules.test.ts` - all pass; `just check` - passes.

---

## Phase 6: Polish — documents

**Goal**: the current truth lives in the code and in the documents.

**Independent Test**: `ARCHITECTURE.md` and `GLOSSARY.md` no longer mention one read every 250 ms, nor `formula` and `other`.

### Tests for Phase 6

- [ ] T026 Check the documents against the code in src/shared/modules.test.ts
  - Files: `src/shared/modules.test.ts` only if it lists the modules of `src/shared`
  - Cases: the new entry is listed, when that test lists them; otherwise no change.

### Implementation for Phase 6

- [ ] T027 [P] Reading in ARCHITECTURE.md
  - Files: `ARCHITECTURE.md`
  - Changes: reading at 12 per second by the catalog, the slot division, the long-lived context (ADR 0007), the settled `ações` slice.
- [ ] T028 [P] Terms in GLOSSARY.md
  - Files: `GLOSSARY.md`
  - Changes: **Catalog**, **Fast reading**, **Slow reading**, **Actions slice**; _Avoid_ `formula` and `other` for readings.

Verify: `just check` - passes.

---

## Dependencies & Execution Order

- Phase 1 blocks everything. Phases 2, 3 and 4 serve US1 and can follow in order; Phase 3 touches no file of Phase 2.
- Phase 4 needs the slice shape of Phase 2. Phase 5 needs only Phase 1. Phase 6 is last.
- In each phase, tests come first and fail before the implementation.

### Parallel Opportunities

- T001, T002 and T003 touch different test files; T015 and T016 too; T027 and T028 too.
- Phase 3 can run beside Phase 2.

## Implementation Strategy

Phases 1 to 4 are the MVP: the catalog exists and any change reaches the tab in under 1 s. Phases 5 and 6 complete US3, US4 and
the documents. After Phase 4, the Vinicius runs the [quickstart](quickstart.md) with the game: SC-001 and SC-002 are confirmed
only there.

## Review Focus

1. A character whose first lap is interrupted by a change of character: a reasonable user expects no number from the one before. Pinned by the character-change cases of T009 in Phase 2 and T015 in Phase 4.
2. A slow whole-character read arriving after a fast subkey: a reasonable user expects the newest value to win. Pinned by the "whole character drops subkeys" case of T015 in Phase 4.
3. An item swap whose caches arrive a moment later: a reasonable user expects no intermediate number. Pinned by the `ações` confirmation case of T015 in Phase 4.
4. A long session on one context: a reasonable user expects the numbers to stay right after a calculation fails. Pinned by the helper-throws and A-B-A cases of T012 in Phase 3.
5. A game patch with a new key: a reasonable user expects everything to keep working. Pinned by T022 in Phase 5.

### Security Criteria

Criteria of [checklists/security.md](checklists/security.md).

- T008, T011: CHK001 (property reads only, third level included), CHK002 (nothing left in the page), CHK003 (no game function, no write, no click).
- T009, T010: CHK004 (12 per second, never two in flight), CHK013 (unknown piece goes slow), CHK014 (no piece stops being read).
- T002, T004: CHK006 (no account value, player name or game excerpt in the catalog), CHK007 (character names stay out).
- T021, T024: CHK005 (only the closed list of `_vars`), CHK007 (no character name printed), CHK008 (the state file stays out of the repository).
- T012, T014: CHK010 (the game's code runs only in the isolated worker), CHK012 (no network).
