// The blueprint's check on load (spec 010, FR-002–FR-007, FR-018, contracts/blueprint.md): each rule with a case that
// passes and one that is refused with its reason, and the three stages. The blueprints here are invented.
import { expect, test } from "vitest";
import { parseBlueprint } from "./blueprint.ts";
import { SYSTEMS as SYSTEMS_TABLE } from "./systems.ts";

const SYSTEMS = new Set(["talents", "cards", "achievements", "bundles"]);
const ctx = { fileId: "invented-number", systemIds: SYSTEMS };

const leaf = (key: string, extra: object = {}) => ({
  key,
  name: "Invented Leaf",
  nameProof: { table: "InventedNames", row: 3 },
  ref: { read: "PlayerDATABASE[{character}].SkillLevels[3]" },
  leaf: "investedPoints",
  ...extra,
});

/** A complete invented blueprint: two pools, a source with children, a two-source term and a constant with a condition. */
function complete(): Record<string, unknown> & {
  pools: {
    kind: string;
    weight?: number;
    groups: { system: string | null; sources: Record<string, unknown>[] }[];
  }[];
} {
  return {
    id: "invented-number",
    root: {
      name: "Invented Number",
      nameProof: { names: "invented-number" },
      ref: { call: "InventedRoot", args: ["Mode", 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        weight: 0.01,
        groups: [
          {
            system: "talents",
            sources: [
              {
                key: "invented-talent",
                name: "Invented Talent",
                nameProof: { table: "InventedNames", row: 1 },
                ref: { call: "GetTalentNumber", args: [1, 3] },
                classes: [7, 8],
                children: [
                  leaf("talent-points"),
                  leaf("best-record", {
                    ref: { read: "OptionsListAccount[18]" },
                    leaf: "record",
                    termPart: { system: "achievements" },
                  }),
                ],
              },
              leaf("other-talent", { weight: 0.01 }),
            ],
          },
          {
            system: "bundles",
            sources: [
              {
                key: "bundle-bonus",
                name: "Invented Bundle",
                constant: 2,
                leaf: "fixedValue",
                condition: leaf("bundle-owned", {
                  ref: { read: "OptionsListAccount[23]" },
                  leaf: "condition",
                  conditionKind: "owned",
                }),
              },
            ],
          },
        ],
      },
      {
        kind: "multi",
        groups: [
          {
            system: "cards",
            sources: [
              leaf("invented-card", {
                ref: { call: "CardBonusREAL", args: ["0"] },
                leaf: "rawBonus",
              }),
            ],
          },
        ],
      },
    ],
  };
}

type Bp = ReturnType<typeof complete>;
const source = (bp: Bp, pool = 0, group = 0, i = 0) =>
  bp.pools[pool]?.groups[group]?.sources[i] ?? {};

function refused(change: (bp: Bp) => void, fileId = ctx.fileId) {
  const bp = complete();
  change(bp);
  const out = parseBlueprint(bp, { ...ctx, fileId });
  return out.ok ? null : out.reason;
}

test("the invented blueprint loads complete; the nameProof is optional (spec, Open Questions, 21/11)", () => {
  const out = parseBlueprint(complete(), ctx);
  expect(out).toMatchObject({ ok: true, stage: "complete" });
  expect(
    refused((bp) => {
      delete source(bp).nameProof;
    }),
  ).toBe(null);
});

test.each<[string, (bp: Bp) => void, RegExp]>([
  ["an id other than the file's name", (bp) => (bp.id = "other"), /id/],
  ["no pools", (bp) => (bp.pools = []), /pools/],
  [
    "two pools of the same kind in a row",
    (bp) => {
      const p = bp.pools[1];
      if (p) p.kind = "additive";
    },
    /mesmo kind/,
  ],
  [
    "a system outside systems.json",
    (bp) => {
      const g = bp.pools[0]?.groups[0];
      if (g) g.system = "invented-system";
    },
    /system/,
  ],
  [
    "the Other group",
    (bp) => {
      const g = bp.pools[0]?.groups[0];
      if (g) g.system = "other";
    },
    /system/,
  ],
  [
    "a key out of the slug",
    (bp) => (source(bp).key = "Invented Talent"),
    /key/,
  ],
  [
    "a key repeated among siblings",
    (bp) => (source(bp, 0, 0, 1).key = "invented-talent"),
    /key/,
  ],
  ["an empty name", (bp) => (source(bp).name = " "), /name/],
  ["no name yet", (bp) => (source(bp).name = "no name yet"), /name/],
  ["Game value", (bp) => (source(bp).name = "Game value"), /name/],
  ["ref and constant together", (bp) => (source(bp).constant = 2), /ref/],
  [
    "neither ref nor constant",
    (bp) => {
      delete source(bp).ref;
    },
    /ref/,
  ],
  ["a leaf with children", (bp) => (source(bp).leaf = "level"), /leaf/],
  [
    "neither leaf nor children",
    (bp) => {
      delete source(bp, 0, 0, 1).leaf;
    },
    /leaf/,
  ],
  [
    "spec 008's unknown leaf",
    (bp) => (source(bp, 0, 0, 1).leaf = "unknown"),
    /leaf/,
  ],
  [
    "a conditionKind without the condition leaf",
    (bp) => (source(bp, 0, 0, 1).conditionKind = "owned"),
    /conditionKind/,
  ],
  [
    "classes outside a pool's source",
    (bp) => {
      const kids = source(bp).children as Record<string, unknown>[];
      if (kids[0]) kids[0].classes = [7];
    },
    /classes/,
  ],
  [
    "a weight outside a pool's source",
    (bp) => {
      const kids = source(bp).children as Record<string, unknown>[];
      if (kids[0]) kids[0].weight = 1;
    },
    /weight/,
  ],
  [
    "a termPart outside a child",
    (bp) => (source(bp).termPart = { system: "cards" }),
    /termPart/,
  ],
  [
    "a read with an operator",
    (bp) => (source(bp, 0, 0, 1).ref = { read: "OptionsListAccount[1]*2" }),
    /read/,
  ],
  [
    "a read with a character's index written out",
    (bp) =>
      (source(bp, 0, 0, 1).ref = { read: "PlayerDATABASE[1].SkillLevels[3]" }),
    /personagem/,
  ],
  [
    "an object among a call's arguments",
    (bp) => (source(bp).ref = { call: "GetTalentNumber", args: [{ a: 1 }] }),
    /args/,
  ],
  [
    "a key outside the listed ones",
    (bp) => (source(bp).formula = "a*b"),
    /formula/,
  ],
  [
    "a group with mixed weights",
    (bp) => (source(bp, 0, 0, 1).weight = 1),
    /peso/,
  ],
])("refused: %s", (_, change, reason) => {
  expect(refused(change)).toMatch(reason);
});

test("each invented blueprint of the tests (fixtures/blueprints) loads complete over the real systems table", () => {
  const files = import.meta.glob<unknown>(
    "../fixtures/blueprints/*.blueprint.json",
    { eager: true, import: "default" },
  );
  const ids = new Set(SYSTEMS_TABLE.map((s) => s.id));
  const loaded = Object.entries(files).map(([path, raw]) => {
    const fileId = /([^/]+)\.blueprint\.json$/.exec(path)?.[1] ?? "";
    const out = parseBlueprint(raw, { fileId, systemIds: ids });
    return [fileId, out.ok ? out.stage : out.reason];
  });
  expect(Object.fromEntries(loaded)).toEqual({
    "decl-chain": "complete",
    "decl-expr": "complete",
  });
});

test("the root's shapes (spec, Open Questions 21/11): a sum of calls, a part of a call, a marker on the recording's copy", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const call = (n: number) => ({ call: "Invented", args: ["Pts", n, 0] });
  expect(
    sketch({ name: "Invented", combine: "sum", calls: [call(0), call(1)] }),
  ).toMatchObject({ ok: true, stage: "sketch" });
  expect(
    sketch({
      name: "Invented",
      ref: call(0),
      part: [
        { call: "Other", args: [38, 0] },
        { read: "OptionsListAccount[62]" },
      ],
    }),
  ).toMatchObject({ ok: true });
  expect(
    sketch({ name: "Invented", ref: call(0), scratch: { TreeMark: "gimme" } }),
  ).toMatchObject({ ok: true });
  for (const [root, reason] of [
    [{ name: "Invented", combine: "sum", calls: [] }, /calls/],
    [{ name: "Invented", combine: "sum", calls: [{ read: "A[1]" }] }, /calls/],
    [{ name: "Invented", combine: "product", calls: [call(0)] }, /combine/],
    [
      { name: "Invented", combine: "sum", calls: [call(0)], ref: call(1) },
      /ref/,
    ],
    [{ name: "Invented", ref: call(0), part: "the third step" }, /part/],
    [{ name: "Invented", ref: call(0), part: [] }, /part/],
    [{ name: "Invented", ref: call(0), part: [{ formula: "a*b" }] }, /part/],
    [
      { name: "Invented", ref: call(0), scratch: { TreeMark: { a: 1 } } },
      /scratch/,
    ],
    [{ name: "Invented" }, /ref/],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});

test("a routine's root (T152): a block or a helper's event run on the recorder's copy, and the state path it sums", () => {
  const sketch = (root: object) =>
    parseBlueprint({ id: "invented-number", root }, ctx);
  const event = {
    slot: 0,
    behavior: "ActorEvents_29",
    event: "_customEvent_Board",
  };
  for (const routine of [event, { call: "Invented", args: ["Board", 0] }])
    expect(
      sketch({ name: "Invented", routine, sum: "InventedBoard[*]" }),
      JSON.stringify(routine),
    ).toMatchObject({ ok: true, stage: "sketch" });
  for (const [root, reason] of [
    [{ name: "Invented", routine: event }, /sum/],
    [{ name: "Invented", routine: event, sum: "A[1] + B[2]" }, /sum/],
    [
      {
        name: "Invented",
        routine: { slot: -1, behavior: "B", event: "e" },
        sum: "A[*]",
      },
      /routine/,
    ],
    [{ name: "Invented", routine: { read: "A[1]" }, sum: "A[*]" }, /routine/],
    [
      {
        name: "Invented",
        routine: event,
        sum: "A[*]",
        ref: { call: "X", args: [] },
      },
      /routine/,
    ],
  ] as const) {
    const out = sketch(root);
    expect(out.ok ? "loaded" : out.reason, JSON.stringify(root)).toMatch(
      reason,
    );
  }
});

test("only id and root is a sketch", () => {
  const { id, root } = complete();
  expect(parseBlueprint({ id, root }, ctx)).toMatchObject({
    ok: true,
    stage: "sketch",
  });
  expect(parseBlueprint({ id, root: { name: "X" } }, ctx).ok).toBe(false);
});

test("a draft: pending says where a name, a system, a leaf or a descent is missing; nowhere else", () => {
  const draft = complete();
  source(draft).name = null;
  const g = draft.pools[1]?.groups[0];
  if (g) g.system = null;
  delete source(draft, 0, 0, 1).leaf;
  draft.pending = [
    { where: "pools/0/groups/0/sources/0", kind: "name" },
    { where: "pools/1/groups/0", kind: "system" },
    { where: "pools/0/groups/0/sources/1", kind: "descend" },
  ];
  expect(parseBlueprint(draft, ctx)).toMatchObject({
    ok: true,
    stage: "draft",
  });
  // a null name the list does not name
  source(draft, 1).name = null;
  expect(parseBlueprint(draft, ctx).ok).toBe(false);
  // a pending place that is not in the blueprint
  const other = complete();
  other.pending = [{ where: "pools/9", kind: "name" }];
  expect(parseBlueprint(other, ctx).ok).toBe(false);
  const bad = complete();
  bad.pending = [{ where: "pools/0/groups/0/sources/0", kind: "formula" }];
  expect(parseBlueprint(bad, ctx).ok).toBe(false);
});
