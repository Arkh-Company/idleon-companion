// What the live reader reads, evaluated with the engine as `this` (spec §5.2). Plain property reads only: no game
// function is ever called and nothing is written (src/keeper/read-only.test.ts proves it). The reader reloads this
// file when it changes, so it can be adjusted without reopening the game.
(function () {
  var g = this.gameAttributes.h;
  var u = g.UserInfo;
  var ol = g.OptionsList;
  var sel = null;
  // Selected entry inside a Codex tab: Quests → quest giver (OptionsList[13][2]); Friends → friend (NonCloudsave[0][2]).
  if (g.MenuType === 3 && ol) {
    if (ol[12] === 0 && ol[13]) sel = ol[13][2];
    else if (ol[12] === 5 && g.NonCloudsave && g.NonCloudsave[0])
      sel = g.NonCloudsave[0][2];
  }
  // A missing value is null, because returnByValue drops undefined and that would fail the whole reading.
  var num = function (v) {
    return typeof v === "number" ? v : null;
  };
  var at = function (list, i) {
    return list ? num(list[i]) : null;
  };
  var simple = function (v) {
    var t = typeof v;
    return t === "number" || t === "string" || t === "boolean" ? v : null;
  };
  // GetPlayersUsernames only finds the character's place: no name leaves this function. Walked by index, no method call.
  var hole = null;
  var names = g.GetPlayersUsernames;
  if (u && typeof u[0] === "string" && names && g.Holes)
    for (var c = 0; c < names.length; c++)
      if (names[c] === u[0]) {
        hole = at(g.Holes[0], c);
        break;
      }
  // [PixelHelperActor index, ActorEvents number, field, indexes]; no indexes = a simple field (contracts/read-fields.md).
  var TABLE = [
    [0, 29, "_MenuType2TabPage"],
    [0, 29, "_AnvilTabSelected"],
    [0, 29, "_TabIndex0to5"],
    [1, 116, "_GeneralINFO", [17, 36]],
    [2, 167, "_GeneralInfo", [0]],
    [3, 201, "_GenINFO", [8, 15, 68, 81]],
    [4, 229, "_GenInfo", [0, 23]],
    [5, 232, "_GenINFO", [1, 17, 72]],
    [6, 312, "_GenINFO", [2, 42, 61, 76, 109, 111, 117]],
    [7, 340, "_GenINFO", [35, 38, 75]],
    [8, 481, "_GenINFO", [3, 5, 43, 45, 57]],
    [21, 510, "_GenINFO", [16, 51, 59]],
    [22, 548, "_GenINFO", [8, 54, 62, 82]],
    [23, 577, "_GenINFO", [18, 70, 76]],
    [24, 623, "_GenINFO", [5, 9, 57, 146]],
    [25, 670, "_GenINFO", [42, 213]],
    [26, 713, "_GenINFO", [49, 124]],
    [27, 741, "_GenINFO", [0, 19, 116, 142, 212]],
  ];
  var behaviors = {};
  var actors = g.PixelHelperActor;
  for (var a = 0; a < TABLE.length; a++) {
    var row = TABLE[a];
    // A behavior that does not exist yet (character select) throws on this path: no key and no error.
    try {
      var value =
        actors[row[0]].behaviors.cache.h["ActorEvents_" + row[1]].script[
          row[2]
        ];
      var key = "H" + row[0] + "." + row[2];
      if (!row[3]) behaviors[key] = simple(value);
      else
        for (var b = 0; b < row[3].length; b++)
          behaviors[key + "[" + row[3][b] + "]"] = value
            ? simple(value[row[3][b]])
            : null;
    } catch (absent) {
      void absent;
    }
  }
  return {
    map: g.CurrentMap,
    menu: g.MenuType,
    menu2: g.MenuType2,
    menu2tab: g.MenuType2TabSelected,
    skillTab: g.SkillTabSelected,
    // A missing value would be dropped by returnByValue and fail the whole reading's shape check.
    char: u && typeof u[0] === "string" ? u[0] : null,
    afk: g.AFKtarget === undefined ? null : g.AFKtarget,
    codexTab: ol && typeof ol[12] === "number" ? ol[12] : null,
    codexSel: typeof sel === "string" || typeof sel === "number" ? sel : null,
    scene:
      this.scene && typeof this.scene.name === "string"
        ? this.scene.name
        : null,
    attack: num(g.AttackSelected),
    bag: num(g.InventorySelected),
    ol1: at(ol, 1),
    ol3: at(ol, 3),
    ol18: at(ol, 18),
    ol19: at(ol, 19),
    ola489: at(g.OptionsListAccount, 489),
    nd37: at(g.NONdummies, 37),
    hole: hole,
    behaviors: behaviors,
  };
});
