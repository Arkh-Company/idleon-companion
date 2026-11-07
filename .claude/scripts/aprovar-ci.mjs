#!/usr/bin/env node
// A CI parada de um PR que o GITHUB_TOKEN abriu ou atualizou (o GitHub deixa as execuções do pull_request à espera de
// aprovação). Quem chama: o .github/workflows/release.yml, depois que a release-please cria ou atualiza o PR de versão.
// Lê o PR pela API e recusa o que não é deste repositório (um PR de fork), antes de qualquer busca; o aprovarCi do
// gh.mjs aprova só as execuções do SHA da ponta do PR, do branch dele e deste repositório. O script não roda nada do
// PR: o branch e o SHA que vêm da API são dados, e o gh roda pelo gh.mjs, sem shell, só pela API.
// Sem conseguir aprovar, avisa (também no $GITHUB_STEP_SUMMARY, quando ele existe) e sai com 0. Falha:
// `aprovar-ci: <motivo>` no stderr e código 1.
// Uso, com GITHUB_REPOSITORY (<dono>/<nome>) e GH_TOKEN no ambiente:
//   node .claude/scripts/aprovar-ci.mjs <número do PR>
import { appendFileSync } from "node:fs";
import { api, aprovarCi, repositorioValido } from "./gh.mjs";

function recusa(mensagem) {
  console.error(`aprovar-ci: ${mensagem}`);
  process.exit(1);
}

// O rodar do gh.mjs lança quando o programa nem roda; aqui, isso vira a recusa
const seguro =
  (funcao) =>
  (...args) => {
    try {
      return funcao(...args);
    } catch (erro) {
      return recusa(erro.message);
    }
  };

const argumentos = process.argv.slice(2);
if (argumentos.length !== 1 || !/^[1-9][0-9]*$/.test(argumentos[0])) {
  recusa("uso: node .claude/scripts/aprovar-ci.mjs <número do PR>");
}
const numero = argumentos[0];
const repositorio = process.env.GITHUB_REPOSITORY ?? "";
if (!repositorioValido(repositorio)) {
  recusa("GITHUB_REPOSITORY ausente ou inválido (o esperado é <dono>/<nome>)");
}

const lido = seguro(api)("GET", `repos/${repositorio}/pulls/${numero}`);
if (!lido.ok) recusa(`não li o PR #${numero}: ${lido.erro}`);
const head = lido.corpo?.head;
if (head?.repo?.full_name !== repositorio) recusa(`o PR #${numero} não vem de ${repositorio}: não aprovo a CI dele`);
if (typeof head.ref !== "string" || !head.ref || !/^[0-9a-f]{40}$/.test(head.sha ?? "")) {
  recusa(`o PR #${numero} veio sem o branch ou o SHA`);
}

const { achadas, aprovadas } = seguro(aprovarCi)(repositorio, head.ref, head.sha);
if (achadas && aprovadas === achadas) {
  console.log(`aprovar-ci: CI do PR #${numero} aprovada (${aprovadas} execuções)`);
} else {
  const aviso = `aprovar-ci: não consegui aprovar a CI do PR #${numero}; aprove em "Approve workflows to run"`;
  console.log(aviso);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${aviso}\n`);
}
