// The names of a loop's parts in the tree (pieces.cjs entryRows: arenaTurn, turnName, the part's own row, a read only
// its turn made, and the row that only repeats the part), over the loop written by hand of loop-fixture.ts. A name from
// the names table is taken from the table itself, so this file holds no game text.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { nameOf } from "./names.ts";
import { STATIC_NAMES } from "./names-table.ts";
import { GENERIC_NAME } from "./rows.ts";
import { brief, kidsOf } from "./tree-fixture.ts";
import { loopOf, loopRows } from "./loop-fixture.ts";

test("each turn's part is named by what its turn read (pieces.cjs turnName)", () => {
  const rec = loopOf(
    [
      [0, 1],
      [1, 2],
    ],
    [
      ["Boats[0][3]", 1, 1],
      ["Boats[1][3]", 2, 4],
    ],
  );
  expect(kidsOf(loopRows(rec)).map((k) => [k.name, k.flags])).toEqual([
    ["Boat 1", {}],
    ["Boat 2", {}],
  ]);
});

const named =
  [...STATIC_NAMES.keys()].find(
    (k) => !k.startsWith("DNSM.") && !k.includes("("),
  ) ?? "";
test("a turn with no read of its part's value is named by a read only its turn made", () => {
  // the reads were kept with other values: no read has the part's value, and the step's terms are values
  const rec = loopOf(
    [
      [0, 2],
      [2, 3],
    ],
    [
      [named, 9, 1],
      ["Stats.b", 9, 4],
    ],
  );
  const parts = kidsOf(loopRows(rec));
  expect(parts.map((k) => [k.name, k.value])).toEqual([
    [nameOf(named), 2],
    [GENERIC_NAME, 3],
  ]);
});

test("a read both turns made names neither; a call's row with a name no other part has names its turn", () => {
  const both = loopOf(
    [
      [0, 2],
      [2, 3],
    ],
    [
      [named, 9, 1],
      [named, 9, 4],
    ],
  );
  expect(kidsOf(loopRows(both)).map((k) => k.name)).toEqual([
    GENERIC_NAME,
    GENERIC_NAME,
  ]);
  // the first turn adds 1 (a part that says nothing by itself) and calls Sub, which has that value and reads a path
  const rec = loopOf(
    [
      [0, 1],
      [1, 3],
    ],
    [
      ["Stats.a", 9, 1],
      ["Stats.b", 9, 4],
    ],
    { c: [3] },
  );
  rec.nodes.push({
    id: 3,
    b: "Sub",
    a: [],
    c: [],
    p: 2,
    pxi: 1,
    v: 1,
    r: [[named, 7]],
  });
  expect(kidsOf(loopRows(rec)).map((k) => k.name)).toEqual([
    nameOf(named),
    GENERIC_NAME,
  ]);
});

test("a name every part's call has says nothing of one of them", () => {
  const rec = loopOf(
    [
      [0, 1],
      [1, 1],
    ],
    [
      ["Stats.a", 9, 1],
      ["Stats.b", 9, 4],
    ],
    { c: [3, 4] },
  );
  for (const [id, pxi] of [
    [3, 1],
    [4, 4],
  ] as const)
    rec.nodes.push({
      id,
      b: `Sub${String(id)}`,
      a: [],
      c: [],
      p: 2,
      pxi,
      v: 1,
      r: [[named, 7]],
    });
  expect(kidsOf(loopRows(rec)).map((k) => k.name)).toEqual([
    GENERIC_NAME,
    GENERIC_NAME,
  ]);
});

test("the row that only repeats its part (same name, same value, nothing under it) leaves the part's rows", () => {
  const rec = loopOf(
    [
      [0, 1],
      [1, 3],
    ],
    [
      ["Stats.a", 9, 1],
      ["Stats.b", 9, 4],
    ],
    { c: [3] },
  );
  rec.nodes.push({
    id: 3,
    b: "Sub",
    a: [],
    c: [],
    p: 2,
    pxi: 1,
    v: 1,
    r: [
      [named, 1],
      ["Stats.c", 5],
    ],
  });
  const [part] = kidsOf(loopRows(rec));
  expect([part?.name, brief(part)]).toEqual([nameOf(named), [["Stats.c", 5]]]);
});

test("a turn whose table row's text looks like code has no name, and the tree still passes the host's check", () => {
  const rec = loopOf(
    [
      [0, 1],
      [1, 2],
    ],
    [
      ["CustomLists.Invented[2][0]", "Grants if (owned)", 1],
      ["Boats[1][3]", 2, 4],
    ],
  );
  const level = loopRows(rec);
  expect(kidsOf(level).map((k) => k.name)).toEqual([GENERIC_NAME, "Boat 2"]);
  expect(level && checkTree(level, 100)).not.toBeNull();
});
