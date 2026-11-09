/* global XMLHttpRequest, fetch, WebSocket, navigator, process, require, pako */
// An invented game for the calculator's tests: not one line comes from the real game's file, and every name and number
// is made up. It has the shape the calculator expects (one anchor, lime.$scripts.N, a registry of classes and blocks
// that read the state). `Scenario`, in the state, picks what the accuracy and HP blocks do, one behavior per test.
var lime = { $scripts: {} };

// A game that replaces an array method sees what the host hands to it, if the host goes through the context's prototype.
var setCalls = 0;
var contextSet = Uint8Array.prototype.set;
Uint8Array.prototype.set = function (source, offset) {
  setCalls++;
  return contextSet.call(this, source, offset);
};

lime.$scripts.N = function (_exports, $global) {
  var A = {};
  var a = function () {};
  a.prototype.getGameAttribute = function (key) {
    return this.gameAttributes.h[key];
  };
  var state = function () {
    return a.engine.gameAttributes.h;
  };

  var StringMap = function () {
    this.h = {};
  };

  var Script = {
    drawImage: function () {
      throw new Error("a drawing function ran");
    },
  };

  // prettier-ignore
  A["com.stencyl.Engine"]=a,A["com.stencyl.behavior.Script"]=Script;

  A["haxe.ds.StringMap"] = StringMap;
  A["haxe.ds.IntMap"] = function () {
    this.h = {};
    this.isIntMap = true;
  };
  A["haxe.Serializer"] = {};
  A["haxe.Unserializer"] = {};

  var packed = null;
  A["haxe.io.Bytes"] = {
    ofData: function (data) {
      packed = {
        fromContext: data instanceof ArrayBuffer,
        b: new Uint8Array(data),
      };
      return packed;
    },
  };

  var library = null;
  A.ManifestResources = {
    init: function () {
      library = {
        positions: { h: { known: 1 } },
        exists: function () {
          return false;
        },
        getText: function (id) {
          return "text-" + id;
        },
      };
    },
  };
  A["lime.utils.Assets"] = {
    getLibrary: function (name) {
      return name === "default" ? library : null;
    },
  };
  A["lime.utils.Log"] = {
    error: function () {
      throw new Error("the log was not silenced");
    },
  };
  A["js.Boot"] = {
    __string_rec: function (o) {
      return typeof o === "function" ? "not a number" : String(o);
    },
  };

  var definitions = function (entries) {
    return {
      get: function () {
        var map = new StringMap();
        map.h = entries;
        return map;
      },
    };
  };
  A["scripts.ItemDefinitions"] = definitions({ itemA: { v: 1 } });
  A["scripts.ItemDefinitions2"] = definitions({ itemB: { v: 2 } });
  A["scripts.MonsterDefinitions"] = definitions({ mushA: { v: 4 } });
  A["scripts.DialogueDefinitions"] = definitions({ npcA: { v: 8 } });

  var tableCalls = 0;
  A["scripts.CustomLists"] = {
    ListOne: function () {
      tableCalls++;
      return [16];
    },
    takesAnArgument: function (x) {
      tableCalls += 100;
      return x;
    },
  };
  A["scripts.CustomLists2"] = {
    ListTwo: function () {
      return [32];
    },
  };
  A["scripts.CustomLists3"] = {
    ListThree: function () {
      return [64];
    },
  };
  A["scripts.CustomMaps"] = {
    MapOne: function () {
      return { v: 128 };
    },
  };
  A["scripts.CustomMapsREAL"] = {
    MapTwo: function () {
      return { v: 256 };
    },
  };

  var brokenConstructor = function () {
    if (state().Scenario === "noActor")
      throw new Error("this constructor is broken");
  };

  var actorsMade = 0;
  var HelperActor = function (_a, actor) {
    brokenConstructor();
    actorsMade++;
    this.actor = actor;
  };
  HelperActor.prototype.init = function () {
    var s = state();
    if (s.Scenario === "helperThrows") throw new Error("this helper is broken");
    // The values of the mosaic are written back after the helpers: this one never finishes being written.
    if (s.Scenario === "endlessFinish")
      Object.defineProperty(s, "Scenario", {
        set: function () {
          for (;;) {
            // never returns
          }
        },
      });
    A["lime.utils.Log"].error("drawing");
    Script.drawImage();
    s.AFKtarget = "rewritten by a helper";
    s.DNSM.h.CompanionBon.h.b1 = 999;
    s.DNSM.h.ShinyBonusS = new StringMap();
    s.HelperRan = [A["js.Boot"].__string_rec(this.actor.anything(), "")];
  };
  A["scripts.ActorEvents_29"] = HelperActor;

  var EveryScene = function () {
    brokenConstructor();
  };
  EveryScene.prototype.init = function () {
    if (state().Scenario === "endlessInit")
      for (;;) {
        // never returns
      }
    state().EverySceneRan = [1];
  };
  A["scripts.Design_23_23_EveryScene"] = EveryScene;

  var Blocks = function () {};
  A["scripts.ActorEvents_1"] = Blocks;

  var bridge = function (name, key) {
    return $global.React.createElement(name, [key]);
  };

  var seenGlobals = 0;

  // One way to reach out or to generate code per entry; each is counted when it does not throw.
  var attempts = [
    function () {
      new XMLHttpRequest();
    },
    function () {
      fetch("x");
    },
    function () {
      new WebSocket("x");
    },
    function () {
      navigator.sendBeacon("x");
    },
    function () {
      eval("1");
    },
    function () {
      new Function("return 1");
    },
    function () {
      constructor.constructor("return process")();
    },
    function () {
      process;
    },
    function () {
      require;
    },
  ];

  // A hole is a `constructor.constructor` that generated code: the stubs answer with another stub, not with 7.
  var sweepGlobals = function () {
    var holes = 0;
    var probe = function (value) {
      if (
        value === null ||
        (typeof value !== "object" && typeof value !== "function")
      )
        return;
      seenGlobals++;
      try {
        if (value.constructor.constructor("return 7")() === 7) holes++;
      } catch {
        // refused, as it must be
      }
    };
    Object.getOwnPropertyNames($global).forEach(function (name) {
      probe($global[name]);
    });
    probe(Object.getPrototypeOf($global));
    probe($global);
    return holes;
  };

  var accuracyScenarios = {
    globals: function () {
      return seenGlobals;
    },
    save: function () {
      Blocks._customBlock_CloudSAVE();
      Blocks._customBlock_SaveGamee();
      return state().SavedBy ? 1 : 0;
    },
    tables: function (s) {
      if (tableCalls !== 1 || !Array.isArray(s.PixelHelperActor)) return -1;
      return (
        s.ItemDefinitionsGET.h.itemA.v +
        s.ItemDefinitionsGET.h.itemB.v +
        s.MonsterDefinitionsGET.h.mushA.v +
        s.DialogueDefGET.h.npcA.v +
        s.CustomLists.h.ListOne[0] +
        s.CustomLists.h.ListTwo[0] +
        s.CustomLists.h.ListThree[0] +
        s.CustomMaps.h.MapOne.v +
        s.CustomMaps.h.MapTwo.v
      );
    },
    bonus: function (s) {
      return s.DNSM.h.CompanionBon.h.b1 + s.DNSM.h.ShinyBonusS.h.s1;
    },
    actors: function () {
      return actorsMade;
    },
    noActor: function (s) {
      return (
        (s.HelperRan ? 1 : 0) +
        (s.EverySceneRan ? 2 : 0) +
        (s.PixelHelperActor[0] ? 4 : 0)
      );
    },
    helperThrows: function (s) {
      return s.HelperRan[0];
    },
    helper: function (s) {
      return 1 + Number(s.HelperRan[0]) + s.EverySceneRan.length;
    },
    vars: function () {
      return (
        bridge("getServerVarLoad", "TomePct") +
        bridge("getServerVarLoadList", "ArcadeBonuses").h.x
      );
    },
    nothingLoaded: function () {
      var ok =
        bridge("getServerVarLoad", "NotAVar") === -1 &&
        bridge("getServerVarLoadString", "NotAVar") === "" &&
        bridge("getServerVarLoadList", "NotAVar").length === 0 &&
        bridge("getLoad", "NotAVar") === -1 &&
        bridge("getSomethingElse", "x").length === 0 &&
        bridge("anythingElse", "x") === null &&
        bridge("isElectron") === true &&
        bridge("isSteamDeck") === false &&
        bridge("getCompanionInfoMe") === null &&
        bridge("getTime") === -1 &&
        bridge("getLoadString") === "";
      return ok ? 1 : 0;
    },
    lazyDnsm: function () {
      var dnsm = a.engine.getGameAttribute("DNSM");
      var created = Object.keys(dnsm.h.LazyOne.h).length === 0;
      var skipped = !Object.prototype.hasOwnProperty.call(
        dnsm.h,
        "FilledLater",
      );
      return created && skipped ? 1 : 0;
    },
    restored: function (s) {
      var ok =
        s.Base.h.acc === Infinity &&
        s.Base.h.hp === null &&
        s.Typed.isIntMap === true &&
        s.Typed.h.k === 9;
      return ok ? 1 : 0;
    },
    counter: function () {
      $global.runs = ($global.runs || 0) + 1;
      return $global.runs;
    },
    pak: function () {
      return packed.fromContext ? packed.b[1] : -1;
    },
    assets: function () {
      var ok =
        library.exists("a.fnt", "TEXT") === true &&
        library.getText("missing") === "" &&
        library.getText("known") === "text-known";
      return ok ? 1 : 0;
    },
    arraySet: function (s) {
      pako.ungzip(new Uint8Array(s.Packed));
      return setCalls;
    },
    decompress: function (s) {
      var out = pako.ungzip(new Uint8Array(s.Packed));
      if (!(out instanceof Uint8Array)) return -1;
      try {
        pako.inflate(new Uint8Array([1, 2, 3]));
        return -2;
      } catch (e) {
        return e instanceof Error ? out[0] : -3;
      }
    },
  };

  Blocks._customBlock_DamageDealed = function (sub) {
    var s = state();
    if (!s.MonsterDefinitionsGET.h[s.AFKtarget])
      throw new Error("no such monster");
    return sub === "Max" ? s.Damage[0] : s.Damage[1];
  };
  Blocks._customBlock_PlayerHPmax = function () {
    var s = state();
    if (s.Scenario === "throw") throw new Error("this block is broken");
    if (s.Scenario === "notFinite") return NaN;
    if (s.Scenario === "endless")
      for (;;) {
        // never returns
      }
    return s.Base.h.hp;
  };
  Blocks._customBlock_PlayerMPmax = function () {
    if (state().Scenario === "globals") return sweepGlobals();
    var reached = 0;
    attempts.forEach(function (attempt) {
      try {
        attempt();
        reached++;
      } catch {
        // blocked, as it must be
      }
    });
    return reached;
  };
  Blocks._customBlock_PlayerAccTot = function () {
    var s = state();
    var scenario = accuracyScenarios[s.Scenario];
    if (scenario) return scenario(s);
    return s.Base.h.acc;
  };
  Blocks._customBlock_TotalStats = function (sub) {
    return state().Stats[sub];
  };
  Blocks._customBlock_AFKgainrates = function () {
    return state().AfkRate;
  };
  Blocks._customBlock_CloudSAVE = function () {
    state().SavedBy = "CloudSAVE";
  };
  Blocks._customBlock_SaveGamee = function () {
    state().SavedBy = "SaveGamee";
  };

  // In the scenario "order", each number is the turn its block ran in, counted in the state the numbers share.
  [
    "DamageDealed",
    "PlayerHPmax",
    "PlayerMPmax",
    "PlayerAccTot",
    "TotalStats",
    "AFKgainrates",
  ].forEach(function (name) {
    var block = Blocks["_customBlock_" + name];
    Blocks["_customBlock_" + name] = function (sub) {
      var s = state();
      if (s.Scenario !== "order") return block(sub);
      s.Turn = (s.Turn || 0) + 1;
      return s.Turn;
    };
  });

  // The calculator's text scan reads this comment: DNSM").h.LazyOne.h is created for the game; DNSM").h.FilledLater.h is
  // not, because the game fills it itself: .h,"FilledLater")
};
