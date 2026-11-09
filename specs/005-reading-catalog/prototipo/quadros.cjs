// Disposable prototype: not product code.
// Mede se ler fatias de 25 KB mais vezes por segundo faz o jogo perder quadros. Adaptado de specs/004-data-base/prototipo/medir.cjs.
// Abre o jogo pelo canal do depurador, pausa uma vez para pegar a referencia ao motor e depois so le propriedades.
// NAO FECHE esta janela com o jogo aberto: o canal fecha e o jogo cai. Para sair: digite soltar, feche o jogo, espere.
// Comandos (aqui ou em <saida>\cmd.txt): medir | soltar | status
"use strict";
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const { pack, mergeMosaic, frameStats, roundOrder, pct } = require("../../004-data-base/prototipo/lib.cjs");

const OUT = process.env.PROTO_OUT || "C:\\Users\\Vinicius\\idleon-companion\\lab\\out\\prototipo-005\\quadros";
const SCRIPT = process.env.IDLEON_SCRIPT || "/static/game/N.js", ANCHOR = process.env.IDLEON_ANCHOR || "getGameAttribute:function(";
const JANELA_MS = +process.env.PROTO_JANELA_MS || 20000, RODADAS = +process.env.PROTO_RODADAS || 4, TETO_KB = 25;
const CONDICOES = [4, 8, 12]; // leituras por segundo
fs.mkdirSync(OUT, { recursive: true });
const LOG = path.join(OUT, "sessao.log"), CMD = path.join(OUT, "cmd.txt");
const say = (s) => { const l = `${new Date().toTimeString().slice(0, 8)}  ${s}`; console.log(l); try { fs.appendFileSync(LOG, l + "\n"); } catch {} };
process.on("uncaughtException", (e) => say(`ERRO: ${e && e.message}`));
process.on("unhandledRejection", (e) => say(`ERRO: ${e && e.message}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const [exe, ...args] = process.argv.slice(2);
if (!exe) { console.error("uso: medir.cjs <jogo.exe> [args...]"); process.exit(2); }
const gameOut = fs.openSync(path.join(OUT, "jogo-console.log"), "w");
const child = spawn(exe, [...args, "--remote-debugging-pipe"], { stdio: ["ignore", gameOut, gameOut, "pipe", "pipe"] });
say(`JOGO aberto (pid ${child.pid})`);
child.on("exit", (code) => { say(`JOGO fechado (codigo ${code})`); process.exit(0); });

const toB = child.stdio[3], fromB = child.stdio[4];
let nextId = 0, buf = "";
const pending = new Map(), listeners = new Set();
fromB.on("data", (d) => {
  buf += d.toString("utf8");
  for (let i; (i = buf.indexOf("\0")) >= 0; ) {
    const raw = buf.slice(0, i); buf = buf.slice(i + 1);
    let m; try { m = JSON.parse(raw); } catch { continue; }
    if (m.id && pending.has(m.id)) { const p = pending.get(m.id); pending.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
    else for (const l of listeners) l(m);
  }
});
fromB.on("error", (e) => say(`canal: ${e.message}`));
toB.on("error", (e) => say(`canal: ${e.message}`));
const send = (method, params = {}, sessionId) => new Promise((res, rej) => {
  const m = { id: ++nextId, method, params }; if (sessionId) m.sessionId = sessionId;
  const timer = setTimeout(() => { pending.delete(m.id); rej(new Error(`sem resposta para ${method}`)); }, 60000);
  pending.set(m.id, { res: (v) => { clearTimeout(timer); res(v); }, rej: (e) => { clearTimeout(timer); rej(e); } });
  toB.write(JSON.stringify(m) + "\0");
});
const waitFor = (pred, ms) => new Promise((res, rej) => {
  const l = (m) => { if (pred(m)) { clearTimeout(timer); listeners.delete(l); res(m); } };
  const timer = setTimeout(() => { listeners.delete(l); rej(new Error("tempo esgotado")); }, ms);
  listeners.add(l);
});

async function acquire() {
  let page;
  for (let i = 0; i < 120 && !page; i++) { const { targetInfos } = await send("Target.getTargets"); page = targetInfos.find((x) => x.type === "page"); if (!page) await sleep(500); }
  if (!page) throw new Error("nenhuma pagina do jogo apareceu");
  const { sessionId } = await send("Target.attachToTarget", { targetId: page.targetId, flatten: true });
  let scriptId = null;
  const onScript = (m) => { if (m.sessionId === sessionId && m.method === "Debugger.scriptParsed" && m.params.url.endsWith(SCRIPT)) scriptId = m.params.scriptId; };
  listeners.add(onScript);
  await send("Debugger.enable", {}, sessionId);
  for (let i = 0; i < 240 && !scriptId; i++) await sleep(500);
  listeners.delete(onScript);
  if (!scriptId) throw new Error(`script ${SCRIPT} nao carregou`);
  const { scriptSource } = await send("Debugger.getScriptSource", { scriptId }, sessionId);
  const a = scriptSource.indexOf(ANCHOR); if (a < 0) throw new Error("ponto de parada nao encontrado");
  const at = scriptSource.indexOf("{", a) + 1, before = scriptSource.slice(0, at);
  const lineNumber = before.split("\n").length - 1, columnNumber = at - (before.lastIndexOf("\n") + 1);
  const paused = waitFor((m) => m.sessionId === sessionId && m.method === "Debugger.paused", 120000);
  const { breakpointId } = await send("Debugger.setBreakpoint", { location: { scriptId, lineNumber, columnNumber } }, sessionId);
  let engine;
  try {
    const p = await paused, t0 = Date.now();
    ({ result: engine } = await send("Debugger.evaluateOnCallFrame", { callFrameId: p.params.callFrames[0].callFrameId, expression: "this", objectGroup: "leitor" }, sessionId));
    await send("Debugger.removeBreakpoint", { breakpointId }, sessionId);
    await send("Debugger.resume", {}, sessionId);
    say(`referencia obtida (jogo pausado ~${Date.now() - t0} ms)`);
  } catch (e) { await send("Debugger.removeBreakpoint", { breakpointId }, sessionId).catch(() => {}); await send("Debugger.resume", {}, sessionId).catch(() => {}); throw e; }
  await send("Debugger.disable", {}, sessionId);
  await send("Performance.enable", {}, sessionId);
  return { sessionId, objectId: engine.objectId };
}

const clean = (f) => fs.readFileSync(path.join(__dirname, "../../004-data-base/prototipo", f), "utf8").replace(/^\s*\/\/.*$/gm, "").trim();
const FATIA = clean("fatia.js"), LISTAR = clean("listar.js");
let ref = null;
const call = async (src, args) => {
  const r = await send("Runtime.callFunctionOn", { objectId: ref.objectId, functionDeclaration: src, returnByValue: true, objectGroup: "proto", arguments: args }, ref.sessionId);
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception ? r.exceptionDetails.exception.description : r.exceptionDetails.text);
  return r.result.value;
};
const metrics = async () => Object.fromEntries((await send("Performance.getMetrics", {}, ref.sessionId)).metrics.map((m) => [m.name, m.value]));

// O plano vive so na memoria deste processo: tem nomes de personagens, que nunca vao para arquivo.
let plan = null;
async function planejar() {
  const l = await call(LISTAR);
  const paths = l.top.map((k) => [k]);
  for (const [k, s] of Object.entries(l.split)) for (const c of s.children) paths.push([k, c]);
  const bytes = new Array(paths.length).fill(0);
  for (let i = 0; i < paths.length; i += 10) {
    const part = paths.slice(i, i + 10), { out } = await call(FATIA, [{ value: part }]);
    out.forEach((v, j) => { bytes[i + j] = Buffer.byteLength(JSON.stringify(v) || ""); });
    await sleep(100);
  }
  const pieces = paths.map((p, i) => ({ index: i, path: p, bytes: bytes[i] }));
  plan = { paths, pieces, split: l.split, skipped: l.skipped, top: l.top };
  say(`plano: ${paths.length} pecas, ${(bytes.reduce((a, b) => a + b, 0) / 1024).toFixed(0)} KB, maior ${(Math.max(...bytes) / 1024).toFixed(0)} KB`);
}

async function leTracing(fn) {
  const sid = ref.sessionId, chunks = [];
  const on = (m) => { if (m.method === "Tracing.dataCollected") chunks.push(...m.params.value.map((e) => ({ name: e.name, ts: e.ts, dur: e.dur, ph: e.ph }))); };
  listeners.add(on);
  let ativo = false;
  try {
    await send("Tracing.start", { transferMode: "ReportEvents", traceConfig: { includedCategories: ["devtools.timeline", "toplevel"], recordMode: "recordContinuously" } }, sid);
    ativo = true;
  } catch (e) { say(`tracing indisponivel: ${e.message}`); }
  const r = await fn();
  if (ativo) {
    const fim = waitFor((m) => m.method === "Tracing.tracingComplete", 30000);
    await send("Tracing.end", {}, sid);
    await fim.catch((e) => say(`tracing nao terminou: ${e.message}`));
  }
  listeners.delete(on);
  return { ...r, trace: ativo ? frameStats(chunks) : null };
}

async function janela(cond, slices) {
  const m0 = await metrics(), calls = [], t0 = Date.now(), fim = t0 + JANELA_MS;
  let cursor = 0, bytes = 0;
  while (Date.now() < fim) {
    const inicio = Date.now();
    if (cond !== "sem") {
      const s = slices[cursor]; cursor = (cursor + 1) % slices.length;
      const v = await call(FATIA, [{ value: s.map((p) => p.path) }]);
      calls.push(v.ms); bytes += Buffer.byteLength(JSON.stringify(v.out));
    }
    const resto = (cond === "sem" ? 250 : 1000 / cond) - (Date.now() - inicio);
    if (resto > 0) await sleep(resto);
  }
  const m1 = await metrics(), seg = (Date.now() - t0) / 1000, ord = [...calls].sort((a, b) => a - b);
  return {
    seg, chamadas: calls.length, kb: bytes / 1024,
    funcaoP50: pct(ord, 0.5), funcaoP95: pct(ord, 0.95), funcaoMax: ord.at(-1) ?? null,
    tarefaSeg: m1.TaskDuration - m0.TaskDuration, scriptSeg: m1.ScriptDuration - m0.ScriptDuration, heapDeltaMB: (m1.JSHeapUsedSize - m0.JSHeapUsedSize) / 1048576,
  };
}

async function medir() {
  await planejar();
  const lista = pack(plan.pieces, TETO_KB * 1024), fatias = Object.fromEntries(CONDICOES.map((c) => [c, lista]));
  say(`fatias de ${TETO_KB} KB: ${lista.length}`);
  const linhas = [];
  for (let r = 0; r < RODADAS; r++) for (const cond of roundOrder(r, CONDICOES)) {
    const res = await leTracing(() => janela(cond, fatias[cond]));
    linhas.push({ rodada: r, cond, ...res });
    say(`rodada ${r + 1}/${RODADAS} ${cond === "sem" ? "sem" : cond + "/s"}: quadros ${res.trace?.frames ?? "?"}, perdidos ${res.trace?.perdidos ?? "?"}, p95 ${res.trace?.p95 ?? "?"} ms, p99 ${res.trace?.p99 ?? "?"} ms, funcao p95 ${res.funcaoP95?.toFixed?.(2) ?? "-"} ms`);
    fs.writeFileSync(path.join(OUT, "medidas.json"), JSON.stringify({ janelaMs: JANELA_MS, condicoes: CONDICOES, fatias: lista.length, pecas: plan.pieces.length, linhas }, null, 1));
    await sleep(1000);
  }
  say(`medir terminado -> ${path.join(OUT, "medidas.json")}`);
}

let solto = false, fila = Promise.resolve();
const COMANDOS = {
  async medir() { await medir(); },
  async status() { say(`conectado=${!!ref} solto=${solto}`); },
  async soltar() { const r = ref; ref = null; solto = true; if (r) { await send("Runtime.releaseObjectGroup", { objectGroup: "leitor" }, r.sessionId).catch(() => {}); await send("Target.detachFromTarget", { sessionId: r.sessionId }).catch(() => {}); } say("SOLTO: pode fechar o jogo pelo X. Esta janela fecha sozinha depois."); },
};
function comando(linha) {
  const c = linha.trim(); if (!c) return;
  if (!COMANDOS[c]) return say(`comando desconhecido: ${c}`);
  if (c !== "soltar" && c !== "status" && !ref) return say(`${c}: sem conexao ainda`);
  fila = fila.then(() => COMANDOS[c]()).catch((e) => say(`${c} falhou: ${e.message}`));
}
process.stdin.on("error", () => {});
{ let b = ""; process.stdin.setEncoding("utf8"); process.stdin.on("data", (d) => { b += d; for (let i; (i = b.indexOf("\n")) >= 0; ) { comando(b.slice(0, i)); b = b.slice(i + 1); } }); }
setInterval(() => { try { const t = fs.readFileSync(CMD, "utf8"); fs.unlinkSync(CMD); t.split(/\r?\n/).forEach(comando); } catch {} }, 500);

(async () => {
  for (;;) {
    try { ref = await acquire(); say("PRONTO: entre com o personagem, va para a tela mais pesada e digite medir"); return; }
    catch (e) { say(`aviso: ${e.message}; tentando de novo em 5 s`); await sleep(5000); }
  }
})();
