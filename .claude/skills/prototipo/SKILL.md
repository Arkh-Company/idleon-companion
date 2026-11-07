---
name: prototipo
description: Use when the how of a planned feature is uncertain (an algorithm, performance, or how a library behaves) and needs a test before /speckit-plan. Writes a disposable prototype in the feature's specs folder and records the decision for the plan.
---

# Prototype

A prototype answers a how question with facts before `/speckit-plan`. It is not product code: it stays out of `just check`, goes into git with the spec and freezes with it. The Executor writes the real version in `src/`, with TDD, using it as a reference.

It belongs to a feature: the one this session is planning (`.specify/feature.json` names its folder) or the one the user names. `NNN-name` below is that folder in `specs/`. When the feature has no folder yet, stop and say so: a feature starts in the brainstorming, which opens the loop. When its `progress.yml` has `spec_pr` and that PR is merged (`gh pr view <spec_pr> --json state --jq .state` prints `MERGED`), stop and say so: the spec is frozen, and the prototype with it. When `gh` cannot tell (not installed, or no login), say so and stop.

Do these steps in order:

1. **Agree on the test.** Say in a few sentences what you will test and how: the question, the code and the measure that decides it. When the experiment is about a flow or an algorithm, first draw it with the user through the archify skill: the JSON as `specs/NNN-name/diagramas/<name>.<type>.json`, the HTML in `specs/NNN-name/diagramas/local/`, which git ignores. Wait for the user's OK, and write nothing else before it.
2. **Write the code** only in `specs/NNN-name/prototipo/`. Every code file starts with a comment line that marks it as disposable, such as `# Disposable prototype: not product code.` (`//` in JS/TS). Never add a dependency to the project:
   - Python: a notebook with `uvx marimo edit specs/NNN-name/prototipo/<name>.py` when the user should explore the results (it is a server: start it in the background), and checks with `uv run --with hypothesis pytest specs/NNN-name/prototipo` (files named `test_*.py`). A library the project does not have comes in the same way, with `--with <package>`.
   - JS/TS: Node 24 runs `.ts` directly (`node specs/NNN-name/prototipo/<name>.ts`), and Vitest checks the results (`pnpm exec vitest run --dir specs/NNN-name/prototipo`, with files named `*.test.ts`). A library the project does not have goes in a `package.json` of this folder: create that file first, then run `pnpm add <package>` inside the folder.
3. **Record the result** in `specs/NNN-name/prototipo/README.md`, in the user's language: what you tested, the numbers you measured and how, and the decision. `/speckit-plan` reads this file and carries the decisions into `research.md`.
4. **Record the phase and commit.** In `specs/NNN-name/progress.yml`, set `prototype: {status: done, date: YYYY-MM-DD}` under `phases`, with today's date. Create the file if it is missing, and leave the other phases as they are. Commit `specs/NNN-name/` on the feature's branch, `spec/NNN-name`, with a Conventional Commits message.
5. **Choose the next step with the user.** When what you learned changes the what of the feature (a requirement, a scenario, the scope), first add an `open` row for that change to the Open Questions table of `specs/NNN-name/spec.md`, and set `phases.clarify` in `progress.yml` to `status: in_progress`, with `open` counted again from the table: from then on `/speckit-plan` refuses to start and `/andamento` points to the clarify. Then tell the user the decision and ask before going on: back to `/speckit-clarify`, with the `open` rows as its argument, when the spec has an `open` question (that new row included); otherwise on to `/speckit-plan`. When the what changed, start that argument with "Prototype finding that changes the what of the feature:" followed by the change: that round runs the checklists again.
