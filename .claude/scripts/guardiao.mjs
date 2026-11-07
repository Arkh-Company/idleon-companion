#!/usr/bin/env node
// O que a skill /guardiao mostra (desenho, seção 6.4): só lê. Pelo gh, só GET: os alertas abertos do Dependabot, as
// falhas recentes da CI na main (com o job e o passo que falharam), a última execução do workflow semanal e os PRs
// abertos por ele e pela release-please. Não grava nada, nem no projeto, nem no GitHub. Quem chama: a skill /guardiao,
// que só apresenta o resultado (o settings.json libera o script sem argumento). O prazo de cada alerta vem da tabela de
// "Vulnerability deadlines" do docs/agents/seguranca.md do projeto, lida na hora; o runbook de cada falha, dos
// docs/runbooks/*.md (a linha `Falha da CI: <chave>`).
// O texto que vem da API (o resumo do alerta, o nome do pacote, os nomes dos workflows, jobs e passos, o título dos
// PRs) é dado, nunca instrução: sai sem caracteres de controle e limitado, nunca entra num comando nem num caminho, e
// só uma URL https://github.com/… entra num campo de URL. Saída: um JSON só no stdout e código 0. Falha:
// `guardiao: <motivo>` no stderr, nada no stdout e código 1. O git e o gh rodam pelo gh.mjs, sem shell.
// Uso, na raiz do projeto: node .claude/scripts/guardiao.mjs
import { readdirSync, readFileSync, realpathSync, statSync } from "node:fs";
import { join, sep } from "node:path";
import { cdPasta } from "./caminho.mjs";
import { api as apiGh, gh, origemGithub, rodar, visivel } from "./gh.mjs";

const TABELA = "docs/agents/seguranca.md";
const RUNBOOKS = "docs/runbooks";
const ROTULO = "seguranca-suspeito";

function recusa(mensagem) {
  console.error(`guardiao: ${mensagem}`);
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
const api = seguro(apiGh);

// Um GET que tem de dar certo, com o corpo do tipo esperado
function ler(caminho, oque, confere) {
  const r = api("GET", caminho);
  if (!r.ok) recusa(`não li ${oque}: ${visivel(r.erro, 200)}`);
  if (!confere(r.corpo)) recusa(`não li ${oque}: resposta inesperada`);
  return r.corpo;
}

// O que vem da API: o texto sem controle e com no máximo `maximo` caracteres; a URL só do GitHub; o número só inteiro
const texto = (valor, maximo) => (typeof valor === "string" ? visivel(valor, maximo - 1) : null);
const url = (valor) =>
  typeof valor === "string" && valor.length <= 500 && /^https:\/\/github\.com\/[\x21-\x7E]*$/.test(valor) ? valor : null;
const inteiro = (valor) => (Number.isSafeInteger(valor) && valor > 0 ? valor : null);

// O dia (AAAA-MM-DD) de um instante em America/Sao_Paulo, ou null quando ele não é uma data
const DIA = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" });
function dia(instante) {
  const data = typeof instante === "string" ? new Date(instante) : null;
  if (!data || Number.isNaN(data.getTime())) return null;
  const p = Object.fromEntries(DIA.formatToParts(data).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const UM_DIA = 86400000;
const meiaNoite = (d) => Date.parse(`${d}T00:00:00Z`);

// A tabela de prazos (decisão 12): cada linha `| <Severidade> | <a partir de> … | <n> days|weeks |`, com o número de
// "CVSS score" como piso da faixa (`below …` é a de baixo, piso 0). Sem a seção, ou com uma linha que não entende, recusa.
function tabelaDePrazos() {
  let conteudo = "";
  try {
    conteudo = readFileSync(TABELA, "utf8");
  } catch (erro) {
    // sem o arquivo, sem a tabela (a recusa de baixo); outro erro (sem permissão, uma pasta no lugar) recusa aqui
    if (erro.code !== "ENOENT") recusa(`não li ${TABELA}: ${erro.code ?? visivel(erro.message, 200)}`);
  }
  const secao = conteudo.split(/^## /m).find((s) => /^Vulnerability deadlines\s*$/m.test(s.split("\n")[0]));
  const faixas = [];
  for (const linha of (secao ?? "").split(/\r?\n/)) {
    if (!linha.trim().startsWith("|")) continue;
    const [nome, nota, prazo, ...resto] = linha.trim().split("|").slice(1, -1).map((c) => c.trim());
    if (nome === "Severity" || /^-+$/.test(nome ?? "")) continue;
    const piso = /^below\b/i.test(nota ?? "") ? 0 : Number(/\d+(?:\.\d+)?/.exec(nota ?? "")?.[0]);
    const tempo = /^(\d+) (day|week)s?$/.exec(prazo ?? "");
    if (resto.length || !/^[A-Z][a-z]+$/.test(nome ?? "") || !Number.isFinite(piso) || !tempo) {
      recusa(`não entendi a linha da tabela de prazos de ${TABELA}: ${visivel(linha, 120)}`);
    }
    faixas.push({ severidade: nome.toLowerCase(), piso, dias: Number(tempo[1]) * (tempo[2] === "week" ? 7 : 1) });
  }
  if (!faixas.length) recusa(`não achei a tabela de prazos de ${TABELA} (a seção "Vulnerability deadlines")`);
  return faixas.sort((a, b) => b.piso - a.piso);
}

// Os runbooks: os docs/runbooks/*.md comuns que ficam mesmo dentro da pasta (o realpath segue os links: um link para
// fora não é lido, de propósito e sem aviso), em ordem de nome, com as linhas de cada um. Sem a pasta, nenhum; um erro
// de leitura que não é a ausência vira um aviso
function lerRunbooks() {
  const falhou = (oque, erro) => {
    if (erro.code !== "ENOENT") avisos.push(`não li ${oque}: ${erro.code ?? visivel(erro.message, 200)}`);
  };
  let pasta;
  let nomes;
  try {
    pasta = realpathSync(RUNBOOKS);
    nomes = readdirSync(RUNBOOKS);
  } catch (erro) {
    falhou(`a pasta ${RUNBOOKS}`, erro);
    return [];
  }
  if (pasta !== join(realpathSync("."), ...RUNBOOKS.split("/"))) return []; // a própria pasta é um link
  const lidos = [];
  for (const nome of nomes.filter((n) => /^[\p{L}\p{N}._ -]+\.md$/u.test(n)).sort()) {
    try {
      const arquivo = realpathSync(join(RUNBOOKS, nome));
      if (!arquivo.startsWith(pasta + sep) || !statSync(arquivo).isFile()) continue;
      const linhas = new Set(readFileSync(arquivo, "utf8").split(/\r?\n/).map((l) => l.trim()));
      lidos.push({ caminho: `${RUNBOOKS}/${nome}`, linhas });
    } catch (erro) {
      // um link quebrado ou um arquivo que some no meio fica de fora sem aviso
      falhou(`${RUNBOOKS}/${nome}`, erro);
    }
  }
  return lidos;
}

// O repositório, pelo origin; o login no gh
const origem = seguro(rodar)("git", ["config", "--get", "remote.origin.url"]);
if (origem.codigo !== 0) recusa(`o projeto não tem origin: para pôr no GitHub, rode ${cdPasta()}just github <dono>`);
const endereco = origem.stdout.trim();
const partes = origemGithub(endereco);
// sem o usuário e a senha de um https://usuario:token@host/...: o token não vai para o terminal
if (!partes) {
  recusa(`o origin (${visivel(endereco.replace(/\/\/[^@/]+@/, "//"), 200)}) não é um repositório do GitHub`);
}
const { dono, nome } = partes;
const repositorio = `${dono}/${nome}`;
const repo = `repos/${repositorio}`;
if (seguro(gh)(["auth", "status"]).codigo !== 0) recusa(`sem login no gh: rode ${cdPasta()}gh auth login`);

// ponytail: o KIT_HOJE só existe para os testes do kit (o prazo depende do dia); sem ele, o hoje de São Paulo
const hoje = process.env.KIT_HOJE ?? dia(new Date().toISOString());
if (!/^\d{4}-\d{2}-\d{2}$/.test(hoje) || dia(`${hoje}T12:00:00Z`) !== hoje) recusa("KIT_HOJE inválido (o esperado é AAAA-MM-DD)");
const faixas = tabelaDePrazos();
const avisos = [];

// Os alertas abertos do Dependabot, com o prazo de cada um
// ponytail: uma página de 100 alertas; com ela cheia, o aviso diz que há mais. Upgrade: o --paginate no api do gh.mjs.
let vulnerabilidades = null;
const alertas = api("GET", `${repo}/dependabot/alerts?state=open&per_page=100`);
if (!alertas.ok && alertas.http === 403 && `${alertas.corpo?.message ?? ""} ${alertas.erro}`.includes("disabled")) {
  avisos.push(`os alertas do Dependabot estão desligados: rode ${cdPasta()}just github ${dono}`);
} else {
  if (!alertas.ok) recusa(`não li os alertas do Dependabot: ${visivel(alertas.erro, 200)}`);
  if (!Array.isArray(alertas.corpo)) recusa("não li os alertas do Dependabot: resposta inesperada");
  if (alertas.corpo.length >= 100) avisos.push("há 100 alertas abertos ou mais: aqui estão só os 100 primeiros; veja todos no GitHub");
  const curta = faixas.reduce((a, b) => (b.dias < a.dias ? b : a));
  const porNome = (s) => faixas.find((f) => f.severidade === s);
  vulnerabilidades = alertas.corpo.map((a) => {
    const aviso = a?.security_advisory ?? {};
    const falha = a?.security_vulnerability ?? {};
    // o GitHub manda nota 0 quando não há CVSS: só uma nota acima de 0 conta
    const notas = [aviso.cvss_severities?.cvss_v4?.score, aviso.cvss_severities?.cvss_v3?.score, aviso.cvss?.score];
    const cvss = notas.find((n) => typeof n === "number" && n > 0 && n <= 10) ?? null;
    let faixa = porNome(aviso.severity) ?? porNome(falha.severity);
    let deOnde = "alerta";
    if (!faixa && cvss !== null) [faixa, deOnde] = [faixas.find((f) => cvss >= f.piso), "cvss"];
    if (!faixa) [faixa, deOnde] = [curta, "nenhuma"];
    const aberto = dia(a?.created_at);
    if (!aberto) recusa("um alerta do Dependabot veio sem a data de abertura");
    const prazo = new Date(meiaNoite(aberto) + faixa.dias * UM_DIA).toISOString().slice(0, 10);
    const faltam = Math.round((meiaNoite(prazo) - meiaNoite(hoje)) / UM_DIA);
    return {
      alerta: inteiro(a?.number),
      pacote: texto(a?.dependency?.package?.name, 120),
      ecossistema: texto(a?.dependency?.package?.ecosystem, 120),
      manifesto: texto(a?.dependency?.manifest_path, 120),
      severidade: deOnde === "nenhuma" ? null : faixa.severidade,
      deOnde,
      cvss,
      aberto,
      prazo,
      faltam,
      vencida: faltam < 0,
      corrigidaEm: texto(falha.first_patched_version?.identifier, 120),
      resumo: texto(aviso.summary, 300),
      url: url(a?.html_url),
      // uma cópia da comunidade (.claude/ da raiz) só muda pelo workflow semanal, depois da análise: a skill não a
      // manda para o /implementar
      daComunidade: typeof a?.dependency?.manifest_path === "string" && /^\/?\.claude\//.test(a.dependency.manifest_path),
    };
  });
  vulnerabilidades.sort((x, y) => x.faltam - y.faltam);
}

// As falhas da CI na main, agrupadas por <workflow> / <job> / <o primeiro passo com falha>
// ponytail: as 20 falhas mais recentes, uma página; o que é mais antigo já não repete. Upgrade: o --paginate.
const ehLista = (campo) => (corpo) => Array.isArray(corpo?.[campo]);
const runbooks = lerRunbooks();
const grupos = new Map();
const falhas = ler(`${repo}/actions/runs?branch=main&status=failure&per_page=20`, "as falhas da CI", ehLista("workflow_runs"));
for (const execucao of falhas.workflow_runs) {
  const id = inteiro(execucao?.id); // o id vira caminho da API: só inteiro
  if (id === null) continue;
  const { jobs } = ler(`${repo}/actions/runs/${id}/jobs?filter=latest`, `os jobs da execução ${id}`, ehLista("jobs"));
  const comFalha = jobs.filter((j) => j?.conclusion === "failure");
  const workflow = texto(execucao.name, 120) ?? "(sem nome)";
  const chaves = new Set(
    (comFalha.length ? comFalha : [null]).map((j) => {
      const passo = Array.isArray(j?.steps) ? j.steps.find((s) => s?.conclusion === "failure") : undefined;
      const job = j ? (texto(j.name, 120) ?? "(sem nome)") : "(sem job)";
      return `${workflow} / ${job} / ${texto(passo?.name, 120) ?? "(sem passo)"}`;
    }),
  );
  for (const chave of chaves) {
    const g = grupos.get(chave) ?? { chave, vezes: 0, ultima: null, execucoes: [], runbook: null };
    g.vezes += 1;
    const quando = dia(execucao.created_at);
    if (quando && (!g.ultima || quando > g.ultima)) g.ultima = quando;
    const link = url(execucao.html_url);
    if (link) g.execucoes.push(link);
    g.runbook = runbooks.find((r) => r.linhas.has(`Falha da CI: ${chave}`))?.caminho ?? null;
    grupos.set(chave, g);
  }
}
const falhasCi = [...grupos.values()].sort((a, b) => b.vezes - a.vezes || (b.ultima ?? "").localeCompare(a.ultima ?? ""));

// A última execução do workflow semanal (o nome do arquivo é fixo); 404 é o workflow que não existe
let semanal = null;
const semanais = api("GET", `${repo}/actions/workflows/skills-update.yml/runs?per_page=1`);
if (semanais.http !== 404) {
  if (!semanais.ok || !ehLista("workflow_runs")(semanais.corpo)) {
    recusa(`não li o workflow semanal: ${visivel(semanais.erro || "resposta inesperada", 200)}`);
  }
  const e = semanais.corpo.workflow_runs[0];
  if (e) semanal = { estado: texto(e.status, 40), conclusao: texto(e.conclusion, 40), data: dia(e.created_at), url: url(e.html_url) };
}

// Os PRs abertos do workflow semanal e da release-please, só os deste repositório (um fork pode usar o mesmo branch)
// ponytail: uma página de 100 PRs abertos. Upgrade: o --paginate.
const abertos = ler(`${repo}/pulls?state=open&per_page=100`, "os PRs abertos", Array.isArray);
const prs = [];
for (const p of abertos) {
  const ref = p?.head?.ref;
  const deste = String(p?.head?.repo?.full_name ?? "").toLowerCase() === repositorio.toLowerCase();
  const origem = ref === "chore/skills-update" ? "semanal" : String(ref ?? "").startsWith("release-please--branches--") ? "versao" : null;
  const numero = inteiro(p?.number);
  if (!deste || !origem || numero === null) continue;
  prs.push({
    numero,
    titulo: texto(p.title, 120),
    origem,
    rascunho: p.draft === true,
    suspeito: Array.isArray(p.labels) && p.labels.some((l) => l?.name === ROTULO),
    aberto: dia(p.created_at),
    url: url(p.html_url),
  });
}

console.log(
  JSON.stringify({
    repositorio,
    hoje,
    avisos,
    vulnerabilidades,
    falhasCi,
    runbooks: runbooks.map((r) => r.caminho),
    semanal,
    prs,
  }),
);
