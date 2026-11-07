---
name: speckit-plan
description: Execute the implementation planning workflow using the plan template
  to generate design artifacts.
argument-hint: "Optional guidance for the planning phase"
compatibility: Requires spec-kit project structure with .specify/ directory
metadata:
  author: github-spec-kit
  source: preset:kit-base
user-invocable: true
disable-model-invocation: false
---

# Speckit Plan Skill

## Kit rules: before the command

Do these first, before the hooks and the setup below. `FEATURE_DIR` is the folder named by `feature_directory` in `.specify/feature.json`.

1. Refuse to start, and say why, when `FEATURE_DIR/spec.md` has a row with the state `open` in its Open Questions table, or any `[NEEDS CLARIFICATION]`, or when any item in `FEATURE_DIR/checklists/*.md` is unmarked (`- [ ]`). Quote what blocks, send the user back to `/speckit-clarify`, and run nothing else.
2. If `FEATURE_DIR/prototipo/README.md` exists, read it. The plan creates `research.md` from scratch, so do not write that file now: when Phase 0 writes `research.md`, put the decisions and the numbers of the prototype in it.
3. Read `docs/licoes/`, `ARCHITECTURE.md` and `docs/adr/` when they exist, and keep the plan consistent with them.
4. When Phase 0 writes `research.md`, also answer in it each question that the Open Questions table marks `to plan`, one Decision / Rationale / Alternatives entry each. When the row has an Answer, that answer is the Decision: the user already decided it in the clarify, so add the Rationale and the Alternatives and do not decide it again.


## User Input

```text
$ARGUMENTS
```

You **MUST** consider the user input before proceeding (if not empty).

## Pre-Execution Checks

**Check for extension hooks (before planning)**:
- Check if `.specify/extensions.yml` exists in the project root.
- If it exists, read it and look for entries under the `hooks.before_plan` key
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue normally
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `/speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Pre-Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```
  - **Mandatory hook** (`optional: false`):
    ```
    ## Extension Hooks

    **Automatic Pre-Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}

    Wait for the result of the hook command before proceeding to the Outline.
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
- If no hooks are registered or `.specify/extensions.yml` does not exist, skip silently

## Outline

1. **Setup**: Run `.specify/scripts/bash/setup-plan.sh --json` from repo root and parse JSON for FEATURE_SPEC, IMPL_PLAN, FEATURE_DIR, BRANCH. For single quotes in args like "I'm Groot", use escape syntax: e.g 'I'\''m Groot' (or double-quote if possible: "I'm Groot").

2. **Load context**: Read FEATURE_SPEC and `.specify/memory/constitution.md`. Load IMPL_PLAN template (already copied).

3. **Execute plan workflow**: Follow the structure in IMPL_PLAN template to:
   - Fill Technical Context (mark unknowns as "NEEDS CLARIFICATION")
   - Fill Constitution Check section from constitution
   - Evaluate gates (ERROR if violations unjustified)
   - Phase 0: Generate research.md (resolve all NEEDS CLARIFICATION)
   - Phase 1: Generate data-model.md, contracts/, quickstart.md
   - Re-evaluate Constitution Check post-design

## Mandatory Post-Execution Hooks

**You MUST complete this section before reporting completion to the user.**

Check if `.specify/extensions.yml` exists in the project root.
- If it does not exist, or no hooks are registered under `hooks.after_plan`, skip to the Completion Report.
- If it exists, read it and look for entries under the `hooks.after_plan` key.
- If the YAML cannot be parsed or is invalid, do not skip silently: tell the user that `.specify/extensions.yml` could not be read (include the parser error) and that no hooks were checked, including any mandatory (`optional: false`) hooks registered there, then continue to the Completion Report.
- Filter out hooks where `enabled` is explicitly `false`. Treat hooks without an `enabled` field as enabled by default.
- For each remaining hook, do **not** attempt to interpret or evaluate hook `condition` expressions:
  - If the hook has no `condition` field, or it is null/empty, treat the hook as executable
  - If the hook defines a non-empty `condition`, skip the hook and leave condition evaluation to the HookExecutor implementation
- When constructing command invocations from hook command names, replace dots (`.`) with hyphens (`-`). For example, `speckit.git.commit` → `/speckit-git-commit`.
- For each executable hook, output the following based on its `optional` flag:
  - **Mandatory hook** (`optional: false`) — **You MUST emit `EXECUTE_COMMAND:` for each mandatory hook**:
    ```
    ## Extension Hooks

    **Automatic Hook**: {extension}
    Executing: `/{command}`
    EXECUTE_COMMAND: {command}
    ```
    After emitting the block above you MUST actually invoke the hook and wait for it to finish before continuing. Run it the same way you would run the command yourself in this agent/session (the invocation may differ from the literal `{command}` id shown above, e.g. a skills-mode agent runs it as `/skill:speckit-...` or `$speckit-...`). Emitting the block alone does not run the hook.
  - **Optional hook** (`optional: true`):
    ```
    ## Extension Hooks

    **Optional Hook**: {extension}
    Command: `/{command}`
    Description: {description}

    Prompt: {prompt}
    To execute: `/{command}`
    ```

## Completion Report

Command ends after Phase 1 design. Report branch, IMPL_PLAN path, and generated artifacts.

## Phases

### Phase 0: Outline & Research

1. **Extract unknowns from Technical Context** above:
   - For each NEEDS CLARIFICATION → research task
   - For each dependency → best practices task
   - For each integration → patterns task

2. **Generate and dispatch research agents**:

   ```text
   For each unknown in Technical Context:
     Task: "Research {unknown} for {feature context}"
   For each technology choice:
     Task: "Find best practices for {tech} in {domain}"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all NEEDS CLARIFICATION resolved

### Phase 1: Design & Contracts

**Prerequisites:** `research.md` complete

1. **Extract entities from feature spec** → `data-model.md`:
   - Entity name, fields, relationships
   - Validation rules from requirements
   - State transitions if applicable

2. **Define interface contracts** (if project has external interfaces) → `/contracts/`:
   - Identify what interfaces the project exposes to users or other systems
   - Document the contract format appropriate for the project type
   - Examples: public APIs for libraries, command schemas for CLI tools, endpoints for web services, grammars for parsers, UI contracts for applications
   - Skip if project is purely internal (build scripts, one-off tools, etc.)

3. **Create quickstart validation guide** → `quickstart.md`:
   - Document runnable validation scenarios that prove the feature works end-to-end
   - Include prerequisites, setup commands, test/run commands, and expected outcomes
   - Use links or references to contracts and data model details instead of duplicating them
   - Do not include full implementation code, model/service/controller bodies, migrations, or complete test suites
   - Keep this artifact as a validation/run guide; implementation details belong in `tasks.md` and the implementation phase

**Output**: data-model.md, /contracts/*, quickstart.md

## Key rules

- Use absolute paths for filesystem operations; use project-relative paths for references in documentation
- ERROR on gate failures or unresolved clarifications

## Done When

- [ ] Plan workflow executed and design artifacts generated
- [ ] Extension hooks dispatched or skipped according to the rules in Mandatory Post-Execution Hooks above
- [ ] Completion reported to user with branch, plan path, and generated artifacts


## Kit rules: after the command

These steps belong to this command. Do them in order, before you report completion.

1. A decision that is hard to reverse, surprising without context and the result of a real trade-off becomes an ADR in `docs/adr/`, in the format of the `domain-modeling` skill: `NNNN-slug.md`, numbered after the highest existing one, with a title and one to three sentences. Create `docs/adr/` only when the first ADR is needed, and write none when no decision qualifies.
2. Draw the diagrams with the archify skill, each as a JSON file in `FEATURE_DIR/diagramas/`:
   - `arquitetura-antes.architecture.json`: the architecture before this feature, read from the code. Skip it while the code is still only the kit's skeleton.
   - `arquitetura-depois.architecture.json`: the architecture after it, from this plan.
   - `sequencia.sequence.json`: the sequence of the main flow.
   - `ciclo-de-vida.lifecycle.json`: the lifecycle, only when the feature has states.

   Only the before architecture cites source files (`meta.repository` and `sources`). Archify checks them in git and needs an `origin` remote: without one, draw it without them.
3. Deliver each diagram as HTML in `FEATURE_DIR/diagramas/local/`, which git ignores:
   `node .claude/skills/archify/bin/archify.mjs finalize <type> FEATURE_DIR/diagramas/<name>.<type>.json FEATURE_DIR/diagramas/local/<name>.html --quality showcase --json`, adding `--repo-root .` for each architecture. Exit code 2 with the browser check `skipped` means this machine has no Chrome: accept it, skip step 4 and write "conferência no navegador: pulada (sem Chrome)" in your report. On any other failure, repair the JSON as the archify skill says.
   When both architectures exist, also run `node .claude/skills/archify/bin/archify.mjs compare architecture FEATURE_DIR/diagramas/arquitetura-antes.architecture.json FEATURE_DIR/diagramas/arquitetura-depois.architecture.json FEATURE_DIR/diagramas/local/arquitetura-delta.html --json --repo-root .`. The delta stays HTML only: `visual-check` refuses it (no delivery receipt), and its viewer has no light SVG export.
4. Both kit scripts below (`png.mjs` and `svg.mjs`) take only paths relative to the project root, with `/`: write `FEATURE_DIR` as `.specify/feature.json` gives it (`specs/NNN-name`), never the absolute path that `setup-plan.sh` prints. For each diagram delivered in step 3, first its PNG, then its SVG:
   - `node .claude/skills/archify/bin/archify.mjs visual-check FEATURE_DIR/diagramas/local/<name>.html --summary --require-provenance --out-dir FEATURE_DIR/diagramas/local/<name>-capturas`, then publish the light capture with `node .claude/scripts/png.mjs FEATURE_DIR/diagramas/local/<name>-capturas/<name>.visual-check.1440x900.light.png FEATURE_DIR/diagramas/<name>.png`. When `visual-check` fails although Chrome is present, say so in your report, skip this diagram's PNG (its SVG stays the image) and carry on;
   - `node .claude/scripts/svg.mjs FEATURE_DIR/diagramas/local/<name>.html FEATURE_DIR/diagramas/<name>.svg`. When it prints `SVG: pulado (sem Chrome)`, it wrote nothing.
5. End `FEATURE_DIR/plan.md` with a `## Diagramas` section: one image per diagram, linked relative to the plan (`![Sequência](diagramas/sequencia.svg)`), the SVG or, when the SVG did not come out, the PNG. Without Chrome there are no images: write "Sem imagens: o Chrome não estava disponível." Close the section with the line "HTML interativo: `just diagramas`, depois abra `diagramas/local/`".
6. Write `phases.plan` in `FEATURE_DIR/progress.yml`: `status: done` and today's date (`YYYY-MM-DD`). Create the file if it is missing, and leave the other phases as they are. When the feature has no `prototipo/` folder and `phases.prototype` does not exist yet, also set `phases.prototype` to `skipped`, with today's date.
7. Call `/speckit-git-commit` as the `after_plan` hook. The hooks above ran before this section and did not see `progress.yml`, so this call is the one that commits it.
