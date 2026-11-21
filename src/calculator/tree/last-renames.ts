// pieces.cjs `opus5` from the bench at BASELINE-4 (spec 008, T023), its rules beyond the OPUS5 list (tree/leaf-passes.ts):
// the bench runs it last, over every leaf, after the names and before the ⓘ. Here a rule by the leaf's own code runs in
// its level's `finish` after the code rules (`lastLeaf`), a rule by the rows above it when its level gets its place,
// after the renames by the rows above (`lastAbove`, tree/above-renames.ts), the count of maps's own name by its rows
// with the other passes on a row and its level (`mapsByKills`, tree/parent-passes.ts), and the statue's base bonus over
// the recording when a level gets its place (`baseStatue`, tree/places.ts). Each why says what the game's value holds,
// never its paths. The ⓘ of a parent follows its rows' new names by itself (its ⓘ is built from them when it is placed:
// the bench's `retext`). Left out, each needing what the app's tree has not (research R14): `rename5`'s names written
// with a game path (the app's names never hold one: the set's weapon, the world portals, the numbers cut from a text of
// the Big Fish and the Lore epilogues, which the app's row does not keep the text of), the friend's score under a
// branch named by its own sum and the Arcane upgrade under an ⓘ that names "Value from an earlier step" (the app names
// neither), the earlier worn items under a "Worn item (group, slot)" row (the app's worn item rows have other names),
// `relink` (the app links a value to the block's read with it already, tree/val-path.ts), `signTurn` (no "Part N",
// R14) and `openBubble` (the app opens a bubble read in its own loop already, tree/caches.ts OPUS4-4).
import type { RecNode } from "../recording.ts";
import type { Above } from "./above-renames.ts";
import { fx3 } from "./curves.ts";
import { near } from "../recorded/math.ts";
import { nameOf } from "../names/names.ts";
import { bare, row, unlinked } from "./rows.ts";
import { untyped, withName } from "./row-checks.ts";
import type { Row } from "./rows.ts";

const O5 = (block: string) => `bench pieces.cjs opus5 OPUS5; N.js ${block}`;

/** Each rule, with what it tests. */
export const LAST_RENAMES = {
  /** rename5: the Big Fish upgrade's level, read with no name of its own. */
  bigFish: {
    test: /^Spelunk\[11\]\[(\d+)\]$/,
    proof: O5("Spelunk BigFishBonuses"),
  },
  /** TOME_DN2: TalentCalc's Tome points over 5,000 in steps of 2,000, under a Tome bonus or a Tome bubble. */
  tome: {
    test: /^(Summoning\("TomeBonus", [345],|DNSM\.AlchBubbles\.(W8|A9|M9)$)/,
    name: "Tome points above 5,000, per 2,000",
    proof: O5("TalentCalc"),
  },
  /** OPUS5_AT: the golden food total's 0 before the loop over the food slots. */
  goldStart: {
    test: /^DNSM\.GfoodBonus$/,
    name: "Golden food total: start value",
    proof: O5("GoldFoodBonuses"),
  },
  /** OPUS5_PROGRESS: the running totals of the loops, each by its label. */
  winBonus: {
    test: /^DNSM\.SummWinBonus\[\d+\]$/,
    name: "Total of the earlier turns",
    why: "progress of the loop in Summoning(WinBonus): the running total of this bonus type before this win adds to it (N.js)",
    proof: O5("Summoning"),
  },
  kingdom: {
    test: /^DNSM\.TKnS_DN$/,
    name: "Total of the earlier turns",
    why: "progress of the loop in RoyalG(TotalStatz): the running total of the earlier maps or entries (N.js)",
    proof: O5("RoyalG"),
  },
  maps: {
    test: /^DNSM\.CalcTalentMAP\[209\]$/,
    name: "Total of the earlier maps",
    parent: "Fighting maps with at least 1 billion kills",
    why: "progress of the loop in TalentCalc: the maps with at least 1 billion kills counted before this one (N.js)",
    proof: O5("TalentCalc"),
  },
  overkill: {
    test: /^RunCodeOfTypeXforThingY\("OverkillStuffs", "2"/,
    name: "Last overkill step passed (loop index)",
    why: "progress of the loop in RunCodeOfTypeXforThingY(OverkillStuffs, 2): the index of the last step whose kill mark the max damage beats (N.js)",
    proof: O5("RunCodeOfTypeXforThingY"),
  },
  foodSlots: {
    test: /^DNSM\.playHPbasePOT2$/,
    name: "Total of the earlier food slots",
    why: "progress of the loop in TotalFoodBonuses: the running total of the earlier food slots (N.js)",
    proof: O5("TotalFoodBonuses"),
  },
  /** A star sign's amount in a sign total is a raw bonus like the others, also the first one ("amount + 0"). */
  sign: {
    test: /\(sign \d+\)$/,
    parent: /^DNSM\.StarSigns\./,
    proof: O5("StarSigns"),
  },
  /** openStatue: the statue's first product, its level × its bonus per level, before the multipliers. */
  statue: {
    test: "DNSM.statuearbDN",
    above: /^ArbitraryCode\("StatueBonusGiven(\d+)"\)$/,
    proof: O5("ArbitraryCode StatueBonusGiven"),
  },
};

/** Leaf `r` named `name` and typed, with `why` (null: none). */
function typed(
  r: Row,
  name: string,
  leaf: NonNullable<Row["node"]["leaf"]>,
  why: string | null,
): Row {
  const n = withName(r, name);
  return { ...n, node: { ...n.node, leaf, condition: null, why } };
}

/** The rules by the leaf's own code, after the code rules of its level (tree/leaf-passes.ts). */
export function lastLeaf(r: Row): Row {
  if (!bare(r)) return r;
  const code = r.node.code ?? "";
  const R = LAST_RENAMES;
  const fish = R.bigFish.test.exec(code)?.[1];
  // (rename5 renames a read the bench named by its path: the app's has no name of its own then)
  const n =
    fish !== undefined && r.node.flags.unnamed
      ? withName(r, `Big Fish upgrade ${fish} level`)
      : r;
  if (!untyped(n)) return n;
  if (R.goldStart.test.test(code) && near(n.node.value, 0))
    return typed(n, R.goldStart.name, "fixedValue", null);
  for (const p of [R.kingdom, R.foodSlots])
    if (p.test.test(code)) return typed(n, p.name, "unknown", p.why);
  return n;
}

/**
 * The rules by the rows above leaf `r` of the level `rows`, `up` from its piece's head down to its parent, after the
 * renames by the rows above (tree/above-renames.ts).
 */
export function lastAbove(
  r: Row,
  up: readonly Above[],
  rows: readonly Row[],
): Row {
  if (!bare(r)) return r;
  const R = LAST_RENAMES;
  const code = r.node.code ?? "";
  const parent = up.at(-1)?.code ?? "";
  if (
    code === "DNSM.CalcTalentDN2" &&
    up.some((a) => R.tome.test.test(a.code ?? ""))
  )
    return typed(r, R.tome.name, "quantity", null);
  if (!untyped(r)) {
    // the first sign of a sign total took a fixed value (its step is "amount + 0")
    return r.node.leaf === "fixedValue" &&
      R.sign.test.test(r.node.name) &&
      R.sign.parent.test(parent)
      ? { ...r, node: { ...r.node, leaf: "rawBonus" } }
      : r;
  }
  if (R.winBonus.test.test(code) && rows.length > 1 && near(r.node.value, 0))
    return typed(r, R.winBonus.name, "unknown", R.winBonus.why);
  if (unlinked(r) && parent === "DNSM.CalcTalentMAP[209]")
    return typed(r, R.maps.name, "unknown", R.maps.why);
  if (unlinked(r) && R.overkill.test.test(parent))
    return typed(r, R.overkill.name, "unknown", R.overkill.why);
  return r;
}

/** The count of maps whose earlier maps' total is among its rows: its own name (OPUS5_PROGRESS); null: as it is. */
export function mapsByKills(n: Row, rows: readonly Row[]): string | null {
  return n.node.code === "DNSM.CalcTalentMAP[209]" &&
    rows.some((k) => k.earlier && k.node.name === LAST_RENAMES.maps.name)
    ? LAST_RENAMES.maps.parent
    : null;
}

/**
 * openStatue: the statue's base bonus read under its own ArbitraryCode call (`up`), whose value is the statue's level ×
 * its bonus per level as that call read them: a branch of those two, with its ⓘ; else `r` as it is.
 */
export function baseStatue(
  r: Row,
  up: readonly Above[],
  nodes: readonly RecNode[],
): Row {
  const S = LAST_RENAMES.statue;
  if (r.node.code !== S.test || !bare(r)) return r;
  const i = up
    .map((a) => S.above.exec(a.code ?? "")?.[1])
    .filter((x) => x !== undefined)
    .pop();
  if (i === undefined) return r;
  const call = nodes.find(
    (x) => x.b === "ArbitraryCode" && x.a[0] === `StatueBonusGiven${i}`,
  );
  const reads = new Map((call?.r ?? []).map(([p, v]) => [p, v]));
  const pl = `StatueLevels[${i}][0]`;
  const pb = `CustomLists.StatueInfo[${i}][3]`;
  const L = Number(reads.get(pl));
  const B = Number(reads.get(pb));
  if (!(L >= 0 && B >= 0) || !near(L * B, r.node.value)) return r;
  const lv = nameOf(pl) ?? "Statue level";
  const part = (
    code: string,
    name: string,
    value: number,
    leaf: "level" | "fixedValue",
  ): Row => ({
    node: row({ pieceKey: null, value, code, name, leaf }),
    open: null,
  });
  const n = withName(r, "Base statue bonus");
  return {
    ...n,
    node: { ...n.node, leaf: null, condition: null, why: null },
    group: [
      part(pl, lv, L, "level"),
      part(pb, "Bonus per statue level", B, "fixedValue"),
    ],
    f: [
      `${lv} × Bonus per statue level`,
      `${String(L)} × ${String(B)} = ${fx3(Number(r.node.value))}`,
    ],
  };
}
