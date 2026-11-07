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
  };
});
