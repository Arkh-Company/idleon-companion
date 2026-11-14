// Everything that lives inside the calculator's context, loaded as text and run with vm.runInContext (ADR 0006): the
// stubs of the browser, the offline Firebase bridge, the restore of the slices' shapes and the helper actors. No host
// object becomes a property of the context: the three decompressors stay in this closure and answer in context arrays.
(function (ungzip, inflate, inflateRaw) {
  "use strict";
  var G = globalThis;
  var hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  var noop = () => {};
  var zero = () => 0;
  var none = () => null;
  var refuse = function () {
    throw new Error("no network in the calculator");
  };

  var helperStubs = new WeakSet();
  // A permissive stub: any property is another stub, callable and constructible. A helper's stub reads as 0 and hides
  // `then` and the `__` names from the game's reflection.
  function stub(forHelpers) {
    var again = () => stub(forHelpers);
    var hidden = (k) =>
      k === "then" || (typeof k === "string" && k.indexOf("__") === 0);
    var s = new Proxy(function () {}, {
      get: (t, k) => {
        if (k === Symbol.toPrimitive) return zero;
        if (k === "length") return 0;
        if (forHelpers && hidden(k)) return undefined;
        if (t[k] === undefined || t[k] === null) t[k] = again();
        return t[k];
      },
      apply: again,
      construct: again,
    });
    if (forHelpers) helperStubs.add(s);
    return s;
  }

  G.window = G;
  G.self = G;
  G.document = stub(false);
  G.location = { href: "file:///", protocol: "file:", search: "", hash: "" };
  G.localStorage = { getItem: none, setItem: noop, removeItem: noop };
  G.performance = { now: () => Date.now() };
  G.navigator = {
    userAgent: "node",
    platform: "Win32",
    language: "en",
    sendBeacon: refuse,
  };
  G.XMLHttpRequest = refuse;
  G.WebSocket = refuse;
  G.fetch = refuse;
  G.setTimeout = zero;
  G.clearTimeout = noop;
  G.setInterval = zero;
  G.clearInterval = noop;
  G.requestAnimationFrame = zero;
  G.cancelAnimationFrame = noop;
  G.addEventListener = noop;
  G.removeEventListener = noop;
  G.devicePixelRatio = 1;
  G.screen = { width: 1920, height: 1080 };
  G.Image = function () {
    return stub(false);
  };
  G.Audio = G.Image;

  var decompressor = (host) => (data) => {
    var out = host(new Uint8Array(data));
    if (!out) throw new Error("bad compressed data");
    return out;
  };
  G.pako = {
    ungzip: decompressor(ungzip),
    inflate: decompressor(inflate),
    inflateRaw: decompressor(inflateRaw),
  };

  var hx, eng;
  var owner = {};
  var tables = {};
  var vars = {};
  /** The map actors' fields the keeper read on the running game (spec 008 US12), keyed as state-slice.js gives them. */
  var actors = {};
  var mosaicAttrs = {};
  var primitives = {};
  var steps = [];
  var insts = {};
  var everyScene = null;

  // Puts back the shapes the slices travel in: Haxe maps, numbers JSON cannot hold, and what could not be copied.
  function rev(v) {
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) return v.map(rev);
    if ("$n" in v) return Number(v.$n);
    if ("$x" in v) return null;
    var out, keys, i;
    if ("$m" in v) {
      var C = (v.$c && hx[v.$c]) || hx["haxe.ds.StringMap"];
      out = new C();
      out.h = {};
      keys = Object.keys(v.$m);
      for (i = 0; i < keys.length; i++) out.h[keys[i]] = rev(v.$m[keys[i]]);
      return out;
    }
    out = {};
    keys = Object.keys(v);
    for (i = 0; i < keys.length; i++) out[keys[i]] = rev(v[keys[i]]);
    return out;
  }

  // What the game's lib/firebase.js answers when nothing was loaded; the `_vars` of the mosaic answer in its place.
  var bridgeAnswers = {
    isElectron: true,
    isSteamDeck: false,
    getCompanionInfoMe: null,
    getServerVarLoad: -1,
    getLoad: -1,
    getTime: -1,
    getServerVarLoadString: "",
    getLoadString: "",
  };
  G.React = {
    createElement: (name, args) => {
      if (/^getServerVarLoad/.test(name) && args && hasOwn(vars, args[0]))
        return rev(vars[args[0]]);
      if (hasOwn(bridgeAnswers, name)) return bridgeAnswers[name];
      return /^get/.test(name) ? [] : null;
    },
  };

  function newMap() {
    return new hx["haxe.ds.StringMap"]();
  }

  // A definitions class may come numbered: the prefix alone, or followed by digits.
  var definitionsOf = (prefix) =>
    Object.keys(hx).filter(
      (k) => k.indexOf(prefix) === 0 && /^\d*$/.test(k.slice(prefix.length)),
    );

  function defs(prefix) {
    var map = newMap();
    definitionsOf(prefix).forEach((k) => {
      Object.assign(map.h, hx[k].get().h);
    });
    return map;
  }

  // prettier-ignore
  var REQUIRED_CLASSES = ["js.Boot", "lime.utils.Log", "scripts.CustomLists", "scripts.CustomLists2", "scripts.CustomLists3", "scripts.CustomMaps", "scripts.CustomMapsREAL"];
  // prettier-ignore
  var REQUIRED_DEFINITIONS = ["scripts.ItemDefinitions", "scripts.MonsterDefinitions", "scripts.DialogueDefinitions"];

  // A patch that moved one of these would go on in silence, with empty tables or a game that is not quieted.
  function requireClasses() {
    REQUIRED_CLASSES.forEach((name) => {
      if (!hx[name]) throw new Error("missing " + name);
    });
    REQUIRED_DEFINITIONS.forEach((prefix) => {
      if (!definitionsOf(prefix).length) throw new Error("missing " + prefix);
    });
  }

  // Every zero-argument static function of the classes, called once and keyed by its name (research R14).
  function staticTables(names) {
    var map = newMap();
    names.forEach((name) => {
      var C = hx[name];
      Object.getOwnPropertyNames(C).forEach((k) => {
        var isTable =
          k.indexOf("__") !== 0 &&
          typeof C[k] === "function" &&
          C[k].length === 0;
        if (!isTable) return;
        try {
          map.h[k] = C[k]();
        } catch {
          // A table that cannot be built stays out: the block that reads it answers for itself.
        }
      });
    });
    return map;
  }

  var HELPER_FIELD = /^H(\d+)\.(_[A-Za-z]\w*)(?:\[(\d+)\])?$/;
  var MONSTER_FIELD = /^map0\.(_[A-Za-z]\w*)$/;

  // The helpers' fields of the running game, over what their init wrote: a field whole, or one place of a list.
  function liveHelperFields() {
    Object.keys(actors).forEach((key) => {
      var m = HELPER_FIELD.exec(key);
      var pair = m && HELPER_ACTORS.find((p) => p[0] === Number(m[1]));
      var inst = pair && insts["ActorEvents_" + pair[1]];
      if (!inst) return;
      var value = rev(actors[key]);
      var field = inst[m[2]];
      if (m[3] === undefined) inst[m[2]] = value;
      else if (field && typeof field === "object") field[Number(m[3])] = value;
    });
  }

  // An actor with one behavior of the game's own class (the game casts it), holding `fields`.
  function actorWith(id, fields) {
    var name = "ActorEvents_" + id;
    var C = hx["scripts." + name];
    var behavior = Object.assign(
      Object.create(C ? C.prototype : Object.prototype),
      fields,
    );
    return {
      behaviors: { getBehavior: (n) => (n === name ? behavior : null) },
    };
  }

  // The map's first monster and the player's target, read on this map only: an inactive character's map is another one.
  // Without them their places stay empty, and the numbers that read them are unavailable.
  function placeMapActors(live) {
    if (actors.map !== live.CurrentMap) return;
    var monster = {};
    Object.keys(actors).forEach((key) => {
      var m = MONSTER_FIELD.exec(key);
      if (m) monster[m[1]] = rev(actors[key]);
    });
    if (Object.keys(monster).length && Array.isArray(live.MapMonstersList))
      live.MapMonstersList[0] = actorWith(1, monster);
    var me = Array.isArray(live.UserInfo) ? live.UserInfo[0] : null;
    var players = live.OtherPlayers && live.OtherPlayers.h;
    if (!hasOwn(actors, "target._MonsterType") || !players) return;
    var type = rev(actors["target._MonsterType"]);
    players[me] = actorWith(20, {
      _TargetEnemy: type === null ? null : actorWith(1, { _MonsterType: type }),
    });
  }

  function reapply() {
    liveHelperFields();
    var a = eng.gameAttributes.h;
    Object.assign(a, primitives);
    var live = mosaicAttrs.DNSM && mosaicAttrs.DNSM.$m;
    if (!live || !a.DNSM) return;
    ["CompanionBon", "ShinyBonusS", "CompanionLVz"].forEach((k) => {
      if (live[k]) a.DNSM.h[k] = rev(live[k]);
    });
  }

  function mkActor() {
    var behaviors = {
      getBehavior: (n) => (hasOwn(insts, n) ? insts[n] : stub(true)),
      getAttribute: none,
      hasBehavior: (n) => hasOwn(insts, n),
      setAttribute: noop,
    };
    return new Proxy(
      { behaviors: behaviors, ID: 0 },
      {
        get: (t, k) => {
          if (k in t) return t[k];
          if (k === "then") return undefined;
          t[k] = stub(true);
          return t[k];
        },
      },
    );
  }

  // Silences the screen, the sounds and the log: helpers only touch the state.
  function quietGame() {
    var Boot = hx["js.Boot"];
    var stringRec = Boot.__string_rec;
    Boot.__string_rec = function (o, s) {
      return helperStubs.has(o) ? "0" : stringRec.call(this, o, s);
    };
    var kept = [
      "gameAttributes",
      "getGameAttribute",
      "setGameAttribute",
      "scene",
    ];
    var peng = new Proxy(eng, {
      get: (t, k) => {
        if (kept.indexOf(k) >= 0 || typeof k === "symbol") return t[k];
        var v = t[k];
        if (k in t && typeof v !== "function" && v !== null && v !== undefined)
          return v;
        var key = "__s_" + String(k);
        if (!t[key]) t[key] = stub(true);
        return t[key];
      },
    });
    var Log = hx["lime.utils.Log"];
    Log.throwErrors = false;
    ["error", "warn", "info", "debug", "verbose", "print", "println"].forEach(
      (f) => {
        Log[f] = noop;
      },
    );
    hx["com.stencyl.Engine"].engine = peng;
    var Script = hx["com.stencyl.behavior.Script"];
    Script.engine = peng;
    var screen =
      /Image|Layer|Font|Sound|Music|Tween|Camera|Tile|Draw|Particle|Filter|Shake|Background/;
    Object.getOwnPropertyNames(Script).forEach((k) => {
      if (typeof Script[k] === "function" && screen.test(k))
        Script[k] = () => stub(true);
    });
  }

  // prettier-ignore
  var HELPER_ACTORS = [[0, 29], [1, 116], [2, 167], [3, 201], [4, 229], [5, 232], [6, 312], [7, 340], [8, 481], [9, 498], [10, 112], [12, 122], [16, 245], [19, 293], [20, 93], [21, 510], [22, 548], [23, 577], [24, 623], [25, 670], [26, 713], [27, 741], [28, 786]];

  // The steps read the instances and the state when they run, because each calculation starts new ones of both.
  function planHelpers() {
    quietGame();
    var starSigns = () => owner.StarSigns._customBlock_StarSigns(0);
    steps.push(starSigns);
    HELPER_ACTORS.forEach((pair) => {
      steps.push(() => {
        var name = "ActorEvents_" + pair[1];
        var actor = mkActor();
        insts[name] = new hx["scripts." + name](0, actor, 0);
        eng.gameAttributes.h.PixelHelperActor[pair[0]] = actor;
      });
    });
    for (var pass = 0; pass < 2; pass++)
      HELPER_ACTORS.forEach((pair) => {
        steps.push(() => {
          var inst = insts["ActorEvents_" + pair[1]];
          if (inst) inst.init();
        });
      });
    steps.push(starSigns);
    steps.push(() => {
      everyScene = new hx["scripts.Design_23_23_EveryScene"](0, 0);
    });
    steps.push(() => {
      if (everyScene) everyScene.init();
    });
  }

  G.__calc = {
    // After the game's code loaded: runs its entry, empties the blocks that save, and feeds the assets.
    start: (pak) => {
      G.lime.$scripts.N({}, G);
      hx = G.__hx;
      requireClasses();
      Object.keys(hx).forEach((name) => {
        var C = hx[name];
        if (!C) return;
        Object.getOwnPropertyNames(C).forEach((k) => {
          if (k === "_customBlock_CloudSAVE" || k === "_customBlock_SaveGamee")
            C[k] = noop;
          else if (
            k.indexOf("_customBlock_") === 0 &&
            typeof C[k] === "function"
          )
            owner[k.slice(13)] = C;
        });
      });
      hx.ManifestResources.init(null);
      var lib = hx["lime.utils.Assets"].getLibrary("default");
      var getText = lib.getText.bind(lib);
      var exists = lib.exists.bind(lib);
      // Missing text (the fonts) reads as "".
      lib.exists = (id, type) => exists(id, type) || type === "TEXT";
      lib.getText = (id) => (hasOwn(lib.positions.h, id) ? getText(id) : "");
      lib.packedData = hx["haxe.io.Bytes"].ofData(pak.buffer);
      var Engine = hx["com.stencyl.Engine"];
      eng = Object.create(Engine.prototype);
      eng.gameAttributes = newMap();
      eng.scene = { ID: 0, name: "GameScene" };
      Engine.engine = eng;
      hx["com.stencyl.behavior.Script"].engine = eng;
    },

    tables: () => {
      tables = {
        ItemDefinitionsGET: defs("scripts.ItemDefinitions"),
        MonsterDefinitionsGET: defs("scripts.MonsterDefinitions"),
        DialogueDefGET: defs("scripts.DialogueDefinitions"),
        CustomLists: staticTables([
          "scripts.CustomLists",
          "scripts.CustomLists2",
          "scripts.CustomLists3",
        ]),
        CustomMaps: staticTables([
          "scripts.CustomMaps",
          "scripts.CustomMapsREAL",
        ]),
      };
    },

    // Rebuilt inside the context, so that Array and Object are its own; remembers what the helpers rewrite (FR-012).
    loadMosaic: () => {
      var m = JSON.parse(G.__mosaic);
      vars = m.vars || {};
      actors = m.actors || {};
      mosaicAttrs = m.attrs;
      primitives = {};
      var live = {};
      Object.keys(mosaicAttrs).forEach((k) => {
        live[k] = rev(mosaicAttrs[k]);
        if (live[k] !== null && typeof live[k] !== "object")
          primitives[k] = live[k];
      });
      Object.keys(tables).forEach((k) => {
        live[k] = tables[k];
      });
      live.PixelHelperActor = [];
      placeMapActors(live);
      eng.gameAttributes.h = live;
    },

    // Prepares the game's helper actors on stubs, for `helperSteps`.
    helperPlan: (lazyDnsm) => {
      var attrs = eng.gameAttributes.h;
      if (!steps.length) planHelpers();
      insts = {};
      everyScene = null;
      if (attrs.DNSM)
        lazyDnsm.forEach((k) => {
          if (!hasOwn(attrs.DNSM.h, k)) attrs.DNSM.h[k] = newMap();
        });
    },

    // One call, with each error caught here: an error that crossed to the host would have Node decorate its stack with
    // the game's whole 24 MB line. A helper that fails leaves its sub-cases to the numbers that need them.
    helperSteps: () => {
      steps.forEach((step) => {
        try {
          step();
        } catch {
          // Next helper.
        }
      });
    },

    finishHelpers: reapply,

    // Caught here, as in `helperSteps`: this number alone is unavailable. A time limit is not an error and still cuts it.
    // The arguments are the exact ones of the call: the Stats passes (sub, 0, 0), and a tree root its game's arity.
    call: (block, args) => {
      try {
        return owner[block]["_customBlock_" + block].apply(owner[block], args);
      } catch {
        return null;
      }
    },
  };
});
