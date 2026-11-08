# Tasks: Base de telas (screen-base)

**Input**: [spec.md](spec.md), [plan.md](plan.md), [research.md](research.md), [data-model.md](data-model.md),
[contracts/](contracts/), [quickstart.md](quickstart.md), [prototipo/](prototipo/README.md)

**Tests**: Tests are mandatory. Every phase writes its tests first, next to the code in `src/`, and sees them fail before
the implementation exists. `just check` passes at the end of every phase.

**Organization**: the reader first, then the identification and its rules (US1, US2, US3, cut in three phases by size),
the game tables (US5) and new numbers (US6), and only then the switch of the window (US1, US4), because `GameContext`
changes for everything at once.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependencies)
- **[USn]**: the user story of spec.md the task serves

## Rules for every phase

- Inside the game only property reads run: no game function call, no write, no click (FR-007).
- The game file is only read as text and never executed: no `eval`, `new Function` or `node:vm` on it (FR-014).
- No excerpt of the game file in the repository. Every "game code" in a test is made up (FR-015). Prototype and fixtures
  carry only field names, numbers and screen names.
- No player name in the repository (FR-020).
- No network anywhere but `src/main/updates.ts`. Tests never need the game, Steam or the files of `lab\`.
- Do not touch Steam or any game process. The launch option may be pointing at a test session right now.
- Identifiers and UI copy in English; code files up to 400 lines (`src/keeper/keeper.test.ts`, 463 lines, does not grow);
  other folders import shared code from `src/shared/index.ts`; `.ts` relative imports keep their extension.
- The Executor edits only `tasks.md` inside the spec folder. Anything else there is the session's (lesson 5 of 002).
- A hook that blocks is never worked around (lesson 4 of 001).
- A test removed is only one of a behavior FR-011 takes out, and the task says which.

---

## Phase 1: Foundational — the reader's new fields

**Goal**: `read.js` and `Reading` carry every field of [contracts/read-fields.md](contracts/read-fields.md); nothing reads
them yet.

**Independent Test**: `read.js` against an engine whose every function throws returns the new fields, and an absent
behavior produces no key and no error.

### Tests for Phase 1

- [X] T001 [P] Shape tests of the new fields in src/shared/reading.test.ts
  - Files: `src/shared/reading.test.ts`
  - Cases: a reading with every new field passes and keeps them; `scene`, `attack`, `bag`, `ol1`, `ol3`, `ol18`, `ol19`,
    `ola489`, `nd37`, `hole` accept `null`; a text in a number field is refused; `behaviors` as an array, as `null` or
    with an object as a value is refused; an empty `behaviors` passes (FR-008).
- [X] T002 [P] Read-only proof of the new fields in src/keeper/read-only.test.ts
  - Files: `src/keeper/read-only.test.ts`
  - Change the fake engine: add `scene: { name: "w1" }`, `AttackSelected`, `InventorySelected`, `OptionsListAccount`,
    `NONdummies`, `Holes`, `GetPlayersUsernames` and a `PixelHelperActor` with a few behaviors; every function stays a
    trap. Update the `toEqual` of the first test with the new fields.
  - Cases: no game function is called; every key of a behavior of the contract is read with its exact field name
    (`_GenINFO`, `_GenInfo`, `_GeneralINFO`); `H21._GenINFO[51]` and `[59]` are read; a missing behavior gives no key and
    no error (character select); a value that is an object becomes `null`; `hole` follows the index of `UserInfo[0]` in
    `GetPlayersUsernames` and the usernames never appear in the result; every absent global reads as `null`; no key for
    `_NPCtalkingTo`, `ARC.*`, `npc`, `caixas38`, `otherPlayer` or `ol9`.

### Implementation for Phase 1

- [X] T003 New fields in Reading and toReading in src/shared/types.ts and src/shared/reading.ts
  - Files: `src/shared/types.ts`, `src/shared/reading.ts`
  - Signature: `Reading` gains `scene: string | null`; `attack`, `bag`, `ol1`, `ol3`, `ol18`, `ol19`, `ola489`, `nd37`,
    `hole: number | null`; `behaviors: Record<string, number | string | boolean | null>`. `toReading` checks each and
    copies them. Constraint from data-model.md: "um `behaviors` que não seja objeto plano de valores simples reprova a
    leitura".
- [X] T004 The new fields in src/keeper/read.js
  - Files: `src/keeper/read.js`
  - Change: follow [contracts/read-fields.md](contracts/read-fields.md) exactly, with the table of behaviors as an array
    of `[n, actor, field, indexes]`. Property reads only; each behavior path inside its own `try`; every absent value
    becomes `null`, because `returnByValue` drops `undefined`. Existing fields, `codexSel` included, stay as they are.
- [X] T005 Add the new fields to every Reading literal of the tests
  - Files: the tests with a `Reading` literal, among `src/keeper/keeper.test.ts`, `src/keeper/reader.test.ts`,
    `src/main/context.test.ts`, `src/main/payloads.test.ts`, `src/main/catalog/catalog.test.ts`, `src/link.test.ts` and
    `src/shared/link.test.ts`. No assertion changes. Add the fields so that `keeper.test.ts` does not grow past its 463 lines
    (a shared constant on an existing line, or a spread of a fixture).

**Verify**: `just test-one src/keeper/read-only.test.ts` and `just test-one src/shared/reading.test.ts` — all pass;
`just check` passes.

---

## Phase 2: User Story 1, part 1 — the identification (Priority: P1) 🎯 MVP

**Goal**: `identifyScreen` and the catalog's validation, tested with invented rules.

**Independent Test**: with invented rules, each reading resolves to the expected name, a tie and an unmatched reading to
"Unknown screen".

### Tests for Phase 2

- [ ] T006 [P] [US1] identifyScreen tests in src/shared/screens/identify.test.ts
  - Files: `src/shared/screens/identify.test.ts`
  - Cases: one rule matches; the rule with more conditions wins whatever the order in the list; two with the same count
    → "Unknown screen"; an overlay beats a screen with more conditions; no rule → "Unknown screen"; a winning rule with
    `tabs` → `name + " › Unknown tab"`, and a more specific tab rule beats it; a tab value left from another window never
    shows (`menu2` different, same `menu2tab`); a condition on an absent `behaviors` key never matches; `0`, `-1`, `0.2`
    and a text compare by equality; `null` in the reading never matches a condition.
- [ ] T007 [P] [US1] Catalog validation tests in src/shared/screens/catalog.test.ts
  - Files: `src/shared/screens/catalog.test.ts`
  - Cases, each with invented rules: a rule without `proof`, with a `proof` outside `foto:<id>` and `sprite:<name>`, with
    an empty `when` or with a blank `name` is refused; a `when` key that is neither a `Reading` field nor
    `H<n>.<field>` or `H<n>.<field>[<i>]` is refused; `t`, `char` and `behaviors` are refused as keys; a number both in
    `unprovenWindows` and in a rule is refused.

### Implementation for Phase 2

- [ ] T008 [US1] identifyScreen in src/shared/screens/identify.ts
  - Files: `src/shared/screens/identify.ts`, `src/shared/index.ts`, `src/shared/types.ts`
  - Signatures: `ScreenRule`, `ScreenCatalog` as in data-model.md; `identifyScreen(r: Reading, catalog: ScreenCatalog):
    string`, following the pseudocode of data-model.md. Own-property lookups only (`Object.hasOwn`).
- [ ] T009 [US1] parseScreenCatalog in src/shared/screens/catalog.ts
  - Files: `src/shared/screens/catalog.ts`, `src/shared/index.ts`
  - Signature: `parseScreenCatalog(parts: unknown[]): ScreenCatalog`, which joins the parts and throws on any invalid rule.
    `SCREEN_CATALOG` and `KNOWN_WINDOWS: ReadonlySet<number>` come in Phase 3 and 4.

**Verify**: `just test-one src/shared/screens` — all pass; `just check` passes.

---

## Phase 3: User Stories 1, 2 and 3, part 2 — menus and windows 0 to 45

**Goal**: the rules of the menus, overlays, Quik Ref, Codex, Items, Talents and windows 0 to 45, each with its proof, and
the fixture of captured states.

**Independent Test**: every captured state with `menu2 <= 45` gives the expected name.

### Tests for Phase 3

- [ ] T010 [US1] Captured states fixture in src/shared/screens/fixtures/captured-states.jsonl
  - Files: `src/shared/screens/fixtures/captured-states.jsonl`, one JSON per line (Prettier does not touch `.jsonl`).
  - Source, outside the repository: `C:\Users\Vinicius\idleon-companion\lab\out\estado.jsonl` and section 7 of
    `C:\Users\Vinicius\idleon-companion\docs\product\mapa-de-telas.md`. Generate it once with a throwaway script outside
    the repository, which is not committed.
  - How: replay `estado.jsonl` (`tudo` is the whole state; `mudou` holds `[old, new]` per field) and take the state of each
    record with a `foto` that has a row in section 7. Rename to `Reading`: `ts` → `menu2tab`, `H<n>...` as they are;
    `ARC.51` and `ARC.59` → `H21._GenINFO[51]` and `[59]`. Drop `H<n>: "ausente"`, `H0._NPCtalkingTo`, every `NPC.*` and other
    `ARC.*`, `ol9`, `npc`, `caixas38` and `otherPlayer`. Set `codexSel` to `null`, and `char` to `"Tester"`, or `null` when
    it is empty.
  - Line: `{ "photo": "0446", "reading": { ... }, "expected": "The Gallery" }`. `expected` is the panel text, without the
    notes of the row ("Gallery, fechado" → `The Gallery`; "None (HUD)" → `None`). A row whose result is "diverge" uses the
    corrected name of section 7 and of `resultados-testes-no-jogo.md` (cave 17 is The Lair, window 42 is Automation
    Station, Sushi tab 2 is Bonus). The rows "inconclusivo" stay out.
- [ ] T011 [US1] Captured states test in src/shared/screens/captured.test.ts
  - Files: `src/shared/screens/captured.test.ts`
  - Cases: each line with `menu2 <= 45` gives `expected` through `identifyScreen(reading, SCREEN_CATALOG)`, the failure
    naming the photo; no tie in any line; every line has `char` `"Tester"` or `null`, and `codexSel` `null`; `Reading`
    shape passes `toReading`.

### Implementation for Phase 3

- [ ] T012 [US1] Overlays, menus and Codex rules in src/shared/screens/rules/menus.json
  - Files: `src/shared/screens/rules/menus.json`, `src/shared/screens/catalog.ts`
  - Source: sections 5 (Mapa 1), 6 and 7 of the screen map. Includes `overlays` (`scene` `PlayerSelect` → `Character select`,
    `ol18` 1 → `AFK Gains`), `None` (`menu` 0, `menu2` 0, proof of a "None" row of section 7), World Map, Menu and its
    tabs, Items, Talents, Attacks, Quik Ref and the Codex tabs and subscreens.
  - A rule only with proof: a section 7 row "confere", "novo rótulo" or corrected → `foto:<id>`; a section 6 row "provado"
    → `sprite:<name>`. Anything else gets no rule. A screen with tabs or subscreens gets `tabs: true`.
- [ ] T013 [US2] [US3] Windows 0 to 45 in src/shared/screens/rules/windows-0-45.json
  - Files: `src/shared/screens/rules/windows-0-45.json`, `src/shared/screens/catalog.ts`
  - Source: "Mapa 2" of section 5, with sections 6 and 7. Each tab or subscreen repeats its window's conditions (FR-005).
  - A window of the game without proof goes to `unprovenWindows`. The windows of section 7's "não vistas" list get a rule
    only with a section 6 row "provado" (FR-004).
  - `SCREEN_CATALOG` is exported from `catalog.ts` and `src/shared/index.ts`.

**Verify**: `just test-one src/shared/screens/captured.test.ts` — all pass; `just check` passes.

---

## Phase 4: User Stories 1, 2 and 3, part 3 — windows 46 to 110

**Goal**: the whole catalog: every state of the round named right, every window of the game accounted for.

**Independent Test**: all captured states give the expected name, and the 108 windows are covered.

### Tests for Phase 4

- [ ] T014 [US1] All captured states and the catalog's invariants in src/shared/screens/captured.test.ts and catalog.test.ts
  - Files: `src/shared/screens/captured.test.ts`, `src/shared/screens/catalog.test.ts`
  - Change: remove the `menu2 <= 45` filter.
  - Cases: `KNOWN_WINDOWS` has exactly the 108 numbers (the rules' `menu2` plus `unprovenWindows`, 0 to 110 without 22, 50
    and 51); window 64 is `Orion` and not `The Hole`; 53, 58 and 75 give "Unknown screen"; each of the 18 caves is named
    with the window closed (`menu` 0, `menu2` 0, `hole` N), and 17 is `The Lair`.
- [ ] T015 [P] [US1] Rule keys exist in the reader in src/keeper/read-fields.test.ts
  - Files: `src/keeper/read-fields.test.ts`
  - Case: run `read.js` over a fake engine in which every behavior of the contract exists; every `H...` key used by a
    rule of `SCREEN_CATALOG` is a key of its `behaviors`, so a mistyped key cannot leave a rule that never matches.

### Implementation for Phase 4

- [ ] T016 [US2] [US3] Windows 46 to 110 in src/shared/screens/rules/windows-46-110.json
  - Files: `src/shared/screens/rules/windows-46-110.json`, `src/shared/screens/catalog.ts`
  - Source and rules as in T013, from "Mapa das janelas `MenuType2` 46 a 110". The caves of The Hole: `hole` N with the
    names of the row of window 69.
- [ ] T017 [US1] KNOWN_WINDOWS in src/shared/screens/catalog.ts
  - Files: `src/shared/screens/catalog.ts`, `src/shared/index.ts`
  - Signature: `KNOWN_WINDOWS: ReadonlySet<number>`.

**Verify**: `just test-one src/shared/screens` and `just test-one src/keeper/read-fields.test.ts` — all pass; `just check`
passes.

---

## Phase 5: User Story 5 — tables of each player's game (Priority: P5)

**Goal**: the keeper takes map and monster names from the text of the installed game and publishes them on the link. The
app accepts the message and does not show it yet.

**Independent Test**: from invented game code, the tables come out right; from a changed format, `null`; the keeper
publishes after `startApp` and a failure ends nothing.

### Tests for Phase 5

- [ ] T018 [P] [US5] readGameTables tests in src/keeper/game-tables.test.ts
  - Files: `src/keeper/game-tables.test.ts`, invented code only (FR-015).
  - Cases: from `specs/003-screen-base/prototipo/extrair.test.ts`: maps with `_` turned into a space; monsters by id;
    a repeated id keeps the last. Each gives `null` for its table alone: no match; two candidates; lists of different
    lengths; one monster out of format.
- [ ] T019 [P] [US5] The tables message in the link test and payloads in src/shared/link.test.ts and src/main/payloads.test.ts
  - Files: the link test of `src/shared/`, `src/main/payloads.test.ts`
  - Cases: `tables` encodes and decodes; a `tables` that is not an object is junk. `linkTables`: valid tables pass; `maps`
    with a number, `monsters` with a number, or an array as `monsters` count as `null` for that table only; a body that is
    not an object gives both `null`.
- [ ] T020 [US5] Keeper scan tests in src/keeper/keeper-scan.test.ts
  - Files: `src/keeper/keeper-scan.test.ts`, with the fake `KeeperDeps` as in `src/keeper/keeper-release.test.ts`
  - Cases: the tables are published after `startApp` was called, never before `launch`; no game code → `maps: null` and
    `monsters: null`; an unreadable table logs `game-tables-unreadable` with `maps` and `monsters` booleans; an extraction
    that throws logs `game-scan-failed`, and the keeper still ends only after the game; a new client of the link gets the
    tables first, then the status, then the reading.

### Implementation for Phase 5

- [ ] T021 [US5] readGameTables in src/keeper/game-tables.ts
  - Files: `src/keeper/game-tables.ts`
  - Signature: `readGameTables(code: string): GameTables`. The real version of `lerMapas` and `lerMonstros` of the prototype,
    regular expressions only. "Nothing" stays in the table, with its blank name. Constraint from data-model.md: "`null` =
    não consegui ler".
- [ ] T022 [US5] GameTables, the link message and linkTables
  - Files: `src/shared/types.ts`, `src/shared/link.ts`, `src/shared/index.ts`, `src/keeper/link-server.ts`, `src/main/payloads.ts`
  - Signatures: `GameTables` as in data-model.md; `LinkMessage` gains `{ type: "tables"; tables: GameTables }`;
    `linkTables(v: unknown): GameTables`. The server keeps the last tables and writes them before the status and the
    reading to a new client ([contracts/link.md](contracts/link.md)).
- [ ] T023 [US5] The scan in the keeper's flow in src/keeper/keeper.ts
  - Files: `src/keeper/keeper.ts`
  - Change: keep the text from `d.gameCode()` in a variable; right after the `d.startApp()` block, run it inside its own
    `try`, publish `tables`, log, and let go of the text. Synchronous (research R8). Nothing else in the flow changes:
    the update watch decides exactly as before (Edge Cases).

**Verify**: `just test-one src/keeper/game-tables.test.ts` and `just test-one src/keeper/keeper-scan.test.ts` — all pass;
`just check` passes.

---

## Phase 6: User Story 6 — a patch with a new screen (Priority: P6)

**Goal**: the keeper writes to `keeper.log` the window numbers the catalog does not know.

**Independent Test**: invented code with a number outside `KNOWN_WINDOWS` gives one `unknown-screen-numbers` line with
that number, and nothing reaches the player.

### Tests for Phase 6

- [ ] T024 [P] [US6] screenNumbers tests in src/keeper/game-tables.test.ts
  - Files: `src/keeper/game-tables.test.ts`, invented code only.
  - Cases: a literal write and a literal comparison of `MenuType2` are found; `MenuType` and `MenuType2TabSelected` are not;
    sorted, without repeats.
- [ ] T025 [US6] Unknown numbers in src/keeper/keeper-scan.test.ts
  - Files: `src/keeper/keeper-scan.test.ts`
  - Cases: a number outside `KNOWN_WINDOWS` logs `unknown-screen-numbers` with `numbers`; only known numbers logs nothing;
    no message with these numbers goes on the link; with detection markers in the code, the keeper still warns and opens
    the game without the pipe, as before.

### Implementation for Phase 6

- [ ] T026 [US6] screenNumbers and the log in src/keeper/game-tables.ts and src/keeper/keeper.ts
  - Files: `src/keeper/game-tables.ts`, `src/keeper/keeper.ts`
  - Signature: `screenNumbers(code: string): number[]`. The log line is `log("unknown-screen-numbers", { numbers })`, only
    numbers ([contracts/link.md](contracts/link.md)).

**Verify**: `just test-one src/keeper/keeper-scan.test.ts` — all pass; `just check` passes.

---

## Phase 7: User Stories 1 and 4 — the window names every screen

**Goal**: the panel shows the catalog's name and the game's tables, and "Name it" is gone.

**Independent Test**: from a reading and tables, the panel shows Screen, World, Map, Character and AFK target; no text box
exists in the whole window.

### Tests for Phase 7

- [ ] T027 [US1] Context tests in src/main/context.test.ts
  - Files: `src/main/context.test.ts`
  - Cases: `screen.label` is `identifyScreen`'s result; `names.map` from the tables by map number; `names.afk` from the
    tables; without tables, or a number the table lacks, "Unknown map" and "Unknown monster"; `afk` `null` or `Nothing`
    → "None"; a map number that is negative or a fraction → "Unknown map". `contextTracker`: a reading before the tables sends
    "Unknown map", and the tables arriving send the context again with the name; tables with no reading yet send nothing;
    `replay` resends the last context.
- [ ] T028 [P] [US4] Panel tests in src/renderer/ui.test.tsx and src/renderer/App.test.tsx
  - Files: `src/renderer/ui.test.tsx`, `src/renderer/App.test.tsx`
  - Remove the tests of "Name it", `unnamed #N` and the `deduced` mark (FR-011). Update the context stubs.
  - Cases: rows Screen, World, Map, Character and AFK target, in that order; no Menu, Window or Codex tab row; Screen
    shows `Codex › Cards › Sets`, `Breeding › Unknown tab`, `Unknown screen` and `None`; Map shows the name without the
    number; a name with `<b>` shows as literal text; `screen.queryAllByRole("textbox")` is empty in the whole `App` (SC-004).

### Implementation for Phase 7

- [ ] T029 [US1] GameContext, toContext and contextTracker in src/main/context.ts
  - Files: `src/shared/types.ts`, `src/shared/index.ts`, `src/main/context.ts`
  - Signatures: `GameContext` as in data-model.md; `toContext(r: Reading, tables: GameTables): GameContext`;
    `contextTracker(send: (c: GameContext) => void): { reading(r: Reading): void; tables(t: GameTables): void; replay():
    void }`. Tables start as both `null`.
- [ ] T030 [US4] The panel in src/renderer/ScreenMapPanel.tsx
  - Files: `src/renderer/ScreenMapPanel.tsx`, `src/renderer/styles.css`
  - Change: follow [contracts/ipc.md](contracts/ipc.md); drop `Named` and the `.deduced` style.
- [ ] T031 [US4] Remove the catalog of the user
  - Files: delete `src/renderer/NameIt.tsx`, `src/main/catalog/` (with `catalog.test.ts`, FR-011) and
    `scripts/convert-prototype-names.ts`; change `src/shared/types.ts` (`Catalog`, `Entry`, `CatalogTable`,
    `IPC.catalogName`, `CompanionApi.name`), `src/shared/index.ts`, `src/shared/types.test.ts`, `src/shared/modules.test.ts`,
    `src/preload/index.ts`, `src/renderer/companion-stub.ts`, `src/main/payloads.ts` and `src/main/payloads.test.ts`
    (`namePayload` and its cases, FR-011).
- [ ] T032 [US1] The link, the tracker and no name channel in src/main/index.ts
  - Files: `src/main/index.ts`, `src/main/link-client.ts`
  - Change: use `contextTracker`; `tables` goes through `linkTables` to it; remove `catalog`, `namesFile` and the
    `catalog:name` handler.

**Verify**: `just test-one src/main/context.test.ts` and `just test-one src/renderer/ui.test.tsx` — all pass; `just check`
passes.

---

## Phase 8: User Story 4, part 2 — delete the old names (Priority: P4)

**Goal**: `names.json` and its two siblings disappear.

**Independent Test**: in a temporary folder, the three files go away, everything else stays, and a file that cannot be
deleted does not stop the others.

### Tests for Phase 8

- [ ] T033 [P] [US4] forgetOldNames tests in src/main/forget-names.test.ts
  - Files: `src/main/forget-names.test.ts`, in a temporary folder.
  - Cases: the three files are deleted; `settings.json`, `steam-setup.json` and `game-hash.json` stay; no file and no folder →
    nothing happens; a `names.json` that cannot be deleted (a directory with that name) neither throws nor stops the
    other two.

### Implementation for Phase 8

- [ ] T034 [US4] forgetOldNames in src/main/forget-names.ts, called at the start in src/main/index.ts
  - Files: `src/main/forget-names.ts`, `src/main/index.ts`
  - Signature: `forgetOldNames(dataDir: string): void`. `rmSync` with `force`, each in its own `try`; runs on every start
    (research R7).

**Verify**: `just test-one src/main/forget-names.test.ts` — all pass; `just check` passes.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Goal**: the documents tell the new truth, and the feature holds together.

**Independent Test**: `just check` and `just build` pass; the documents no longer mention what left.

- [ ] T035 A guard against running the game code in src/keeper/game-tables.test.ts
  - Files: `src/keeper/game-tables.test.ts`
  - Case: the source of `game-tables.ts` has no `eval`, `new Function`, `node:vm` or `require(` (FR-014).
- [ ] T036 [P] Update the architecture in ARCHITECTURE.md
  - Files: `ARCHITECTURE.md`
  - Change: the `tables` link message; `src/shared/screens/`; `game-tables.ts` in the keeper; no `names.json`, `catalog:name`,
    `NameIt` or `src/main/catalog/`; `forget-names.ts`; the `keeper.log` labels; the new fields of the reader.
- [ ] T037 [P] Update the glossary in GLOSSARY.md
  - Files: `GLOSSARY.md`
  - Change: **Catalog** becomes the rules with proof; add **Screen rule**, **Game tables** and "Unknown screen".

**Verify**: `just check` passes; `just build` ends without error. The session runs the quickstart's game script with
Vinicius afterwards.

---

## Dependencies & Execution Order

Phases run in order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. Phase 7 needs the catalog (4) and the tables (5). Phase 6 needs
`KNOWN_WINDOWS` (4). Phase 8 could come any time after 7.

## Parallel Opportunities

Tests marked [P] of one phase touch different files. T036 and T037 too. The rule files of Phases 3 and 4 are independent,
but each ends with the same test, so they run in order.

## Implementation Strategy

MVP: Phases 1 to 4 prove the naming with captured states, without any change the player sees. Phase 7 is the first visible
change, and only after it the app delivers US1 to the player. Each phase ends with `just check` green.

## Review Focus

1. A reading that arrives before the tables: a reasonable user expects "Unknown map" for an instant and then the name, never a stale or empty row. Pinned by the `contextTracker` cases, task T027 in Phase 7.
2. A game patch that changes the shape of only one table: a reasonable user expects the other table to keep working and no invented name. Pinned by the per-table `null` cases, task T018 in Phase 5.
3. A mistyped behavior key in a rule: a reasonable user expects the tab's name, but the rule would just never match and show "Unknown tab". Pinned by the rule-keys test, task T015 in Phase 4.
4. A tab left from the window closed before: a reasonable user expects never to see it. Pinned by the stale-tab case of `identifyScreen`, task T006 in Phase 2, and by the captured states, task T014.
5. A `names.json` that Windows keeps locked: a reasonable user expects the app to open normally and clear it later. Pinned by the undeletable-file case, task T033 in Phase 8.

### Security Criteria

Criteria of [checklists/security.md](checklists/security.md).

- T002, T004: CHK001 (property reads only), CHK002 (the read-only test covers the new fields), CHK003 (no save write or click), CHK004 (an absent behavior is no error).
- T018, T021, T035: CHK006 (read as text, never executed), CHK007 (a changed file breaks nothing and invents no name), CHK015 (the example code is made up).
- T023: CHK005 (only reads the installed file), CHK008 (the update watch decides as before).
- T028: CHK006 (names as plain text).
- T010, T011: CHK016 (no player names).
- T026: CHK017 (`keeper.log` carries only numbers).
- T033, T034: CHK010 (only the three named files), CHK011 (on start), CHK013 (a failure stops nothing).
- T031: CHK012 (no copy kept: the deletion is the decision).
- T022: the tables are checked at the link's edge (`linkTables`).
- CHK009 and CHK014: `src/main/no-network.test.ts` keeps running; no task adds a network call or a game file.
