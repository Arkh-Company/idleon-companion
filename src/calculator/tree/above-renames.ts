// pieces.cjs `rename` from the bench at BASELINE-4 (spec 008, T023), the rules that look at the rows above a row: its
// parent's code, or the calls and caches it sits under in its piece (the bench renames each piece from its head, which
// has no parent). They run when a level gets its place (tree/places.ts), before its ⓘ, as the bench renames the piece
// before `addFormulas`; then opus3Leaves OPUS3-F5, which names the same scratch number again when its parent is the
// bubble, and opus3More OPUS3-F7f, the friend's score under a friend's bonus. Left out, each needing what the app's tree has not: OPUS4-7's rules on a parent named by its own sum with numbers
// (the class levels, the meals before the last one, the class bubble not computed yet; the app's branch has no such name),
// the Green Mushroom kills and the kitchens' upgrade levels (the same, on the parent's name), "Total of the earlier turns"
// (the app opens a loop's read of its own entry into its writer), the Spelunking "Part N" (no "Part N", R14) and the
// opening of SpelunkyUpgTOT into its push.
import type { CALC_LEAF_KINDS } from "../tree-contract.ts";
import { fx3 } from "./curves.ts";
import { atOneParts } from "./formulas.ts";
import { near } from "../recorded/math.ts";
import { lastAbove } from "./last-renames.ts";
import { bare, unlinked } from "./rows.ts";
import { isLeaf, untyped } from "./row-checks.ts";
import type { Row } from "./rows.ts";

type Leaf = (typeof CALC_LEAF_KINDS)[number];
/** A row above a level: its code and its name. */
export interface Above {
  code: string | null;
  name: string;
}

/** Row `r` named `name`, a leaf typed `leaf` when it is one (its "?" and why gone); a branch only renamed. */
function renamed(
  r: Row,
  name: string,
  leaf: Leaf | null,
  why: string | null = null,
): Row {
  const flags = { ...r.node.flags };
  delete flags.unnamed;
  const typed =
    leaf && isLeaf(r) ? { leaf, condition: null, why } : ({} as const);
  return { ...r, node: { ...r.node, name, flags, ...typed } };
}

/** OPUS4-7: the scratch numbers of TalentCalc's bubbles loop, by the nearest bubble above (`AlchBubbles.<bubble>`). */
export const BUBBLE_SCRATCH: readonly {
  test: RegExp;
  dn: string;
  name: string;
  leaf: Leaf;
  proof: string;
}[] = [
  [/^[WAM][24]$/, "2", "Slab items found ÷ 100 (rounded down)", "quantity"],
  [
    /^(W8|A9|M9|[WAM]10AllCharz)$/,
    "2",
    "Tome points above 5000, per 2000 (rounded down)",
    "quantity",
  ],
  [/^(W7|A8|M7)$/, "2", "Class level above 500, per 10 (at least 1)", "level"],
  [/^W9AllCharz$/, "1", "Total class level of the Warriors", "level"],
  [/^A7AllCharz$/, "2", "Total class level of the Archers", "level"],
  [/^M8AllCharz$/, "3", "Total class level of the Mages", "level"],
  [/^MealSpdz$/, "2", "Meals at level 11 or more", "quantity"],
  [
    /^Y6$/,
    "1",
    "World 6 maps with every kill done (13 maps, each character)",
    "quantity",
  ],
].map(([test, dn, name, leaf]) => ({
  test: test as RegExp,
  dn: dn as string,
  name: name as string,
  leaf: leaf as Leaf,
  proof: "bench pieces.cjs rename OPUS4-7; N.js TalentCalc",
}));

/** OPUS3-F5: the multiplier TalentCalc puts in CalcTalentDN2 before multiplying the bubble that is its parent. */
export const BUBBLE_FACTOR: readonly {
  test: RegExp;
  name: string;
  leaf: Leaf;
  formula: string;
  proof: string;
}[] = [
  [
    /^[WAM][24]$/,
    "Items found in the Slab, in hundreds",
    "quantity",
    "floor(Items found in the Slab ÷ 100)",
  ],
  [
    /^(W7|A8|M7)$/,
    "Class level above 500, in tens",
    "level",
    "max(1, floor((Class level − 500) ÷ 10))",
  ],
  [
    /^(W8|A9|M9|[WAM]10AllCharz)$/,
    "Tome points above 5000, per 2000",
    "quantity",
    "floor(max(0, (Tome points − 5000) ÷ 2000))",
  ],
].map(([test, name, leaf, formula]) => ({
  test: test as RegExp,
  name: name as string,
  leaf: leaf as Leaf,
  formula: formula as string,
  proof: "bench pieces.cjs opus3Leaves OPUS3-F5; N.js TalentCalc",
}));

/** Spelunk(ShopUpgBonus): the working value each upgrade's loop sums, by the upgrade above (the bench's game texts). */
export const SPELUNK_TOTALS: Readonly<Record<number, readonly [string, Leaf]>> =
  {
    0: ["Total Spelunking level of all characters", "level"],
    8: ["Total Spelunking level of all characters", "level"],
    2: ["Best depths of every tunnel, added up", "record"],
    9: ["Best depths of every tunnel, added up", "record"],
    3: ["Digits of the biggest haul of every tunnel, added up", "record"],
    54: ["Manic depths of every tunnel, added up", "record"],
    55: ["Manic depths of every tunnel, added up", "record"],
    56: ["Manic depths of every tunnel, added up", "record"],
  };

/** The rules by their parent's code or the calls above, with their proof. */
export const ABOVE_RENAMES = {
  riftSkills: {
    /** The start of the parent's call. */
    test: 'RiftStuff("RiftSkillETC"',
    name: "Total of the earlier skills",
    why: "progress of the loop in RiftStuff(RiftSkillETC): 7 plus the bonus of the skills before this one, before this skill adds to it (N.js)",
    proof: "bench pieces.cjs rename deep-2 rule 53; N.js RiftStuff",
  },
  /** A fixed number, a fixed value already: only its name changes. */
  fixed: [
    {
      test: /^ArcadeBonus\(/,
      value: 2,
      name: "Maxed doubler ×2",
      proof: "bench pieces.cjs rename; N.js ArcadeBonus",
    },
    {
      test: /^Holes\("B_UPG", 46/,
      value: null,
      name: "Bonus per colony defeated",
      proof: "bench pieces.cjs rename H1-GLOOMIE; N.js Holes",
    },
    {
      test: /MonumentROGbonuses/,
      value: null,
      name: "Bonus per monument level",
      proof: "bench pieces.cjs rename; N.js Holes",
    },
  ],
  earlier: [
    {
      test: /FarmingStuffs\("CropSCbonus"/,
      name: "Crop types found",
      leaf: "quantity",
      proof: "bench pieces.cjs rename; N.js FarmingStuffs",
    },
    {
      test: /Holes\("MeasurementBaseBonus"/,
      name: "Measurement base bonus",
      leaf: "fixedValue",
      proof: "bench pieces.cjs rename; N.js Holes",
    },
  ],
  friendScore: {
    test: /FrendBonzStatz|FriendBonusQTY/,
    name: "Friend score",
    proof: "bench pieces.cjs opus3More OPUS3-F7f; N.js Thingies",
  },
  spelunk: {
    test: /^Spelunk\("ShopUpgBonus", (\d+),/,
    proof: "bench pieces.cjs rename; N.js Spelunk",
  },
} as const;

/** One row renamed by the rows above it, `up` from its piece's head down to its parent. */
function aboveRename(r: Row, up: readonly Above[]): Row {
  const code = r.node.code ?? "";
  const parent = up.at(-1)?.code ?? "";
  const leaf = isLeaf(r);
  /** The nearest bubble above, by its key in AlchBubbles. */
  const bubble = [...up]
    .reverse()
    .map((a) => /^DNSM\.AlchBubbles\.(\w+)$/.exec(a.code ?? "")?.[1])
    .find((b) => b !== undefined);
  // OPUS4-7, a value from an earlier step: under Y6, the maps with every kill done (with no look at the parent's name)
  const y6 = BUBBLE_SCRATCH.find((x) => x.test.test("Y6"));
  if (leaf && r.earlier && bubble === "Y6" && y6)
    return renamed(r, y6.name, y6.leaf);
  // OPUS4-7 and then OPUS3-F5: a scratch number of the bubbles loop
  const dn = /^DNSM\.CalcTalentDN(\d)$/.exec(code);
  if (leaf && dn) {
    const s =
      bubble !== undefined &&
      BUBBLE_SCRATCH.find((x) => x.test.test(bubble) && x.dn === dn[1]);
    let out = s ? renamed(r, s.name, s.leaf) : r;
    const own = /^DNSM\.AlchBubbles\.(\w+)$/.exec(parent)?.[1];
    const f =
      dn[1] === "2" &&
      own !== undefined &&
      BUBBLE_FACTOR.find((x) => x.test.test(own));
    if (f) {
      const v = r.node.value;
      const shown = typeof v === "number" ? fx3(v) : String(v);
      out = renamed(out, f.name, f.leaf);
      out = {
        ...out,
        // (a rule of two lines: the bench's ⓘ is no sum of atoms)
        node: { ...out.node, formula: { rule: [f.formula, `= ${shown}`] } },
      };
    }
    return out;
  }
  const spelunk = ABOVE_RENAMES.spelunk.test;
  if (
    code === "DNSM.SpelunkyUpgDN" &&
    r.node.name.startsWith("Working value of the game")
  ) {
    const u = [...up]
      .reverse()
      .map((a) => spelunk.exec(a.code ?? "")?.[1])
      .find((x) => x !== undefined);
    const total = u === undefined ? undefined : SPELUNK_TOTALS[Number(u)];
    return total ? renamed(r, total[0], total[1]) : r;
  }
  const rift = ABOVE_RENAMES.riftSkills;
  if (leaf && code === "DNSM.skillLvRanksDN2" && parent.startsWith(rift.test))
    return renamed(r, rift.name, "unknown", rift.why);
  // (the bench also matches "Fixed multi", a name the app never gives)
  if (r.node.name.startsWith("Fixed ×")) {
    const x = ABOVE_RENAMES.fixed.find(
      (f) =>
        f.test.test(parent) &&
        (f.value === null || near(r.node.value, f.value)),
    );
    if (x) return renamed(r, x.name, null);
  }
  if (r.earlier) {
    const chain = up.map((a) => a.code ?? "").join(" ");
    const x = ABOVE_RENAMES.earlier.find((e) => e.test.test(chain));
    if (x) return renamed(r, x.name, x.leaf);
  }
  // OPUS3-F7f: an unlinked earlier value within three rows under a friend's bonus is the friend's score
  const f7f = ABOVE_RENAMES.friendScore;
  if (
    bare(r) &&
    unlinked(r) &&
    untyped(r) &&
    up.slice(-3).some((a) => f7f.test.test(a.code ?? ""))
  )
    return renamed(r, f7f.name, "quantity");
  return r;
}

/**
 * A level's rows renamed by the rows above them, `up` from their piece's head down to their parent (the first level, the
 * pieces' heads, has none: no rule renames there), and the rows of each branch, a row above its parts. The parts at ×1
 * the bench keeps under its group "At ×1" (tree/formulas.ts `atOneParts`) are renamed with that group above them, and
 * stay in their places (spec 009, FR-016). (A row that opens later keeps the rows above it without its groups: no rule
 * reads a row with no code.)
 */
export function aboveRenames(
  rows: readonly Row[],
  up: readonly Above[],
): Row[] {
  const aside = atOneParts(rows);
  if (!aside.size) return renameLevel(rows, up);
  const ones = rows.filter((r) => aside.has(r));
  const named = new Map(
    renameLevel(ones, [
      ...up,
      { code: null, name: `At ×1 (${String(ones.length)})` },
    ]).map((r, i) => [ones[i], r] as const),
  );
  const rest = renameLevel(
    rows.filter((r) => !aside.has(r)),
    up,
  );
  return rows.map((r) => named.get(r) ?? rest.shift() ?? r);
}

function renameLevel(rows: readonly Row[], up: readonly Above[]): Row[] {
  return rows.map((r) => {
    // opus5's rules by the rows above, after the bench's other passes (tree/last-renames.ts)
    const own = lastAbove(aboveRename(r, up), up, rows);
    if (!own.group) return own;
    const inside = [...up, { code: own.node.code, name: own.node.name }];
    return { ...own, group: aboveRenames(own.group, inside) };
  });
}
