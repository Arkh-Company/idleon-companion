// Copies the pieces in `paths` to plain values, with the engine as `this`; with `null` for `paths`, copies `this` itself
// (an object of the `_vars`). Data properties only: no game function, no getter, nothing left in the page
// (src/keeper/state-read-only.test.ts proves it). Array items are read by index, as measured: no game code defines
// accessors on them.
(function (paths) {
  var onPath = new WeakSet();
  var own = function (o, k) {
    var p = Object.getOwnPropertyDescriptor(o, k);
    return p && "value" in p ? p.value : undefined;
  };
  var className = function (proto) {
    var c = proto ? own(proto, "__class__") : null;
    var n = c ? own(c, "__name__") : null;
    return typeof n === "string" ? n : null;
  };
  var copyProps = function (o, d) {
    var r = {};
    var keys = Object.keys(o);
    for (var i = 0; i < keys.length; i++) {
      var p = Object.getOwnPropertyDescriptor(o, keys[i]);
      if (p && "value" in p) r[keys[i]] = walk(p.value, d + 1);
    }
    return r;
  };
  var walk = function (v, d) {
    var t = typeof v;
    // v - v is 0 only for a finite number.
    if (t === "number") return v - v === 0 ? v : { $n: "" + v };
    if (t === "string" || t === "boolean") return v;
    if (v === null || v === undefined) return null;
    if (t !== "object") return { $x: 1 };
    var proto = Object.getPrototypeOf(v);
    if (proto === String.prototype) return String.prototype.valueOf.call(v);
    if (d > 14 || onPath.has(v)) return { $x: 1 };
    onPath.add(v);
    var res;
    if (Array.isArray(v)) {
      res = [];
      for (var i = 0; i < v.length; i++) res[i] = walk(v[i], d + 1);
    } else {
      var h = own(v, "h");
      if (h && typeof h === "object")
        res = { $m: copyProps(h, d), $c: className(proto) };
      else if (proto === Object.prototype || proto === null)
        res = copyProps(v, d);
      else res = { $x: 1 };
    }
    onPath.delete(v);
    return res;
  };
  var child = function (o, k) {
    var h = o && typeof o === "object" ? own(o, "h") : null;
    return h && typeof h === "object" ? own(h, k) : undefined;
  };
  // The script of an actor's behavior, at behaviors.cache.h["ActorEvents_N"].script; null when a step is not there.
  var script = function (actor, id) {
    var at = actor;
    var steps = ["behaviors", "cache", "h", "ActorEvents_" + id, "script"];
    for (var i = 0; at && typeof at === "object" && i < steps.length; i++)
      at = own(at, steps[i]);
    return at && typeof at === "object" ? at : null;
  };
  // [PixelHelperActor index, ActorEvents number, field, indexes or null when read whole]: the fields the live-game trees
  // read (spec 008 US12; src/keeper/actor-contract-fixture.ts). Keys as read.js gives them: "H24._GenINFO[130]".
  var HELPERS = [
    [0, 29, "_ScrollCircleINFO", [43]],
    [2, 167, "_BuffIDsOn", null],
    [4, 229, "_GenInfo", [84]],
    [5, 232, "_ItemsAndStorageOWNED", null],
    [6, 312, "_GenINFO", [45]],
    [8, 481, "_GenINFO", [108, 111, 112, 132]],
    [21, 510, "_GenINFO", [56]],
    [22, 548, "_GenINFO", [22, 38, 92, 110]],
    [
      24,
      623,
      "_GenINFO",
      [71, 87, 110, 123, 124, 130, 132, 143, 170, 174, 185],
    ],
    [25, 670, "_GenINFO", [36, 69, 76, 112, 210]],
    [26, 713, "_GenINFO", [70, 88, 89, 107]],
    [27, 741, "_GenINFO", [30, 32, 33, 39, 50]],
  ];
  var MONSTER = ["_MonsterType", "_MonsterHPtot", "_RespawnTime"];
  // The actors piece: the map it was read on, the helpers' fields, the map's first monster and the type of the player's
  // target (null with none). An actor that is not there leaves its keys out. The player is found by the character's
  // name, which never leaves this function.
  var readActors = function (g, char, map) {
    var r = { map: map };
    var helpers = own(g, "PixelHelperActor");
    for (var a = 0; a < HELPERS.length; a++) {
      var row = HELPERS[a];
      var s = Array.isArray(helpers)
        ? script(own(helpers, row[0]), row[1])
        : null;
      if (!s) continue;
      var key = "H" + row[0] + "." + row[2];
      var field = own(s, row[2]);
      if (!row[3]) r[key] = walk(field, 0);
      else
        for (var b = 0; b < row[3].length; b++)
          r[key + "[" + row[3][b] + "]"] = walk(
            field && typeof field === "object" ? own(field, row[3][b]) : null,
            0,
          );
    }
    var mobs = own(g, "MapMonstersList");
    var mob = Array.isArray(mobs) ? script(own(mobs, 0), 1) : null;
    if (mob)
      for (var f = 0; f < MONSTER.length; f++)
        r["map0." + MONSTER[f]] = walk(own(mob, MONSTER[f]), 0);
    var me =
      typeof char === "string"
        ? script(child(own(g, "OtherPlayers"), char), 20)
        : null;
    var target = me ? own(me, "_TargetEnemy") : undefined;
    var aimed = target ? script(target, 1) : null;
    if (me && !target) r["target._MonsterType"] = null;
    else if (aimed)
      r["target._MonsterType"] = walk(own(aimed, "_MonsterType"), 0);
    return r;
  };
  if (paths === null) return walk(this, 0);
  var g = this.gameAttributes.h;
  var u = own(g, "UserInfo");
  var c = Array.isArray(u) ? u[0] : null;
  var m = own(g, "CurrentMap");
  if (typeof m !== "number") m = null;
  var out = [];
  for (var n = 0; n < paths.length; n++) {
    // Kept equal to ACTORS_PIECE of src/shared/state.ts: this file runs as text inside the game.
    if (paths[n][0] === "@actors") {
      out[n] = readActors(g, c, m);
      continue;
    }
    var cur = paths[n].length > 3 ? undefined : own(g, paths[n][0]);
    for (var l = 1; l < paths[n].length; l++) cur = child(cur, paths[n][l]);
    out[n] = walk(cur, 0);
  }
  return {
    char: typeof c === "string" ? c : null,
    map: m,
    out: out,
  };
});
