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
Good: `expect(toContext({ ...base, menu: 0.1 }, cat).names.menu).toEqual({ name: "Quik Ref shortcut (Anvil)", status: "deduced" })` next to the map, window and AFK assertions.
Bad: a test that checks `names.map`, `names.window` and `names.afk` while `names.menu` is filled by code no test reaches.

### Protective paths are tested on the CI

Every cleanup, fallback or swallowed error that keeps the game safe has a test that runs on the CI (a fake `Cdp`, not only the Edge integration test) and fails when that path is removed.
Good: `engine-ref.test.ts` drives `acquireEngine` with a fake `Cdp` whose `Debugger.evaluateOnCallFrame` rejects and asserts `Debugger.removeBreakpoint` and `Debugger.resume` are sent after it.
Bad: a `try { onReading(r) } catch {}` whose only test sits inside `describe.skipIf(!existsSync(EDGE))`, so the CI stays green when the `catch` is removed.

### Every branch or state reset is seen failing

Every branch or state reset a change adds has one assertion that fails when that line is removed.
Good: a retry test that keeps `setupSteam` pending and asserts that the old alert is gone.
Bad: a retry test that ends in the screen's final line, which returns before the alert is drawn, so removing the reset
changes nothing.

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
