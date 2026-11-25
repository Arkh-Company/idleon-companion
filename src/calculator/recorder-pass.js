// The recorder's second half (spec 008, T021), run inside the context right after recorder.js, over its state `S`; and
// the places of the infinite numbers for the answer key (spec 010, T162).
// Ported from the bench's build-tree.cjs at BASELINE-4: step 6b (the builders' pass, after the total). Each builder is
// one call from the worker, under its own time limit; a time limit ends the run without its `finally`, so the worker
// calls `abandonBuilder` to put the state back.
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
    var before = S.writes.length;
    S.pending = {
      DhRaw: DhRaw,
      snapDh: snapDh,
      snapTop: snapTop,
      before: before,
      spliced: S.spliced.length,
    };
    var liveObj = Dh[key];
    var liveH = S.mapOf(S.raw(liveObj));
    var liveCopy = Object.assign(Array.isArray(liveH) ? [] : {}, liveH);
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
      // a cache that is a number (T196: the game's purple sigils) keeps its own path's writes when it ends as the game's
      var live = S.raw(liveObj);
      var built = S.raw(Dh[key]);
      var number =
        typeof live === "number" &&
        typeof built === "number" &&
        Math.abs(live - built) <= 1e-9 * Math.max(1, Math.abs(live));
      // only this builder's writes of this cache count, and only where they equal the game's
      for (var j = S.writes.length - 1; j >= before; j--) {
        var w = S.writes[j];
        var ofKey = S.inCache(w.path, key);
        if (
          !ofKey ||
          bad.has(w.path) ||
          (w.path === "DNSM." + key && !number)
        ) {
          if (!ofKey) S.spliced.push(w); // the scratch of the pass, not the cache it rebuilds
          S.writes.splice(j, 1);
        }
      }
    } finally {
      S.cur = null;
      Object.assign(DhRaw, snapDh); // the builder's scratch leaves the state too
      Object.assign(S.top, snapTop);
      Dh[key] = liveObj; // through the record, as the bench puts it back
      S.pending = null;
      S.stopped();
    }
  };

  // Spec 010 (T152, T156): a routine of the game (blocks, or events of a helper actor, in order) run once on this copy,
  // after the roots, under its own node: the state paths it writes are the number (the Cog Board, summed by its
  // screen). An event step may set a field of its helper first, as the game sets the text that triggers it.
  G.__rec.routine = (json) => {
    var node = S.newNode("(routine)", [], null);
    S.on = true;
    S.cur = node;
    try {
      JSON.parse(json).forEach((step) => {
        if (step.event && step.set) {
          var actor = S.top.PixelHelperActor[step.slot];
          actor.behaviors.getBehavior(step.behavior)[step.set[0]] = step.set[1];
        }
        runStep(step);
      });
    } finally {
      S.stopped();
    }
  };

  // The recording, as text made here: nothing of the context crosses as an object. An infinite number is null, as the
  // live tree always had it. (Moved from recorder.js as it was, which keeps under 400 lines.)
  G.__rec.take = () =>
    JSON.stringify({
      nodes: S.nodes || [],
      writes: S.writes || [],
      spliced: S.spliced || [],
      bpStart: S.bpStart === Infinity ? null : S.bpStart,
      setup: S.setup ? S.setup.id : null,
      root: S.root ? S.root.id : null,
      builders: S.builders ? S.builders.id : null,
      fromGame: S.fromGame || [],
    });

  // For the answer key only (spec 010, T162: a cost that overflows): the place of each infinite number in the text
  // take() made, as [...path, sign]; tree-record.ts puts it back there. JSON makes them null, and recorder.js marks
  // where they were, never a pass over the whole recording (seconds on the real game). A node's place is its path from
  // the recording's top, the sign last; a write's is the write (the builders' pass moves them).
  G.__rec.infAt = () => {
    var out = (S.infs || []).slice();
    if (S.infWrites && S.infWrites.length) {
      var where = new Map();
      S.writes.forEach((w, i) => where.set(w, ["writes", i, "v"]));
      S.spliced.forEach((w, i) => where.set(w, ["spliced", i, "v"]));
      S.infWrites.forEach((w) => {
        var p = where.get(w);
        if (p) out.push(p.concat(w.v > 0 ? 1 : -1));
      });
    }
    return JSON.stringify(out);
  };

  // A builder cut by its time limit: the state goes back as it was before it, and none of its writes explains a read.
  G.__rec.abandonBuilder = () => {
    var p = S.pending;
    S.pending = null;
    S.searching = 0;
    if (p) {
      S.writes.length = p.before;
      S.spliced.length = p.spliced;
      Object.assign(p.DhRaw, p.snapDh);
      Object.assign(S.top, p.snapTop);
    }
    S.stopped();
  };
})();
