#!/usr/bin/env node
// O PR do workflow semanal (.github/workflows/skills-update.yml, job `pr`): um PR só por semana, no branch
// chore/skills-update, que reflete a decisão da conferir-base.mjs. Em ordem:
// 1. com o branch no remoto, o último commit dele tem de ser do workflow (github-actions[bot]); um commit seu nunca é
//    apagado: com ele, o script avisa (também no resumo da execução), não faz push nem chama a API e sai com 0;
// 2. refaz o branch da HEAD (a main da execução) com o patch e, com aplicarBase, a cópia conferida do documento da
//    revisão; o commit é do github-actions[bot]; o push força o branch (só sobre o commit conferido no passo 1);
// 3. abre o PR, ou atualiza o aberto (título, descrição e rascunho), com o rótulo seguranca-suspeito junto do rascunho;
//    o repositório que não aceita rascunho ganha o PR normal com o aviso no topo e o rótulo;
// 4. aprova as execuções do pull_request do commit, que o push do GITHUB_TOKEN deixa paradas (o disparo manual não
//    conta para o PR); sem conseguir (o GITHUB_TOKEN pode não poder), avisa (também no resumo) e segue com 0.
// O script não roda nada do que veio de fora: do patch e da cópia só saem bytes para o `git apply` e o `git commit`, e
// nenhum hook roda (na CI não há `lefthook install`). O git e o gh rodam pelo gh.mjs, sem shell; o gh só pela API,
// sempre com `--method`. Cada passo imprime `skills-pr: …`, e a última linha é a URL do PR (também no
// $GITHUB_STEP_SUMMARY, quando ele existe). Falha: `skills-pr: <motivo>` no stderr e código 1.
// Uso, na raiz do projeto, com GITHUB_REPOSITORY (<dono>/<nome>) no ambiente:
//   node .claude/scripts/skills-pr.mjs <mudancas.patch> <pasta da decisão>
// Da pasta da decisão vêm o decisao.json, o corpo.md e, com aplicarBase, o revisao-de-ferramentas.md.
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { api as apiGh, aprovarCi, repositorioValido, rodar } from "./gh.mjs";

const BRANCH = "chore/skills-update";
const TITULO = "chore: atualiza as ferramentas de IA da comunidade";
const ROTULO = "seguranca-suspeito";
const BOT = ["github-actions[bot]", "41898282+github-actions[bot]@users.noreply.github.com"];
const DOC = "docs/agents/revisao-de-ferramentas.md";
const AVISO =
  "> Este repositório não aceita PR em rascunho: trate este PR como rascunho e não faça o merge antes de revisar.";

function recusa(mensagem) {
  console.error(`skills-pr: ${mensagem}`);
  process.exit(1);
}

function passo(mensagem) {
  console.log(`skills-pr: ${mensagem}`);
}

const resumo = (linha) => {
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${linha}\n`);
};

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
const git = seguro((...args) => rodar("git", args));
const api = seguro(apiGh);

function exigir(resposta, oque) {
  if (!resposta.ok) recusa(`${oque}: ${resposta.erro}`);
  return resposta;
}

// O git que tem de dar certo; devolve o stdout
function gitOk(oque, ...args) {
  const resposta = git(...args);
  if (resposta.codigo !== 0) recusa(`${oque}: ${resposta.stderr}`);
  return resposta.stdout.trim();
}

const lerArquivo = (caminho) => {
  try {
    return readFileSync(caminho);
  } catch {
    return recusa(`não li ${caminho}`);
  }
};

// As entradas
const argumentos = process.argv.slice(2);
if (argumentos.length !== 2) recusa("uso: node .claude/scripts/skills-pr.mjs <mudancas.patch> <pasta da decisão>");
const [patch, pasta] = argumentos;
const repositorio = process.env.GITHUB_REPOSITORY ?? "";
if (!repositorioValido(repositorio)) {
  recusa("GITHUB_REPOSITORY ausente ou inválido (o esperado é <dono>/<nome>)");
}
const dono = repositorio.split("/")[0];
const r = `repos/${repositorio}`;
let decisao;
try {
  decisao = JSON.parse(lerArquivo(join(pasta, "decisao.json")).toString("utf8"));
} catch {
  recusa(`o decisao.json de ${pasta} não é JSON`);
}
if (typeof decisao?.aplicarBase !== "boolean" || typeof decisao?.rascunho !== "boolean") {
  recusa(`o decisao.json de ${pasta} não tem aplicarBase e rascunho`);
}
const corpo = lerArquivo(join(pasta, "corpo.md")).toString("utf8");
const copia = decisao.aplicarBase ? lerArquivo(join(pasta, "revisao-de-ferramentas.md")) : null;

// 1. O branch no remoto: só o workflow mexe nele
const remoto = git("ls-remote", "--exit-code", "--heads", "origin", BRANCH);
let anterior = "";
if (remoto.codigo === 0) {
  gitOk(`não busquei o ${BRANCH}`, "fetch", "--quiet", "--depth", "1", "origin", BRANCH);
  anterior = gitOk("não li o FETCH_HEAD", "rev-parse", "FETCH_HEAD");
  const email = gitOk(`não li o último commit do ${BRANCH}`, "log", "-1", "--format=%ae", anterior);
  if (email !== BOT[1]) {
    const aviso =
      `o branch ${BRANCH} tem um commit que não é do workflow; faça o merge ou apague o branch para a próxima semana`;
    passo(aviso);
    resumo(`skills-pr: ${aviso}`);
    process.exit(0);
  }
} else if (remoto.codigo !== 2) recusa(`o git ls-remote falhou: ${remoto.stderr}`);

// 2. O branch refeito da HEAD, o commit do workflow e o push
gitOk(`não criei o ${BRANCH}`, "switch", "--quiet", "-C", BRANCH);
gitOk(`o patch ${patch} não aplica`, "apply", "--index", "--binary", patch);
if (copia) {
  // a cópia conferida pela conferir-base.mjs, byte a byte
  try {
    writeFileSync(DOC, copia);
  } catch (erro) {
    recusa(`não gravei o ${DOC}: ${erro.message}`);
  }
  gitOk(`não pus o ${DOC} no índice`, "add", "--", DOC);
  passo("a base nova do documento da revisão entra no commit");
}
gitOk("o commit falhou", "-c", `user.name=${BOT[0]}`, "-c", `user.email=${BOT[1]}`, "commit", "--quiet", "-m", TITULO);
const commit = gitOk("não li o commit novo", "rev-parse", "HEAD");
// força só sobre o commit conferido no passo 1 (sem branch, só se ele ainda não existir): um commit seu que chegue no
// meio tempo não é apagado
gitOk("o push falhou", "push", "--quiet", `--force-with-lease=${BRANCH}:${anterior}`, "origin", BRANCH);
passo(`branch ${BRANCH} publicado`);

// 3. O PR, o rascunho e o rótulo
const lista = exigir(api("GET", `${r}/pulls?head=${dono}:${BRANCH}&state=open`), "não li os PRs abertos");
// o número do PR vem da resposta da API e entra no caminho das escritas (PATCH, POST, DELETE): só um inteiro passa
function comNumero(p) {
  if (!(Number.isSafeInteger(p?.number) && p.number > 0)) recusa("resposta inesperada do GitHub: o PR não tem um número inteiro");
  return p;
}
let pr = Array.isArray(lista.corpo) && lista.corpo.length ? comNumero(lista.corpo[0]) : undefined;
const existia = Boolean(pr);
// o erro fala de rascunho (decisão 6): só nas mensagens, o message e o errors[].message do corpo (o 422 do REST traz
// "Validation Failed" no message e o texto no errors) e o stderr do gh, que as repete. O resto do corpo não conta: o
// `path` de todo erro do graphql cita a mutação convertPullRequestToDraft
const deRascunho = ({ corpo, erro }) => {
  const erros = Array.isArray(corpo?.errors) ? corpo.errors : [];
  const mensagens = [corpo?.message, ...erros.map((e) => (typeof e === "string" ? e : e?.message)), erro];
  return mensagens.some((m) => typeof m === "string" && /draft/i.test(m));
};
const atualizar = (body) =>
  exigir(api("PATCH", `${r}/pulls/${pr.number}`, { title: TITULO, body }), `não atualizei o PR #${pr.number}`);
if (!existia) {
  const pedido = { title: TITULO, head: BRANCH, base: "main", body: corpo, draft: decisao.rascunho };
  let criado = api("POST", `${r}/pulls`, pedido);
  if (!criado.ok && decisao.rascunho && criado.http === 422 && deRascunho(criado)) {
    passo("o repositório não aceita PR em rascunho: abro o PR normal, com o aviso e o rótulo");
    criado = api("POST", `${r}/pulls`, { ...pedido, body: `${AVISO}\n\n${corpo}`, draft: false });
  }
  pr = comNumero(exigir(criado, "não abri o PR").corpo);
  passo(`PR #${pr.number} aberto${pr.draft ? " em rascunho" : ""}`);
} else {
  atualizar(corpo);
  passo(`PR #${pr.number} atualizado`);
}
// o rótulo antes do rascunho: o PR nunca fica sem ele, nem quando o graphql falha
if (decisao.rascunho) {
  exigir(api("POST", `${r}/issues/${pr.number}/labels`, { labels: [ROTULO] }), `não pus o rótulo ${ROTULO}`);
  passo(`rótulo ${ROTULO}: posto`);
} else {
  const tirado = api("DELETE", `${r}/issues/${pr.number}/labels/${ROTULO}`);
  if (!tirado.ok && tirado.http !== 404) recusa(`não tirei o rótulo ${ROTULO}: ${tirado.erro}`);
  passo(`rótulo ${ROTULO}: fora`);
}
if (existia && pr.draft !== decisao.rascunho) {
  const mutacao = decisao.rascunho ? "convertPullRequestToDraft" : "markPullRequestReadyForReview";
  const query = `mutation($id: ID!) { ${mutacao}(input: {pullRequestId: $id}) { pullRequest { isDraft } } }`;
  const grafo = api("POST", "graphql", { query, variables: { id: pr.node_id } });
  // o gh de verdade sai com 1 num errors do graphql; o corpo com errors também é falha
  if (!grafo.ok || grafo.corpo?.errors) {
    if (!decisao.rascunho || !deRascunho(grafo)) {
      recusa(`não mudei o rascunho do PR #${pr.number}: ${grafo.erro || JSON.stringify(grafo.corpo?.errors)}`);
    }
    // o repositório não aceita rascunho: o PR normal, com o aviso no topo e o rótulo
    atualizar(`${AVISO}\n\n${corpo}`);
    const aviso =
      `aviso: o repositório não aceita PR em rascunho; o PR #${pr.number} segue normal, com o aviso no topo e o ` +
      `rótulo ${ROTULO}`;
    passo(aviso);
    resumo(`skills-pr: ${aviso}`);
  } else passo(`PR #${pr.number}: ${decisao.rascunho ? "em rascunho" : "pronto para revisão"}`);
}

// 4. A CI do PR: o push do GITHUB_TOKEN cria as execuções do pull_request paradas, à espera de aprovação, e só elas
// contam para o PR (o disparo manual roda no mesmo commit, mas o GitHub não o liga ao PR, e a proteção da main segura o
// merge). O aprovarCi do gh.mjs as busca e aprova só as nossas. Sem aprovar, só o aviso
const { achadas, aprovadas } = seguro(aprovarCi)(repositorio, BRANCH, commit);
if (achadas && aprovadas === achadas) {
  passo(`CI do PR aprovada (${aprovadas} execuções)`);
} else {
  const aviso = 'não consegui aprovar a CI do PR; aprove em "Approve workflows to run"';
  passo(aviso);
  resumo(`skills-pr: ${aviso}`);
}
resumo(`PR da semana: ${pr.html_url}`);
console.log(pr.html_url);
