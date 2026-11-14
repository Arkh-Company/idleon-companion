// Disposable prototype: not product code.
// Item 2 of the prototype: what "everything live" costs. Boots the game offline (load-game.cjs), takes the game calls of
// the tree catalog (catalogo-de-arvores.md beside the spec) and times one live cycle: rebuild the state once, then compute
// every number without recording. Then times the 11 numbers of the Stats tab alone, for scale. Prints only counts and
// times.
// Run: node --max-old-space-size=4096 specs/008-formula-trees/prototipo/measure-live.cjs
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const loadGame = require("./load-game.cjs");

const CATALOG = path.join(__dirname, "..", "catalogo-de-arvores.md");
const { H, S, bootMs } = loadGame();

// The game calls of the catalog: `Block(args)` in backticks, up to 3 simple arguments (numbers or quoted strings).
const calls = new Map();
for (const m of fs.readFileSync(CATALOG, "utf8").matchAll(/`([A-Za-z_]\w*)\(([^`()]*)\)`/g)) {
  let args;
  try {
    args = JSON.parse("[" + m[2].replace(/'/g, '"') + "]");
  } catch {
    continue;
  }
  if (args.length > 3 || args.some((a) => typeof a === "object")) continue;
  calls.set(m[1] + JSON.stringify(args), [m[1], args]);
}

function cycle(list) {
  const s = performance.now();
  S.restore();
  const restoreMs = performance.now() - s;
  let ok = 0;
  let failed = 0;
  let missing = 0;
  for (const [fn, a] of list) {
    try {
      const v = H.call(fn, a[0] ?? 0, a[1] ?? 0, a[2] ?? 0);
      if (v === undefined) missing++;
      else ok++;
    } catch (e) {
      if (/_customBlock_|is not a function|of undefined/.test(String(e))) missing++;
      else failed++;
    }
  }
  return { restoreMs: Math.round(restoreMs), totalMs: Math.round(performance.now() - s), ok, failed, missing };
}

const all = [...calls.values()];
const STATS = [
  ["DamageDealed", ["Max"]], ["DamageDealed", ["Min"]], ["PlayerHPmax", [0]], ["PlayerMPmax", [0]], ["PlayerAccTot", [0]],
  ["TotalStats", ["STR"]], ["TotalStats", ["AGI"]], ["TotalStats", ["WIS"]], ["TotalStats", ["LUK"]],
  ["TotalStats", ["Drop_Rarity"]], ["AFKgainrates", ["Fighting"]],
];
cycle(all); // warm-up: the first cycle compiles the game's code paths
const runs = [cycle(all), cycle(all), cycle(all)];
const stats = [cycle(STATS), cycle(STATS), cycle(STATS)];
const med = (rs, k) => rs.map((r) => r[k]).sort((a, b) => a - b)[1];
console.log(
  JSON.stringify({
    bootMs,
    catalogCalls: all.length,
    everythingLive: { restoreMs: med(runs, "restoreMs"), cycleMs: med(runs, "totalMs"), ok: runs[1].ok, failed: runs[1].failed, missing: runs[1].missing },
    statsOnly: { restoreMs: med(stats, "restoreMs"), cycleMs: med(stats, "totalMs"), ok: stats[1].ok, failed: stats[1].failed },
  }),
);
