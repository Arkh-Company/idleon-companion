# idleon-companion Constitution

## Core Principles

### Product scope

- Mission: Mostrar ao jogador de Legends of Idleon, ao vivo e ao lado do jogo, onde ele está, como os sistemas calculam seus números e quanto ele ganha enquanto joga, sem nenhum risco de banimento.
- Non-goals: Nunca chamar função do jogo em execução nem gravar no save (uma cópia offline do código do jogo instalado, em processo isolado e sem rede, é permitida); nunca acessar a rede (Firebase, HTTP), com uma única exceção: o app (nunca o guardião, o leitor ou o jogo) pode procurar e baixar versões do próprio companion no repositório público de releases, por HTTPS e com o hash publicado conferido; nunca automatizar cliques no jogo; nunca distribuir arquivos do jogo.
- A feature outside the mission, or inside a non-goal, needs an amendment to this constitution first.

### Done gate

- TDD: the failing test is written before the code that makes it pass.
- `just check` passes before a task is called done.
- Tests use no real network and no real credentials.

### Simplicity

- Nothing speculative: no code, option or abstraction for a need nobody has today.
- A repeated error becomes a lint rule, and ast-grep joins when ESLint cannot express it.

### Architecture

- A plan that creates a boundary between modules, an external integration or a fixed rule includes a task to update `ARCHITECTURE.md`.
- The first boundary becomes a rule in dependency-cruiser, and an `arch` recipe that checks it joins `just check`.
- Plans follow `ARCHITECTURE.md` and the ADRs in `docs/adr/`.

### Code

- Work in vertical slices: each slice cuts through every layer it needs and works on its own.
- A module's public API is what its entry file (`index.ts`) re-exports; other code never imports from deeper paths.
- Names are unique and easy to find with a text search.
- New identifiers in the code (variables, functions, files and environment variables) are in English. The checks that find a secret written in the code look for English names, such as `password`, `secret` and `token`.
- Each file fits in a single read (up to 400 lines); split it before it grows past that.
- Logs are structured, and every entry carries a label (what happened) and an ID (which request or record).
- Money is never a float.

### Security

- No secret in the code or in the client: keys and passwords live only in environment variables or a vault.
- Every input from outside is validated at the server edge; client-side validation is only a convenience.
- Every credential, role and service gets the least privilege it needs, and CORS lists only the declared origins.
- Databases are reached only through parameterized queries.
- Full lists: `docs/agents/seguranca.md`.

### Dependencies

- Before adopting a dependency, check its issues for regressions and configuration problems, its license and its activity.

### Specs

- A spec is frozen once its PR is merged, together with its prototype.
- During implementation, an answer that only clarifies the spec, without changing the scope, goes into `spec.md` on the code branch as a `resolved` row of Open Questions, marked "durante a implementação"; an answer that changes the scope becomes a new feature.
- The current truth lives in the code, `ARCHITECTURE.md`, `GLOSSARY.md` and the ADRs.

## Governance

- This is the constitution that `/speckit-plan` checks, and every plan reads it whole.
- Full lists live in `docs/agents/`; this file keeps only short principles that can be verified.
- Amend it with `/speckit-constitution`, on a branch, through a PR.

**Version**: 1.3.0 | **Ratified**: 2026 | **Last Amended**: 2026-11-12
