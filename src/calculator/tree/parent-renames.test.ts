// The passes of pieces.cjs `finish` that name a row by the level under it (tree/parent-renames.ts): a nametag's grade
// (nametagGrade), an item's or a stamp's bonus (stampBonus) and a pet with the earlier pets (rule 67). Rows written by
// hand, with invented names; the talent's ⓘ of `talentMulti` is the expression's (tree/terms.ts R1-PATCH).
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import type { RecNode } from "../recording.ts";
import { makeCodeFormulas } from "./code-formulas.ts";
import { isNameText } from "../names/name-text.ts";
import {
  nametagGrade,
  PARENT_RENAMES,
  petsEarlier,
  stampBonus,
} from "./parent-renames.ts";
import { makePlaces } from "./places.ts";
import { callText, GENERIC_NAME, row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { call, num, op } from "./term-fixture.ts";
import { makeTerms } from "./terms.ts";
import { kidsOf, recNode } from "./tree-fixture.ts";

const leaf = (
  name: string | undefined,
  value: number,
  code: string | null = null,
): Row => ({
  node: row({
    pieceKey: null,
    value,
    code,
    ...(name === undefined ? {} : { name }),
    leaf: "rawBonus",
  }),
  open: null,
});
const branch = (name: string, value: number, code: string | null = null) =>
  ({
    node: row({ pieceKey: null, value, code, name }),
    open: null,
    group: [leaf("Part", value)],
  }) satisfies Row;
const names = (rows: readonly Row[]) => rows.map((r) => r.node.name);

const TROPHY = "Trophy slot multiplier (podium level)";
const NAMETAG = "EquipmentNametag3";

test("[nametagGrade] beside a nametag, the trophy slot multiplier is the nametag's grade multiplier, also in the parent's name", () => {
  const kids = [
    leaf("Bonus value", 40),
    leaf(TROPHY, 2, "DNSM.GalleryDN2"),
    leaf("Nametag", 1, NAMETAG),
  ];
  const out = nametagGrade(leaf(`Total of the ${TROPHY}`, 80), kids);
  expect(names(out.kids)).toEqual([
    "Bonus value",
    "Nametag grade multiplier (grade factor)",
    "Nametag",
  ]);
  expect(out.name).toBe("Total of the Nametag grade multiplier (grade factor)");
  for (const n of [...names(out.kids), out.name ?? ""])
    expect(isNameText(n)).toBe(true);
});

test("[nametagGrade] a trophy's multiplier, with no nametag beside it, keeps its name; so does the parent", () => {
  const kids = [leaf("Bonus value", 40), leaf(TROPHY, 2)];
  const out = nametagGrade(leaf("Trophy", 80), kids);
  expect(names(out.kids)).toEqual(["Bonus value", TROPHY]);
  expect(out.name).toBeNull();
  // the nametag itself is no multiplier
  expect(
    names(nametagGrade(leaf("Trophy", 80), [leaf("Nametag", 1, NAMETAG)]).kids),
  ).toEqual(["Nametag"]);
  // with no multiplier, a parent named for one keeps its name; a multiplier is no nametag beside itself
  expect(
    nametagGrade(leaf(TROPHY, 80), [leaf("Nametag", 1, NAMETAG)]).name,
  ).toBeNull();
  expect(
    names(nametagGrade(leaf("Trophy", 80), [leaf(TROPHY, 2, NAMETAG)]).kids),
  ).toEqual([TROPHY]);
});

test("[nametagGrade] the multiplier's name without its podium level becomes the grade multiplier's", () => {
  const out = nametagGrade(leaf("Bonus", 80), [
    leaf("Trophy slot multiplier", 2),
    leaf("Nametag", 1, NAMETAG),
  ]);
  expect(names(out.kids)).toEqual(["Nametag grade multiplier", "Nametag"]);
  // a parent whose name has none of it keeps it
  expect(out.name).toBeNull();
});

test.each<[string, Row[], string | null]>([
  [
    "an item's bonus value × its multiplier",
    [leaf("Balling Nametag bonus value", 40), leaf("Slot", 2)],
    "Balling Nametag bonus",
  ],
  [
    "× a trophy slot multiplier with rows of its own",
    [
      leaf("Balling Nametag bonus value", 40),
      branch("Trophy slot multiplier", 2),
    ],
    "Balling Nametag bonus",
  ],
  [
    "× a nametag grade multiplier with rows of its own",
    [
      branch("Nametag grade multiplier", 2),
      leaf("Balling Nametag bonus value", 40),
    ],
    "Balling Nametag bonus",
  ],
  [
    "× another part with rows of its own",
    [leaf("Balling Nametag bonus value", 40), branch("Slot", 2)],
    null,
  ],
  [
    "× another part with rows to open",
    [
      leaf("Balling Nametag bonus value", 40),
      { ...leaf("Slot", 2, "Slot()"), open: 5 },
    ],
    null,
  ],
  [
    "a product that is not the parent's value",
    [leaf("Balling Nametag bonus value", 40), leaf("Slot", 3)],
    null,
  ],
  [
    "no bonus value",
    [leaf("Balling Nametag bonus", 40), leaf("Slot", 2)],
    null,
  ],
  [
    "three parts",
    [leaf("Balling Nametag bonus value", 40), leaf("Slot", 2), leaf("One", 1)],
    null,
  ],
])("[stampBonus] %s", (_case, kids, name) => {
  expect(stampBonus(leaf("Product", 80), kids, () => [])).toBe(name);
  if (name) expect(isNameText(name)).toBe(true);
});

test("[stampBonus] the head of a system's member keeps its own name", () => {
  const kids = [leaf("Balling Nametag bonus value", 40), leaf("Slot", 2)];
  expect(
    stampBonus(leaf("Food Effect", 80, "GoldFoodBonuses(1)"), kids, () => []),
  ).toBe("Balling Nametag bonus");
  expect(
    stampBonus(
      leaf("Food Effect", 80, "GetTalentNumber(1, 7)"),
      kids,
      () => [],
    ),
  ).toBeNull();
});

const CURVE = 'ArbitraryCode5Inputs("decay", 5, 100, 3)';
test("[stampBonus] with no exalted multiplier, the curve's level is never built", () => {
  const cur = branch("Curve", 3, CURVE);
  const asked: Row[] = [];
  const of = (c: Row) => {
    asked.push(c);
    return [leaf("Golden Apple Stamp level", 3)];
  };
  expect(
    stampBonus(leaf("Product", 6), [leaf("Exalted", 2, "DNSM.Other"), cur], of),
  ).toBeNull();
  expect(asked).toEqual([]);
});

test("[stampBonus] the exalted multiplier × the curve of a stamp's level is that stamp's bonus", () => {
  const cur = branch("Curve", 3, CURVE);
  const double = leaf("Exalted", 2, "DNSM.StampExalted_double");
  const level = [leaf("Constant", 5), leaf("Golden Apple Stamp level", 3)];
  const of = (c: Row) => (c === cur ? level : []);
  expect(stampBonus(leaf("Product", 6), [double, cur], of)).toBe(
    "Golden Apple Stamp bonus",
  );
  // the curve's input not a level, no exalted multiplier, no curve, a third part
  expect(
    stampBonus(leaf("Product", 6), [double, cur], () => [leaf("Constant", 5)]),
  ).toBeNull();
  expect(
    stampBonus(leaf("Product", 6), [leaf("Exalted", 2, "DNSM.Other"), cur], of),
  ).toBeNull();
  expect(
    stampBonus(leaf("Product", 6), [double, branch("Curve", 3, "Other()")], of),
  ).toBeNull();
  expect(
    stampBonus(leaf("Product", 6), [double, cur, leaf("One", 1)], of),
  ).toBeNull();
});

const SHINY_TYPE = "CustomLists.RANDOlist[90][4]";
/** The name the shiny type's read has before rule 67 renames it (tree/names.ts). */
const SHINY_NAME = "Shiny bonus type of pet gene 4";
const PET = 'Breeding("SpecialPassives", "Lv", 0, 3)';
/** The leaf rule 67 renamed (tree/level-renames.ts), as a level gives it. */
const earlier = (code = SHINY_TYPE): Row => ({
  node: {
    ...row({ pieceKey: null, value: 0, code }),
    name: "Earlier pets with the same shiny bonus",
    flags: {},
  },
  open: null,
});

test("[rule 67] a parent named as the earlier pets' total was is the pet's, with the earlier pets", () => {
  const pet = leaf("Bored Bean", 2, PET);
  const parent = leaf(SHINY_NAME, 2);
  expect(petsEarlier(parent, [earlier(), pet])).toBe(
    "Bored Bean, with the earlier pets",
  );
  expect(isNameText("Bored Bean, with the earlier pets")).toBe(true);
  // a read with no name of its own had the generic one, as the parent
  const generic = leaf(undefined, 2);
  expect(generic.node.name).toBe(GENERIC_NAME);
  expect(petsEarlier(generic, [earlier("RANDOlist[90][4]"), pet])).toBe(
    "Bored Bean, with the earlier pets",
  );
  expect(petsEarlier(generic, [earlier(), pet])).toBeNull();
  // a parent with another name, a pet with no name, no pet, no earlier pets' total, a total with rows
  expect(petsEarlier(leaf("Shiny bonus", 2), [earlier(), pet])).toBeNull();
  const nameless: Row = {
    ...pet,
    node: { ...pet.node, name: GENERIC_NAME, flags: { unnamed: true } },
  };
  expect(petsEarlier(parent, [earlier(), nameless])).toBeNull();
  expect(petsEarlier(parent, [earlier(), leaf("Bored Bean", 2)])).toBeNull();
  expect(petsEarlier(parent, [leaf("Total", 0, SHINY_TYPE), pet])).toBeNull();
  expect(
    petsEarlier(parent, [{ ...earlier(), group: [leaf("Part", 0)] }, pet]),
  ).toBeNull();
  expect(petsEarlier(parent, [{ ...earlier(), open: 9 }, pet])).toBeNull();
  // the name alone, on another read with no name of its own
  expect(petsEarlier(generic, [earlier("Other[4]"), pet])).toBeNull();
});

test("the rows of a placed row's level are renamed with it, and the row by them", () => {
  const levels: Record<number, Row[]> = {
    1: [
      leaf("Balling Nametag bonus value", 40),
      leaf(TROPHY, 2),
      leaf("Nametag", 1, NAMETAG),
    ],
    2: [leaf("Balling Nametag bonus value", 40), leaf("Slot", 2)],
    3: [earlier(), leaf("Bored Bean", 2, PET)],
    4: [
      leaf("Exalted", 2, "DNSM.StampExalted_double"),
      {
        ...leaf("Curve", 3, CURVE),
        group: [leaf("Constant", 5), leaf("Golden Apple Stamp level", 3)],
      },
    ],
  };
  const places = makePlaces({
    nodes: [0, 1, 2, 3, 4].map((i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => levels[id] ?? null,
    opened: () => null,
  });
  const lazy = (open: number, value: number, name?: string): Row => ({
    node: row({
      pieceKey: null,
      value,
      code: `Call${String(open)}()`,
      ...(name === undefined ? {} : { name }),
      kids: "lazy",
    }),
    open,
  });
  const placed = places.place(
    { id: "root", code: "Root()" },
    [
      lazy(1, 80, "Trophy slot multiplier bonus"),
      lazy(2, 80, "Product"),
      lazy(3, 2, SHINY_NAME),
      lazy(4, 6, "Stamp"),
    ],
    1,
    [0],
  );
  expect(placed.map((p) => p.name)).toEqual([
    "Nametag grade multiplier bonus",
    "Balling Nametag bonus",
    "Bored Bean, with the earlier pets",
    "Golden Apple Stamp bonus",
  ]);
  expect(placed[2]?.flags.unnamed).toBeUndefined();
  const gallery = places.expand(placed[0]?.id ?? "");
  expect(kidsOf(gallery).map((k) => k.name)).toEqual([
    "Balling Nametag bonus value",
    "Nametag grade multiplier (grade factor)",
    "Nametag",
  ]);
  expect(
    gallery && checkTree({ ...gallery, kids: kidsOf(gallery) }, 100),
  ).not.toBeNull();
});

test("[talentMulti] a talent's 1 + curve ÷ 100 is the branch of R1-PATCH, whose ⓘ is the talent's curve in the expression", () => {
  const nodes: RecNode[] = [
    recNode(0, "GetTalentNumber", { a: [1, 7], v: 4, c: [1] }),
    recNode(1, "ArbitraryCode5Inputs", { a: ["bigBase", 4, 0, 10], v: 4 }),
  ];
  const terms = makeTerms({
    nodes,
    read: (p, v) => ({
      node: row({ pieceKey: p, value: Number(v), code: p }),
      open: null,
    }),
    call: (k, v) => ({
      node: row({ pieceKey: k.b, value: Number(v), code: callText(k) }),
      open: null,
    }),
    finish: (_v, rows) => rows,
    block: recNode(9, "Family"),
    entry: () => null,
    formulas: makeCodeFormulas(nodes, () => []),
  });
  const e = op("+", num(1), op("/", call(0, 4), num(100), 0.04), 1.04);
  const r = terms.term(e, "*", new Map());
  expect(r?.node.code).toBeNull();
  expect(r?.xf).toEqual([
    "1 + ((4 + 0 × (Points in the talent + All-talent levels)) ÷ 100)",
    "1 + ((4 + 0 × 10) ÷ 100) = 1.04",
  ]);
});

test("every parent rename has a test", () => {
  expect(Object.keys(PARENT_RENAMES).sort()).toEqual(
    ["nametag", "pets", "stampCurve", "stampValue"].sort(),
  );
});
