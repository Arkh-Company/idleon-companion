// An unnamed sum inside a source whose call a check gates (audit family 14 with the deferred A15; spec 009, FR-005,
// FR-007, FR-008, FR-017, FR-018): the Meritocracy bonus multiplier's shape, (1 + a ÷ 100) × (a clamp + (bonuses) ÷
// 100) while a read is 0 or less, else 0. A call of one step a factor of which adds the bonuses of two sources or more
// opens in the pools of that step (rule Y, Vinicius's answer B of 20/11): its lone % factor × an Additive pool of the
// clamp and the bonuses by system, each pool closing; the read the check compares stays a row after them, the check
// said in the ⓘ (A39). Over the invented game (fake-game.js TreeMeritOf), invented values; a source named with a colon,
// as in the game.
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { buildTree } from "../tree-build.ts";
import { bootRecorder } from "../tree-record.ts";
import { kidsIn, openPath } from "./tree-fixture.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});
/**
 * The multiplier TreeMeritMulti, opened under TreeMeritOf: (1 + 8 ÷ 100) × (min(8, max(0.25, 8)) + (5 × 8 + 8 + 20 × 8
 * + 4 + 25 + 8) ÷ 100).
 */
const multi = () =>
  openPath(
    buildTree(
      recorder.record(mosaicOf(), [["TreeMeritOf", [0, 0, 0]]], {
        recompute: [],
        builders: [],
      }),
      0,
      recorder.ops,
    ),
    "TreeMeritMulti()",
  );
/** Each row under `n` already built, at any depth (a lazy source is not opened). */
const below = (n: CalcTreeNode | null | undefined): CalcTreeNode[] =>
  kidsIn(n).flatMap((k) => [k, ...below(k)]);
const poolOf = (n: CalcTreeNode | null | undefined) =>
  kidsIn(n).find((k) => k.role === "pool");
const linesOf = (f: CalcTreeNode["formula"] | undefined): [string, string] =>
  f && "rule" in f ? f.rule : ["", ""];
/** The line with names of an ⓘ, atoms or a rule. */
const namesOf = (f: CalcTreeNode["formula"] | undefined): string =>
  Array.isArray(f) ? f[0].join(" ") : linesOf(f)[0];

test("the multiplier opens in the pools of its one step: its lone % factor × an Additive pool, the check's read after", () => {
  const rows = kidsIn(multi());
  expect(rows.map((k) => [k.role, k.code, k.value])).toEqual([
    ["piece", null, 1.08],
    ["pool", null, 10.45],
    ["piece", "TreeOwned", 0],
  ]);
  expect(rows[0]?.fmt).toBe("x");
  expect(poolOf(multi())).toMatchObject({
    name: "Additive pool",
    combine: "sum",
    poolKind: "additive",
    flags: { closed: true },
  });
});

test("no step with no name stays, and every source of the step is a row of it (FR-007, FR-008)", () => {
  const all = below(multi());
  // no branch with no code and no proven name (FR-007)
  expect(
    all.filter(
      (k) =>
        k.code === null &&
        Array.isArray(k.kids) &&
        k.kids.length > 0 &&
        !!k.flags.unnamed,
    ),
  ).toEqual([]);
  const codes = new Set(all.map((k) => k.code));
  expect(
    [
      "ArcadeBonus(1)",
      "ArcadeBonus(3)",
      "ArcadeBonus(4)",
      "ArcadeBonus(2)",
      "ArcadeBonus(5)",
      "CardBonusREAL(1)",
      "TreeLevel",
      "TreeReads()",
      "TreeOwned",
    ].filter((c) => !codes.has(c)),
  ).toEqual([]);
});

test("the Additive pool holds the clamp as its row, in its system's group, its min and max in its ⓘ, its constants its rows (FR-008)", () => {
  const pool = kidsIn(poolOf(multi()));
  // fix tree-shape-091, rule 1: the clamp of one Arcade source sits in the group of Arcade's sources that are no %
  const own = pool.find((k) =>
    below(k).some((x) => x.code === "ArcadeBonus(3)"),
  );
  expect([own?.role, own?.name, own?.combine]).toEqual([
    "system",
    "🕹️ Arcade",
    "sum",
  ]);
  const clamp = kidsIn(own).find((k) =>
    kidsIn(k).some((x) => x.code === "ArcadeBonus(3)"),
  );
  expect([clamp?.value, clamp?.code, clamp?.flags.unnamed]).toEqual([
    8,
    null,
    undefined,
  ]);
  expect(namesOf(clamp?.formula)).toMatch(/^min \( 8 , max \( 0\.25 , /);
  expect(kidsIn(clamp).map((k) => k.name)).toEqual(
    expect.arrayContaining(["Cap 8", "Minimum 0.25"]),
  );
});

test("the bonuses of the Additive pool are by system, each in %: a group of two or more, and of one source (FR-017)", () => {
  const pool = kidsIn(poolOf(multi()));
  const group = (name: string, combine = "percent") =>
    pool.find(
      (k) => k.role === "system" && k.name === name && k.combine === combine,
    );
  const arcade = group("🕹️ Arcade");
  expect(arcade?.combine).toBe("percent");
  expect(kidsIn(arcade).map((k) => k.value)).toEqual([40, 8, 160]);
  // its ⓘ names its rows whole, "Arcade: Total Accuracy" too, and closes
  const af = arcade?.formula;
  expect(Array.isArray(af) && af[1].at(-1)).toBe(2.08);
  // fix tree-shape-091, rule 1: the lone card bonus in % is its system's group in %
  const cards = group("🃏 Cards");
  expect([cards?.value, cards?.fmt]).toEqual([0.04, "%"]);
  expect(kidsIn(cards).map((k) => k.code)).toEqual(["CardBonusREAL(1)"]);
  const other = group("🔹 Other");
  expect(other?.combine).toBe("percent");
  expect(kidsIn(other).map((k) => k.code)).toEqual([
    "TreeLevel",
    "TreeReads()",
  ]);
});

test("each pool closes, and the source's ⓘ is how they join, the lone factor's math in its own, the check after it", () => {
  const pf = poolOf(multi())?.formula;
  expect(Array.isArray(pf) && pf[1].at(-1)).toBe(10.45);
  const [names, numbers] = linesOf(multi()?.formula);
  expect(names).toMatch(/ × Additive pool \(.*: yes\)$/);
  expect(numbers).toMatch(/ = 11\.286$/);
  expect(namesOf(kidsIn(multi())[0]?.formula)).toBe(
    "1 + ( Base Defence ÷ 100 )",
  );
});
