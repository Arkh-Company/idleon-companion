## Kit rules: after the command

These steps belong to this command. Do them in order, before you report completion.

1. The rules at the end of the tasks template (`TASKS_TEMPLATE_CONTENT`) apply to the `tasks.md` you generated, and they override the "Tests are OPTIONAL" wording above. Check every phase against them and fix `tasks.md` before you go on: tests first and mandatory, an Independent Test and a `Verify:` line in every phase, the files, signatures and test cases of every task, and the Review Focus section.
2. Write `phases.tasks` in `FEATURE_DIR/progress.yml`: `status: done` and today's date (`YYYY-MM-DD`). Create the file if it is missing, and leave the other phases as they are.
3. Call `/speckit-git-commit` as the `after_tasks` hook. The hooks above ran before this section and did not see `progress.yml`, so this call is the one that commits it.
4. Ask the user "Fazer o push do branch e abrir o PR da spec?".
   - Yes: read the section `## Spec PR` of `.claude/skills/implementar/SKILL.md` with the Read tool and do what it says. When a spec PR is already open for the branch (a replan after the brainstorming), the push updates it.
   - No: tell the user that `/implementar NNN` offers the spec PR again.
