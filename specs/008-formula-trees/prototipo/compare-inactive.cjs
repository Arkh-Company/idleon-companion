// Disposable prototype: not product code.
// Item 5, live check: is a character that is not active computed right by swapping its keys into the state? Uses the
// two snapshots of the live session (character A active, then character B active, taken a minute apart): B computed
// by the swap from snapshot A against B active in snapshot B, and the same for A the other way round. The snapshot
// files are found by time stamp and their names (which carry a character name) are never printed; only the relative
// differences are.
// Run: node --max-old-space-size=8192 specs/008-formula-trees/prototipo/compare-inactive.cjs <stampA> <stampB>
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const loadGame = require("./load-game.cjs");

const OUT = "C:/Users/Vinicius/idleon-companion/lab/out";
const byStamp = (s) => {
  const f = fs.readdirSync(OUT).filter((n) => n.startsWith("retrato-") && n.endsWith("-" + s + ".json"));
  if (f.length !== 1) throw new Error("snapshots with stamp " + s + ": " + f.length);
  return path.join(OUT, f[0]);
};
const [snapA, snapB] = process.argv.slice(2).map(byStamp);
const activeOf = (file) => JSON.parse(fs.readFileSync(file, "utf8")).attrs.UserInfo[0];

const STATS = [
  ["TotalStats", "Drop_Rarity"], ["TotalStats", "STR"], ["TotalStats", "AGI"], ["TotalStats", "WIS"], ["TotalStats", "LUK"],
  ["PlayerHPmax", 0], ["PlayerMPmax", 0], ["PlayerAccTot", 0], ["DamageDealed", "Max"], ["AFKgainrates", "Fighting"],
];
function numbers(file, swapTo) {
  const { H, S } = loadGame(
    swapTo &&
      ((snap) => {
        const a = snap.attrs;
        const mine = a.PlayerDATABASE.$m[swapTo].$m;
        for (const k of Object.keys(mine)) if (k in a && k !== "PostOfficeInfo") a[k] = mine[k];
        a.UserInfo[0] = swapTo;
      }),
    file,
  );
  return STATS.map(([fn, sub]) => {
    S.restore();
    try {
      return H.call(fn, sub, 0, 0);
    } catch {
      return null;
    }
  });
}
const rel = (x, y) => (x === null || y === null ? null : x === y ? 0 : +(Math.abs(x - y) / Math.max(Math.abs(x), Math.abs(y))).toExponential(2));

const charA = activeOf(snapA);
const charB = activeOf(snapB);
const out = {};
for (const [label, truthFile, swapFile, who] of [
  ["B (inactive in snapshot A)", snapB, snapA, charB],
  ["A (inactive in snapshot B)", snapA, snapB, charA],
]) {
  const truth = numbers(truthFile, null);
  const swapped = numbers(swapFile, who);
  out[label] = Object.fromEntries(STATS.map(([fn, sub], i) => [fn + "(" + sub + ")", rel(truth[i], swapped[i])]));
}
console.log(JSON.stringify({ differentCharacters: charA !== charB, relativeDifference: out }));
