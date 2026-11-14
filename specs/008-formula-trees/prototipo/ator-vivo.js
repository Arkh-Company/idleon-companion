// Disposable prototype: not product code.
// Live-game script for lab\sessao.cjs ("run <this file>"): reads, by property only and never calling a game function,
// the four actor fields the 40 "live game" numbers need (research bench, step G7): the map's first monster
// (ActorEvents_1 _MonsterType, _MonsterHPtot, _RespawnTime) and the player's targeted enemy (ActorEvents_20
// _TargetEnemy). Returns where each one was found, whether it is a number and the read time; no name, no value.
// Copy it into lab\ before the session: sessao.cjs reads "run <file>" from its own folder.
(function () {
  var t0 = Date.now(), g = this.gameAttributes.h, out = { found: {}, isNumber: {}, ms: 0 };
  function field(actor, ev, name) {
    try {
      var s = actor.behaviors.cache.h["ActorEvents_" + ev].script;
      out.found[name] = Object.prototype.hasOwnProperty.call(s, name) || name in s;
      var v = s[name];
      out.isNumber[name] = typeof v === "number" && isFinite(v);
      return v;
    } catch (e) {
      out.found[name] = false;
      return undefined;
    }
  }
  var list = g.MapMonstersList;
  var mob = list && (list[0] || (list.h && list.h[Object.keys(list.h)[0]]));
  out.mapMonstersList = list ? typeof list : "missing";
  if (mob) {
    field(mob, 1, "_MonsterType");
    field(mob, 1, "_MonsterHPtot");
    field(mob, 1, "_RespawnTime");
  }
  var op = g.OtherPlayers, me = g.UserInfo && g.UserInfo[0];
  var player = op && op.h && op.h[me];
  if (player) {
    var te = field(player, 20, "_TargetEnemy");
    out.targetEnemyIsNull = te === null || te === undefined;
    delete out.isNumber._TargetEnemy;
  }
  out.ms = Date.now() - t0;
  return out;
})
