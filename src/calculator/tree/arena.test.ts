// pieces.cjs `opus2Arena` at BASELINE-4 (tree/arena.ts) and `opus2Leaf`'s names (tree/leaf-passes.ts): the arena's count of
// waves, the yes/no beside it, a collectible's per-unit number, the measured amount its curve reads and the three counts
// the N.js proves. Rows written by hand, with invented names.
import { afterEach, expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { ARENA, JAR, MEASURE } from "./arena.ts";
import { isNameText } from "./name-text.ts";
import { makePlaces } from "./places.ts";
import { finish, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { useGameTables } from "./table-names.ts";
import { kidsOf, read, recNode } from "./tree-fixture.ts";

afterEach(() => {
  useGameTables(new Map());
});

const leaf = (
  name: string,
  value: number,
  code: string | null = null,
  more: Partial<Row["node"]> = {},
): Row => ({
  node: row({
    pieceKey: null,
    value,
    code,
    name,
    leaf: "unknown",
    ...more,
  }),
  open: null,
});
const lazy = (
  name: string,
  open: number,
  value: number,
  code: string,
): Row => ({
  node: row({ pieceKey: null, value, code, name, kids: "lazy" }),
  open,
});

/** The rows `top` placed, each level by its call's number. */
function placed(levels: Record<number, Row[]>, top: Row[]) {
  const places = makePlaces({
    nodes: Array.from({ length: 10 }, (_, i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => levels[id] ?? null,
    opened: () => null,
  });
  const rows = places.place({ id: "root", code: "Root()" }, top, 1, [0]);
  return {
    rows,
    open: (id: string) => kidsOf(places.expand(id)),
    expand: (id: string) => places.expand(id),
  };
}
const wave = (round: number, bonus: number, v = 1) =>
  leaf(
    `Best Pet Arena round ≥ ${String(round)} (arena bonus ${String(bonus)})`,
    v,
  );
const arena = (v: number) =>
  lazy("Working value of the game (CalcTalentMAP)", 1, v, ARENA.test);

test("[OPUS2-PATCH A] the arena's count, each row a wave the best round reached, is named and its waves are limits", () => {
  const { rows, open, expand } = placed(
    { 1: [wave(10, 1), wave(30, 2), wave(50, 3, 0)] },
    [arena(2), leaf("Other", 1)],
  );
  const [n] = rows;
  expect([n?.name, n?.flags]).toEqual([ARENA.name, {}]);
  expect(expand(n?.id ?? "")?.formula).toEqual([
    [
      "Best Pet Arena round ≥ 10 (arena bonus 1)",
      "+",
      "Best Pet Arena round ≥ 30 (arena bonus 2)",
      "+",
      "Best Pet Arena round ≥ 50 (arena bonus 3)",
    ],
    [1, 1, 0, 2],
  ]);
  const kids = open(n?.id ?? "");
  expect(kids.map((k) => [k.leaf, k.condition, k.why])).toEqual([
    ["condition", "limit", null],
    ["condition", "limit", null],
    ["condition", "limit", null],
  ]);
  expect(n && checkTree({ ...n, kids }, 10)).not.toBeNull();
});

test("[OPUS2-PATCH A] an arena count with a row that is no wave, or a wave with rows, or another code, keeps its rows as they are", () => {
  const withRows = { ...wave(30, 2), group: [leaf("Part", 1)] };
  for (const [kids, code] of [
    [[wave(10, 1), leaf("Other", 1)], ARENA.test],
    [[wave(10, 1), withRows], ARENA.test],
    [[wave(10, 1), wave(30, 2)], "DNSM.CalcTalentMAP.other"],
  ] as const) {
    const top = { ...arena(2), node: { ...arena(2).node, code } };
    const { rows, open } = placed({ 1: [...kids] }, [top, leaf("Other", 1)]);
    expect(open(rows[0]?.id ?? "").map((k) => k.condition)).not.toContain(
      "limit",
    );
  }
});

test("[OPUS2-PATCH A] the yes/no beside the arena's count reads the same count: the same name", () => {
  const { rows } = placed({ 1: [wave(10, 1), leaf("Other", 1)] }, [
    arena(2),
    leaf("Working value of the game (CalcTalentMAP) > 1", 1, null, {
      leaf: "condition",
      condition: "limit",
    }),
  ]);
  expect(rows.map((r) => r.name)).toEqual([
    "Arena waves reached by the best round",
    "Arena waves reached by the best round > 1",
  ]);
  // with no arena count in the level, the same name stays
  const alone = placed({}, [
    leaf("Working value of the game (CalcTalentMAP) > 1", 1),
    leaf("Other", 2),
  ]).rows;
  expect(alone[0]?.name).toBe("Working value of the game (CalcTalentMAP) > 1");
});

const JAR_CODE = 'Holes("JarCollectibleBonus", 4, 0)';
const earlier = (v: number): Row => ({
  node: row({ pieceKey: null, value: v, code: null, leaf: "unknown" }),
  open: null,
  earlier: true,
});
test("[OPUS2-PATCH E] a collectible's unlinked earlier value that is the number in its text is that number", () => {
  useGameTables(
    new Map([["CustomLists.HolesInfo", { 67: { 4: "JAR_TEXT|1|other" } }]]),
  );
  const { rows, open } = placed({ 1: [earlier(1), leaf("Owned", 3)] }, [
    lazy("Jar", 1, 3, JAR_CODE),
    leaf("Other", 1),
  ]);
  const [one] = open(rows[0]?.id ?? "");
  expect([one?.name, one?.leaf, one?.why, one?.flags]).toEqual([
    JAR.name,
    "fixedValue",
    null,
    {},
  ]);
  expect(isNameText(JAR.name)).toBe(true);
});

test.each<[string, Record<number, unknown>, Row, string]>([
  ["another number", { 67: { 4: "JAR_TEXT|2|other" } }, earlier(1), JAR_CODE],
  ["no text", {}, earlier(1), JAR_CODE],
  [
    "a named earlier value",
    { 67: { 4: "JAR_TEXT|1" } },
    { ...earlier(1), node: { ...earlier(1).node, name: "Named", flags: {} } },
    JAR_CODE,
  ],
  [
    "no earlier value",
    { 67: { 4: "JAR_TEXT|1" } },
    leaf("Game value", 1, null, { flags: { unnamed: true } }),
    JAR_CODE,
  ],
  [
    "an earlier value with rows",
    { 67: { 4: "JAR_TEXT|1" } },
    { ...earlier(1), group: [leaf("Part", 1)] },
    JAR_CODE,
  ],
  [
    "another call",
    { 67: { 4: "JAR_TEXT|1" } },
    earlier(1),
    'Holes("JarCollectibleBonus", 4, 1)',
  ],
])("[OPUS2-PATCH E] %s keeps the row as it is", (_name, table, r, code) => {
  useGameTables(new Map([["CustomLists.HolesInfo", table]]));
  const { rows, open } = placed({ 1: [r, leaf("Owned", 3)] }, [
    lazy("Jar", 1, 3, code),
    leaf("Other", 1),
  ]);
  expect(open(rows[0]?.id ?? "")[0]?.name).not.toBe(JAR.name);
});

const MEASURE_CODE = 'Holes("MeasurementQTYfound", 4, 99)';
const measured = (v: number, more: Partial<Row["node"]> = {}) =>
  leaf("Game value", v, MEASURE.read, { flags: { unnamed: true }, ...more });
test("[OPUS2-PATCH F] the measured amount the curve reads is the amount the call shows, at any depth of its built rows", () => {
  const curve: Row = {
    node: row({ pieceKey: null, value: 2, code: null, name: "Curve" }),
    open: null,
    group: [leaf("Base", 1, null, { leaf: "fixedValue" }), measured(40)],
  };
  const src = leaf("Tome pages read", 40, "TomeQTY[11]", { leaf: "quantity" });
  const { rows, open } = placed({ 1: [src, measured(40), curve] }, [
    lazy("Measure", 1, 2, MEASURE_CODE),
    leaf("Other", 1),
  ]);
  const kids = open(rows[0]?.id ?? "");
  expect(kids.map((k) => [k.name, k.leaf])).toEqual([
    ["Tome pages read", "quantity"],
    ["Tome pages read", "quantity"],
    ["Curve", null],
  ]);
  expect(kidsOf(kids[2]).map((k) => [k.name, k.leaf, k.flags])).toEqual([
    ["Base", "fixedValue", {}],
    ["Tome pages read", "quantity", {}],
  ]);
});

test.each<[string, Row, Row, string]>([
  [
    "another value",
    leaf("Tome pages read", 40, "TomeQTY[11]", { leaf: "quantity" }),
    measured(39),
    MEASURE_CODE,
  ],
  [
    "a typed read",
    leaf("Tome pages read", 40, "TomeQTY[11]", { leaf: "quantity" }),
    measured(40, { leaf: "level" }),
    MEASURE_CODE,
  ],
  [
    "no source with a type",
    leaf("Tome pages read", 40, "TomeQTY[11]"),
    measured(40),
    MEASURE_CODE,
  ],
  [
    "a source with no code",
    leaf("Tome pages read", 40, null, { leaf: "quantity" }),
    measured(40),
    MEASURE_CODE,
  ],
  [
    "another call",
    leaf("Tome pages read", 40, "TomeQTY[11]", { leaf: "quantity" }),
    measured(40),
    'Holes("MeasurementQTYfound", 4, 0)',
  ],
])("[OPUS2-PATCH F] %s keeps the read as it is", (_name, src, m, code) => {
  const { rows, open } = placed({ 1: [src, m] }, [
    lazy("Measure", 1, 2, code),
    leaf("Other", 1),
  ]);
  expect(open(rows[0]?.id ?? "")[1]?.name).toBe("Game value");
});

test.each([
  ['WorkbenchStuff("OverkillQTY", 2, 0)', "Deathnote points of World 3"],
  ["Holes[9][1]", "Golddust owned"],
  ["Holes[9][7]", "Cavern resource 7 owned"],
  [
    "PixelHelperActor[9].behaviors.getBehavior(ActorEvents_670)._GenINFO[129]",
    "Unique string types on the Harp",
  ],
])("[opus2Leaf] the count %s is named", (code, name) => {
  const [r] = finish(9, [read(code, 3), read("Q", 1)], false);
  expect([r?.node.name, r?.node.leaf, r?.node.why, r?.node.flags]).toEqual([
    name,
    "quantity",
    null,
    {},
  ]);
  expect(isNameText(name)).toBe(true);
});

test("[opus2Leaf] a count typed already as something else, or with rows, keeps its name", () => {
  const code = 'WorkbenchStuff("OverkillQTY", 2, 0)';
  const typed: Row = {
    node: { ...read(code, 3).node, leaf: "fixedValue" },
    open: null,
  };
  const [r] = finish(9, [typed, read("Q", 1)], false);
  expect(r?.node.name).toBe(read(code, 3).node.name);
  const opens: Row = { node: { ...read(code, 3).node, kids: "lazy" }, open: 1 };
  expect(finish(9, [opens, read("Q", 1)], false)[0]?.node.name).toBe(
    read(code, 3).node.name,
  );
});

test("[OPUS2-PATCH A] an arena count named by a rule is named again; one with no rows has no ⓘ", () => {
  const named = {
    ...arena(2),
    node: { ...arena(2).node, name: "Arena count" },
  };
  const { rows } = placed({ 1: [wave(10, 1), wave(30, 2)] }, [
    named,
    leaf("Other", 1),
  ]);
  expect(rows[0]?.name).toBe(ARENA.name);
  const empty = placed({ 1: [] }, [arena(2), leaf("Other", 1)]);
  expect(empty.expand(empty.rows[0]?.id ?? "")?.formula).toBeNull();
});

test("[OPUS2-PATCH F] a typed read of the amount itself is no source; a source with no name of its own leaves the read with none", () => {
  const src = leaf("Tome pages read", 40, "TomeQTY[11]", { leaf: "quantity" });
  // (another value than the read's: two reads of the same code and value are one, tree/one-of-each.ts)
  const typedRead = measured(41, { leaf: "level", name: "Amount", flags: {} });
  const first = placed({ 1: [typedRead, src, measured(40)] }, [
    lazy("Measure", 1, 2, MEASURE_CODE),
    leaf("Other", 1),
  ]);
  expect(first.open(first.rows[0]?.id ?? "")[2]?.name).toBe("Tome pages read");
  const generic = {
    ...src,
    node: { ...src.node, name: "Game value", flags: { unnamed: true } },
  };
  const none = placed({ 1: [generic, measured(40)] }, [
    lazy("Measure", 1, 2, MEASURE_CODE),
    leaf("Other", 1),
  ]);
  expect(none.open(none.rows[0]?.id ?? "")[1]).toMatchObject({
    leaf: "quantity",
    flags: { unnamed: true },
  });
});
