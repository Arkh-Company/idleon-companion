#!/usr/bin/env node
// A vigia do critério de pronto (docs/superpowers/specs/2026-11-06-vigia-do-criterio-design.md). O protect-files só
// pega as ferramentas de edição; um comando de terminal grava o arquivo por fora. A vigia olha o efeito, não o texto:
//   antes   (PreToolUse, matcher "Bash|PowerShell"): guarda uma foto dos arquivos do critério que o git status mostra
//           (sujos, no índice ou novos), com o conteúdo de cada um, mais os ignorados que dão poder (IGNORADOS) e o HEAD.
//   depois  (PostToolUse e PostToolUseFailure: um comando que sai com erro não passa pelo primeiro): compara com a
//           foto; se o HEAD andou, soma o que os commits novos mudaram no critério.
//           No Executor e no Revisor (o agent_type exato), devolve cada arquivo ao que era e sai com 2; na sessão
//           (qualquer outro agent_type, ou nenhum), a mudança fica, e sai com 2 pedindo o sim do humano, salvo os
//           comandos que mudam o critério de propósito (isento: a única parte por texto).
//   confere <base> [--hash] (a rede do fim da fase, pela sessão): lista os arquivos do critério que mudaram desde o
//           <base> (com o --hash, cada um com o hash curto da árvore, do HEAD e do índice).
// Fora de um repositório git, nada. O git roda sempre sem shell, na raiz do repositório, sem os hooks do git, sem o
// fsmonitor e sem as travas opcionais (dois comandos em paralelo não brigam pelo index.lock).
// ponytail: um processo que grave depois do comando terminar, comandos do agente em paralelo (o depois de um pode
// devolver o que o outro desfez) e truques do git (assume-unchanged, skip-worktree, info/exclude, editar a foto)
// escapam; a conferência do fim da fase, a CI e o CODEOWNERS cobrem.
// Falha fechado numa exceção: sai com 2 (no antes, isso barra o comando; sem foto, o depois não conferiria nada).
process.on("uncaughtException", (erro) => {
  // depois do texto fixo, o código do erro e, de uma falha do git, a primeira linha do que ele disse
  const linha = String(erro?.stderr ?? "").split("\n").map((l) => l.trim()).find(Boolean);
  process.stderr.write("Bloqueado pelo hook: erro interno ao conferir o critério de pronto; peça ao humano. "
    + `(${erro?.code ?? erro?.name ?? "?"}${linha ? `: ${linha}` : ""})\n`);
  process.exit(2);
});
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { chmodSync, lstatSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, unlinkSync, writeFileSync }
  from "node:fs";
import { devNull, tmpdir } from "node:os";
import { dirname, isAbsolute, join } from "node:path";

// A mesma regex do protect-files.mjs (um teste exige o texto igual; um import local quebraria o falhar fechado)
const CRITERIO = /(^|\/)(agents\.md|claude\.md|\.?justfile|\.?lefthook(?:-local)?\.(?:ya?ml|toml|jsonc?)|mise\.toml|\.mcp\.json|pyproject\.toml|\.?ruff\.toml|pyrightconfig\.json|tsconfig[^/]*\.json|eslint\.config\.[cm]?[jt]s|\.eslintrc[^/]*|\.eslintignore|prettier\.config\.[cm]?[jt]s|\.prettierrc[^/]*|\.prettierignore|vitest\.config\.[cm]?[jt]s|vite\.config\.[cm]?[jt]s|playwright\.config\.[cm]?[jt]s|smoke\.spec\.ts|\.gitleaks\.toml|\.gitleaks-dir\.toml|\.gitleaksignore|\.editorconfig|\.pnpmfile\.cjs|pnpm-workspace\.yaml|\.npmrc|\.?uv\.toml|\.copier-answers\.yml|release-please-config\.json|\.release-please-manifest\.json|\.gitattributes|\.worktreeinclude|\.playwright\/cli\.config\.json|\.impeccable\/config\.json)$|(^|\/)\.github\/|(^|\/)\.claude\/|(^|\/)\.specify\/(?:scripts|extensions\/[^/]+\/scripts|kit)\//;
// O que o .gitignore esconde do git status e dá poder: as permissões locais do Claude, as instruções locais dele, o
// mise local e o lefthook local (na raiz e em .config/, com e sem o ponto, nas extensões que a CRITERIO aceita).
// Entram na foto pelo conteúdo.
const IGNORADOS = [".claude/settings.local.json", "CLAUDE.local.md", "mise.local.toml", ".mise.local.toml",
  ".config/mise.local.toml",
  ...["", ".config/"].flatMap((pasta) => ["", "."].flatMap((ponto) => ["yml", "yaml", "toml", "json", "jsonc"]
    .map((ext) => `${pasta}${ponto}lefthook-local.${ext}`)))];
const HORA = 3600 * 1000;
// Uma pasta por usuário onde o SO tem uid; no Windows, sem uid, o nome fixo (a pasta temporária já é do usuário)
const FOTOS = join(tmpdir(), typeof process.getuid === "function" ? `kit-vigia-${process.getuid()}` : "kit-vigia");
// Os comandos que mudam o critério de propósito (spec, seção 5): o começo, palavra a palavra; o resto, qualquer
const ISENCOES = ["git switch", "git merge", "git pull", "copier copy", "copier update", "just skills-update",
  "just github", "specify preset add", "pnpm dlx skills add", "pnpm exec playwright cli install"]
  .map((c) => c.split(" "));
const SEM_FOTO = "Não consegui conferir este comando contra o critério de pronto (sem a foto de antes); "
  + "a conferência do fim da fase cobre.";

const modo = process.argv[2];
if (modo !== "antes" && modo !== "depois" && modo !== "confere") throw new Error(`modo desconhecido: ${modo}`);
// O <base> do confere: um SHA ou um nome de referência, nunca uma opção do git nem um intervalo (`..`); depois dele, só
// o `--hash`. Conferido antes de qualquer git.
const [, , , base, ...resto] = process.argv;
if (modo === "confere" && (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(base ?? "") || base.includes("..")
  || resto.length > 1 || (resto.length === 1 && resto[0] !== "--hash"))) {
  sair("confere: base inválida (uso: confere <base> [--hash], com o <base> um SHA ou um nome de referência: letras, "
    + "dígitos, `.`, `_`, `/` e `-`, sem começar por `-` nem ter `..`).");
}
// O confere roda na sessão, sem entrada: a raiz sai do cwd do processo e do CLAUDE_PROJECT_DIR, como no hook
const input = modo === "confere" ? { cwd: process.cwd() } : JSON.parse(readFileSync(0, "utf8"));
if (modo === "confere") {
  // espera a escrita acabar: num pipe do macOS ela é assíncrona, e o exit cortaria a lista
  const lista = confere(base, resto.length === 1);
  await new Promise((fim) => process.stdout.write(lista, fim));
  process.exit(0);
}
// Sem o tool_use_id (o Claude Code sempre o manda), o sufixo fica vazio: o antes e o depois do mesmo comando se acham,
// e dois comandos sem id em paralelo dividiriam a foto.
const id = (valor) => String(valor ?? "").replace(/[^A-Za-z0-9_-]/g, "_");
const arquivoDaFoto = join(FOTOS, `${id(input.session_id)}-${id(input.tool_use_id)}.json`);
pastaDasFotos();
limparFotosVelhas();

if (modo === "antes") {
  const { raiz } = raizes();
  if (raiz !== undefined) {
    const foto = JSON.stringify({ raiz, ...retrato(raiz) });
    rmSync(arquivoDaFoto, { force: true }); // e grava com wx: nunca através de um link deixado no lugar
    writeFileSync(arquivoDaFoto, foto, { mode: 0o600, flag: "wx" });
  }
  process.exit(0);
}

let foto;
try {
  foto = JSON.parse(readFileSync(arquivoDaFoto, "utf8"));
  unlinkSync(arquivoDaFoto);
} catch (erro) {
  if (erro.code !== "ENOENT") throw erro;
}
const { raiz: raizAgora, projeto } = raizes();
if (foto === undefined && raizAgora === undefined) process.exit(0);
// Foto que falta, ou que não é deste repositório ou não bate com a lista do critério (adulterada): nada se desfaz
if (foto === undefined || !fotoValida(foto) || !raizValida(foto.raiz)) sair(SEM_FOTO);
const { raiz } = foto;
const agora = retrato(raiz);
const commits = foto.head === agora.head ? [] : doHeadNovo(raiz, foto.head, agora.head);
const mudou = [...new Set([...Object.keys(foto.arquivos), ...Object.keys(agora.arquivos), ...commits])]
  .filter((p) => {
    // limpo na foto (igual ao HEAD de antes): mudou se agora está sujo ou se um commit novo o mexeu
    if (!Object.hasOwn(foto.arquivos, p)) return true;
    const antes = foto.arquivos[p];
    if ((Object.hasOwn(agora.arquivos, p) ? agora.arquivos[p] : ler(raiz, p)) !== antes) return true;
    // o mesmo conteúdo na árvore, mas um commit novo (com o arquivo ainda sujo) gravou outro: o que foi para o histórico
    return commits.includes(p) && Object.hasOwn(agora.arquivos, p) && blob(raiz, agora.head, p) !== antes;
  })
  .sort();
if (mudou.length === 0) process.exit(0);

const papel = typeof input.agent_type === "string" ? input.agent_type : "";
const lista = mudou.join(", ");
if (papel !== "executor" && papel !== "revisor") {
  if (isento(input.tool_input?.command, papel)) process.exit(0);
  sair(`Você mudou ${lista} pelo terminal, e eles fazem parte do critério de pronto. `
    + "Mostre o diff ao humano e peça o sim antes de seguir; sem o sim, desfaça.");
}
const { naoApagados, naoDevolvidos } = devolver(raiz, mudou);
const devolvidos = mudou.filter((p) => !naoApagados.includes(p) && !naoDevolvidos.includes(p));
let mensagem = `Você mudou ${lista} pelo terminal, e eles fazem parte do critério de pronto`;
if (devolvidos.length === mudou.length) mensagem += ": voltaram ao que eram.";
else mensagem += devolvidos.length > 0 ? `; ${devolvidos.join(", ")} voltaram ao que eram.` : ".";
if (naoApagados.length > 0) {
  mensagem += ` Não apaguei ${naoApagados.join(", ")}: são pastas, e a devolução nunca apaga uma pasta.`;
}
if (naoDevolvidos.length > 0) mensagem += ` Não consegui devolver ${naoDevolvidos.join(", ")}: continuam mudados.`;
mensagem += " Pare e devolva a pergunta à sessão.";
if (mudou.some((p) => commits.includes(p))) {
  mensagem += ` O commit ${git(raiz, ["rev-parse", "--short", agora.head]).toString("utf8").trim()} já leva a mudança; `
    + "o histórico não foi reescrito, e a conferência do fim da fase barra.";
}
sair(mensagem);

// A única parte por texto da vigia, e estreita: só na sessão, e só o comando inteiro, sem nada que junte outro comando
// ou redirecione (`;`, `&`, `|`, quebra de linha, `$(`, crase, `<`, `>`; `&&` e `||` caem no `&` e no `|`), nem que
// o shell avalie dentro de um argumento (`(` e `{`, com `)` e `}`: os `(…)`, `@(…)`, `@{…}` e `$x.Metodo(…)` do
// PowerShell e a chave `{a,b}` do bash, o equivalente do `$(`). As palavras se separam por espaço ou tab; o
// `just setup` vale só sozinho, e o `git checkout` só com um argumento simples (letras, dígitos, `_` e `-`;
// começa por letra ou dígito) que não existe como caminho na raiz nem no cwd: um branch, nunca um caminho.
function isento(cmd, papel) {
  if (papel === "executor" || papel === "revisor" || typeof cmd !== "string" || /[;&|\n\r<>`(){}]/.test(cmd)) {
    return false;
  }
  const palavras = cmd.split(/[ \t]+/).filter(Boolean);
  const [a, b, c] = palavras;
  if (a === "just" && b === "setup") return palavras.length === 2;
  if (a === "git" && b === "checkout") {
    return palavras.length === 3 && /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(c)
      && [raiz, input.cwd].every((d) => typeof d !== "string" || lstatOuNada(join(d, c)) === undefined);
  }
  return ISENCOES.some((isencao) => isencao.every((p, i) => palavras[i] === p));
}

// A raiz vigiada. Com o CLAUDE_PROJECT_DIR num repositório: a raiz do cwd da entrada (que acompanha o Claude para
// dentro de um worktree, e de uma subpasta o git sobe) só se ela é do mesmo repositório (o mesmo git-common-dir: um
// worktree dele); de um repositório aninhado, sobe pasta a pasta até achar um do mesmo repositório; não achando, a do
// projeto. O cwd que falha (dentro do .git, inexistente, fora de um repositório) passa a vez ao projeto. Sem projeto
// num repositório, a do cwd (sem ele, a do diretório do processo). Fora de um repositório: undefined. Qualquer outra
// falha do git (sem permissão, dono diferente, configuração quebrada), em qualquer candidato, falha fechado.
function raizes() {
  const texto = (v) => (typeof v === "string" && v !== "" ? v : undefined);
  const dir = texto(process.env.CLAUDE_PROJECT_DIR);
  const cwd = texto(input.cwd);
  const projeto = dir === undefined ? undefined : repositorio(dir, true);
  if (projeto === undefined) {
    if (dir !== undefined && cwd === undefined) return { raiz: undefined, projeto };
    return { raiz: repositorio(cwd ?? process.cwd(), true)?.topo, projeto };
  }
  // De um repositório aninhado (no projeto ou num worktree dele), sobe uma pasta por vez até um do mesmo repositório.
  // Sobe pelo caminho, não pela raiz que o git devolve: com um core.worktree abaixo dela, ela nunca subiria.
  let doCwd = cwd === undefined ? undefined : repositorio(cwd, false);
  let pasta = doCwd?.topo;
  while (doCwd !== undefined && !mesmoCaminho(doCwd.comum, projeto.comum)) {
    const acima = dirname(pasta);
    if (acima === pasta) {
      doCwd = undefined;
      break;
    }
    pasta = acima;
    doCwd = repositorio(acima, false);
  }
  return { raiz: doCwd?.topo ?? projeto.topo, projeto };
}

// A raiz e o git-common-dir (absolutos) do repositório da pasta. Fora de um repositório: undefined. Antes do último
// candidato, também undefined (vale o próximo) para a pasta que não existe e para a de dentro do .git. Qualquer outra
// falha (sem permissão, dono diferente, configuração quebrada) sobe e falha fechado.
function repositorio(pasta, ultimo) {
  try {
    const [topo, comum] = git(pasta, ["rev-parse", "--path-format=absolute", "--show-toplevel", "--git-common-dir"])
      .toString("utf8").trim().split("\n").map((l) => l.trim());
    return { topo, comum };
  } catch (erro) {
    const disse = (re) => erro.status === 128 && re.test(String(erro.stderr));
    if (disse(/not a git repository/)) return undefined;
    if (!ultimo && (erro.code === "ENOENT" || disse(/must be run in a work tree/))) return undefined;
    throw erro;
  }
}

// A raiz da foto vale se é a raiz de um worktree do repositório do projeto; sem projeto num repositório, se é a raiz de
// agora
function raizValida(r) {
  if (typeof r !== "string" || r === "") return false;
  if (projeto === undefined) return raizAgora !== undefined && mesmoCaminho(r, raizAgora);
  if (mesmoCaminho(r, projeto.topo)) return true;
  const outro = repositorio(r, false);
  return outro !== undefined && mesmoCaminho(outro.topo, r) && mesmoCaminho(outro.comum, projeto.comum);
}

// O NTFS ignora a caixa, e o mesmo caminho pode chegar com caixas diferentes (do CLAUDE_PROJECT_DIR e do cwd)
function mesmoCaminho(a, b) {
  return process.platform === "win32" ? a.toLowerCase() === b.toLowerCase() : a === b;
}

// O HEAD (null num repositório sem commit) e o conteúdo, em base64, dos arquivos do critério que o git status mostra e
// dos IGNORADOS (null: não existe; "!<código>": uma pasta, como um repositório aninhado, ou um arquivo que não se lê).
// Só o que o git status lista: nunca a árvore inteira.
function retrato(pasta) {
  let head = null;
  try {
    head = git(pasta, ["rev-parse", "--verify", "-q", "HEAD"]).toString("utf8").trim();
  } catch (erro) {
    if (erro.status !== 1) throw erro;
  }
  const arquivos = {};
  for (const p of [...status(pasta).map((l) => l.slice(3)).filter(doCriterio), ...IGNORADOS]) {
    arquivos[p] = ler(pasta, p);
  }
  return { head, arquivos };
}

// As linhas do git status (`XY caminho`), com os novos um a um e sem renomeações
function status(pasta) {
  return git(pasta, ["status", "--porcelain=v1", "-z", "--untracked-files=all", "--no-renames"])
    .toString("utf8").split("\0").filter(Boolean);
}

// A rede do fim da fase (spec, seção 6): a lista, um por linha, em ordem e sem repetir, dos arquivos do critério que
// mudaram desde o commit <base> (no HEAD, na árvore, no índice, os novos e os IGNORADOS que existem e não estão iguais
// na base). Com o `hash`, cada linha leva antes, e dois espaços, o SHA-256 curto (12 hex) do conteúdo na árvore, do
// objeto no HEAD e do no índice; `-` se o arquivo não está em nenhum dos três; o marcador do `ler` (`!EISDIR`) para uma
// pasta ou um ilegível, que esconde o conteúdo e por isso sempre para a fase. O /implementar guarda a saída do começo
// da fase e para no fim se ela mudou. Não grava nada. Qualquer falha do git (um <base> que não é um commit, fora de um
// repositório), ou um caminho com caractere de controle (C0, DEL e C1: U+0000-001F e U+007F-009F), U+2028/2029 ou bytes
// que não são UTF-8 (forjariam ou esconderiam linhas), sai com 2: nunca uma lista vazia ou falsa.
function confere(base, hash) {
  const { raiz: pasta } = raizes();
  if (pasta === undefined) sair("confere: fora de um repositório git.");
  // o SHA do commit (um intervalo como `a..b` não é um commit e falha); daqui para a frente, só ele vai ao git
  const sha = git(pasta, ["rev-parse", "--verify", `${base}^{commit}`]).toString("utf8").trim();
  const nomes = (args) => git(pasta, args).toString("utf8").split("\0").filter(Boolean);
  const mudou = [
    ...nomes(["diff", "--name-only", "-z", "--no-renames", sha, "HEAD", "--"]),
    ...nomes(["diff", "--name-only", "-z", "--no-renames", sha, "--"]),
    ...nomes(["diff", "--cached", "--name-only", "-z", "--no-renames", sha, "--"]),
    ...status(pasta).filter((l) => l.startsWith("?? ")).map((l) => l.slice(3)),
  ].filter(doCriterio);
  for (const p of IGNORADOS) {
    const agora = ler(pasta, p);
    if (agora !== null && agora !== blob(pasta, sha, p)) mudou.push(p);
  }
  const lista = [...new Set(mudou)].sort();
  // quebra de linha, outro controle (o ESC reescreve o terminal), as quebras do Unicode, ou bytes que não são UTF-8
  // (viram U+FFFD, e a linha deixa de ser o caminho); pelo código, sem esses caracteres no fonte
  const ruim = (n) => n < 0x20 || (n >= 0x7f && n <= 0x9f) || [0x2028, 0x2029, 0xfffd].includes(n);
  const quebrados = lista.filter((p) => [...p].some((c) => ruim(c.codePointAt(0))));
  if (quebrados.length > 0) {
    sair(`confere: ${quebrados.length} caminho(s) do critério com quebra de linha, caractere de controle ou bytes que `
      + "não são UTF-8 no nome; a lista sairia falsa. Renomeie-os e confira de novo.");
  }
  if (!hash) return lista.map((p) => `${p}\n`).join("");
  // os objetos no HEAD e no índice, numa chamada só (`HEAD:<p>` e `:0:<p>`, com o estágio explícito: um caminho que
  // começa por `0:` a `3:` viraria a sintaxe do estágio; o que falta sai como "<entrada> missing")
  const objetos = git(pasta, ["cat-file", "--batch-check", "-Z"], lista.map((p) => `HEAD:${p}\0:0:${p}\0`).join(""))
    .toString("utf8").split("\0").map((s) => (s.endsWith(" missing") ? "-" : s.split(" ")[0]));
  return lista.map((p, i) => {
    const agora = ler(pasta, p);
    const [noHead, noIndice] = objetos.slice(2 * i, 2 * i + 2);
    let marca = agora;
    if (agora === null && noHead === "-" && noIndice === "-") marca = "-";
    else if (agora === null || !agora.startsWith("!")) {
      marca = createHash("sha256").update(agora === null ? "-" : `+${agora}`).update(`\0${noHead}\0${noIndice}`)
        .digest("hex").slice(0, 12);
    }
    return `${marca}  ${p}\n`;
  }).join("");
}

// A foto vale (a raiz, à parte, pela raizValida) com um HEAD em forma de SHA (ou nenhum) e só caminhos relativos, sem
// `..`, que a CRITERIO ou a lista dos ignorados aceitam, cada um com base64, um marcador ou null.
function fotoValida(f) {
  if (typeof f !== "object" || f === null) return false;
  if (f.head !== null && !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(String(f.head))) return false;
  if (typeof f.arquivos !== "object" || f.arquivos === null || Array.isArray(f.arquivos)) return false;
  return Object.entries(f.arquivos).every(([p, v]) => (doCriterio(p) || IGNORADOS.includes(p))
    && !isAbsolute(p) && !/^[A-Za-z]:/.test(p) && !p.split(/[\\/]/).includes("..")
    && (v === null || (typeof v === "string" && /^(?:[A-Za-z0-9+/]*={0,2}|![A-Z]+)$/.test(v))));
}

// Os arquivos do critério que mudaram entre os dois HEADs (sem um deles, todos os do outro)
function doHeadNovo(pasta, de, para) {
  const args = de && para ? ["diff", "--name-only", "-z", "--no-renames", de, para]
    : ["ls-tree", "-r", "-z", "--name-only", de || para];
  return git(pasta, args).toString("utf8").split("\0").filter(Boolean).filter(doCriterio);
}

// O Executor e o Revisor: o que estava sujo (ou é ignorado) volta pelos bytes da foto, ou some se não existia; o que
// estava limpo volta pelo git (árvore e índice, do HEAD de antes, não do índice, que um `git add` no mesmo comando já
// mudou), ou some (da árvore e do índice) se não existia nele. Tudo em lote: uma chamada ao git para cada passo.
// Nunca apaga uma pasta (um .gitignore mexido poria um worktree inteiro na lista): ela vai para os naoApagados. O que
// não tem bytes para voltar (um marcador na foto, ou uma pasta onde havia um arquivo) vai para os naoDevolvidos, como
// o que tem um pai (dentro da raiz) que é link ou junção: gravar ou apagar ali mexeria fora da raiz.
function devolver(pasta, todos) {
  const naoApagados = [];
  const naoDevolvidos = todos.filter((p) => paiLigado(pasta, p));
  const caminhos = todos.filter((p) => !naoDevolvidos.includes(p));
  const limpos = [];
  const apagar = (p) => {
    if (lstatOuNada(join(pasta, p))?.isDirectory()) naoApagados.push(p);
    else tirar(join(pasta, p)); // um arquivo, ou um link ou uma junção (só o link sai; o alvo fica)
  };
  for (const p of caminhos) {
    if (!Object.hasOwn(foto.arquivos, p)) {
      limpos.push(p);
      continue;
    }
    const conteudo = foto.arquivos[p];
    const destino = join(pasta, p);
    if (conteudo === null) {
      apagar(p);
    } else if (conteudo.startsWith("!") || lstatOuNada(destino)?.isDirectory()) {
      naoDevolvidos.push(p);
    } else {
      tirar(destino); // e grava com wx: nunca através de um link
      mkdirSync(dirname(destino), { recursive: true });
      writeFileSync(destino, Buffer.from(conteudo, "base64"), { flag: "wx" });
    }
  }
  if (limpos.length > 0) {
    const noHead = foto.head ? existemNoCommit(pasta, foto.head, limpos) : new Set();
    // o que agora é pasta não vai ao checkout, que a tiraria inteira: fica, como não devolvido
    const voltam = limpos.filter((p) => noHead.has(p) && !lstatOuNada(join(pasta, p))?.isDirectory());
    naoDevolvidos.push(...limpos.filter((p) => noHead.has(p) && !voltam.includes(p)));
    const somem = limpos.filter((p) => !noHead.has(p));
    if (somem.length > 0) {
      git(pasta, ["rm", "--cached", "-r", "-q", "--ignore-unmatch", "--pathspec-from-file=-", "--pathspec-file-nul"],
        somem.join("\0"));
      somem.forEach(apagar);
    }
    if (voltam.length > 0) {
      // um link ou uma junção no lugar do arquivo sai antes (só ele; o alvo fica): o checkout esvaziaria o alvo
      voltam.filter((p) => lstatOuNada(join(pasta, p))?.isSymbolicLink()).forEach((p) => tirar(join(pasta, p)));
      git(pasta, ["checkout", foto.head, "--pathspec-from-file=-", "--pathspec-file-nul"], voltam.join("\0"));
    }
  }
  return { naoApagados, naoDevolvidos };
}

// Tira um arquivo, ou só o link (o Node 24 recusa o rmSync numa junção, com ERR_FS_EISDIR; o unlink tira só ela)
function tirar(d) {
  if (lstatOuNada(d)?.isSymbolicLink()) unlinkSync(d);
  else rmSync(d, { force: true });
}

// Algum pai do caminho, da raiz para baixo, é link ou junção (o Node vê a junção como link)
function paiLigado(pasta, p) {
  const pais = p.split("/").slice(0, -1);
  return pais.some((_, i) => lstatOuNada(join(pasta, ...pais.slice(0, i + 1)))?.isSymbolicLink());
}

function lstatOuNada(caminho) {
  try {
    return lstatSync(caminho);
  } catch (erro) {
    if (erro.code === "ENOENT" || erro.code === "ENOTDIR") return undefined;
    throw erro;
  }
}

// Quais dos caminhos existem no commit, numa chamada só (`<commit>:<caminho>` que falta sai como "<entrada> missing")
function existemNoCommit(pasta, commit, caminhos) {
  const saida = git(pasta, ["cat-file", "--batch-check", "-Z"], caminhos.map((p) => `${commit}:${p}\0`).join(""))
    .toString("utf8").split("\0");
  return new Set(caminhos.filter((_, i) => !saida[i].endsWith(" missing")));
}

// O conteúdo do arquivo no commit, em base64; null se ele não existe lá
function blob(pasta, commit, p) {
  try {
    return git(pasta, ["cat-file", "blob", `${commit}:${p}`]).toString("base64");
  } catch (erro) {
    if (erro.status === 128) return null;
    throw erro;
  }
}

function ler(pasta, p) {
  try {
    return readFileSync(join(pasta, p)).toString("base64");
  } catch (erro) {
    if (erro.code === "ENOENT" || erro.code === "ENOTDIR") return null;
    // uma pasta (EISDIR), um arquivo preso (EBUSY) ou sem permissão (EACCES): um marcador estável
    if (/^[A-Z]+$/.test(String(erro.code))) return `!${erro.code}`;
    throw erro;
  }
}

// Os caminhos do git vêm com / e a partir da raiz; a regex compara em minúsculas, como no protect-files
function doCriterio(p) {
  return CRITERIO.test(p.toLowerCase());
}

// O git em inglês (o "not a git repository" é conferido pelo texto), com a entrada pelo stdin quando há
function git(pasta, args, entrada) {
  return execFileSync("git", ["--no-optional-locks", "--literal-pathspecs", "-c", `core.hooksPath=${devNull}`,
    "-c", "core.fsmonitor=false", ...args], {
    cwd: pasta, input: entrada, stdio: [entrada === undefined ? "ignore" : "pipe", "pipe", "pipe"],
    env: { ...process.env, LC_ALL: "C", LANGUAGE: "C" }, maxBuffer: 1 << 30,
  });
}

// A pasta das fotos: uma pasta de verdade (não um link), do próprio usuário (onde o SO tem dono por uid), só dele
function pastaDasFotos() {
  mkdirSync(FOTOS, { recursive: true, mode: 0o700 });
  const info = lstatSync(FOTOS);
  if (info.isSymbolicLink() || !info.isDirectory()) throw new Error("a pasta das fotos não é uma pasta");
  if (typeof process.getuid === "function" && info.uid !== process.getuid()) {
    throw new Error("a pasta das fotos é de outro usuário");
  }
  chmodSync(FOTOS, 0o700);
}

// Fotos com mais de 1 hora (de um depois que não rodou) saem; uma que outro processo apagou antes não importa
function limparFotosVelhas() {
  for (const nome of readdirSync(FOTOS)) {
    try {
      const caminho = join(FOTOS, nome);
      if (Date.now() - statSync(caminho).mtimeMs > HORA) unlinkSync(caminho);
    } catch {
      // apagada por outro processo, ou presa: fica para a próxima
    }
  }
}

function sair(mensagem) {
  process.stderr.write(`${mensagem}\n`);
  process.exit(2);
}
