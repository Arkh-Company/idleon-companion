// A reading translated by the catalog into the one context every module sees (spec §6.2).
import type { Catalog, GameContext, Reading } from "../shared/index.ts";
import { catalogKey, unnamedIn } from "./catalog/catalog.ts";

export function toContext(r: Reading, cat: Catalog): GameContext {
  const names: GameContext["names"] = {};
  const map = cat.maps[r.map];
  if (map !== undefined) names.map = map;
  const menu = cat.menu[catalogKey(r.menu)];
  if (menu !== undefined) names.menu = menu;
  const window = cat.menu2[catalogKey(r.menu2)];
  if (window !== undefined) names.window = window;
  const codexTab =
    r.menu === 3 && r.codexTab !== null
      ? cat.codex[catalogKey(r.codexTab)]
      : undefined;
  if (codexTab !== undefined) names.codexTab = codexTab;
  const afk = r.afk === null ? undefined : cat.afk[r.afk];
  if (afk !== undefined) names.afk = afk;

  return {
    screen: {
      world: Math.floor(r.map / 50) + 1,
      map: r.map,
      menu: r.menu,
      window: r.menu2,
      tab: r.menu2tab,
      codexTab: r.codexTab,
      codexSel: r.codexSel,
    },
    character: r.char,
    afk: r.afk,
    names,
    unnamed: unnamedIn(cat, r),
    updatedAt: r.t,
  };
}
