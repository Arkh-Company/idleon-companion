// Family 13 of the audit of 19/11 (decision 6): a bonus whose game text is a whole description is named by a short name,
// "System: name", and the description goes to its ⓘ, a rule of two lines (the text, then its value), as the ⓘ of a
// bench's rule (tree/above-renames.ts). The short names of the Killroy shop are the Vinicius's of 19/11, by what the
// bonus raises; the texts are the game's, over its checked tables (tree/table-names.ts).
import type { CalcTreeNode } from "../tree-contract.ts";
import { fx3 } from "./curves.ts";
import { partText, tableText } from "./table-names.ts";

/**
 * N.js RandomEvent KillroyBonuses(t): the bonus t of the Killroy shop, whose text is SkullShopDesc[r][0] for the row
 * r = KILLROY[t].row (bench 007 catalog), by its short name.
 */
export const KILLROY: readonly { row: number; name: string }[] = [
  { row: 11, name: "Killroy: Artifact Find Chance" },
  { row: 13, name: "Killroy: Crop Evolution Chance" },
  { row: 14, name: "Killroy: Jade Gain" },
  { row: 15, name: "Killroy: Gallery Grade chance" },
  { row: 16, name: "Killroy: Masterclass drops" },
  { row: 17, name: "Killroy: World 7 skill EXP" },
  { row: 18, name: "Killroy: Daily coral gain" },
];
/** The short name of the Killroy shop's row r, or null. */
export const killroyName = (r: number): string | null =>
  KILLROY.find((k) => k.row === r)?.name ?? null;

const n = (m: RegExpExecArray) => Number(m[1]);
/** The game's whole text of a row's bonus, by its code, each with its proof by reference. */
export const DESCS: readonly {
  test: RegExp;
  text: (m: RegExpExecArray) => string | null;
  proof: string;
}[] = [
  {
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
    test: /^WeeklyBoss\.d_(\d+)$/,
    text: (m) => tableText("dreamTask", n(m)),
    proof: "N.js Dreamstuff (the task t of the Equinox is DreamChallenge t 0)",
  },
];

/** The ⓘ of the row of `code` and value `v` when its name is short: the game's whole text, then its value; else null. */
export function descFormula(
  code: string | null,
  v: unknown,
): CalcTreeNode["formula"] {
  if (code === null) return null;
  for (const d of DESCS) {
    const m = d.test.exec(code);
    const text = m ? d.text(m) : null;
    if (text !== null)
      return {
        rule: [text, `= ${typeof v === "number" ? fx3(v) : String(v)}`],
      };
  }
  return null;
}
