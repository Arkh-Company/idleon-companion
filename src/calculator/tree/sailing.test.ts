// pieces.cjs `opus1Sailing` at BASELINE-4 (tree/leaf-passes.ts, its leaves; tree/sailing.ts, a row by its level): the
// Fractal Island's yes/no with its ⓘ, the highest class level, the class line that is context, and the artifact entry that
// only picks the bonus. Rows written by hand, with invented names.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { FRACTAL_HOURS } from "./leaf-passes.ts";
import { isNameText } from "../names/name-text.ts";
import { makePlaces } from "./places.ts";
import { finish, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { ARTIFACT_PICK } from "./sailing.ts";
import { kidsOf, read, recNode } from "./tree-fixture.ts";

const call = (code: string, value: number, lazy = false): Row => ({
  node: row({ pieceKey: code, value, code, kids: lazy ? "lazy" : [] }),
  open: lazy ? 1 : null,
});
const level = (rows: Row[]) => finish(9, rows);

test.each([
  [0, 1, "reached 24 hours → 1"],
  [3, 0, "below 2500 hours → 0"],
  [7, 1, "reached 60000 hours → 1"],
])(
  "[OPUS1-P3b] the Fractal Island's bonus %s is a yes/no of a limit, with its ⓘ and why",
  (i, v, numbers) => {
    const hours = FRACTAL_HOURS[i];
    const [r] = level([
      call(`RandomEvent("FractalIslandBonus", ${String(i)}, 0)`, v),
    ]);
    expect(r?.node).toMatchObject({
      leaf: "condition",
      condition: "limit",
      formula: {
        rule: [
          `If the hours on Fractal Island reach ${String(hours)}: 1, else 0`,
          numbers,
        ],
      },
      why: `the game sets this bonus to 1 once the hours on Fractal Island reach ${String(hours)}, else to 0 (N.js RandomEvent)`,
    });
    const placed = {
      id: "x",
      ...(r?.node ?? row({ pieceKey: null, value: 0, code: null })),
    };
    expect(checkTree(placed, 1)).not.toBeNull();
    expect(isNameText(String(r?.node.why))).toBe(true);
  },
);

test("[OPUS1-P3b] a Fractal Island bonus past the 8 limits, or with rows, has no ⓘ", () => {
  // OPUS5 types it only while it has no type: a call's leaf that passed its cache's "?" on
  const unknown: Row = {
    ...call('RandomEvent("FractalIslandBonus", 8, 0)', 1),
  };
  unknown.node.leaf = "unknown";
  const [past] = level([unknown]);
  expect([past?.node.leaf, past?.node.formula, past?.node.why]).toEqual([
    "condition",
    null,
    null,
  ]);
  const [typed] = level([call('RandomEvent("FractalIslandBonus", 8, 0)', 1)]);
  expect(typed?.node.leaf).not.toBe("condition");
  const [rows] = level([
    call('RandomEvent("FractalIslandBonus", 1, 0)', 1, true),
  ]);
  expect([rows?.node.formula, rows?.node.kids]).toEqual([null, "lazy"]);
});

test("[OPUS1-P3b] the highest class level among the characters is a level, whatever its type", () => {
  const code = "DNSM.CalcTalentMAP[620]";
  const typed: Row = {
    node: { ...read(code, 500).node, leaf: "quantity", why: "a why" },
    open: null,
  };
  const [r] = level([typed]);
  expect([r?.node.name, r?.node.leaf, r?.node.why, r?.node.flags]).toEqual([
    "Highest class level among your characters",
    "level",
    null,
    {},
  ]);
});

test("[OPUS1-P3b] a class line is context: it goes from every level, a leaf or not", () => {
  const rows = level([
    call("ReturnClasses(3)", 7),
    call("ReturnClasses(5)", 7, true),
    read("Q", 3),
  ]);
  expect(rows.map((r) => r.node.code)).toEqual(["Q"]);
});

/** The rows of the artifact's call, placed: its own, and the ones under it. */
function artifact(
  rows: Row[],
  xf: [string, string] | null = null,
  generic = false,
) {
  const own: Row = {
    node: row({
      pieceKey: null,
      value: 4,
      code: 'Sailing("ArtifactBonus", 32, 0)',
      name: generic ? "Game value" : "Some artifact",
      kids: "lazy",
      ...(generic ? { flags: { unnamed: true } } : {}),
    }),
    open: 1,
    ...(xf ? { xf } : {}),
  };
  const places = makePlaces({
    nodes: [0, 1].map((i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => (id === 1 ? rows : null),
    opened: () => null,
  });
  const [n] = places.place({ id: "root", code: "Root()" }, [own], 1, [0]);
  return { n, kids: n?.kids === "lazy" ? kidsOf(places.expand(n.id)) : [] };
}
/** The branch `max(0, t)` of the artifact's entry: an unlinked earlier value and the minimum 0. */
const pick = (more: Row[] = []): Row => ({
  node: row({ pieceKey: null, value: 32, code: null }),
  open: null,
  group: [
    {
      node: row({ pieceKey: null, value: 32, code: null, leaf: "unknown" }),
      open: null,
      earlier: true,
    },
    {
      node: row({
        pieceKey: null,
        value: 0,
        code: null,
        name: "Minimum 0",
        leaf: "fixedValue",
      }),
      open: null,
    },
    ...more,
  ],
});

test("[OPUS1-P3] the artifact entry's max(0, t) only picks the bonus: it is no row", () => {
  const { kids } = artifact([pick(), call("Bonus()", 4), call("Other()", 1)]);
  expect(kids.map((k) => k.code)).toEqual(["Bonus()", "Other()"]);
});

test("[OPUS1-P3] a branch with a source of its own, a name or a code, or an earlier value named, stays", () => {
  const named: Row = {
    ...pick(),
    node: { ...pick().node, name: "Entry", flags: {} },
  };
  const coded: Row = { ...pick(), node: { ...pick().node, code: "Pick()" } };
  const more = pick([call("Bonus()", 4)]);
  const group = pick().group ?? [];
  const [e] = group;
  const renamed: Row = {
    ...pick(),
    group: e
      ? [
          { ...e, node: { ...e.node, name: "Crop types found", flags: {} } },
          ...group.slice(1),
        ]
      : [],
  };
  const noEarlier: Row = { ...pick(), group: group.slice(1) };
  for (const b of [named, coded, more, renamed, noEarlier])
    expect(artifact([b, call("Other()", 1)]).kids).toHaveLength(2);
});

test("[OPUS1-P3] an artifact read while the list is rebuilt, with only that pick under it, is that 0", () => {
  const { n, kids } = artifact(
    [pick()],
    ["1 + ((0 + A) ÷ 100)", "1 + ((0 + 4) ÷ 100) = 4"],
  );
  expect(kids.map((k) => [k.name, k.code, k.value, k.leaf, k.why])).toEqual([
    [
      "Some artifact (not filled yet while the artifact list is rebuilt)",
      'Sailing("ArtifactBonus", 32, 0)',
      0,
      "rawBonus",
      ARTIFACT_PICK.why,
    ],
  ]);
  expect(n && checkTree(n, 10)).not.toBeNull();
  expect(isNameText(ARTIFACT_PICK.why)).toBe(true);
});

test("[OPUS1-P3] with no such ⓘ, an artifact with only that pick under it is a raw bonus with no rows", () => {
  const { n } = artifact([pick()], ["A × 2", "2 × 2 = 4"]);
  expect([n?.leaf, n?.kids]).toEqual(["rawBonus", []]);
  // with no ⓘ at all, the same
  expect(artifact([pick()]).n?.leaf).toBe("rawBonus");
});

test("[OPUS1-P3] an artifact with no rows of the pick, or another call, keeps its rows", () => {
  expect(artifact([call("Bonus()", 4), call("Other()", 1)]).kids).toHaveLength(
    2,
  );
  const other: Row = {
    node: row({
      pieceKey: null,
      value: 4,
      code: 'Sailing("BoatSpeed", 1, 0)',
      kids: "lazy",
    }),
    open: 1,
  };
  const places = makePlaces({
    nodes: [0, 1].map((i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => (id === 1 ? [pick(), call("Other()", 1)] : null),
    opened: () => null,
  });
  const [n] = places.place({ id: "root", code: "Root()" }, [other], 1, [0]);
  expect(kidsOf(places.expand(n?.id ?? ""))).toHaveLength(2);
});

test("[OPUS1-P3] the 0 of an artifact with no name of its own is the artifact's, and an artifact with no rows keeps none", () => {
  const rebuilt: [string, string] = [
    "1 + ((0 + A) ÷ 100)",
    "1 + ((0 + 4) ÷ 100) = 4",
  ];
  expect(artifact([pick()], rebuilt, true).kids.map((k) => k.name)).toEqual([
    "Artifact (not filled yet while the artifact list is rebuilt)",
  ]);
  const { n, kids } = artifact([]);
  expect([n?.leaf, n?.kids, kids]).toEqual([null, "lazy", []]);
});

/** A lazy call whose level is one bare read of its value, placed: the structurePass makes it that leaf. */
function mergedCall(code: string, value: number) {
  const top: Row = {
    node: row({ pieceKey: null, value, code, kids: "lazy" }),
    open: 1,
  };
  const places = makePlaces({
    nodes: [0, 1].map((i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) =>
      id === 1
        ? [
            {
              node: row({
                pieceKey: null,
                value,
                code: "DNSM.Cache[2]",
                leaf: "unknown",
                why: "a cache that comes ready from the game",
              }),
              open: null,
            },
          ]
        : null,
    opened: () => null,
  });
  return places.place(
    { id: "root", code: "Root()" },
    [top, read("Q", 1)],
    1,
    [0],
  )[0];
}

test("[structurePass, then opus1Sailing] a Fractal Island call merged with its cache read is the yes/no, with its ⓘ and why", () => {
  const n = mergedCall('RandomEvent("FractalIslandBonus", 2, 0)', 1);
  expect(n).toMatchObject({
    code: 'RandomEvent("FractalIslandBonus", 2, 0)',
    leaf: "condition",
    condition: "limit",
    formula: {
      rule: [
        "If the hours on Fractal Island reach 750: 1, else 0",
        "reached 750 hours → 1",
      ],
    },
    why: "the game sets this bonus to 1 once the hours on Fractal Island reach 750, else to 0 (N.js RandomEvent)",
    kids: [],
  });
});

test("[structurePass, then opus2Leaf] a Death Note count merged with its cache read is named", () => {
  const n = mergedCall('WorkbenchStuff("OverkillQTY", 2, 0)', 40);
  expect([n?.name, n?.leaf, n?.kids]).toEqual([
    "Deathnote points of World 3",
    "quantity",
    [],
  ]);
});
