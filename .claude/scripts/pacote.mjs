#!/usr/bin/env node
// Grava o pacote de revisão de uma fase do /implementar (desenho, seção 6.2): os commits, os arquivos e o diff
// (-U10) do intervalo <base>..<head> num arquivo .diff da pasta de trabalho, que a sessão passa ao Revisor pelo caminho.
// Existe para a sessão não pôr o diff no próprio contexto e para o /implementar rodar sem pedido de permissão (o
// settings.json libera este script; um `git diff > arquivo` pelo shell pediria). Como os argumentos não são confiáveis,
// tudo é conferido antes de qualquer git: <base> e <head> são SHA (7 a 40 hexadecimais) ou HEAD, nunca uma opção do git,
// e <saida> é um caminho relativo da forma .superpowers/implementar/<pasta>/<nome>.diff, sem : (no NTFS, ele abre um
// fluxo alternativo do arquivo). O git roda sempre por execFileSync com a lista de argumentos, nunca por shell. Uma
// recusa não grava nada.
// Uso, na raiz do projeto: node .claude/scripts/pacote.mjs <base> <head> <saida>
// ponytail: a conferência de <saida> olha o texto do caminho e o lstat do último nome; um link que já exista numa pasta
// do caminho é seguido (nenhum comando liberado cria link), como no png.mjs.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { estado, relativoNormal } from "./caminho.mjs";

function recusa(mensagem) {
  console.error(`pacote: ${mensagem}`);
  process.exit(1);
}

// Falha com a mensagem do git quando ele sai com erro. Sem shell; LC_ALL=C para o --shortstat sair em inglês.
function git(...args) {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", "-c", "color.ui=never", ...args], {
      encoding: "utf8",
      maxBuffer: 1 << 30,
      env: { ...process.env, LC_ALL: "C" },
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (erro) {
    throw new Error(String(erro.stderr || erro.message).trim());
  }
}

const argumentos = process.argv.slice(2);
if (argumentos.length !== 3) recusa("uso: node .claude/scripts/pacote.mjs <base> <head> <saida>");
const [base, head, saida] = argumentos;
for (const commit of [base, head]) {
  if (!/^(?:[0-9a-fA-F]{7,40}|HEAD)$/.test(commit)) recusa(`${commit}: use o SHA do commit (de 7 a 40 hexadecimais) ou HEAD`);
}
if (!relativoNormal(saida) || !/^\.superpowers\/implementar\/[^/:]+\/[^/:]+\.diff$/.test(saida)) {
  recusa(`${saida}: use um caminho relativo da forma .superpowers/implementar/<pasta>/<nome>.diff, sem :`);
}
const anterior = estado(saida);
if (anterior && !anterior.isFile()) recusa(`${saida}: já existe e não é um arquivo comum`);

let texto;
let commits;
let linhas;
try {
  for (const commit of [base, head]) {
    try {
      git("rev-parse", "--verify", "--quiet", `${commit}^{commit}`);
    } catch {
      recusa(`${commit}: não é um commit deste repositório`);
    }
  }
  try {
    git("merge-base", "--is-ancestor", base, head);
  } catch {
    recusa(`${base} não é ancestral de ${head}`);
  }
  commits = Number(git("rev-list", "--count", `${base}..${head}`));
  if (commits === 0) recusa(`${base}..${head}: intervalo vazio, sem commits`);
  const resumo = git("diff", "--shortstat", "--no-ext-diff", "--no-textconv", `${base}..${head}`);
  linhas = Number(/(\d+) insertion/.exec(resumo)?.[1] ?? 0) + Number(/(\d+) deletion/.exec(resumo)?.[1] ?? 0);
  texto = [
    `# Pacote de revisão: ${base}..${head}`,
    "",
    "## Commits",
    "",
    git("log", "--oneline", "--no-decorate", `${base}..${head}`).trimEnd(),
    "",
    "## Arquivos",
    "",
    git("diff", "--stat", "--no-ext-diff", "--no-textconv", `${base}..${head}`).trimEnd(),
    "",
    "## Diff",
    "",
    git("diff", "-U10", "--no-ext-diff", "--no-textconv", `${base}..${head}`),
  ].join("\n");
} catch (erro) {
  recusa(`o git não respondeu para ${base}..${head}: ${erro.message}`);
}
try {
  mkdirSync(dirname(saida), { recursive: true });
  writeFileSync(saida, texto, "utf8");
} catch (erro) {
  recusa(`não gravei ${saida}: ${erro.message}`);
}
console.log(`pacote: ${saida} (${commits} commits, ${linhas} linhas)`);
