// The assembly (spec 010, FR-002, FR-002a, FR-002b, FR-012-FR-015, research R11, R12): the invented Drop Rate
// (TreeDeclChain and its blueprint decl-chain) assembled from its blueprint, its answer key and its recording, in the
// spec 009's CalcTreeNode, and passed by the main's checkTree unchanged.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { CALC_LEAF_KINDS } from "../tree-contract.ts";
import type { CalcTreeNode } from "../tree-contract.ts";
import { assembleTree } from "./assemble.ts";
import {
  chainInput,
  groupOf,
  inventedBlueprint,
  recorded,
} from "./lock-fixture.ts";
import type { LockInput } from "./lock.ts";
import { SYSTEMS } from "./systems.ts";

const assemble = (input: LockInput = chainInput()) =>
  assembleTree({ ...input, systems: SYSTEMS });
const kidsOf = (n: CalcTreeNode | undefined): CalcTreeNode[] =>
  n && Array.isArray(n.kids) ? n.kids : [];
const all = (n: CalcTreeNode): CalcTreeNode[] => [n, ...kidsOf(n).flatMap(all)];
const at = (root: CalcTreeNode, id: string): CalcTreeNode => {
  const n = all(root).find((x) => x.id === id);
  if (!n) throw new Error(`no node ${id}`);
  return n;
};
const names = (n: CalcTreeNode | undefined) => kidsOf(n).map((k) => k.name);
/** A row's part in its parent's count: a % row adds a hundredth. */
const part = (k: CalcTreeNode) => (k.fmt === "%" ? 0.01 : 1) * Number(k.value);

test("the root, then the blueprint's pools in order, named as the 009 names them", () => {
  const input = chainInput();
  const tree = assemble(input).whole();
  expect([tree.id, tree.role, tree.value, tree.pieceKey]).toEqual([
    "decl-chain",
    "root",
    input.key.final,
    JSON.stringify([0, "TreeDeclChain", 0, 0, 0]),
  ]);
  expect(
    kidsOf(tree).map((p) => [
      p.id,
      p.name,
      p.role,
      p.poolKind,
      p.combine,
      p.pieceKey,
    ]),
  ).toEqual([
    ["decl-chain/0", "Additive pool 1", "pool", "additive", "percent", null],
    ["decl-chain/1", "Multi pool 1", "pool", "multi", "product", null],
    ["decl-chain/2", "Additive pool 2", "pool", "additive", "sum", null],
    ["decl-chain/3", "Multi pool 2", "pool", "multi", "product", null],
  ]);
  // one pool of each kind: no number
  const expr = assembleTree({
    blueprint: inventedBlueprint("decl-expr"),
    ...recorded("TreeDeclExpr"),
    character: 0,
    characterClass: 3,
    systems: SYSTEMS,
  }).whole();
  expect(names(expr)).toEqual(["Additive pool", "Multi pool"]);
});

test("inside a pool, the groups by system with their emoji, in the answer key's order, a group of one source and one worth 0 too", () => {
  const tree = assemble().whole();
  const pool = at(tree, "decl-chain/0");
  expect(
    kidsOf(pool).map((g) => [
      g.id,
      g.name,
      g.role,
      g.pieceKey,
      g.poolKind,
      g.combine,
    ]),
  ).toEqual([
    ["decl-chain/0/luk-stats", "🍀 LUK / Stats", "system", null, null, "sum"],
    ["decl-chain/0/talents", "🎯 Talents", "system", null, null, "sum"],
    ["decl-chain/0/arcade", "🕹️ Arcade", "system", null, null, "sum"],
    [
      "decl-chain/0/family-bonuses",
      "👪 Family Bonuses",
      "system",
      null,
      null,
      "sum",
    ],
    ["decl-chain/0/cards", "🃏 Cards", "system", null, null, "sum"],
    ["decl-chain/0/bundles", "🎁 Bundles", "system", null, null, "sum"],
    ["decl-chain/0/shrines", "⛩️ Shrines", "system", null, null, "sum"],
  ]);
  // the shrine's stock is 0: its condition is off, the game never added it, and its group stays, worth 0
  const shrines = at(tree, "decl-chain/0/shrines");
  expect([shrines.value, names(shrines)]).toEqual([0, ["Invented Owned"]]);
  const stock = at(tree, "decl-chain/0/shrines/stock");
  expect([stock.value, stock.fmt, stock.leaf]).toEqual([0, "+", "quantity"]);
  expect(
    kidsOf(stock).map((k) => [k.id, k.name, k.value, k.leaf, k.condition]),
  ).toEqual([
    [
      "decl-chain/0/shrines/stock/owned",
      "Invented Owned Any",
      false,
      "condition",
      "owned",
    ],
  ]);
  expect(names(at(tree, "decl-chain/1"))).toEqual(["📜 Stamps"]);
  expect(names(at(tree, "decl-chain/3"))).toEqual([
    "🙏 Prayers",
    "💎 Gem Shop",
  ]);
});

test("a source of another class leaves, and its group only when every source of it is of another class (FR-002a)", () => {
  const seven = assemble({ ...chainInput(), characterClass: 7 }).whole();
  expect(names(at(seven, "decl-chain/0"))).not.toContain("🎯 Talents");
  expect(names(at(seven, "decl-chain/3"))).toEqual([
    "🙏 Prayers",
    "🎯 Talents",
    "💎 Gem Shop",
  ]);
  // the game never called the class 7 talent here: a source the recording did not use is 1 in a Multi pool
  const talent = at(seven, "decl-chain/3/talents/talent");
  expect([talent.value, talent.fmt]).toEqual([1, "x"]);
  // a group with a source of every class stays for class 7, with that source only
  const bp = inventedBlueprint("decl-chain");
  groupOf(bp, 0, "talents").sources.push({
    key: "flat",
    name: "Invented Flat",
    constant: 1,
    leaf: "fixedValue",
  });
  const mixed = assemble({ ...chainInput(bp), characterClass: 7 }).whole();
  expect(names(at(mixed, "decl-chain/0/talents"))).toEqual(["Invented Flat"]);
  expect(
    names(at(assemble(chainInput(bp)).whole(), "decl-chain/0/talents")),
  ).toEqual(["Invented Talent", "Invented Flat"]);
});

test("a two-source term is one row, its second source a child with its system's emoji in its name (FR-002b)", () => {
  const tree = assemble().whole();
  expect(names(at(tree, "decl-chain/0/talents"))).toEqual(["Invented Talent"]);
  const term = at(tree, "decl-chain/0/talents/talent");
  expect(kidsOf(term).map((k) => [k.id, k.name])).toEqual([
    ["decl-chain/0/talents/talent/talent", "Invented Talent"],
    ["decl-chain/0/talents/talent/twin", "🏆 Invented Twin"],
  ]);
  // the talent's own level is its curve: in the ⓘ by its role, its two constants named (FR-016)
  expect(at(tree, "decl-chain/0/talents/talent/talent").formula).toEqual({
    rule: [
      "Max bonus of the curve × Level ÷ (Level + Level at half of the max)",
      "40 × 3 ÷ (3 + 100) = 1.165",
    ],
  });
  // its ⓘ names its rows
  const f = term.formula;
  expect(Array.isArray(f) ? f[0] : f).toEqual([
    "Invented Talent",
    "×",
    "🏆 Invented Twin",
  ]);
});

test("ids from the blueprint's keys, piece keys from the resolved reference, a leaf of the 9 kinds, the format by the pool", () => {
  const tree = assemble().whole();
  const points = at(tree, "decl-chain/0/talents/talent/talent/points");
  expect([points.pieceKey, points.code, points.leaf, points.fmt]).toEqual([
    JSON.stringify([0, "PlayerDATABASE[0].SkillLevels[0]"]),
    "PlayerDATABASE[0].SkillLevels[0]",
    "investedPoints",
    null,
  ]);
  expect(at(tree, "decl-chain/0/arcade/arcade").pieceKey).toBe(
    JSON.stringify([0, "ArcadeBonus", 0]),
  );
  // a `*` keeps the recorded read it matched by its place, never the `*`
  const best = at(tree, "decl-chain/0/family-bonuses/best/best-lv");
  expect([
    "PlayerDATABASE[0].SkillLevels[1]",
    "PlayerDATABASE[1].SkillLevels[1]",
  ]).toContain(best.code);
  expect(best.pieceKey).toBe(JSON.stringify([0, best.code]));
  // every leaf has one of the 9 kinds, never unknown nor none
  const leaves = all(tree).filter((n) => kidsOf(n).length === 0);
  const nine = CALC_LEAF_KINDS.filter((k) => k !== "unknown");
  expect(leaves.filter((n) => !nine.some((k) => k === n.leaf))).toEqual([]);
  // the sources' format: the luck at weight 1 adds, the others of the % pool in %, a Multi's multiply
  expect(
    [
      "decl-chain/0/luk-stats/luck",
      "decl-chain/0/arcade/arcade",
      "decl-chain/1/stamps/sum",
      "decl-chain/2/guild/half",
      "decl-chain/3/gem-shop/gem",
    ].map((id) => at(tree, id).fmt),
  ).toEqual(["+", "%", "x", "+", "x"]);
});

test("every level of pools and groups closes with its parent, and the root with the final", () => {
  const input = chainInput();
  const tree = assemble(input).whole();
  const pools = kidsOf(tree);
  expect(pools.map((p) => p.value)).toEqual(
    input.key.pools.map((p) => p.value),
  );
  // a group adds its rows in their own unit; a pool, each group's part (a % group adds a hundredth)
  const close = (n: CalcTreeNode) => {
    const parts = kidsOf(n).map((k) =>
      n.role === "pool" ? part(k) : Number(k.value),
    );
    return n.combine === "product"
      ? parts.reduce((a, x) => a * x, 1)
      : parts.reduce((a, x) => a + x, 0);
  };
  for (const n of all(tree).filter(
    (x) => x.role === "pool" || x.role === "system",
  ))
    expect(close(n)).toBeCloseTo(Number(n.value), 9);
  const [a1, m1, a2, m2] = pools.map((p) => Number(p.value));
  expect((Number(a1) * Number(m1) + Number(a2)) * Number(m2)).toBeCloseTo(
    input.key.final,
    9,
  );
  // the root's ⓘ joins the pools
  expect(tree.formula).toEqual([
    [
      "(",
      "Additive pool 1",
      "×",
      "Multi pool 1",
      "+",
      "Additive pool 2",
      ")",
      "×",
      "Multi pool 2",
    ],
    [a1, m1, a2, m2, (Number(a1) * Number(m1) + Number(a2)) * Number(m2)],
  ]);
});

test("a level that does not close still shows the game's value on each row, with no row more (FR-015)", () => {
  const rows = (t: CalcTreeNode) => all(t).map((n) => [n.id, n.value]);
  const passing = assemble().whole();
  const bp = inventedBlueprint("decl-chain");
  // the luck enters at weight 1 in a pool of 0.01: without its weight, pool 1 does not close
  const luck = groupOf(bp, 0, "luk-stats").sources[0];
  if (luck) delete luck.weight;
  const failing = assemble(chainInput(bp)).whole();
  expect(rows(failing)).toEqual(rows(passing));
});

test("the pools go lazy in the first answer, and expand gives the level kept", () => {
  const built = assemble();
  const whole = built.whole();
  expect(
    (built.root.kids === "lazy" ? [] : built.root.kids).map((p) => p.kids),
  ).toEqual(["lazy", "lazy", "lazy", "lazy"]);
  expect(built.expand("decl-chain/0")).toEqual(at(whole, "decl-chain/0"));
  expect(built.expand("decl-chain/0/talents/talent")).toEqual(
    at(whole, "decl-chain/0/talents/talent"),
  );
  expect(built.expand("decl-chain/9")).toBeNull();
});

test("a draft assembles, its pending places marked", () => {
  const tree = assembleTree({
    blueprint: inventedBlueprint("decl-expr"),
    ...recorded("TreeDeclExpr"),
    character: 0,
    characterClass: 3,
    systems: SYSTEMS,
  }).whole();
  const pending = all(tree).filter((n) => n.flags.unknown === true);
  expect(pending.map((n) => n.id)).toEqual([
    "decl-expr/0/cards/reads",
    "decl-expr/1/stamps/loop",
  ]);
});

test("two groups of a pool with their system pending get ids of their own, each marked pending", () => {
  const bp = inventedBlueprint("decl-chain");
  for (const system of ["arcade", "family-bonuses"])
    (groupOf(bp, 0, system) as { system: string | null }).system = null;
  bp.pending = [
    { where: "pools/0/groups/2", kind: "system" },
    { where: "pools/0/groups/3", kind: "system" },
  ];
  const tree = assemble(chainInput(bp)).whole();
  const groups = kidsOf(at(tree, "decl-chain/0")).filter(
    (g) => g.flags.unknown === true,
  );
  expect(groups.map((g) => [g.id, g.name])).toEqual([
    ["decl-chain/0/pending-2", "Pending system"],
    ["decl-chain/0/pending-3", "Pending system"],
  ]);
  // the lock's values reach each row by the same id
  const before = assemble().whole();
  expect(at(tree, "decl-chain/0/pending-2/arcade").value).toBe(
    at(before, "decl-chain/0/arcade/arcade").value,
  );
});

test("the tree passes the main's checkTree unchanged (the 009's contract)", () => {
  const built = assemble();
  expect(checkTree(built.whole(), 10_000)).toEqual(built.whole());
  expect(checkTree(built.root, 100)).toEqual(built.root);
});
