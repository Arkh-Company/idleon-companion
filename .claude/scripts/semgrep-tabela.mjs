#!/usr/bin/env node
// Resume o JSON do `semgrep scan --json` numa tabela Markdown: uma linha por achado, na ordem do semgrep, com o ID da
// regra, a CWE e o lugar, sem a mensagem da regra (o /security-review recebe os achados assim, e não o texto das regras).
// Uso: semgrep scan ... --json | node .claude/scripts/semgrep-tabela.mjs. Quem chama: a receita security do justfile e
// o job `semgrep` da CI. Sai com 0 com ou sem achados e com 1 quando a entrada não é o JSON do semgrep ou quando ele
// traz um erro de nível "error" (o semgrep não rodou).
import { readFileSync } from "node:fs";

function recusa(mensagem) {
  console.error(`semgrep-tabela: ${mensagem}`);
  process.exit(1);
}

let dados;
try {
  dados = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // a recusa logo abaixo cobre a entrada vazia e o texto que não é JSON
}
if (!Array.isArray(dados?.results)) recusa("a entrada não é o JSON do semgrep");
// Sem rede ou com a configuração inválida, o semgrep devolve `results: []` e um erro de nível "error": não houve análise.
const fatal = dados.errors?.find((e) => e?.level === "error");
if (fatal) recusa(`o semgrep falhou: ${fatal.type ?? "sem tipo"}`);

const linhas = [`Semgrep (p/owasp-top-ten): ${dados.results.length} achados`];
if (dados.results.length) linhas.push("| Regra | CWE | Onde |", "|---|---|---|");
for (const achado of dados.results) {
  const cwe = [achado.extra?.metadata?.cwe ?? []].flat().map((c) => /^CWE-\d+/.exec(c)?.[0]).filter(Boolean);
  linhas.push(`| ${achado.check_id} | ${cwe.join(", ") || "–"} | ${achado.path}:${achado.start?.line} |`);
}
const erros = dados.errors?.length ?? 0;
if (erros) linhas.push(`${erros} erros do semgrep (arquivos que ele não leu)`);
console.log(linhas.join("\n"));
