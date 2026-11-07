// .claude/hooks/guard-shell.mjs - PreToolUse para Bash|PowerShell.
// Exit 2 bloqueia a chamada; o stderr volta para o Claude como motivo.
// Falha fechado: se não der para ler a entrada, ou se ela não trouxer o comando em forma de texto, bloqueia.
// ponytail: regex best-effort, sem parser de shell. Em modo auto, os comandos dos subagentes passam sem o humano ver
// cada um, então este hook, o deny, a CI e a main protegida são as barreiras reais.
// As regras do Executor e do Revisor vêm pelo agent_type da entrada (o name do frontmatter do subagente), no fim do arquivo.
// Falha fechado também numa exceção: sem isto, um erro não tratado (até um ReferenceError do módulo) sai com 1, e o
// Claude Code só bloqueia com 2. Os imports do ESM sobem antes de tudo, mas só os do node:, que não falham.
process.on("uncaughtException", () => {
  process.stderr.write("Bloqueado pelo hook: erro interno ao conferir o comando; peça ao humano.\n");
  process.exit(2);
});
import { readFileSync } from "node:fs";

let input;
try {
  input = JSON.parse(readFileSync(0, "utf8"));
} catch {
  // entrada ilegível: cai no bloqueio logo abaixo
}
const bruto = input?.tool_input?.command;
if (typeof bruto !== "string") {
  process.stderr.write("Bloqueado pelo hook: não consegui ler o comando. Tente de novo ou peça ao humano.");
  process.exit(2);
}
// O >| (redireção que ignora o noclobber) vira >: senão o corte em | abaixo separa o > do alvo, e o alvo vira o comando
// (`>|out git push` passaria como o comando `out`)
const cmd = bruto.replace(/(\d*)>\|/g, "$1>");
// Hook que estoura o tempo não bloqueia nada: um comando gigante nem chega às regras.
if (cmd.length > 20000) {
  process.stderr.write("Bloqueado pelo hook: comando longo demais para conferir (mais de 20 000 caracteres). "
    + "Para gravar um arquivo grande, use a ferramenta Write.");
  process.exit(2);
}

const PECA = " Se for mesmo necessário, peça ao humano.";
// sh, bash, zsh, dash; com caminho (/bin/sh), por env (/usr/bin/env bash) e com sudo e opções (sudo -E bash, sudo -u root bash)
const SH = String.raw`(?:sudo\s+(?:-\S+\s+(?:[^-\s]\S*\s+)?)*)?(?:(?:\/\S*\/)?env\s+)?(?:\/\S*\/)?(?:ba|z|da)?sh\b`;
// git ... <sub>, no mesmo comando. (?=(...))\1 faz papel de grupo atômico: fica com o primeiro <sub> e não tenta
// os outros. Sem isso, uma linha de 20 000 caracteres repetindo "git push" levava 30 s e o hook estourava o tempo.
const GIT = (sub) => String.raw`\bgit\b(?=([^\n;&|]*?\b${sub}\b))\1`;
// Aspa, parêntese ou ; colado no fim de um argumento (sh -c "git push origin main", (git ... -n))
// também conta como o fim dele: por isso os lookaheads abaixo aceitam [\s;&|"')].
const rules = [
  // comando que cita um arquivo .env real (.env, .env.local, config/.env ...), exceto .env.example
  [/(^|[^\w.])\.env(?:\.(?!example\b)[\w-]+)?(?![\w.-])/i,
   "Bloqueado pelo hook: comandos que citam arquivos .env. Peça ao humano o valor necessário."],
  // force push em qualquer ordem de flags: --force, --force-with-lease, -f, flags agrupadas (-fu), +refspec
  [new RegExp(GIT("push") + String.raw`[^\n;&|]*(\s--force(-with-lease)?\b|\s-[a-z]*f[a-z]*(?=[\s;&|"')]|$)|\s\+\S)`, "i"),
   "Bloqueado pelo hook: force push. Crie um branch novo ou peça ao humano."],
  // push na main ou master, inclusive HEAD:main e refs/heads/main
  [new RegExp(GIT("push") + String.raw`[^\n;&|]*(?:\s|:|["'])(?:refs\/heads\/)?(?:main|master)(?=$|[\s;&|"')])`, "i"),
   "Bloqueado pelo hook: push na main. Use um branch e abra um PR."],
  // pular os hooks do git (lefthook, gitleaks, mensagem de commit); o git aceita prefixo não ambíguo (--no-veri)
  [/--no-veri\w*/i, "Bloqueado pelo hook: --no-verify pula os hooks do git." + PECA],
  [new RegExp(GIT("commit") + String.raw`[^\n;&|]*\s-[a-z]*n[a-z]*(?=[\s;&|"')]|$)`, "i"),
   "Bloqueado pelo hook: commit -n pula os hooks do git." + PECA],
  [/LEFTHOOK['"]?\s*[=:]\s*['"]?(?:0|false)\b/i, "Bloqueado pelo hook: LEFTHOOK=0 desliga os hooks do git." + PECA],
  [/core\.hooksPath/i, "Bloqueado pelo hook: mudar o core.hooksPath desliga os hooks do git." + PECA],
  [/\bGIT_CONFIG_(?:COUNT|KEY_\d+|VALUE_\d+|PARAMETERS|GLOBAL|SYSTEM|NOSYSTEM)\b/,
   "Bloqueado pelo hook: variáveis GIT_CONFIG_* podem desligar os hooks do git." + PECA],
  [/\blefthook\s+uninstall\b/i, "Bloqueado pelo hook: lefthook uninstall desliga os hooks do git." + PECA],
  [/LEFTHOOK_EXCLUDE\b['"]?\s*[=:]/i, "Bloqueado pelo hook: LEFTHOOK_EXCLUDE desliga os hooks do git." + PECA],
  // ponytail: qualquer comando que cite .git/hooks, até um ls; o lefthook install grava lá sem passar por aqui
  [/\.git[\\/]+hooks\b/i, "Bloqueado pelo hook: mexer em .git/hooks desliga os hooks do git." + PECA],
  // opções do git que rodam um programa local: o git fetch, o git ls-remote e o git push passam sem pedir permissão
  // (uma regex por GIT: o \1 de dentro dele só vale para o primeiro grupo). O git aceita o prefixo não ambíguo de uma
  // opção longa, e a opção pode vir entre aspas ou, a curta, agrupada. Conferido no git 2.52: no fetch e no pull, --up é
  // ambíguo (--update-shallow) e --upl já é o --upload-pack; no ls-remote, --u é o --upload-pack e --exe, o --exec dele;
  // no push, --e é o --exec e --rece, o --receive-pack (--rec é ambíguo com --recurse-submodules).
  ...[/--(?:upload|receive)-pack\b/i,
    new RegExp(GIT("(?:fetch|pull)") + String.raw`[^\n;&|]*(?:\s|["'])--upl`, "i"),
    new RegExp(GIT("ls-remote") + String.raw`[^\n;&|]*(?:\s|["'])(?:--(?:u|exe)|-[a-z]*u)`, "i"),
    new RegExp(GIT("push") + String.raw`[^\n;&|]*(?:\s|["'])--(?:e|rece)`, "i")]
    .map((re) => [re, "Bloqueado pelo hook: esta opção do git roda um programa local." + PECA]),
  // O token do workflow semanal é o usuário quem gera e grava, no terminal dele (desenho, seção 8.6): o kit nunca vê nem
  // digita o token. O .env já tem a regra dele, no topo. Ficam passando gh secret list, gh secret delete e o GET do segredo.
  // Sem o PECA: não é para pedir ao humano que libere. Como a regra do .env, olham o texto inteiro: um rg "gh secret set"
  // ou uma mensagem de commit que cite o comando também param.
  // Os lookaheads olham o mesmo segmento (sem ; & | nem quebra de linha) em qualquer ordem. ponytail: sem a ordem
  // "secret antes de set", porque o [^…]* em sequência dá retrocesso cúbico (14 s numa linha de 20 000 caracteres).
  // gh secret set, com opção no meio (gh secret --repo o/r set X, gh -R o/r secret set X)
  ...[/\bgh\b(?=[^\n;&|]*\bsecret\b)(?=[^\n;&|]*\bset\b)/i,
    // gh api em /secrets/ com PUT: -X PUT, -XPUT, -X=PUT, -X "PUT", --method PUT, --method=PUT, --method "PUT".
    // O [\s=]* é uma classe só (dois \s* em volta de um =? retrocedem de forma quadrática numa corrida de espaços).
    /\bgh\b(?=[^\n;&|]*\bapi\b)(?=[^\n;&|]*\/secrets\/)(?=[^\n;&|]*(?:-X|--method)[\s=]*["']?PUT\b)/i,
    // rodado pela sessão, o token apareceria no transcript: claude.cmd, caminho entre aspas, flag antes, npx
    /\bclaude\b[^\n;&|]*\bsetup-token\b/i]
    .map((re) => [re, "Bloqueado pelo hook: gravar segredo do GitHub é com você, no seu terminal (o kit nunca vê nem digita o token)."]),
  // baixar e executar na mesma linha
  [new RegExp(String.raw`\b(?:curl|wget)\b[^\n]*\|\s*` + SH, "i"),
   "Bloqueado pelo hook: baixar e executar na mesma linha." + PECA],
  [/\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod)\b[^\n]*\|\s*(?:iex|Invoke-Expression)\b/i,
   "Bloqueado pelo hook: baixar e executar na mesma linha." + PECA],
  [/\b(?:iex|Invoke-Expression)\b[^\n;|]*\b(?:iwr|irm|Invoke-WebRequest|Invoke-RestMethod|New-Object\s+(?:System\.)?Net\.WebClient)\b/i,
   "Bloqueado pelo hook: baixar e executar na mesma linha." + PECA],
  // sh -c "$(curl ...)", bash <(curl ...), eval "$(curl ...)", source <(curl ...), . <(curl ...): o shell executa
  // o que o curl baixou. O ponto só conta no começo de um comando, não como parte de caminho (. ./env.sh passa).
  [/(?:\b(?:(?:ba|z|da)?sh|eval|source)\b|(?:^|[\n;&|(])\s*\.\s)[^\n]*(?:\$\(|<\(|`)\s*(?:curl|wget)\b/i,
   "Bloqueado pelo hook: baixar e executar na mesma linha." + PECA],
  // comando disfarçado
  [/\$\{IFS\}|\$IFS\b/, "Bloqueado pelo hook: comando disfarçado com IFS." + PECA],
  // o (?=(...))\1 é o mesmo grupo atômico do GIT
  [new RegExp(String.raw`\bbase64\b(?=([^\n|]*?\s(?:-d|--decode|-D)\b))\1[^\n]*\|\s*` + SH, "i"),
   "Bloqueado pelo hook: base64 decodificado direto no shell." + PECA],
  [/\b(?:powershell|pwsh)(?:\.exe)?\b[^\n]*\s-(?:e|ec|enc|encodedcommand)\s+[A-Za-z0-9+/=]{16,}/i,
   "Bloqueado pelo hook: comando PowerShell codificado." + PECA],
  // apagar dados
  [/\b(?:DROP\s+(?:TABLE|DATABASE|SCHEMA)|TRUNCATE\s+(?:TABLE\s+)?["`\w])/i,
   "Bloqueado pelo hook: DROP e TRUNCATE apagam dados." + PECA],
  // git switch que joga fora mudanças ou um branch: --discard-changes (a partir de --di), --force e --force-create, -f,
  // -C e as curtas agrupadas com f ou C. Sem a flag i (-c cria um branch). Conferido no git 2.52: --d, --f, --fo, --for e
  // --forc são ambíguos. O -c e o -C levam o valor colado (-cf cria o branch f): por isso só -d, -m, -q, -t e -f vêm antes.
  [new RegExp(GIT("switch") + String.raw`[^\n;&|]*(?:\s|["'])(?:--(?:di|force)|-[dmqtf]*[fC])`),
   "Bloqueado pelo hook: este git switch descarta as mudanças ou recria um branch." + PECA],
];

// Descartar as mudanças do diretório inteiro (git checkout ., git restore .). O git restore --staged (-S) só tira
// do índice, a menos que venha com --worktree (-W). Contam só as opções antes do --, e sem a flag i: -s é --source.
const DESCARTA = new RegExp(GIT("(?:checkout|restore)") + String.raw`[^\n;&|]*?\s(?:--\s+)?\.\/?(?=$|[\s;&|"')])`, "i");
const soIndice = (seg) => {
  const opcoes = seg.split(/\s--(?=\s|$)/)[0];
  return /\s(?:--staged|-S)(?=[\s"')]|$)/.test(opcoes) && !/\s(?:--worktree|-W)(?=[\s"')]|$)/.test(opcoes);
};

// Instalar pacote global pelo npm, pnpm, yarn ou bun (-g, --global, yarn global add): a ferramenta do projeto vem pelo
// mise ou pelo package.json. Ler o que há de global (npm ls -g) e instalar no projeto passam. Três testes simples por
// segmento, em vez de uma regex só: o custo é linear, e uma linha de 20 000 caracteres não estoura o tempo do hook.
const GESTOR = /\b(?:npm|pnpm|bun)\b/i;
const INSTALA = /\s(?:install|i|add)\b/i;
const GLOBAL = /\s(?:-[a-z]*g[a-z]*|--global|--location[= ]global)(?=[\s"')]|$)/i; // -g, -gD, --global, --location=global
const instalaGlobal = (seg) => /\byarn\b.*\sglobal\s+add\b/i.test(seg) || (GESTOR.test(seg) && INSTALA.test(seg) && GLOBAL.test(seg));

// Pastas geradas que podem ser apagadas sem perguntar, só por caminho relativo sem .. (dist, ./dist, pacote/dist):
// /tmp, ../build, ~/build, $HOME/tmp e C:\x\out ficam de fora.
const SEGURAS = new Set(["dist", "build", "out", "node_modules", "coverage", ".venv", "__pycache__",
  ".pytest_cache", ".ruff_cache", ".mypy_cache", ".codegraph", "tmp", ".tmp"]);
const segura = (alvo) => !/^(?:[\\/~$%]|[a-z]:)/i.test(alvo) && !alvo.split(/[\\/]/).includes("..")
  && SEGURAS.has(alvo.split(/[\\/]/).pop());
const APAGAR = /^(?:rm|Remove-Item|ri|rmdir|rd|del|erase)$/i;
const RECURSIVO = (f) => /^--recursive$/i.test(f) || /^-r(?:e(?:c(?:u(?:r(?:s(?:e)?)?)?)?)?)?$/i.test(f)
  || (/^-[a-zA-Z]{1,4}$/.test(f) && /[rR]/.test(f)) || /^\/s$/i.test(f);

// Apagar recursivo fora das pastas geradas. Segmentos separados por ; && || | e quebra de linha.
function apagaForaDasSeguras(texto) {
  for (const seg of texto.split(/;|&&|\|\||\||\n/)) {
    // aspas e parênteses também separam palavras (sh -c "rm -rf x", (rm -rf x)); a vírgula, listas do PowerShell
    const palavras = seg.split(/[\s"'()`,]+/).filter(Boolean);
    const i = palavras.findIndex((p) => APAGAR.test(p));
    if (i < 0) continue;
    const args = palavras.slice(i + 1);
    // git rm --cached só tira do índice; sem --cached, apaga do disco também
    if (/^git$/i.test(palavras[i - 1] ?? "") && args.includes("--cached")) continue;
    if (!args.some(RECURSIVO)) continue;
    // não são alvos: opções, o valor do -ErrorAction (-EA) e, nos comandos do cmd (rd /s /q dist), o /s e o /q
    const cmdExe = /^(?:rd|rmdir|del|erase)$/i.test(palavras[i]);
    const alvos = args.filter((a, k) => !a.startsWith("-") && !/^-(?:ErrorAction|EA)$/i.test(args[k - 1] ?? "")
        && !(cmdExe && /^\/[sq]$/i.test(a)))
      .map((a) => a.replace(/[\\/]+\*$/, "").replace(/[\\/]+$/, "")); // dist/* e dist/ contam como dist
    if (alvos.length === 0 || !alvos.every(segura)) return true;
  }
  return false;
}

for (const [re, msg] of rules) {
  if (re.test(cmd)) {
    process.stderr.write(msg);
    process.exit(2);
  }
}
const segmentos = cmd.split(/[\n;&|]/);
if (segmentos.some((seg) => DESCARTA.test(seg) && !soIndice(seg))) {
  process.stderr.write("Bloqueado pelo hook: descarta as mudanças do diretório inteiro." + PECA);
  process.exit(2);
}
if (segmentos.some(instalaGlobal)) {
  process.stderr.write("Bloqueado pelo hook: instalação global de pacote. "
    + "As ferramentas do projeto vêm pelo mise ou pelo package.json." + PECA);
  process.exit(2);
}
if (apagaForaDasSeguras(cmd)) {
  process.stderr.write("Bloqueado pelo hook: apagar pasta recursivamente fora de dist, build, node_modules e similares." + PECA);
  process.exit(2);
}


// O Executor e o Revisor, pelo agent_type exato (o name do frontmatter do subagente, sem mudar a caixa). Qualquer outro
// valor, como Explore ou Executor com maiúscula, ou a falta dele, é a sessão, e as regras de todos, acima, são as dela.
// As regras daqui olham o comando, e não o texto inteiro: a primeira palavra de cada pedaço da linha, cortada em quebra de
// linha, ; & | ( ) { } crase e aspas. Assim uma mensagem de commit que cita curl ou git push passa, e sh -c "git push" bloqueia.
// As chaves cortam por causa dos blocos do PowerShell (try { ... }, ForEach-Object { ... }, & { ... }) e dos grupos { ...; }.
// O comando vale pelo nome-base (/usr/bin/curl, curl.exe e CURL são curl), sem os prefixos sudo, NOME=valor e, no
// PowerShell, a atribuição ($r = Invoke-RestMethod ..., que é o jeito comum de usar o cmdlet).
// Cada pedaço é lido uma vez: o custo é linear, e uma linha de 20 000 caracteres não estoura o tempo do hook.
// ponytail: não desembrulha xargs, find -exec nem watch, e um comando disfarçado de outro jeito escapa. O corte
// nas aspas pega sh -c "git push", mas também bloqueia um trecho entre aspas que começa por um comando vigiado (rg "git push",
// uma mensagem de commit que começa por "git push"). Se doer: cortar nas aspas só depois de um sh -c, bash -c ou pwsh -c.
// Os prefixos que rodam o comando seguinte (sudo, env, exec, command, nohup, time, o ! e as palavras do if e dos laços),
// com as opções de cada um que levam o valor na palavra seguinte. O mise exec ... -- fica no comando(), abaixo. Também
// os wrappers que o Claude Code tira antes de casar o comando com as regras de permissão (timeout, time, nice, nohup,
// stdbuf, command, builtin, noglob e xargs, https://code.claude.com/docs/en/permissions, "Wrappers"): sem tirá-los,
// `timeout 60 git push` casaria o `git push *` do allow e passaria por aqui. E o `.` (o dot-source do PowerShell).
const PREFIXOS = new Map([
  ["sudo", new Set(["-u", "-g", "-h", "-p", "-C", "-r", "-t", "-T", "-U", "-D", "-R"])],
  ["env", new Set(["-u", "--unset", "-C", "--chdir", "-S", "--split-string"])],
  ["exec", new Set(["-a"])],
  ["timeout", new Set(["-s", "--signal", "-k", "--kill-after"])],
  ["nice", new Set(["-n", "--adjustment"])],
  ["stdbuf", new Set(["-i", "-o", "-e", "--input", "--output", "--error"])],
  ["xargs", new Set(["-a", "--arg-file", "-d", "--delimiter", "-E", "-e", "-I", "-i", "-L", "-l", "-n", "--max-args",
    "-P", "--max-procs", "-s", "--max-chars"])],
  ...["command", "builtin", "noglob", "nohup", "time", ".", "!", "then", "do", "else", "elif"]
    .map((nome) => [nome, new Set()]),
]);
// Os que levam palavras a mais depois das opções: a duração do timeout
const POSICIONAIS = new Map([ ["timeout", 1] ]); // com espaço: dois colchetes juntos são o delimitador do Copier
// A redireção no começo do pedaço (</dev/null, 2>/dev/null, >out.txt, <<<x, < arquivo): o alvo, quando vem na palavra
// seguinte, também sai
const REDIRECAO = /^\d*(?:<<<|<<-?|<>|>>|[<>])&?/;
// Opções do git antes do subcomando que levam o valor na palavra seguinte; as outras (--no-pager, --opção=x, -P) são uma só.
const GIT_COM_VALOR = new Set(["-C", "-c", "--git-dir", "--work-tree", "--namespace", "--super-prefix", "--config-env", "--attr-source"]);
// O que muda o repositório ou o checkout. O objetivo é evitar acidente (um checkout no meio da fase tira a sessão do
// branch); contra um Revisor malicioso, que tem o terminal, não há o que fazer por um hook.
const GIT_DO_REVISOR = ["add", "am", "apply", "bisect", "branch", "checkout", "cherry-pick", "clean", "commit", "config", "fetch",
  "merge", "mv", "pull", "push", "rebase", "reset", "restore", "revert", "rm", "stash", "switch", "tag", "worktree"];
const REDE = new Set(["curl", "wget", "invoke-webrequest", "invoke-restmethod", "iwr", "irm", "certutil", "bitsadmin", "start-bitstransfer"]);
// Os comandos que imprimem uma variável, e o Get-ChildItem com os apelidos dele (a unidade env: do PowerShell)
const ECOA = new Set(["echo", "printf", "printenv", "write-output", "write-host"]);
const LISTA_PS = new Set(["get-childitem", "gci", "ls", "dir"]);
const SEGREDO = /token|key|secret|password|auth|credential/i;
// $NOME, ${NOME} e %NOME%; e, no PowerShell, $env:NOME, ${env:NOME} e env:NOME (grupo 1: vazio ou com curinga é a lista toda).
// A alternativa do env: vem primeiro, senão o $NOME comeria o $env.
const REFERENCIA = /(?<!\w)\$?\{?env:[\\/]?([\w*?]*)|\$\{?(\w+)|%(\w+)%/gi;

// A atribuição do PowerShell no começo do pedaço: $r = ..., [string]$r = ..., [int[]]$r = ..., $script:r += ...,
// $r ??= ..., $env:X = ... e a encadeada $a = $b = ... (âncora no começo; cada volta do grupo consome um $nome e um =,
// que nenhuma outra parte casa: custo linear). O \x5B é o colchete que abre o tipo: escrito com barra e colchete, ele
// ficaria colado ao colchete do grupo seguinte, e dois colchetes abrindo em seguida são o delimitador do modelo do Copier
// (o teste test_nada_do_modelo_sobra varre todo texto gerado).
const ATRIBUICAO_PS = /^(?:(?:\x5B[\w.]+(?:\x5B\])?\]\s*)*\$[\w:]+\s*(?:\?\?|[-+*/%])?=(?!=)\s*)+/;

// O nome sem a pasta, sem caixa, sem a extensão de executável do Windows (.exe, .cmd, .bat, .ps1, .com) e sem o `!`
// colado na frente (!just); o `!` sozinho continua sendo o prefixo
const nomeBase = (palavra) => (palavra ?? "").split(/[\\/]/).pop().toLowerCase().replace(/\.(?:exe|cmd|bat|ps1|com)$/, "")
  .replace(/^!+(?=.)/, "");

// O comando do pedaço: o nome-base da primeira palavra, sem os PREFIXOS (e as opções deles), NOME=valor, a redireção e
// a atribuição do PowerShell. Um prefixo sem comando depois dele é o próprio comando: env e env FOO=1 listam o ambiente.
// O `xargs` marca o comando: os argumentos dele vêm da entrada, e as regras não os veem.
function comando(texto) {
  const p = texto.trim().replace(ATRIBUICAO_PS, "").split(/\s+/);
  let i = 0;
  let xargs = false;
  for (;;) {
    if (/^\w+=/.test(p[i] ?? "")) {
      i++;
      continue;
    }
    if (REDIRECAO.test(p[i] ?? "")) {
      i += p[i].replace(REDIRECAO, "") === "" ? 2 : 1;
      continue;
    }
    // o resto de um 2>&1 ou de um 1>&- cortado no &: o número do descritor ou o - que o fecha
    if (/^(?:\d+|-)$/.test(p[i] ?? "") && i + 1 < p.length) {
      i++;
      continue;
    }
    // mise exec [ferramentas e opções] -- comando (e o apelido mise x)
    const traco = nomeBase(p[i]) === "mise" && /^(?:exec|x)$/.test(p[i + 1] ?? "") ? p.indexOf("--", i + 2) : -1;
    if (traco >= 0 && traco + 1 < p.length) {
      i = traco + 1;
      continue;
    }
    const comValor = PREFIXOS.get(nomeBase(p[i]));
    if (!comValor) break;
    let j = i + 1;
    while (p[j]?.startsWith("-") || /^\w+=/.test(p[j] ?? "")) j += comValor.has(p[j]) ? 2 : 1;
    j += POSICIONAIS.get(nomeBase(p[i])) ?? 0;
    if (j >= p.length) break;
    xargs ||= nomeBase(p[i]) === "xargs";
    i = j;
  }
  return { nome: nomeBase(p[i]), args: p.slice(i + 1), xargs };
}

// O subcomando do git é a palavra depois do git e das opções globais dele, inteira: merge-base não é merge.
function subcomandoGit(args) {
  for (let i = 0; i < args.length; i++) {
    if (!args[i].startsWith("-")) return args[i].toLowerCase();
    if (GIT_COM_VALOR.has(args[i])) i++;
  }
  return "";
}

const doGit = (c, ...subs) => c.nome === "git" && subs.includes(subcomandoGit(c.args));
const doGh = (c, ...palavras) => c.nome === "gh" && palavras.every((p, i) => c.args[i]?.toLowerCase() === p);
// O merge pelo gh api: merge ou merges como palavra inteira (o .merged de uma leitura não conta), mergePullRequest ou o
// auto-merge do GraphQL (enablePullRequestAutoMerge), que mescla sozinho quando a CI passa.
const mergePeloApi = (texto) => doGh(comando(texto), "api") && /\bmerges?\b|mergePullRequest|PullRequestAutoMerge/i.test(texto);

// Segredo do ambiente, por segmento: o comando decide se é listagem ou leitura, e as referências contam em qualquer lugar
// dele, inclusive entre aspas (echo "${DB_PASSWORD}"). Aspas não cortam o segmento aqui: um echo "env" não lista nada.
function listaOuLeSegredo(seg) {
  const antes = seg.split(/\d?[<>]/)[0]; // o que vem depois de um > ou < não é argumento
  // A variável sozinha, como comando ($env:GITHUB_TOKEN, "$NPM_TOKEN"): o PowerShell imprime o valor, e o bash o mostra
  // no erro de comando não encontrado. A atribuição ($t = $env:X) não imprime nada.
  const sozinha = /^["'(]?\$\{?(?:env:)?(\w+)/i.exec(antes.trim());
  if (sozinha && SEGREDO.test(sozinha[1]) && !ATRIBUICAO_PS.test(antes.trim())) return true;
  const { nome, args } = comando(antes);
  const nomes = args.filter((a) => !a.startsWith("-") && !/^\w+=/.test(a)); // env FOO=1 também lista tudo
  // O comando() só devolve env quando nenhum comando vem depois dele (env -u HOME, env -C /tmp): lista tudo
  if (nome === "env" || (nome === "printenv" && nomes.length === 0)) return true;
  if (nome === "set" && args.length === 0) return true;
  if (nome === "printenv" && nomes.some((n) => SEGREDO.test(n))) return true;
  if (!ECOA.has(nome) && !LISTA_PS.has(nome)) return false;
  for (const [, doEnv, simples, percentual] of seg.matchAll(REFERENCIA)) {
    if (doEnv !== undefined) {
      if (LISTA_PS.has(nome) && /^$|[*?]/.test(doEnv)) return true; // Get-ChildItem env: ou env:*X*
      if (SEGREDO.test(doEnv)) return true;
    } else if (ECOA.has(nome) && SEGREDO.test(simples ?? percentual)) {
      return true;
    }
  }
  return false;
}

// O just na frente da receita, para todos os papéis, como defesa em profundidade: o settings.json só libera cada receita
// pelo nome, mas um allow mais largo (do usuário ou do settings.local.json) voltaria a liberar tudo. Uma opção, variável
// ou receita em forma de caminho antes da receita roda outro comando ou desliga a validação do justfile. No just 1.58:
// --command/-c, --shell, --justfile/-f, --dotenv-path/-E, --working-directory/-d, --set VAR x e VAR=valor; e uma
// receita `./x` ou `dir/x` faz o just procurar o justfile a partir daquela pasta (o nome sem distinguir caixa). Por
// isso, antes da receita, só passam as opções que só leem; a primeira palavra depois delas tem de ser um nome de receita
// (`::` é o separador de módulo), e com --list ou --summary nada depois dela é opção. Depois da receita, tudo é argumento
// dela (o justfile confere). O comando é lido em várias visões: cortado em ( ) { } crase e aspas (sh -c "just ...",
// $(just ...)); sem as aspas (& 'just' ..., & "C:\x\just.exe" ..., ju''st); sem as aspas e cortado só em ; & | e
// quebra de linha (just {...}, just (...), just `...); e, também, sem a barra e a crase de escape (ju\st, ju`st). O just
// vale pelo nome-base e pelos lançadores (uv run, uvx, pnpm exec, npx, cmd /c, Start-Process).
// Também bloqueia a variável de ambiente posta na mesma linha do just (VAR=x just, env ... just, $env:X =, export,
// Set-Item env:, SetEnvironmentVariable, set X=), e, na linha do just, do pytest ou do vitest, qualquer menção a
// JUST_*, PYTEST_ADDOPTS, PYTEST_PLUGINS e NODE_OPTIONS, que o just, o pytest e o node leem do ambiente.
// ponytail: como no Executor, um texto entre aspas que começa por "just -" também bloqueia.
const JUST_SO_LE = new Set(["--list", "-l", "--summary", "--version", "--help", "-h", "--dry-run", "-n"]);
const RECEITA = /^[A-Za-z_][\w-]*(?:::[\w-]+)*$/;
const LANCADORES = new Set(["uv", "uvx", "pnpm", "npx", "bunx", "pipx", "cmd", "start-process", "saps", "start"]);
// ponytail: num lançador, vale o que vem depois da primeira palavra `just` (uv run pytest -k just passa: nada depois)
function argsDoJust({ nome, args }) {
  if (nome === "just") return args;
  if (!LANCADORES.has(nome)) return null;
  const i = args.findIndex((a) => nomeBase(a) === "just");
  return i >= 0 ? args.slice(i + 1) : null;
}
function justComOpcaoNaFrente(args) {
  let soLe = false;
  for (const [i, a] of args.entries()) {
    if (a.startsWith("-") || a.includes("=")) {
      if (!JUST_SO_LE.has(a)) return true;
      soLe ||= a !== "--dry-run" && a !== "-n";
      continue;
    }
    if (!RECEITA.test(a)) return true;
    return soLe && args.slice(i + 1).some((x) => x.startsWith("-") || x.includes("="));
  }
  return false;
}
// Um prefixo de ambiente no próprio comando do just: VAR=x just ... ou env ... just ...
function ambienteNaFrente(pedaco) {
  const palavras = pedaco.trim().split(/\s+/);
  const i = palavras.findIndex((x) => nomeBase(x) === "just");
  return i > 0 && palavras.slice(0, i).some((x) => /^\w+=/.test(x) || nomeBase(x) === "env");
}
const DEFINE_AMBIENTE = /\$\{?env:\w+\}?\s*[-+]?=|\bexport\s+\w|\bset-item\b[^\n;|]*\benv:|\bnew-item\b[^\n;|]*\benv:|\bSetEnvironmentVariable\b|(?:^|[\s;&|(])set\s+"?\w+=|\bsetx\b/i;
const LIDA_DO_AMBIENTE = /\bJUST_\w+|\bPYTEST_(?:ADDOPTS|PLUGINS)\b|\bNODE_OPTIONS\b/i;
// O heredoc que grava um arquivo e cita o just (ou o PYTEST_ADDOPTS) também bloqueia: o hook lê o texto inteiro, sem
// separar o corpo do heredoc (a exceção abria contornos; achado 5 do ensaio do Plano 6). A mensagem aponta o Write.
const USE_O_WRITE = "Se o just veio de um heredoc que grava arquivo, use o Write ou o Edit.";
const semAspas = cmd.replace(/["']/g, "");
const semEscape = semAspas.replace(/[\\`]/g, "");
const pedacosDoJust = [
  ...cmd.split(/[\n;&|(){}`"']/), ...semAspas.split(/[\n;&|(){}`]/), ...semAspas.split(/[\n;&|]/),
  ...semEscape.split(/[\n;&|(){}]/), ...semEscape.split(/[\n;&|]/)];
const doJust = pedacosDoJust.map((pedaco) => {
  const c = comando(pedaco);
  return { pedaco, xargs: c.xargs, args: argsDoJust(c) };
}).filter((c) => c.args);
// pelo xargs, os argumentos do just vêm da entrada (echo ./github x | xargs just), e não há como conferi-los
if (doJust.some((c) => c.xargs || justComOpcaoNaFrente(c.args))) {
  process.stderr.write("Bloqueado pelo hook: opção, variável ou caminho na frente da receita do just podem rodar outro "
    + "comando (--command, --shell, --justfile, --set, VAR=valor, ./receita). Rode a receita pelo nome, sem elas; só "
    + "--list, --summary, --version, --help e --dry-run passam. " + USE_O_WRITE + PECA);
  process.exit(2);
}
if ((doJust.length && (doJust.some((c) => ambienteNaFrente(c.pedaco)) || DEFINE_AMBIENTE.test(cmd)))
  || (LIDA_DO_AMBIENTE.test(cmd) && (doJust.length || /\b(?:pytest|vitest)\b/i.test(cmd)))) {
  process.stderr.write("Bloqueado pelo hook: variável de ambiente na linha do just ou dos testes (JUST_*, "
    + "PYTEST_ADDOPTS, NODE_OPTIONS...) muda o justfile, as opções ou o que roda. Rode o comando sem ela. " + USE_O_WRITE
    + PECA);
  process.exit(2);
}

const papel = typeof input.agent_type === "string" ? input.agent_type : "";
if (papel === "executor" || papel === "revisor") {
  const pedacos = cmd.split(/[\n;&|(){}`"']/);
  // Com cada trecho entre aspas trocado por uma palavra só, o valor de uma opção entre aspas fica inteiro:
  // git -C "pasta com espaço" push.
  const compactos = cmd.replace(/"[^"]*"|'[^']*'/g, "Q").split(/[\n;&|(){}`]/);
  const comandos = [...pedacos, ...compactos].map(comando);
  // Os segmentos de novo, com as quebras de linha de dentro das aspas e de um heredoc juntadas (a consulta do GraphQL em
  // várias linhas, também em gh api graphql -f query=@- <<'EOF'). O heredoc acaba na linha que só tem o marcador, ou no
  // fim do comando; o que vem depois dela é outro segmento.
  const emUmaLinha = cmd
    .replace(/<<-?\s*(["']?)(\w+)\1([^\n]*)\n([\s\S]*?)(?:\n\s*\2\s*(?=\n|$)|$)/g,
      (_, _aspa, _marca, resto, corpo) => `${resto} ${corpo.replaceAll("\n", " ")}`)
    .replace(/"[^"]*"|'[^']*'/g, (trecho) => trecho.replaceAll("\n", " "))
    .split(/[\n;&|]/);
  const regras = [
    // gh pr new é o apelido de gh pr create; pelo xargs, o git sem subcomando e o gh sem os dois primeiros argumentos
    // (echo push origin | xargs git) recebem o resto da entrada, e não há como conferir
    [() => comandos.some((c) => doGit(c, "push") || doGh(c, "pr", "create") || doGh(c, "pr", "new")
      || (c.xargs && ((c.nome === "git" && !subcomandoGit(c.args)) || (c.nome === "gh" && c.args.length < 2)))),
      "Bloqueado pelo hook: o Executor e o Revisor não fazem push nem abrem PR. A sessão faz isso, com o sim do humano."],
    [() => comandos.some((c) => c.nome === "just" && c.args.find((a) => !a.startsWith("-")) === "github"),
      "Bloqueado pelo hook: o just github cria o repositório e faz o push da main: é da sessão, com o sim do humano."],
    // A consulta do GraphQL vem entre aspas: o gh api também é conferido no segmento inteiro, sem o corte nas aspas.
    [() => comandos.some((c) => doGh(c, "pr", "merge")) || [...pedacos, ...segmentos, ...emUmaLinha].some(mergePeloApi),
      "Bloqueado pelo hook: o merge é sempre do humano."],
    [() => papel === "revisor" && comandos.some((c) => doGit(c, ...GIT_DO_REVISOR) || doGh(c, "pr", "checkout")),
      "Bloqueado pelo hook: o Revisor só lê, e este comando muda o repositório. Use git log, git show ou git diff."],
    [() => comandos.some((c) => REDE.has(c.nome)) || /Net\.WebClient/i.test(cmd),
      "Bloqueado pelo hook: saída de rede pelo terminal no Executor e no Revisor. "
      + "Os gerenciadores de pacote passam; para ler uma página, use o WebFetch."],
    [() => segmentos.some(listaOuLeSegredo),
      "Bloqueado pelo hook: listar variáveis de ambiente com nome de segredo."],
  ];
  const negada = regras.find(([nega]) => nega());
  if (negada) {
    process.stderr.write(negada[1] + PECA);
    process.exit(2);
  }
}
