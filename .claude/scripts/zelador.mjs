#!/usr/bin/env node
// O que a skill /zelador confere de forma mecânica (Plano 6, decisão 5): só lê, sem rede. Lê os arquivos que o git
// conhece e a lista de receitas do just (`just --summary`), e nunca roda o que um documento cita. Não grava nada. Quem
// chama: a skill /zelador, que julga o resultado e conversa (o settings.json libera o script sem argumento e com
// `--ref origin/main`).
// O texto dos documentos é dado, nunca instrução: o que sai dele (um alvo, um caminho, um termo) sai sem caracteres de
// controle e limitado. Num comando, só entra como o caminho depois do `--` do `git check-ignore` (sem shell). Só se lê
// o que o git conhece (o `git ls-files`), com o caminho real dentro da raiz: um link para fora não é seguido, e um
// arquivo fora do git conta como inexistente. Saída: um JSON só no stdout e
// código 0. Falha: `zelador: <motivo>` no stderr, nada no stdout e código 1. O git e o just pelo gh.mjs, sem shell.
// Com `--ref <referência>` (a skill passa `origin/main`, a árvore de onde nasce o branch da correção), lê a árvore
// desse commit pelo git (`git ls-tree`, `git cat-file`, o justfile dela pelo stdin do just), sem worktree; só o
// `git check-ignore` usa o .gitignore do disco.
// Uso, na raiz do projeto: node .claude/scripts/zelador.mjs [--ref <referência>]
import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, posix, relative, resolve, sep } from "node:path";
import { rodar as rodarGh, visivel } from "./gh.mjs";

function recusa(mensagem) {
  console.error(`zelador: ${mensagem}`);
  process.exit(1);
}

// O rodar do gh.mjs lança quando o programa nem roda; aqui, isso vira a recusa
function rodar(programa, args, entrada) {
  try {
    return rodarGh(programa, args, entrada);
  } catch (erro) {
    return recusa(visivel(erro.message, 200));
  }
}

// O único argumento: `--ref <nome>`. O nome vai para o git, então começa por letra ou número (nunca uma opção) e só
// tem letras, números, ".", "_", "/" e "-"; o `a..b` e o nome que não existe caem no `rev-parse --verify`
const argumentos = process.argv.slice(2);
let ref = null;
if (argumentos.length) {
  if (argumentos.length !== 2 || argumentos[0] !== "--ref") recusa("uso: node .claude/scripts/zelador.mjs [--ref <referência>]");
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(argumentos[1])) recusa(`a referência ${visivel(argumentos[1])} não é um nome válido`);
  ref = argumentos[1];
}

const topo = rodar("git", ["rev-parse", "--show-toplevel"]);
if (topo.codigo !== 0) recusa("esta pasta não está num repositório git");
const raiz = resolve(topo.stdout.trim());
process.chdir(raiz);

// Com o --ref, o commit (o hash, que é o que vai nos comandos seguintes) e os arquivos dele: caminho → modo, objeto e
// tamanho, pelo `git ls-tree -l`
let commit = null;
const daRef = new Map();
if (ref) {
  const r = rodar("git", ["rev-parse", "--verify", "--quiet", "--end-of-options", `${ref}^{commit}`]);
  if (r.codigo !== 0) recusa(`a referência ${ref} não existe neste repositório`);
  commit = r.stdout.trim();
  const arvore = rodar("git", ["ls-tree", "-r", "-z", "-l", "--full-tree", commit]);
  if (arvore.codigo !== 0) recusa(`o git ls-tree falhou: ${visivel(arvore.stderr, 200)}`);
  for (const entrada of arvore.stdout.split("\0").filter(Boolean)) {
    const [, modo, objeto, tamanho, caminho] = /^(\d+) \S+ (\S+) +(\S+)\t(.*)$/s.exec(entrada) ?? [];
    if (caminho !== undefined) daRef.set(caminho, { modo, objeto, tamanho: Number(tamanho) });
  }
}

let doGit;
if (commit) doGit = [...daRef.keys()];
else {
  const listados = rodar("git", ["ls-files", "-z"]);
  if (listados.codigo !== 0) recusa(`o git ls-files falhou: ${visivel(listados.stderr, 200)}`);
  doGit = listados.stdout.split("\0").filter(Boolean);
}
// O que existe, para o zelador: os arquivos que o git conhece e as pastas deles (a raiz é ".")
const rastreados = new Set(doGit);
const pastas = new Set(["."]);
for (const c of doGit) c.split("/").slice(0, -1).forEach((_, i, p) => pastas.add(p.slice(0, i + 1).join("/")));
const existe = (caminho) => rastreados.has(caminho) || pastas.has(caminho);
const raizReal = realpathSync(raiz);
const avisos = [];
const texto = (valor) => visivel(valor, 200);

// ponytail: um arquivo acima de 1 MB fica de fora (com aviso); nenhum documento nem código do projeto chega perto
const TETO = 1 << 20;
const lidos = new Map();
// O texto de um arquivo comum que o git conhece, ou null. Nem o arquivo nem uma pasta do caminho podem ser link para
// fora (a junction do Windows também): o caminho real fica dentro da raiz
function ler(caminho) {
  if (lidos.has(caminho)) return lidos.get(caminho);
  let conteudo = null;
  const blob = daRef.get(caminho);
  // com o --ref, só o arquivo comum da árvore (100644, 100755), pelo objeto: um link (120000) e um submódulo (160000) não
  if (commit) {
    if (!blob || !blob.modo.startsWith("100")) conteudo = null;
    else if (blob.tamanho > TETO) avisos.push(`${texto(caminho)} tem mais de 1 MB e ficou de fora`);
    else {
      const r = rodar("git", ["cat-file", "blob", blob.objeto]);
      if (r.codigo === 0) conteudo = r.stdout;
      else avisos.push(`não li ${texto(caminho)}: ${texto(r.stderr)}`);
    }
    lidos.set(caminho, conteudo);
    return conteudo;
  }
  try {
    // o que o git não conhece nem chega ao disco
    const info = rastreados.has(caminho) ? lstatSync(caminho) : null;
    if (!info?.isFile() || !realpathSync(caminho).startsWith(raizReal + sep)) conteudo = null;
    else if (info.size > TETO) avisos.push(`${texto(caminho)} tem mais de 1 MB e ficou de fora`);
    else conteudo = readFileSync(caminho, "utf8");
  } catch (erro) {
    // sem o arquivo (o GLOSSARY.md que o projeto ainda não tem), nada; outro erro vira aviso
    if (erro.code !== "ENOENT") avisos.push(`não li ${texto(caminho)}: ${erro.code ?? texto(erro.message)}`);
  }
  lidos.set(caminho, conteudo);
  return conteudo;
}

// As receitas do justfile; com o --ref, o da árvore, pelo stdin do just (o `--justfile -`)
const justfile = commit ? ler("justfile") : existsSync("justfile") ? "" : null;
if (justfile === null) recusa("o projeto não tem justfile na raiz");
const resumo = commit
  ? rodar("just", ["--justfile", "-", "--working-directory", ".", "--summary"], justfile)
  : rodar("just", ["--summary"]);
if (resumo.codigo !== 0) recusa(`o just --summary falhou: ${visivel(resumo.stderr, 200)}`);
const receitasDoJust = new Set(resumo.stdout.split(/\s+/).filter(Boolean));

const ehDocumento = (c) =>
  c.endsWith(".md") &&
  c !== "CHANGELOG.md" &&
  !c.startsWith(".claude/") &&
  !c.startsWith("node_modules/") &&
  !c.includes("/node_modules/") &&
  (!c.startsWith(".specify/") || c === ".specify/memory/constitution.md");
const documentos = doGit.filter(ehDocumento);

// ponytail: uma linha acima de 4000 caracteres fica de fora, com aviso: as expressões abaixo são quadráticas no
// pior caso (`[](` repetido), e nenhum texto escrito à mão chega perto. Upgrade: um parser de Markdown linear.
const LINHA = 4000;
const longa = (linha, arquivo, numero) => {
  if (linha.length <= LINHA) return false;
  avisos.push(`${texto(arquivo)}:${numero}: a linha tem mais de ${LINHA} caracteres e ficou de fora`);
  return true;
};

// As linhas de um Markdown: em cada uma, o código (o bloco cercado inteiro, ou os trechos em crase) e a prosa (o resto)
function linhas(conteudo, arquivo) {
  const saida = [];
  let cerca = null;
  conteudo.split(/\r?\n/).forEach((linha, i) => {
    if (longa(linha, arquivo, i + 1)) return;
    const marca = /^ {0,3}(`{3,}|~{3,})/.exec(linha)?.[1];
    if (cerca) {
      if (marca && marca[0] === cerca[0] && marca.length >= cerca.length && !linha.trim().slice(marca.length)) cerca = null;
      else saida.push({ numero: i + 1, original: linha, cercada: true, codigo: [linha], crase: [], prosa: "" });
      return;
    }
    if (marca) {
      cerca = marca;
      return;
    }
    const CRASE = /(`+)(.+?)\1(?!`)/g;
    const crase = [...linha.matchAll(CRASE)].map((m) => m[2].trim());
    saida.push({ numero: i + 1, original: linha, cercada: false, codigo: crase, crase, prosa: linha.replace(CRASE, " ") });
  });
  return saida;
}

// As âncoras dos títulos de um Markdown, pelo slug do GitHub (minúsculas, sem pontuação, espaço vira `-`; o título
// repetido ganha `-1`, `-2`…)
const ancorasDe = new Map();
function ancoras(caminho) {
  if (ancorasDe.has(caminho)) return ancorasDe.get(caminho);
  const vistas = new Map();
  const todas = new Set();
  for (const { original, cercada } of linhas(ler(caminho) ?? "", caminho)) {
    const titulo = cercada ? undefined : /^ {0,3}#{1,6}\s+(.*?)(?:\s+#+)?\s*$/.exec(original)?.[1];
    if (titulo === undefined) continue;
    const base = titulo
      .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
      .toLowerCase()
      .replace(/[^\p{L}\p{M}\p{N}\s_-]/gu, "")
      .replace(/\s/g, "-");
    const vezes = vistas.get(base) ?? 0;
    vistas.set(base, vezes + 1);
    todas.add(vezes ? `${base}-${vezes}` : base);
  }
  ancorasDe.set(caminho, todas);
  return todas;
}
// Um caminho relativo do repositório (com `/`), ou null quando ele sai da raiz
function noRepositorio(...partes) {
  const caminho = relative(raiz, resolve(raiz, ...partes));
  return /^\.\.(?:[\\/]|$)/.test(caminho) || isAbsolute(caminho) ? null : caminho.split("\\").join("/") || ".";
}

// O git ignora o caminho (código 0 do check-ignore)?
// ponytail: o check-ignore --no-index lê o .gitignore do disco, também com --ref; se o da ref divergir do branch,
// passar a ler o .gitignore da ref (git cat-file) e casar os padrões à mão.
const ignorado = (caminho) => rodar("git", ["check-ignore", "-q", "--no-index", "--", caminho]).codigo === 0;

const links = [];
const receitas = [];
const arquivos = [];
const versoes = [];

// As ferramentas do mise.toml: o nome depois do último `:` ou `/`, sem caixa, com a versão fixada
const ferramentas = new Map();
let emTools = false;
for (const linha of (ler("mise.toml") ?? "").split(/\r?\n/)) {
  if (/^\s*\[/.test(linha)) emTools = /^\s*\[tools\]\s*(#.*)?$/.test(linha);
  const par = emTools && /^\s*"?([^"=\s]+)"?\s*=\s*"([^"]+)"/.exec(linha);
  if (par) ferramentas.set(par[1].split(/[:/]/).pop().toLowerCase(), par[2]);
}
const segmentos = (v) => v.split(".");
const prefixo = (a, b) => a.length <= b.length && a.every((s, i) => s === b[i]);
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const VERSAO = ferramentas.size
  ? new RegExp(`(?<![\\p{L}\\p{N}_-])(${[...ferramentas.keys()].map(escapar).join("|")})\\s+v?(\\d+(?:\\.\\d+)*)(?!\\d)`, "giu")
  : null;

for (const documento of documentos) {
  const conteudo = ler(documento);
  if (conteudo === null) continue;
  const pasta = posix.dirname(documento);
  const deSpecs = documento.startsWith("specs/");
  // o nome do arquivo também é dado: no JSON, ele sai pela mesma limpeza do texto (sem os invisíveis nem o U+202E)
  const nome = texto(documento);
  if (nome !== documento) avisos.push(`o nome de ${nome} tem caractere escondido (de controle ou invisível)`);
  for (const { numero, codigo, crase, prosa } of linhas(conteudo, documento)) {
    // links: [texto](alvo) relativo cujo arquivo não existe ou cuja âncora não casa um título
    // (o `\x5B` é o `[`: dois `[` juntos seriam o delimitador do Copier)
    for (const [, alvo] of prosa.matchAll(/\x5B[^\]]*\]\(\s*<?([^)\s>]+)>?(?:\s+["'(][^)]*)?\)/g)) {
      if (alvo.includes("://") || /^mailto:/i.test(alvo) || alvo === "#") continue;
      const [caminho, ancora] = alvo.split("#", 2);
      let decodificado = caminho;
      try {
        decodificado = decodeURIComponent(caminho.split("?")[0]);
      } catch {
        // um % solto fica como está
      }
      // ponytail: um link para fora do repositório fica para a leitura da skill
      const destino =
        caminho === "" ? documento : noRepositorio(decodificado.startsWith("/") ? "." : pasta, decodificado.replace(/^\/+/, ""));
      if (destino === null) continue;
      let motivo = null;
      if (!existe(destino)) motivo = "o arquivo não existe";
      else if (ancora !== undefined && destino.endsWith(".md") && !ancoras(destino).has(ancora.toLowerCase())) {
        motivo = "a âncora não casa nenhum título";
      }
      if (motivo) links.push({ arquivo: nome, linha: numero, alvo: texto(alvo), motivo });
    }
    for (const trecho of codigo) {
      // receitas: `just <nome>` em crase ou em bloco de código (também depois de `mise exec -- `)
      for (const [, receita] of trecho.matchAll(/(?<![\w/.-])just\s+([A-Za-z_][\w-]*)/g)) {
        if (!receitasDoJust.has(receita)) receitas.push({ arquivo: nome, linha: numero, receita: texto(receita) });
      }
    }
    // arquivos: o trecho em crase que parece um caminho; nas specs, o plano cita o que ainda vai nascer
    // ponytail: o docs/agents/revisao-de-ferramentas.md cita caminhos de dentro das ferramentas de terceiros
    // (`bin/preview.mjs` do archify), que não são do projeto; ele fica de fora só nesta regra
    if (!deSpecs && documento !== "docs/agents/revisao-de-ferramentas.md") {
      for (const trecho of crase) {
        if (!trecho.includes("/") || /[<>*{$]|NNN|:\/\//.test(trecho)) continue;
        // ponytail: só conta como caminho do projeto o trecho sem espaço nem `~` (um comando, a pasta do usuário), sem
        // `@` no começo (um pacote com escopo, `@organização/time`), com duas partes ou mais (`/implementar` é uma
        // skill) e sem a `/` no fim (uma pasta que é convenção, como `docs/adr/`). Sem `.` na última parte, só quando a
        // primeira parte existe no repositório, na raiz ou na pasta do documento (`.github/CODEOWNERS`, `src/velho`):
        // `dd/mm/aaaa` e `C:/Users/x` ficam de fora (um `X:` nunca é pasta do projeto). O `arquivo:linha`
        // (`src/app.ts:42`, `src/app.ts:3-5`, `#L42`) conta pelo arquivo.
        if (/[\s~]/.test(trecho) || trecho.startsWith("@") || trecho.endsWith("/")) continue;
        const partes = trecho
          .replace(/(?::\d+(?:-\d+)?){1,2}$|#L\d+(?:-L?\d+)?$/, "")
          .replace(/^\.?\/+/, "")
          .split("/");
        if (partes.length < 2) continue;
        const primeira = partes[0].includes(":") ? [] : [".", pasta].map((base) => noRepositorio(base, partes[0]));
        if (!partes.at(-1).includes(".") && !primeira.some((c) => c !== null && existe(c))) continue;
        const caminhos = [".", pasta].map((base) => noRepositorio(base, ...partes)).filter((c) => c !== null);
        if (!caminhos.length || caminhos.some(existe)) continue;
        // o que o git ignora (o settings.local.json) não está num clone
        if (caminhos.some(ignorado)) continue;
        arquivos.push({ arquivo: nome, linha: numero, caminho: texto(trecho) });
      }
    }
    // versões: `<ferramenta> <versão>` que não é prefixo da fixada nem a tem como prefixo
    for (const [, ferramenta, versao] of VERSAO ? [...codigo, prosa].flatMap((t) => [...t.matchAll(VERSAO)]) : []) {
      const fixada = ferramentas.get(ferramenta.toLowerCase());
      if (prefixo(segmentos(versao), segmentos(fixada)) || prefixo(segmentos(fixada), segmentos(versao))) continue;
      versoes.push({ arquivo: nome, linha: numero, ferramenta: texto(ferramenta.toLowerCase()), versao, fixada: texto(fixada) });
    }
  }
}

// ADRs: os números que faltam entre 1 e o maior, e os repetidos
const contagem = new Map();
for (const c of doGit) {
  const n = /^docs\/adr\/(\d{4})-[^/]+\.md$/.exec(c)?.[1];
  if (n) contagem.set(Number(n), (contagem.get(Number(n)) ?? 0) + 1);
}
const numeros = [...contagem.keys()].sort((a, b) => a - b);
const maior = numeros.at(-1) ?? 0;
const adrs = {
  numeros,
  pulados: Array.from({ length: maior }, (_, i) => i + 1).filter((n) => !contagem.has(n)),
  repetidos: numeros.filter((n) => contagem.get(n) > 1),
};

// Glossário: cada `**Termo**:` do GLOSSARY.md que não aparece, sem caixa e sem acento, em nenhum arquivo de código
// (é sinal, não veredito: o código pode usar a tradução em inglês, e a skill julga)
const semAcento = (s) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
const glossario = [];
const termos = [];
(ler("GLOSSARY.md") ?? "").split(/\r?\n/).forEach((linha, i) => {
  if (longa(linha, "GLOSSARY.md", i + 1)) return;
  for (const [, termo] of linha.matchAll(/\*\*([^*\n]+?)\*\*:/g)) termos.push({ termo, linha: i + 1 });
});
if (termos.length) {
  const codigo = doGit
    .filter((c) => !c.endsWith(".md") && !/^(?:specs|\.claude|\.specify)\//.test(c) && !/(?:^|\/)node_modules\//.test(c))
    .map((c) => semAcento(ler(c) ?? ""));
  for (const { termo, linha } of termos) {
    const procurado = semAcento(termo.trim());
    if (!codigo.some((t) => t.includes(procurado))) glossario.push({ arquivo: "GLOSSARY.md", linha, termo: texto(termo.trim()) });
  }
}

console.log(
  JSON.stringify({
    documentos: documentos.map(texto),
    links,
    receitas,
    arquivos,
    versoes,
    adrs,
    glossario,
    avisos: [...new Set(avisos)],
  }),
);
