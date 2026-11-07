#!/usr/bin/env node
// PreToolUse hook (matcher "Edit|Write|NotebookEdit"): decide pelo papel de quem chama, o agent_type da entrada (o name
// do frontmatter do subagente, sem mudar a caixa). Para todos, bloqueia a edição de segredos, internos do git, lockfiles
// e chaves. Depois:
//   revisor   só lê: toda edição é bloqueada (ele nem tem ferramenta de edição; é uma defesa a mais).
//   executor  edita código, testes, documentação e o tasks.md da feature. Não edita o critério de pronto que já existe
//             (lint, tipos, testes, CI, hooks, as instruções das IAs); nada em .claude/ nem em .specify/, nem arquivo
//             novo; e, da pasta da spec (specs/), só o tasks.md; nem a linha de base da vigia nem o registro.md do
//             /implementar (.superpowers/implementar/<pasta>/). Para todos, um ":" fora da letra do drive bloqueia
//             (fluxo do NTFS ou caminho relativo ao drive).
//   sessão    é qualquer outro agent_type (Explore, general-purpose, plugin:executor, Executor com maiúscula) e a falta
//             dele. É a barreira do princípio 9, "a sua sessão planeja, os agentes executam": só passam Markdown, specs/,
//             docs/, .specify/, .out-of-scope/, .superpowers/ (o painel visual do brainstorming grava lá), .impeccable/
//             e o critério de pronto; o resto é código do Executor.
// A regra de specs/ do Executor e a barreira da sessão só valem dentro da raiz do projeto (CLAUDE_PROJECT_DIR; sem ele,
// o cwd da entrada; sem os dois, o diretório do processo): o que fica fora dela, como o rascunho e a memória do Claude,
// não é código do produto.
// ponytail: a barreira pega as ferramentas de edição e olha só o texto do caminho. Um comando de terminal que grave
// arquivo escapa daqui (quem olha o terminal é a vigia-criterio.mjs, que desfaz a mudança no critério de pronto), e
// também um caminho que aponte para o mesmo lugar por outra forma (\\?\, UNC, nome 8.3, junção). O absoluto sem
// drive (\proj\...) não escapa: conta no drive da raiz do projeto.
// Exit 2 = bloqueia (o stderr volta ao Claude como motivo); exit 0 = sem objeção.
// Falha fechado: se não der para ler a entrada, ou se ela não trouxer o caminho em forma de texto, bloqueia.
// Falha fechado também numa exceção: sem isto, um erro não tratado (até um ReferenceError do módulo) sai com 1, e o
// Claude Code só bloqueia com 2. Os imports do ESM sobem antes de tudo, mas só os do node:, que não falham.
process.on("uncaughtException", () => {
  process.stderr.write("Bloqueado pelo hook: erro interno ao conferir a edição; peça ao humano.\n");
  process.exit(2);
});
import { existsSync, readFileSync } from "node:fs";
import { posix, resolve } from "node:path";

const SEMPRE = [
  [/(^|\/)\.env(\.(?!example$|sample$|template$)[^/]+)?$/, "guarda segredos. Edite o .env.example e diga ao humano qual variável definir."],
  [/(^|\/)\.git(\/|$)/, "é interno do git. Use comandos git."], // num worktree, o .git é um arquivo
  [/(^|\/)(package-lock\.json|npm-shrinkwrap\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|uv\.lock|pipfile\.lock|cargo\.lock|go\.sum|gemfile\.lock|composer\.lock|mise\.lock)$/,
    "é lockfile gerado. Mude o manifesto e rode o instalador."],
  [/(\.(pem|key|p12|pfx)|(^|\/)id_(rsa|ed25519|ecdsa)[^/]*)$/, "é chave ou certificado. Peça ao humano."],
];

// O critério de pronto. O Executor não edita o que já existe; arquivo novo dele é livre (um workflow novo, por exemplo)
// e cai na regra ask do settings.json, que pergunta ao usuário. Em .claude/ e .specify/ nem o arquivo novo passa.
// Os nomes que o just e o lefthook leem (o caminho já vem em minúsculas):
// - just: `justfile` e `.justfile`, sem distinguir caixa (JUSTFILE_NAMES em src/search.rs,
//   https://github.com/casey/just/blob/master/src/search.rs, conferido pelo Context7 /casey/just em 25/10/2026);
// - lefthook: `lefthook.{yml,yaml,toml,json,jsonc}`, os mesmos com ponto na frente, os sem ponto também em `.config/`,
//   e o `lefthook-local.*` / `.lefthook-local.*` (https://lefthook.dev/configuration/, conferido em 25/10/2026).
// Também: o `.github/` inteiro (o CODEOWNERS decide quem aprova; o Dependabot, os workflows), o `.copier-answers.yml`
// (o modo decide o ruleset do `just github`), o que os instaladores executam ou leem (`.pnpmfile.cjs`,
// `pnpm-workspace.yaml`, `.npmrc`, `uv.toml`, `.uv.toml`; o `mise.lock` é lockfile e já fica bloqueado acima) e o que
// move o workflow de versão (`release-please-config.json`, `.release-please-manifest.json`). E o `AGENTS.md` e o
// `CLAUDE.md`, as instruções das IAs: mudam o que qualquer IA faz no projeto, inclusive o que ela aceita como pronto
// (Plano 6, decisão 4). Em qualquer pasta, como os outros: fora da raiz do projeto, o caminho vem inteiro, e uma
// âncora na raiz não casaria.
// E o que muda uma proteção por fora: o `.gitattributes` decide o `-text` de `.claude/skills/**`, de que dependem os
// hashes da análise de segurança; o `.worktreeinclude` copia o `.env` e o `settings.local.json` para os worktrees dos
// subagentes; o `.playwright/cli.config.json` decide qual binário o playwright-cli abre; e o `.impeccable/config.json`
// liga hook do Impeccable.
const CRITERIO = /(^|\/)(agents\.md|claude\.md|\.?justfile|\.?lefthook(?:-local)?\.(?:ya?ml|toml|jsonc?)|mise\.toml|\.mcp\.json|pyproject\.toml|\.?ruff\.toml|pyrightconfig\.json|tsconfig[^/]*\.json|eslint\.config\.[cm]?[jt]s|\.eslintrc[^/]*|\.eslintignore|prettier\.config\.[cm]?[jt]s|\.prettierrc[^/]*|\.prettierignore|vitest\.config\.[cm]?[jt]s|vite\.config\.[cm]?[jt]s|playwright\.config\.[cm]?[jt]s|smoke\.spec\.ts|\.gitleaks\.toml|\.gitleaks-dir\.toml|\.gitleaksignore|\.editorconfig|\.pnpmfile\.cjs|pnpm-workspace\.yaml|\.npmrc|\.?uv\.toml|\.copier-answers\.yml|release-please-config\.json|\.release-please-manifest\.json|\.gitattributes|\.worktreeinclude|\.playwright\/cli\.config\.json|\.impeccable\/config\.json)$|(^|\/)\.github\/|(^|\/)\.claude\/|(^|\/)\.specify\/(?:scripts|extensions\/[^/]+\/scripts|kit)\//;
// Um agente, uma skill ou um hook novo muda o que o Claude faz, e um settings.local.json novo pode trazer disableAllHooks
// ou env (o git o ignora e o .worktreeinclude o copia); um script novo de .specify/ roda sem pedir confirmação.
const CLAUDE_E_SPECIFY = /(^|\/)\.(?:claude|specify)\//;
// A linha de base da vigia e o registro (que guarda o <start> da fase), gravados pela sessão: quem é vigiado não os reescreve
const BASE_DA_VIGIA = /(^|\/)\.superpowers\/implementar\/[^/]+\/(?:(?:fase-\d+|feature)-criterio-inicio\.txt|registro\.md)$/;
// Da pasta da spec, o Executor só edita o tasks.md
const TASKS = /^specs\/[^/]+\/tasks\.md$/;
// O que a sua sessão edita além do critério de pronto: Markdown em qualquer pasta e, no começo do caminho, as pastas do planejamento
const PLANEJAMENTO = /\.md$|^(?:specs|docs|\.specify|\.out-of-scope|\.superpowers|\.impeccable)\//;

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // entrada ilegível: cai no bloqueio logo abaixo
}
const raw = input?.tool_input?.file_path ?? input?.tool_input?.notebook_path;
if (typeof raw !== "string") {
  process.stderr.write("Bloqueado por .claude/hooks/protect-files: não consegui ler a entrada.\n");
  process.exit(2);
}
// O Windows manda barras invertidas; o NTFS ignora caixa. O .. sai antes de tudo, porque o Write e o Edit gravam
// no caminho resolvido: .claude/worktrees/wt1/../../settings.json é o .claude/settings.json de verdade.
// Num worktree nativo do Claude Code (.claude/worktrees/<nome>/), o caminho conta a partir da raiz dele.
const WORKTREE = /^.*\/\.claude\/worktrees\/[^/]+\//;
// A letra do drive (x:/) fica de fora do normalize: um .. acima da raiz a comeria (c:/../proj viraria proj, relativo),
// e o Windows para na raiz (C:\..\proj é C:\proj, como o posix.normalize faz com /../proj)
const normalizar = (texto) => {
  const s = texto.replaceAll("\\", "/").toLowerCase();
  const d = /^[a-z]:(?=\/)/.exec(s)?.[0] ?? "";
  return d + posix.normalize(s.slice(d.length));
};
const cwd = typeof input.cwd === "string" ? input.cwd : "";
const completo = normalizar(raw);
// O caminho relativo conta a partir do cwd da entrada, que acompanha o Claude para dentro do worktree
const alvo = /^(?:[a-z]:)?\//.test(completo) || !cwd ? completo : normalizar(`${cwd}/${completo}`);
const relativo = noProjeto();
// As regras olham o caminho a partir da raiz do projeto (ou do worktree): uma pasta .claude/ acima da raiz não conta.
// Fora do projeto, o caminho inteiro.
const path = relativo ?? alvo;

// No NTFS, arquivo::$DATA e arquivo:fluxo gravam o arquivo principal, e C:arquivo (relativo ao drive) grava no
// <cwd>\arquivo: os dois escapariam das regras ancoradas em (^|/) e em $. Só a letra do drive seguida de "/" tem ":"
if (completo.replace(/^[a-z]:(?=\/)/, "").includes(":")) {
  bloquear("tem ':' fora da letra do drive: fluxo alternativo do NTFS (arquivo::$DATA) ou caminho relativo ao drive "
    + "(C:arquivo), que gravam por fora das regras.");
}
for (const [re, why] of SEMPRE) {
  if (re.test(path)) bloquear(why);
}
// O papel é o agent_type exato: só "executor" e "revisor" têm regra própria; qualquer outro valor, ou nenhum, é a sessão
const papel = typeof input.agent_type === "string" ? input.agent_type : "";
if (papel === "revisor") {
  bloquear("o Revisor só lê. Devolva o achado à sessão, com o arquivo:linha e a mudança.");
}
if (papel === "executor") {
  if (BASE_DA_VIGIA.test(path)) {
    bloquear("é a linha de base da vigia ou o registro do /implementar, que a sessão grava. "
      + "Pare e devolva a pergunta à sessão.");
  }
  if (CLAUDE_E_SPECIFY.test(path)) {
    bloquear("é configuração do Claude Code ou do Spec Kit, que o Executor não edita. Pare e devolva a pergunta à sessão.");
  }
  if (CRITERIO.test(path) && existsSync(resolve(cwd, raw))) {
    bloquear("faz parte do critério de pronto (lint, tipos, testes, CI, hooks ou as instruções das IAs). "
      + "Pare e devolva a pergunta à sessão: com o sim do humano, ela faz a mudança.");
  }
  if (relativo?.startsWith("specs/") && !TASKS.test(relativo)) {
    bloquear("é da spec, do plano ou do research da feature: da pasta da spec, o Executor só edita o tasks.md. "
      + "Se a spec está ambígua, pare e devolva a pergunta à sessão.");
  }
} else if (relativo !== undefined && !PLANEJAMENTO.test(relativo) && !CRITERIO.test(relativo)) {
  bloquear("é código ou configuração do produto, e esta sessão planeja e coordena (princípio 9 do kit). "
    + "O Executor faz a mudança pelo /implementar; para testar uma ideia antes do plano, use o /prototipo (specs/NNN-nome/prototipo/).");
}
process.exit(0);

// Onde o caminho cai no projeto: contado da raiz do worktree nativo ou, por prefixo, da raiz do projeto (o
// CLAUDE_PROJECT_DIR fica na raiz original mesmo dentro de um worktree). Fora da raiz: undefined, e a barreira não vale.
function noProjeto() {
  const doWorktree = alvo.replace(WORKTREE, "");
  if (doWorktree !== alvo) return doWorktree;
  const raiz = normalizar(process.env.CLAUDE_PROJECT_DIR || cwd || process.cwd()).replace(/\/$/, "");
  // \proj\... (absoluto sem drive) é do drive atual no Windows: ganha a letra da raiz, para o lado da proteção.
  // O UNC (\\server\share, que o normalize deixa com uma barra só) fica como estava; no Linux nada muda
  const comDrive = /^\/(?!\/)/.test(alvo) && /^[a-z]:/.test(raiz) && !/^[\\/]{2}/.test(raw)
    ? raiz.slice(0, 2) + alvo : alvo;
  return comDrive.startsWith(`${raiz}/`) ? comDrive.slice(raiz.length + 1) : undefined;
}

function bloquear(why) {
  process.stderr.write(`Bloqueado por .claude/hooks/protect-files: ${raw} ${why}\n`);
  process.exit(2);
}
