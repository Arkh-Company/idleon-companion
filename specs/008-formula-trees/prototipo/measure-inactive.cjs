// Disposable prototype: not product code.
// Item 5 of the prototype: computing a character that is not the active one. For each character of the snapshot, a
// fresh offline game where that character's 46 keys (the ones the state keeps at the top for the active character)
// and UserInfo[0] replace the active one's; then the Drop Rate is computed. Prints only the character's index, the
// times and whether a number came out, never a name or the value itself.
// Run: node --max-old-space-size=4096 specs/008-formula-trees/prototipo/measure-inactive.cjs
"use strict";
const loadGame = require("./load-game.cjs");

const probe = loadGame();
const db = probe.H.attrs().PlayerDATABASE.h;
const names = Object.keys(db);
const active = probe.H.attrs().UserInfo[0];
const results = [];
for (let i = 0; i < names.length; i++) {
  const t0 = performance.now();
  const { H, S, bootMs } = loadGame((snap) => {
    const a = snap.attrs;
    const mine = a.PlayerDATABASE.$m[names[i]].$m;
    // PostOfficeInfo's copy in PlayerDATABASE has another shape and breaks the calculation (find-swap-keys.cjs)
    for (const k of Object.keys(mine)) if (k in a && k !== "PostOfficeInfo") a[k] = mine[k];
    a.UserInfo[0] = names[i];
  });
  const s = performance.now();
  S.restore();
  let value = null;
  let error = null;
  try {
    value = H.call("TotalStats", "Drop_Rarity", 0, 0);
  } catch (e) {
    error = String(e).slice(0, 60);
  }
  results.push({
    character: i + 1,
    isActive: names[i] === active,
    bootMs,
    swapMs: Math.round(performance.now() - t0 - bootMs),
    calcMs: Math.round(performance.now() - s),
    gotNumber: typeof value === "number" && Number.isFinite(value),
    error,
  });
}
console.log(JSON.stringify(results));
