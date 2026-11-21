#!/usr/bin/env node
// Ajudante da `just skills-update` (desenho, seção 9): traz para .claude/skills/ as cópias das skills da comunidade que
// vêm do GitHub, na versão mais nova. Para cada repositório da tabela, acha a versão, faz um clone raso e esparso num
// diretório temporário e, só depois de o clone dar certo, troca as cópias. Cada cópia leva o LICENSE do repositório
// (quando a pasta não traz um) e um ORIGEM.json com o repositório, a versão, o commit e a árvore da pasta.
// Um repositório que falha não apaga nada dele: o stderr o cita, os outros seguem e o código de saída é 1. Também falha
// o que traz link simbólico ou submódulo na pasta de uma skill (ou no LICENSE da raiz que ela usa).
// Roda na raiz do projeto, sem argumentos. KIT_SKILLS_GIT_BASE troca a base https://github.com/ (os testes do kit usam
// repositórios locais em file:///).
import { execFileSync } from "node:child_process";
import { copyFileSync, cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";

// ref: o branch, ou null para a maior tag vX.Y.Z sem sufixo (a última release). Uma skill com camada vai para
// <nome>/upstream/: a camada, <nome>/SKILL.md, é do kit e o ajudante não a toca. path "" traz o repositório inteiro
// (menos o .git e o excluded): é um plugin, que o Claude Code carrega de .claude/skills/<dest>/ pelo
// .claude-plugin/plugin.json. plugin troca o name desse plugin.json: um plugin de mesmo nome instalado na máquina
// (o ponytail@ponytail, por exemplo) tem a preferência e impediria a cópia de carregar.
const TABELA = [
  { repo: "obra/superpowers", ref: null, path: "skills/brainstorming", dest: "brainstorming/upstream" },
  { repo: "obra/superpowers", ref: null, path: "skills/systematic-debugging", dest: "systematic-debugging/upstream" },
  { repo: "obra/superpowers", ref: null, path: "skills/test-driven-development", dest: "test-driven-development" },
  { repo: "mattpocock/skills", ref: "main", path: "skills/engineering/domain-modeling", dest: "domain-modeling" },
  { repo: "mattpocock/skills", ref: "main", path: "skills/engineering/pr", dest: "pr" },
  { repo: "tt-a1i/archify", ref: null, path: "archify", dest: "archify", excluded: ["test"] },
  { repo: "DietrichGebert/ponytail", ref: null, path: "", dest: "ponytail", plugin: "ponytail-kit",
    excluded: ["assets", "benchmarks", "examples", "tests"] },
];

const BASE = process.env.KIT_SKILLS_GIT_BASE || "https://github.com/";
const SKILLS = join(".claude", "skills");

// Todo git roda sem esperar ninguém e sem confiar no upstream antes da análise: sem pergunta de credencial nem janela de
// login (o helper de credencial do sistema fica de fora) nem askpass (`credential.interactive=never`, git 2.46 ou mais
// novo; versões antigas ignoram a chave), sem baixar LFS (um .lfsconfig do upstream apontaria outro host), com link
// simbólico em checkout como arquivo comum e com tempo limite, para a rede parada não prender a receita.
// E mantém os fins de linha do repositório em todo comando, também no checkout esparso, que é um segundo processo: o
// core.autocrlf=true do Git for Windows trocaria LF por CRLF.
const LIMITE_MS = 120_000;
function git(...args) {
  const config = ["-c", "core.autocrlf=false", "-c", "core.symlinks=false", "-c", "credential.helper=",
    "-c", "credential.interactive=never"];
  try {
    return execFileSync("git", [...config, ...args], {
      encoding: "utf8",
      env: { ...process.env, GIT_TERMINAL_PROMPT: "0", GCM_INTERACTIVE: "never", GIT_LFS_SKIP_SMUDGE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
      timeout: LIMITE_MS,
    }).trim();
  } catch (erro) {
    if (erro.code === "ETIMEDOUT") throw new Error(`git ${args.join(" ")} passou de ${LIMITE_MS / 1000} s sem terminar`);
    throw erro;
  }
}

// A maior tag vX.Y.Z, comparada número a número (v6.10.0 vem depois de v6.4.2); tag com sufixo (beta) não conta
function ultimaTag(url) {
  const tags = git("ls-remote", "--tags", "--refs", url)
    .split("\n")
    .map((linha) => /refs\/tags\/(v(\d+)\.(\d+)\.(\d+))$/.exec(linha))
    .filter(Boolean)
    .sort((a, b) => a[2] - b[2] || a[3] - b[3] || a[4] - b[4]);
  if (!tags.length) throw new Error("nenhuma tag vX.Y.Z");
  return tags.at(-1)[1];
}

// A description do frontmatter de um SKILL.md, sem as aspas do YAML
function descricao(arquivo) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(arquivo, "utf8"))?.[1] ?? "";
  return /^description:[ \t]*(.*?)[ \t]*$/m.exec(frontmatter)?.[1].replace(/^(["'])(.*)\1$/, "$2");
}

const temporario = mkdtempSync(join(tmpdir(), "skills-update-"));
try {
  for (const [n, repo] of [...new Set(TABELA.map((linha) => linha.repo))].entries()) {
    const linhas = TABELA.filter((linha) => linha.repo === repo);
    const url = BASE + repo;
    try {
      const ref = linhas[0].ref ?? ultimaTag(url);
      const clone = join(temporario, String(n));
      git("clone", "--quiet", "--depth", "1", "--filter=blob:none", "--sparse", "--branch", ref, url, clone);
      if (linhas.some((linha) => linha.path === "")) git("-C", clone, "sparse-checkout", "disable"); // o repositório inteiro
      else git("-C", clone, "sparse-checkout", "set", ...linhas.map((linha) => linha.path)); // cone: traz a raiz (LICENSE)
      const commit = git("-C", clone, "rev-parse", "HEAD");
      // Confere tudo antes de apagar qualquer cópia: uma pasta que mudou de lugar no upstream não leva a cópia antiga
      const copias = linhas.map((linha) => {
        const origem = join(clone, linha.path);
        const marca = linha.path === "" ? join(".claude-plugin", "plugin.json") : "SKILL.md";
        if (!existsSync(join(origem, marca))) throw new Error(`${linha.path || "."}/${marca} não existe em ${ref}`);
        const licenca = existsSync(join(origem, "LICENSE")) ? null : join(clone, "LICENSE");
        if (licenca && !existsSync(licenca)) throw new Error(`sem LICENSE em ${linha.path} nem na raiz`);
        return { ...linha, origem, licenca, tree: git("-C", clone, "rev-parse", `HEAD:${linha.path}`) };
      });
      // Link simbólico (120000) ou submódulo (160000) faria a cópia ler ou escrever fora do projeto antes da análise de
      // segurança: o modo vem da árvore do git, não do disco
      const usados = [...linhas.map((linha) => linha.path || "."), ...(copias.some((c) => c.licenca) ? ["LICENSE"] : [])];
      const especial = git("-C", clone, "ls-tree", "-r", "-z", "HEAD", "--", ...usados)
        .split("\0")
        .find((entrada) => /^(120000|160000) /.test(entrada));
      if (especial) throw new Error(`link simbólico ou submódulo não entra: ${especial.split("\t")[1]}`);
      for (const c of copias) {
        const destino = join(SKILLS, c.dest);
        const fora = c.excluded ?? [];
        rmSync(destino, { recursive: true, force: true });
        cpSync(c.origem, destino, {
          recursive: true,
          filter: (f) => ![".git", ...fora].includes(relative(c.origem, f).split(sep)[0]),
        });
        if (c.licenca) copyFileSync(c.licenca, join(destino, "LICENSE"));
        if (c.plugin) {
          // O name novo, e os comandos que os hooks chamam pelo name antigo (`ponytail:ponytail-review`, por exemplo)
          // passam a chamar pelo novo: sem isso, os botões da barra do ponytail não acham as skills
          const manifesto = join(destino, ".claude-plugin", "plugin.json");
          const json = JSON.parse(readFileSync(manifesto, "utf8"));
          // E o dono do estado do band ($.state): o atom e o PluginState também passam para o name novo, ou o motor
          // recusa a gravação ("only a value's owner writes it") e o band não aparece
          const trocas = [
            [new RegExp(`\\b${json.name}:(?=${json.name})`, "g"), `${c.plugin}:`],
            [new RegExp(`(\\bplugin: )(['"])${json.name}\\2`, "g"), `$1$2${c.plugin}$2`],
            [new RegExp(`(interface PluginState \\{\\s*)${json.name}:`, "g"), `$1'${c.plugin}':`],
          ];
          writeFileSync(manifesto, `${JSON.stringify({ ...json, name: c.plugin }, null, 2)}\n`);
          for (const arquivo of readdirSync(join(destino, "hooks"), { recursive: true })) {
            const caminho = join(destino, "hooks", arquivo);
            if (!statSync(caminho).isFile()) continue;
            const texto = readFileSync(caminho, "utf8");
            const novo = trocas.reduce((t, [de, para]) => t.replace(de, para), texto);
            if (novo !== texto) writeFileSync(caminho, novo);
          }
        }
        const registro = { repo: url, ref, commit, path: c.path, tree: c.tree };
        if (c.excluded) registro.excluded = c.excluded;
        if (c.plugin) registro.plugin = c.plugin;
        writeFileSync(join(destino, "ORIGEM.json"), `${JSON.stringify(registro, null, 2)}\n`);
        // A camada repete a description do upstream, para o Claude escolher a skill do mesmo jeito; sem a camada
        // ainda, não há o que comparar
        const nome = c.dest.split("/")[0];
        const camada = join(SKILLS, nome, "SKILL.md");
        if (c.dest.endsWith("/upstream") && existsSync(camada) && descricao(camada) !== descricao(join(destino, "SKILL.md"))) {
          console.log(`aviso: a descrição do ${nome} mudou no upstream; confira a camada .claude/skills/${nome}/SKILL.md`);
        }
      }
      console.log(`${repo} ${ref} (${commit.slice(0, 7)})`);
    } catch (erro) {
      console.error(`skills-update: ${repo} falhou: ${(erro.stderr || erro.message).trim()}`);
      process.exitCode = 1;
    }
  }
} finally {
  rmSync(temporario, { recursive: true, force: true });
}
