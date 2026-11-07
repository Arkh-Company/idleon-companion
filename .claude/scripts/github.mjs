#!/usr/bin/env node
// O `just github <dono>` (desenho, seção 8.6): cria o repositório privado <dono>/<nome> no GitHub, liga as
// configurações, publica a main e a protege com o ruleset "kit: main" quando o plano da conta permite. Cada passo confere
// o estado antes, e rodar de novo (inclusive depois de uma falha no meio) pula o que já está feito. O modo (solo ou
// time) e as versões vêm do .copier-answers.yml; no solo, faz exatamente o que fazia antes do modo time. Os passos:
// 1. confere o dono, a opção, o login no gh, a árvore sem mudanças e o commit da main (a opção --dar-acesso só no time);
// 2. o nome vem do origin ou, sem ele, da pasta; cria o repositório quando ele não existe e grava o origin que falta
//    (nunca adota em silêncio um repositório que já existe: sem origin, ou com origin de outro dono, recusa);
// 3. com admin: apagar o branch depois do merge, merge automático, alertas e correções de segurança do Dependabot, a
//    permissão do Actions para abrir PR (a organização pode bloquear: 409) e o rótulo `seguranca-suspeito`; no time,
//    o acesso dos donos do .github/CODEOWNERS (o GitHub pula em silêncio o dono sem escrita): confere cada um só com
//    GET e, sem a opção --dar-acesso, só lista quem falta; com ela, dá escrita (push) a quem falta, nunca outra
//    permissão, e nunca rebaixa quem já escreve ou administra. Os donos do CODEOWNERS são dado do repositório: cada um
//    passa pela regex do copier.yml antes de entrar num caminho da API, e o que não passa é ignorado;
// 4. publica a main quando ela ainda não está no GitHub (nunca faz push numa main que já existe lá); no time, mostra os
//    erros que o GitHub acha no CODEOWNERS da main;
// 5. com admin: cria o ruleset "kit: main", ou o atualiza com o mesmo corpo (no time, com 1 aprovação, a do dono);
// 6. as versões (com publish_releases): a linha `versões: …`; o workflow semanal: confere se o segredo
//    CLAUDE_CODE_OAUTH_TOKEN existe (só o GET pelo nome: o kit nunca grava nem vê o token) e, sem ele, imprime os dois
//    comandos para o usuário rodar no terminal dele; a linha da proteção vem por último.
// Descobre o que a conta permite tentando, nunca consultando o plano: o permissions.admin do repositório e o 403
// "Upgrade to GitHub Pro" dos rulesets. Cada passo imprime uma linha `github: …`; a última linha é o resultado, e ficar
// sem ruleset sai com 0. Recusas e falhas saem com 1 e `github: <motivo>` no stderr. O git e o gh rodam por
// execFileSync com a lista de argumentos, nunca por shell. Testado contra um gh falso (tests/fixtures/gh_falso.mjs do
// kit), com um repositório nu local no lugar do GitHub.
// Uso, na raiz do projeto: node .claude/scripts/github.mjs <dono> [--dar-acesso]  (quem chama: a receita `just github`)
import { basename } from "node:path";
import { cdPasta } from "./caminho.mjs";
import { api as apiGh, gh as ghBruto, nomeDoGithubValido, origemGithub, rodar, visivel } from "./gh.mjs";

const RULESET = {
  name: "kit: main",
  target: "branch",
  enforcement: "active",
  bypass_actors: [],
  conditions: { ref_name: { include: ["refs/heads/main"], exclude: [] } },
  rules: [
    { type: "deletion" },
    { type: "non_fast_forward" },
    {
      type: "pull_request",
      parameters: {
        required_approving_review_count: 0,
        dismiss_stale_reviews_on_push: false,
        require_code_owner_review: false,
        require_last_push_approval: false,
        required_review_thread_resolution: false,
      },
    },
    {
      type: "required_status_checks",
      parameters: { strict_required_status_checks_policy: false, required_status_checks: [{ context: "check" }] },
    },
  ],
};
// No time: exatamente 1 aprovação, a do dono do arquivo, que cai com commit novo
const RULESET_TIME = {
  ...RULESET,
  rules: RULESET.rules.map((regra) =>
    regra.type === "pull_request"
      ? {
          ...regra,
          parameters: {
            ...regra.parameters,
            required_approving_review_count: 1,
            dismiss_stale_reviews_on_push: true,
            require_code_owner_review: true,
          },
        }
      : regra,
  ),
};
const OPCAO = "--dar-acesso";
const ESCRITA = { permission: "push" }; // a única permissão que o kit dá
const PAPEIS = ["read", "triage", "write", "maintain", "admin"]; // os papéis do GitHub (role_name); outro é personalizado
const SEM_PAPEL = ["none", ""]; // o role_name de um login sem acesso ao repositório

const ROTULO = {
  name: "seguranca-suspeito",
  color: "d73a4a",
  description: "Workflow semanal: achado high ou não analisado; revise antes do merge",
};
const SEGREDO = "CLAUDE_CODE_OAUTH_TOKEN";

function recusa(mensagem) {
  console.error(`github: ${mensagem}`);
  process.exit(1);
}

function passo(mensagem) {
  console.log(`github: ${mensagem}`);
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
const git = seguro((...args) => rodar("git", args));
const gh = seguro(ghBruto);
const api = seguro(apiGh);

function exigir(resposta, oque) {
  if (!resposta.ok) recusa(`${oque}: ${resposta.erro}`);
  return resposta;
}

// O modo, as versões e os donos vêm da main do GitHub, a que o ruleset protege, e nunca da árvore de trabalho nem de
// um branch: um PR ainda não aprovado que muda o CODEOWNERS ou o work_mode não dá acesso nem troca o ruleset. A main
// local só vale na primeira rodada, quando o GitHub ainda não tem a main (o passo 4 a publica). Devolve a referência
// que serve (`refs/heads/main` ou o SHA da main do GitHub, lida pelo git fetch), ou null quando o git não conseguiu ler
// o GitHub. Quem chama já conferiu que o origin é <dono>/<nome> no GitHub. Grava em mainRemota o que o único
// ls-remote da rodada viu, que o passo 4 reaproveita: "sim", "nao" ou o erro do git (o padrão é o nome inteiro,
// refs/heads/main: o `main` sozinho casaria também um refs/heads/x/main).
function fonteDaMain(repositorioExiste) {
  if (!repositorioExiste) {
    mainRemota = "nao"; // o repositório é criado agora, vazio
    return "refs/heads/main";
  }
  const remota = git("ls-remote", "--exit-code", "--heads", "origin", "refs/heads/main");
  mainRemota = remota.codigo === 0 ? "sim" : remota.codigo === 2 ? "nao" : remota.stderr || `código ${remota.codigo}`;
  if (mainRemota === "nao") return "refs/heads/main";
  if (mainRemota !== "sim") return null;
  if (git("fetch", "--quiet", "--no-tags", "--no-recurse-submodules", "origin", "refs/heads/main").codigo !== 0) return null;
  const sha = git("rev-parse", "--verify", "--quiet", "FETCH_HEAD^{commit}");
  return sha.codigo === 0 && /^[0-9a-f]{40,64}$/.test(sha.stdout.trim()) ? sha.stdout.trim() : null;
}

// Um arquivo comum da main escolhida, ou null quando ela não o tem (ou ele é um link ou uma pasta); outro erro do git
// recusa. Lido pelo git ls-tree e pelo git cat-file, com a lista de argumentos.
function naMain(caminho) {
  if (fonte === null) return null;
  const item = git("ls-tree", fonte, "--", caminho);
  if (item.codigo !== 0) recusa(`não li ${caminho} da main: ${item.stderr}`);
  const blob = /^100(?:644|755) blob ([0-9a-f]{40,64})\t/.exec(item.stdout)?.[1];
  if (!blob) return null;
  const r = git("cat-file", "blob", blob);
  if (r.codigo !== 0) recusa(`não li ${caminho} da main: ${r.stderr}`);
  return r.stdout;
}

// Uma resposta do .copier-answers.yml, que é o to_nice_yaml do Copier com os valores restritos pelo validador: um
// leitor de linha basta (decisão 5). O que ele não entende (sem o arquivo, a chave repetida, aspas duplas, bloco,
// comentário na linha) vale como resposta ausente: o modo fica solo, nunca time por engano.
function resposta(texto, chave) {
  if (texto === null) return null;
  const linhas = texto.split(/\r?\n/).filter((linha) => linha.startsWith(`${chave}:`));
  const valor = linhas.length === 1 ? /^[a-z_]+: (.*)$/.exec(linhas[0])?.[1] : undefined;
  if (valor === undefined) return null;
  return /^'(?:[^']|'')*'$/.test(valor) ? valor.slice(1, -1).replaceAll("''", "'") : valor;
}

// 1. O dono, a opção, o login, a árvore e a main
const argumentos = process.argv.slice(2);
const dono = argumentos[0];
const darAcesso = argumentos[1] === OPCAO;
const uso = `uso: node .claude/scripts/github.mjs <dono> [${OPCAO}]`;
// o nomeDoGithubValido (a regra comum dos caminhos da API) e, por cima, a do login: sem ponto nem _, até 39
if (argumentos.length < 1 || !nomeDoGithubValido(dono) || !/^[A-Za-z0-9-]{1,39}$/.test(dono)) {
  recusa(`dono inválido: use o login de uma conta ou organização do GitHub (${uso})`);
}
if (argumentos.length > 2 || (argumentos.length === 2 && !darAcesso)) recusa(`opção inválida: só ${OPCAO} (${uso})`);
if (gh(["auth", "status"]).codigo !== 0) recusa(`sem login no gh: rode ${cdPasta()}gh auth login`);
const arvore = git("status", "--porcelain");
if (arvore.codigo !== 0) recusa(`o git não respondeu: ${arvore.stderr}`);
if (arvore.stdout.trim()) recusa("a árvore tem mudanças: faça o commit ou guarde-as antes");
if (git("rev-parse", "--verify", "--quiet", "refs/heads/main^{commit}").codigo !== 0) recusa("a main ainda não tem commit");

// 2. O nome e o repositório
const endereco = (nome) => `https://github.com/${dono}/${nome}.git`;
const origem = git("config", "--get", "remote.origin.url");
const temOrigin = origem.codigo === 0;
let nome;
if (temOrigin) {
  const url = origem.stdout.trim();
  const partes = origemGithub(url);
  // sem o usuário e a senha de um https://usuario:token@host/...: o token não vai para o terminal
  if (!partes) recusa(`o origin (${visivel(url.replace(/\/\/[^@/]+@/, "//"), 200)}) não é um repositório do GitHub`);
  nome = partes.nome;
  if (partes.dono.toLowerCase() !== dono.toLowerCase()) {
    recusa(`o origin é de ${partes.dono}, e não de ${dono}: confira o dono, ou rode ${cdPasta()}git remote set-url origin ${endereco(nome)}`);
  }
} else {
  nome = basename(process.cwd());
  if (!nomeDoGithubValido(nome)) {
    recusa(
      `o nome da pasta ("${visivel(nome)}") não serve para o repositório (começa por letra ou número e só tem letras, números, ".", "_" e "-"): crie o repositório no GitHub e rode ${cdPasta()}git remote add origin https://github.com/${dono}/<nome>.git`,
    );
  }
}
const repo = `repos/${dono}/${nome}`;
let info = api("GET", repo);
if (info.ok && !temOrigin) {
  recusa(
    `${dono}/${nome} já existe no GitHub, e este projeto não tem origin: se o repositório é deste projeto, rode ${cdPasta()}git remote add origin ${endereco(nome)} e depois ${cdPasta()}just github ${dono}`,
  );
}
if (!info.ok && info.http !== 404) recusa(`não li ${dono}/${nome}: ${info.erro}`);
// O modo, antes de qualquer mudança no GitHub: a opção --dar-acesso recusa aqui, sem ter criado nada
let mainRemota;
const fonte = fonteDaMain(info.ok);
const semMain = "não consegui ler a main do GitHub (o git ls-remote ou o git fetch falhou)";
if (fonte === null && darAcesso) recusa(`${semMain}; o acesso dos donos não foi dado`);
if (fonte === null) passo(`${semMain}: o modo e os donos do CODEOWNERS ficam sem conferir, e o ruleset não é gravado`);
const respostas = naMain(".copier-answers.yml");
const time = resposta(respostas, "work_mode") === "team";
const versoes = resposta(respostas, "publish_releases") === "true";
if (darAcesso && !time) recusa(`a opção ${OPCAO} só vale no modo time`);
if (info.ok) passo(`${dono}/${nome} já existe no GitHub`);
else {
  const criado = gh(["repo", "create", `${dono}/${nome}`, "--private"]);
  if (criado.codigo !== 0) recusa(`não criei ${dono}/${nome}: ${criado.stderr}`);
  passo(`repositório ${dono}/${nome} criado (privado)`);
  if (!temOrigin) {
    const r = git("remote", "add", "origin", endereco(nome));
    if (r.codigo !== 0) recusa(`não gravei o origin: ${r.stderr}`);
    passo(`origin: ${endereco(nome)}`);
  }
  info = exigir(api("GET", repo), `não li ${dono}/${nome}`);
}

// 3. As configurações, só com admin
const admin = info.corpo?.permissions?.admin === true;
let bloqueado = false; // a organização não deixa o Actions abrir PR
if (admin) {
  if (info.corpo.delete_branch_on_merge) passo("apagar o branch depois do merge: já ligado");
  else {
    exigir(api("PATCH", repo, { delete_branch_on_merge: true }), "não liguei o apagar o branch depois do merge");
    passo("apagar o branch depois do merge: ligado");
  }
  if (info.corpo.allow_auto_merge) passo("merge automático: já ligado");
  else {
    const r = api("PATCH", repo, { allow_auto_merge: true });
    passo(r.ok && r.corpo?.allow_auto_merge === true ? "merge automático: ligado" : `merge automático: o plano de ${dono} não permite`);
  }
  const alertas = api("GET", `${repo}/vulnerability-alerts`);
  if (alertas.ok) passo("alertas do Dependabot: já ligados");
  else if (alertas.http === 404) {
    exigir(api("PUT", `${repo}/vulnerability-alerts`), "não liguei os alertas do Dependabot");
    passo("alertas do Dependabot: ligados");
  } else recusa(`não li os alertas do Dependabot: ${alertas.erro}`);
  const correcoes = api("GET", `${repo}/automated-security-fixes`);
  if (correcoes.ok && correcoes.corpo?.enabled === true) passo("correções de segurança do Dependabot: já ligadas");
  else if (correcoes.ok || correcoes.http === 404) {
    exigir(api("PUT", `${repo}/automated-security-fixes`), "não liguei as correções de segurança do Dependabot");
    passo("correções de segurança do Dependabot: ligadas");
  } else recusa(`não li as correções de segurança do Dependabot: ${correcoes.erro}`);
  // o Actions abrir PR (o workflow semanal); 409 é a organização bloqueando: o bloco do workflow avisa no fim
  const permissao = exigir(api("GET", `${repo}/actions/permissions/workflow`), "não li a permissão do Actions");
  if (permissao.corpo?.can_approve_pull_request_reviews === true) passo("o Actions pode abrir PR: já ligado");
  else {
    const r = api("PUT", `${repo}/actions/permissions/workflow`, { can_approve_pull_request_reviews: true });
    if (r.ok) passo("o Actions pode abrir PR: ligado");
    else if (r.http === 409) bloqueado = true;
    else recusa(`não liguei a permissão do Actions para abrir PR: ${r.erro}`);
  }
  const rotulo = api("GET", `${repo}/labels/${ROTULO.name}`);
  if (rotulo.ok) passo(`rótulo ${ROTULO.name}: já existe`);
  else if (rotulo.http === 404) {
    exigir(api("POST", `${repo}/labels`, ROTULO), `não criei o rótulo ${ROTULO.name}`);
    passo(`rótulo ${ROTULO.name}: criado`);
  } else recusa(`não li o rótulo ${ROTULO.name}: ${rotulo.erro}`);
  if (time) acessoDosDonos();
} else passo(`configurações: só um admin de ${dono} muda`);

// Os donos do CODEOWNERS: os `@…` das linhas que não são comentário (o primeiro campo é o padrão; um `#` começa o
// comentário), sem repetir (o GitHub não distingue caixa), na ordem da primeira aparição. O arquivo é dado do
// repositório: o dono que não casa a regex do copier.yml, ou com `..`, é ignorado, e nunca entra num caminho da API.
// Um e-mail (o CODEOWNERS aceita) não é `@…`: o kit não dá acesso a ele. O arquivo é o da main (fonteDaMain); null
// quando ela não o tem.
function donosDoCodeowners() {
  const texto = naMain(".github/CODEOWNERS");
  if (texto === null) return null;
  const donos = new Map();
  for (const linha of texto.split("\n")) {
    const [padrao, ...campos] = linha.replace(/\r$/, "").trim().split(/[ \t]+/);
    if (padrao.startsWith("#")) continue;
    for (const campo of campos) {
      if (campo.startsWith("#")) break;
      if (!campo.startsWith("@")) continue;
      const valido =
        /^@[A-Za-z0-9][A-Za-z0-9-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)?$/.test(campo) &&
        !campo.includes("..") &&
        campo.slice(1).split("/").every(nomeDoGithubValido);
      if (!valido) passo(`dono inválido no CODEOWNERS (linha ignorada): ${visivel(campo)}`);
      else if (!donos.has(campo.toLowerCase())) donos.set(campo.toLowerCase(), campo);
    }
  }
  return [...donos.values()];
}

// O acesso dos donos (decisão 6): confere cada um só com GET; sem a opção, lista quem falta; com ela, dá escrita a quem
// falta. Nunca rebaixa: só quem não tem acesso, ou tem leitura (pull, triage, read, none), recebe o PUT. Um papel que o
// kit não conhece (um papel personalizado, no role_name ou no permission) fica como está, sem PUT, com uma linha; uma
// resposta que o kit não entende (sem a permissão) e os erros inesperados recusam.
function acessoDosDonos() {
  const donos = donosDoCodeowners();
  if (donos === null) return passo("CODEOWNERS: ainda não está na main; o acesso dos donos fica para depois");
  const organizacao = info.corpo?.owner?.type === "Organization";
  let times; // os times com acesso ao repositório, lidos uma vez, quando o primeiro time precisa
  const lerTimes = () => {
    const r = api("GET", `${repo}/teams?per_page=100`);
    if (!r.ok || !Array.isArray(r.corpo)) recusa(`não li os times com acesso a ${dono}/${nome}: ${r.erro || "resposta inesperada"}`);
    // ponytail: uma página só; com ela cheia, um time da página seguinte pareceria sem acesso e o PUT poderia
    // rebaixá-lo, então recusa. Upgrade: o --paginate no api do gh.mjs.
    if (r.corpo.length >= 100) recusa(`${dono}/${nome} tem 100 times ou mais com acesso: confira os donos do CODEOWNERS no GitHub`);
    return r.corpo;
  };
  const faltam = [];
  let incerto = false; // um dono que o script não troca: sem PUT e sem o "todos já podem escrever"
  const naoTroca = (quem, papel) => {
    incerto = true;
    passo(`${quem}: papel personalizado (${visivel(papel)}); o script não o troca`);
  };
  const personalizado = (papel) => papel !== undefined && papel !== null && !PAPEIS.includes(papel);
  for (const d of donos) {
    const [org, slug] = d.slice(1).split("/");
    if (slug !== undefined) {
      if (!organizacao || org.toLowerCase() !== dono.toLowerCase()) {
        passo(`time ${d}: só vale num repositório de ${org}; o CODEOWNERS não o chama`);
        continue;
      }
      times ??= lerTimes();
      const t = times.find((x) => typeof x?.slug === "string" && x.slug.toLowerCase() === slug.toLowerCase());
      // o time fora da lista não tem acesso; o time na lista sem a permissão é uma resposta que o kit não entende
      if (t === undefined) faltam.push({ d, slug: slug.toLowerCase() });
      else if (typeof t.permission !== "string") recusa(`a resposta do GitHub sobre o time ${d} não traz a permissão: confira o acesso no GitHub`);
      else if (personalizado(t.role_name)) naoTroca(`time ${d}`, t.role_name);
      else if (["push", "maintain", "admin"].includes(t.permission)) passo(`time ${d}: já pode escrever`);
      else if (["pull", "triage"].includes(t.permission)) faltam.push({ d, slug: slug.toLowerCase() });
      else naoTroca(`time ${d}`, t.permission);
    } else {
      // o permission é o papel antigo (triage vira read, maintain vira write, um personalizado vira o da base); o
      // role_name é o papel de verdade
      const r = api("GET", `${repo}/collaborators/${org}/permission`);
      const { permission, role_name: papel } = r.ok && r.corpo && typeof r.corpo === "object" ? r.corpo : {};
      if (r.http === 404) faltam.push({ d, login: org });
      else if (!r.ok || typeof permission !== "string") recusa(`não li a permissão de ${d}: ${r.erro || "resposta inesperada"}`);
      else if (personalizado(papel) && !SEM_PAPEL.includes(papel)) naoTroca(d, papel);
      else if (["admin", "write"].includes(permission)) passo(`${d}: já pode escrever`);
      else if (["read", "none"].includes(permission)) faltam.push({ d, login: org });
      else naoTroca(d, permission);
    }
  }
  if (!faltam.length) return incerto ? undefined : passo("donos do CODEOWNERS: todos já podem escrever");
  if (!darAcesso) {
    for (const { d, slug } of faltam) {
      passo(
        slug
          ? `acesso a dar: time ${d} (escrita)`
          : `acesso a dar: ${d} (escrita; num repositório de conta pessoal ou fora da organização, vai como convite)`,
      );
    }
    return passo(`para dar o acesso, rode ${cdPasta()}just github ${dono} ${OPCAO}`);
  }
  for (const { d, slug, login } of faltam) {
    if (slug) {
      const r = api("PUT", `orgs/${dono}/teams/${slug}/repos/${dono}/${nome}`, ESCRITA);
      if (r.ok) passo(`time ${d}: acesso de escrita dado`);
      else if (r.http === 404 || r.http === 422) passo(`time ${d} não existe ou não é visível para você: confira o CODEOWNERS`);
      else recusa(`não dei o acesso de escrita ao time ${d}: ${r.erro}`);
    } else {
      // o permission do corpo só vale num repositório de organização; na conta pessoal, o colaborador já escreve
      const r = api("PUT", `${repo}/collaborators/${login}`, organizacao ? ESCRITA : undefined);
      // 201 traz o convite no corpo; 204 (já colaborador ou membro da organização) vem sem corpo
      if (r.ok) passo(r.corpo ? `${d}: convite enviado; a pessoa aceita no GitHub` : `${d}: acesso de escrita dado`);
      else if (r.http === 404) passo(`${d} não existe no GitHub: confira o CODEOWNERS`);
      else recusa(`não dei o acesso de escrita a ${d}: ${r.erro}`);
    }
  }
}

// 4. A main no GitHub
// (o ls-remote do passo 2, sem uma segunda consulta: a main que decidiu o modo é a mesma que decide o push)
if (mainRemota === "nao") {
  const r = git("push", "-u", "origin", "main");
  if (r.codigo !== 0) recusa(`o push da main falhou: ${r.stderr}`);
  passo("main publicada");
} else if (mainRemota === "sim") passo("a main já está no GitHub: o kit não faz push nela (mudanças vão por PR)");
else recusa(`o git ls-remote falhou: ${mainRemota}`);

// No time, os erros que o GitHub acha no CODEOWNERS da main (decisão 7): um dono sem acesso tem a linha pulada em
// silêncio. A mensagem é dado do GitHub: só a primeira linha, sem caracteres de controle. Nunca recusa.
if (time) {
  const r = api("GET", `${repo}/codeowners/errors`);
  const erros = r.corpo?.errors;
  if (r.http === 404) passo("CODEOWNERS: ainda não está na main");
  else if (!r.ok || !Array.isArray(erros)) passo(`CODEOWNERS: não li os erros: ${visivel(r.erro || "resposta inesperada", 200)}`);
  else if (!erros.length) passo("CODEOWNERS: sem erros");
  else {
    for (const e of erros) {
      const linha = Number.isSafeInteger(e?.line) ? e.line : "?";
      passo(`CODEOWNERS: linha ${linha}: ${visivel(String(e?.message ?? "").split("\n")[0], 200)}`);
    }
  }
}

// 5. O ruleset (o do time no modo time), só com admin; a linha final
const ruleset = time ? RULESET_TIME : RULESET;
function protecao() {
  if (fonte === null) recusa(`${semMain}: o ruleset não foi gravado; tente de novo quando o GitHub responder`);
  if (!admin) return `sem ruleset: só um admin de ${dono} pode criar; peça para ele rodar, na pasta do projeto dele: cd '<pasta do projeto>' && just github ${dono}`;
  const semPlano = `sem ruleset: o plano de ${dono} não permite (mova o repositório para uma organização paga ou assine o GitHub Pro); a main fica protegida só pelos hooks`;
  const plano = (r) => !r.ok && r.http === 403 && r.erro.includes("Upgrade to GitHub Pro");
  const lista = api("GET", `${repo}/rulesets?includes_parents=false`);
  if (plano(lista)) return semPlano;
  exigir(lista, "não li os rulesets");
  const kit = Array.isArray(lista.corpo) ? lista.corpo.find((r) => r.name === RULESET.name) : undefined;
  // o id vem da resposta da API e entra no caminho do PUT: só um inteiro passa
  if (kit && !(Number.isSafeInteger(kit.id) && kit.id > 0)) {
    recusa("resposta inesperada do GitHub: o ruleset não tem um id inteiro");
  }
  const gravado = kit ? api("PUT", `${repo}/rulesets/${kit.id}`, ruleset) : api("POST", `${repo}/rulesets`, ruleset);
  if (plano(gravado)) return semPlano;
  exigir(gravado, `não gravei o ruleset "${RULESET.name}"`);
  // o GitHub só muda o updated_at quando o conteúdo muda: igual ao de antes, o ruleset já estava como o do kit
  const igual = kit && kit.updated_at && gravado.corpo?.updated_at === kit.updated_at;
  passo(`ruleset "${RULESET.name}": ${kit ? (igual ? "já igual" : "atualizado") : "criado"}`);
  return "main protegida pelo GitHub";
}
const final = protecao();

// 6. As versões (decisão 8, sem chamada nova): o PR de versão do release.yml precisa do Actions poder abrir PR, como o
// workflow semanal
if (versoes) {
  if (!admin) {
    console.log(`versões: só um admin de ${dono} confere; peça para ele rodar, na pasta do projeto dele: cd '<pasta do projeto>' && just github ${dono}`);
  } else if (bloqueado) {
    console.log(`versões: o Actions não pode abrir o PR de versão: a organização ${dono} bloqueia; peça a um admin para liberar`);
  } else console.log("versões: pronto");
}

// O workflow semanal: nunca grava o segredo, só confere se ele existe
function workflow() {
  if (!admin) return `workflow semanal: só um admin de ${dono} liga; peça para ele rodar, na pasta do projeto dele: cd '<pasta do projeto>' && just github ${dono}`;
  if (bloqueado) {
    return `workflow semanal: o Actions não pode abrir PR: a organização ${dono} bloqueia; peça a um admin para liberar`;
  }
  const segredo = api("GET", `${repo}/actions/secrets/${SEGREDO}`);
  if (segredo.ok) return "workflow semanal: pronto";
  if (segredo.http !== 404) recusa(`não li o segredo ${SEGREDO}: ${segredo.erro}`);
  const aqui = cdPasta();
  return [
    // numa linha só: a quebra que o terminal põe na linha longa vira espaço na cópia, e o Claude não autentica
    "workflow semanal: falta o token do Claude; rode no seu terminal, um de cada vez (o segundo pede o token que o " +
      "primeiro mostrou, sem mostrá-lo; cole-o numa linha só, sem espaço: o terminal pode quebrar a linha longa):",
    `  ${aqui}claude setup-token`,
    `  ${aqui}gh secret set ${SEGREDO}`,
  ].join("\n");
}
console.log(workflow());
console.log(final);
