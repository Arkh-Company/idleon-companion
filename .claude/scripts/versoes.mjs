#!/usr/bin/env node
// Ajudante do workflow semanal (.github/workflows/skills-update.yml): sobe no mise.toml as versões do Spec Kit
// (pipx:specify-cli, no PyPI) e do CodeGraph (npm:@colbymchenry/codegraph, no npm) para a mais nova de cada uma. Só o
// workflow o roda, na raiz do projeto, sem argumentos (a receita `just skills-update` não o chama).
// Só aceita versão X.Y.Z, e só sobe: uma versão igual ou maior no mise.toml fica como está. Troca só o valor entre
// aspas da linha (o comentário e o resto do arquivo ficam byte a byte iguais) e grava uma vez só, depois das duas
// respostas. Falha (código 1, `versoes: <ferramenta>: <motivo>` no stderr) sem mexer no arquivo: sem rede, com resposta
// ruim, com versão que não é X.Y.Z ou sem a linha da ferramenta. KIT_VERSOES_PYPI e KIT_VERSOES_NPM trocam as bases
// https://pypi.org/pypi/ e https://registry.npmjs.org/ (com a barra no fim; os testes do kit usam um servidor local).
import { readFileSync, writeFileSync } from "node:fs";

const PYPI = process.env.KIT_VERSOES_PYPI || "https://pypi.org/pypi/";
const NPM = process.env.KIT_VERSOES_NPM || "https://registry.npmjs.org/";

// toml: a chave do mise.toml; nome: o das mensagens; versao: tira a versão do JSON da resposta
const TABELA = [
  { toml: "pipx:specify-cli", nome: "specify-cli", url: `${PYPI}specify-cli/json`, versao: (json) => json.info?.version },
  { toml: "npm:@colbymchenry/codegraph", nome: "codegraph", url: `${NPM}@colbymchenry%2Fcodegraph/latest`, versao: (json) => json.version },
];

const X_Y_Z = /^\d+\.\d+\.\d+$/;
// a é maior que b, número a número: 1.10.0 vem depois de 1.9.9
const maior = (a, b) => {
  const [x, y] = [a, b].map((versao) => versao.split(".").map(Number));
  const i = x.findIndex((n, j) => n !== y[j]);
  return i >= 0 && x[i] > y[i];
};

async function maisNova(ferramenta) {
  let resposta;
  try {
    resposta = await fetch(ferramenta.url, { signal: AbortSignal.timeout(30_000) });
  } catch (erro) {
    throw new Error(`sem resposta de ${ferramenta.url} (${erro.cause?.code ?? erro.message})`);
  }
  if (!resposta.ok) throw new Error(`${ferramenta.url} respondeu ${resposta.status}`);
  let versao;
  try {
    versao = ferramenta.versao(await resposta.json());
  } catch {
    throw new Error(`a resposta de ${ferramenta.url} não é JSON`);
  }
  if (typeof versao !== "string" || !X_Y_Z.test(versao)) throw new Error(`versão que não é X.Y.Z: ${JSON.stringify(versao)}`);
  return versao;
}

const escapar = (texto) => texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

let mise = readFileSync("mise.toml", "utf8");
const linhas = [];
const falhas = [];
for (const ferramenta of TABELA) {
  try {
    const linha = new RegExp(`^("${escapar(ferramenta.toml)}"\\s*=\\s*")([^"]+)(")`, "m");
    const atual = linha.exec(mise)?.[2];
    if (atual === undefined) throw new Error(`sem a linha "${ferramenta.toml}" no mise.toml`);
    if (!X_Y_Z.test(atual)) throw new Error(`a versão do mise.toml não é X.Y.Z: ${atual}`);
    const nova = await maisNova(ferramenta);
    if (!maior(nova, atual)) {
      linhas.push(`versoes: ${ferramenta.nome} ${atual} (já é a mais nova)`);
      continue;
    }
    mise = mise.replace(linha, (_, antes, __, depois) => antes + nova + depois);
    linhas.push(`versoes: ${ferramenta.nome} ${atual} -> ${nova}`);
  } catch (erro) {
    falhas.push(`versoes: ${ferramenta.nome}: ${erro.message}`);
  }
}

if (falhas.length) {
  console.error(falhas.join("\n"));
  process.exit(1);
}
writeFileSync("mise.toml", mise, "utf8");
console.log(linhas.join("\n"));
