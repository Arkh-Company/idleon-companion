# Domain docs

How the agent uses the project's domain documentation when it explores the code. The project has a single context: one `GLOSSARY.md` at the root, and the decisions in `docs/adr/`.

## Before exploring, read these

- `GLOSSARY.md` at the root: the terms of the project.
- `docs/adr/`: the ADRs that touch the area you are about to work in.

If either one does not exist, go on without a word: do not mention the absence and do not suggest creating it. The `domain-modeling` skill creates `GLOSSARY.md` at the first term the project defines, and `docs/adr/` at the first decision that is hard to reverse.

## File structure

```text
/
├── GLOSSARY.md
├── docs/adr/
│   ├── 0001-short-title.md
│   └── 0002-another-title.md
└── src/
```

## Use the glossary's vocabulary

When your output names a domain concept (an issue title, a test name, a refactor proposal), use the term as `GLOSSARY.md` defines it; in a code identifier, use its English translation, as the constitution asks. Do not drift to the synonyms it lists as terms to avoid.

A concept missing from the glossary means one of two things: you are using a word the project does not use (pick another), or the glossary has a gap (tell `domain-modeling`).

## Flag ADR conflicts

If your output contradicts an ADR, say so explicitly instead of overriding it quietly:

> Contradicts ADR-0004 (SQLite for storage), but worth reopening because the data no longer fits one file.
