#!/usr/bin/env node
// SVG de um diagrama do archify (desenho, seção 5.6). O archify não tem comando para ele: este script abre o HTML num
// Chrome sem janela e grava o SVG claro do menu Export do próprio viewer (Archify.exportMenu.run('svg-light')). O Chrome
// e os argumentos dele vêm do archify instalado (findChrome e chromeVisualBrowserArgs, de bin/visual-check.mjs).
// Uso, na raiz do projeto: node .claude/scripts/svg.mjs <entrada.html> <saida.svg>
// Sem Chrome, avisa e termina com 0 sem gravar nada. O Chrome fecha pelo protocolo (Browser.close), nunca à força; toda
// espera tem tempo limite, e o perfil temporário sai no fim.
// ponytail: run('svg-light') não é API documentada do archify; o teste lento acusa quando uma versão nova a mudar.
// ponytail: a conferência olha o texto dos caminhos e, pelo lstat, só o último nome. Um link que já exista no caminho
// (hard link ou junção) é seguido; nenhum comando liberado cria link.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cdPasta, estado, relativoNormal } from "./caminho.mjs";

function sair(mensagem) {
  console.error(`svg: ${mensagem}`);
  process.exit(1);
}

const [html, saida] = process.argv.slice(2);
if (!html || !saida) sair("uso: node .claude/scripts/svg.mjs <entrada.html> <saida.svg>");
// O settings.json libera este script sem pedido de permissão: os dois caminhos são conferidos antes de o archify
// (código de terceiros) carregar e antes de qualquer escrita
for (const caminho of [html, saida]) {
  if (!relativoNormal(caminho)) {
    sair(`${caminho}: use um caminho relativo à raiz do projeto, com / e sem .. (como specs/001-nome/diagramas/...)`);
  }
}
if (!/^specs\/[^/]+\/diagramas\/local\/[^/]+\.html$/.test(html)) {
  sair(`${html}: a entrada tem de ser um .html direto em specs/<feature>/diagramas/local/`);
}
if (!/^specs\/[^/]+\/diagramas\/[^/]+\.svg$/.test(saida)) {
  sair(`${saida}: a saída tem de ser um .svg direto em specs/<feature>/diagramas/`);
}
if (!estado(html)?.isFile()) sair(`${html}: não existe ou não é um arquivo comum`);
const anterior = estado(saida);
if (anterior && !anterior.isFile()) sair(`${saida}: já existe e não é um arquivo comum`);
const visualCheck = new URL("../skills/archify/bin/visual-check.mjs", import.meta.url);
if (!existsSync(visualCheck)) sair(`o archify não está instalado: ele vem no repositório: rode ${cdPasta()}git restore --source=HEAD -- .claude/skills/archify; se não estiver no git, o workflow semanal o traz por PR, depois da análise de segurança: ${cdPasta()}gh workflow run skills-update.yml`);
const { findChrome, chromeVisualBrowserArgs } = await import(visualCheck.href);
const chrome = findChrome();
if (!chrome) {
  console.log("SVG: pulado (sem Chrome)");
  process.exit(0);
}

// O protocolo do Chrome (CDP) pelo pipe: mensagens JSON terminadas em \0, escritas no fd 3 e lidas no fd 4
const perfil = mkdtempSync(join(tmpdir(), "archify-svg-"));
let proc;
try {
  proc = spawn(chrome, chromeVisualBrowserArgs(perfil), { stdio: ["ignore", "ignore", "ignore", "pipe", "pipe"] });
} catch (erro) {
  // um arquivo que não é executável falha aqui mesmo (EFTYPE no Windows), antes de qualquer evento
  rmSync(perfil, { recursive: true, force: true });
  sair(`o Chrome não abriu (${chrome}): ${erro.message}`);
}
const [escrita, leitura] = [proc.stdio[3], proc.stdio[4]];
const saiu = new Promise((ok) => {
  proc.once("exit", ok);
  proc.once("error", ok);
});
const pendentes = new Map();
function falhaTodos(erro) {
  for (const pendente of pendentes.values()) pendente.reject(erro);
  pendentes.clear();
}
proc.on("error", falhaTodos);
proc.on("exit", () => falhaTodos(new Error("o Chrome fechou antes de responder")));
escrita.on("error", falhaTodos);
leitura.on("error", falhaTodos);
let resto = "";
leitura.setEncoding("utf8");
leitura.on("data", (pedaco) => {
  resto += pedaco;
  for (let fim; (fim = resto.indexOf("\0")) >= 0; resto = resto.slice(fim + 1)) {
    const mensagem = JSON.parse(resto.slice(0, fim));
    const pendente = pendentes.get(mensagem.id); // evento, sem id: ninguém espera
    if (!pendente) continue;
    pendentes.delete(mensagem.id);
    if (mensagem.error) pendente.reject(new Error(mensagem.error.message));
    else pendente.resolve(mensagem.result);
  }
});

let ultimo = 0;
function enviar(method, params = {}, sessionId = undefined, limiteMs = 30_000) {
  return new Promise((resolve, reject) => {
    const id = ++ultimo;
    const timer = setTimeout(() => {
      pendentes.delete(id);
      reject(new Error(`${method}: o Chrome não respondeu em ${limiteMs / 1000} s`));
    }, limiteMs);
    const fim = (acao) => (valor) => {
      clearTimeout(timer);
      acao(valor);
    };
    pendentes.set(id, { resolve: fim(resolve), reject: fim(reject) });
    escrita.write(`${JSON.stringify({ id, method, params, ...(sessionId && { sessionId }) })}\0`);
  });
}

let codigo = 0;
try {
  const inicio = Date.now();
  // O primeiro comando espera a partida do Chrome, que numa máquina ocupada demora: 90 s, como no archify. O download
  // que o menu Export dispara fica negado: o SVG sai pela captura abaixo, e nada cai na pasta Downloads.
  await enviar("Browser.setDownloadBehavior", { behavior: "deny" }, undefined, 90_000);
  const { targetId } = await enviar("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await enviar("Target.attachToTarget", { targetId, flatten: true });
  async function avaliar(expression) {
    const r = await enviar("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (r.exceptionDetails) {
      throw new Error((r.exceptionDetails.exception?.description || r.exceptionDetails.text).split("\n")[0]);
    }
    return r.result.value;
  }
  const navegacao = await enviar("Page.navigate", { url: pathToFileURL(resolve(html)).href }, sessionId);
  if (navegacao.errorText) throw new Error(`o Chrome não abriu ${html}: ${navegacao.errorText}`);
  for (let i = 0; !(await avaliar("document.readyState === 'complete' && !!window.Archify?.exportMenu")); i++) {
    if (i === 100) throw new Error(`${html} não tem o viewer do archify`);
    await new Promise((ok) => setTimeout(ok, 100));
  }
  // O menu passa o SVG ao URL.createObjectURL antes do download: a troca devolve o texto. Os erros do menu chegam pelo
  // alert ou, num formato que ele não conhece, pela promessa rejeitada do run (sem isso, só o tempo limite apareceria)
  const svg = await avaliar(`new Promise((resolve, reject) => {
    const original = URL.createObjectURL;
    URL.createObjectURL = (blob) => { blob.text().then(resolve, reject); return original.call(URL, blob); };
    window.alert = (mensagem) => reject(new Error(String(mensagem)));
    Promise.resolve(Archify.exportMenu.run('svg-light')).catch(reject);
  })`);
  if (typeof svg !== "string" || !svg.includes("<svg")) throw new Error("o viewer não devolveu um SVG");
  writeFileSync(saida, svg);
  console.log(`SVG: ${saida} (${Math.round(Buffer.byteLength(svg) / 1024)} KB, ${Date.now() - inicio} ms)`);
} catch (erro) {
  console.error(`svg: ${erro.message}`);
  codigo = 1;
} finally {
  // Fecha pelo protocolo e espera o processo sair; sem saída no prazo, avisa e não mata
  await enviar("Browser.close", {}, undefined, 10_000).catch(() => {});
  const fechou = await Promise.race([saiu.then(() => true), new Promise((ok) => setTimeout(ok, 10_000, false))]);
  if (!fechou) {
    console.error(`svg: o Chrome (pid ${proc.pid}) não fechou em 10 s; feche-o e apague ${perfil}`);
  } else {
    try {
      rmSync(perfil, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
    } catch (erro) {
      console.error(`svg: não apaguei o perfil temporário ${perfil}: ${erro.message}`);
    }
  }
}
process.exit(codigo);
