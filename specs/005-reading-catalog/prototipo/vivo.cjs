// Disposable prototype: not product code.
// Parte A da 005: o calculo com o contexto vivo, aplicando so as pecas que mudaram, da os mesmos numeros que um calculo
// do zero? Le a copia do jogo e os retratos de fora do repositorio e so grava resultados la. Nada de valor sai na tela.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");

const LAB = "C:/Users/Vinicius/idleon-companion";
const RUN = `${LAB}/research/run`;
const SAIDA = `${LAB}/lab/out/prototipo-005`;
const RETRATOS = `${SAIDA}/retratos`;
const MODO = process.argv[2] || "v1"; // v1: so aplica; v2: reroda ajudantes sem recriar atores; v3: recria os atores
const RESTAURA = process.argv[3] || "cada"; // cada: restaura antes de cada numero; uma: uma vez por conjunto
const LIMITE = Number(process.argv[4] || 1e9);

const ALVOS = [
  ["damageMax", "DamageDealed", "Max"],
  ["damageMin", "DamageDealed", "Min"],
  ["hp", "PlayerHPmax", 0],
  ["mp", "PlayerMPmax", 0],
  ["accuracy", "PlayerAccTot", 0],
  ["str", "TotalStats", "STR"],
  ["agi", "TotalStats", "AGI"],
  ["wis", "TotalStats", "WIS"],
  ["luk", "TotalStats", "LUK"],
  ["dropRate", "TotalStats", "Drop_Rarity"],
  ["afkGains", "AFKgainrates", "Fighting"],
];

const ANCORA = 'A["com.stencyl.Engine"]=a,';
const codigo = fs.readFileSync(`${RUN}/N.game.js`, "utf8");
const pak = fs.readFileSync(`${RUN}/default.pak`);
const jogo = new vm.Script(codigo.replace(ANCORA, `${ANCORA}globalThis.__hx=A,`), { filename: "game.js" });

function dnsmPreguicosas(c) {
  const p = 'DNSM").h.';
  const k = new Set();
  for (let a = c.indexOf(p); a >= 0; a = c.indexOf(p, a + 1)) {
    const i = a + p.length;
    const n = /^\w+/.exec(c.slice(i, i + 60))?.[0];
    if (n && c.startsWith(".h", i + n.length) && !/\w/.test(c.charAt(i + n.length + 2)) && !k.has(n) && !c.includes(`.h,"${n}")`)) k.add(n);
  }
  return JSON.stringify([...k]);
}
const preguicosas = dnsmPreguicosas(codigo);

// Expoe o que o calculo guarda em closure, so neste prototipo.
const fonte = fs
  .readFileSync(path.join(__dirname, "../../../src/calculator/context.js"), "utf8")
  .replace(
    "G.__calc = {",
    `G.__calc = {
    internos: () => ({ eng, hx, snapshot, rev, owner, restore, steps, setVars: (v) => { vars = v; } }),`,
  );

const ACRESCIMO = `(function () {
  __calc.aplica = function (texto) {
    var d = JSON.parse(texto), I = __calc.internos();
    var Ser = I.hx["haxe.Serializer"], Un = I.hx["haxe.Unserializer"], s = I.snapshot;
    var grava = function (k, v) { try { s.ser[k] = Ser.run(v); delete s.ref[k]; } catch (e) { s.ref[k] = v; delete s.ser[k]; } };
    Object.keys(d.topo).forEach(function (k) { grava(k, I.rev(d.topo[k])); });
    ["DNSM", "PlayerDATABASE"].forEach(function (mapa) {
      var nomes = Object.keys(d[mapa]);
      if (!nomes.length) return;
      var m = Un.run(s.ser[mapa]);
      nomes.forEach(function (n) { m.h[n] = I.rev(d[mapa][n]); });
      grava(mapa, m);
    });
    if (d.vars) I.setVars(d.vars);
  };
  __calc.numeroSemRestaurar = function (b, a) { var I = __calc.internos(); return I.owner[b]["_customBlock_" + b](a, 0, 0); };
  __calc.restaura = function () { __calc.internos().restore(); };
  // Como um calculo do zero, mas sem recarregar o jogo: o retrato novo entra inteiro e os ajudantes rodam de novo.
  // v2 reaproveita os atores ja criados; v3 cria os atores de novo. Os passos 1 a 23 sao os construtores dos atores.
  __calc.recarrega = function (modo, preguicosas) {
    var I = __calc.internos();
    __calc.loadMosaic();
    var a = I.eng.gameAttributes.h;
    if (a.DNSM) preguicosas.forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(a.DNSM.h, k)) a.DNSM.h[k] = new I.hx["haxe.ds.StringMap"](); });
    I.steps.forEach(function (p, i) { if (modo === "v3" || i === 0 || i > 23) { try { p.run(); } catch (e) {} } });
    __calc.finishHelpers();
  };
  // Para o diagnostico: o estado depois dos ajudantes, por peca. So o hospedeiro compara, nada sai na tela.
  __calc.estado = function () {
    var I = __calc.internos(), S = I.hx["haxe.Serializer"], Un = I.hx["haxe.Unserializer"], o = {};
    Object.keys(I.snapshot.ser).forEach(function (k) {
      if (k === "DNSM" || k === "PlayerDATABASE") {
        var m = Un.run(I.snapshot.ser[k]);
        Object.keys(m.h).forEach(function (n) { try { o[k + "." + n] = S.run(m.h[n]); } catch (e) { o[k + "." + n] = "?"; } });
      } else o[k] = I.snapshot.ser[k];
    });
    return JSON.stringify(o);
  };
})();`;

function liga() {
  const sandbox = Object.create(null);
  const ctx = vm.createContext(sandbox, { codeGeneration: { strings: false, wasm: false } });
  const run = (t, ms = 8000) => vm.runInContext(t, ctx, { timeout: ms });
  const instala = run(fonte);
  const A = run("Uint8Array");
  const d = (f) => (x) => {
    try {
      const b = f(Buffer.from(x.buffer, x.byteOffset, x.byteLength));
      const o = new A(b.length);
      Uint8Array.prototype.set.call(o, b);
      return o;
    } catch {
      return null;
    }
  };
  instala(d(zlib.gunzipSync), d(zlib.inflateSync), d(zlib.inflateRawSync));
  jogo.runInContext(ctx, { timeout: 8000 });
  const c = new A(pak.length);
  Uint8Array.prototype.set.call(c, pak);
  sandbox.__pak = c;
  run("__calc.start(__pak)");
  run("__calc.tables()");
  run(ACRESCIMO);
  return { sandbox, run };
}

function carrega(m, json) {
  m.sandbox.__mosaic = json;
  m.run("__calc.loadMosaic()");
  const passos = JSON.parse(m.run(`__calc.helperPlan(${preguicosas})`));
  passos.forEach((ms, i) => {
    try {
      m.run(`__calc.helperStep(${i})`, ms);
    } catch {}
  });
  m.run("__calc.finishHelpers()");
}

function numeros(m, restaura) {
  const out = {};
  if (restaura === "uma") m.run("__calc.restaura()");
  for (const [id, b, a] of ALVOS) {
    const f = restaura === "uma" ? "numeroSemRestaurar" : "number";
    let v = null;
    try {
      v = m.run(`__calc.${f}(${JSON.stringify(b)},${JSON.stringify(a)})`, 2000);
    } catch {}
    out[id] = typeof v === "number" && Number.isFinite(v) ? v : null;
  }
  return out;
}

function diferenca(a, b) {
  const d = { topo: {}, DNSM: {}, PlayerDATABASE: {}, vars: null, n: 0 };
  for (const k of Object.keys(b.attrs)) {
    if (k === "DNSM" || k === "PlayerDATABASE") {
      for (const c of Object.keys(b.attrs[k].$m))
        if (JSON.stringify(a.attrs[k].$m[c]) !== JSON.stringify(b.attrs[k].$m[c])) {
          d[k][c] = b.attrs[k].$m[c];
          d.n++;
        }
    } else if (JSON.stringify(a.attrs[k]) !== JSON.stringify(b.attrs[k])) {
      d.topo[k] = b.attrs[k];
      d.n++;
    }
  }
  if (JSON.stringify(a.vars) !== JSON.stringify(b.vars)) {
    d.vars = b.vars;
    d.n++;
  }
  return d;
}

const pct = (l, q) => {
  const s = [...l].sort((x, y) => x - y);
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(q * s.length))]) : null;
};

module.exports = { liga, carrega, numeros, preguicosas, ALVOS, RETRATOS, SAIDA, RUN };
if (require.main === module) {
const arquivos = fs.readdirSync(RETRATOS).filter((f) => f.endsWith(".json")).sort().slice(0, LIMITE);
const lidos = (f) => fs.readFileSync(path.join(RETRATOS, f), "utf8");
const resultado = `${SAIDA}/vivo-${MODO}-${RESTAURA}.jsonl`;
fs.writeFileSync(resultado, "");

let vivo = liga();
let t = performance.now();
carrega(vivo, lidos(arquivos[0]));
console.log("inicio do contexto vivo", Math.round(performance.now() - t), "ms");

let anterior = JSON.parse(lidos(arquivos[0]));
const tempos = [], erros = {};
let iguais = 0, pares = 0;
for (let i = 1; i < arquivos.length; i++) {
  const json = lidos(arquivos[i]);
  const atual = JSON.parse(json);
  const d = diferenca(anterior, atual);
  const t0 = performance.now();
  if (MODO === "v1") {
    vivo.sandbox.__dif = JSON.stringify(d);
    vivo.run("__calc.aplica(__dif)");
  } else {
    vivo.sandbox.__mosaic = json;
    vivo.run(`__calc.recarrega(${JSON.stringify(MODO)},${preguicosas})`, 30000);
  }
  const n = numeros(vivo, RESTAURA);
  const ms = performance.now() - t0;
  const zero = liga();
  carrega(zero, json);
  const certo = numeros(zero, "cada");
  const dif = Object.keys(certo).filter((k) => certo[k] !== n[k]);
  pares++;
  if (!dif.length) iguais++;
  for (const k of dif) erros[k] = (erros[k] || 0) + 1;
  tempos.push(ms);
  const linha = { arquivo: arquivos[i], pecas: d.n, ms: Math.round(ms), dif };
  if (process.env.DIAG) {
    const a = JSON.parse(vivo.run("__calc.estado()"));
    const b = JSON.parse(zero.run("__calc.estado()"));
    linha.estadoDif = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => a[k] !== b[k]);
    const zero2 = liga();
    carrega(zero2, json);
    const outra = numeros(zero2, "cada");
    linha.zeroInstavel = Object.keys(certo).filter((k) => certo[k] !== outra[k]);
  }
  fs.appendFileSync(resultado, `${JSON.stringify(linha)}\n`);
  if (i % 10 === 0) console.log(i, "pares", pares, "iguais", iguais, "p50", pct(tempos, 0.5), "p95", pct(tempos, 0.95));
  anterior = atual;
}
console.log(`FIM ${MODO}/${RESTAURA}: pares ${pares} iguais ${iguais} | ms p50 ${pct(tempos, 0.5)} p95 ${pct(tempos, 0.95)} max ${Math.round(Math.max(...tempos))} | erros ${JSON.stringify(erros)}`);
}
