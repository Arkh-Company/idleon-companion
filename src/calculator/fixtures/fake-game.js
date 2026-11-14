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

  // Each one is answered by the accuracy block, in the scenario of its name. The host's calls reach `__calc` here too.
  var counts = { actors: 0, initPasses: 0, helperCalls: 0 };
  var helperSteps = $global.__calc.helperSteps;
  $global.__calc.helperSteps = function () {
    counts.helperCalls++;
    return helperSteps();
  };

  var HelperActor = function (_a, actor) {
    brokenConstructor();
    counts.actors++;
    this.actor = actor;
  };
  HelperActor.prototype.init = function () {
    var s = state();
    counts.initPasses++;
    // What the running game changes later, as a screen's state: the trees of the live game read it (spec 008 US12).
    this._GenINFO = [0, 0, 0, 7];
    if (s.Scenario === "helperThrows" || s.Scenario === "otherHelpers")
      throw new Error("this helper is broken");
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
    s.DNSM.h.CompanionLVz = new StringMap();
    if (s.Scenario === "companionsBuilt") Blocks._customBlock_TreeCompBuild();
    s.HelperRan = [A["js.Boot"].__string_rec(this.actor.anything(), "")];
  };
  // An event of the helper that builds a cache, as the game's own events do.
  HelperActor.prototype._customEvent_Refill = function () {
    a.engine.getGameAttribute("DNSM").h.TreeCache.h.total =
      state().TreeBase * 2;
  };
  // The event a builder needs first: it prepares a field the builder reads.
  HelperActor.prototype._customEvent_Prepare = function () {
    this._ready = this._mode === "d" ? 2 : 0;
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
    companionLevels: function () {
      return Blocks._customBlock_CompLV2(5) + Blocks._customBlock_CompLV2(6);
    },
    otherHelpers: function (s) {
      return s.EverySceneRan.length;
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
    // A helper's field and the map's first monster, which the live game's actors would change (spec 008 US12).
    liveActors: function (s) {
      var first = s.MapMonstersList && s.MapMonstersList[0];
      return helper()._GenINFO[3] + (first ? 1000 : 0);
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
    throwWatched: function (s) {
      return s.StackReads || 0;
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
    if (s.Scenario === "throwWatched") {
      // Node reads the stack of an error that leaves a vm context, to decorate it.
      var watched = new Error("this block is broken");
      Object.defineProperty(watched, "stack", {
        get: function () {
          s.StackReads = (s.StackReads || 0) + 1;
          return "";
        },
      });
      throw watched;
    }
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
    if (s.Scenario in counts) return counts[s.Scenario];
    var scenario = accuracyScenarios[s.Scenario];
    if (scenario) return scenario(s);
    return s.Base.h.acc;
  };
  Blocks._customBlock_TotalStats = function (sub) {
    if (sub === "calcEtcBonuses") return calcEtcBonuses();
    return state().Stats[sub];
  };
  Blocks._customBlock_AFKgainrates = function () {
    return state().AfkRate;
  };
  // 1 when the companion has its "+": its level is at least 1.
  Blocks._customBlock_CompLV2 = function (n) {
    var level = state().DNSM.h.CompanionLVz.h[n];
    return level >= 1 ? 1 : 0;
  };
  Blocks._customBlock_CloudSAVE = function () {
    state().SavedBy = "CloudSAVE";
  };
  Blocks._customBlock_SaveGamee = function () {
    state().SavedBy = "SaveGamee";
  };

  // The cases of the formula trees (spec 008): each block is one shape the recorder and the assembly must handle. The
  // values they give with fake-mosaic.ts are in its TREE_CASES.
  Blocks._customBlock_TreeReads = function () {
    var s = state();
    return s.TreeStats.h.a + s.TreeStats.h.b;
  };
  // -1 rebuilds the cache, as the game's builders do; any other argument reads it.
  Blocks._customBlock_TreeCacheFill = function (t) {
    if (t === -1) {
      a.engine.getGameAttribute("DNSM").h.TreeCache.h.total =
        state().TreeBase * 2;
      return 0;
    }
    return a.engine.getGameAttribute("DNSM").h.TreeCache.h.total;
  };
  Blocks._customBlock_TreeCacheRead = function () {
    return a.engine.getGameAttribute("DNSM").h.TreeCache.h.total + 1;
  };
  Blocks._customBlock_TreeLoop = function () {
    var list = state().TreeList;
    var total = 0;
    for (var i = 0; i < list.length; i++) total += list[i];
    return total;
  };
  Blocks._customBlock_TreeTextValue = function () {
    var s = state();
    return s.TreeLabel.length + s.UserInfo[0].length;
  };
  Blocks._customBlock_TreeStringLiteral = function () {
    return state().TreeLabel === "an invented literal" ? 2 : 1;
  };
  Blocks._customBlock_TreeTwice = function () {
    return Blocks._customBlock_TreeReads() + Blocks._customBlock_TreeReads();
  };
  Blocks._customBlock_TreeSources = function () {
    return (
      Blocks._customBlock_TreeReads() * Blocks._customBlock_TreeLoop() +
      state().TreeBase
    );
  };
  // A last step that is no sum or product: the block's rows are its calls, then its reads.
  Blocks._customBlock_TreeMaxOf = function () {
    return Math.max(
      Blocks._customBlock_TreeReads(),
      Blocks._customBlock_TreeLoop(),
      state().TreeBase,
    );
  };
  Blocks._customBlock_TreeMinCap = function () {
    return Math.min(state().TreeCapped, 50);
  };
  // A curve that grows toward 40 and never reaches it.
  Blocks._customBlock_TreeDecay = function () {
    var level = state().TreeLevel;
    return (40 * level) / (level + 100);
  };
  Blocks._customBlock_TreeTimesOne = function () {
    var s = state();
    return s.TreeBase * (1 + s.TreeOwned / 100);
  };
  Blocks._customBlock_TreeConditionNo = function () {
    var s = state();
    return s.TreeBase + (s.TreeOwned > 0 ? 5 : 0);
  };
  // The steps of a block (build-tree.cjs 8d): a variable set by an earlier step, a variable changed by `*=`, and two
  // reads with the same value told apart by the code's own path.
  Blocks._customBlock_TreeDef = function () {
    var s = state();
    var part = s.TreeBase * 2;
    return part + 1;
  };
  Blocks._customBlock_TreeAssign = function () {
    var s = state();
    var t = s.TreeBase;
    t *= 3;
    return t + 1;
  };
  // Each other way to change a variable, one after the other, before a step that reads it.
  Blocks._customBlock_TreeAssignAll = function () {
    var s = state();
    var t = s.TreeBase;
    t += 6;
    t -= 2;
    t /= 4;
    t++;
    return t * 5;
  };
  Blocks._customBlock_TreeTwins = function () {
    var s = state();
    return s.TreeTwins[0] + s.TreeTwins[1] * 2;
  };
  // The rows of a block's steps (pieces.cjs explainRaw): a yes/no read tested for 1, an argument of the caller, the
  // entry asked of the call, and a value from an earlier step of the same block.
  Blocks._customBlock_TreeFlag = function () {
    var s = state();
    return s.TreeBase * (s.TreeFlagOn == 1 ? 2 : 1);
  };
  Blocks._customBlock_TreeArg = function (t) {
    return state().TreeBase * t;
  };
  Blocks._customBlock_TreeEntry = function (m, t) {
    return state().TreeBase * t;
  };
  Blocks._customBlock_TreeStepRef = function () {
    var s = state();
    var a = s.TreeBase * 3;
    var b = a;
    return b + s.TreeLevel;
  };
  // A last step that is the index of the table cell the block returns, not its value.
  Blocks._customBlock_TreeIndex = function () {
    var s = state();
    return s.TreeList[1 + 1];
  };
  // A cache filled in a loop (build-tree.cjs 8d2): each turn adds one call's part to the same entry, and two turns give
  // the same number; the reader reads the entry back.
  Blocks._customBlock_TreePart = function (i) {
    return state().TreeTwins[i] * 2;
  };
  Blocks._customBlock_TreeFillLoop = function () {
    var list = state().TreeTwins;
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeSum = new StringMap();
    d.TreeSum.h.v = 0;
    for (var i = 0; i < list.length; i++)
      d.TreeSum.h.v = d.TreeSum.h.v + Blocks._customBlock_TreePart(i);
    return 0;
  };
  Blocks._customBlock_TreeFillRead = function () {
    Blocks._customBlock_TreeFillLoop();
    return a.engine.getGameAttribute("DNSM").h.TreeSum.h.v + 1;
  };
  // The ways a turn adds to a cache (pieces.cjs entryRows): a step with the turn's part, a rounded part beside the
  // running total, and a last write that multiplies it.
  Blocks._customBlock_TreeScaleLoop = function () {
    var s = state();
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeScale = new StringMap();
    d.TreeScale.h.v = 0;
    for (var i = 0; i < s.TreeTwins.length; i++)
      d.TreeScale.h.v = d.TreeScale.h.v + Math.round(s.TreeTwins[i] * 1.5);
    d.TreeScale.h.v = d.TreeScale.h.v * s.TreeBase;
    return 0;
  };
  Blocks._customBlock_TreeScaleRead = function () {
    Blocks._customBlock_TreeScaleLoop();
    return a.engine.getGameAttribute("DNSM").h.TreeScale.h.v;
  };
  // A cache the block computed in one of its own steps and reads back (cacheRows, the step that gives it).
  Blocks._customBlock_TreeOwnStep = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeOwn = new StringMap();
    d.TreeOwn.h.v = state().TreeBase + 1;
    return d.TreeOwn.h.v * 2;
  };
  // A factor the block set, then multiplied by a call, read back by a call it makes ([T3]).
  Blocks._customBlock_TreeFacRead = function () {
    return a.engine.getGameAttribute("DNSM").h.TreeFac.h.v * 1;
  };
  Blocks._customBlock_TreeFactor = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeFac = new StringMap();
    d.TreeFac.h.v = state().TreeBase + 1;
    d.TreeFac.h.v = d.TreeFac.h.v * Blocks._customBlock_TreeArg(1);
    return Blocks._customBlock_TreeFacRead() + 1;
  };
  // A cache the block fills only when it is empty, then reads back ([DEEP-1, fix A]).
  Blocks._customBlock_TreeFillOnce = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    if (!d.TreeOnce) d.TreeOnce = [];
    var t = 0;
    if (d.TreeOnce.length === 0)
      for (var i = 0; i < 2; i++) {
        t = t + Blocks._customBlock_TreePart(i);
        d.TreeOnce[0] = t;
      }
    return d.TreeOnce[0] * 1;
  };
  // A last step that rounds a cache, with no call and nothing else read ([F2-TOP]): only the root opens it.
  Blocks._customBlock_TreeTopRound = function () {
    return Math.round(a.engine.getGameAttribute("DNSM").h.GameCache.h.v * 1.5);
  };
  Blocks._customBlock_TreeTopWrap = function () {
    return Blocks._customBlock_TreeTopRound() + 1;
  };
  Blocks._customBlock_TreeMapActor = function () {
    var actor = state().PixelHelperActor[0];
    return Number(actor.behaviors.getBehavior("ActorEvents_1")._MonsterHPtot);
  };
  // The live game's actors (spec 008 US12): a helper's field, the map's first monster, of the game's own class, and the
  // player's target, or AFKtarget with none. A missing field reads as 0 or as text, as the game's code turns it.
  var helper = function () {
    return state().PixelHelperActor[0].behaviors.getBehavior("ActorEvents_29");
  };
  Blocks._customBlock_TreeHelperField = function () {
    return helper()._GenINFO[3];
  };
  Blocks._customBlock_TreeHelperProto = function () {
    return "polluted" in helper() ? 1 : 0;
  };
  Blocks._customBlock_TreeHelperWhole = function () {
    return helper()._Owned.h.k;
  };
  Blocks._customBlock_TreeMapMonster = function () {
    var b = state().MapMonstersList[0].behaviors.getBehavior("ActorEvents_1");
    return b instanceof Blocks ? b._MonsterHPtot || 0 : -1;
  };
  Blocks._customBlock_TreeTarget = function () {
    var s = state();
    var me = s.OtherPlayers.h[s.UserInfo[0]];
    var t = me.behaviors.getBehavior("ActorEvents_20")._TargetEnemy;
    if (t === null) return s.AFKtarget.length;
    return (
      String(t.behaviors.getBehavior("ActorEvents_1")._MonsterType).length * 10
    );
  };
  Blocks._customBlock_TreeCharacter = function () {
    var s = state();
    return s.CurrentMap + s.PrayersActive.length + s.Cards[2].length;
  };
  // The game's own search: it reads every entry of the map it searches.
  A["com.stencyl.utils.Utils"] = {
    mapContainsValue: function (map, value) {
      for (var k in map.h) if (map.h[k] === value) return true;
      if (value === "forever")
        for (;;) {
          // a search that never ends
        }
      return false;
    },
  };
  Blocks._customBlock_TreeSearchForever = function () {
    return A["com.stencyl.utils.Utils"].mapContainsValue(
      state().TreeBig,
      "forever",
    );
  };
  Blocks._customBlock_TreeSearch = function () {
    var s = state();
    var found = A["com.stencyl.utils.Utils"].mapContainsValue(s.TreeBig, 7);
    return (found ? 1 : 0) + s.TreeBase;
  };
  // A cache that came ready from the running game; the game creates it empty when absent.
  Blocks._customBlock_TreeGameCache = function () {
    return a.engine.getGameAttribute("DNSM").h.GameCache.h.v || 0;
  };
  // How many companions the server bridge says you own (-1 when it answers nothing).
  Blocks._customBlock_TreeCompanions = function () {
    var owned = $global.React.createElement("getCompanionInfoMe", []);
    return owned ? owned.length : -1;
  };
  // A key of the active character in PlayerDATABASE, and a block called with the character's name.
  Blocks._customBlock_TreePlayer = function () {
    var s = state();
    var me = s.UserInfo[0];
    return (
      s.PlayerDATABASE.h[me].h.CurrentMap + Blocks._customBlock_TreeNamed(me)
    );
  };
  Blocks._customBlock_TreeNamed = function (name) {
    return name.length > 0 ? 1 : 0;
  };
  // The recorder's cases of the builders' pass: each one decides who explains a cache read.
  var dnsm = function () {
    return a.engine.getGameAttribute("DNSM").h;
  };
  // Builds the companions from the server bridge's list, equal to the running game's (3 each).
  Blocks._customBlock_TreeCompBuild = function () {
    dnsm().CompanionBon = new StringMap();
    var owned = $global.React.createElement("getCompanionInfoMe", []);
    owned.forEach(function (e) {
      dnsm().CompanionBon.h[e.split(",")[0]] = 3;
    });
  };
  Blocks._customBlock_TreeCompanionRead = function () {
    return dnsm().CompanionBon.h.b1;
  };
  // A builder that gives the cache another number than the game's.
  Blocks._customBlock_TreeCacheWrong = function () {
    dnsm().TreeCache.h.total = 777;
  };
  // A builder that never ends, after it put a new cache in place.
  Blocks._customBlock_TreeEndless = function () {
    dnsm().TreeCache = new StringMap();
    dnsm().TreeCache.h.total = 99;
    for (;;) {
      // never returns
    }
  };
  // A builder that needs the helper's event first: without it, the cache is 0.
  Blocks._customBlock_TreeCacheReady = function () {
    var helper =
      state().PixelHelperActor[0].behaviors.getBehavior("ActorEvents_29");
    if (!dnsm().TreeCache) dnsm().TreeCache = new StringMap();
    dnsm().TreeCache.h.total = state().TreeBase * (helper._ready || 0);
  };
  // A working value every call of the block rewrites, read back by the same call; -1 also builds the cache.
  Blocks._customBlock_TreeScratch = function (t) {
    dnsm().TreeScratch.h.w = state().TreeBase + t;
    if (t === -1) dnsm().TreeCache.h.total = state().TreeBase * 2;
    return a.engine.getGameAttribute("DNSM").h.TreeScratch.h.w;
  };
  // The scene caches the game rebuilds when a character's scene loads (inactive.ts): the Lab's event needs its trigger
  // text, TalentCalc(-7) builds from what the event left, and every TalentCalc leaves a working value in the TotalStats
  // memory, which calcEtcBonuses reads when it is there.
  var LabHelper = function () {};
  LabHelper.prototype.init = function () {};
  LabHelper.prototype._customEvent_Lab = function () {
    if (this._TRIGGEREDtext === "d*") dnsm().LabLinks = state().CurrentMap;
  };
  A["scripts.ActorEvents_548"] = LabHelper;
  Blocks._customBlock_TalentCalc = function (t) {
    if (t === -7) {
      dnsm().LabMFbonuses = new StringMap();
      dnsm().LabMFbonuses.h.v = (dnsm().LabLinks || 0) * 2;
    }
    if (!dnsm().TotStatMAP) dnsm().TotStatMAP = new StringMap();
    dnsm().TotStatMAP.h.STR = 999;
    return 0;
  };
  var calcEtcBonuses = function () {
    var memo = dnsm().TotStatMAP;
    var str =
      memo && memo.h.STR !== undefined ? memo.h.STR : state().CurrentMap;
    dnsm().TotalStatsETCmap = new StringMap();
    dnsm().TotalStatsETCmap.h.drop = str * 10;
    return 0;
  };
  Blocks._customBlock_TreeScene = function () {
    var d = dnsm();
    return d.TotalStatsETCmap.h.drop + d.LabMFbonuses.h.v;
  };
  // How many entries the TotalStats memory holds; -1 without one.
  Blocks._customBlock_TreeMemo = function () {
    var memo = dnsm().TotStatMAP;
    return memo ? Object.keys(memo.h).length : -1;
  };
  var everySceneInit = EveryScene.prototype.init;
  EveryScene.prototype.init = function () {
    everySceneInit.call(this);
    if (state().TreeBase !== undefined) Blocks._customBlock_TreeCacheFill(-1);
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
