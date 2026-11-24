// The lock at the pools (spec 010, FR-010, FR-013a, FR-002a, research R10): the invented Drop Rate (TreeDeclChain and
// its blueprint decl-chain) checked against its answer key. Each refusal says why, with the data model's text.
import { expect, test } from "vitest";
import { CHARACTERS, SAVED } from "../fixtures/fake-mosaic.ts";
import {
  chainInput,
  groupOf,
  inventedBlueprint,
  present,
  sourceOf,
} from "./lock-fixture.ts";
import { lockBlueprint, lockMessage, lockTally } from "./lock.ts";
import type { LockError, LockInput } from "./lock.ts";

const lock = (input: LockInput) => lockBlueprint(input);
const kinds = (errors: readonly LockError[]) => errors.map((e) => e.kind);

test("the invented blueprint passes, with its counts", () => {
  const out = lock(chainInput());
  expect(out.errors).toEqual([]);
  expect(out.ok).toBe(true);
  // root, 4 pools, the two-source term, the talent's, the best's, the arcade's and the sum's blocks; the luck's curve
  // repeats an argument
  expect(out.counts).toEqual({
    closed: 10,
    closedByRecorded: 1,
    leaves: 14,
    branches: 6,
  });
});

test("a source of the answer key missing from the blueprint is missingSource, and its pool does not close", () => {
  const bp = inventedBlueprint("decl-chain");
  const pool = bp.pools[0];
  if (!pool) throw new Error("no pool");
  pool.groups = pool.groups.filter((g) => g.system !== "arcade");
  const input = chainInput(bp);
  const out = lock(input);
  expect(out.ok).toBe(false);
  const missing = out.errors.find((e) => e.kind === "missingSource");
  expect(missing).toEqual({
    kind: "missingSource",
    where: "pool:0",
    pool: "additive",
    expected: "ArcadeBonus(0)",
  });
  expect(lockMessage(present(missing, "missingSource"))).toBe(
    "fonte que falta: ArcadeBonus(0) (pool 1 Additive)",
  );
  const value = input.key.pools[0]?.value ?? NaN;
  const notClosing = out.errors.find((e) => e.kind === "notClosing");
  expect(notClosing).toMatchObject({ where: "pool:0", expected: value });
  expect(notClosing?.got).toBeCloseTo(value - 0.08, 12);
  expect(lockMessage(present(notClosing, "notClosing"))).toMatch(
    /^nível não fecha: pool 1 Additive: as partes dão 12\.91\d*, o valor gravado é 12\.99\d*$/,
  );
});

test("pools 1 and 2 swapped are poolOrder, with the expected order", () => {
  const bp = inventedBlueprint("decl-chain");
  const [a, b, ...rest] = bp.pools;
  if (!a || !b) throw new Error("no pools");
  bp.pools = [b, a, ...rest];
  const out = lock(chainInput(bp));
  expect(out.ok).toBe(false);
  expect(out.errors).toEqual([
    {
      kind: "poolOrder",
      where: "root",
      expected: "Additive → Multi → Additive → Multi",
      got: "Multi → Additive → Additive → Multi",
    },
  ]);
  expect(lockMessage(present(out.errors[0], "poolOrder"))).toBe(
    "ordem dos pools errada: a ordem esperada é Additive → Multi → Additive → Multi; a receita tem Multi → Additive → Additive → Multi",
  );
});

test("a pool whose parts do not give its value is notClosing, with the level, the declared value and the game's", () => {
  const bp = inventedBlueprint("decl-chain");
  // the luck enters at weight 1 in a pool of 0.01: without its own weight it adds 0.1, not 10
  delete sourceOf(bp, 0, "luk-stats", "luck").weight;
  const input = chainInput(bp);
  const out = lock(input);
  const value = input.key.pools[0]?.value ?? NaN;
  expect(out.errors).toHaveLength(1);
  expect(out.errors[0]).toMatchObject({
    kind: "notClosing",
    where: "pool:0",
    pool: "additive",
    expected: value,
  });
  expect(out.errors[0]?.got).toBeCloseTo(value - 9.9, 12);
});

test("a source the answer key does not have is extraSource, at its node", () => {
  const bp = inventedBlueprint("decl-chain");
  groupOf(bp, 0, "cards").sources.push({
    key: "reads",
    name: "Invented Reads",
    ref: { call: "TreeReads", args: [] },
    leaf: "rawBonus",
  });
  const out = lock(chainInput(bp));
  expect(out.errors).toEqual([
    {
      kind: "extraSource",
      where: "decl-chain/0/cards/reads",
      got: "TreeReads()",
    },
  ]);
});

test("groups out of the answer key's order are groupOrder; sources out of it are sourceOrder", () => {
  const bp = inventedBlueprint("decl-chain");
  const pool = bp.pools[0];
  if (!pool) throw new Error("no pool");
  const [luck, talents, ...rest] = pool.groups;
  if (!luck || !talents) throw new Error("no groups");
  pool.groups = [talents, luck, ...rest];
  const out = lock(chainInput(bp));
  expect(out.errors).toEqual([
    {
      kind: "groupOrder",
      where: "pool:0",
      pool: "additive",
      expected: "luk-stats, talents, arcade, family-bonuses, cards, bundles",
      got: "talents, luk-stats, arcade, family-bonuses, cards, bundles",
    },
  ]);

  const bp2 = inventedBlueprint("decl-chain");
  const family = groupOf(bp2, 0, "family-bonuses");
  const cards = groupOf(bp2, 0, "cards");
  family.sources.unshift(...cards.sources.splice(0));
  const p0 = bp2.pools[0];
  if (!p0) throw new Error("no pool");
  p0.groups = p0.groups.filter((g) => g.sources.length > 0);
  expect(lock(chainInput(bp2)).errors).toEqual([
    { kind: "sourceOrder", where: "decl-chain/0/family-bonuses/best" },
  ]);
});

test("a constant ties by its value and its pool: another value is a missing one and an extra one", () => {
  const bp = inventedBlueprint("decl-chain");
  sourceOf(bp, 2, "guild", "half").constant = 0.7;
  const out = lock(chainInput(bp));
  expect(kinds(out.errors)).toEqual([
    "extraSource",
    "missingSource",
    "notClosing",
  ]);
  expect(out.errors[0]).toMatchObject({
    where: "decl-chain/2/guild/half",
    got: "0.7",
  });
  expect(out.errors[1]).toMatchObject({ where: "pool:2", expected: "0.5" });

  const moved = inventedBlueprint("decl-chain");
  const gem = groupOf(moved, 3, "gem-shop");
  groupOf(moved, 1, "stamps").sources.push(...gem.sources.splice(0));
  const p3 = moved.pools[3];
  if (!p3) throw new Error("no pool");
  p3.groups = p3.groups.filter((g) => g.system !== "gem-shop");
  expect(
    lock(chainInput(moved)).errors.filter((e) => e.kind !== "notClosing"),
  ).toEqual([
    { kind: "extraSource", where: "decl-chain/1/stamps/gem", got: "1.2" },
    {
      kind: "missingSource",
      where: "pool:3",
      pool: "multi",
      expected: "1.2",
    },
  ]);
});

test("a relative difference of 1e-6 closes and one of 2e-6 does not (SC-001)", () => {
  const near = chainInput();
  near.key.final *= 1 + 1e-6;
  expect(lock(near).errors).toEqual([]);
  const far = chainInput();
  const final = far.key.final;
  far.key.final *= 1 + 2e-6;
  expect(lock(far).errors).toEqual([
    {
      kind: "notClosing",
      where: "root",
      expected: far.key.final,
      got: expect.closeTo(final, 9) as number,
    },
  ]);
});

test("a blueprint with something pending is always refused with pending", () => {
  const bp = inventedBlueprint("decl-chain");
  bp.pending = [{ where: "pools/0/groups/0/sources/0", kind: "name" }];
  const out = lock(chainInput(bp));
  expect(out.ok).toBe(false);
  expect(out.errors).toEqual([
    { kind: "pending", where: "pools/0/groups/0/sources/0", got: "name" },
  ]);
});

test("a draft is checked where it is closed: what is pending is listed as pending, never failed by (T199)", () => {
  const bp = inventedBlueprint("decl-chain");
  // the arcade waits for its descent, the luck's group for its system; the best's leaf lost its kind, closed
  delete sourceOf(bp, 0, "arcade", "arcade").children;
  groupOf(bp, 0, "luk-stats").system = null as unknown as string;
  delete sourceOf(bp, 0, "family-bonuses", "best", "best-lv").leaf;
  bp.pending = [
    { where: "pools/0/groups/2/sources/0", kind: "descend" },
    { where: "pools/0/groups/0", kind: "system" },
  ];
  const out = lock(chainInput(bp));
  expect(out.ok).toBe(false);
  expect(out.errors).toEqual([
    { kind: "leafType", where: "decl-chain/0/family-bonuses/best/best-lv" },
    { kind: "pending", where: "pools/0/groups/2/sources/0", got: "descend" },
    { kind: "pending", where: "pools/0/groups/0", got: "system" },
  ]);
  const { closed, closedByRecorded, leaves } = out.counts;
  expect(lockTally(out)).toEqual({
    passed: closed + closedByRecorded + leaves,
    failed: 1,
    pending: 2,
  });
  expect(closed + leaves).toBeGreaterThan(10);
});

test("the tally counts places: each that closed once, out of the failed and the pending ones (T199 r1)", () => {
  // root, 4 pools, 6 levels, the luck's curve by its recorded value and 14 leaves: 25 places
  expect(lockTally(lock(chainInput()))).toEqual({
    passed: 25,
    failed: 0,
    pending: 0,
  });
  // the arcade closes, and it is pending: it counts as pending only
  const bp = inventedBlueprint("decl-chain");
  bp.pending = [{ where: "pools/0/groups/2/sources/0", kind: "name" }];
  expect(lockTally(lock(chainInput(bp)))).toEqual({
    passed: 24,
    failed: 0,
    pending: 1,
  });
  // two rounds that close the same place count it once; a place that closed with an error is failed
  expect(
    lockTally({
      ok: false,
      errors: [{ kind: "leafType", where: "b" }],
      counts: { closed: 2, closedByRecorded: 0, leaves: 2, branches: 0 },
      closedAt: ["a", "b", "a", "b"],
      pendingAt: [],
    }),
  ).toEqual({ passed: 1, failed: 1, pending: 0 });
});

test("a pending place covers only what its kind still lacks: a group's system never hides its sources' values (r1)", () => {
  const bp = inventedBlueprint("decl-chain");
  sourceOf(bp, 0, "luk-stats", "luck").ref = { call: "TreeNowhere", args: [] };
  bp.pending = [{ where: "pools/0/groups/0", kind: "system" }];
  expect(lock(chainInput(bp)).errors).toContainEqual({
    kind: "extraSource",
    where: "decl-chain/0/luk-stats/luck",
    got: "TreeNowhere()",
  });
});

test("a node with only its name pending is checked whole: a ref with no recorded value stays childNoValue (r1)", () => {
  const bp = inventedBlueprint("decl-chain");
  sourceOf(bp, 0, "arcade", "arcade", "base").ref = { read: "TreeNowhere" };
  bp.pending = [
    { where: "pools/0/groups/2/sources/0/children/0", kind: "name" },
  ];
  expect(lock(chainInput(bp)).errors).toContainEqual({
    kind: "childNoValue",
    where: "decl-chain/0/arcade/arcade/base",
  });
  // a descent that waits hides what is below its node, never its value at the parent
  bp.pending = [
    { where: "pools/0/groups/2/sources/0/children/0", kind: "descend" },
  ];
  expect(lock(chainInput(bp)).errors).toContainEqual({
    kind: "childNoValue",
    where: "decl-chain/0/arcade/arcade/base",
  });
});

test("another class's source absent from the recording is no error; present in the recording of another class it is classMismatch", () => {
  // TreeDeclTalent(1) (class 7) never runs: the class-3 character passes, as the first test shows
  const input = { ...chainInput(), characterClass: 5 };
  expect(lock(input).errors).toEqual([
    {
      kind: "classMismatch",
      where: "decl-chain/0/talents/talent",
      expected: "3",
      got: 5,
    },
  ]);
});

test("another class's source the game calls with its neutral value (0 in an Additive pool) passes", () => {
  // the class-3 talent at 0 points gives 0: the game calls it for every character (spec, Open Questions 23/11)
  const [wren, wrenna] = CHARACTERS;
  const attrs = {
    PlayerDATABASE: {
      $m: {
        [wren]: { $m: { ...SAVED[0].$m, SkillLevels: [0, 4] } },
        [wrenna]: SAVED[1],
      },
    },
  };
  expect(
    lock({ ...chainInput(undefined, attrs), characterClass: 5 }),
  ).toMatchObject({
    ok: true,
    errors: [],
  });
});

test("another class's source in a Multi pool passes at its neutral value 1, and is classMismatch at any other", () => {
  // on map 7 the game multiplies by TreeDeclTalent(1), class 7's; at 100/39 points its curve gives exactly 1
  const [wren, wrenna] = CHARACTERS;
  const at = (points: number) => ({
    CurrentMap: 7,
    PlayerDATABASE: {
      $m: {
        [wren]: { $m: { ...SAVED[0].$m, SkillLevels: [3, points] } },
        [wrenna]: SAVED[1],
      },
    },
  });
  const neutral = chainInput(undefined, at(100 / 39));
  // the ×1 term is in the answer key: the lock sees it and lets it pass
  expect(neutral.key.pools[3]?.terms).toContainEqual(
    expect.objectContaining({ ref: "TreeDeclTalent(1)", value: 1 }),
  );
  expect(lock(neutral)).toMatchObject({
    ok: true,
    errors: [],
  });
  expect(lock(chainInput(undefined, at(4))).errors).toEqual([
    {
      kind: "classMismatch",
      where: "decl-chain/3/talents/talent",
      expected: "7",
      got: 3,
    },
  ]);
});

test("a class source missing from the recording of its own class is extraSource", () => {
  // TreeDeclTalent(1) is class 7's, and the recording of TreeDeclChain on map 3 never runs it
  expect(lock({ ...chainInput(), characterClass: 7 }).errors).toEqual([
    {
      kind: "classMismatch",
      where: "decl-chain/0/talents/talent",
      expected: "3",
      got: 7,
    },
    {
      kind: "extraSource",
      where: "decl-chain/3/talents/talent",
      got: "TreeDeclTalent(1)",
    },
  ]);
});

test("a line with a link to another tree is checked by its ref's value and not descended (T200)", () => {
  // as a leaf, the luck reads the save below it; as a link, its tree is the other number's
  const leafy = inventedBlueprint("decl-chain");
  const luck = sourceOf(leafy, 0, "luk-stats", "luck");
  delete luck.children;
  luck.leaf = "level";
  expect(kinds(lock(chainInput(leafy)).errors)).toEqual(["leafHasChildren"]);
  const bp = inventedBlueprint("decl-chain");
  const linked = sourceOf(bp, 0, "luk-stats", "luck");
  delete linked.children;
  linked.tree = "invented-luck";
  expect(lock(chainInput(bp)).errors).toEqual([]);
  // a child as a link: its ref still has to give a recorded value
  const child = sourceOf(bp, 0, "arcade", "arcade", "base");
  delete child.leaf;
  child.tree = "invented-base";
  expect(lock(chainInput(bp)).errors).toEqual([]);
  child.ref = { read: "TreeNowhere" };
  expect(lock(chainInput(bp)).errors).toContainEqual({
    kind: "childNoValue",
    where: "decl-chain/0/arcade/arcade/base",
  });
});
