---
name: implementar
description: Use when the user asks to implement a planned feature whose spec PR is merged (/implementar NNN), or an approved small change or bug fix written as a four-part text. Runs the Executor and the Revisor subagents phase by phase, stops after each phase, and opens the PRs with the user's yes.
argument-hint: "NNN | <texto em quatro partes>"
---

# Implementar

This session coordinates the execution: the Executor writes the code of one phase, the Revisor reviews it, and you stop after each phase to show the result. Talk to the user in Portuguese: every question and every summary.

## Call

- `/implementar NNN`: the feature whose folder is the only one matching `specs/NNN-*`, in the tree, on `origin/main` or on a local `spec/NNN-*` branch (step 1 of "Before you start"). With no folder or more than one, say so and stop. `NNN-name` below is that folder's name.
- A four-part text whose first line is `feat: <topic>` or `fix: <topic>`: follow "Small change or bug fix".
- Any other argument: ask what to run.

## Rules

- You never write product code, nor tests: the hook blocks you, and every change to them goes through the Executor. The one exception is the `[sessão]` tasks of the Done gate, which only touch files of the done gate (`smoke.spec.ts` among them).
- Call the subagents with the Agent tool, `subagent_type` `executor` or `revisor`, in the foreground (`run_in_background: false`) and never with `isolation: worktree`: each phase builds on the commits of the earlier ones, in this checkout, and an isolated worktree starts from the remote's default branch.
- One Executor call per phase, never two at once. A request to a subagent describes only its phase or round, never the history of the earlier ones; the one exception is the line per earlier finding that the Revisor gets.
- The diff reaches the Revisor in a file, never pasted into the request: `node .claude/scripts/pacote.mjs <base> <head> <output>`, at the project root. `<base>` and `<head>` are a commit SHA or `HEAD`, `<base>` must be an ancestor of `<head>` and the range cannot be empty; `<output>` is `.superpowers/implementar/<folder>/<name>.diff`. It prints `pacote: <output> (<n> commits, <x> linhas)` or refuses with `pacote: <reason>`.
- Before each AskUserQuestion, give the context in the chat. Never answer a question of the Executor yourself: it goes to the user.
- Never run `/speckit-clarify`, `/speckit-plan` or `/speckit-tasks` on the code branch: the spec is frozen there, and a change to it follows "The spec during implementation".

## Work folder

`.superpowers/implementar/<folder>/`, which git ignores: `NNN-name` for a feature, `feat-<topic>` or `fix-<topic>` for a small change, where `<topic>` must match `^[a-z0-9-]{1,60}$` (see "Small change or bug fix"). No `:` and no space in the folder and file names. For phase `N` (its position in the list of phases, from 1):

- `fase-N-pedido.md`, the request to the Executor; `fase-N-relatorio.md`, his report; `fase-N.diff`, the package; `fase-N-revisao.md`, the verdict. Correction round `R` adds `-rR` before the extension (`fase-N-r1.diff`, `fase-N-revisao-r1.md`); the end of the feature uses `feature` in place of `fase-N`.
- `fase-N-criterio-inicio.txt`: the baseline of the done gate, taken once at the start of the phase, always in one format: line 1 `commit <sha>` (the commit the baseline stands for), line 2 `exit <code>` (the exit code of `confere`), then the output of `confere --hash`; the comparison reads the output from the third line on. `feature-criterio-inicio.txt` is the same for the correction round of the feature review. The Executor and the Revisor cannot edit them (the `protect-files` hook).
- `achados-menores.md`: the Minor findings of every phase, for the feature review.
- `registro.md`: one line per step, which starts with `fase-N` (or `feature`) and a space: the starting commit, the Executor's ID, each verdict with one line per finding (severity, `file:line`, the problem in a few words), each round with the commit it started from, the commit at the end, and each step of "End of the feature" once done.

After a compaction, or in a new session, resume from `registro.md`, the `progress.yml` and `git log`, never from memory.

## Progress in the chat

- Before each step (the Executor of a phase, the Revisor, each correction round, the feature review, the built-in steps such as `/code-review`, `just security` and `/security-review`, and each PR), write one short line in Portuguese saying what starts, such as "Fase 2 de 5 (US1): Executor implementando T010–T018".
- After each step, one line with its result, such as "Executor: 3 commits, just check verde", "Revisor: 2 achados graves, rodada 1 de 2" or "Fase 2 concluída".
- When a subagent runs in the background anyway (a background session forces it), follow it with the Monitor tool:
  - the registro, `tail -n 0 -F .superpowers/implementar/<folder>/registro.md | grep --line-buffered -E '^(fase-[0-9]+|feature) '`. It carries only the lines this session writes, already in the chat: do not relay them, they show that the monitor works;
  - the Executor's commits, the only thing a subagent writes while it runs (the Revisor writes nothing until his reply), in the Bash tool: `ultimo=$(git rev-parse HEAD); while sleep 20; do novo=$(git rev-parse HEAD); git log --reverse --format='%h %s' "$ultimo..$novo"; ultimo=$novo; done`. Relay each commit in one line.

  Every monitor filter releases line by line (`grep --line-buffered`, `awk` with `fflush()`, never `cut` and never `head`), and a file that can be rewritten whole is followed by name (`tail -F`) or with a reader that counts lines. Check the first event: when nothing arrives after a step that should have produced a line, the monitor is broken; stop it and start it again. Also start a monitor again when it times out, and stop the monitor when the phase, or the step of "End of the feature", ends.

## progress.yml

A feature's `specs/NNN-name/progress.yml` gets these keys besides the planning ones:

```yaml
spec_pr: 12
execution:
  branch: feat/001-login
  phases:
    - {name: "Done gate", status: done, commits: f0e1d2c..a1b2c3d}
    - {name: "Setup + Foundational", status: done, commits: a1b2c3d..d4e5f6a}
    - {name: US1, status: done, commits: e5f6a7b..9c8b7a6}
    - {name: US2, status: pending}
    - {name: Polish, status: pending}
  feature_review: pending
  code_pr: null
```

- `spec_pr` comes from "Spec PR", on the spec branch. `execution` is written only on the code branch.
- A phase's `status` is `pending` or `done`; the current phase is the first `pending` one. `commits` is `<start>..<end>`: `HEAD` before the Executor, and the last commit of the phase, before the commit of `progress.yml`.
- The state of a PR is never written: read it with `gh pr view <n> --json state --jq .state`.

## Spec PR

The end of `/speckit-tasks` and the start of `/implementar NNN` follow this section, on the branch `spec/NNN-name` where `/speckit-tasks` ran.

0. Find where `spec/NNN-name` is checked out: in `git worktree list --porcelain`, the `worktree <path>` line just above `branch refs/heads/spec/NNN-name`. Git does not switch to a branch that another worktree has open, and only step 5 needs it checked out:
   - in this checkout, go on;
   - in another worktree, do steps 1 to 4 from here, and step 5 in that worktree: edit `<path>/specs/NNN-name/progress.yml`, then `git -C <path> commit -m "<message>" -- specs/NNN-name/progress.yml`;
   - in none, `git status --porcelain` clean (as step 2 of "Before you start"), then `git switch spec/NNN-name`.
1. Run these checks in order. When one fails, say in Portuguese what is missing and stop:
   - `gh auth status`: with no login, ask the user to run `cd '<project folder>' && gh auth login`;
   - `git remote get-url origin`: with no remote, offer `just github <owner>` (below);
   - `git ls-remote --exit-code --heads origin main`: with no `main` on GitHub, offer `just github <owner>` (below).

   `just github <owner>` creates the private repository, publishes `main` and protects it; the hooks never let a session push to `main` any other way. The owner comes from the user, by AskUserQuestion: an organization or the personal account (with an `origin`, its owner first). The `ask` rule asks again before it runs. Run it with a timeout of 600000 ms and tell the user its last line; exit code 1 goes to the user with its message, with no retry. When it succeeds, run the checks again; when the user declines, stop.
2. `git push -u origin spec/NNN-name`.
3. Write the body, in Portuguese, to `.superpowers/implementar/NNN-name/pr-da-spec.md`: what to review (`spec.md`, `plan.md`, `tasks.md`, `prototipo/README.md` when it exists, `diagramas/`) and that the merge freezes the spec.
4. `gh pr create --base main --head spec/NNN-name --title "docs(spec): NNN-name" --body-file .superpowers/implementar/NNN-name/pr-da-spec.md`. When a PR for the branch already exists, take its number from `gh pr view spec/NNN-name --json number --jq .number`: the push already updated it.
5. Write `spec_pr: <number>` as a top-level key of `specs/NNN-name/progress.yml`, commit only that file and push again (`git push origin spec/NNN-name`, which works from any checkout). When `progress.yml` already has that `spec_pr`, skip this step: there is nothing to commit.
6. Tell the user the PR's address, and that `/implementar NNN` starts after the merge, done by them or by a colleague.

## Before you start (feature)

1. Find `specs/NNN-*/progress.yml` in the tree or, after `git fetch origin`, on `origin/main`. When neither has it, look on the local spec branches: `git branch --list 'spec/NNN-*'` and, for the only one, `git cat-file -p spec/NNN-name:specs/NNN-name/progress.yml` (the user said no to the spec PR at the end of `/speckit-tasks`, so the branch exists only on this machine). When `feat/NNN-name` exists, locally or on `origin`, its copy is the one with `execution`.
   - With `execution.code_pr`, the feature is already in its code PR: show that PR's state and stop.
   - Without `spec_pr`, the spec PR does not exist: ask whether to open it now ("Spec PR", from its step 0), and stop either way.
   - With `spec_pr`, `gh pr view <spec_pr> --json state --jq .state`: `MERGED` goes on; `OPEN` stops, because the PR waits for its review and merge; `CLOSED` stops, because it was closed without a merge. Without `gh` or without a login, say so and stop.
   - With `OPEN` or `MERGED`, when the local `spec/NNN-name` exists and `git rev-list --count origin/spec/NNN-name..spec/NNN-name` prints more than 0, the PR lacks those commits (a replanning the user did not push). With `OPEN`, say so and ask whether to push them now ("Spec PR"), before someone merges the old version, and stop either way. With `MERGED`, say that the merge froze the spec without them, and stop: the user decides whether they go in by "The spec during implementation" or as a new feature.
2. `git status --porcelain`: when it lists anything, show it and ask the user to commit or set aside the change; never discard anything, and go on only when `git status --porcelain` prints nothing. Then `git fetch origin`. The code branch never goes through the local `main`, which may be checked out in another worktree. When `feat/NNN-name` exists, locally or on `origin`, `git switch feat/NNN-name`, write `.specify/feature.json` (step 3) and resume from its `progress.yml`:
   - without `execution` yet, by step 4;
   - at the first `pending` phase, with `registro.md` and `git log` telling where that phase stopped. With nothing in the registro for it (the registro stays on the machine that wrote it), the phase starts over with a new Executor, and its starting commit is the last one that changed `progress.yml`: `git log -1 --format=%H -- specs/NNN-name/progress.yml`; when that phase is the Done gate, run it again by the section "Done gate", in this session, never with an Executor;
   - with no `pending` phase and `feature_review: pending`, at the step of "End of the feature" after the last one the registro records (step 1 without it);
   - with `feature_review: done`, ask about "Code PR".

   Otherwise, `git switch -c feat/NNN-name origin/main`.
3. Write `.specify/feature.json` as `{"feature_directory": "specs/NNN-name"}` on every path, the resumptions included: Spec Kit finds the feature by it, not by the branch, and git ignores it, so another machine or a new session may hold another feature's.
4. On a new branch, or one whose `progress.yml` has no `execution` yet, propose the phases from the `## Phase` headings of `tasks.md`: the Done gate phase on its own and first, when `tasks.md` has one (`name: "Done gate"`), then Setup and Foundational together, one phase per user story, then Polish; with a single story, one phase for everything after the Done gate. The user may split a story by a range of tasks, which goes in the phase's `name` (`US2 (T020-T024)`). Show the list with the tasks of each phase and ask "Seguir com estas fases?". Then write the `execution` block with every phase `pending` and commit only `progress.yml`.

## Done gate

The Done gate phase changes files of the done gate, which the Executor cannot edit: its tasks carry `[sessão]`, and this session runs it, before the first Executor.

1. Write the starting commit (`git rev-parse HEAD`) to `registro.md`.
2. Apply each `[sessão]` task with the Edit or Write tool, as `tasks.md` describes it. Each edit goes through the `ask` rule of `.claude/settings.json`, which asks the user even in auto mode: a refused edit stops the phase, so show it and ask the user. Mark each applied task `[X]` in `tasks.md`.
3. Run `just check`. When it fails, show the end of the output and ask the user.
4. Commit the changed files and `tasks.md` in Conventional Commits. Then the phase becomes `done` with its `commits`, and you commit only `progress.yml`.
5. Stop and show what changed (`git diff --stat <start>..<end>`) and the result of `just check`; there is no Revisor here, because the user confirmed each edit and the feature review reads the whole branch. Ask "Seguir para a próxima fase?".

## Each phase

The phases after the Done gate, or every phase when there is none:

1. Write the starting commit (`git rev-parse HEAD`) to `registro.md`. At the start of the phase, before the Executor, take the baseline of the done gate: `node .claude/hooks/vigia-criterio.mjs confere <start> --hash` (`<start>` is the phase's base, the starting commit), at the project root, exactly as written, with no redirection and no pipe, and write `fase-N-criterio-inicio.txt` with the Write tool: a first line `commit <start>`, a second line `exit <code>` with its exit code, then its output. Each output line is `<12 hex>  <path>`, `-  <path>` (deleted) or `!<ERROR>  <path>` (a folder or an unreadable file; the marker is at the start of the line). Never retake an existing `fase-N-criterio-inicio.txt`. When it is missing and `HEAD` is not `<start>`, the baseline is empty: every line of the end output stops and goes to the user. There is then no `commit <sha>` line: when the file is missing and `HEAD` is not `<start>`, undo from `<start>`. A `confere` that exits with a code other than 0 here stops before the Executor and goes to the user. Write the request to `fase-N-pedido.md` and send that text to the Executor: the path of `specs/NNN-name/tasks.md`, the phase (its `## Phase` titles and task IDs), the spec folder, the starting commit and the path of `fase-N-relatorio.md`. Write his ID to the registro.
2. On `STATE: QUESTION`, when the question is about the spec, first follow "The spec during implementation". Ask the user, and send the answer to the same Executor with SendMessage, by his ID. When he cannot be resumed, as in another session, call a new Executor with the same request, his report so far and the answer. On `STATE: BLOCKED`, show it and ask the user.
3. On `STATE: DONE`, after the Executor and before the Revisor, run the same `confere <start> --hash` again, at the project root, as written, and compare it with the baseline from the third line on. The end run is not written to a file: its exit code comes from the tool's result, and its output is compared with the baseline's output, from the third line on, in the same format. This comparison runs after every call of an Executor of the phase (the first one, each correction round of step 4 and any call the user asks for later), and again right before step 5 closes the phase, including after a failed `just check` or an ended `STATE: BLOCKED`: no path to `done` skips it. Stop and show the user, in Portuguese, when the output differs from the baseline (a new line, a line that is gone or another hash), when any line starts with the marker `!` (even equal to the baseline: the marker hides the content), or when `confere` exited with a code other than 0, at the start or at the end (an empty output of a failed run is never "no difference", and is never "nada mudou"). The user decides: keep it (with their yes; the accepted output then becomes the new baseline of the phase, rewrite `fase-N-criterio-inicio.txt` with the Write tool in the same format: a first line `commit <sha>` with the `git rev-parse HEAD` at that moment, a second line `exit <code>` of the accepted run, then the accepted output) or undo it. To undo a change already committed, make an Edit (it falls under the `ask` rule) or run `git checkout <baseline commit> -- <path>` and commit, where the baseline commit is the `commit <sha>` of the first line of the baseline file, the latest accepted one (restoring from `<start>` would also undo what the user accepted before); for a new file of the done gate, delete it, because the checkout fails. After undoing, run the comparison again. With no difference, go on. The list of differences goes into the Revisor's request. With no new commit since the package's base (the start, or the commit before a correction), the package would be empty: show his reply to the user instead of calling the Revisor. Otherwise write the package, `node .claude/scripts/pacote.mjs <start> HEAD .superpowers/implementar/<folder>/fase-N.diff`, and call the Revisor with its path, the spec folder, the phase, the Executor's report, the round (the phase review) and one line per finding of the earlier phases, from the registro. The Revisor has no edit tool: you write his reply to `fase-N-revisao.md`, and its findings to the registro.
4. A Minor finding with `[security]` anywhere in its text is treated as Important, whatever the verdict says: the verdict is `FIX` and the finding goes to the correction, not to `achados-menores.md`. On `VERDICT: PASS` with no `[security]` Minor, go to step 5. On `VERDICT: FIX` (a Critical or Important finding), first, for each finding with `[security]` anywhere in its text, write one line in the chat, in Portuguese, `achado de segurança na fase N: <resumo>; vai na correção`, and the same line in `registro.md`. Then write `git rev-parse HEAD` to the registro and send those findings to the same Executor for the correction; when he cannot be resumed, a new Executor gets the correction request ("fix only these findings; no `/speckit-implement`") with the findings, his report and the spec folder. Either way, with the path of `fase-N-relatorio-rR.md`. Then run the comparison of step 3 again (after the Executor's correction), and a new Revisor checks only the correction, in round `R`, against those findings: the package from that commit to `HEAD`, in `fase-N-rR.diff`. At most 2 rounds; what is left after the second goes to the user to decide. Any other Minor finding never blocks the phase: it goes to `achados-menores.md`.
5. Run the comparison of step 3 once more, then `just check`. When it passes, the phase becomes `done` with its `commits`, and you commit only `progress.yml`. When it fails, the phase is not done: show the end of the output and ask the user.
6. Stop and show, in Portuguese: what changed (`git diff --stat <start>..<end>`), the result of `just check`, the verdict, what was fixed, the Minor findings, the "Not judged" list (the user decides each item) and the rule the Revisor proposed for `CODING_STANDARDS.md`; with the user's yes, write it under `## Rules` and commit it. Ask "Seguir para a próxima fase?".

## End of the feature

After the last phase:

1. `git fetch origin`, then the package of the whole branch, from `git merge-base origin/main HEAD` to `HEAD`, in `feature.diff`. Call the Revisor with `model: fable`, the package, the spec folder (with `research.md`), `tasks.md`, `achados-menores.md`, the round (the feature review) and `specs/NNN-name/diagramas/arquitetura-depois.architecture.json` when it exists. Write his reply to `feature-revisao.md` and the JSON of his `## Architecture` to `.superpowers/implementar/NNN-name/arquitetura-final.architecture.json`; when the planned architecture exists, first run `node .claude/skills/archify/bin/archify.mjs validate architecture .superpowers/implementar/NNN-name/arquitetura-final.architecture.json --json --repo-root .`, because `compare` refuses a head that fails it; on a failure, repair the JSON as the archify skill says, within the repair limit, changing only the layout (every component, connection, label and card stays), and validate again; if `validate` fails again, go on to `compare`, and the failure goes into the summary, as a `compare` failure does. Then run `node .claude/skills/archify/bin/archify.mjs compare architecture specs/NNN-name/diagramas/arquitetura-depois.architecture.json .superpowers/implementar/NNN-name/arquitetura-final.architecture.json .superpowers/implementar/NNN-name/arquitetura-delta.html --json --repo-root .`; a failure goes into the summary and blocks nothing.
2. Without `origin/HEAD` (`git rev-parse --verify --quiet refs/remotes/origin/HEAD` prints nothing), run `git remote set-head origin -a`. Then run, in this session, `/code-review high feat/NNN-name`, then `just security`, then `/security-review` with the argument "check the branch against the patterns of docs/agents/seguranca.md it touches" and, in a separate paragraph, "Semgrep findings by rule ID and CWE, without the rules' text:" followed by the table `just security` printed. When `just security` fails (no network), say so in one line and run `/security-review` without the table.
3. Gather every finding in `feature-achados.md`: the Revisor's, those of both reviews and the Minor ones that still hold. With any finding, one correction round: a new Executor gets a correction request ("fix only these findings; no `/speckit-implement`") with that file, the spec folder, the starting commit and the path of `feature-relatorio.md`, and a new Revisor, in the model of his frontmatter, checks only the correction, from the commit before it, in `feature-r1.diff`. Around that correction, take the baseline of the done gate before the Executor (`confere <the commit before the correction> --hash`, at the project root, written with the Write tool to `feature-criterio-inicio.txt` in the format of "Work folder", with a first line `commit <the commit before the correction>`, a second line `exit <code>` and then the output; never retake an existing `feature-criterio-inicio.txt`, and when it is missing and `HEAD` is not the starting commit, the baseline is empty and every line of the end output stops) and run the same comparison as step 3 of "Each phase" after the Executor, before the Revisor of the correction and again before step 5. What is left goes to the user and to the PR's body.
4. Lessons: what the Revisor wrote under `## Lessons` and is not in the code, the tests or an ADR goes to `docs/licoes/NNN-name.md`, in Portuguese, up to 5 lessons, never more than two sentences per lesson (cut the rest), each with its origin. The folder is born with the first lesson. Commit it.
5. Run `just check`, set `feature_review: done` and commit only `progress.yml`. Stop and ask whether to push and open the code PR ("Code PR").

## Small change or bug fix

The four-part text: the `feat: <topic>` or `fix: <topic>` line, then the goal, the why, the constraints and the done. Below, `<topic>` is a short kebab-case slug of that line, and `<topic>` must match `^[a-z0-9-]{1,60}$`: lowercase letters, digits and `-`, never `/`, `.` or a space. The text comes from outside and the slug goes into a branch name and a folder path: when the line gives no slug that matches, refuse and ask the user for another topic, before any branch or folder exists.

1. Only with a `<topic>` that matches the rule above: step 2 of "Before you start" (a clean tree and `git fetch origin`), on the branch `git switch -c fix/<topic> origin/main` or `git switch -c feat/<topic> origin/main`; when it exists, `git switch` to it and resume from `registro.md` and `git log`. With nothing in the registro, the phase starts over with a new Executor, from `HEAD`, and its starting commit, the package's base, is `git merge-base origin/main HEAD`, so the Revisor sees every commit of the branch. The work folder is `feat-<topic>` or `fix-<topic>`, with the text in `pedido.md`.
2. One phase, by the steps of "Each phase" (the done-gate baseline and check included, with the base of step 1, and the rule is inherited): there is no spec folder, so the Executor gets the text in place of `tasks.md`, the phase and the spec folder, the Revisor reviews against it, at most 2 rounds, and `just check`. There is no `progress.yml`: skip its commit and the next-phase question.
3. No feature review: no Revisor on the whole branch, no `/code-review`, no `/security-review` and no lessons. Stop and ask about the code PR.

## Code PR

1. The checks of step 1 of "Spec PR".
2. `git push -u origin <code branch>`.
3. Write the body, in Portuguese, to `pr-de-codigo.md` in the work folder, with the `pr` skill (the summary, the evidence before and after, whether the change can be undone and its blast radius), never with the PR command of commit-commands. Add `Spec: #<spec_pr>` in a feature; `Closes #n` when the feature or the change started in the GitHub issue #n; and a `## Revisão` section from the registro: the table `| Fase | Rodadas | Achados graves | Achados menores | Corrigidos |`, one row per phase and one per review at the end (the Revisor, `/code-review`, `/security-review`), then each finding that was left, with why. Also a `## Critério de pronto` section: run `git merge-base origin/main HEAD`, then `node .claude/hooks/vigia-criterio.mjs confere <that sha> --hash`, at the project root. An exit code other than 0 stops and shows the output to the user, and is never "nada mudou". Otherwise the section says "nada mudou" only when the output is empty; with lines, it lists the paths only (one per line, a line with the marker `!` included).
4. The title in Conventional Commits: the title line of a small change, or `feat: <what it does>` for a feature. Before `gh pr create`, check it: `<title>` must match `` ^(?=.{1,100}$)(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([a-z0-9-]+\))?!?: [^"“”„‟`$\\\r\n]+$ `` (a Conventional Commits type, up to 100 characters, no `"`, curly double quote, backtick, `$`, `\` or line break, which the shell would read inside the quotes). When it does not match, refuse and ask the user for another title; never run the command with it. `gh pr create --base main --head <code branch> --title "<title>" --body-file .superpowers/implementar/<folder>/pr-de-codigo.md`; when a PR for the branch already exists, it keeps its number (`gh pr view <code branch> --json number --jq .number`).
5. In a feature, write `code_pr: <number>`, commit only `progress.yml` and push again.
6. Tell the user the PR's address. The merge is the user's.

## The spec during implementation

After the spec PR's merge the spec is frozen. An answer that only clarifies it, without changing the scope, you write to `specs/NNN-name/spec.md` on the code branch: a new row of its Open Questions table, with the state `resolved` and an answer starting with "durante a implementação:". With no code branch yet, create it first as "Before you start" does (clean tree, `git fetch origin`, `git switch -c feat/NNN-name origin/main` and `.specify/feature.json`) and write the row there: `/implementar NNN` later resumes that branch (it has no `execution` yet). Commit only that file: it goes in the code PR, in plain sight of the review. An answer that changes the scope becomes a new feature: ask whether the current one finishes without that part or stops; the new one starts in the brainstorming, with its own spec.
