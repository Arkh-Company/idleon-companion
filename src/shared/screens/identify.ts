// Which screen a reading is, by the catalog's rules (data-model.md, research R3).
import type { Reading, ScreenCatalog, ScreenRule } from "../types.ts";

const UNKNOWN_SCREEN = "Unknown screen";

function valueOf(r: Reading, key: string): unknown {
  if (Object.hasOwn(r.behaviors, key)) return r.behaviors[key];
  return Object.hasOwn(r, key) ? r[key as keyof Reading] : undefined;
}

const size = (rule: ScreenRule) => Object.keys(rule.when).length;

/** The name of the screen: an overlay first; the rule with most conditions; a tie or no rule is "Unknown screen". */
export function identifyScreen(r: Reading, catalog: ScreenCatalog): string {
  for (const list of [catalog.overlays, catalog.screens]) {
    const [winner, next] = list
      .filter((rule) =>
        Object.entries(rule.when).every(([k, v]) => valueOf(r, k) === v),
      )
      .toSorted((a, b) => size(b) - size(a));
    if (!winner) continue;
    if (next && size(next) === size(winner)) return UNKNOWN_SCREEN;
    return winner.tabs ? `${winner.name} › Unknown tab` : winner.name;
  }
  return UNKNOWN_SCREEN;
}
