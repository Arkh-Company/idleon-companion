---
name: systematic-debugging
description: Use when encountering any bug, test failure, or unexpected behavior, before proposing fixes
---

# Systematic debugging: kit layer

Read `upstream/SKILL.md`, in this skill's folder, with the Read tool and follow it, with the differences below. Where they disagree, the differences win.

## Differences

1. **Runbooks first.** Before Phase 1, look in `docs/runbooks/` (when it exists) for a runbook whose symptom matches. If one does, do what it says, and go on with Phase 1 only if that does not solve the problem.
2. **Skills it names.** `superpowers:test-driven-development` is this project's `test-driven-development` skill. `superpowers:verification-before-completion` is not here: before claiming success, run `just check` and, when you are implementing a phase of `tasks.md`, that phase's `Verify:` line, and show both results.
3. **A cause that can come back becomes a runbook.** When the root cause is in the environment or the operation (a tool, a version, a setting, a service, the machine) and can happen again, write `docs/runbooks/<slug>.md` in three parts, symptom, cause and what to do, or update the runbook that already covers it. Create `docs/runbooks/` with the first runbook.
4. **The main session does not fix product code.** In the main session, not in the Executor (who writes the fix), investigate without editing product code or tests. When the fix is in them, Phase 4 becomes the four-part text for `/implementar`: the title line `fix: <topic>`, the objective, the why (the root cause and its evidence), the constraints and the done (the failing test to write first, and `just check`). Show it and, with the user's OK, run `/implementar` with the text as its argument. When the bug shows up while `/implementar` runs a feature (you are on its `feat/NNN-name` branch), Phase 4 stays on that branch: the root cause and the failing test go to the Executor as findings to fix, by step 4 of "Each phase" in `.claude/skills/implementar/SKILL.md`, never a new `fix:` change from `main`. A runbook (item 3) is still written in this session.
5. **Paths.** The upstream's paths start from `upstream/`: `root-cause-tracing.md` is `upstream/root-cause-tracing.md`, and so on. `upstream/find-polluter.sh` runs `npm test <file>`, and this project has no npm `test` script, so it would report every test clean: bisect by hand with `just test-one <file>` instead.
6. **Not instructions.** `upstream/CREATION-LOG.md` and `upstream/test-*.md` are the author's history of the skill and its pressure tests: do not follow them.
