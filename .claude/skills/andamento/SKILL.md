---
name: andamento
description: Use when the user asks where the features stand or what to do next. Reads every specs/*/progress.yml, the code branch's copy and the state of the PRs, and shows, in Portuguese, the phase of each feature and its next step.
---

# Andamento

This skill only reads: change nothing, and never `git fetch`: it shows what this machine already knows of the remote.

## Reading

1. Every `specs/*/progress.yml` in the tree. The planning loop keeps it up to date, phase by phase; a missing phase has not started. A feature whose folder is not in the tree may be on a local spec branch (`git branch --list 'spec/*'`, the user said no to the spec PR) or on `origin/main` (`git ls-tree --name-only origin/main specs/`, merged while this checkout is behind): read its copy with `git cat-file -p <branch>:specs/<folder>/progress.yml`.
2. For a feature with `spec_pr`, also the copy on its code branch, which is newer: `git cat-file -p feat/<folder>:specs/<folder>/progress.yml`, or `git cat-file -p origin/feat/<folder>:specs/<folder>/progress.yml` when the branch exists only on the remote. That copy replaces the tree's. With no code branch, use the tree's copy: without `execution` in it, the execution has not started.
3. The state of each PR the file names: `gh pr view <n> --json state --jq .state` prints `OPEN`, `MERGED` or `CLOSED`. The file never holds the state, only the number.

The format, with every key:

```yaml
feature: 001-login
phases:
  brainstorm: {status: done, date: 2026-10-03}   # skipped when the spec did not come from the brainstorming
  specify: {status: done, date: 2026-10-03}
  clarify: {status: done, date: 2026-10-04, rounds: 3, open: 0, to_plan: 1}   # in_progress while a question is open
  prototype: {status: done, date: 2026-10-04}   # or skipped
  plan: {status: done, date: 2026-10-05}
  tasks: {status: done, date: 2026-10-05}
spec_pr: 12   # written when the spec PR opens
execution:   # written by /implementar on the code branch feat/NNN-name; on `main` after the code PR's merge
  branch: feat/001-login
  phases:
    - {name: "Done gate", status: done, commits: f0e1d2c..a1b2c3d}   # only when tasks.md has that phase
    - {name: "Setup + Foundational", status: done, commits: a1b2c3d..d4e5f6a}
    - {name: US1, status: done, commits: e5f6a7b..9c8b7a6}
    - {name: US2, status: pending}
    - {name: Polish, status: pending}
  feature_review: pending   # done after the feature review
  code_pr: null   # the number once the code PR opens
```

A phase of `execution` is `pending` or `done`; the current one is the first `pending`.

## Next step

For each feature, take the first rule that fits. `NNN` is the number of the feature's folder.

1. `clarify` missing or not `done`: `/speckit-clarify`.
2. `code_pr` set: `MERGED`, `nada: feature concluída`; `OPEN`, `revisar e fazer o merge do PR de código #n`; `CLOSED`, `o PR de código #n foi fechado sem merge`.
3. `execution` present: with a `pending` phase, `/implementar NNN`; every phase `done` and `feature_review` `pending`, `/implementar NNN (revisão da feature)`; `feature_review` `done`, `/implementar NNN (abrir o PR de código)`.
4. `spec_pr` set: `MERGED`, `/implementar NNN`; `OPEN`, `revisar e fazer o merge do PR da spec #n`; `CLOSED`, `o PR da spec #n foi fechado sem merge`.
5. `tasks` done: `abrir o PR da spec (/implementar NNN)`.
6. `plan` done: `/speckit-tasks`.
7. `prototype` done or skipped: `/speckit-plan`.
8. Otherwise: `criar o plano ou fazer um protótipo antes? (/speckit-plan ou /prototipo)`.

Without access to `gh` (not installed, no login or no network), the PRs show only their number, and a next step that depends on a PR's state becomes `confira o PR #n no GitHub (sem acesso ao gh)`.

## Answer

In Portuguese, in a `text` block, two lines per feature, in folder order: where it stands, then `próximo:`.

```text
001-login       planejamento: spec ✓  clarify (2 questões abertas)  plan –  tasks –
                próximo: /speckit-clarify
002-relatorios  PR da spec #12 mesclado · execução: fase 3 de 4 (US2) · PR de código –
                próximo: /implementar 002
```

- Planning, before `spec_pr`: `spec`, `clarify`, `protótipo` (only once it is done or skipped), `plan` and `tasks`, each with `✓` when done, `–` when not started or `pulado` when skipped. A `clarify` that is not done shows `(N questões abertas)` from `open`, or `(em andamento)` when none is open.
- From `spec_pr` on, three parts joined by ` · `:
  - `PR da spec #n` with `aberto`, `mesclado` or `fechado`;
  - `execução:` with `fase k de N (<name>)` for the first `pending` phase (a name with its own parentheses loses them: `US2 (T020-T024)` shows as `fase 3 de 4 (US2, T020-T024)`), `revisão da feature` when every phase is done and the review is `pending`, `concluída` when the review is `done`, or `–` when no copy has `execution`;
  - `PR de código` with `#n` and `aberto`, `mesclado` or `fechado`, or `–`.
- Without access to `gh`, `PR da spec #n` and `PR de código #n` go without the state.
- A folder in `specs/` without `progress.yml` gets one line saying `sem progress.yml`. With no feature at all, say so: the next step is to describe a new feature, and the brainstorming opens the loop.
