#!/usr/bin/env node
// Confere se a mensagem de commit segue o Conventional Commits: olha a primeira linha que não é vazia nem começa por `#`
// (sem o \r). Passam também as mensagens que o git escreve sozinho: Merge, Revert "…", fixup!, squash! e amend!.
// Uso: node .claude/scripts/convencional.mjs <arquivo|->  (`-` lê o stdin). Quem chama: o commit-msg do lefthook, com o
// arquivo da mensagem, e o job `titulo` da CI, com o título do PR no stdin. Sai com 0 quando passa e com 1 quando não.
import { readFileSync } from "node:fs";

const PADRAO =
  /^(?:(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(?:\([\w.-]+\))?!?: \S.*|Merge .+|Revert ".+|(?:fixup|squash|amend)! .+)$/;

function recusa(mensagem) {
  console.error(`convencional: ${mensagem}`);
  process.exit(1);
}

const alvo = process.argv[2];
if (!alvo) recusa("uso: node .claude/scripts/convencional.mjs <arquivo|->");
let texto;
try {
  texto = readFileSync(alvo === "-" ? 0 : alvo, "utf8");
} catch (erro) {
  recusa(`não li ${alvo}: ${erro.message}`);
}
const linha = texto.split("\n").map((l) => l.replace(/\r$/, "")).find((l) => l !== "" && !l.startsWith("#"));
if (linha === undefined) recusa("a mensagem está vazia");
if (!PADRAO.test(linha)) {
  recusa(
    `"${linha}" não segue o Conventional Commits: <tipo>(<escopo>)!: <descrição>, com o tipo em feat, fix, docs, style, refactor, perf, test, build, ci, chore ou revert`,
  );
}
