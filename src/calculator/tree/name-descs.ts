// Family 13 of the audit of 19/11 (decision 6): a bonus whose game text is a whole description is named by a short name,
// "System: name", and the description goes to its ⓘ, a rule of two lines (the text, then its value), as the ⓘ of a
// bench's rule (tree/above-renames.ts). The texts are the game's, over its checked tables (tree/table-names.ts). A row
// that opens into its parts, as a Killroy bonus over its reads, keeps the ⓘ of its math with the text beside it, a line
// of its own (review r1 and r2, tree/formulas.ts withFormula).
import type { CalcTreeNode } from "../tree-contract.ts";
import { fx3 } from "./curves.ts";
import { KILLROY } from "../names/killroy-names.ts";
import { MERIT_SHOP } from "../names/merit-names.ts";
import { recipeName } from "../names/names.ts";
import { partText, tableText } from "../names/table-names.ts";

const n = (m: RegExpExecArray, k = 1) => Number(m[k]);
/** The game's whole text of a row's bonus, by its code, each with its proof by reference. */
export const DESCS: readonly {
  test: RegExp;
  text: (m: RegExpExecArray) => string | null;
  proof: string;
}[] = [
  {
    // N.js RandomEvent KillroyBonuses(t): the shop's text SkullShopDesc[KILLROY[t].row][0] (tree/killroy-names.ts)
    test: /^RandomEvent\("KillroyBonuses", (\d+), 0\)$/,
    text: (m) => {
      const k = KILLROY[n(m)];
      return k ? tableText("killroyShop", k.row) : null;
    },
    proof: "N.js RandomEvent KillroyBonuses",
  },
  {
    // OptionsListAccount[452 + r] counts the buys of the shop's row r (N.js ActorEvents_481 Click2)
    test: /^OptionsListAccount\[(467|468)\]$/,
    text: (m) => tableText("killroyShop", n(m) - 452),
    proof: "N.js ActorEvents_481 Click2",
  },
  {
    test: /^Spelunk\("DoWeHaveLoreN1", (\d+), 0\)$/,
    // (the table the cave's name reads, kept at the boot: tree/table-names.ts cave)
    text: (m) =>
      partText({
        table: "CustomLists.Spelunky",
        index: [14, n(m)],
        field: null,
        transform: "clean-keep-case",
      }),
    proof: "N.js Spelunk (the lore of cave c is Spelunky 14 c)",
  },
  {
    // the shop's screen draws, for Tasks[2][w][i], the lines TaskShopDesc[w][i][0] and [1]: the recipe's text of the
    // purchase (names-recipes.json, "World N merit purchases: {0} {1}"), its own words only ("Descline2": no line)
    test: MERIT_SHOP.test,
    text: (m) =>
      recipeName(m.input)
        ?.replace(/^World \d+ merit purchases: /, "")
        .replace(/ Descline2$/, "")
        .trim() ?? null,
    proof: "N.js TaskShopDesc (the two lines the shop draws)",
  },
  {
    test: /^WeeklyBoss\.d_(\d+)$/,
    // the recipe's text of the task (names-recipes.json, "{0} (dream progress)"), DreamChallenge[t][0]
    text: (m) =>
      recipeName(m.input)?.replace(/ \(dream progress\)$/, "") ?? null,
    proof: "N.js Dreamstuff (the task t of the Equinox is DreamChallenge t 0)",
  },
];

/** The game's whole text of the bonus of the row of `code`, by the first rule that has one; null with none. */
export function descText(code: string | null): string | null {
  if (code === null) return null;
  for (const d of DESCS) {
    const m = d.test.exec(code);
    const text = m ? d.text(m) : null;
    if (text !== null) return text;
  }
  return null;
}

/**
 * The ⓘ a row of `code` and value `v` is made with: the game's whole text, then its value (a value that is no number
 * writes no number); else null. A row that opens into its parts takes the ⓘ of its math instead, the text beside it
 * (tree/formulas.ts withFormula).
 */
export function descFormula(
  code: string | null,
  v: unknown,
): CalcTreeNode["formula"] {
  const text = descText(code);
  return text === null
    ? null
    : {
        rule: [
          text,
          typeof v === "number" && Number.isFinite(v) ? `= ${fx3(v)}` : "",
        ],
      };
}

/** Formula `f` with the game's text `text` as a line of its own before its math (fix/tree-names r2). */
export function withText(
  f: CalcTreeNode["formula"],
  text: string | null,
): CalcTreeNode["formula"] {
  if (f === null || text === null) return f;
  return Array.isArray(f) ? [f[0], f[1], text] : { ...f, text };
}
