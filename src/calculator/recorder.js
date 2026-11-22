// The tree worker's recorder (spec 008, T021; ADR 0008), loaded as text and run inside the context before the game's
// code, so the instrumented blocks find `__X` already there; it records nothing until a request turns it on. Ported
// from the bench's build-tree.cjs at BASELINE-4: steps 2 (calls), 3 and 3b (reads, writes, searches), 4 (RECOMPUTE),
// 4b (steps), 5 (helpers) and 6 (roots). recorder-pass.js adds 6b over the same state `S`; step 7 (links) runs
// in the worker over the JSON (tree/links.ts). The recording leaves only as JSON text, made here. No character name is
// kept: a key or an argument that is a character's name becomes its index.
(function () {
  "use strict";
  var G = globalThis;
  var READ_CAP = 80;
  var STEP_CAP = 60000;
  var LOG_CAP = 20000;
  var CHECK_CAP = 40;
  var GAME_TABLE =
    /^(CustomLists|CustomMaps|ItemDefinitionsGET|MonsterDefinitionsGET|DialogueDefGET)\b/;
  // The companion caches the context puts back from the mosaic after the helpers (context.js, reapply).
  var RESTORED = ["CompanionBon", "ShinyBonusS", "CompanionLVz"];
  var hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

  // The recording's state, shared with recorder-pass.js.
  var S = { on: false, cur: null, searching: 0, seq: 0, bpStart: Infinity };

  // The game rolls dice in its helpers (keychain stats): a fixed seed makes every recording repeat.
  var seed = 12345;
  Math.random = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

  // The places of the infinite numbers the recording keeps (spec 010, T162): JSON makes them null, and infAt() names
  // where they were, for the answer key, never a pass over the whole recording (seconds on the real game). A node's
  // place is its path from the recording's top, the sign last; a write's is the write (the builders' pass moves them).
  var isInf = (v) => v === Infinity || v === -Infinity;
  var mark = (path, v) => S.infs.push(path.concat(v > 0 ? 1 : -1));

  // 4b. Each step of a block's arithmetic lands on the row of the block that runs it (only numbers and yes/no).
  G.__X = (i, v) => {
    if (S.on && S.cur) {
      var x = S.cur.x || (S.cur.x = []);
      if (x.length < STEP_CAP) {
        x.push([i, typeof v === "number" || typeof v === "boolean" ? v : null]);
        if (isInf(v)) mark(["nodes", S.cur.id, "x", x.length - 1, 1], v);
      }
    }
    return v;
  };

  // The game asks its server bridge for the companions you own while the helpers run; the mosaic answers.
  var bridge = G.React.createElement;
  G.React.createElement = (name, args) =>
    name === "getCompanionInfoMe" && S.companions
      ? S.companions.slice()
      : bridge(name, args);

  S.raw = (o) => (o && S.RAW.get(o)) || o;
  S.mapOf = (o) =>
    o && o.h && typeof o.h === "object" && !Array.isArray(o) ? o.h : o;
  S.inCache = (path, key) =>
    path === "DNSM." + key ||
    path.indexOf("DNSM." + key + "[") === 0 ||
    path.indexOf("DNSM." + key + ".") === 0;
  S.stateOf = () => G.__hx["com.stencyl.Engine"].engine.gameAttributes;
  S.stopped = () => {
    S.on = false;
    S.cur = null;
  };
  var stepAt = () => (S.cur && S.cur.x ? S.cur.x.length : 0);

  // 2. Call record.
  S.newNode = (b, a, parent) => {
    var n = { id: S.nodes.length, b: b, a: a, c: [] };
    n.p = parent ? parent.id : null;
    n.pxi = parent && parent.x ? parent.x.length : 0;
    S.nodes.push(n);
    if (parent) parent.c.push(n.id);
    return n;
  };
  // a text argument is cut to the blueprint's ARG_TEXT_MAX (declared/refs.ts; arg-text.test.ts pins both)
  function simple(x) {
    if (x === null || typeof x === "number" || typeof x === "boolean") return x;
    if (typeof x !== "string") return "(" + typeof x + ")";
    return S.names.has(x)
      ? "(character " + S.names.get(x) + ")"
      : x.slice(0, 40);
  }
  function wrapBlock(C, k) {
    var f = C[k];
    var name = k.slice("_customBlock_".length);
    C[k] = function () {
      if (!S.on) return f.apply(this, arguments);
      var args = Array.prototype.map.call(arguments, simple);
      var node = S.newNode(name, args, S.cur);
      for (var i = 0; i < args.length; i++)
        if (isInf(args[i])) mark(["nodes", node.id, "a", i], args[i]);
      var parent = S.cur;
      S.cur = node;
      try {
        var v = f.apply(this, arguments);
        node.v =
          typeof v === "number" || typeof v === "boolean"
            ? v
            : v === undefined
              ? "(undefined)"
              : "(" + typeof v + ")";
        if (isInf(v)) mark(["nodes", node.id, "v"], v);
        // a list or a map of the state returned: its path (spec 010, T162: the list whose item is the number)
        var vp = v !== null && typeof v === "object" ? S.PATH.get(v) : null;
        if (vp) node.vp = vp;
        return v;
      } catch (e) {
        node.err = true;
        throw e;
      } finally {
        S.cur = parent;
      }
    };
  }

  // 3. Reads and writes over the whole state. Text stays out, except a game id the game's own tables name.
  function valueOut(v) {
    if (typeof v === "number" || typeof v === "boolean" || v === null) return v;
    if (typeof v !== "string") return "(" + typeof v + ")";
    return hasOwn(S.mon, v) || hasOwn(S.item, v) ? v : "(text)";
  }
  S.addWrite = (path, v) => {
    var node = S.cur ? S.cur.id : null;
    var w = {
      path: path,
      node: node,
      v: valueOut(v),
      xi: stepAt(),
      seq: ++S.seq,
    };
    S.writes.push(w);
    if (isInf(w.v)) S.infWrites.push(w);
  };
  function checkNote(path, exists) {
    if (!S.on || !S.cur || S.searching) return;
    var q = S.cur.q || (S.cur.q = []);
    if (q.length < CHECK_CAP && !q.some((x) => x[0] === path))
      q.push([path, exists]);
  }
  function log(entry) {
    var rx = S.cur.rx || (S.cur.rx = []);
    if (rx.length < LOG_CAP) {
      rx.push(entry);
      if (isInf(entry[1]))
        mark(["nodes", S.cur.id, "rx", rx.length - 1, 1], entry[1]);
    }
  }
  function note(path, v) {
    if (S.searching || !S.on || !S.cur) return; // inside one of the game's searches: the search is one read (3b)
    var r = S.cur.r || (S.cur.r = []);
    var fresh = r.length < READ_CAP && !r.some((x) => x[0] === path);
    if (typeof v === "string" && GAME_TABLE.test(path)) {
      // a loop's turn is known by the table row it read: kept with its place, inside the worker only
      log([path, v.slice(0, 120), stepAt()]);
      if (fresh) r.push([path, v.slice(0, 120)]);
      return;
    }
    var numeric = typeof v === "string" && v.trim() !== "" && !isNaN(Number(v));
    // the fourth field is the last write before this read: the write it saw, at every read and not only the first
    if (typeof v === "number" || numeric)
      log([path, typeof v === "number" ? v : v.slice(0, 40), stepAt(), S.seq]);
    // the third field is the last write before this first read: a read links to a write before it (step 7)
    if (fresh) {
      r.push([path, valueOut(v), S.seq]);
      if (isInf(v)) mark(["nodes", S.cur.id, "r", r.length - 1, 1], v);
    }
  }
  function join(base, k) {
    if (S.names.has(k)) return base + "[" + S.names.get(k) + "]";
    return base + (/^\d+$/.test(k) ? "[" + k + "]" : k === "h" ? "" : "." + k);
  }
  function track(obj, p) {
    if (obj === null || typeof obj !== "object" || S.RAW.has(obj)) return obj;
    var byPath = S.PROX.get(obj);
    if (!byPath) S.PROX.set(obj, (byPath = new Map()));
    if (byPath.has(p)) return byPath.get(p);
    var proxy = new Proxy(obj, {
      get(t, k) {
        var v = Reflect.get(t, k, t);
        // a helper's state is reached through getBehavior(name): its result is read through the record too
        if (k === "getBehavior" && typeof v === "function")
          return function (name) {
            var r = v.apply(S.raw(this), arguments);
            if (r === null || typeof r !== "object") return r;
            return track(S.raw(r), p + ".getBehavior(" + name + ")");
          };
        if (typeof k !== "string" || typeof v === "function") return v;
        var np = join(p, k);
        if (v !== null && typeof v === "object") return track(S.raw(v), np);
        note(np, v);
        return v;
      },
      // a check made without reading the value; listing the keys is not one
      getOwnPropertyDescriptor(t, k) {
        var d = Reflect.getOwnPropertyDescriptor(t, k);
        var listed = S.LISTED.get(t);
        if (listed && listed.has(k)) listed.delete(k);
        else if (typeof k === "string") checkNote(join(p, k), d !== undefined);
        return d;
      },
      ownKeys(t) {
        var ks = Reflect.ownKeys(t);
        S.LISTED.set(t, new Set(ks.filter((k) => typeof k === "string")));
        return ks;
      },
      has(t, k) {
        var r = Reflect.has(t, k);
        if (typeof k === "string") checkNote(join(p, k), r);
        return r;
      },
      set(t, k, v) {
        if (typeof k === "string" && S.on) S.addWrite(join(p, k), S.raw(v));
        return Reflect.set(t, k, S.raw(v), t);
      },
    });
    S.RAW.set(proxy, obj);
    S.PATH.set(proxy, p);
    byPath.set(p, proxy);
    return proxy;
  }

  // 3b. The game's own searches read every entry: each search is one read, "<path> contains <value>" -> yes/no.
  function wrapSearch(U, fn, label) {
    var f = U[fn];
    U[fn] = function (e, t) {
      var r;
      S.searching++;
      try {
        r = f.apply(this, arguments);
      } finally {
        S.searching--;
      }
      var p = e !== null && typeof e === "object" ? S.PATH.get(e) : null;
      if (p && !S.searching && S.on && S.cur) {
        var numeric =
          typeof t === "string" && t.trim() !== "" && !isNaN(Number(t));
        var what = p + " " + label + " " + (numeric ? t : valueOut(t));
        note(what, r);
        log([what, r, stepAt()]);
      }
      return r;
    };
  }

  // The state read through the record: its top level is a copy whose objects are tracked.
  function trackState(live) {
    S.top = {};
    Object.keys(live).forEach((k) => {
      var v = live[k];
      S.top[k] = v !== null && typeof v === "object" ? track(v, k) : v;
    });
    S.stateOf().h = new Proxy(S.top, {
      get(t, k) {
        var v = t[k];
        if (typeof k !== "string") return v;
        if (v !== null && typeof v === "object") return track(S.raw(v), k);
        note(k, v);
        return v;
      },
      set(t, k, v) {
        if (typeof k === "string" && S.on) S.addWrite(k, v);
        t[k] = v;
        return true;
      },
    });
  }

  G.__rec = {
    // After __calc.start: every block of the game and its searches go through the record.
    wrap: () => {
      var hx = G.__hx;
      var owner = {};
      Object.keys(hx).forEach((cls) => {
        var C = hx[cls];
        if (!C) return;
        Object.getOwnPropertyNames(C).forEach((k) => {
          if (k.indexOf("_customBlock_") === 0 && typeof C[k] === "function")
            owner[k] = C;
        });
      });
      Object.keys(owner).forEach((k) => wrapBlock(owner[k], k));
      var U = hx["com.stencyl.utils.Utils"];
      if (U) {
        if (typeof U.mapContainsValue === "function")
          wrapSearch(U, "mapContainsValue", "contains value");
        if (typeof U.contains === "function")
          wrapSearch(U, "contains", "contains");
      }
    },

    // 4 and 5. After __calc.loadMosaic, before the helpers: the caches to rebuild leave the copy, the state is read
    // through the record, and the helpers are recorded under a setup node.
    begin: (recipeJson) => {
      S.recipe = JSON.parse(recipeJson);
      Object.assign(S, { nodes: [], writes: [], spliced: [], pending: null });
      Object.assign(S, { infs: [], infWrites: [] });
      S.searching = 0; // a search cut by a time limit never ran its `finally`
      Object.assign(S, {
        seq: 0,
        bpStart: Infinity,
        builders: null,
        root: null,
      });
      Object.assign(S, { RAW: new WeakMap(), PROX: new WeakMap() });
      Object.assign(S, { PATH: new WeakMap(), LISTED: new WeakMap() });
      seed = 12345;
      var live = S.stateOf().h;
      var players = S.mapOf(live.PlayerDATABASE) || {};
      S.names = new Map(Object.keys(players).map((n, i) => [n, i]));
      S.mon = S.mapOf(live.MonsterDefinitionsGET) || {};
      S.item = S.mapOf(live.ItemDefinitionsGET) || {};
      var dnsm = S.mapOf(live.DNSM) || {};
      S.fromGame = Object.keys(dnsm);
      var bon = S.mapOf(dnsm.CompanionBon) || {};
      var lvz = S.mapOf(dnsm.CompanionLVz) || {};
      S.companions = Object.keys(bon).map(
        (id) => id + ",0,0,0," + (+lvz[id] || 0),
      );
      S.recipe.recompute.forEach((k) => {
        if (hasOwn(dnsm, k)) delete dnsm[k];
      });
      trackState(live);
      S.setup = S.newNode("(setup: game helpers)", [], null);
      S.on = true;
      S.cur = S.setup;
    },

    // In place of __calc.finishHelpers: the context puts the companion caches back from the mosaic, and what the
    // helpers wrote there no longer counts, unless the companions they built equal the game's.
    afterHelpers: () => {
      S.cur = null;
      var dnsm = S.raw(S.top.DNSM);
      var built = dnsm && dnsm.h ? dnsm.h.CompanionBon : undefined;
      G.__calc.finishHelpers();
      if (!dnsm || !dnsm.h) return;
      var b = S.mapOf(S.raw(built));
      var g = S.mapOf(S.raw(dnsm.h.CompanionBon));
      var same =
        !!b &&
        !!g &&
        b !== g &&
        Object.keys(g).length === Object.keys(b).length &&
        Object.keys(g).every((k) => Math.abs(+g[k] - +b[k]) < 1e-12);
      if (same) dnsm.h.CompanionBon = built;
      var back = RESTORED.filter(
        (k) => S.fromGame.includes(k) && !(same && k === "CompanionBon"),
      );
      S.writes = S.writes.filter(
        (w) => !back.some((k) => S.inCache(w.path, k)),
      );
    },

    // 6. The roots, with the game's exact arguments. Then each follow-up [block, mode, then block, then mode]: once for
    // each argument the roots gave that block's mode, the then block with the then mode and that argument (spec 009,
    // FR-018: a Legend Talent's max, which the game's screen shows beside its points).
    roots: (list, follow) => {
      S.root = S.newNode("(root)", [], null);
      S.cur = S.root;
      try {
        list.forEach((c) => {
          G.__calc.call(c[0], c[1]);
        });
        (follow || []).forEach((f) => {
          var seen = {};
          var upTo = S.nodes.length;
          for (var i = 0; i < upTo; i++) {
            var n = S.nodes[i];
            if (n.b !== f[0] || n.a[0] !== f[1]) continue;
            var key = JSON.stringify(n.a[1]);
            if (hasOwn(seen, key)) continue;
            seen[key] = true;
            G.__calc.call(f[2], [f[3], n.a[1], 0]);
          }
        });
      } finally {
        S.stopped();
      }
    },

    stop: () => S.stopped(),
    isOn: () => S.on,

    // The recording, as text made here: nothing of the context crosses as an object. An infinite number is null, as
    // the live tree always had it.
    take: () =>
      JSON.stringify({
        nodes: S.nodes || [],
        writes: S.writes || [],
        spliced: S.spliced || [],
        bpStart: S.bpStart === Infinity ? null : S.bpStart,
        setup: S.setup ? S.setup.id : null,
        root: S.root ? S.root.id : null,
        builders: S.builders ? S.builders.id : null,
        fromGame: S.fromGame || [],
      }),
    // For the answer key only (spec 010, T162: a cost that overflows): the place of each infinite number in the text
    // take() made, as [...path, sign]; tree-record.ts puts it back there.
    infAt: () => {
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
    },
  };
  G.__rec.state = S;
})();
