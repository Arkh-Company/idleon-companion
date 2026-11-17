# Tasks: Molde por sistema nas árvores de fórmula

**Input**: Design documents from `specs/009-system-mould/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Tests are mandatory. Each phase writes its tests first, and they fail before the code exists. The tests use the invented game of the 008: `src/calculator/fixtures/fake-game.js`, `fake-mosaic.ts` and `src/calculator/tree/tree-fixture.ts`.

**Organization**: by user story of the spec (US1 Drop Rate = V1, US2 every tree by game pools, US3 no unnamed step), plus the tree view (FR-001, FR-012–FR-014) and Polish.

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Foundational (the node and the checks)

**Purpose**: the pool and system node exist end to end (worker → main check → window), before any tree uses them.

**Independent Test**: a hand-built tree with a `pool` and a `system` node passes the main's check and draws in the window; one with a piece key on a pool is refused.

- [ ] T001 [P] Tests first: the node's new roles and fields in `src/main/tree-check.test.ts` and `src/shared/formula-tree.test.ts`
  - Files: `src/main/tree-check.test.ts`, `src/shared/formula-tree.test.ts`
  - Cases:
    - `role: "pool"` with `poolKind: "additive" | "multi"` and `combine: "sum" | "product" | "onePlusPercent"` passes;
    - `role: "system"` with `combine` and `poolKind: null` passes;
    - any other value for `combine` or `poolKind` is refused;
    - a `pool` or `system` with a non-null `pieceKey` is refused (contracts/tree-node.md);
    - `combine`/`poolKind` other than null on a piece row is refused;
    - a pool name with game code (`DNSM.X`) is refused by the same text sieve as names.
- [ ] T002 Add the roles and fields in `src/shared/formula-tree.ts` and `src/calculator/tree-contract.ts`
  - Files: `src/shared/formula-tree.ts`, `src/calculator/tree-contract.ts`
  - Signatures: `NODE_ROLES` gains `"pool"` and `"system"`; `TreeNode` and `CalcTreeNode` gain `combine: "sum" | "product" | "onePlusPercent" | null` and `poolKind: "additive" | "multi" | null` ("Only in `pool` and `system`"; null in every other row, data-model.md).
  - Every existing row builder sets both to null; existing tests pass unchanged.
- [ ] T003 Accept the new roles and fields in `src/main/tree-check.ts`
  - Files: `src/main/tree-check.ts`
  - Rules: the `NODE` field checks gain `combine` and `poolKind` (the lists above, or null); a `pool`/`system` node MUST have `pieceKey: null`.
- [ ] T004 [P] Tests first, then the system table in `src/calculator/tree/systems.ts`
  - Files: `src/calculator/tree/systems.test.ts`, `src/calculator/tree/systems.ts`
  - Signatures: `systemOf(code: string | null, writerBlock?: string): { name: string; emoji: string } | null`; `SYSTEM_ORDER: readonly string[]` (the V1 list of `build-v1mold.cjs` `V1`, in order); `systemLabel(s): string` (`"⚗️ Alchemy"`).
  - Built from `tagOf` (`src/calculator/tree/tags.ts`). Every entry has a proof by reference (the `rules.test.ts` format). A cache read goes to its writer's block. Unknown → null (the caller files it under "🔹 Other").
  - Cases:
    - `CardBonusREAL(…)` → Cards;
    - `GetTalentNumber(1, 207)` → Talents;
    - a cache read with an Alchemy writer → Alchemy;
    - an unknown block → null;
    - the order of `SYSTEM_ORDER` is V1's;
    - every name passes `isNameText`.

**Checkpoint**: `just check` passes.

Verify: `just test-one src/main/tree-check.test.ts` - passes; `just test-one src/calculator/tree/systems.test.ts` - passes; `just check` - passes.

---

## Phase 2: User Story 2 - Toda árvore pelos pools do jogo (Priority: P2, built first because US1 builds on it)

**Goal**: the first level of every tree is the game's pools in the order of the sum, with the system groups inside (FR-001–FR-006, FR-008, FR-011).

**Independent Test**: on the invented game, a root that sums, one that multiplies, and one that sums then multiplies each give the right pools, groups and order, and each level sums or multiplies to its parent.

### Tests for User Story 2 (write first)

- [ ] T005 [P] [US2] Tests of the pools from the root's sum in `src/calculator/tree/pools.test.ts`
  - Files: `src/calculator/tree/pools.test.ts`
  - Cases:
    - `(a + b + c)` → one Additive pool;
    - `a × b × c` → three Multi pools, `"Multi pool 1/2/3"` in order;
    - `(5×x + 30×y + 100) × (1 + m ÷ 100)` (Forge stats 2) → `Additive pool` (760) and `Multi pool` (16);
    - `(1 + (s + 2×a) ÷ 100) × b × p × g` (Prod Spd Bonus) → `Additive pool` with two systems, then `Multi pool 1..3`;
    - the root's ⓘ is `"Additive pool × Multi pool"` and closes with the numbers;
    - each pool's `combine` and `poolKind` are set.
- [ ] T006 [P] [US2] Tests of the system groups in `src/calculator/tree/mould.test.ts`
  - Files: `src/calculator/tree/mould.test.ts` (rewritten cases; the 008 cases that pinned the steps as the first level are replaced, by the approved spec change FR-001)
  - Cases:
    - sources grouped by system in V1 order, new systems after, "🔹 Other" last;
    - a group's value is the sum or product of its sources;
    - a neutral group (0 or ×1) stays in place (FR-004);
    - a single source of the same value shows the source alone (FR-006);
    - all sources in "Other" show the sources directly (FR-001);
    - a group with an unavailable source is `unavailable` (FR-013);
    - pools and groups have `pieceKey: null` and ids by name path (`root/Additive pool/⚗️ Alchemy`);
    - every level sums or multiplies to its parent.

### Implementation for User Story 2

- [ ] T007 [US2] The pools from the root's sum in `src/calculator/tree/pools.ts`
  - Files: `src/calculator/tree/pools.ts`
  - Signature: `poolsOf(rows: readonly Row[], rootFormula): Pool[]` with `Pool = { kind: "additive" | "multi"; rows: Row[]; combine }` (research R1).
- [ ] T008 [US2] Rewrite the first level in `src/calculator/tree/mould.ts`
  - Files: `src/calculator/tree/mould.ts`, `src/calculator/tree-build.ts` (where `mould` is called)
  - The first level becomes the pool rows with the system groups inside (`systems.ts`). Names: `"Additive pool"`, `"Multi pool N"` (FR-005). Each file stays under 400 lines.
- [ ] T009 [US2] All pools and groups closed on open in `src/renderer/FormulaTree.tsx`
  - Files: `src/renderer/FormulaTree.tsx`, `src/renderer/FormulaTree.test.tsx` (test first)
  - Cases: on open, every `pool` and `system` row is closed (FR-012); a `system` row shows its emoji name and its value in the format of the parts (`"×45,582"`, `"+80%"`).

**Checkpoint**: `just check` passes.

Verify: `just test-one src/calculator/tree/pools.test.ts` - passes; `just test-one src/calculator/tree/mould.test.ts` - passes; `just check` - passes.

---

## Phase 3: User Story 1 - O Drop Rate igual à V1 (Priority: P1)

**Goal**: the Drop Rate's first level is V1's pools (LUK Scaling, Additive Pool, Total Sum, Post-Processing) with V1's groups (FR-005, FR-010).

**Independent Test**: on the invented Drop Rate the pools are V1's; on the Vinicius's machine, `just parity` shows 0 differences with the bench's V1.

### Tests for User Story 1 (write first)

- [ ] T010 [P] [US1] Test the Drop Rate's V1 pools in `src/calculator/tree/mould.test.ts`
  - Files: `src/calculator/tree/mould.test.ts`
  - Cases:
    - `dropRate` gets the four V1 pools, in V1's order and with V1's names, by a table with proof keyed by the catalog id;
    - any other id never gets them.
- [ ] T011 [P] [US1] The V1 parity in `src/calculator/parity.integration.test.ts` (a new `describe`, run by the existing `just parity`)
  - Files: `src/calculator/parity.integration.test.ts`, `src/calculator/parity-compare.ts`
  - Signature: `compareMould(app: CalcTreeNode, bench: BenchRow): Difference[]` compares pools, groups, order, values and each group's sources by piece key, two levels deep (research R4).
  - Skips by itself without `PARITY_BENCH_DIR/parity/dropRate-v1.json`.
  - Prints only counts and places, never a name or a value (FR-032 of the 008).

### Implementation for User Story 1

- [ ] T012 [US1] The V1 pools table in `src/calculator/tree/mould.ts`
  - Files: `src/calculator/tree/mould.ts` (or a sibling `v1-pools.ts` if `mould.ts` passes 400 lines)
  - Each pool's rule has a proof by reference to `build-v1mold.cjs`.

**Checkpoint**: `just check` passes.

Verify: `just test-one src/calculator/tree/mould.test.ts` - passes; `just check` - passes; `just parity` (Vinicius's machine) - 0 differences in the V1 describe.

---

## Phase 4: User Story 3 - Nenhum degrau sem nome por dentro (Priority: P3)

**Goal**: a row with no game code and no proven name is never a row; its parts move up and the row above's ⓘ has the whole sum (FR-007).

**Independent Test**: on the invented game, a source whose sum has unnamed steps opens straight into its named parts, with an ⓘ that closes; a step with a proven name stays.

### Tests for User Story 3 (write first)

- [ ] T013 [P] [US3] Tests of the flattening in `src/calculator/tree/flatten.test.ts`
  - Files: `src/calculator/tree/flatten.test.ts`
  - Cases:
    - `Game value × Multiplier × X` with the first two unnamed → the parts go up, and the ⓘ is the whole product and closes;
    - a shape-only name ("Multiplier", "Fixed +2") does not hold the row;
    - a proven name holds the row;
    - nested unnamed steps flatten all the way;
    - every level still sums or multiplies to its parent;
    - a game-bug row (FR-016 of the 008) keeps its tag.

### Implementation for User Story 3

- [ ] T014 [US3] The flattening pass in `src/calculator/tree/flatten.ts`, called from `src/calculator/tree/places.ts`
  - Files: `src/calculator/tree/flatten.ts`, `src/calculator/tree/places.ts`
  - Signature: `flatten(rows: Row[]): Row[]`
  - Runs with the `parentPasses` of the 008, on every level. Each file stays under 400 lines.

**Checkpoint**: `just check` passes.

Verify: `just test-one src/calculator/tree/flatten.test.ts` - passes; `just check` - passes.

---

## Phase 5: A vista da árvore (FR-001, FR-013, FR-014)

**Goal**:
- the two-line summary leaves;
- the share is behind a toggle and shows only the number;
- "Changes" shows live arrows against the moment it was turned on or a mark;
- both toggles are kept in `settings.json`.

**Independent Test**: in the window tests, with Changes on, a part's live value change gives "▲ +10%" on the part, its group and its pool; the share toggle shows "26%".

### Tests for the view (write first)

- [ ] T015 [P] Tests of the arrows and the bases in `src/renderer/tree-changes.test.ts`
  - Files: `src/renderer/tree-changes.test.ts`
  - Signatures (in `tree-changes.ts`): `baseOf(tree, live): Record<string, number>`; `groupValue(node, values): number | null` (by `combine`); `arrowOf(fmt, before, now): { up: boolean; text: string } | null`.
  - Cases:
    - a `+%` row shows points ("▲ +10%");
    - a `×` row shows the relative change;
    - no change shows no arrow;
    - a group's value is rebuilt from its sources by `combine` (`sum`, `product`, `onePlusPercent`);
    - against a mark, the base is the mark's piece values;
    - an unavailable source makes the group's arrow absent.
- [ ] T016 [P] Tests of the toggles and the summary in `src/renderer/FormulaTree.test.tsx` and `src/renderer/SidePanel.test.tsx`
  - Files: `src/renderer/FormulaTree.test.tsx`, `src/renderer/SidePanel.test.tsx` (the 008 cases of the summary, of "was" after Refresh, of the row that lights up and of "mark" written are replaced, by the approved spec change FR-001/FR-013)
  - Cases:
    - no summary above the tree;
    - share off by default, on shows "26%" only;
    - Changes off shows no mark of change;
    - Changes on with "live" or a mark shows arrows;
    - the screen reader reads the name, the value, the share when on, and "N sources".
- [ ] T017 [P] Tests of the `view:*` channels in `src/main/payloads.test.ts` and `src/main/settings.test.ts`
  - Files: `src/main/payloads.test.ts`, `src/main/settings.test.ts`
  - Cases:
    - `view:set` accepts only `{ changes: boolean, share: boolean }`, refusing any other key or type;
    - `view:get` gives both false when the file is missing or bad;
    - a write goes through `.tmp` + rename like the zoom.

### Implementation for the view

- [ ] T018 The `view:get` / `view:set` channels in `src/main/payloads.ts`, `src/main/settings.ts`, `src/main/index.ts`, `src/preload/api.ts`
  - Files: as listed, plus the IPC names in `src/shared/`
  - Contract: `contracts/ipc.md`.
- [ ] T019 The arrows and bases in `src/renderer/tree-changes.ts`
  - Files: `src/renderer/tree-changes.ts`
  - Uses the live part values the main already sends (`partsOf`, at most 200 pieces) and the marks of the 008 (research R5).
- [ ] T020 The toggles in `src/renderer/ViewToggles.tsx`; the summary out of `src/renderer/SidePanel.tsx`; arrows and share in `src/renderer/FormulaTree.tsx`
  - Files: `src/renderer/ViewToggles.tsx`, `src/renderer/SidePanel.tsx`, `src/renderer/FormulaTree.tsx`, `src/renderer/ChangeBadge.tsx` (the "Game changed · Refresh" band stays; the per-row "was" and lighting leave)
  - Each file stays under 400 lines.

**Checkpoint**: `just check` passes.

Verify: `just test-one src/renderer/tree-changes.test.ts` - passes; `just test-one src/renderer/FormulaTree.test.tsx` - passes; `just check` - passes.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Independent Test**: the probe of the 716 trees on the installed game shows 0 unnamed math branches and 0 levels that do not close; `ARCHITECTURE.md` describes the pools and the toggles.

- [ ] T021 [P] `ARCHITECTURE.md`: one paragraph on the pools, the system table and the Changes toggle
  - Files: `ARCHITECTURE.md`
  - The new files (`pools.ts`, `systems.ts`, `flatten.ts`, `tree-changes.ts`, `ViewToggles.tsx`) enter the Code folders table.
- [ ] T022 [sessão] Run the probe of the 716 trees on the installed game and grow `systems.ts` until no source with a known block falls in "Other"
  - Files: `src/calculator/tree/systems.ts` (by the Executor, from the list the probe gives); the probe stays outside the repo
  - Expected:
    - 0 unnamed math branches (SC-001);
    - 0 levels that do not close (SC-003);
    - the count of "Other" sources goes in `registro.md`.
- [ ] T023 [sessão] Run `just parity` with the bench's V1 export (quickstart.md) - 0 differences (SC-002)
- [ ] T024 [sessão] The quickstart with the packaged app on the real game (steps 1–7) and the 5-second test (SC-004), with the result in `registro.md`

**Checkpoint**: `just check` passes.

Verify: `just check` - passes; the probe - 0 unnamed math branches; `just parity` - 0 differences.

---

## Dependencies & Execution Order

- **Phase 1:** first.
- **Phase 2 (US2):** builds the general pools that US1 specializes.
- **Phase 3 (US1):** needs Phase 2.
- **Phase 4 (US3):** needs Phase 1 only.
- **Phase 5:** needs Phase 1, for the `combine` field.
- **Phase 6:** last.

Parallel: T001 and T004; T005 and T006; T010 and T011; T015, T016 and T017.

## Implementation Strategy

1. **MVP:** Phases 1 to 3, the Drop Rate in V1 pools and every tree in game pools.
2. **Then:** Phase 4 (no unnamed step) and Phase 5 (the view).
3. **Polish** closes it with the probe and the parity.

## Review Focus

1. **A root whose sum the pools rule cannot read** (a `max`, a `floor` or a condition at the top): a reasonable user expects the tree still to open, with whatever pools can be read and the rest as plain sources, never an empty or wrong tree. Pinned by "a root with max() at the top keeps its sources" in `pools.test.ts`, task T005, Phase 2.
2. **A group whose sources have different formats** (a `+%` source next to a `×` source in the same system of one pool): a reasonable user expects the group's value in the pool's own format and the sources in theirs. Pinned by "a group mixing + and × sources" in `mould.test.ts`, task T006, Phase 2.
3. **Flattening that would hide a game bug or a cut** (a truncated row or a game-bug row inside an unnamed step): a reasonable user expects the tag to stay visible on the part that moved up. Pinned by "a game-bug part keeps its tag after flattening" in `flatten.test.ts`, task T013, Phase 4.
4. **Changes on with more than 200 parts open** (the live limit of the 008): a reasonable user expects arrows on what is followed and no false arrow on the rest. Pinned by "a part beyond the live limit shows no arrow" in `tree-changes.test.ts`, task T015, Phase 5.
5. **A mark taken before the 009** (pieces of the 008): a reasonable user expects the comparison with the mark to still work by piece. Pinned by "a mark of the 008 compares by piece" in `tree-changes.test.ts`, task T015, Phase 5.
