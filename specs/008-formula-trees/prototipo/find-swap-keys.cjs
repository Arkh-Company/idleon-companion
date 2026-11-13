// Disposable prototype: not product code.
// Item 5, diagnosis: which of the character's keys in PlayerDATABASE is not a faithful copy of the top-level key the
// game uses for the active character. For the active character, replaces one key at a time and reports the keys whose
// replacement stops the Drop Rate from coming out or changes it. Prints only state key names (names of the game's
// state, not of characters) and yes/no.
// Run: node --max-old-space-size=8192 specs/008-formula-trees/prototipo/find-swap-keys.cjs
"use strict";
const loadGame = require("./load-game.cjs");

function dropRate(edit) {
  const { H, S } = loadGame(edit);
  S.restore();
  try {
    return H.call("TotalStats", "Drop_Rarity", 0, 0);
  } catch {
    return null;
  }
}

const base = dropRate();
const probe = loadGame();
const active = probe.H.attrs().UserInfo[0];
const snapKeys = (() => {
  let keys = [];
  loadGame((snap) => {
    keys = Object.keys(snap.attrs.PlayerDATABASE.$m[active].$m).filter((k) => k in snap.attrs);
  });
  return keys;
})();
const broken = [];
const changed = [];
for (const k of snapKeys) {
  const v = dropRate((snap) => {
    snap.attrs[k] = snap.attrs.PlayerDATABASE.$m[active].$m[k];
  });
  if (v === null) broken.push(k);
  else if (v !== base) changed.push(k);
}
console.log(JSON.stringify({ baseIsNumber: typeof base === "number", keysTried: snapKeys.length, broken, changed }));
