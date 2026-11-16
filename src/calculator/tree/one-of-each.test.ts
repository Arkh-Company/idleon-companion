// pieces.cjs `oneOfEach` at BASELINE-4, narrow (spec Open Questions, 15/11; tree/one-of-each.ts): the leaves of a level
// with the same code and the same value are one leaf, like the Dungon() the game calls many times, and a group's count
// says the rows it keeps; a source a game-bug rule marks stays twice (FR-016, tree/game-bugs.test.ts). Over a context
// written by hand (tree/places.ts `PlaceContext`).
import { expect, test } from "vitest";
import type { GameBugRule } from "./game-bugs.ts";
import { ONE_OF_EACH } from "./one-of-each.ts";
import { makePlaces } from "./places.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { kidsOf, recNode } from "./tree-fixture.ts";

const leaf = (code: string | null, value: number, name = "Gate"): Row => ({
  node: row({ pieceKey: null, value, code, name, leaf: "condition" }),
  open: null,
});
const group = (role: "atZero" | "atOne", rows: Row[]): Row => ({
  node: row({
    pieceKey: null,
    value: role === "atZero" ? 0 : 1,
    code: null,
    name: `${role === "atZero" ? "At 0" : "At ×1"} (${String(rows.length)})`,
    role,
    flags: { closed: true },
  }),
  open: null,
  group: rows,
});

function placed(rows: Row[], bugs: readonly GameBugRule[] = []) {
  const places = makePlaces({
    nodes: [recNode(0, "Twice")],
    bugs,
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: () => [leaf("Inner", 1, "In"), leaf("Other", 2, "Other")],
    opened: () => null,
  });
  return places.place({ id: "root", code: "Twice()" }, rows, 1, [0]);
}
const brief = (rows: ReturnType<typeof placed>) =>
  rows.map((r) => [r.id, r.code, r.value]);

test("the leaves with the same code and value are one; another value, another code or no code stays", () => {
  expect(
    brief(
      placed([
        leaf("Dungon()", -1),
        leaf("Dungon()", -1),
        leaf("Dungon()", 2),
        leaf("Other()", -1),
        leaf(null, -1),
        leaf(null, -1),
        leaf("Dungon()", -1),
      ]),
    ),
  ).toEqual([
    ["root/Gate", "Dungon()", -1],
    ["root/Gate#2", "Dungon()", 2],
    ["root/Gate#3", "Other()", -1],
    ["root/Gate#4", null, -1],
    ["root/Gate#5", null, -1],
  ]);
});

test("rows with rows under them stay, with the same code and value", () => {
  const lazy = (): Row => ({
    node: row({
      pieceKey: null,
      value: 3,
      code: "Call()",
      name: "Call",
      kids: "lazy",
    }),
    open: 0,
  });
  const branch = (): Row => ({
    ...leaf("Branch()", 3),
    group: [leaf("A", 1), leaf("B", 2)],
  });
  expect(brief(placed([lazy(), lazy(), branch(), branch()]))).toEqual([
    ["root/Call", "Call()", 3],
    ["root/Call#2", "Call()", 3],
    ["root/Gate", "Branch()", 3],
    ["root/Gate#2", "Branch()", 3],
  ]);
});

test("a source a game-bug rule marks stays twice (FR-016); another source of the same call is one", () => {
  const rule: GameBugRule = {
    id: "inventedTwice",
    in: /^Twice\(/,
    test: /^Source\(\)$/,
    proof: "N.js Twice",
  };
  const rows = placed(
    [
      leaf("Source()", 3),
      leaf("Source()", 3),
      leaf("Dungon()", -1),
      leaf("Dungon()", -1),
    ],
    [rule],
  );
  expect(rows.map((r) => [r.code, r.flags.gameBug])).toEqual([
    ["Source()", "inventedTwice"],
    ["Source()", "inventedTwice"],
    ["Dungon()", undefined],
  ]);
});

test("a group's leaves are one of each, and its name counts the rows it keeps", () => {
  const rows = placed([
    leaf("Kept()", 4),
    group("atZero", [
      leaf("Nothing()", 0),
      leaf("Nothing()", 0),
      leaf("Gone()", 0),
    ]),
    group("atOne", [leaf("One()", 1), leaf("One()", 1)]),
  ]);
  expect(rows.map((r) => [r.id, kidsOf(r).map((k) => k.code)])).toEqual([
    ["root/Gate", []],
    ["root/At 0 (2)", ["Nothing()", "Gone()"]],
    ["root/At ×1 (1)", ["One()"]],
  ]);
  // a group with nothing repeated keeps its name
  expect(
    placed([group("atZero", [leaf("A()", 0), leaf("B()", 0)])])[0]?.name,
  ).toBe("At 0 (2)");
});

test("the level under a row is one of each when it is placed", () => {
  const places = makePlaces({
    nodes: [recNode(0, "Twice")],
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: () => [
      leaf("Dungon()", -1),
      leaf("Dungon()", -1),
      leaf("Other()", 2),
    ],
    opened: () => null,
  });
  const [call] = places.place(
    { id: "root", code: "Root()" },
    [
      {
        node: row({
          pieceKey: null,
          value: 1,
          code: "Twice()",
          name: "Call",
          kids: "lazy",
        }),
        open: 0,
      },
    ],
    1,
    [],
  );
  expect(kidsOf(places.expand(call?.id ?? "")).map((k) => k.code)).toEqual([
    "Dungon()",
    "Other()",
  ]);
});

test("the rule has its test", () => {
  expect(ONE_OF_EACH.test.test("At ×1 (3)")).toBe(true);
  expect(ONE_OF_EACH.test.test("At 0 (12)")).toBe(true);
  expect(ONE_OF_EACH.test.test("At 1 (3)")).toBe(false);
});
