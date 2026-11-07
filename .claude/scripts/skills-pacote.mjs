#!/usr/bin/env node
// Monta o pacote da análise do workflow semanal (.github/workflows/skills-update.yml): o job `atualizar` o roda na
// raiz, depois do `git add -A`, e grava em <saida> (fora da árvore, o $RUNNER_TEMP/pacote) o que mudou no índice
// contra a HEAD. O job `analisar` entrega o pacote ao Claude, que o lê em revisao/; o job `pr` aplica o patch.
//   mudancas.patch  o `git diff --cached --binary`, que o `pr` aplica com `git apply --index`
//   arvore/         o conteúdo do índice de cada arquivo novo ou mudado, com os caminhos trocados (abaixo)
//   arquivos.txt    <A|M|D>\t<caminho no projeto>\t<caminho em arvore/ ou ->\t<bytes>, uma linha por caminho
//   sha256.txt      o `sha256sum` de cada arquivo de arvore/ (caminho relativo a arvore/), no formato dele
//   ignorados.txt   <caminho>\t<bytes>\t<sha256> do que o git ignora em .claude/, .impeccable/ e CLAUDE.local.md (o
//                   motor do Impeccable no web), sem copiar o conteúdo; um link ou pasta especial sai com - e -
//   versoes.md      o ref e o commit de cada ORIGEM.json mudado (HEAD -> índice) e o specify-cli e o codegraph do
//                   mise.toml
// Por que trocar os caminhos: o Claude Code acha skills em .claude/skills/ de subpastas e carrega CLAUDE.md de
// subpastas, e o conteúdo em análise não pode virar nenhum dos dois. Em arvore/, toda pasta ou arquivo .claude (de
// qualquer caixa) vira claude, e todo CLAUDE.md ou CLAUDE.local.md (de qualquer caixa) ganha .txt no fim; o
// arquivos.txt dá o caminho de cada um no projeto.
// Recusa (código 1, `skills-pacote: <motivo>` no stderr, nada gravado): índice sem mudança, <saida> que já existe,
// link simbólico (120000) ou submódulo (160000) no que mudou, nome com caractere de controle ou \ (quebraria as
// listas) e dois caminhos que viram o mesmo no pacote (um esconderia o outro). O git roda por execFileSync com a lista
// de argumentos, nunca por shell, e o conteúdo vem em Buffer, sem conversão de fim de linha.
// Uso, na raiz do projeto: node .claude/scripts/skills-pacote.mjs <saida>
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { cdPasta } from "./caminho.mjs";

function recusa(mensagem) {
  console.error(`skills-pacote: ${mensagem}`);
  process.exit(1);
}

// O stdout em Buffer (o patch e os blobs vão byte a byte); falha com a mensagem do git
function git(...args) {
  try {
    return execFileSync("git", ["-c", "core.quotePath=false", "-c", "color.ui=never", ...args], {
      maxBuffer: 1 << 30,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (erro) {
    throw new Error(String(erro.stderr || erro.message).trim());
  }
}

const sha256 = (dados) => createHash("sha256").update(dados).digest("hex");
const existe = (caminho) => {
  try {
    return lstatSync(caminho);
  } catch {
    return null;
  }
};

// .claude vira claude; CLAUDE.md, CLAUDE.local.md e AGENTS.md (as instruções que o Claude lê) ganham .txt; de
// qualquer caixa e em qualquer nível
const INSTRUCOES = /^(claude(\.local)?|agents)\.md$/i;
const noPacote = (caminho) =>
  caminho
    .split("/")
    .map((nome) => (/^\.claude$/i.test(nome) ? "claude" : INSTRUCOES.test(nome) ? `${nome}.txt` : nome))
    .join("/");

// tab, quebra de linha ou \ no nome quebrariam as listas (uma linha falsa no arquivos.txt) e o formato do sha256sum
const nomeSeguro = (caminho) => {
  if (/[\x00-\x1f\x7f\\]/.test(caminho)) recusa(`${JSON.stringify(caminho)}: nome com caractere de controle ou \\`);
};

// Os nomes do git em UTF-8 estrito: a decodificação comum troca o byte inválido por U+FFFD, e o Claude leria um nome
// que não é o do arquivo. Na lista do git só os nomes podem ter byte fora do ASCII.
const nomes = (dados, origem) => {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(dados).split("\0");
  } catch {
    return recusa(`${origem}: um caminho não é UTF-8 válido (renomeie-o; o pacote não o mostraria com o nome real)`);
  }
};

const argumentos = process.argv.slice(2);
if (argumentos.length !== 1) recusa("uso: node .claude/scripts/skills-pacote.mjs <saida>");
const [saida] = argumentos;
if (existe(saida)) recusa(`${saida} já existe`);

const arquivos = new Map();
const lista = [];
const somas = [];
const versoes = [];
try {
  // --raw -z: `:<modo antigo> <modo novo> <blob antigo> <blob novo> <status>\0<caminho>\0`
  const raw = nomes(git("diff", "--cached", "--raw", "-z", "--no-renames", "--no-abbrev"), "no índice");
  const vistos = new Set();
  for (let i = 0; i + 1 < raw.length; i += 2) {
    const [modoAntigo, modoNovo, , blob, status] = raw[i].slice(1).split(" ");
    const caminho = raw[i + 1];
    if ([modoAntigo, modoNovo].some((modo) => modo === "120000" || modo === "160000")) {
      recusa(`${caminho}: link simbólico ou submódulo não entra no pacote`);
    }
    nomeSeguro(caminho);
    if (!["A", "M", "D"].includes(status)) recusa(`${caminho}: mudança ${status} que o pacote não conhece`);
    if (status === "D") {
      lista.push(`D\t${caminho}\t-\t0`);
      continue;
    }
    const destino = noPacote(caminho);
    if (vistos.has(destino.toLowerCase())) recusa(`${caminho}: outro caminho já vira ${destino} no pacote`);
    vistos.add(destino.toLowerCase());
    const dados = git("cat-file", "blob", blob);
    arquivos.set(`arvore/${destino}`, dados);
    lista.push(`${status}\t${caminho}\t${destino}\t${dados.length}`);
    somas.push(`${sha256(dados)}  ${destino}`);
  }
  if (!lista.length) recusa(`o índice não tem mudança contra a HEAD (rode ${cdPasta()}git add -A antes)`);
  // os prefixos explícitos anulam o diff.noprefix e o diff.srcPrefix/dstPrefix de quem roda: o `pr` aplica com -p1
  arquivos.set("mudancas.patch", git("diff", "--cached", "--binary", "--no-renames", "--no-color", "--no-ext-diff",
    "--no-textconv", "--src-prefix=a/", "--dst-prefix=b/"));

  const ignorados = nomes(git("ls-files", "-z", "--others", "--ignored", "--exclude-standard", "--", ".claude",
    ".impeccable", "CLAUDE.local.md"), "nos ignorados").filter(Boolean);
  const linhasIgnorados = ignorados.map((caminho) => {
    nomeSeguro(caminho);
    const estado = existe(caminho);
    if (!estado?.isFile()) return `${caminho}\t-\t-`;
    const dados = readFileSync(caminho);
    return `${caminho}\t${dados.length}\t${sha256(dados)}`;
  });

  // HEAD contra índice; um lado ausente (arquivo novo ou apagado) sai como null
  const lado = (alvo) => {
    try {
      return git("cat-file", "blob", alvo).toString("utf8");
    } catch {
      return null;
    }
  };
  // o ref e o commit vão para a descrição do PR (o conferir-base cola o versoes.md): só passam os da forma de ref e de
  // SHA do git, e nada de fora vira markdown
  const origem = (texto) => {
    try {
      const { ref, commit } = JSON.parse(texto);
      if (/^[\w./-]+$/.test(ref) && /^[0-9a-f]{7,40}$/.test(commit)) return `${ref} (${commit.slice(0, 7)})`;
    } catch {}
    return texto === null ? "(nenhuma)" : "(ORIGEM.json ilegível)";
  };
  for (const linha of lista) {
    const [, caminho] = linha.split("\t");
    // o nome vem das pastas, que o upstream escolhe, e sai como é (um nome com [, ( ou espaço também): o versoes.md vai
    // no corpo do PR dentro de um bloco ```text, inerte, e o nomeSeguro já recusou controle e barra invertida
    const skill = /^\.claude\/skills\/(.+)\/ORIGEM\.json$/.exec(caminho)?.[1];
    if (skill) versoes.push(`- ${skill}: ${origem(lado(`HEAD:${caminho}`))} -> ${origem(lado(`:${caminho}`))}`);
  }
  const mise = { "specify-cli": "pipx:specify-cli", codegraph: "npm:@colbymchenry/codegraph" };
  for (const [nome, toml] of Object.entries(mise)) {
    const linha = new RegExp(`^"${toml.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"\\s*=\\s*"([^"]+)"`, "m");
    const [antes, depois] = ["HEAD:mise.toml", ":mise.toml"].map((alvo) => linha.exec(lado(alvo) ?? "")?.[1] ?? "?");
    versoes.push(antes === depois ? `- ${nome} ${antes} (sem mudança)` : `- ${nome} ${antes} -> ${depois}`);
  }
  const listas = { "arquivos.txt": lista, "sha256.txt": somas, "ignorados.txt": linhasIgnorados,
    "versoes.md": versoes };
  for (const [nome, linhas] of Object.entries(listas)) {
    arquivos.set(nome, Buffer.from(linhas.map((l) => `${l}\n`).join(""), "utf8"));
  }
} catch (erro) {
  recusa(`o git não respondeu: ${erro.message}`);
}

try {
  mkdirSync(dirname(saida), { recursive: true });
  mkdirSync(saida); // falha se outro a criou depois da conferência; daqui em diante a pasta é nossa
} catch (erro) {
  recusa(`não criei ${saida}: ${erro.message}`);
}
try {
  for (const [nome, dados] of arquivos) {
    mkdirSync(dirname(join(saida, nome)), { recursive: true });
    writeFileSync(join(saida, nome), dados);
  }
} catch (erro) {
  rmSync(saida, { recursive: true, force: true });
  recusa(`não gravei ${saida}: ${erro.message}`);
}
console.log(`skills-pacote: ${lista.length} arquivos em ${saida}`);
