@AGENTS.md

<!--
MANUTENÇÃO (comentário HTML: removido antes de ir ao contexto, 0 token)
- A regra que vale para qualquer IA mora no AGENTS.md (importado acima); aqui só o que é do Claude Code.
  Uma regra mora em um arquivo só (tests/test_instrucoes.py confere).
- Revise em todo PR que mexe neste arquivo, a cada trimestre e depois de cada troca de modelo.
- Uma linha só entra se o Claude erraria sem ela. O que precisa acontecer SEMPRE vira hook ou permissão.
- Alvo: menos de 200 linhas. Procedimento vai para .claude/skills/.
- Formato do Prettier (o fmt-check do JS/TS olha este arquivo): listas com "-", sem tabela.
- Seções que entram quando houver conteúdo real (não crie vazias):
  "## Map" (fronteiras não óbvias e código gerado), "## Conventions that differ from defaults",
  "## Gotchas" (sintoma -> causa -> o que fazer) e "## More context" (ponteiros para docs/ e specs/).
- Auditoria: /doctor e /doctor prompt-audit. Sem CAPS, sem "think carefully", sem "double-check".
-->

## Claude Code

- A Stop hook runs `just check` when you finish; fix what it reports before you end.
- Tests in this repo's suite are an explicit request: the TDD rule above is that request, so write the failing test first, even when a skill such as ponytail says to skip tests.
- Every question to me goes through AskUserQuestion, in every step of the flow, with each question's context in the chat before it: what it decides, what each option changes and your recommendation.
- In every long task, write one line per step in the chat. What runs in the background (a subagent, a test suite) is followed with the Monitor tool on its log (for `/implementar`, the feature's `registro.md`): relay each event in one line, and start the monitor again when it times out. Every monitor filter releases line by line (`grep --line-buffered`, `awk` with `fflush()`, never `cut` and never `head`), a file that can be rewritten whole is followed by name (`tail -F`) or with a reader that counts lines, and when nothing arrives after a step that should have produced a line, the monitor is broken: redo it.
- In a project with no folder in `specs/`, a request to start or begin the project opens the brainstorming of the first feature; it never starts `just dev`.
- New feature: describe it, and the brainstorming skill opens the loop: `/speckit-specify`, then `/speckit-clarify` rounds until no question is open (no asking between rounds), `/prototipo` first when the how is uncertain, then `/speckit-plan` and `/speckit-tasks`, which ends with the spec PR; ask before moving between those steps. After the spec PR is merged, `/implementar NNN` runs the phases. A small change or a bug fix becomes a four-part text that `/implementar` runs instead. `/andamento` shows where each feature stands.
- The main session plans and coordinates: product code and tests are written by the Executor and reviewed by the Revisor, the subagents that `/implementar` calls, except the `[sessão]` tasks of the Done gate, which `/implementar` applies in this session. In the main session, code only as a disposable prototype in `specs/NNN-name/prototipo/`, through `/prototipo`; a hook blocks other edits.
- The skills create the branches: `/speckit-specify` makes `spec/NNN-name`, and `/implementar` makes `feat/NNN-name`, `feat/<topic>` and `fix/<topic>`.
- In a new worktree's session, pass that worktree's root as `projectPath` to the CodeGraph tools.

## Navigation

- Trust the language server: use it for definitions, references and types instead of grep.
- For symbols, callers and dependencies across modules, use the CodeGraph tools before grep.

## Agent skills

### Domain docs

Single context: one `GLOSSARY.md` and the ADRs in `docs/adr/`. See `docs/agents/domain.md`.

Issues, when the team uses them, live on GitHub and are read with `gh`.

## When compacting

Keep: files changed so far, the exact verification commands with their latest result, decisions and constraints I stated (in my words), anything still open and, during `/implementar`, the feature, its current phase and the path of its `registro.md`.
