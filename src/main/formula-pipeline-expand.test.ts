// A lazy branch opened in the window (spec 008, T024, research R4): the pipeline asks the worker for that branch of the
// open tree and puts it in place, without a new recording; an answer for a tree no longer on screen is dropped. The
// tree host is a fake; every value and name is invented.
import { expect, test } from "vitest";
import type { FormulaTree, TreeNode } from "../shared/index.ts";
import { node, pairOf, pipeline } from "./formula-fixture.ts";
import { MAX_TREE_NODES } from "./formula-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

const lazy = node({
  id: "root/Part",
  name: "Part",
  role: "piece",
  value: 3,
  kids: "lazy",
});
const leaf = node({ id: "root/Part/Level", name: "Level", value: 3 });
const EXPAND = { treeId: "dropRate", nodeId: "root/Part" };

function ready() {
  const h = pipeline();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate, kids: [lazy] }));
  return h;
}
const rootOf = (t: FormulaTree | undefined) =>
  t?.state === "ready" ? t.root : null;
const kidsOf = (n: TreeNode | null | undefined) =>
  n && Array.isArray(n.kids) ? n.kids : [];

test("an expand asks the worker for that branch of the open tree, with no mosaic", () => {
  const h = ready();
  h.p.request(EXPAND);
  expect(h.host.request).toHaveBeenLastCalledWith(
    h.asked(),
    { type: "expand", ...EXPAND },
    null,
  );
});

test("the branch takes its place in the tree; the time and the request stay the same", () => {
  const h = ready();
  const before = h.last();
  h.p.request(EXPAND);
  h.tree({ ...lazy, kids: [leaf] });
  const after = h.last();
  expect(after).toEqual({
    ...before,
    root: { ...rootOf(before), kids: [{ ...lazy, kids: [leaf] }] },
    counts: { nodes: 3 },
  });
  expect(kidsOf(rootOf(before))[0]?.kids).toBe("lazy");
});

test.each<[string, (h: ReturnType<typeof ready>) => void]>([
  [
    "another tree",
    (h) => {
      h.p.request({ treeId: "hp", nodeId: "root/Part" });
    },
  ],
  [
    "a tree still calculating",
    (h) => {
      h.p.request({ id: "dropRate", character: null });
      h.p.request(EXPAND);
    },
  ],
])("an expand of %s asks nothing", (_name, act) => {
  const h = ready();
  const asked = h.host.request.mock.calls.length;
  act(h);
  expect(h.host.request.mock.calls.slice(asked)).not.toContainEqual(
    expect.arrayContaining([expect.objectContaining({ type: "expand" })]),
  );
});

test.each<[string, unknown]>([
  ["a branch the check refuses", { ...lazy, kids: [{ id: 1 }] }],
  ["a branch with another id", { ...lazy, id: "root/Other", kids: [leaf] }],
])("%s leaves the row unavailable and logs", (_name, raw) => {
  const h = ready();
  h.p.request(EXPAND);
  h.tree(raw);
  expect(kidsOf(rootOf(h.last()))[0]).toEqual({
    ...lazy,
    flags: { unavailable: true },
    kids: [],
  });
  expect(h.log).toHaveBeenLastCalledWith({
    event: "treeRejected",
    id: "dropRate",
  });
});

test("a branch the host could not answer leaves the row unavailable", () => {
  const h = ready();
  h.p.request(EXPAND);
  h.unavailable();
  expect(kidsOf(rootOf(h.last()))[0]).toMatchObject({
    flags: { unavailable: true },
    kids: [],
  });
  expect(h.log).not.toHaveBeenCalled();
});

test("an expand of the previous character is dropped after the none", () => {
  const h = ready();
  h.p.request(EXPAND);
  const expandId = h.asked();
  h.setPair(pairOf("Other", 2));
  expect(h.sent.at(-2)).toEqual({ state: "none" });
  // The new tree has a row with the same id: the old answer never lands in it.
  h.tree(node({ value: CALCULATED.dropRate, kids: [lazy] }));
  h.answer(expandId, { ...lazy, kids: [leaf] });
  expect(kidsOf(rootOf(h.last()))[0]?.kids).toBe("lazy");
});

test("an expand that answers after new game files shows nothing", () => {
  const h = ready();
  h.p.request(EXPAND);
  h.p.gameFiles("C:/invented");
  h.tree({ ...lazy, kids: [leaf] });
  expect(h.last()).toEqual({ state: "none" });
});

test("a branch that would take the tree over the ceiling leaves the row unavailable", () => {
  const h = ready();
  h.p.request(EXPAND);
  const many = Array.from({ length: MAX_TREE_NODES - 1 }, (_, i) =>
    node({ id: `root/Part/Level#${String(i)}`, name: "Level" }),
  );
  h.tree({ ...lazy, kids: many });
  expect(kidsOf(rootOf(h.last()))[0]).toMatchObject({
    flags: { unavailable: true },
    kids: [],
  });
});

test("a newer expand replaces the one waiting", () => {
  const h = ready();
  h.p.request(EXPAND);
  const first = h.asked();
  h.p.request(EXPAND);
  h.answer(first, { ...lazy, kids: [leaf] });
  expect(kidsOf(rootOf(h.last()))[0]?.kids).toBe("lazy");
  h.tree({ ...lazy, kids: [leaf] });
  expect(kidsOf(rootOf(h.last()))[0]?.kids).toEqual([leaf]);
});

// Review of the feature (R-I1): two lazy rows opened one after the other both get their branch, one ask at a time.
test("two different branches asked in a row both come, the second asked after the first answers", () => {
  const other = node({ ...lazy, id: "root/Other", name: "Other" });
  const otherLeaf = node({ id: "root/Other/Level", name: "Level", value: 3 });
  const h = pipeline();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate, kids: [lazy, other] }));
  h.p.request(EXPAND);
  const first = h.asked();
  h.p.request({ treeId: "dropRate", nodeId: "root/Other" });
  expect(h.asked()).toBe(first);
  h.answer(first, { ...lazy, kids: [leaf] });
  expect(h.host.request).toHaveBeenLastCalledWith(
    h.asked(),
    { type: "expand", treeId: "dropRate", nodeId: "root/Other" },
    null,
  );
  h.tree({ ...other, kids: [otherLeaf] });
  expect(kidsOf(rootOf(h.last())).map((k) => k.kids)).toEqual([
    [leaf],
    [otherLeaf],
  ]);
});

test("the game closing leaves the branch in flight and the one waiting unavailable", () => {
  const other = node({ ...lazy, id: "root/Other", name: "Other" });
  const h = pipeline();
  h.p.request({ id: "dropRate", character: null });
  h.tree(node({ value: CALCULATED.dropRate, kids: [lazy, other] }));
  h.p.request(EXPAND);
  h.p.request({ treeId: "dropRate", nodeId: "root/Other" });
  const asked = h.host.request.mock.calls.length;
  h.p.status({ game: "closed", reader: "error" });
  expect(h.host.request.mock.calls.length).toBe(asked);
  expect(kidsOf(rootOf(h.last())).map((k) => k.flags.unavailable)).toEqual([
    true,
    true,
  ]);
});

test("the game closing with a branch in flight leaves the row unavailable, the tree stale", () => {
  const h = ready();
  h.p.request(EXPAND);
  h.p.status({ game: "closed", reader: "error" });
  expect(h.last()).toMatchObject({ state: "ready", stale: true });
  expect(kidsOf(rootOf(h.last()))[0]).toMatchObject({
    flags: { unavailable: true },
    kids: [],
  });
});
