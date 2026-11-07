#!/usr/bin/env node
// Receita `just diagramas` (desenho, seção 5.6): refaz o HTML local dos diagramas do archify a partir dos JSON. Para cada
// specs/*/diagramas/<nome>.<tipo>.json, o `render` do archify grava diagramas/local/<nome>.html (a arquitetura com
// --repo-root ., que confere no git o código que ela cita); com a arquitetura de antes e a de depois, o `compare` grava
// local/arquitetura-delta.html. Só o HTML, que o git ignora: o SVG e o PNG saem no fim do /speckit-plan.
// Roda na raiz do projeto, sem argumentos.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { cdPasta } from "./caminho.mjs";

const ARCHIFY = ".claude/skills/archify/bin/archify.mjs";
const NOME = /^(.+)\.(architecture|workflow|sequence|dataflow|lifecycle)\.json$/;

// Os argumentos de cada chamada do archify, com / nos caminhos em qualquer sistema
const chamadas = [];
for (const feature of existsSync("specs") ? readdirSync("specs").sort() : []) {
  const pasta = `specs/${feature}/diagramas`;
  if (!existsSync(pasta)) continue;
  for (const arquivo of readdirSync(pasta).sort()) {
    const [, nome, tipo] = NOME.exec(arquivo) ?? [];
    if (!nome) continue;
    const raiz = tipo === "architecture" ? ["--repo-root", "."] : [];
    chamadas.push(["render", tipo, `${pasta}/${arquivo}`, `${pasta}/local/${nome}.html`, ...raiz]);
  }
  // O compare renderiza de novo o antes: com código citado e sem --repo-root, o archify o recusa
  const [antes, depois] = ["antes", "depois"].map((lado) => `${pasta}/arquitetura-${lado}.architecture.json`);
  if (existsSync(antes) && existsSync(depois)) {
    chamadas.push(["compare", "architecture", antes, depois, `${pasta}/local/arquitetura-delta.html`, "--json",
      "--repo-root", "."]);
  }
}

// Nada a fazer não é erro: o /kit-base roda toda receita num projeto novo, ainda sem specs e sem archify
if (!chamadas.length) {
  console.log("diagramas: nenhum JSON de diagrama em specs/*/diagramas/");
  process.exit(0);
}
if (!existsSync(ARCHIFY)) {
  console.error(`diagramas: o archify não está em ${ARCHIFY}; ele vem no repositório: rode ${cdPasta()}git restore --source=HEAD -- .claude/skills/archify; se não estiver no git, o workflow semanal o traz por PR, depois da análise de segurança: ${cdPasta()}gh workflow run skills-update.yml`);
  process.exit(1);
}
for (const args of chamadas) {
  const html = args.find((arg) => arg.endsWith(".html"));
  const r = spawnSync(process.execPath, [ARCHIFY, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  if (r.status === 0) {
    console.log(html);
  } else {
    console.error(`diagramas: o archify falhou em ${html}\n${(r.stderr || r.stdout || r.error?.message || "").trim()}`);
    process.exitCode = 1;
  }
}
