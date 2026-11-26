// The source a write with no step of its own names in the code (spec 010, Fase 4 q, step 3; r1 of parts P and Q): the
// assignment whose left side is the written key, after the step before the write. The invented game: TreeRhsTwo writes
// DNSM.TreeRhsA = TreeDeclRow(1), then DNSM.TreeRhsB = TreeDeclOwn(0), with no step between them.
import { expect, test } from "vitest";
import { recorded } from "./lock-fixture.ts";
import { rhsSources } from "./write-rhs.ts";

test("a write's source is the assignment to its own key, never the first one after the step before it", () => {
  const { rec, ops } = recorded("TreeRhsTwo");
  const node = rec.nodes.find((n) => n.b === "TreeRhsTwo");
  const of = (path: string) => {
    const w = rec.writes.find((x) => x.path === path);
    if (!node || !w) throw new Error(`no write of ${path}`);
    return rhsSources(node, w, ops);
  };
  expect(of("DNSM.TreeRhsA")).toEqual([{ call: "TreeDeclRow" }]);
  expect(of("DNSM.TreeRhsB")).toEqual([{ call: "TreeDeclOwn" }]);
});

test("a variable's set on every way hides a set on a side before it; a set on a side after it leaves no source", () => {
  const { rec, ops } = recorded("TreeRhsVar");
  const node = rec.nodes.find((n) => n.b === "TreeRhsVar");
  const of = (path: string) => {
    const w = rec.writes.find((x) => x.path === path);
    if (!node || !w) throw new Error(`no write of ${path}`);
    return rhsSources(node, w, ops);
  };
  expect(of("DNSM.TreeRhsC")).toEqual([{ call: "TreeDeclOwn" }]);
  expect(of("DNSM.TreeRhsD")).toBeNull();
});
