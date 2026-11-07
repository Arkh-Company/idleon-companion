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
