// Disposable prototype: not product code.
// Boots the installed game's code offline with the research bench's loader and the snapshot copy whose file name has
// no character name (the same steps as lab/comparar.cjs, printing nothing of the save). Returns the harness H, the
// state snapshot S (S.restore() rebuilds the state before a calculation) and the boot time.
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const LAB = "C:/Users/Vinicius/idleon-companion/lab";
const RUN = "C:/Users/Vinicius/idleon-companion/research/run";
const DEFAULT_SNAP = path.join(LAB, "out", "retrato-character-9.json");

module.exports = function loadGame(edit, snapFile = process.env.PROTO_SNAP || DEFAULT_SNAP) {
  const SNAP = snapFile;
  process.env.LAB_SAVE ??= path.join(LAB, "out", "save-base.raw");
  const t0 = performance.now();
  const H = require(path.join(RUN, "harness.cjs"))();
  const defs = H.attrs();
  const snap = JSON.parse(fs.readFileSync(SNAP, "utf8"));
  if (edit) edit(snap);
  H.ctx.__snap = snap;
  H.ctx.__hx = H.hx;
  // _vars read from the game's memory answer in place of the offline server bridge (as in comparar.cjs)
  const dir = path.dirname(SNAP);
  const vf = fs.readdirSync(dir).filter((f) => f.startsWith("vars-")).sort().pop();
  if (vf) {
    const vars = JSON.parse(fs.readFileSync(path.join(dir, vf), "utf8"));
    const bridge = H.ctx.React.createElement;
    H.ctx.React.createElement = (name, args) => {
      if (/^getServerVarLoad/.test(name) && args && args[0] in vars) {
        H.ctx.__val = vars[args[0]];
        return vm.runInContext("__rev(__val)", H.ctx);
      }
      return bridge(name, args);
    };
  }
  const live = vm.runInContext(
    `(function () {
      function rev(v) {
        if (v === null || typeof v !== "object") return v;
        if (Array.isArray(v)) { var a = new Array(v.length); for (var i = 0; i < v.length; i++) a[i] = rev(v[i]); return a; }
        if ("$n" in v) return Number(v.$n);
        if ("$x" in v) return null;
        if ("$m" in v) { var C = __hx[v.$c] || __hx["haxe.ds.StringMap"], m = new C(), k = Object.keys(v.$m); m.h = {};
          for (var j = 0; j < k.length; j++) m.h[k[j]] = rev(v.$m[k[j]]); return m; }
        var o = {}, ks = Object.keys(v); for (var n = 0; n < ks.length; n++) o[ks[n]] = rev(v[ks[n]]); return o;
      }
      globalThis.__rev = rev;
      var r = {}, k = Object.keys(__snap.attrs); for (var i = 0; i < k.length; i++) r[k[i]] = rev(__snap.attrs[k[i]]);
      return r;
    })()`,
    H.ctx,
  );
  for (const k of snap.skipped) live[k] = defs[k];
  for (const k of ["ItemDefinitionsGET", "MonsterDefinitionsGET", "DialogueDefGET"]) live[k] = defs[k];
  H.eng.gameAttributes.h = live;
  // the helpers' init rewrites some primitives and the live companion bonuses: put them back after it (as comparar.cjs)
  const primitives = {};
  for (const [k, v] of Object.entries(live)) if (v !== null && typeof v !== "object") primitives[k] = v;
  const d0 = live.DNSM && live.DNSM.h;
  const liveBonuses = d0 ? { CompanionBon: d0.CompanionBon, ShinyBonusS: d0.ShinyBonusS } : null;
  require(path.join(RUN, "helpers.cjs"))(H);
  if (liveBonuses) {
    const d = H.attrs().DNSM.h;
    for (const [k, v] of Object.entries(liveBonuses)) if (v) d[k] = v;
    Object.assign(H.attrs(), primitives);
  }
  const S = require(path.join(RUN, "snap.cjs"))(H);
  return { H, S, bootMs: Math.round(performance.now() - t0) };
};
