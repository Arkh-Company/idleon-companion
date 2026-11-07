<!--
  IMPORTANT (kit rules): these override every "OPTIONAL" above and apply to each phase of the generated tasks.md.
  Do not copy the comments of this addendum into tasks.md.

  1. Tests are mandatory. Every phase writes its tests first, and they must fail before the implementation exists.
     In tasks.md, the Tests line says "Tests are mandatory" and the "Tests for User Story N" headings drop "OPTIONAL".
  2. Every phase (Setup, Foundational, each user story, Polish) has an **Independent Test** line, which says how to
     check the phase on its own, and ends with a `Verify:` line with the exact command and the result it must show,
     for example `Verify: just test-one tests/test_login.py - 4 passed`. `just check` passes at the end of every phase.
  3. Every task lists, on indented lines under its checklist line, the files it changes, the signatures it creates
     or changes, and the main flows and edge cases its tests cover. The checklist line keeps its strict format.
  4. Every task that creates or changes a file of the done gate goes to a phase "Done gate", before Setup, and its
     checklist line carries `[sessão]` right after the task ID: `- [ ] T001 [sessão] Add the e2e recipe to justfile`.
     The done gate is `AGENTS.md`, `CLAUDE.md`, `justfile`, `Justfile`, `JUSTFILE`, `.justfile`, `.Justfile`,
     `.JUSTFILE`, `lefthook.*`, `.lefthook.*`, `lefthook-local.*`, `.lefthook-local.*`, `mise.toml`, `.mcp.json`, `pyproject.toml`, `ruff.toml`,
     `.ruff.toml`, `pyrightconfig.json`, `tsconfig*.json`, `eslint.config.*`, `.eslintrc*`, `.eslintignore`,
     `prettier.config.*`, `.prettierrc*`, `.prettierignore`, `vitest.config.*`, `vite.config.*`, `playwright.config.*`,
     `smoke.spec.ts`, `.gitleaks.toml`, `.gitleaks-dir.toml`, `.gitleaksignore`, `.gitattributes`, `.worktreeinclude`,
     `.playwright/cli.config.json`, `.impeccable/config.json`, `.editorconfig`, `.pnpmfile.cjs`,
     `pnpm-workspace.yaml`, `.npmrc`, `uv.toml`, `.uv.toml`, `mise.lock`, `.copier-answers.yml`,
     `release-please-config.json`, `.release-please-manifest.json`, `.github/**`, `.claude/**`, `.specify/scripts/**`,
     `.specify/extensions/*/scripts/**` and `.specify/kit/**`, in any folder. The Executor cannot edit these files: the session applies the phase itself,
     with the user's confirmation for each edit, and commits it before the first phase of code. A task that also
     changes other files is split, and only its done-gate part goes to this phase. `just check` passes at the end of
     this phase too, before the code exists: write each change so that it works without it, for example a test
     runner that passes with no tests yet. With no such task, there is no Done gate phase.
-->

## Review Focus

<!--
  Up to 5 input classes or failure modes that the spec implies and no test exercises, the most likely first. Write
  fewer when fewer qualify, and "None" when nothing does: do not pad, and do not drop this section. For each one,
  say the behavior a reasonable user expects and the test that pins it. That test is a task in the phase that owns
  the code.

  When `checklists/security.md` exists, add a "### Security Criteria" list under this heading: for each task the
  checklist concerns, the task ID and the criteria from the checklist that its code must meet.
-->

1. [Input class or failure mode the spec implies]: a reasonable user expects [behavior]. Pinned by [test name], task [TXXX] in Phase [N].
