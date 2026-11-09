// Lists the keys of the state, with the engine as `this`, and copies no value but the sentinel. Data properties only:
// no game function, no getter, nothing left in the page (src/keeper/state-read-only.test.ts proves it). Keep SKIP and
// SPLIT equal to STATE_EXCLUDED and STATE_SPLIT of src/shared/state.ts: this file runs as text inside the game.
(function () {
  var SKIP = {
    CustomLists: 1,
    ItemDefinitionsGET: 1,
    MonsterDefinitionsGET: 1,
    DialogueDefGET: 1,
    PixelHelperActor: 1,
    CustomMaps: 1,
  };
  var SPLIT = { PlayerDATABASE: 1, DNSM: 1 };
  var own = function (o, k) {
    var p = Object.getOwnPropertyDescriptor(o, k);
    return p && "value" in p ? p.value : undefined;
  };
  var g = this.gameAttributes.h;
  var keys = Object.keys(g);
  var top = [];
  var split = {};
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (SKIP[k] === 1) continue;
    var p = Object.getOwnPropertyDescriptor(g, k);
    if (!p || !("value" in p)) continue;
    var h =
      SPLIT[k] === 1 && p.value && typeof p.value === "object"
        ? own(p.value, "h")
        : null;
    if (h && typeof h === "object") split[k] = Object.keys(h);
    else top[top.length] = k;
  }
  var u = own(g, "UserInfo");
  var c = Array.isArray(u) ? u[0] : null;
  var m = own(g, "CurrentMap");
  return {
    char: typeof c === "string" ? c : null,
    map: typeof m === "number" ? m : null,
    top: top,
    split: split,
  };
});
