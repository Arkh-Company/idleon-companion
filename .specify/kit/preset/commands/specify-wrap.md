## Kit rules: before the command

- The feature description usually comes from the brainstorming, and the design agreed there is the description: use it in full. Do not shorten it, and do not ask the user to type it again.
- Every short name you pick for this feature, for the branch and for the folder, is ASCII, without accents: `autenticacao-usuarios`, not `autenticação-usuários`. The branch script drops accented letters (`autenticação` becomes `autentica-o`).
- This command creates a new feature: the folder `specs/NNN-name/` and the branch `spec/NNN-name`. So never run this command to update an existing spec: edit that spec's `spec.md` instead.

{CORE_TEMPLATE}

## Kit rules: after the command

These steps belong to this command. Do them in order, before you report completion.

1. Write `progress.yml` in the folder of the new feature (`specs/NNN-name/`), in the format of this example. `feature` is the folder name. Write only these two phases: the later commands add theirs. Every phase has a `status` (`in_progress`, `done` or `skipped`) and a `date` (today, as `YYYY-MM-DD`). `brainstorm` is `done` when the description came from the brainstorming, and `skipped` when it did not.

```yaml
feature: 001-login
phases:
  brainstorm: {status: done, date: 2026-10-03}
  specify: {status: done, date: 2026-10-03}
```

2. Call `/speckit-git-commit` as the `after_specify` hook. The hooks above ran before this section and did not see `progress.yml`, so this call is the one that commits it.
3. Go on to `/speckit-clarify` without asking the user.
