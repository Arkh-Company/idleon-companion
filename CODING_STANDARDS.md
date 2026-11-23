# Coding standards

The Revisor reads this file in every phase and in the feature review, and `/zelador` reads it when the user runs it over the whole repository; it holds the stack facts, what not to review, and the rules, one theme per rule, each with a good and a bad example.

## Stack facts

- Language: TypeScript 6 on Node 24, as ES modules.
- Tests: Vitest, next to the code.
- Lint: ESLint, with the strict type-checked rules of typescript-eslint.
- Format: Prettier.
- Types: `tsc`, in strict mode.
- Packages: pnpm.
- Exact versions: `mise.toml` for the tools and `pnpm-lock.yaml` for the dependencies.

## What not to review

- Formatting: Prettier owns it, and `just check` enforces it.
- What the linter and the type checker already catch: ESLint and `tsc` run in `just check`.
- Generated or copied content: the lockfiles (`mise.lock` and `pnpm-lock.yaml`), the frozen specs in `specs/` with their prototypes, everything in `.specify/`, and the community skills in `.claude/skills/`.

## Rules

<!--
Format: one theme per rule, each with a good and a bad example. Start small.
Entry rule: a rule is added when the same problem shows up a second time in a review.
Shape of a rule:
### <theme in a few words>
<the rule, in one sentence>
Good: <example>
Bad: <example>
-->

### One assertion per branch of a mapping

Every table or field a mapping function fills has at least one test assertion that fails when that branch is removed.
Good: `expect(toContext({ ...base, afk: "Nothing" }, tables).names.afk).toBe("None")` next to the assertions of the map name, the monster name and "Unknown monster".
Bad: a test that checks `names.map` and `screen.label` while `names.afk` is filled by code no test reaches.

### Protective paths are tested on the CI

Every cleanup, fallback or swallowed error that keeps the game safe has a test that runs on the CI (a fake `Cdp`, not only the Edge integration test) and fails when that path is removed.
Good: `engine-ref.test.ts` drives `acquireEngine` with a fake `Cdp` whose `Debugger.evaluateOnCallFrame` rejects and asserts `Debugger.removeBreakpoint` and `Debugger.resume` are sent after it.
Bad: a `try { onReading(r) } catch {}` whose only test sits inside `describe.skipIf(!existsSync(EDGE))`, so the CI stays green when the `catch` is removed.

### Every branch or state reset is seen failing

Every branch or state reset a change adds has one assertion that fails when that line is removed.
Good: a retry test that keeps `setupSteam` pending and asserts that the old alert is gone.
Bad: a retry test that ends in the screen's final line, which returns before the alert is drawn, so removing the reset
changes nothing.

### A rewritten expectation keeps what it pinned

When a test's expected value changes, the new assertion still checks every field the old one checked (name, value,
type, flags), unless the spec removes that field.
Good: after the emporium gains a part, `rowsOf(emp)` still checks `[name, value, leaf]` of every part, the new one
included.
Bad: the same change turns `[name, value, leaf]` into `[k.name, k.value]` and adds a part typed `"unknown"`, so the
false "?" passes unseen.

### A test changes before its code, in a commit of its own

A test's fixture or expectation that changes after its failing-test commit goes in a commit of its own, before the code, saying why it changed.
Good: `test(tree): the sigil's artifact comes wrapped in its "Multiplier" branch, as the recording gives it`, committed before `feat(tree): each bonus shows its full build-up…`.
Bad: a commit that rewrites the fixtures and the expectations in the same commit as the code that makes them pass, so no one sees the test fail first.

### Rules wired in the Electron entry are tested

Every decision in `src/main/index.ts` (a shared lock, a memory of the last state) lives in a function that a test reaches and that fails when the wiring is removed.
Good: `steamSetupJob(sys, store, part, onProgress)` runs one setup over one lock, and a test with `fake-system` asserts one `shutdown` when it is called twice at once.
Bad: two `handle()` calls in `index.ts` sharing a `oneAtATime` that only has a test of its own, so giving each one a separate lock keeps the CI green.

### Shared literals live in one place

A string or type that two process folders compare or map (a link message text, a failure reason) is exported once from `src/shared/index.ts`; neither side keeps a copy.
Good: `export const GAME_UPDATED = "Game updated: the reader needs an update"` in `src/shared/`, imported by `src/keeper/reader.ts` and `src/renderer/StatusBar.tsx`.
Bad: `StatusBar.tsx` declaring its own `const GAME_UPDATED = "Game updated: …"` next to the same literal in `reader.ts`, so a reworded keeper message silently brings "Reconnect" back.

### Windows tools by full path

A Windows tool (`reg`, `tasklist`, `cmd`) runs by its `System32` path, in Node and in NSIS alike, never by name.
Good: `execFile(systemTool("tasklist", process.env.SystemRoot), …)`; `"$SYSDIR\tasklist.exe"` in `installer.nsh`.
Bad: `nsExec::Exec '"$CmdPath" /C tasklist …'`, which lets `cmd` search the working folder first.

### Player names in tests are invented

Every character or account name in a test, a fixture or an example is invented, never copied from a capture or a real session.
Good: `char: "Tester"` in a `Reading` literal.
Bad: the name of the character used in the game round, pasted into a `Reading` literal because the state was copied from a capture.

### The test of a criterion feeds the field the criterion names

A test written for a security or spec criterion passes the risky data through the real field the criterion names, and fails when only that field loses the protection.
Good: `names: { map: "<b>Map</b>", afk: "<i>Mob</i>" }` in the test that names from the game show as plain text.
Bad: `label: "<b>Bold</b>"` in that test, a text of the compiled catalog that never comes from the game, so the game's names are not exercised.

### Text-scan guards cover every spelling and path

A test that scans source text for a forbidden call matches every spelling that reaches it and reads every file the guarded data passes through.
Good: `loads("(?:node:)?net")` over all of `src/` in `no-network.test.ts`, with a "the scan catches %s" case per form.
Bad: `/node:vm/` over `game-tables.ts` alone, while the game text also sits in `keeper.ts` and `import "vm"` passes.

### Test tables live once

A table or builder that two test files repeat (a contract table, a `Reading` builder) lives in one `*-fixture.ts` next to the code and is imported by both.
Good: `READ_NULLS` in `src/shared/reading-fixture.ts`, spread into the `Reading` literal of seven tests.
Bad: the 18-row behavior table typed in `read-only.test.ts` and again in `read-fields.test.ts`, so a change to the contract needs two edits and the two tests can drift apart.

### A forced copy of a shared literal is pinned both ways

When a file cannot import `src/shared/index.ts` (a script run as text inside the game, the calculator's lone bundle), its copy of a shared literal has one test that fails when either side changes.
Good: `expect(TARGETS.map(([id]) => id)).toEqual([...NUMBER_IDS])` in `src/calculator/index.test.ts`, which fails for a key added on either side.
Bad: a `SKIP` in a script with a comment "keep equal to STATE_EXCLUDED", while the only test feeds the fake engine every `STATE_EXCLUDED` key and stays green when `SKIP` gains a key the test never puts in the engine.

### A comment changes with the shape it describes

Every comment, JSDoc or glossary line that describes a type, a field or a module's readers is rewritten in the same commit that changes that type, field or import.
Good: the commit that adds `text?: string` to `TreeNode["formula"]` also rewrites its JSDoc and `formulaLines`' to say the game's text is an optional line before the names and the numbers.
Bad: `formula` gains `text?: string` while the JSDoc right above it still says "names and numbers only" and `formulaLines` still says "in two lines".

### A tree helper lives once

A small helper that two files of `src/calculator/tree/` need (`strip`, `isNum`, the test of a log's argument) is exported once, from the file its theme belongs to, and imported; no file keeps its own copy.
Good: `import { strip, isNum } from "./expr.ts"` in `gold-food-step.ts`, `gold-food-chain.ts`, `pools.ts` and `tops.ts`.
Bad: `const strip = (e) => (e.t === "def" ? strip(e.e) : e)` typed again in `gold-food-step.ts`, beside the same copy in `gold-food-chain.ts`, `percent.ts`, `scaled.ts` and `tops.ts`.

### A shape test pins the direct rows

A test of a tree's shape asserts the exact rows of the level it names (name and code, in order), never `some` or `arrayContaining` over the descendants.
Good: `expect(kidsOpen(b, base).map((k) => [k.name, k.code])).toEqual([["🃏 Cards", undefined], ["📜 Stamps", undefined], …])`.
Bad: `expect(below(b, base, 3).map((k) => k.code)).toEqual(expect.arrayContaining([...]))`, which passes with an unnamed "Game value" row in between; or `kidsOpen(b, k).some((x) => x.code?.startsWith("Companions("))`, which passes when the row says "Owned".

### An ⓘ names the rows it shows

The test of a level with an ⓘ checks that each name in the ⓘ is the name of one of the level's rows, as it shows after its placement.
Good: `expect(linesOf(group.formula)[0]).toBe(kidsOpen(b, group).map((k) => k.name).join(" + "))` for the group inside "Base Damage".
Bad: checking only `names.not.toContain("Game value")` in the cap's ⓘ, while the ⓘ of the group just below says "Game value + Game value + Game value" and its rows say "Big Meaty Claws bubble".

### Every path field of a blueprint passes the ref checks

Every field of a blueprint that holds a state path runs the same checks as `ref.read` (`isPathRead` and `hasRawCharacterIndex`), with one refused case per check in its test.
Good: `isStatePath(root.branch)`, which runs both checks of `ref.read`, and a `branch: "PlayerDATABASE[0].Lists[3]"` case in the refusals of `blueprint-root.test.ts`.
Bad: `branch` and `sum` checked by `isPathRead` alone, so `PlayerDATABASE[0]…` loads while the same path in `ref.read` is refused.

### The answer key ties by the recorded place, never by value alone

Every lookup of the answer key that ties a write, a step, a call or a path to another uses the recorded place (`xi`, `stepAt`, the node); when the place does not decide and a second candidate has the same value, the root is refused with the reason, never settled by value or by order.
Good: the passage opens the step its write came right after (`xi`), and two passages worth 0 with no place to tell them apart refuse "a passagem V sai de mais de uma escrita (…), e a posição não decide entre elas".
Bad: `ctx.steps.findIndex((s, j) => !seen.has(j) && near(s.v, v))`, which takes the first of two steps worth 0 and swaps Cards and Stamps.
