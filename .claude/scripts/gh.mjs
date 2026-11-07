// O git e o gh dos scripts do kit, sempre por execFileSync com a lista de argumentos, nunca por shell. Quem importa: o
// github.mjs (a receita `just github`), o skills-pr.mjs (o job `pr` do workflow semanal), o aprovar-ci.mjs (o
// release.yml), o guardiao.mjs (a skill /guardiao) e o zelador.mjs (a skill /zelador, só o git e o just). Testado
// contra um gh falso (tests/fixtures/gh_falso.mjs do kit), pelo KIT_GH_SCRIPT.
import { execFileSync } from "node:child_process";

// O único lugar que decide se um dono ou um nome de repositório pode entrar num caminho da API (`repos/<dono>/<nome>`):
// começa por letra ou número e só tem letras, números, ".", "_" e "-". Nunca ".", "..", nem começa por ponto (a API
// resolveria `repos/<o>/..` para outro caminho), nem "%", "/", espaço, "?", "#" ou controle. Quem monta caminho com um
// dono ou nome vindo do origin, de um argumento ou do ambiente passa por aqui antes.
export const nomeDoGithubValido = (texto) => typeof texto === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(texto);

// O {dono, nome} de um `<dono>/<nome>` (o GITHUB_REPOSITORY do Actions), ou null quando uma das partes não passa
export function repositorioValido(texto) {
  const partes = typeof texto === "string" ? texto.split("/") : [];
  return partes.length === 2 && partes.every(nomeDoGithubValido) ? { dono: partes[0], nome: partes[1] } : null;
}

// O dono e o nome de um origin do GitHub (https, git@ ou ssh://), ou null quando ele não é do GitHub ou quando o dono
// ou o nome não passam no nomeDoGithubValido
export function origemGithub(url) {
  const partes =
    /^(?:https:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?$/.exec(
      url,
    );
  if (!partes || !nomeDoGithubValido(partes[1]) || !nomeDoGithubValido(partes[2])) return null;
  return { dono: partes[1], nome: partes[2] };
}

// O texto que vem de fora (um dono do CODEOWNERS, a mensagem de erro do GitHub, o resumo de um alerta, o nome de um
// job) sai sem caracteres de controle nem de formatação (escapes do terminal, a inversão de direção), com todo espaço
// como espaço comum, e truncado
export function visivel(texto, maximo = 80) {
  const limpo = String(texto).replace(/\p{C}/gu, "").replace(/\p{Z}/gu, " ");
  return limpo.length > maximo ? `${limpo.slice(0, maximo)}…` : limpo;
}

// Roda sem shell e devolve o código, o stdout e o stderr; lança um Error (`não rodei <programa>: …`) só quando o
// programa nem chega a rodar, e quem chama o troca pela própria recusa.
export function rodar(programa, args, entrada) {
  try {
    const stdout = execFileSync(programa, args, {
      encoding: "utf8",
      maxBuffer: 1 << 26,
      input: entrada,
      stdio: [entrada === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    });
    return { codigo: 0, stdout, stderr: "" };
  } catch (erro) {
    if (typeof erro.status !== "number") throw new Error(`não rodei ${programa}: ${erro.message}`);
    return { codigo: erro.status, stdout: String(erro.stdout ?? ""), stderr: String(erro.stderr ?? "").trim() };
  }
}

// ponytail: o KIT_GH_SCRIPT só existe para os testes do kit (o gh falso é um script Node, e no Windows o Node não roda
// um gh.cmd sem shell); sem ele, o gh do PATH.
export const gh = (args, entrada) =>
  process.env.KIT_GH_SCRIPT
    ? rodar(process.execPath, [process.env.KIT_GH_SCRIPT, ...args], entrada)
    : rodar("gh", args, entrada);

// Uma chamada da API; o gh dá o código HTTP do erro no stderr ("gh: <message> (HTTP 404)") e, com 204, nenhum corpo.
// Quando o corpo do erro traz `errors` em texto, o gh escreve "gh: <errors> (<message>)" sem o código: aí ele vem do
// `status` do corpo, que o GitHub manda nos erros.
export function api(metodo, caminho, corpo) {
  const args = ["api", "--method", metodo, caminho, ...(corpo === undefined ? [] : ["--input", "-"])];
  const r = gh(args, corpo === undefined ? undefined : JSON.stringify(corpo));
  let dados = null;
  try {
    dados = r.stdout.trim() ? JSON.parse(r.stdout) : null;
  } catch {
    // um corpo que não é JSON fica null
  }
  const http = Number(/\(HTTP (\d{3})\)/.exec(r.stderr)?.[1] ?? (r.codigo === 0 ? 0 : dados?.status) ?? 0) || 0;
  return { ok: r.codigo === 0, http, corpo: dados, erro: r.stderr };
}

// ponytail: o KIT_ESPERA_CI_MS só existe para os testes do kit não esperarem 10 s a cada busca
const ESPERA = Number(process.env.KIT_ESPERA_CI_MS ?? 10000);

// A CI de um PR que o GITHUB_TOKEN abriu ou atualizou: o GitHub cria as execuções do pull_request paradas, à espera de
// aprovação, e elas aparecem um pouco depois do push: até 6 buscas, com a espera entre elas. Só as nossas são
// aprovadas, do branch do PR e deste repositório: um fork pode ter um commit com o mesmo SHA. O branch e o SHA são
// dados (o branch pode vir da API): entram só como valores da busca, codificados (a `/` do branch fica, como no
// GitHub). Devolve {achadas, aprovadas}, com `achadas` null quando a busca falhou; quem chama decide o aviso.
export function aprovarCi(repositorio, branch, sha) {
  const valor = (texto) => encodeURIComponent(texto).replaceAll("%2F", "/");
  const caminho =
    `repos/${repositorio}/actions/runs?head_sha=${valor(sha)}&event=pull_request&status=action_required` +
    `&branch=${valor(branch)}`;
  const pendentes = () => {
    const busca = api("GET", caminho);
    if (!busca.ok || !Array.isArray(busca.corpo?.workflow_runs)) return null;
    return busca.corpo.workflow_runs.filter((e) =>
      Number.isSafeInteger(e?.id) && e.head_branch === branch && e.head_repository?.full_name === repositorio);
  };
  let execucoes = [];
  for (let vez = 0; vez < 6 && execucoes?.length === 0; vez++) {
    if (vez) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ESPERA);
    execucoes = pendentes();
  }
  const aprovadas = (execucoes ?? []).filter(
    (e) => api("POST", `repos/${repositorio}/actions/runs/${e.id}/approve`).ok).length;
  return { achadas: execucoes === null ? null : execucoes.length, aprovadas };
}
