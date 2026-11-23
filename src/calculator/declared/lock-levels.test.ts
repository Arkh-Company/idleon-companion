// The lock below the pools (spec 010, FR-010, FR-002b, FR-005, FR-016, research R2-R6): each level closes by its
// recorded expression, remounted with the declared children's values, from chains of two levels down (lesson 5 of 008).
// The invented Drop Rate (TreeDeclChain, decl-chain) is the ground.
import { expect, test } from "vitest";
import type { RecNode, Recording } from "../recording.ts";
import {
  chainInput,
  inventedBlueprint,
  levelContext,
  recorded,
  sourceOf,
} from "./lock-fixture.ts";
import { lockLevels } from "./lock-levels.ts";
import { lockBlueprint } from "./lock.ts";
import type { LockInput } from "./lock.ts";

const lock = (input: LockInput) => lockBlueprint(input, "check").errors;
const TALENT = "decl-chain/0/talents/talent";
const callOf = (rec: Recording, block: string): RecNode => {
  const n = rec.nodes.find((x) => x.b === block);
  if (!n) throw new Error(`no call of ${block}`);
  return n;
};

test("a source with two levels of children closes at each level by the recorded expression", () => {
  const { rec, ops } = recorded("TreeDeclChain");
  const bp = inventedBlueprint("decl-chain");
  expect(
    lockLevels(
      sourceOf(bp, 0, "talents", "talent", "talent"),
      callOf(rec, "TreeDeclTalent"),
      levelContext(rec, ops, `${TALENT}/talent`),
    ),
  ).toEqual({
    errors: [],
    counts: { closed: 1, closedByRecorded: 0, leaves: 1, branches: 1 },
  });
  // the term's level is remounted with its children's values: another recorded TreeTwins[0] breaks it
  const input = chainInput();
  const root = callOf(input.rec, "TreeDeclChain");
  root.r = root.r?.map((r) => (r[0] === "TreeTwins[0]" ? [r[0], 4] : r));
  const term = input.key.pools[0]?.terms[1]?.value ?? NaN;
  expect(lock(input)).toEqual([
    {
      kind: "notClosing",
      where: TALENT,
      expected: term,
      got: expect.closeTo((term / 3) * 4, 9) as number,
    },
  ]);
});

test("a part of the expression with no declared child is undeclaredPart; a declared child the expression does not use is childOutside; one with no recorded value is childNoValue", () => {
  const bp = inventedBlueprint("decl-chain");
  const points = sourceOf(bp, 0, "talents", "talent", "talent", "points");
  points.ref = { read: "PlayerDATABASE[{character}].SkillLevels[1]" };
  expect(lock(chainInput(bp))).toEqual([
    { kind: "childNoValue", where: `${TALENT}/talent/points` },
    {
      kind: "undeclaredPart",
      where: `${TALENT}/talent`,
      got: "PlayerDATABASE[0].SkillLevels[0]",
    },
  ]);

  const outside = inventedBlueprint("decl-chain");
  sourceOf(outside, 0, "family-bonuses", "best").children?.push({
    key: "count",
    name: "Invented Count",
    ref: { read: "GetPlayersUsernames.length" },
    leaf: "quantity",
  });
  expect(lock(chainInput(outside))).toEqual([
    { kind: "childOutside", where: "decl-chain/0/family-bonuses/best/count" },
  ]);
});

test("a curve whose arguments tie one to one closes by its own count; an ambiguous one by its recorded value, counted apart", () => {
  const { rec, ops } = recorded("TreeDeclChain");
  const bp = inventedBlueprint("decl-chain");
  const luck = lockLevels(
    sourceOf(bp, 0, "luk-stats", "luck"),
    callOf(rec, "TreeDeclLuck"),
    levelContext(rec, ops, "decl-chain/0/luk-stats/luck"),
  );
  expect(luck).toEqual({
    errors: [],
    counts: { closed: 0, closedByRecorded: 1, leaves: 1, branches: 1 },
  });
  // the talent's curve (40, 100, 3) is counted again from its steps: its recorded value plays no part…
  const input = chainInput();
  const curves = input.rec.nodes.filter((n) => n.b === "ArbitraryCode5Inputs");
  const [ambiguous, oneToOne] = curves;
  if (!ambiguous || !oneToOne) throw new Error("no curves");
  oneToOne.v = 2;
  expect(lock(input)).toEqual([]);
  // …and the luck's (20, 20, 20) closes by it
  ambiguous.v = 11;
  expect(lock(input)).toEqual([
    {
      kind: "notClosing",
      where: "decl-chain/0/luk-stats/luck",
      expected: 10,
      got: 11,
    },
  ]);
});

test("a declared condition: on with its term passes, off with its term or not recorded is conditionMismatch, off without its term passes", () => {
  const off = inventedBlueprint("decl-chain");
  const owned = sourceOf(off, 0, "bundles", "bundle").condition;
  if (!owned) throw new Error("no condition");
  owned.ref = { read: "TreeOwned" };
  expect(lock(chainInput(off))).toEqual([
    {
      kind: "conditionMismatch",
      where: "decl-chain/0/bundles/bundle/owned",
      expected: "on",
      got: 0,
    },
  ]);
  owned.ref = { read: "TreeNothing" };
  expect(lock(chainInput(off))).toEqual([
    {
      kind: "conditionMismatch",
      where: "decl-chain/0/bundles/bundle/owned",
      expected: "on",
    },
  ]);
  // TreeFlagOn 0: the game skips the + 2, and the bundle's condition says so
  expect(
    lock(chainInput(inventedBlueprint("decl-chain"), { TreeFlagOn: 0 })),
  ).toEqual([]);
});

test("a two-source term with no termPart child for its second source is undeclaredPart; with it, it closes by the term's expression", () => {
  const bp = inventedBlueprint("decl-chain");
  const talent = sourceOf(bp, 0, "talents", "talent");
  const twin = talent.children?.[1];
  if (!twin) throw new Error("no twin");
  delete twin.termPart;
  const refused = [
    { kind: "undeclaredPart", where: TALENT, got: "TreeTwins[0]" },
  ];
  expect(lock(chainInput(bp))).toEqual(refused);
  talent.children = talent.children?.slice(0, 1);
  expect(lock(chainInput(bp))).toEqual(refused);
});

test("{character} is the recorded character; * with no reading is childNoValue, never 0", () => {
  expect(lock({ ...chainInput(), character: 1 })).toEqual([
    { kind: "childNoValue", where: `${TALENT}/talent/points` },
  ]);
  const bp = inventedBlueprint("decl-chain");
  sourceOf(bp, 0, "family-bonuses", "best", "best-lv").ref = {
    read: "PlayerDATABASE[*].SkillLevels[9]",
  };
  expect(lock(chainInput(bp))).toEqual([
    { kind: "childNoValue", where: "decl-chain/0/family-bonuses/best/best-lv" },
    {
      kind: "undeclaredPart",
      where: "decl-chain/0/family-bonuses/best",
      got: "PlayerDATABASE[0].SkillLevels[1]",
    },
  ]);
});

test("a leaf with no kind is leafType", () => {
  const bp = inventedBlueprint("decl-chain");
  delete sourceOf(bp, 0, "arcade", "arcade").leaf;
  expect(lock(chainInput(bp))).toEqual([
    { kind: "leafType", where: "decl-chain/0/arcade/arcade" },
  ]);
});

test("the LockResult keeps no calculation: only the level, the kind and the two values (FR-010)", () => {
  const bp = inventedBlueprint("decl-chain");
  delete sourceOf(bp, 0, "luk-stats", "luck").weight;
  sourceOf(bp, 0, "talents", "talent", "talent", "points").ref = {
    read: "TreeLevel",
  };
  const out = lockBlueprint(chainInput(bp), "check");
  expect(new Set(out.errors.map((e) => e.kind))).toEqual(
    new Set(["notClosing", "childNoValue", "undeclaredPart"]),
  );
  for (const e of out.errors) {
    expect(
      Object.keys(e).every((k) =>
        ["kind", "where", "pool", "expected", "got"].includes(k),
      ),
    ).toBe(true);
    for (const v of [e.expected, e.got])
      expect(
        typeof v === "number" || typeof v === "string" || v === undefined,
      ).toBe(true);
  }
  const json = JSON.stringify(out);
  expect(json).not.toMatch(/"(t|e|l|r|o|args)":/);
  expect(json).not.toMatch(/\s[-+*/]\s|Math\.|\bstep/);
});
