## Kit rules: before the command

Do these first, before the hooks and the setup below. `FEATURE_DIR` is the folder named by `feature_directory` in `.specify/feature.json`.

1. Refuse to start, and say why, when `FEATURE_DIR/spec.md` has a row with the state `open` in its Open Questions table, or any `[NEEDS CLARIFICATION]`, or when any item in `FEATURE_DIR/checklists/*.md` is unmarked (`- [ ]`). Quote what blocks, send the user back to `/speckit-clarify`, and run nothing else.
2. If `FEATURE_DIR/prototipo/README.md` exists, read it. The plan creates `research.md` from scratch, so do not write that file now: when Phase 0 writes `research.md`, put the decisions and the numbers of the prototype in it.
3. Read `docs/licoes/`, `ARCHITECTURE.md` and `docs/adr/` when they exist, and keep the plan consistent with them.
4. When Phase 0 writes `research.md`, also answer in it each question that the Open Questions table marks `to plan`, one Decision / Rationale / Alternatives entry each. When the row has an Answer, that answer is the Decision: the user already decided it in the clarify, so add the Rationale and the Alternatives and do not decide it again.

{CORE_TEMPLATE}

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
