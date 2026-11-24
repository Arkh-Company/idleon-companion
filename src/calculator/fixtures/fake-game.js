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
    // The texts the tree worker's names read (game-names.test.ts): invented, in the game's shapes.
    ListNames: function () {
      return [["FIRST_INVENTED_II", 7], ["second|half"]];
    },
    // A cell whose number is the start of its text (T209, form 2), as the game's "50TOT" in HolesInfo[55][15].
    ListTot: function () {
      return ["50TOT"];
    },
    // A cell the game keeps as text, worth a number (TreeWriteCell).
    ListCells: function () {
      return ["7"];
    },
    // The emporium's foods, by its slot (the golden food's case).
    NinjaInfo: function () {
      var list = [];
      list[29] = [0, 0, "itemB"];
      return list;
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
    // A table of the game's shapes for the names' reader: a map inside, keys out of order (game-names.test.ts).
    MapNames: function () {
      var inner = new StringMap();
      inner.h = { b: "BEE", a: [1] };
      var list = ["ZERO"];
      list.h = { 0: "NOT A MAP" };
      return {
        z: inner,
        y: "WHY",
        list: list,
        empty: { h: null },
        text: { h: "AITCH" },
        both: { h: { q: 1 }, a: 2 },
      };
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
    // Spec 010 (T166): the helpers build the cache TreeAuthor twice, by two blocks, to the same number.
    if (s.Scenario === "authorBuilt") {
      Blocks._customBlock_TreeAuthorAgain();
      Blocks._customBlock_TreeAuthorBuild();
    }
    // Spec 010 (T168): the helper builds it by its own event, or by its own code outside any block or event.
    if (s.Scenario === "authorFilled") this._customEvent_TreeAuthorFill();
    if (s.Scenario === "authorInit")
      s.DNSM.h.TreeAuthor.h.v = s.TreeStats.h.a * 5;
    s.HelperRan = [A["js.Boot"].__string_rec(this.actor.anything(), "")];
  };
  // An event of the helper that builds a cache, as the game's own events do.
  HelperActor.prototype._customEvent_Refill = function () {
    a.engine.getGameAttribute("DNSM").h.TreeCache.h.total =
      state().TreeBase * 2;
  };
  // Spec 010 (T166): an event of the helper that builds the cache TreeAuthor itself, outside any block.
  HelperActor.prototype._customEvent_TreeAuthorFill = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = state().TreeStats.h.a * 5;
  };
  // The event a builder needs first: it prepares a field the builder reads.
  HelperActor.prototype._customEvent_Prepare = function () {
    this._ready = this._mode === "d" ? 2 : 0;
  };
  // Spec 010 (T152): a routine of a screen that writes a board into the state, as the game sums its Cog Board.
  HelperActor.prototype._customEvent_TreeBoard = function () {
    var s = state();
    s.TreeBoard = [];
    for (var i = 0; i < s.TreeList.length; i++)
      s.TreeBoard[i] = s.TreeList[i] * (1 + s.TreeStats.h.a / 100);
  };
  // Spec 010 (T156): a routine in two passes by its trigger text, as the Cog Board: m builds each house, z applies
  // the board percent to each house of the copy.
  HelperActor.prototype._customEvent_TreeHouses = function () {
    var s = state();
    if (this._TRIGGEREDtext === "m") {
      this._TreeHouses = [];
      for (var i = 0; i < s.TreeList.length; i++)
        this._TreeHouses[i] = { a: s.TreeList[i] * 2 };
    }
    if (this._TRIGGEREDtext === "z")
      for (var j = 0; j < this._TreeHouses.length; j++)
        this._TreeHouses[j].a =
          this._TreeHouses[j].a * (1 + s.TreeStats.h.a / 100);
  };
  A["scripts.ActorEvents_29"] = HelperActor;

  // Spec 010 (T189): a helper actor in the game's shape whose init builds a cache, as the game's ActorEvents_577
  // builds DNSM.CompanionBon: TreeStats.a × 5 = 15.
  var InitActor = function (_a, actor) {
    this.actor = actor;
  };
  InitActor.__name__ = "scripts.ActorEvents_577";
  InitActor.prototype = {
    init: function () {
      if (state().Scenario !== "initBuilt") return;
      var d = a.engine.getGameAttribute("DNSM").h;
      d.TreeInitBon = new StringMap();
      d.TreeInitBon.h.v = state().TreeStats.h.a * 5;
    },
  };
  A["scripts.ActorEvents_577"] = InitActor;

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
  // spec 009 T031: a block with a mode, its first argument, as the game's Thingies; "Points" of t is t × 3, "Max" of t
  // is t + 1; TreeLegends calls the points of 2 and of 5, the 2 twice
  Blocks._customBlock_TreeLegend = function (mode, t) {
    return mode === "Points" ? t * 3 : mode === "Max" ? t + 1 : 0;
  };
  Blocks._customBlock_TreeLegends = function () {
    return (
      Blocks._customBlock_TreeLegend("Points", 2, 0) +
      Blocks._customBlock_TreeLegend("Points", 5, 0) +
      Blocks._customBlock_TreeLegend("Points", 2, 0)
    );
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
  // The shape of the Drop Rate's chain (spec 009, FR-005): a sum, then each step adds to or multiplies the running total
  // it wrote: + 2, × a single multiplier, + 0.5, × one that sums two bonuses inside, × two single multipliers.
  Blocks._customBlock_TreeChain = function () {
    var s = state();
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeChain = new StringMap();
    d.TreeChain.h.v =
      Blocks._customBlock_TreeReads() + s.TreeBase + s.TreeLevel;
    if (s.TreeFlagOn == 1) d.TreeChain.h.v = d.TreeChain.h.v + 2;
    d.TreeChain.h.v = d.TreeChain.h.v * Blocks._customBlock_TreeLoop();
    d.TreeChain.h.v = d.TreeChain.h.v + 0.5;
    d.TreeChain.h.v =
      d.TreeChain.h.v * (1 + (s.TreeStats.h.a + s.TreeCapped) / 100);
    d.TreeChain.h.v = d.TreeChain.h.v * s.TreeTwins[0] * s.TreeList[1];
    return d.TreeChain.h.v;
  };
  // A chain whose call takes a read no step shows: the block's data row (spec 009, FR-008).
  Blocks._customBlock_TreeChainData = function () {
    var s = state();
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeChainData = new StringMap();
    d.TreeChainData.h.v = s.TreeBase + 1;
    d.TreeChainData.h.v =
      d.TreeChainData.h.v * Blocks._customBlock_TreeArg(s.TreeLevel);
    return d.TreeChainData.h.v;
  };
  // A chain with a step that neither adds nor multiplies (a floor): its pools cannot be read (spec 009, NFR-005).
  Blocks._customBlock_TreeChainOpen = function () {
    var s = state();
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeChainOpen = new StringMap();
    d.TreeChainOpen.h.v = s.TreeBase + 1;
    d.TreeChainOpen.h.v = Math.floor(d.TreeChainOpen.h.v * 1.5);
    d.TreeChainOpen.h.v = d.TreeChainOpen.h.v + 2;
    return d.TreeChainOpen.h.v;
  };
  // The roots the probe of the 716 trees found with no pool (spec 009, T025): a rounded sum of a coefficient times a
  // source; a chain the game clamps at the end, which does not bite; a product with a check and a read no step shows.
  Blocks._customBlock_TreeRoundSum = function () {
    var s = state();
    return Math.round(
      3 * Blocks._customBlock_CardBonusREAL(1) +
        Blocks._customBlock_ArcadeBonus(0) +
        s.TreeLevel,
    );
  };
  Blocks._customBlock_TreeClamped = function () {
    var d = dnsm();
    d.TreeClamp = new StringMap();
    d.TreeClamp.h.v = Blocks._customBlock_TreeReads() + state().TreeBase;
    d.TreeClamp.h.v = d.TreeClamp.h.v * Blocks._customBlock_TreeLoop();
    return Math.max(0.01, d.TreeClamp.h.v);
  };
  Blocks._customBlock_TreeChecked = function () {
    var s = state();
    var level = s.TreeLevel;
    if (level > 100) return 0;
    var v = Blocks._customBlock_TreeReads() * Blocks._customBlock_TreeLoop();
    if (s.TreeOwned > 0) v = v * 2;
    return v;
  };
  // A root the game floors, which cuts a fraction (spec 009, T030; STR, AGI, WIS, LUK): one step, and a chain.
  Blocks._customBlock_TreeFloored = function () {
    return Math.floor(Blocks._customBlock_TreeReads() + state().TreeBase + 0.5);
  };
  Blocks._customBlock_TreeFloorChain = function () {
    var d = dnsm();
    d.TreeFloorChain = new StringMap();
    d.TreeFloorChain.h.v = Blocks._customBlock_TreeReads() + state().TreeBase;
    d.TreeFloorChain.h.v =
      d.TreeFloorChain.h.v * Blocks._customBlock_TreeLoop() * 1.05;
    return Math.floor(d.TreeFloorChain.h.v + 0.3);
  };
  // A golden food opened as a branch, as in the Drop Rate: its pass names its rows (spec 009).
  Blocks._customBlock_TreeGoldOf = function (t) {
    return Blocks._customBlock_GoldFoodBonuses(t) * 2;
  };
  // The shape of the Drop Rate (spec 009, FR-017): its first sum holds a sum the block keeps in a variable (a step with
  // no name) of sources of two systems and of a working value the block writes that only joins sources, a golden food
  // among them; then the running total is multiplied.
  Blocks._customBlock_CardBonusREAL = function (t) {
    return state().TreeBase * t;
  };
  Blocks._customBlock_TreeDrop = function () {
    var s = state();
    var d = dnsm();
    d.TreeDrop = new StringMap();
    d.TreeDropPart = new StringMap();
    d.TreeDropPart.h.v =
      Blocks._customBlock_GoldFoodBonuses("DropRatez") + s.TreeLevel;
    var mix =
      Blocks._customBlock_ArcadeBonus(0) +
      Blocks._customBlock_CardBonusREAL(3) +
      Blocks._customBlock_CardBonusREAL(1) +
      d.TreeDropPart.h.v;
    d.TreeDrop.h.v = s.TreeBase + mix;
    d.TreeDrop.h.v = d.TreeDrop.h.v * Blocks._customBlock_TreeLoop();
    return d.TreeDrop.h.v;
  };
  // The Drop Rate first sum as the game writes it (spec 009, FR-017): bonuses in % summed and divided by 100, among them
  // a product and a working value the block writes that only joins sources, a golden food among them.
  Blocks._customBlock_TreeDropPercent = function () {
    var s = state();
    var d = dnsm();
    d.TreeDropPct = new StringMap();
    d.TreeDropPctPart = new StringMap();
    d.TreeDropPctPart.h.v =
      Blocks._customBlock_GoldFoodBonuses("DropRatez") + s.TreeLevel;
    d.TreeDropPct.h.v =
      s.TreeBase +
      (Blocks._customBlock_ArcadeBonus(0) +
        Blocks._customBlock_CardBonusREAL(3) +
        Blocks._customBlock_CardBonusREAL(1) +
        5 * s.TreeLevel +
        d.TreeDropPctPart.h.v) /
        100 +
      2;
    d.TreeDropPct.h.v = d.TreeDropPct.h.v * Blocks._customBlock_TreeLoop();
    return d.TreeDropPct.h.v;
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
  // Spec 010 (T209, form 4): how many entries a map of the save holds, as the game's D.mapCount(FarmCrop).
  Blocks._customBlock_TreeCount = function () {
    var D = {
      mapCount: function (m) {
        return Object.keys(m.h).length;
      },
    };
    return D.mapCount(a.engine.getGameAttribute("TreeBig")) * state().TreeLevel;
  };
  Blocks._customBlock_TreeCountPool = function () {
    return Blocks._customBlock_TreeCount() + state().TreeCapped;
  };
  // Spec 010 (T209, form 5): a variable of its own the block writes step by step and reads back, as the game's
  // Holes("MonumentROGbonuses") with DNSM.HoleozDN.
  Blocks._customBlock_TreeChained = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    var s = state();
    d.TreeChn = 1 + s.TreeBase / 100;
    d.TreeChn = a.engine.getGameAttribute("DNSM").h.TreeChn + s.TreeLevel / 100;
    return (
      0.1 *
      Math.ceil(
        s.TreeCapped * Math.max(1, a.engine.getGameAttribute("DNSM").h.TreeChn),
      )
    );
  };
  // The same in the game's other working map, as CauldronStats("VialBonus") with DummyNumbersStatManager.
  Blocks._customBlock_TreeChainedDummy = function () {
    var s = state();
    s.DummyNumbersStatManager = new StringMap();
    var d = a.engine.getGameAttribute("DummyNumbersStatManager").h;
    d.TreeChn = 1 + s.TreeBase / 100;
    d.TreeChn =
      a.engine.getGameAttribute("DummyNumbersStatManager").h.TreeChn +
      s.TreeLevel / 100;
    return (
      0.1 *
      Math.ceil(
        s.TreeCapped *
          Math.max(
            1,
            a.engine.getGameAttribute("DummyNumbersStatManager").h.TreeChn,
          ),
      )
    );
  };
  Blocks._customBlock_TreeChainedDummyPool = function () {
    return Blocks._customBlock_TreeChainedDummy() + state().TreeCapped;
  };
  // A working variable summed in a loop turn with a curve, under the code's checks of a list (its length, an item's
  // test), as the game's StampBonusOfTypeX: the checks are no parts, the curve's are its turn's.
  Blocks._customBlock_TreeCurveTurn = function () {
    var s = state();
    s.DummyNumbersStatManager = new StringMap();
    var d = a.engine.getGameAttribute("DummyNumbersStatManager").h;
    d.TreeAcc = 0;
    for (var i = 0; i < s.TreeList.length; i++)
      2 == s.TreeList[i] &&
        Blocks._customBlock_TreeDetails(i) &&
        (d.TreeAcc =
          a.engine.getGameAttribute("DummyNumbersStatManager").h.TreeAcc +
          Blocks._customBlock_ArbitraryCode5Inputs(
            "decay",
            40,
            100,
            s.TreeLevel,
          ));
    return (
      a.engine.getGameAttribute("DummyNumbersStatManager").h.TreeAcc *
      s.TreeBase
    );
  };
  // A call in the turn that gives a list, no number, as the game's StampDetails(37): no part of the count.
  Blocks._customBlock_TreeDetails = function (i) {
    return [i, "details"];
  };
  Blocks._customBlock_TreeCurveTurnPool = function () {
    return Blocks._customBlock_TreeCurveTurn() + state().TreeCapped;
  };
  Blocks._customBlock_TreeChainedPool = function () {
    return Blocks._customBlock_TreeChained() + state().TreeCapped;
  };
  // Spec 010 (T209, form 3): a number of the code the block doubles under conditions, in a variable of its own, as the
  // game's ArcadeBonus doubles DNSM.ArcadBonDNz when the upgrade is at its max and when a companion is owned.
  Blocks._customBlock_TreeOwnedFlag = function () {
    return state().TreeFlagOn;
  };
  Blocks._customBlock_TreeDoubled = function (e) {
    var d = a.engine.getGameAttribute("DNSM").h;
    var s = state();
    d.TreeDbl = 1;
    101 == s.TreeUpg[e]
      ? (d.TreeDbl = 2 * a.engine.getGameAttribute("DNSM").h.TreeDbl)
      : 102 == s.TreeUpg[e] &&
        (d.TreeDbl = 6 * a.engine.getGameAttribute("DNSM").h.TreeDbl);
    1 == Blocks._customBlock_TreeOwnedFlag() &&
      (d.TreeDbl = 2 * a.engine.getGameAttribute("DNSM").h.TreeDbl);
    return a.engine.getGameAttribute("DNSM").h.TreeDbl * s.TreeLevel;
  };
  Blocks._customBlock_TreeDoubledPool = function () {
    return Blocks._customBlock_TreeDoubled(0) + state().TreeCapped;
  };
  // Spec 010 (T209, form 2): a number read from a game table's text with a mark taken out, as the game's
  // Holes("MeasurementBaseBonus") reads asNumber(replace(string(HolesInfo[55][t]), "TOT", "")).
  Blocks._customBlock_TreeTextTot = function () {
    var c = { asNumber: Number };
    var h = { string: String };
    var y = {
      replace: function (s, a, b) {
        return s.split(a).join(b);
      },
    };
    return (
      c.asNumber(
        y.replace("" + h.string(state().CustomLists.h.ListTot[0]), "TOT", ""),
      ) * state().TreeBase
    );
  };
  Blocks._customBlock_TreeTextPool = function () {
    return Blocks._customBlock_TreeTextTot() + state().TreeCapped;
  };
  // Spec 010 (T209, form 1): a source whose count is the block's own argument, as Holes("B_UPG", 82, 20).
  Blocks._customBlock_TreeArgPool = function () {
    return Blocks._customBlock_TreeArg(3) + state().TreeCapped;
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
    // a factor of two reads (a factor of one read with its value would be that read, pieces.cjs structurePass)
    d.TreeScale.h.v = d.TreeScale.h.v * (s.TreeBase + s.TreeOwned);
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
  // The game's search of a list (D.contains): the block caches its answer and tests the cache (HaveW6Trophy, spec 009).
  A["com.stencyl.utils.Utils"].contains = function (list, value) {
    return list.indexOf(value) >= 0;
  };
  Blocks._customBlock_TreeHaveItem = function () {
    var d = dnsm();
    d.TreeHaveItem = A["com.stencyl.utils.Utils"].contains(
      state().Cards[1],
      "itemA",
    )
      ? 1
      : 0;
    return d.TreeHaveItem == 1 ? 10 : 0;
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
  // A golden food's bonus in steps of the shape pieces.cjs goldFood reads: the shared multiplier (a set's multi × (the
  // family's, at least 1, + its sources ÷ 100)), the worn food's part with its logs when one is worn, a level and a
  // whole number, and the emporium's part added to the bonus when its level is above 0, each log a call of its own. A
  // level below 0 ends the block after its third step. The key picks how a step is written, one shape per test; a key
  // ending in Local (percentLocal) takes the shared multiplier of its start and keeps the worn food in the block, as the
  // key local does. (No quote mark in its comments: instrument.ts finds the end of a block by its braces, outside
  // quotes.)
  Blocks._customBlock_getLOG = function (x) {
    return Math.log(x) / Math.LN10;
  };
  Blocks._customBlock_GoldFoodBonuses = function (t) {
    var s = state();
    var d = dnsm();
    var worn = 0;
    var multi;
    if (s.EquipmentOrder[2][1] === "") return 0;
    // the sum of the sources taken as a percent by a product, not a division
    if (t === "percent" || t === "percentLocal")
      multi =
        (1 + (s.GfoodSet[0] + s.GfoodSet[1]) / 100) *
        (Math.max(d.FamBonusQTYs[66], 1) +
          (Blocks._customBlock_TreeReads() + s.TreeBase + d.GameCache.h.v + 3) *
            0.01);
    // a set of one part, then one written with its number last
    else if (t === "oneSet" || t === "oneSetLocal")
      multi =
        (1 + s.GfoodSet[0] / 100) *
        (Math.max(d.FamBonusQTYs[66], 1) +
          (Blocks._customBlock_TreeReads() + s.TreeBase + d.GameCache.h.v + 3) /
            100);
    else if (t === "setLast" || t === "setLastLocal")
      multi =
        (s.GfoodSet[0] / 100 + 1) *
        (Math.max(d.FamBonusQTYs[66], 1) +
          (Blocks._customBlock_TreeReads() + s.TreeBase + d.GameCache.h.v + 3) /
            100);
    // a family of at least 2, which the ⓘ of the bench does not read
    else if (t === "atTwo" || t === "atTwoLocal")
      multi =
        (1 + (s.GfoodSet[0] + s.GfoodSet[1]) / 100) *
        (Math.max(d.FamBonusQTYs[66], 2) +
          (Blocks._customBlock_TreeReads() + s.TreeBase + d.GameCache.h.v + 3) /
            100);
    else
      multi =
        (1 + (s.GfoodSet[0] + s.GfoodSet[1]) / 100) *
        (Math.max(d.FamBonusQTYs[66], 1) +
          (Blocks._customBlock_TreeReads() + s.TreeBase + d.GameCache.h.v + 3) /
            100);
    // the part of the worn food: kept in the block, rounded, added to the bonus, or the bonus itself
    if (
      s.EquipmentQuantity[2][1] > 0 &&
      (t === "local" || t.slice(-5) === "Local")
    )
      worn =
        d.GfoodMap.h.Amount *
        multi *
        0.05 *
        Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) *
        (1 + Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) / 2.14);
    else if (s.EquipmentQuantity[2][1] > 0 && t === "round")
      d.GfoodBonus = Math.round(
        d.GfoodMap.h.Amount *
          multi *
          0.05 *
          Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) *
          (1 +
            Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) / 2.14),
      );
    else if (s.EquipmentQuantity[2][1] > 0 && t === "added")
      d.GfoodBonus =
        d.GfoodBonus +
        d.GfoodMap.h.Amount *
          multi *
          0.05 *
          Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) *
          (1 +
            Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) / 2.14);
    else if (s.EquipmentQuantity[2][1] > 0)
      d.GfoodBonus =
        d.GfoodMap.h.Amount *
        multi *
        0.05 *
        Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) *
        (1 + Blocks._customBlock_getLOG(1 + s.EquipmentQuantity[2][1]) / 2.14);
    var level = s.Ninja[104][0] * 1;
    if (level < 0) return multi;
    var whole = Math.floor(multi);
    if (level <= 0 || s.CustomLists.h.NinjaInfo[29][2] === "")
      return d.GfoodBonus + worn + whole * Blocks._customBlock_TreeReads() * 0;
    // the part of the emporium: added to a value of the block, to another read, times 1, inside a max, twice, or to the
    // bonus
    if (t === "local" || t.slice(-5) === "Local")
      return (
        worn +
        d.GfoodMap.h.Amount *
          multi *
          0.05 *
          Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level))
      );
    if (t === "other")
      return (
        s.GfoodStart +
        d.GfoodMap.h.Amount *
          multi *
          0.05 *
          Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level))
      );
    if (t === "scaled")
      d.GfoodBonus =
        (d.GfoodBonus +
          d.GfoodMap.h.Amount *
            multi *
            0.05 *
            Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level))) *
        1;
    else if (t === "inFn")
      d.GfoodBonus =
        d.GfoodBonus +
        Math.max(
          d.GfoodMap.h.Amount *
            multi *
            0.05 *
            Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level)),
          0,
        );
    else if (t === "twice") {
      d.GfoodBonus =
        d.GfoodBonus +
        d.GfoodMap.h.Amount *
          multi *
          0.01 *
          Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level));
      d.GfoodBonus =
        d.GfoodBonus +
        d.GfoodMap.h.Amount *
          multi *
          0.05 *
          Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level));
    } else if (t === "njs")
      // as N.js writes it: the emporium has the quantity factor too, of its own log
      d.GfoodBonus =
        d.GfoodBonus +
        d.GfoodMap.h.Amount *
          multi *
          0.05 *
          Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level)) *
          (1 +
            Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level)) / 2.14);
    else
      d.GfoodBonus =
        d.GfoodBonus +
        d.GfoodMap.h.Amount *
          multi *
          0.05 *
          Blocks._customBlock_getLOG(1 + 1e3 * Math.pow(10, level));
    return d.GfoodBonus;
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
  // The rename by the rows above a row (pieces.cjs rename): a doubler under ArcadeBonus, the parts of a monument's cache
  // (two of them at x1), and a bubble's scratch number read under the bubble's cache, under a call, in a branch and under
  // a call of the branch.
  Blocks._customBlock_ArcadeBonus = function () {
    return state().TreeBase * 2;
  };
  // A running total of zeros its own block reads back (the game's FishingToolkit and its weight + line, 009 T023)
  Blocks._customBlock_TreeZeroTotal = function () {
    var s = state();
    var d = dnsm();
    d.TreeZero = [];
    d.TreeZero.push(0);
    d.TreeZero.push(0);
    for (var i = 0; i < 2; i++) d.TreeZero[i] = d.TreeZero[i] + s.TreeOwned;
    for (var j = 0; j < 2; j++) d.TreeZero[j] = d.TreeZero[j] + s.TreeOwned;
    return d.TreeZero[0] + d.TreeZero[1] + s.TreeBase;
  };
  // A multiplier of one lone % times a clamp plus a sum of bonuses in % ÷ 100, two of them times a constant (audit
  // family 14): its second factor is an unnamed sum of sources of several systems; TreeMeritOf calls it as a source.
  // As in the game's own block, its sources are named calls (one with a colon, "Arcade: …", the two times a constant
  // named after their source), and the clamp is around a call whose value it leaves as it is.
  Blocks._customBlock_TreeMeritMulti = function () {
    var s = state();
    return 0 >= s.TreeOwned
      ? (1 + Blocks._customBlock_ArcadeBonus(1) / 100) *
          (Math.min(8, Math.max(0.25, Blocks._customBlock_ArcadeBonus(3))) +
            (5 * Blocks._customBlock_ArcadeBonus(4) +
              (Blocks._customBlock_ArcadeBonus(2) +
                (20 * Blocks._customBlock_ArcadeBonus(5) +
                  (Blocks._customBlock_CardBonusREAL(1) +
                    (s.TreeLevel + Blocks._customBlock_TreeReads()))))) /
              100)
      : 0;
  };
  Blocks._customBlock_TreeMeritOf = function () {
    return Blocks._customBlock_TreeMeritMulti() * state().TreeCapped;
  };
  // A factor of the bonuses of one system, some taken away, at least a floor (the prayers factor of the game's
  // accuracy): max(0.1, 1 + (a - b - c) / 100), each a prayer's bonus; TreePrayerOf multiplies a sum by it, so that it
  // is alone in its pool, as in the game.
  Blocks._customBlock_prayersReal = function (i, j) {
    return state().TreeBase * [0, 15, 4, 2][i] + j;
  };
  Blocks._customBlock_TreePrayerOf = function () {
    var s = state();
    return (
      (s.TreeLevel + s.TreeBase) *
      Math.max(
        0.1,
        1 +
          (Blocks._customBlock_prayersReal(1, 0) -
            Blocks._customBlock_prayersReal(2, 1) -
            Blocks._customBlock_prayersReal(3, 0)) /
            100,
      )
    );
  };
  // The Multi pools of the game, as its drop rate writes them (fix tree-shape-091): a total multiplied by single factors
  // of one source each, 1 + x / 100 and 1 + 5 x / 100, then by companions in a product with a floor and a cap,
  // max(1, min(1.3, 1 + a) (1 + 0.5 b)), beside max(1, min(1.01, 1 + c / 2500)). A companion gives its bonus when it
  // is in the cache of the owned ones, as in the game; a charm its bonus of the list TreeCharms.
  Blocks._customBlock_Ninja = function (mode, i) {
    return mode === "PristineBon" ? state().TreeCharms[i] : 0;
  };
  Blocks._customBlock_Companions = function (n) {
    var bonus = dnsm().CompanionBon.h[n];
    return bonus === undefined ? 0 : bonus;
  };
  Blocks._customBlock_TreeShapeMulti = function () {
    var s = state();
    var d = dnsm();
    d.TreeShape = new StringMap();
    d.TreeShape.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeShape.h.v =
      d.TreeShape.h.v *
      (1 + Blocks._customBlock_Ninja("PristineBon", 3, 0) / 100) *
      (1 + (5 * Blocks._customBlock_CardBonusREAL(1)) / 100);
    d.TreeShape.h.v =
      d.TreeShape.h.v *
      Math.max(
        1,
        Math.min(1.3, 1 + Blocks._customBlock_Companions(26)) *
          (1 + 0.5 * Blocks._customBlock_Companions(160)),
      ) *
      Math.max(
        1,
        Math.min(1.01, 1 + Blocks._customBlock_Companions(50) / 2500),
      );
    return d.TreeShape.h.v;
  };
  // The caps of the game, as its max damage writes them (fix tree-shape-091): three parts of a working value, each
  // capped as c + max((x - c)^e, 0) or c (x / c)^e, twice in a row; the first part summed with sources before its caps,
  // two companions among them
  // and with a read after them, the others multiplied, the second by 1 + (a + b) / 100 of two systems too, the third in
  // two steps; then the parts multiplied.
  Blocks._customBlock_TreeShapeCaps = function () {
    var s = state();
    var L = a.engine.getGameAttribute("DummyNumbersStatManager").h
      .DamageDealtLIST;
    L[0] =
      L[0] +
      Blocks._customBlock_ArcadeBonus(0) * 1000 +
      Blocks._customBlock_Labb("BaseDamage", 0, 0) +
      Blocks._customBlock_Companions(26) +
      Blocks._customBlock_Companions(50) +
      s.TreeLevel;
    L[0] = 4000 + Math.max(Math.pow(L[0] - 4000, 0.9), 0);
    L[0] = 5000 + Math.max(Math.pow(L[0] - 5000, 0.8), 0);
    L[0] = L[0] + s.TreeOwned;
    L[1] =
      L[1] *
      Blocks._customBlock_TreeLoop() *
      (1 + Blocks._customBlock_Ninja("PristineBon", 3, 0) / 100) *
      (1 +
        (Blocks._customBlock_CardBonusREAL(1) +
          Blocks._customBlock_ArcadeBonus(0)) /
          100);
    L[1] = 10 + Math.max(Math.pow(L[1] - 10, 0.86), 0);
    L[1] = 20 * Math.pow(L[1] / 20, 0.5);
    L[2] = L[2] * (1 + Blocks._customBlock_Ninja("PristineBon", 3, 0) / 100);
    L[2] = L[2] * (1 + Blocks._customBlock_CardBonusREAL(1) / 100);
    L[2] = 2 * Math.pow(L[2] / 2, 0.6);
    L[2] = L[2] * Blocks._customBlock_TreeLoop();
    return L[0] * L[1] * L[2];
  };
  // A block of the Lab whose mode says its bonus, as the game names some: BaseDamage gives 7.
  Blocks._customBlock_Labb = function (mode) {
    return mode === "BaseDamage" ? 7 : 0;
  };
  // Factors of several sources inside a step the chain reads back (fix tree-shape-091, round 1), as the max damage and
  // the drop rate write them: a bonus times a count added to the first part, 1 + (a + b) / 100 of two systems and
  // 1 + min(100, a count times a bonus) / 100 multiplying the second.
  Blocks._customBlock_TreeShapeLoose = function () {
    var s = state();
    var L = a.engine.getGameAttribute("DummyNumbersStatManager").h
      .DamageDealtLIST;
    L[0] =
      L[0] +
      s.TreeOwned +
      (Blocks._customBlock_Ninja("PristineBon", 3, 0) * (s.TreeLevel / 1)) /
        100;
    L[1] =
      L[1] *
      (1 +
        (Blocks._customBlock_CardBonusREAL(1) +
          Blocks._customBlock_ArcadeBonus(0)) /
          100) *
      (1 +
        Math.min(
          100,
          s.TreeLevel * Blocks._customBlock_Ninja("PristineBon", 2, 0),
        ) /
          100);
    L[2] = L[2] * Blocks._customBlock_TreeLoop();
    return L[0] * L[1] * L[2];
  };
  // A running total that starts from a source (TreeBase, 4) and whose turns add 0 (fix/tree-scratch-keys)
  Blocks._customBlock_TreeStartTotal = function () {
    var s = state();
    var d = dnsm();
    d.TreeStart = [];
    d.TreeStart.push(0);
    d.TreeStart[0] = s.TreeBase;
    for (var i = 0; i < 2; i++) d.TreeStart[0] = d.TreeStart[0] + s.TreeOwned;
    return d.TreeStart[0] + s.TreeLevel;
  };
  // A box that holds the item in turn, read by its field, as the game's worn items in TotalStats (fix/tree-scratch-keys)
  Blocks._customBlock_TreeWorn = function () {
    var s = state();
    var d = dnsm();
    d.TreeWornSum = 0;
    for (var i = 0; i < s.TreeItems.length; i++) {
      d.TreeWornNow = s.TreeItems[i];
      d.TreeWornSum = d.TreeWornSum + d.TreeWornNow.v;
    }
    return d.TreeWornSum + s.TreeLevel;
  };
  // A builder of the game's cache whose scratch box is written twice before its step reads it, as the game's slot whose
  // talents count (fix/tree-scratch-keys): -1 builds the cache, any other argument reads it
  Blocks._customBlock_TreeWho = function (t) {
    var d = dnsm();
    if (t !== -1) return d.TreeWhoCache.h.total;
    d.TreeWho = 8;
    d.TreeWho = state().TreeBase + state().TreeLevel;
    d.TreeWhoCache.h.total = d.TreeWho * 2;
    return 0;
  };
  Blocks._customBlock_TreeArcade = function () {
    return Blocks._customBlock_ArcadeBonus(0) + 1;
  };
  Blocks._customBlock_TreeMonument = function () {
    var d = dnsm();
    d.MonumentROGbonuses = new StringMap();
    d.MonumentROGbonuses.h.v = state().TreeBase * 3 * 1 * 1;
    return d.MonumentROGbonuses.h.v + 1;
  };
  Blocks._customBlock_TreeBubbleLeaf = function () {
    return dnsm().CalcTalentDN2 + state().TreeBase;
  };
  Blocks._customBlock_TreeBubbleInner = function () {
    return (dnsm().CalcTalentDN2 + Blocks._customBlock_TreeBubbleLeaf()) * 5;
  };
  Blocks._customBlock_TreeBubble = function () {
    var d = dnsm();
    d.AlchBubbles = new StringMap();
    d.AlchBubbles.h.W2 =
      Blocks._customBlock_TreeBubbleInner() + dnsm().CalcTalentDN2;
    return d.AlchBubbles.h.W2 * 2;
  };
  // Spec 010 (T017): the roots of the answer key. A curve by its mode, under the game's curve block name (the lock's
  // not-leaf list knows it; T027); a talent of the tree character on a curve whose arguments differ, a luck on a curve
  // with three equal arguments, and the best of all characters.
  Blocks._customBlock_ArbitraryCode5Inputs = function (mode, top, mid, level) {
    if (mode === "add") return mid === 0 ? top * level : 0;
    return mode === "decay" ? (top * level) / (level + mid) : 0;
  };
  Blocks._customBlock_TreeDeclTalent = function (i) {
    var s = state();
    var level = s.PlayerDATABASE.h[s.UserInfo[0]].h.SkillLevels[i];
    return Blocks._customBlock_ArbitraryCode5Inputs("decay", 40, 100, level);
  };
  Blocks._customBlock_TreeDeclLuck = function () {
    var level = state().TreeLevel - 5;
    return Blocks._customBlock_ArbitraryCode5Inputs("decay", 20, 20, level);
  };
  // Spec 010 (T200, the Drop Rate's LUK): a source whose value passes through a working value read twice by a curve,
  // as the game's DropRateLUK: the term's references are the same call twice.
  Blocks._customBlock_TreeLinkTwice = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeLinkL = Blocks._customBlock_TreeDeclLuck();
    d.TreeLinkL = (d.TreeLinkL + 1) / (d.TreeLinkL + 4);
    return 1.4 * d.TreeLinkL + state().TreeCapped;
  };
  Blocks._customBlock_TreeDeclBest = function () {
    var s = state();
    var best = 0;
    var names = s.GetPlayersUsernames;
    for (var i = 0; i < names.length; i++)
      best = Math.max(best, s.PlayerDATABASE.h[names[i]].h.SkillLevels[1]);
    return best;
  };
  // Spec 010 (T164): a leaf's call that reads only a game table, and one that reads only the map it stands on.
  Blocks._customBlock_TreeDeclTable = function () {
    return state().CustomLists.h.ListTwo[0] + 1;
  };
  Blocks._customBlock_TreeDeclMap = function () {
    return state().CurrentMap + 1;
  };
  // Spec 010 (T166): a cache built before the root by a block of the recipe, and roots that only read it, in a pool or
  // in a call of the pool. Another block builds the same cache to the same number: with both, two possible authors.
  Blocks._customBlock_TreeAuthorBuild = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = state().TreeBase * 3 + state().TreeStats.h.a;
  };
  Blocks._customBlock_TreeAuthorAgain = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = state().TreeStats.h.a * 5;
  };
  // Spec 010 (T208): a block that writes the cache in a part every argument runs, as the game's TalentCalc writes
  // DNSM.BoxRewards for any argument up to 0; what follows depends on the argument.
  Blocks._customBlock_TreeAuthorAny = function (k) {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = state().TreeBase * 3 + state().TreeStats.h.a;
    d.TreeAuthorOwn = new StringMap();
    d.TreeAuthorOwn.h.v = k * 2;
  };
  Blocks._customBlock_TreeAuthorRead = function () {
    return (
      a.engine.getGameAttribute("DNSM").h.TreeAuthor.h.v + state().TreeCapped
    );
  };
  Blocks._customBlock_TreeAuthorCall = function () {
    return a.engine.getGameAttribute("DNSM").h.TreeAuthor.h.v * 2;
  };
  Blocks._customBlock_TreeAuthorDeep = function () {
    return Blocks._customBlock_TreeAuthorCall() + state().TreeCapped;
  };
  // Spec 010 (T187): a call that returns the cache bare, as the game's EtcBonuses returns DNSM.TotalStatsETCmap: its
  // author, a builder, is no call of its own.
  Blocks._customBlock_TreeAuthorBare = function () {
    return a.engine.getGameAttribute("DNSM").h.TreeAuthor.h.v;
  };
  Blocks._customBlock_TreeAuthorBareRoot = function () {
    return Blocks._customBlock_TreeAuthorBare() + state().TreeCapped;
  };
  // Spec 010 (T191): a builder whose writes have no step of their own, as the game's companions (a CompanionDB cell)
  // and family bonuses (FamilyBonsuesREAL's value): v is TreeBig k2 (7), w TreeWriteCall's TreeBase × 2 (8); the root
  // is 7 + 8 + 80 = 95.
  Blocks._customBlock_TreeWriteCall = function () {
    return state().TreeBase * 2;
  };
  Blocks._customBlock_TreeWriteBare = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeWriteBon = new StringMap();
    d.TreeWriteBon.h.v = state().TreeBig.h.k2;
    d.TreeWriteBon.h.w = Blocks._customBlock_TreeWriteCall();
  };
  Blocks._customBlock_TreeWriteRead = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    return d.TreeWriteBon.h.v + d.TreeWriteBon.h.w + state().TreeCapped;
  };
  // Spec 010 (T191 r1): a builder with no step that writes v from a local variable, then calls a block worth the same
  // (TreeBig k2, 7): the call came after the write, so the write's count is the read; the root is 7 + 80 = 87.
  Blocks._customBlock_TreeWriteSeven = function () {
    return state().TreeBig.h.k2;
  };
  Blocks._customBlock_TreeWriteLate = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeWriteLate = new StringMap();
    var k = state().TreeBig.h.k2;
    d.TreeWriteLate.h.v = k;
    Blocks._customBlock_TreeWriteSeven();
  };
  // Spec 010 (Fase 4 r2): an author with no step writes the literal 7, then reads a table's text cell "7"; the root is
  // 7 + 80 = 87.
  Blocks._customBlock_TreeWriteCell = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeWriteCell = new StringMap();
    d.TreeWriteCell.h.v = 7;
    return state().CustomLists.h.ListCells[0];
  };
  Blocks._customBlock_TreeWriteCellRead = function () {
    return (
      a.engine.getGameAttribute("DNSM").h.TreeWriteCell.h.v + state().TreeCapped
    );
  };
  Blocks._customBlock_TreeWriteLateRead = function () {
    return (
      a.engine.getGameAttribute("DNSM").h.TreeWriteLate.h.v + state().TreeCapped
    );
  };
  // Spec 010 (T189): a root that reads the cache an actor's init built (InitActor): 15 + 80 = 95.
  Blocks._customBlock_TreeInitRead = function () {
    return (
      a.engine.getGameAttribute("DNSM").h.TreeInitBon.h.v + state().TreeCapped
    );
  };
  // A block that builds the cache by summing a list in a loop over its own last value: 3 + 2 + 4 + 6 = 15.
  Blocks._customBlock_TreeAuthorLoop = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = state().TreeStats.h.a;
    for (var i = 0; i < state().TreeList.length; i++)
      d.TreeAuthor.h.v = d.TreeAuthor.h.v + Blocks._customBlock_TreeTurnItem(i);
  };
  // Spec 010 (T168): a block that builds the cache from 0 by summing a list in a loop over its own last value, one item
  // a turn: 2 + 4 + 6 = 12.
  Blocks._customBlock_TreeAuthorSum = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = 0;
    for (var i = 0; i < state().TreeList.length; i++)
      d.TreeAuthor.h.v = d.TreeAuthor.h.v + Blocks._customBlock_TreeTurnItem(i);
  };
  // Spec 010 (T192): a block that sums into a key not yet set, as the game's Gallery sums a nametag's bonus: the first
  // turn adds to the 0 of the empty key (asNumber of nothing): 2 + 4 + 6 = 12.
  Blocks._customBlock_TreeAuthorKey = function () {
    var U = A["com.stencyl.utils.Utils"];
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    for (var i = 0; i < state().TreeList.length; i++)
      d.TreeAuthor.h.v =
        U.asNumber(d.TreeAuthor.h.v) + Blocks._customBlock_TreeTurnItem(i);
  };
  // Spec 010 (T168 r1): blocks that write the cache from 0 more than once, a turn only a write that adds to its own
  // value: an overwrite by a product (TreeTurnItem(0) × 2 = 4), by a sum of two parts (2 + 4 = 6), two items in the
  // same turn (3 + 6 + 9 = 18), and an overwrite before the turns (4 + 4 + 6 = 14).
  Blocks._customBlock_TreeAuthorProduct = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = 0;
    d.TreeAuthor.h.v = Blocks._customBlock_TreeTurnItem(0) * 2;
  };
  Blocks._customBlock_TreeAuthorParts = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = 0;
    d.TreeAuthor.h.v =
      Blocks._customBlock_TreeTurnItem(0) + Blocks._customBlock_TreeTurnItem(1);
  };
  Blocks._customBlock_TreeAuthorPair = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = 0;
    for (var i = 0; i < state().TreeList.length; i++)
      d.TreeAuthor.h.v =
        d.TreeAuthor.h.v +
        Blocks._customBlock_TreeTurnItem(i) +
        state().TreeList[i];
  };
  // Spec 010 (T168 r1): the author of TreeAuthor reads TreeOther, which TreeOtherBuild wrote (4 + 1 = 5), in its write's
  // count (× 2 = 10), then writes TreeOther itself (the same number) and reads it again after that one write.
  Blocks._customBlock_TreeOtherBuild = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeOther = new StringMap();
    d.TreeOther.h.v = state().TreeBase + 1;
  };
  Blocks._customBlock_TreeAuthorNested = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = d.TreeOther.h.v * 2;
    d.TreeOther.h.v = d.TreeAuthor.h.v / 2;
    return d.TreeOther.h.v * 3;
  };
  Blocks._customBlock_TreeAuthorMixed = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeAuthor = new StringMap();
    d.TreeAuthor.h.v = 0;
    d.TreeAuthor.h.v = Blocks._customBlock_TreeTurnItem(0) * 2;
    for (var i = 1; i < state().TreeList.length; i++)
      d.TreeAuthor.h.v = d.TreeAuthor.h.v + Blocks._customBlock_TreeTurnItem(i);
  };
  // Spec 010 (T168): a block that reads the cache the helpers built, writes it itself (the same number) and returns it
  // read back: the read it returns saw its own write, a passage, not the helpers' cache its first step read.
  Blocks._customBlock_TreeAuthorPlaces = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    var first = d.TreeAuthor.h.v * 2;
    d.TreeAuthor.h.v = first / 2;
    return d.TreeAuthor.h.v * 3;
  };
  Blocks._customBlock_TreeAuthorPlacesRoot = function () {
    return Blocks._customBlock_TreeAuthorPlaces() + state().TreeCapped;
  };
  // Spec 010 (T169-T171): a stat's bonus summed over the items a list equips, each its bonus of the stat times a shared
  // multi, as the game's star signs (the tests give TreeSigns, TreeSignBonus and TreeSignMulti): over [1, 2, 3], with
  // bonuses 5, 10, 20 and a multi of 2, 70. A root adds it to TreeCapped; a builder puts it in a cache another root reads.
  Blocks._customBlock_TreeSign = function (stat, sign) {
    var s = state();
    return s.TreeSignBonus.h[stat][sign] * s.TreeSignMulti;
  };
  Blocks._customBlock_TreeSigns = function (stat) {
    var s = state();
    var t = 0;
    for (var i = 0; i < s.TreeSigns.length; i++)
      t = t + Blocks._customBlock_TreeSign(stat, s.TreeSigns[i]);
    return t;
  };
  Blocks._customBlock_TreeSignsRoot = function () {
    return Blocks._customBlock_TreeSigns("Drop") + state().TreeCapped;
  };
  Blocks._customBlock_TreeSignsBuild = function () {
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeSignsDrop = new StringMap();
    d.TreeSignsDrop.h.v = Blocks._customBlock_TreeSigns("Drop");
  };
  Blocks._customBlock_TreeSignsCached = function () {
    return (
      a.engine.getGameAttribute("DNSM").h.TreeSignsDrop.h.v + state().TreeCapped
    );
  };
  // Spec 010 (T170, T171, review r1): a multi read twice with two values (raised between the reads); a level that is a
  // call closing by its own count, as the game's Seraph (1 + a summoning level ÷ 100), times the multi and a call that
  // reads only a game table. Each under a root that adds TreeCapped.
  Blocks._customBlock_TreeMultiTwice = function () {
    var s = state();
    var first = s.TreeSignMulti;
    s.TreeSignMulti = first + 1;
    return first + s.TreeSignMulti;
  };
  Blocks._customBlock_TreeMultiTwiceRoot = function () {
    return Blocks._customBlock_TreeMultiTwice() + state().TreeCapped;
  };
  Blocks._customBlock_TreeSeraph = function () {
    return 1 + state().TreeSummonLv / 100;
  };
  Blocks._customBlock_TreeSeraphLine = function () {
    return (
      state().TreeSignMulti *
      Blocks._customBlock_TreeSeraph() *
      Blocks._customBlock_TreeDeclTable()
    );
  };
  Blocks._customBlock_TreeSeraphRoot = function () {
    return Blocks._customBlock_TreeSeraphLine() + state().TreeCapped;
  };
  // Spec 010 (review r2): a Seraph that reads a cache (the TreeSignsDrop a builder writes) in place of a save's level
  Blocks._customBlock_TreeCachedSeraph = function () {
    return 1 + a.engine.getGameAttribute("DNSM").h.TreeSignsDrop.h.v / 100;
  };
  Blocks._customBlock_TreeCachedSeraphLine = function () {
    return state().TreeSignMulti * Blocks._customBlock_TreeCachedSeraph();
  };
  Blocks._customBlock_TreeCachedSeraphRoot = function () {
    return Blocks._customBlock_TreeCachedSeraphLine() + state().TreeCapped;
  };
  // Spec 010 (T173): a line counted as a recipe below it, as the game's LUK: floor((TreeBase + TreeLevel + 2) × (1 +
  // TreeStats.b ÷ 100)), two pools, a constant and a floor (4, 25 and 5: 32). A root adds it to TreeCapped; a builder
  // counts the same in a cache another root reads.
  Blocks._customBlock_TreeRecipeLine = function () {
    var s = state();
    return Math.floor(
      (s.TreeBase + s.TreeLevel + 2) * (1 + s.TreeStats.h.b / 100),
    );
  };
  Blocks._customBlock_TreeRecipeRoot = function () {
    return Blocks._customBlock_TreeRecipeLine() + state().TreeCapped;
  };
  // Spec 010 (T172, the LUK's % Multi with its Star Signs): the line as the second part of a term,
  // floor((TreeCapped + TreeLevel) × (1 + (TreeStats.a + TreeRecipeLine()) ÷ 100)).
  Blocks._customBlock_TreeRecipePart = function () {
    var s = state();
    return Math.floor(
      (s.TreeCapped + s.TreeLevel) *
        (1 + (s.TreeStats.h.a + Blocks._customBlock_TreeRecipeLine()) / 100),
    );
  };
  Blocks._customBlock_TreeRecipeBuild = function () {
    var s = state();
    var d = a.engine.getGameAttribute("DNSM").h;
    d.TreeRecipe = new StringMap();
    d.TreeRecipe.h.v = Math.floor(
      (s.TreeBase + s.TreeLevel + 2) * (1 + s.TreeStats.h.b / 100),
    );
  };
  // Spec 010 (T174, T175): a table's items summed in a loop, in a running total, only where the game tests them on
  // (TreeActiveOn; 2 adds the item twice), then times TreeSignMulti, as the game's active star signs: over the bonuses
  // 5, 10, 20, 40 with 1, 0, 1, 1 on and a multi of 2, (5 + 20 + 40) × 2 = 130. In TreeActiveMixed, every turn but the
  // last writes the total through a call's value, with no step of its own: the turns do not part by their place.
  Blocks._customBlock_TreeActiveSum = function () {
    var s = state();
    var d = dnsm();
    var i;
    d.TreeActive = new StringMap();
    for (d.TreeActive.h.v = 0, i = 0; i < s.TreeActiveBonus.length; i++) {
      if (s.TreeActiveOn[i] >= 1)
        d.TreeActive.h.v = d.TreeActive.h.v + s.TreeActiveBonus[i];
      if (s.TreeActiveOn[i] === 2)
        d.TreeActive.h.v = d.TreeActive.h.v + s.TreeActiveBonus[i];
    }
    d.TreeActive.h.v = d.TreeActive.h.v * s.TreeSignMulti;
    return d.TreeActive.h.v;
  };
  Blocks._customBlock_TreeActiveAdd = function (t, x) {
    return t + x;
  };
  Blocks._customBlock_TreeActiveMixed = function () {
    var s = state();
    var d = dnsm();
    var i;
    var last = s.TreeActiveBonus.length - 1;
    d.TreeActiveMixed = new StringMap();
    for (d.TreeActiveMixed.h.v = 0, i = 0; i <= last; i++)
      if (i < last)
        d.TreeActiveMixed.h.v = Blocks._customBlock_TreeActiveAdd(
          d.TreeActiveMixed.h.v,
          s.TreeActiveBonus[i],
        );
      else d.TreeActiveMixed.h.v = d.TreeActiveMixed.h.v + s.TreeActiveBonus[i];
    d.TreeActiveMixed.h.v = d.TreeActiveMixed.h.v * s.TreeSignMulti;
    return d.TreeActiveMixed.h.v;
  };
  // Spec 010 (T176): the game's star signs. Each item's base is a number of the code, added to its field only where the
  // game's test finds the item in TreeBaseOn, the field read before its first write as nothing (0); TreeBasePasses 2
  // runs the items twice (the chip's second pass). Then each field over 0 is multiplied, in a loop over the fields:
  // with items 0, 2, 3 and 4 on, a is 5, b is 5 + 12 = 17 and c is 3; × 2 × (1 + 50 ÷ 100), b gives 51.
  var asNumber = function (x) {
    return x === undefined || x === null ? 0 : Number(x);
  };
  A["com.stencyl.utils.Utils"].asNumber = asNumber;
  Blocks._customBlock_TreeBaseSum = function () {
    var U = A["com.stencyl.utils.Utils"];
    var d = dnsm();
    var n, k, x, y;
    d.TreeBases = new StringMap();
    for (n = 0; n < state().TreeBasePasses; n++) {
      if (U.contains(a.engine.getGameAttribute("TreeBaseOn"), "0")) {
        x = 5 + U.asNumber(dnsm().TreeBases.h.a);
        dnsm().TreeBases.h.a = x;
      }
      if (U.contains(a.engine.getGameAttribute("TreeBaseOn"), "1")) {
        x = 7 + U.asNumber(dnsm().TreeBases.h.b);
        dnsm().TreeBases.h.b = x;
      }
      if (U.contains(a.engine.getGameAttribute("TreeBaseOn"), "2")) {
        x = 5 + U.asNumber(dnsm().TreeBases.h.b);
        dnsm().TreeBases.h.b = x;
      }
      if (U.contains(a.engine.getGameAttribute("TreeBaseOn"), "3")) {
        x = 12 + U.asNumber(dnsm().TreeBases.h.b);
        dnsm().TreeBases.h.b = x;
      }
      if (U.contains(a.engine.getGameAttribute("TreeBaseOn"), "4")) {
        x = 3 + U.asNumber(dnsm().TreeBases.h.c);
        dnsm().TreeBases.h.c = x;
      }
    }
    var keys = Object.keys(dnsm().TreeBases.h);
    for (k = 0; k < keys.length; k++)
      if (0 < U.asNumber(dnsm().TreeBases.h[keys[k]])) {
        y =
          U.asNumber(dnsm().TreeBases.h[keys[k]]) *
          a.engine.getGameAttribute("TreeBaseMulti") *
          (1 + a.engine.getGameAttribute("TreeBaseMeritoc") / 100);
        dnsm().TreeBases.h[keys[k]] = y;
      }
    return dnsm().TreeBases.h.b;
  };
  // Spec 010 (T177): a running total kept in a counter of the game, as the LUK's base: the loop's index in RunI, the
  // total in RunDN, the gear added in a loop through a variable, then the gallery and the hat, the last step reading the
  // total: floor(TreeLevel + RunDN). Gear 5, 7 and 9, gallery 11, hat 2: 34; + 25 = 59.
  Blocks._customBlock_TreeRunTotal = function () {
    var U = A["com.stencyl.utils.Utils"];
    var r, t;
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = 0;
    for (r = 0; r < a.engine.getGameAttribute("TreeGear").length; r++) {
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunI = r;
      t = U.asNumber(
        a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
      );
      t += U.asNumber(a.engine.getGameAttribute("TreeGear")[r]);
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = t;
    }
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN =
      U.asNumber(a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN) +
      U.asNumber(a.engine.getGameAttribute("TreeGallery"));
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN =
      U.asNumber(a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN) +
      U.asNumber(a.engine.getGameAttribute("TreeHat"));
    return Math.floor(
      a.engine.getGameAttribute("TreeLevel") +
        U.asNumber(
          a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
        ),
    );
  };
  // Spec 010 (T177 r1): the STR's base, a running total that also multiplies: the gear in a loop through a variable,
  // the gallery through a variable, then × (1 + (TreeStats.a + TreeStats.b) / 100) inside the test of an if (no step
  // of the whole call), then the hat; the end first: floor(TreeLevel + (1 + TreeBase / 100) × (RunDN + TreeCapped)).
  // Gear 5, 7 and 9 and gallery 11: 32; × 1.08 = 34.56; + 2 = 36.56; + 80 = 116.56; × 1.04 = 121.2224; + 25, floored: 146.
  Blocks._customBlock_TreeRunTimes = function () {
    var U = A["com.stencyl.utils.Utils"];
    var r, t, i;
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = 0;
    for (r = 0; r < a.engine.getGameAttribute("TreeGear").length; r++) {
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunI = r;
      t = U.asNumber(
        a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
      );
      t += U.asNumber(a.engine.getGameAttribute("TreeGear")[r]);
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = t;
    }
    t = a.engine.getGameAttribute("DummyNumbersStatManager");
    i =
      U.asNumber(a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN) +
      U.asNumber(a.engine.getGameAttribute("TreeGallery"));
    t.h.RunDN = i;
    if (
      (-1 == a.engine.getGameAttribute("TreeDungeon") &&
        ((t = a.engine.getGameAttribute("DummyNumbersStatManager")),
        (i =
          U.asNumber(
            a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
          ) *
          (1 +
            (a.engine.getGameAttribute("TreeStats").h.a +
              a.engine.getGameAttribute("TreeStats").h.b) /
              100)),
        (t.h.RunDN = i)),
      -1 == a.engine.getGameAttribute("TreeDungeon"))
    ) {
      t = a.engine.getGameAttribute("DummyNumbersStatManager");
      i =
        U.asNumber(
          a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
        ) + U.asNumber(a.engine.getGameAttribute("TreeHat"));
      t.h.RunDN = i;
    }
    return Math.floor(
      a.engine.getGameAttribute("TreeLevel") +
        (1 + a.engine.getGameAttribute("TreeBase") / 100) *
          (U.asNumber(
            a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
          ) +
            a.engine.getGameAttribute("TreeCapped")),
    );
  };
  // Spec 010 (T177 r1): the Accuracy's total, a running total that multiplies, read after another term of a sum: it
  // does not open, and the root stands: floor(TreeLevel + RunDN), RunDN = TreeGallery × (1 + TreeStats.a / 100).
  // 11 × 1.03 = 11.33; + 25 = 36.33, floored: 36.
  Blocks._customBlock_TreeRunPow = function () {
    var U = A["com.stencyl.utils.Utils"];
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = U.asNumber(
      a.engine.getGameAttribute("TreeGallery"),
    );
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN =
      U.asNumber(a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN) *
      (1 + a.engine.getGameAttribute("TreeStats").h.a / 100);
    return Math.floor(
      a.engine.getGameAttribute("TreeLevel") +
        U.asNumber(
          a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
        ),
    );
  };
  // Spec 010 (T177 r1): two calls of one block that give the same value, the first in no step (the AGI's talents at 0):
  // the step's call is the one that returned at its place, never the first one of that value. 25 + 0 = 25.
  Blocks._customBlock_TreeFlat = function () {
    return 0;
  };
  Blocks._customBlock_TreeTwoCalls = function () {
    var s = state();
    Blocks._customBlock_TreeFlat(1);
    return s.TreeLevel + Blocks._customBlock_TreeFlat(2);
  };
  // Spec 010 (T177 r2): in the first turn of a running total's loop, two calls of one block with the same value through
  // variables (no step of the code of their own) and a later read of that value; in the last turn, two values (the
  // whole call's steps see only those): no place tells the first turn's calls apart, so the answer key refuses the root,
  // never ties a call to the read. Gear 3 and 3: 3 * 3 + 3 and 4 * 5 + 3, 35; + 25 = 60.
  Blocks._customBlock_TreeThree = function (k) {
    return [3, 3, 4, 5][k];
  };
  // Spec 010 (T177 r4): a variable set by a call before the loop, added in each turn after a read: the call is in no
  // turn, and the second turn's read has its value (gear 5 and 3); the variable never ties to that read. The total
  // starts at 1, so no turn's own total holds 3: 1 + 3 + 3 = 7; + 25 = 32.
  Blocks._customBlock_TreeRunEarly = function () {
    var U = A["com.stencyl.utils.Utils"];
    var r, t;
    var m = Blocks._customBlock_TreeThree(0);
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = 1;
    for (r = 0; r < a.engine.getGameAttribute("TreeGear").length; r++) {
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunI = r;
      t = U.asNumber(
        a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
      );
      U.asNumber(a.engine.getGameAttribute("TreeGear")[r]);
      t += m;
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = t;
    }
    return Math.floor(
      a.engine.getGameAttribute("TreeLevel") +
        U.asNumber(
          a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
        ),
    );
  };
  // Spec 010 (T177 r4): a variable set by a block's call through asNumber, another variable or a ? :, after a read with
  // the call's value (gear 5 and 3): the data flow gives the call, never the read. 25 + 3 = 28.
  Blocks._customBlock_TreeViaWrapped = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    var x = U.asNumber(Blocks._customBlock_TreeThree(0));
    return a.engine.getGameAttribute("TreeLevel") + x;
  };
  // the call through asNumber right in the step, with no variable
  Blocks._customBlock_TreeWrappedDirect = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    return (
      a.engine.getGameAttribute("TreeLevel") +
      U.asNumber(Blocks._customBlock_TreeThree(0))
    );
  };
  Blocks._customBlock_TreeViaChain = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    var y = Blocks._customBlock_TreeThree(0);
    var x = y;
    return a.engine.getGameAttribute("TreeLevel") + x;
  };
  Blocks._customBlock_TreeViaTernary = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    var x =
      a.engine.getGameAttribute("TreeLevel") > 0
        ? Blocks._customBlock_TreeThree(0)
        : 0;
    return a.engine.getGameAttribute("TreeLevel") + x;
  };
  // Spec 010 (T177 r5): the call anywhere in the step's leaf or in the variable's expression, never a read by its value
  Blocks._customBlock_TreeTernaryDirect = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    return (
      a.engine.getGameAttribute("TreeLevel") +
      (a.engine.getGameAttribute("TreeLevel") > 0
        ? Blocks._customBlock_TreeThree(0)
        : 0)
    );
  };
  Blocks._customBlock_TreeViaFloor = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    var x = Math.floor(Blocks._customBlock_TreeThree(0));
    return a.engine.getGameAttribute("TreeLevel") + x;
  };
  // Spec 010 (T177 r6): a chain of 7 variables from a call through Math.floor, read first at its far end in code that
  // never runs (past the 6 hops the data flow follows), then nearer the call: the near read is the call's value, never
  // the read with it. 25 + 3 = 28.
  Blocks._customBlock_TreeFarChain = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    var b1 = Math.floor(Blocks._customBlock_TreeThree(0));
    var b2 = b1;
    var b3 = b2;
    var b4 = b3;
    var b5 = b4;
    var b6 = b5;
    var b7 = b6;
    if (a.engine.getGameAttribute("TreeLevel") < 0) return b7 * 2;
    return a.engine.getGameAttribute("TreeLevel") + b2;
  };
  // a ? : right in the step whose side that ran is a read, with the call on the side that did not: the read stands
  Blocks._customBlock_TreeTernaryRead = function () {
    return (
      a.engine.getGameAttribute("TreeLevel") +
      (a.engine.getGameAttribute("TreeLevel") < 0
        ? Blocks._customBlock_TreeThree(0)
        : a.engine.getGameAttribute("TreeGear")[1])
    );
  };
  // the call in what set a variable before `t += …`, through another variable: what t was is the call, never the read
  Blocks._customBlock_TreeAddToChain = function () {
    var U = A["com.stencyl.utils.Utils"];
    U.asNumber(a.engine.getGameAttribute("TreeGear")[1]);
    var y = Blocks._customBlock_TreeThree(0);
    var t = y;
    t += a.engine.getGameAttribute("TreeLevel");
    return Math.floor(t);
  };
  // Spec 010 (T177 r3): a root whose answer key stands, over a call whose own step reads a variable set by one of two
  // calls of TreeThree with the same value: only the lock, descending into that call, meets them. 25 + 3 * 2 = 31.
  Blocks._customBlock_TreeTwinKid = function () {
    var x = Blocks._customBlock_TreeThree(0);
    Blocks._customBlock_TreeThree(1);
    return x * 2;
  };
  Blocks._customBlock_TreeTwinRoot = function () {
    var s = state();
    return s.TreeLevel + Blocks._customBlock_TreeTwinKid();
  };
  // Spec 010 (T183): a source zeroed by an early return: its gate TreeOwned is 0, so it gives 0 before its count; the
  // root is 25 + 0 = 25.
  Blocks._customBlock_TreeGateBonus = function () {
    var s = state();
    if (s.TreeOwned < 1) return 0;
    return s.TreeBase * s.TreeOwned;
  };
  Blocks._customBlock_TreeGateRoot = function () {
    return state().TreeLevel + Blocks._customBlock_TreeGateBonus();
  };
  // Spec 010 (bare return): a call that returns a read with no step of its own (a cache, a table's cell), its one
  // step aside: TreeBig k2 is 7; the root is 25 + 7 = 32.
  Blocks._customBlock_TreeBareRead = function () {
    var s = state();
    var twice = s.TreeBase * 2;
    if (twice > 100) return twice;
    return s.TreeBig.h.k2;
  };
  Blocks._customBlock_TreeBareRoot = function () {
    return state().TreeLevel + Blocks._customBlock_TreeBareRead();
  };
  // Spec 010 (T184, T185 r1): a call worth 7 (TreeWriteSeven) and a step, then the bare read of 7 returned. Made before
  // the step, the call is no return; made after it, with the read at the same place, the place does not decide. The
  // root is 7 + 7 + 25 = 39.
  Blocks._customBlock_TreeEarlyCall = function () {
    var s = state();
    Blocks._customBlock_TreeWriteSeven();
    var twice = s.TreeBase * 2;
    return twice && s.TreeBig.h.k2;
  };
  Blocks._customBlock_TreeLateCall = function () {
    var s = state();
    var twice = s.TreeBase * 2;
    Blocks._customBlock_TreeWriteSeven();
    return twice && s.TreeBig.h.k2;
  };
  // Spec 010 (Fase 4 r3): a variable set by a call worth 7, then a read of 7 and another call worth 7 before its
  // return: the last call is not the one the variable took.
  Blocks._customBlock_TreeVarTwoCalls = function () {
    var s = state();
    var r = Blocks._customBlock_TreeWriteSeven();
    Blocks._customBlock_TreeWriteSeven(s.TreeBig.h.k2);
    return r;
  };
  Blocks._customBlock_TreeVarTwoCallsRoot = function () {
    return Blocks._customBlock_TreeVarTwoCalls() + state().TreeLevel;
  };
  Blocks._customBlock_TreeEarlyRoot = function () {
    return (
      Blocks._customBlock_TreeEarlyCall() +
      Blocks._customBlock_TreeLateCall() +
      state().TreeLevel
    );
  };
  // Spec 010 (literal return): a 1 the code picks by a test on a read (an achievement done), with no step of its own;
  // the root is 25 + 1 = 26.
  Blocks._customBlock_TreeDone = function () {
    var s = state();
    if (s.TreeOwned < 1) return 1;
    return 0;
  };
  Blocks._customBlock_TreeDoneRoot = function () {
    return state().TreeLevel + Blocks._customBlock_TreeDone();
  };
  // Spec 010 (T184): two talents of one code on an `add` curve, its level a step before the curve's call: with ×1 the
  // level and the curve are both 27, with ×4 the curve is 108. The return is the call by its place, in both.
  Blocks._customBlock_TreeAddTalent = function (k) {
    var level = state().TreeLevel + 2;
    return Blocks._customBlock_ArbitraryCode5Inputs("add", [1, 4][k], 0, level);
  };
  Blocks._customBlock_TreeAddTalents = function () {
    return (
      Blocks._customBlock_TreeAddTalent(0) +
      Blocks._customBlock_TreeAddTalent(1)
    );
  };
  // Spec 010 (T177 r3): the same turns with the read of 3 before the calls and only the first call used, through a
  // variable: the variable's call comes from the data flow, never from the read with its value. 3 + 4 = 7; + 25 = 32.
  Blocks._customBlock_TreeRunTwinRead = function () {
    var U = A["com.stencyl.utils.Utils"];
    var r, t;
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = 0;
    for (r = 0; r < a.engine.getGameAttribute("TreeGear").length; r++) {
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunI = r;
      t = U.asNumber(
        a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
      );
      U.asNumber(a.engine.getGameAttribute("TreeGear")[r]);
      var x = Blocks._customBlock_TreeThree(2 * r);
      Blocks._customBlock_TreeThree(2 * r + 1);
      t += x;
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = t;
    }
    return Math.floor(
      a.engine.getGameAttribute("TreeLevel") +
        U.asNumber(
          a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
        ),
    );
  };
  Blocks._customBlock_TreeRunTwins = function () {
    var U = A["com.stencyl.utils.Utils"];
    var r, t;
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = 0;
    for (r = 0; r < a.engine.getGameAttribute("TreeGear").length; r++) {
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunI = r;
      t = U.asNumber(
        a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
      );
      var x = Blocks._customBlock_TreeThree(2 * r);
      var y = Blocks._customBlock_TreeThree(2 * r + 1);
      t += x * y + U.asNumber(a.engine.getGameAttribute("TreeGear")[r]);
      a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN = t;
    }
    return Math.floor(
      a.engine.getGameAttribute("TreeLevel") +
        U.asNumber(
          a.engine.getGameAttribute("DummyNumbersStatManager").h.RunDN,
        ),
    );
  };
  // Spec 010 (T179): the equipment's base, as the LUK's: two rows of slots, each turn adds the base of the item the
  // save puts in the slot, from the game's table by the item's name (TreeGearOrder[r][o]), and the slot's upgrade when
  // it has one: floor(TreeLevel + total). itemA (1) + 3, itemB (2), itemA (1) + 5: 12; + 25 = 37.
  Blocks._customBlock_TreeGearTable = function () {
    var U = A["com.stencyl.utils.Utils"];
    var r, o, t, i, u, g;
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.GearDN = 0;
    for (r = 0; r < 2; r++)
      for (o = 0; o < a.engine.getGameAttribute("TreeGearOrder")[r].length; o++)
        ((a.engine.getGameAttribute("DummyNumbersStatManager").h.GearI = o),
          (i = a.engine.getGameAttribute("TreeGearMap")[r][o]),
          Object.prototype.hasOwnProperty.call(i.h, "v")
            ? ((i = a.engine.getGameAttribute("DummyNumbersStatManager")),
              (t = U.asNumber(
                a.engine.getGameAttribute("DummyNumbersStatManager").h.GearDN,
              )),
              (u = a.engine.getGameAttribute("ItemDefinitionsGET")),
              (g = "" + a.engine.getGameAttribute("TreeGearOrder")[r][o]),
              (t +=
                U.asNumber(u.h[g].v) +
                U.asNumber(a.engine.getGameAttribute("TreeGearMap")[r][o].h.v)),
              (i.h.GearDN = t))
            : ((i = a.engine.getGameAttribute("DummyNumbersStatManager")),
              (t = U.asNumber(
                a.engine.getGameAttribute("DummyNumbersStatManager").h.GearDN,
              )),
              (u = a.engine.getGameAttribute("ItemDefinitionsGET")),
              (g = "" + a.engine.getGameAttribute("TreeGearOrder")[r][o]),
              (t += U.asNumber(u.h[g].v)),
              (i.h.GearDN = t)));
    return Math.floor(
      a.engine.getGameAttribute("TreeLevel") +
        U.asNumber(
          a.engine.getGameAttribute("DummyNumbersStatManager").h.GearDN,
        ),
    );
  };
  // Spec 010 (T178): the code writes the end first, as the LUK: floor(TreeLevel + (1 + (TreeStats.a + TreeStats.b) /
  // 100) × (TreeBase + TreeCapped)); 25 + 1.08 × 84 = 115.72, floored to 115.
  Blocks._customBlock_TreeEndFirst = function () {
    var s = state();
    return Math.floor(
      s.TreeLevel +
        (1 + (s.TreeStats.h.a + s.TreeStats.h.b) / 100) *
          (s.TreeBase + s.TreeCapped),
    );
  };
  Blocks._customBlock_TreeRecipeCached = function () {
    return (
      a.engine.getGameAttribute("DNSM").h.TreeRecipe.h.v + state().TreeCapped
    );
  };
  // Spec 010 (T173 r1): a builder that writes four fields to 32, as the game's star signs write one a stat: TreeTwinA
  // and TreeTwinB in two writes each, TreeTwinC and TreeTwinD in one. B and C count as TreeRecipeLine (31, then floor
  // of × 1.05); A and D are (TreeTwinX + TreeTwinY) × TreeTwinZ, the tests give 10, 6 and 2. A root reads B, one C.
  Blocks._customBlock_TreeRecipeTwin = function () {
    var s = state();
    var d = dnsm();
    d.TreeTwinA = new StringMap();
    d.TreeTwinA.h.v = s.TreeTwinX + s.TreeTwinY;
    d.TreeTwinA.h.v = d.TreeTwinA.h.v * s.TreeTwinZ;
    d.TreeTwinB = new StringMap();
    d.TreeTwinB.h.v = s.TreeBase + s.TreeLevel + 2;
    d.TreeTwinB.h.v = Math.floor(d.TreeTwinB.h.v * (1 + s.TreeStats.h.b / 100));
    d.TreeTwinC = new StringMap();
    d.TreeTwinC.h.v = Math.floor(
      (s.TreeBase + s.TreeLevel + 2) * (1 + s.TreeStats.h.b / 100),
    );
    d.TreeTwinD = new StringMap();
    d.TreeTwinD.h.v = (s.TreeTwinX + s.TreeTwinY) * s.TreeTwinZ;
  };
  Blocks._customBlock_TreeRecipeTwinB = function () {
    return dnsm().TreeTwinB.h.v + state().TreeCapped;
  };
  Blocks._customBlock_TreeRecipeTwinC = function () {
    return dnsm().TreeTwinC.h.v + state().TreeCapped;
  };
  // Spec 010 (T167): a sum of a list in a loop, one item a turn, each a call of its own; a sum whose items were all
  // called before its loop (the turns do not part by their place); a sum that adds the same read in each turn. Each
  // under a root that adds TreeCapped.
  Blocks._customBlock_TreeTurnItem = function (i) {
    return state().TreeList[i] * 2;
  };
  Blocks._customBlock_TreeTurns = function () {
    var t = 0;
    for (var i = 0; i < state().TreeList.length; i++)
      t = t + Blocks._customBlock_TreeTurnItem(i);
    return t;
  };
  Blocks._customBlock_TreeTurnsBefore = function () {
    var items = [
      Blocks._customBlock_TreeTurnItem(0),
      Blocks._customBlock_TreeTurnItem(1),
    ];
    var t = 0;
    for (var i = 0; i < items.length; i++) t = t + items[i];
    return t;
  };
  Blocks._customBlock_TreeTurnsSame = function () {
    var t = 0;
    for (var i = 0; i < 2; i++) t = t + state().TreeBase;
    return t;
  };
  Blocks._customBlock_TreeTurnsRoot = function () {
    return Blocks._customBlock_TreeTurns() + state().TreeCapped;
  };
  Blocks._customBlock_TreeTurnsBeforeRoot = function () {
    return Blocks._customBlock_TreeTurnsBefore() + state().TreeCapped;
  };
  Blocks._customBlock_TreeTurnsSameRoot = function () {
    return Blocks._customBlock_TreeTurnsSame() + state().TreeCapped;
  };
  // A product in a loop (no sum of turns), and a sum in a loop the call returns with one more term after it.
  Blocks._customBlock_TreeTurnsProduct = function () {
    var t = 1;
    for (var i = 0; i < state().TreeList.length; i++)
      t = t * Blocks._customBlock_TreeTurnItem(i);
    return t;
  };
  Blocks._customBlock_TreeTurnsThen = function () {
    var t = 0;
    for (var i = 0; i < state().TreeList.length; i++)
      t = t + Blocks._customBlock_TreeTurnItem(i);
    return t + state().TreeBase;
  };
  // A sum in a loop whose item is a part of an expression, not a call nor a read.
  Blocks._customBlock_TreeTurnsMixed = function () {
    var t = 0;
    for (var i = 0; i < state().TreeList.length; i++)
      t = t + Blocks._customBlock_TreeTurnItem(i) * 2;
    return t;
  };
  Blocks._customBlock_TreeTurnsMixedRoot = function () {
    return Blocks._customBlock_TreeTurnsMixed() + state().TreeCapped;
  };
  Blocks._customBlock_TreeTurnsProductRoot = function () {
    return Blocks._customBlock_TreeTurnsProduct() + state().TreeCapped;
  };
  Blocks._customBlock_TreeTurnsThenRoot = function () {
    return Blocks._customBlock_TreeTurnsThen() + state().TreeCapped;
  };
  // Spec 010 (T202): a long list summed in a loop, each turn a read of its own place, below a source that doubles it.
  Blocks._customBlock_TreeLongTurns = function () {
    var t = 0;
    for (var i = 0; i < state().TreeLong.length; i++)
      t = t + state().TreeLong[i];
    return t;
  };
  Blocks._customBlock_TreeLongTalent = function () {
    return Blocks._customBlock_TreeLongTurns() * 2;
  };
  Blocks._customBlock_TreeLongRoot = function () {
    return state().TreeBase + Blocks._customBlock_TreeLongTalent();
  };
  // Spec 010 (T203): a common branch three sources call, its item by its argument; with 3, another way of the code.
  Blocks._customBlock_TreeCommon = function (k) {
    var s = state();
    if (k === 3) return s.TreeBase * 3;
    return s.TreeList[k] + s.TreeBase;
  };
  Blocks._customBlock_TreeUsesA = function () {
    return Blocks._customBlock_TreeCommon(1) * 2;
  };
  Blocks._customBlock_TreeUsesB = function () {
    return Blocks._customBlock_TreeCommon(2) + state().TreeCapped;
  };
  Blocks._customBlock_TreeUsesC = function () {
    return Blocks._customBlock_TreeCommon(3) * 2;
  };
  Blocks._customBlock_TreeCommonRoot = function () {
    return (
      Blocks._customBlock_TreeUsesA() +
      Blocks._customBlock_TreeUsesB() +
      Blocks._customBlock_TreeUsesC()
    );
  };
  // Spec 010 (Fase 4 r1 of part O): a common branch that reads its item by its argument and a constant place equal to
  // the argument 1 (TreeTwins[1]); once under TreeCommonOnceRoot, with 1 and 2 under TreeCommonTwiceRoot.
  Blocks._customBlock_TreeCommonConst = function (k) {
    var s = state();
    return s.TreeList[k] + s.TreeTwins[1];
  };
  Blocks._customBlock_TreeConstUsesA = function () {
    return Blocks._customBlock_TreeCommonConst(1) * 2;
  };
  Blocks._customBlock_TreeConstUsesB = function () {
    return Blocks._customBlock_TreeCommonConst(2) + state().TreeCapped;
  };
  Blocks._customBlock_TreeCommonOnceRoot = function () {
    return Blocks._customBlock_TreeConstUsesA() + state().TreeBase;
  };
  Blocks._customBlock_TreeCommonTwiceRoot = function () {
    return (
      Blocks._customBlock_TreeConstUsesA() +
      Blocks._customBlock_TreeConstUsesB()
    );
  };
  // Spec 010 (Fase 4 r2 of part O): a common branch whose place changes apart from its argument: with 2 it reads
  // TreeTwins[0] in place of TreeTwins[1] (the save has two twins).
  Blocks._customBlock_TreeCommonShift = function (k) {
    var s = state();
    return s.TreeList[k] + s.TreeTwins[k === 2 ? 0 : 1];
  };
  Blocks._customBlock_TreeShiftUsesA = function () {
    return Blocks._customBlock_TreeCommonShift(1) * 2;
  };
  Blocks._customBlock_TreeShiftUsesB = function () {
    return Blocks._customBlock_TreeCommonShift(2) + state().TreeCapped;
  };
  Blocks._customBlock_TreeShiftRoot = function () {
    return (
      Blocks._customBlock_TreeShiftUsesA() +
      Blocks._customBlock_TreeShiftUsesB()
    );
  };
  // Spec 010 (Fase 4 r2 of part O): a common branch with no param, called the same way under two sources.
  Blocks._customBlock_TreeCommonFixed = function () {
    return state().TreeBase * 2;
  };
  Blocks._customBlock_TreeFixedUsesA = function () {
    return Blocks._customBlock_TreeCommonFixed() * 2;
  };
  Blocks._customBlock_TreeFixedUsesB = function () {
    return Blocks._customBlock_TreeCommonFixed() + state().TreeCapped;
  };
  Blocks._customBlock_TreeFixedRoot = function () {
    return (
      Blocks._customBlock_TreeFixedUsesA() +
      Blocks._customBlock_TreeFixedUsesB()
    );
  };
  // Spec 010 (T059): a talent by the game's own block name, for the class the draft gives a talent source.
  Blocks._customBlock_GetTalentNumber = function (mode, t) {
    var s = state();
    return s.PlayerDATABASE.h[s.UserInfo[0]].h.SkillLevels[t] * 2;
  };
  Blocks._customBlock_TreeDeclDraft = function () {
    return state().TreeBase + Blocks._customBlock_GetTalentNumber(1, 1);
  };
  // Spec 010 (review r1): a root that passes its character's index to the block below it, as the game's Divinity does.
  Blocks._customBlock_TreeDeclPass = function (c) {
    return (
      state().TreeBase +
      Blocks._customBlock_TreeDeclOwn(c) +
      Blocks._customBlock_TreeDeclRow(c)
    );
  };
  // Spec 010 (Fase 4 r1, research R5): the game passes the current character as GetPlayersUsernames.indexOf(UserInfo[0]),
  // as its Divinity("Bonus_Minor", …, god); beside it, a 0 written in the code, which is no character. 4 + 2 + 5 = 11.
  Blocks._customBlock_TreeCharArg = function () {
    var s = state();
    var me = s.GetPlayersUsernames.indexOf(s.UserInfo[0]);
    return (
      s.TreeBase +
      Blocks._customBlock_TreeDeclOwn(me) +
      Blocks._customBlock_TreeDeclRow(0)
    );
  };
  // ...and to a block that reads nothing: a leaf of the draft
  Blocks._customBlock_TreeDeclRow = function (c) {
    return c + 5;
  };
  Blocks._customBlock_TreeDeclOwn = function (c) {
    return state().TreeList[c] * 2;
  };
  // Spec 010 (Fase 4 r1 of part N): the game passes a count of the save as an argument, as its
  // ArcaneType("ArcaneMapMulti", MapBon[CurrentMap][i], 0) the map's kills; the block below passes that parameter on,
  // as ArcaneType's Log2(t). Beside it, a 0 the game set in its working map (as TalentCalc's CalcTalentDN3, a loop's
  // index), which the place does not tell from a save's count the game cached there (r2). TreeBase 4 + Kills (Row(3) 8 × 2) + Row(0) 5 = 25.
  Blocks._customBlock_TreeSaveArg = function () {
    var U = A["com.stencyl.utils.Utils"];
    a.engine.getGameAttribute("DNSM").h.TreeSaveIdx = 0;
    return (
      state().TreeBase +
      Blocks._customBlock_TreeDeclKills(
        "Map",
        U.asNumber(a.engine.getGameAttribute("TreeList")[2]),
        0,
      ) +
      Blocks._customBlock_TreeDeclRow(
        U.asNumber(a.engine.getGameAttribute("DNSM").h.TreeSaveIdx),
      )
    );
  };
  // Spec 010 (group 5 of part P): an argument read from a working map the call filled in a loop from a game table, as
  // the game's Divinity("Bonus_Minor") with DNSM.BminorDivQdl.indexOf(i); and one another block wrote there.
  Blocks._customBlock_TreeWorkArg = function () {
    var U = A["com.stencyl.utils.Utils"];
    a.engine.getGameAttribute("DNSM").h.TreeQdl = [];
    for (var r = 0; r < 2; r++)
      a.engine
        .getGameAttribute("DNSM")
        .h.TreeQdl.push(
          U.asNumber(a.engine.getGameAttribute("CustomLists").h.ListTwo[0]) + r,
        );
    return (
      state().TreeBase +
      Blocks._customBlock_TreeDeclRow(
        a.engine.getGameAttribute("DNSM").h.TreeQdl.indexOf(33),
      )
    );
  };
  // ...and a key the call set from the save first and from a number of the code right before the read: the write the
  // read saw is the code's, as TalentCalc's DNSM.CalcTalentDN3 = r in each of its loops.
  Blocks._customBlock_TreeWorkLast = function () {
    var U = A["com.stencyl.utils.Utils"];
    a.engine.getGameAttribute("DNSM").h.TreeIdx = U.asNumber(
      a.engine.getGameAttribute("TreeList")[2],
    );
    a.engine.getGameAttribute("DNSM").h.TreeIdx = 0;
    return (
      state().TreeBase +
      Blocks._customBlock_TreeDeclRow(
        U.asNumber(a.engine.getGameAttribute("DNSM").h.TreeIdx),
      )
    );
  };
  // ...and a key the call set inside a loop it left with a break, before the read: as StampBonusOfTypeX's
  // DummyNumbersStatManager.Stamp_bonuses_DRI = s, then StampOverLevel(s + 1000 × that).
  Blocks._customBlock_TreeWorkLoop = function () {
    var U = A["com.stencyl.utils.Utils"];
    for (var r = 0; r < 3; r++)
      if (1 == r) {
        a.engine.getGameAttribute("DNSM").h.TreeFound = r;
        break;
      }
    return (
      state().TreeBase +
      Blocks._customBlock_TreeDeclRow(
        U.asNumber(a.engine.getGameAttribute("DNSM").h.TreeFound),
      )
    );
  };
  Blocks._customBlock_TreeSetElse = function () {
    a.engine.getGameAttribute("DNSM").h.TreeElse = 0;
    return 0;
  };
  Blocks._customBlock_TreeSaveElse = function () {
    var U = A["com.stencyl.utils.Utils"];
    Blocks._customBlock_TreeSetElse();
    return (
      state().TreeBase +
      Blocks._customBlock_TreeDeclRow(
        U.asNumber(a.engine.getGameAttribute("DNSM").h.TreeElse),
      )
    );
  };
  // ...and two calls of one block that differ only by the save's argument: with "*" the place does not decide. 12 + 14.
  Blocks._customBlock_TreeSaveTwice = function () {
    var U = A["com.stencyl.utils.Utils"];
    return (
      Blocks._customBlock_TreeDeclKills(
        "Map",
        U.asNumber(a.engine.getGameAttribute("TreeList")[0]),
        0,
      ) +
      Blocks._customBlock_TreeDeclKills(
        "Map",
        U.asNumber(a.engine.getGameAttribute("TreeList")[1]),
        0,
      )
    );
  };
  // Spec 010 (Fase 4 r2 of part N): one block called from two places, one with the save's argument and the other with a
  // number written in the code: the place does not decide whether the argument comes from the save. 4 + 16 = 20.
  Blocks._customBlock_TreeSaveSplit = function () {
    var U = A["com.stencyl.utils.Utils"];
    return (
      state().TreeBase +
      (state().TreeBase > 100
        ? Blocks._customBlock_TreeDeclKills(
            "Map",
            U.asNumber(a.engine.getGameAttribute("TreeList")[2]),
            0,
          )
        : Blocks._customBlock_TreeDeclKills("Map", 3, 0))
    );
  };
  // ...and a root that gives the character's index to a block that passes its parameter on, as the game's
  // Divinity("Bonus_Minor", …, 2) to its Divinity("DivMinorBonus", t, 1).
  Blocks._customBlock_TreeCharPass = function () {
    var s = state();
    return (
      s.TreeBase +
      Blocks._customBlock_TreeDeclPass(
        s.GetPlayersUsernames.indexOf(s.UserInfo[0]),
      )
    );
  };
  // Spec 010 (Fase 4 r3 of part N): one block called from two places, one with the character's index and the other with a
  // 0 written in the code: the place does not decide whether the argument comes from the character. 4 + 2 = 6.
  Blocks._customBlock_TreeCharSplit = function () {
    var s = state();
    return (
      s.TreeBase +
      (s.TreeBase > 100
        ? Blocks._customBlock_TreeDeclOwn(
            s.GetPlayersUsernames.indexOf(s.UserInfo[0]),
          )
        : Blocks._customBlock_TreeDeclOwn(0))
    );
  };
  // Spec 010 (group 5 of part P): the same block from two places that both run, with the same numbers: no side of a ? :
  // separates them, and the place still does not decide.
  Blocks._customBlock_TreeCharBoth = function () {
    var s = state();
    return (
      s.TreeBase +
      Blocks._customBlock_TreeDeclOwn(
        s.GetPlayersUsernames.indexOf(s.UserInfo[0]),
      ) +
      Blocks._customBlock_TreeDeclOwn(0)
    );
  };
  // Spec 010 (T205): a block called once per turn of a long loop, its first argument what the turn gives (as the game's
  // Summoning("RibbonBonus", ribbon, 0) per meal), summed; and the same call twice in two turns.
  Blocks._customBlock_TreeRibbon = function (k, m) {
    return 2 * k + m;
  };
  Blocks._customBlock_TreeRibbons = function () {
    var s = state();
    var t = 0;
    for (var i = 0; i < 8; i++)
      t = t + Blocks._customBlock_TreeRibbon(i + 1, 0);
    return t;
  };
  Blocks._customBlock_TreeRibbonsTwin = function () {
    var s = state();
    var t = 0;
    for (var i = 0; i < 2; i++)
      t = t + Blocks._customBlock_TreeRibbon(s.TreeTwins[i], 0);
    return t;
  };
  Blocks._customBlock_TreeCallsPool = function () {
    return Blocks._customBlock_TreeRibbons() + state().TreeBase;
  };
  Blocks._customBlock_TreeCallsTwinPool = function () {
    return Blocks._customBlock_TreeRibbonsTwin() + state().TreeBase;
  };
  Blocks._customBlock_TreeDeclKills = function (mode, kills) {
    return Blocks._customBlock_TreeDeclRow(kills) * 2;
  };
  // A sum of the list's three entries, each a read of its own: a source whose children close (a loop's do not, T164).
  Blocks._customBlock_TreeDeclSum = function () {
    var s = state();
    return s.TreeList[0] + s.TreeList[1] + s.TreeList[2];
  };
  // The Drop Rate shape: scratch counters, a working value read back, a sum in percent divided by 100 with a
  // two-source term and two curves, constants behind a condition, a source only one character has, a source the
  // recording never runs; the running total is summed, multiplied, summed and multiplied.
  Blocks._customBlock_TreeDeclChain = function () {
    var s = state();
    var d = dnsm();
    s.DummyNumbersStatManager = new StringMap();
    for (var i = 0; i < 3; i++) s.DummyNumbersStatManager.h.n = i;
    d.TreeDecl = new StringMap();
    d.TreeDeclPart = new StringMap();
    d.TreeDeclPart.h.v = Blocks._customBlock_TreeDeclBest() + s.TreeCapped;
    d.TreeDecl.h.v =
      Blocks._customBlock_TreeDeclLuck() +
      (Blocks._customBlock_TreeDeclTalent(0) * s.TreeTwins[0] +
        Blocks._customBlock_ArcadeBonus(0) +
        d.TreeDeclPart.h.v) /
        100;
    s.TreeFlagOn == 1 && (d.TreeDecl.h.v = d.TreeDecl.h.v + 2);
    s.TreeOwned > 0 && (d.TreeDecl.h.v = d.TreeDecl.h.v + s.TreeOwned);
    d.TreeDecl.h.v = d.TreeDecl.h.v * Blocks._customBlock_TreeDeclSum();
    d.TreeDecl.h.v = d.TreeDecl.h.v + 0.5;
    d.TreeDecl.h.v = d.TreeDecl.h.v * (1 + s.TreeStats.h.b / 100);
    s.CurrentMap == 7 &&
      (d.TreeDecl.h.v = d.TreeDecl.h.v * Blocks._customBlock_TreeDeclTalent(1));
    d.TreeDecl.h.v = d.TreeDecl.h.v * 1.2;
    return d.TreeDecl.h.v;
  };
  // A root with no running total: a sum, then a product.
  Blocks._customBlock_TreeDeclExpr = function () {
    var s = state();
    return (
      (Blocks._customBlock_TreeReads() + s.TreeCapped + 2) *
      Blocks._customBlock_TreeLoop() *
      (1 + s.TreeStats.h.b / 100)
    );
  };
  // A root whose last write swaps the running total instead of adding to it or multiplying it.
  Blocks._customBlock_TreeDeclSwap = function () {
    var s = state();
    var d = dnsm();
    d.TreeDeclSwap = new StringMap();
    d.TreeDeclSwap.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeDeclSwap.h.v = d.TreeDeclSwap.h.v * Blocks._customBlock_TreeLoop();
    d.TreeDeclSwap.h.v = s.TreeCapped + s.TreeLevel;
    return d.TreeDeclSwap.h.v;
  };
  // Spec 010 (r5 of group 2): a common part that calls a block worth 0 and uses it in a step, then a branch that writes
  // a fixed 0 to a path and sums onto it; in TreeDeclLitCall the branch writes the call instead, which a step also uses.
  Blocks._customBlock_TreeLitZero = function () {
    return 0;
  };
  Blocks._customBlock_TreeDeclLit = function () {
    var s = state();
    var d = dnsm();
    d.TreeDeclLit = new StringMap();
    d.TreeDeclLit.h.part =
      s.TreeCapped + Math.min(s.TreeBase, Blocks._customBlock_TreeLitZero());
    if (s.TreeFlagOn == 1)
      return (
        (d.TreeDeclLit.h.n = 0),
        (d.TreeDeclLit.h.n = d.TreeDeclLit.h.n + s.TreeStats.h.b),
        (d.TreeDeclLit.h.n + s.TreeStats.h.a) * 2
      );
    return 0;
  };
  Blocks._customBlock_TreeDeclLitCall = function () {
    var s = state();
    var d = dnsm();
    d.TreeDeclLit = new StringMap();
    if (s.TreeFlagOn == 1) {
      var z = Blocks._customBlock_TreeLitZero();
      d.TreeDeclLit.h.n = z;
      d.TreeDeclLit.h.n = d.TreeDeclLit.h.n + s.TreeStats.h.b + z * 3;
      return (d.TreeDeclLit.h.n + s.TreeStats.h.a) * 2;
    }
    return 0;
  };
  // Spec 010 (T143): a top layer above the pools, from outside in, as the code writes it; a gate; a divisor; a leaf.
  Blocks._customBlock_TreeLayerRound = function () {
    var p = Blocks._customBlock_TreeReads() * state().TreeTwins[0] * 1.1;
    return Math.round(Math.min(20, p));
  };
  Blocks._customBlock_TreeLayerFloor = function () {
    var p = Blocks._customBlock_TreeReads() * state().TreeTwins[0] * 1.1;
    return Math.floor(Math.min(50, p));
  };
  Blocks._customBlock_TreeLayerCeil = function () {
    var p = Blocks._customBlock_TreeReads() * state().TreeTwins[0] * 1.1;
    return Math.ceil(Math.min(50, p));
  };
  Blocks._customBlock_TreeLayerMax = function () {
    var p = Blocks._customBlock_TreeReads() * state().TreeTwins[0] * 1.1;
    return Math.floor(Math.max(30, p));
  };
  Blocks._customBlock_TreeLayerGate = function () {
    var s = state();
    return s.TreeOwned > 0 ? 0 : Blocks._customBlock_TreeReads() + s.TreeCapped;
  };
  Blocks._customBlock_TreeLayerDiv = function () {
    var s = state();
    return 100 / (1 + (Blocks._customBlock_TreeReads() + s.TreeCapped) / 100);
  };
  Blocks._customBlock_TreeLayerRead = function () {
    return state().TreeCapped;
  };
  Blocks._customBlock_TreeLayerConstant = function () {
    return 7;
  };
  // No leaf: a text the game turns into a number, and a call passed on as it is.
  Blocks._customBlock_TreeLayerNumber = function () {
    return Number(state().TreeLabelNum);
  };
  Blocks._customBlock_TreeLayerPass = function () {
    return Blocks._customBlock_TreeReads();
  };
  // Spec 010 (T151): a condition and its two paths outside the return: in a variable, inside the last step, and in
  // a step of a running total.
  Blocks._customBlock_TreeGateVar = function () {
    var s = state();
    var x = s.TreeOwned > 0 ? s.TreeBase + 1 : s.TreeCapped + s.TreeLevel;
    return x * s.TreeTwins[0];
  };
  Blocks._customBlock_TreeGateInline = function () {
    var s = state();
    return (
      (s.TreeOwned > 0 ? s.TreeBase + 1 : s.TreeCapped + s.TreeLevel) *
      s.TreeTwins[0]
    );
  };
  Blocks._customBlock_TreeGateChain = function () {
    var s = state();
    var d = dnsm();
    d.TreeGateChain = new StringMap();
    d.TreeGateChain.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeGateChain.h.v =
      s.TreeOwned > 0
        ? d.TreeGateChain.h.v * 2
        : d.TreeGateChain.h.v * s.TreeTwins[0];
    return d.TreeGateChain.h.v;
  };
  // Spec 010 (T154): the general top layer: a division with any numerator and a divisor of two factors; a cap whose
  // limit is no constant; a floor and a cap nested; a curve, alone and as a term of a product.
  Blocks._customBlock_TreeDivAny = function () {
    var s = state();
    return (
      (s.TreeCapped - Blocks._customBlock_TreeReads()) /
      ((1 + s.TreeStats.h.b / 100) * Blocks._customBlock_TreeLoop())
    );
  };
  Blocks._customBlock_TreeCapAny = function () {
    var s = state();
    return Math.min(
      Blocks._customBlock_TreeReads() + s.TreeBase,
      s.TreeCapped / 10,
    );
  };
  Blocks._customBlock_TreeCapNested = function () {
    var s = state();
    return Math.max(
      Math.min(Blocks._customBlock_TreeReads() * 2, s.TreeCapped),
      s.TreeLevel,
    );
  };
  Blocks._customBlock_TreePowTop = function () {
    return Math.pow(2, state().TreeTwins[0]);
  };
  Blocks._customBlock_TreePowTerm = function () {
    var s = state();
    return 10 * Math.pow(s.TreeLevel, 0.5) * (1 + s.TreeStats.h.b / 100);
  };
  // Spec 010 (T155): a factor that holds two sources (one term), and a cost a call builds in a scratch path with
  // its reducers, that the root only reads and rounds.
  Blocks._customBlock_TreePartTerm = function () {
    var s = state();
    return (
      Blocks._customBlock_TreeLoop() *
      (1 + (s.TreeStats.h.a + s.TreeStats.h.b) / 100)
    );
  };
  Blocks._customBlock_TreeCostBuild = function () {
    var s = state();
    var d = dnsm();
    d.TreeCost = new StringMap();
    d.TreeCost.h.v = s.TreeCapped * 100;
    d.TreeCost.h.v = d.TreeCost.h.v * Math.max(0.1, 1 - s.TreeStats.h.a / 100);
    d.TreeCost.h.v = d.TreeCost.h.v * Math.max(0.9, 1 - s.TreeTwins[0] / 100);
    return 0;
  };
  Blocks._customBlock_TreeCostRead = function () {
    Blocks._customBlock_TreeCostBuild();
    return Math.round(dnsm().TreeCost.h.v);
  };
  // The review of T154 to T156: a cap between the running total and a sum with a call, as the Multi-Ore, flat and
  // under a floor; a part whose reads are in two factors; a cost built twice by the same call.
  Blocks._customBlock_TreeCapAcc = function () {
    var s = state();
    var d = dnsm();
    d.TreeCapAcc = new StringMap();
    d.TreeCapAcc.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeCapAcc.h.v = d.TreeCapAcc.h.v * 2;
    return Math.min(300 + Blocks._customBlock_TreeLoop(), d.TreeCapAcc.h.v);
  };
  Blocks._customBlock_TreeCapAccNested = function () {
    var s = state();
    var d = dnsm();
    d.TreeCapAcc = new StringMap();
    d.TreeCapAcc.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeCapAcc.h.v = d.TreeCapAcc.h.v * 2;
    return Math.max(
      Math.min(300 + Blocks._customBlock_TreeLoop(), d.TreeCapAcc.h.v),
      s.TreeLevel,
    );
  };
  Blocks._customBlock_TreePartTwice = function () {
    var s = state();
    return (
      Blocks._customBlock_TreeLoop() *
      (1 + (s.TreeStats.h.a + s.TreeStats.h.b) / 100) *
      (2 + (s.TreeStats.h.a + s.TreeStats.h.b) / 50)
    );
  };
  Blocks._customBlock_TreeCostTwice = function () {
    Blocks._customBlock_TreeCostBuild();
    var first = dnsm().TreeCost.h.v;
    Blocks._customBlock_TreeCostBuild();
    return Math.round(first + dnsm().TreeCost.h.v);
  };
  // The second review of T154 to T156: a running total whose last write is a cap that bites; a part in two factors
  // of the root and once in the cost a call builds.
  Blocks._customBlock_TreeCapWrite = function () {
    var s = state();
    var d = dnsm();
    d.TreeCapWrite = new StringMap();
    d.TreeCapWrite.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeCapWrite.h.v = d.TreeCapWrite.h.v * 2;
    d.TreeCapWrite.h.v = Math.min(d.TreeCapWrite.h.v, 5);
    return d.TreeCapWrite.h.v;
  };
  Blocks._customBlock_TreePartBoth = function () {
    var s = state();
    Blocks._customBlock_TreeCostBuild();
    return (
      Math.round(dnsm().TreeCost.h.v) *
      (1 + s.TreeTwins[0] / 100) *
      (2 + s.TreeTwins[0] / 50)
    );
  };
  // The third review of T154 to T156: a layer over an expression of the total, with a bonus of 0 that keeps the value
  // of the last write; a cost whose build has the part in two terms, that the root only reads.
  Blocks._customBlock_TreeLayerOnExpr = function () {
    var s = state();
    var d = dnsm();
    d.TreeLayerExpr = new StringMap();
    d.TreeLayerExpr.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeLayerExpr.h.v = d.TreeLayerExpr.h.v * 2;
    return Math.floor(d.TreeLayerExpr.h.v * (1 + s.TreeOwned / 100));
  };
  Blocks._customBlock_TreeCostAmbBuild = function () {
    var s = state();
    var d = dnsm();
    d.TreeCostAmb = new StringMap();
    d.TreeCostAmb.h.v = s.TreeCapped * 100;
    d.TreeCostAmb.h.v =
      d.TreeCostAmb.h.v * Math.max(0.1, 1 - s.TreeStats.h.a / 100);
    d.TreeCostAmb.h.v =
      d.TreeCostAmb.h.v * Math.max(0.5, 1 - s.TreeStats.h.a / 50);
    return 0;
  };
  Blocks._customBlock_TreeCostAmbRead = function () {
    Blocks._customBlock_TreeCostAmbBuild();
    return Math.round(dnsm().TreeCostAmb.h.v);
  };
  // Spec 010 (T157): with no side from what the root wrote, the cap is the side that starts with a constant of the
  // code (Food not consume: 90 + …; Crop value: 10000 × …); both sides starting with one is ambiguous.
  Blocks._customBlock_TreeCapConstPlus = function () {
    var s = state();
    return Math.min(Blocks._customBlock_TreeReads() * 2, 90 + s.TreeLevel);
  };
  Blocks._customBlock_TreeCapConstTimes = function () {
    var s = state();
    return Math.min(
      10000 * s.TreeTwins[0],
      Blocks._customBlock_TreeLoop() + s.TreeCapped,
    );
  };
  Blocks._customBlock_TreeCapConstBoth = function () {
    var s = state();
    return Math.min(5 + Blocks._customBlock_TreeReads(), 90 + s.TreeLevel);
  };
  // Spec 010 (T158): the chains the fourth probe still refused. A first step that is a max (Trap collect all, New
  // bubble chance, Arcade ball); a last write that is the floor of a sum (Legend talent max LV); a counter set to 0
  // twice and returned in a product (Research insight); a cost multiplied in place by a curve (Bubble cost).
  Blocks._customBlock_TreeChainMaxFirst = function () {
    var s = state();
    var d = dnsm();
    d.TreeMaxFirst = new StringMap();
    d.TreeMaxFirst.h.v = Math.max(
      1,
      Blocks._customBlock_TreeReads() + s.TreeBase,
    );
    d.TreeMaxFirst.h.v = d.TreeMaxFirst.h.v * Blocks._customBlock_TreeLoop();
    return d.TreeMaxFirst.h.v;
  };
  Blocks._customBlock_TreeChainFloorLast = function () {
    var s = state();
    var d = dnsm();
    d.TreeFloorLast = new StringMap();
    d.TreeFloorLast.h.v = 0;
    d.TreeFloorLast.h.v = Math.floor(3 + s.TreeLevel / 10);
    return d.TreeFloorLast.h.v;
  };
  Blocks._customBlock_TreeCountNone = function () {
    var s = state();
    var d = dnsm();
    var i;
    d.TreeCount = new StringMap();
    d.TreeCount.h.v = 0;
    for (d.TreeCount.h.v = 0, i = 0; i < s.TreeOwned; i++)
      d.TreeCount.h.v = d.TreeCount.h.v + 1;
    return 3 * d.TreeCount.h.v * Blocks._customBlock_TreeLoop();
  };
  // Spec 010 (T188): a pass-through variable the call writes and reads back, as the game's PostOfficeINFO writes
  // DNSM.PostOffInfoDN1: TreeBase × 2 = 8, then 8 + TreeLevel = 33; the bare one takes TreeBase with no step, × 3 = 12.
  Blocks._customBlock_TreePassDN = function () {
    var s = state();
    var d = dnsm();
    d.TreePassDN1 = s.TreeBase * 2;
    return d.TreePassDN1 + s.TreeLevel;
  };
  Blocks._customBlock_TreePassBare = function () {
    var s = state();
    var d = dnsm();
    d.TreePassDN1 = s.TreeBase;
    return a.engine.getGameAttribute("DNSM").h.TreePassDN1 * 3;
  };
  Blocks._customBlock_TreePassRoot = function () {
    return (
      Blocks._customBlock_TreePassDN() +
      Blocks._customBlock_TreePassBare() +
      state().TreeCapped
    );
  };
  Blocks._customBlock_TreeCostCurve = function () {
    var s = state();
    var d = dnsm();
    d.TreeCostCurve = new StringMap();
    d.TreeCostCurve.h.v = s.TreeCapped * 100;
    d.TreeCostCurve.h.v *= Math.max(0.1, Math.pow(0.75, s.TreeTwins[0]));
    d.TreeCostCurve.h.v *= Math.max(0.9, 1 - s.TreeStats.h.a / 100);
    return Math.round(d.TreeCostCurve.h.v);
  };
  // Spec 010 (T159): a block that takes a list (points spent per tab) and returns the list it builds, one push per tab,
  // as the game builds the talent points of each tab.
  Blocks._customBlock_TreeTabs = function (spent) {
    var s = state();
    var d = dnsm();
    d.TreeTabs = [];
    d.TreeTabs.push(s.TreeList[0] * 10 - spent[0]);
    d.TreeTabs.push(s.TreeList[1] * 10 - spent[1]);
    d.TreeTabs.push(s.TreeLevel + s.TreeBase - spent[2]);
    return d.TreeTabs;
  };
  // The review of T157 to T160. A running total set to 0 before its loop too; a cap of 100 × the total, which is no
  // constant of the code; a total multiplied in place by a value that also adds to the same write; a total added to
  // in place; two lists with the same index; a total divided in its last write.
  Blocks._customBlock_TreeLoopZeroTwice = function () {
    var list = state().TreeList;
    var d = dnsm();
    var i;
    d.TreeLoopZero2 = new StringMap();
    d.TreeLoopZero2.h.v = 0;
    for (d.TreeLoopZero2.h.v = 0, i = 0; i < list.length; i++)
      d.TreeLoopZero2.h.v = d.TreeLoopZero2.h.v + list[i] * 2;
    d.TreeLoopZero2.h.v = d.TreeLoopZero2.h.v * state().TreeBase;
    return d.TreeLoopZero2.h.v;
  };
  Blocks._customBlock_TreeCapTouch = function () {
    var s = state();
    var d = dnsm();
    d.TreeTouch = new StringMap();
    d.TreeTouch.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeTouch.h.v = d.TreeTouch.h.v * 2;
    return Math.min(100 * d.TreeTouch.h.v, s.TreeLevel + s.TreeBase);
  };
  Blocks._customBlock_TreeBothWays = function () {
    var s = state();
    var d = dnsm();
    d.TreeBoth = new StringMap();
    d.TreeBoth.h.v = s.TreeTwins[0];
    d.TreeBoth.h.v *= s.TreeList[2] / 2;
    return d.TreeBoth.h.v;
  };
  Blocks._customBlock_TreePlusInPlace = function () {
    var s = state();
    var d = dnsm();
    d.TreePlus = new StringMap();
    d.TreePlus.h.v = Blocks._customBlock_TreeReads() * 2;
    d.TreePlus.h.v += s.TreeLevel * 3;
    return d.TreePlus.h.v;
  };
  Blocks._customBlock_TreeTwoLists = function () {
    var s = state();
    var d = dnsm();
    d.TreeListA = [];
    d.TreeListB = [];
    d.TreeListA.push(s.TreeLevel + 1);
    d.TreeListB.push(s.TreeBase + 1);
    return d.TreeListA;
  };
  Blocks._customBlock_TreeDivWrite = function () {
    var s = state();
    var d = dnsm();
    d.TreeDivWrite = new StringMap();
    d.TreeDivWrite.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeDivWrite.h.v = d.TreeDivWrite.h.v * 2;
    d.TreeDivWrite.h.v = d.TreeDivWrite.h.v / 4;
    return d.TreeDivWrite.h.v;
  };
  // The second review of T157 to T160: a cap that bites in the middle of the chain, with a pool after it; two Multi
  // stretches on the two sides of a floor.
  Blocks._customBlock_TreeCapMid = function () {
    var s = state();
    var d = dnsm();
    d.TreeCapMid = new StringMap();
    d.TreeCapMid.h.v = Blocks._customBlock_TreeReads() + s.TreeBase;
    d.TreeCapMid.h.v = Math.min(d.TreeCapMid.h.v, 10);
    d.TreeCapMid.h.v = d.TreeCapMid.h.v * Blocks._customBlock_TreeLoop();
    return d.TreeCapMid.h.v;
  };
  Blocks._customBlock_TreeFloorMid = function () {
    var s = state();
    var d = dnsm();
    d.TreeFloorMid = new StringMap();
    d.TreeFloorMid.h.v = s.TreeBase * s.TreeTwins[0];
    d.TreeFloorMid.h.v = Math.floor(d.TreeFloorMid.h.v * 1.5);
    d.TreeFloorMid.h.v = d.TreeFloorMid.h.v * 2;
    return d.TreeFloorMid.h.v;
  };
  // Spec 010 (T162): a part whose second reference is inside another term (the Super Bit beside the talent); a cap that
  // is a min of two sides starting with constants (Food not consume).
  Blocks._customBlock_TreePartSplit = function () {
    var s = state();
    return (
      Blocks._customBlock_TreeLoop() *
      (1 + s.TreeStats.h.a / 100) *
      (1 + (s.TreeCapped + 40 * s.TreeStats.h.b) / 100)
    );
  };
  Blocks._customBlock_TreeCapConstFn = function () {
    var s = state();
    return Math.min(
      Math.min(90 + s.TreeLevel, 98 + s.TreeBase),
      Blocks._customBlock_TreeReads() * 20,
    );
  };
  // Spec 010 (T162): a stat multiplier on a second running total the root builds itself and adds to its scratch total
  // (the Obol stat multi inside TotalStats); a list returned as a copy beside a second list (the list the root returns
  // has no path).
  Blocks._customBlock_TreeStatMulti = function () {
    var s = state();
    var d = dnsm();
    s.DummyNumbersStatManager = new StringMap();
    s.DummyNumbersStatManager.h.tot = s.TreeBase;
    d.TreeStatTwo = new StringMap();
    d.TreeStatTwo.h.v = s.TreeLevel + s.TreeBase;
    d.TreeStatTwo.h.v =
      d.TreeStatTwo.h.v *
      (1 + (Blocks._customBlock_TreeReads() + 40 * s.TreeStats.h.b) / 100);
    s.DummyNumbersStatManager.h.tot =
      s.DummyNumbersStatManager.h.tot + d.TreeStatTwo.h.v;
    return Math.floor(
      s.DummyNumbersStatManager.h.tot * (1 + s.TreeStats.h.a / 100),
    );
  };
  // Spec 010 (T177 r1): the same as the game writes it, the scratch total read first in a sum (the STR's base, which
  // opens): the second total is a term of it, the multiplier inside that term with the second total's other read.
  Blocks._customBlock_TreeStatMultiSum = function () {
    var U = A["com.stencyl.utils.Utils"];
    state().DummyNumbersStatManager = new StringMap();
    a.engine.getGameAttribute("DummyNumbersStatManager").h.tot = 0;
    a.engine.getGameAttribute("DummyNumbersStatManager").h.tot =
      U.asNumber(a.engine.getGameAttribute("DummyNumbersStatManager").h.tot) +
      U.asNumber(a.engine.getGameAttribute("TreeBase"));
    a.engine.getGameAttribute("DNSM").h.TreeStatTwo = 0;
    a.engine.getGameAttribute("DNSM").h.TreeStatTwo =
      U.asNumber(a.engine.getGameAttribute("DNSM").h.TreeStatTwo) +
      U.asNumber(a.engine.getGameAttribute("TreeLevel"));
    a.engine.getGameAttribute("DNSM").h.TreeStatTwo =
      U.asNumber(a.engine.getGameAttribute("DNSM").h.TreeStatTwo) *
      (1 +
        (Blocks._customBlock_TreeReads() +
          40 * a.engine.getGameAttribute("TreeStats").h.b) /
          100);
    a.engine.getGameAttribute("DummyNumbersStatManager").h.tot =
      U.asNumber(a.engine.getGameAttribute("DummyNumbersStatManager").h.tot) +
      U.asNumber(a.engine.getGameAttribute("DNSM").h.TreeStatTwo);
    return Math.floor(
      U.asNumber(a.engine.getGameAttribute("DummyNumbersStatManager").h.tot) +
        a.engine.getGameAttribute("TreeCapped"),
    );
  };
  Blocks._customBlock_TreeTwoListsCopy = function () {
    var s = state();
    var d = dnsm();
    d.TreeListC = [];
    d.TreeListD = [];
    d.TreeListC.push(s.TreeLevel + 1);
    d.TreeListD.push(s.TreeBase + 1);
    return d.TreeListC.slice();
  };
  // Spec 010 (T161, T162; spec, Open Questions 22/11): a cost that overflows to Infinity and is cut by a constant
  // written under a test (the Bubble cost's 1e9); a total raised to 1 the same way (a floor); a first write divided
  // (New bubble chance), then only multiplied, or then added to; a factor multiplied into each sign in a loop, the root
  // returning nothing (the Seraph), and one that changes each turn; each monster's time divided by 1 + a sum / 100 in a
  // loop (the Mob respawn).
  Blocks._customBlock_TreeCostInf = function () {
    var s = state();
    var d = dnsm();
    d.TreeCostInf = new StringMap();
    d.TreeCostInf.h.v = s.TreeCapped * Math.pow(10, 400);
    d.TreeCostInf.h.v =
      d.TreeCostInf.h.v *
      Math.max(0.1, Math.pow(0.75, s.TreeTwins[0])) *
      Math.max(0.9, 1 - s.TreeStats.h.a / 100);
    1000 < d.TreeCostInf.h.v && (d.TreeCostInf.h.v = 1000);
    1 > d.TreeCostInf.h.v && (d.TreeCostInf.h.v = 1);
    return Math.round(d.TreeCostInf.h.v);
  };
  // The review of T162: a number that overflows, as the live tree shows it.
  Blocks._customBlock_TreeInfKid = function () {
    return state().TreeCapped * Math.pow(10, 400);
  };
  Blocks._customBlock_TreeInfRoot = function () {
    return (
      Math.min(Blocks._customBlock_TreeInfKid(), 50) +
      Blocks._customBlock_TreeReads()
    );
  };
  // The seventh probe: an infinite argument and a number below every other, each back at its place in the recording.
  Blocks._customBlock_TreeInfNeg = function () {
    var low = -state().TreeCapped * Math.pow(10, 400);
    return Blocks._customBlock_ArbitraryCode5Inputs("decay", low, 1, 1);
  };
  // A builder's pass (review of the seventh probe): a write of the whole cache, which the pass drops from the writes,
  // then a scratch box outside the cache that overflows, which the pass moves to the spliced writes.
  Blocks._customBlock_TreeInfBuild = function () {
    var d = dnsm();
    var cache = d.TreeWhoCache;
    d.TreeWhoCache = cache;
    d.TreeInfScratch = state().TreeCapped * Math.pow(10, 400);
    return 0;
  };
  // A cut whose test is on another value than the total, the total already below it: no cut of the total.
  Blocks._customBlock_TreeCutOther = function () {
    var s = state();
    var d = dnsm();
    d.TreeCutOther = new StringMap();
    d.TreeCutOther.h.v = s.TreeBase + 2;
    d.TreeCutOther.h.v = d.TreeCutOther.h.v * 2;
    s.TreeLevel > 20 && (d.TreeCutOther.h.v = 20);
    return d.TreeCutOther.h.v;
  };
  // A floor whose test is on another value than the total, the total already above it: no floor of the total.
  Blocks._customBlock_TreeFloorOther = function () {
    var s = state();
    var d = dnsm();
    d.TreeFloorOther = new StringMap();
    d.TreeFloorOther.h.v = s.TreeBase + 2;
    d.TreeFloorOther.h.v = d.TreeFloorOther.h.v * 2;
    s.TreeBase < 10 && (d.TreeFloorOther.h.v = 10);
    return d.TreeFloorOther.h.v;
  };
  Blocks._customBlock_TreeFloorIf = function () {
    var d = dnsm();
    d.TreeFloorIf = new StringMap();
    d.TreeFloorIf.h.v = state().TreeStats.h.a * 0.1;
    d.TreeFloorIf.h.v = d.TreeFloorIf.h.v * 2;
    1 > d.TreeFloorIf.h.v && (d.TreeFloorIf.h.v = 1);
    return d.TreeFloorIf.h.v;
  };
  Blocks._customBlock_TreeChainDiv = function () {
    var s = state();
    var d = dnsm();
    d.TreeChainDiv = new StringMap();
    d.TreeChainDiv.h.v =
      (139 * Math.pow(0.73, s.TreeTwins[0] + 1)) /
      Math.max(0.1 * s.TreeTwins[0] + 1, 1);
    d.TreeChainDiv.h.v =
      d.TreeChainDiv.h.v *
      Blocks._customBlock_TreeLoop() *
      (1 + s.TreeStats.h.b / 100);
    return d.TreeChainDiv.h.v;
  };
  Blocks._customBlock_TreeChainDivAdd = function () {
    var s = state();
    var d = dnsm();
    d.TreeChainDivAdd = new StringMap();
    d.TreeChainDivAdd.h.v =
      (139 * Math.pow(0.73, s.TreeTwins[0] + 1)) /
      Math.max(0.1 * s.TreeTwins[0] + 1, 1);
    d.TreeChainDivAdd.h.v = d.TreeChainDivAdd.h.v + s.TreeCapped;
    return d.TreeChainDivAdd.h.v;
  };
  Blocks._customBlock_TreeSignLoop = function () {
    var s = state();
    var d = dnsm();
    d.TreeSigns = new StringMap();
    d.TreeSigns.h.x = s.TreeBase;
    d.TreeSigns.h.y = s.TreeCapped;
    var keys = Object.keys(d.TreeSigns.h);
    for (var i = 0; i < keys.length; i++) {
      var p = keys[i];
      d.TreeSigns.h[p] =
        d.TreeSigns.h[p] *
        (1 + s.TreeStats.h.b / 100) *
        Math.min(
          5,
          Math.pow(
            1.1 + s.TreeStats.h.a / 100,
            Math.ceil((s.TreeLevel + 1) / 20),
          ),
        );
    }
  };
  Blocks._customBlock_TreeSignTurns = function () {
    var s = state();
    var d = dnsm();
    d.TreeSignTurns = new StringMap();
    d.TreeSignTurns.h.x = s.TreeBase;
    d.TreeSignTurns.h.y = s.TreeCapped;
    var keys = Object.keys(d.TreeSignTurns.h);
    for (var i = 0; i < keys.length; i++) {
      var p = keys[i];
      d.TreeSignTurns.h[p] =
        d.TreeSignTurns.h[p] *
        (1 + s.TreeStats.h.b / 100) *
        Math.min(5, Math.pow(1.1 + s.TreeStats.h.a / 100, i + 1));
    }
  };
  Blocks._customBlock_TreeRespawnLoop = function () {
    var s = state();
    var keys = Object.keys(s.TreeBig.h);
    for (var i = 0; i < keys.length; i++) {
      var p = keys[i];
      s.TreeBig.h[p] =
        s.TreeBig.h[p] /
        (1 +
          (Blocks._customBlock_TreeReads() + s.TreeBase + s.TreeList[i]) / 100);
    }
  };
  // Spec 010 (T163): the Mob respawn by world. Each turn's branch is the list whose search found the turn's key; each
  // world divides by its own sum (the second scales its common part by 0.65, the third changes from turn to turn), and
  // the key in no list (a cave) has a line of its own. The keys come with the worlds mixed.
  Blocks._customBlock_TreeRespawnWorlds = function () {
    var s = state();
    var U = A["com.stencyl.utils.Utils"];
    var keys = Object.keys(s.TreeMobs.h);
    for (var i = 0; i < keys.length; i++) {
      var g = keys[i];
      var m = s.TreeMobs.h[g];
      U.contains(s.TreeWorlds[0], g)
        ? (m.h.Time =
            m.h.Time /
            (1 +
              (Blocks._customBlock_TreeReads() + s.TreeBase + s.TreeStats.h.a) /
                100))
        : U.contains(s.TreeWorlds[1], g)
          ? (m.h.Time =
              m.h.Time /
              (1 +
                (0.65 * (Blocks._customBlock_TreeReads() + s.TreeBase) +
                  s.TreeStats.h.b) /
                  100))
          : U.contains(s.TreeWorlds[2], g)
            ? (m.h.Time =
                m.h.Time /
                (1 +
                  (Blocks._customBlock_TreeReads() +
                    s.TreeBase +
                    s.TreeStats.h.a * (i + 1)) /
                    100))
            : (m.h.Time = m.h.Time / (1 + (s.TreeBase + s.TreeLevel) / 100));
    }
  };
  // A read of 7, and a call that gives 7 passed on: the call is the root (T150).
  Blocks._customBlock_TreeLayerReadPass = function () {
    var seven = state().TreeSeven;
    return Blocks._customBlock_TreeLegend("Max", seven - 1, 0);
  };
  // Spec 010 (T145): a factor of a product, the part a blueprint can point at; a marker that changes the path, put
  // only in the copy the recorder runs on; a call that fails.
  Blocks._customBlock_TreeDeclFactor = function () {
    var s = state();
    return (
      Blocks._customBlock_TreeReads() *
      (Blocks._customBlock_TreeLoop() * s.TreeTwins[0]) *
      s.TreeBase
    );
  };
  Blocks._customBlock_TreeDeclMarked = function () {
    var s = state();
    if (s.TreeMark === "gimme")
      return Blocks._customBlock_TreeReads() * s.TreeBase;
    return Blocks._customBlock_TreeReads() + s.TreeBase;
  };
  Blocks._customBlock_TreeDeclFails = function () {
    return state().TreeMissing.h.v + 1;
  };
  // Spec 010 (T148): the running total set to 0 in the init of a for loop, summed in the loop, then multiplied.
  Blocks._customBlock_TreeLoopZero = function () {
    var list = state().TreeList;
    var d = dnsm();
    var i;
    d.TreeLoopZero = new StringMap();
    for (d.TreeLoopZero.h.v = 0, i = 0; i < list.length; i++)
      d.TreeLoopZero.h.v = d.TreeLoopZero.h.v + list[i] * 2;
    d.TreeLoopZero.h.v = d.TreeLoopZero.h.v * state().TreeBase;
    return d.TreeLoopZero.h.v;
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
