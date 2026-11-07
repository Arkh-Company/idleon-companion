<!--
MANUTENÇÃO (comentário HTML: removido antes de ir ao contexto, 0 token)
- Fonte das regras que valem para qualquer IA; o CLAUDE.md importa este arquivo na primeira linha e só traz o que é do Claude Code.
- Uma regra mora em um arquivo só (o teste do kit confere). Não prometa aqui hook, skill ou subagente:
  isso só vale no Claude Code e fica na seção "Who enforces these rules".
- Uma linha só entra se a IA erraria sem ela. O que precisa acontecer SEMPRE vira hook, permissão ou regra do GitHub.
- Alvo: menos de 200 linhas. Procedimento vai para .claude/skills/.
- Formato do Prettier (o fmt-check do JS/TS olha este arquivo): listas com "-", sem tabela.
- Revise em todo PR que mexe neste arquivo, a cada trimestre e depois de cada troca de modelo.
-->

# idleon-companion

Desktop companion for Legends of Idleon (Steam): shows live, read-only, where you are and what is open in the game.

Mission: Mostrar ao jogador de Legends of Idleon, ao vivo e ao lado do jogo, onde ele está e como os sistemas calculam seus números, sem nenhum risco de banimento.

The project constitution is in [.specify/memory/constitution.md](.specify/memory/constitution.md).

## Commands

- All recipes: `just --list`
- Setup (locked dependencies, and `.env` from `.env.example` when missing): `just setup`
- Code index for symbol and dependency lookups: `just index`
- New worktree (missing `node_modules/` or `.codegraph/`): run `just setup` and `just index` before anything else
- Test one file or case: `just test-one src/main.test.ts`
- Fast tests: `just test`
- `just test` and `just test-one` take only `-t <name>`, and the target never starts with `-` or `@`; for any other option, run `pnpm exec vitest run` directly (not pre-approved: the user confirms it)
- Format: `just fmt`
- Secret scan (gitleaks, the same check as the commit hook and CI): `just secrets`
- Security scan, warnings only (semgrep OWASP rules, needs the network): `just security`
- GitHub repository (private repository, settings, first push of `main`, ruleset; asks the user first): `just github <owner>`
- Weekly `skills-update` workflow: opens a PR with the community AI tools updated and reviewed; the merge is the user's. Never run `gh secret set` or `claude setup-token`, and never ask for the Claude token: the user records `CLAUDE_CODE_OAUTH_TOKEN` in their own terminal.
- Done gate (format check + lint + typecheck + secret scan + tests): `just check`

## Done

- `just check` passes (the CI runs the same check). End with the command you ran and its result.

## Workflow

- New feature: plan it in `specs/NNN-name/` (spec, plan and tasks) before any code, and merge the spec PR before the first line of code. A small change or a bug fix goes on a `fix/<topic>` or `feat/<topic>` branch, with a PR.
- Keep the diff to what the task asks. Edit files surgically instead of rewriting them, and list unrelated bugs or cleanups as follow-ups instead of fixing them.
- Tests follow TDD: write the failing test first, sized like the neighboring ones. Never delete or weaken an existing test to get a green run.
- When the user describes a problem or thinks out loud, answer with a diagnosis or options; change code when the user asks for the change.
- Ask before adding a dependency, and say why the standard library or an existing dependency is not enough.
- Before changing a boundary between modules, read `ARCHITECTURE.md` and `docs/adr/` when they exist.
- Before investigating a failure, look in `docs/runbooks/` when it exists.

## Rules

- Never commit on `main`: planning on `spec/NNN-name`, code on `feat/NNN-name`, `feat/<topic>` or `fix/<topic>`, each with its PR; anything else, such as the done gate files or this file, also on its own branch with a PR.
- Commits and PR titles follow Conventional Commits; never `--no-verify`. Ask before every push and every PR; the merge is always the user's.
- Don't change the done gate without asking: `justfile`, `lefthook.yml`, the lint, type, format and test configurations, `.github/`, `.claude/`, `AGENTS.md` and `CLAUDE.md`.
- Never read or write secrets. Don't open `.env` files; read `.env.example` and tell the user which variable is missing.
- Don't edit lockfiles or generated files; change the manifest or the source and rerun the tool.
- Every command you give the user to run starts with `cd '<project folder>' && ` in the same block, with the full path in single quotes (a quote inside the path doubled) and `&&`, never `;`: when the `cd` fails, `&&` skips the command, and `;` would run it in the wrong folder. When the path has `[`, `]`, `*` or `?`, use `cd -LiteralPath '<project folder>' && `, because PowerShell's `cd` reads them as wildcards. Single quotes are enough in bash too, and PowerShell 7 understands `&&`. This holds even when the command would work from any folder.

## Security and vocabulary

- Read `docs/agents/seguranca.md` before any task with login, sessions, personal data, an API, secrets, payments, uploads or calls to external services.
- Use the vocabulary in `GLOSSARY.md` when it exists.

## Who enforces these rules

In Claude Code, this project's hooks, permissions and skills (in `.claude/`) enforce part of these rules. Other AI tools do not load them yet. For any AI tool, the barriers are GitHub (the ruleset on `main`, when the account allows it: a PR with the `check` job green and, in team mode, the approval of a `CODEOWNERS` owner) and lefthook (`just setup` installs it: gitleaks and the commit message check on every commit). Everything else in this file is guidance.
