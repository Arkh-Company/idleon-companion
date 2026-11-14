// The recorder's second half (spec 008, T021), run inside the context right after recorder.js, over its state `S`.
// Ported from the bench's build-tree.cjs at BASELINE-4: step 6b (the builders' pass, after the total) and step 6c (the
// "@read" roots). Each builder is one call from the worker, under its own time limit.
(function () {
  "use strict";
  var G = globalThis;
  var S = G.__rec.state;

  // One run of a recipe step: a block of the game with its exact arguments, or an event of a helper actor.
  function runStep(step) {
    if (!step.event) return G.__calc.call(step.block, step.args);
    var actor = S.top.PixelHelperActor[step.slot];
    var inst = actor.behaviors.getBehavior(step.behavior);
    return inst[step.event].apply(inst, step.args || []);
  }

  // A number of the game's cache that the builder gave differently is no explanation of it.
  function differences(key, liveCopy, got) {
    var bad = new Set();
    Object.keys(liveCopy).forEach((k) => {
      var x = liveCopy[k];
      var y = got ? got[k] : undefined;
      if (
        typeof x === "number" &&
        !(Math.abs(x - y) <= 1e-9 * Math.max(1, Math.abs(x)))
      )
        bad.add("DNSM." + key + (/^\d+$/.test(k) ? "[" + k + "]" : "." + k));
    });
    return bad;
  }

  // 6b. Each cache of the recipe's builders is dropped and built again by the game's own call, with everything else
  // as the calculation left it. The total is already calculated and never sees these values.
  G.__rec.startBuilders = () => {
    S.builders = S.newNode("(the game's cache builders)", [], null);
    S.bpStart = ++S.seq; // the reads of the calculation are numbered below it
  };

  G.__rec.builder = (i) => {
    var b = S.recipe.builders[i];
    var key = b.cache;
    var Dh = S.top.DNSM.h;
    var DhRaw = S.raw(Dh);
    var snapDh = Object.assign({}, DhRaw);
    var snapTop = Object.assign({}, S.top);
    var liveObj = Dh[key];
    var liveH = S.mapOf(S.raw(liveObj));
    var liveCopy = Object.assign(Array.isArray(liveH) ? [] : {}, liveH);
    var before = S.writes.length;
    S.on = true;
    try {
      // a cache the block makes new by itself is not deleted first (keepLive): its loop then reads the game's
      if (!b.keepLive) delete Dh[key];
      S.cur = S.builders;
      if (b.before) {
        // an event that must run first, with the game's cache in place, as in the game (the Lab's connections)
        var actor = S.top.PixelHelperActor[b.before.slot];
        var inst = actor.behaviors.getBehavior(b.before.behavior);
        inst[b.before.set[0]] = b.before.set[1];
        Dh[key] = liveObj;
        try {
          inst[b.before.event]();
        } catch {
          // the cache is rebuilt anyway
        }
        delete Dh[key];
      }
      try {
        runStep(b.run);
      } catch {
        // a builder that fails leaves the game's cache
      }
      S.cur = null;
      var bad = differences(key, liveCopy, S.mapOf(S.raw(Dh[key])));
      // only this builder's writes of this cache count, and only where they equal the game's
      for (var j = S.writes.length - 1; j >= before; j--) {
        var w = S.writes[j];
        var ofKey = S.inCache(w.path, key);
        if (!ofKey || bad.has(w.path) || w.path === "DNSM." + key) {
          if (!ofKey) S.spliced.push(w); // the scratch of the pass, not the cache it rebuilds
          S.writes.splice(j, 1);
        }
      }
    } finally {
      S.cur = null;
      Object.assign(DhRaw, snapDh); // the builder's scratch leaves the state too
      Object.assign(S.top, snapTop);
      Dh[key] = liveObj; // through the record, as the bench puts it back
      S.stopped();
    }
  };

  // 6c. The "@read" roots read their key of the cache through the record, after the builders: a key the cache does
  // not have reads as 0.
  G.__rec.readRoots = () => {
    S.readRoots.forEach((pair) => {
      var n = pair[0];
      var cache = n.a[0];
      S.cur = n;
      S.on = true;
      var A = S.stateOf().h;
      var o = /^DNSM\./.test(cache) ? A.DNSM.h[cache.slice(5)] : A[cache];
      var m = o ? S.mapOf(o) : null;
      var v = m ? m[n.a[1]] : undefined;
      S.stopped();
      n.v = typeof v === "number" ? v : 0;
    });
  };
})();
