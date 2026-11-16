// pieces.cjs `pommelionPass` at BASELINE-4 (tree/pommelion.ts): the Pommelion Seed's bonus is its max bonus × its level
// factor, and the factor is Level ÷ (Base + Level). Rows written by hand.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { isNameText } from "./name-text.ts";
import { makePlaces } from "./places.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { kidsOf, recNode } from "./tree-fixture.ts";

const SEED = 'FarmingStuffs("ExoticBonusQTY", 59, 0)';
const leaf = (
  name: string,
  value: number,
  leafKind: "level" | "fixedValue",
): Row => ({
  node: row({ pieceKey: null, value, code: null, name, leaf: leafKind }),
  open: null,
});
/** The seed's level: its max bonus and its factor, a branch of the level and the base. */
function seed(
  o: {
    name?: string;
    code?: string;
    value?: number;
    max?: string;
    base?: string;
    level?: number;
    lvKind?: "level" | "fixedValue";
    built?: boolean;
  } = {},
) {
  const L = o.level ?? 25;
  const factor: Row = {
    node: row({ pieceKey: null, value: 0.25, code: null }),
    open: null,
    ...(o.built === false
      ? {}
      : {
          group: [
            leaf("Exotic level", L, o.lvKind ?? "level"),
            leaf(o.base ?? "Base 75", 75, "fixedValue"),
          ],
        }),
  };
  const levels: Record<number, Row[]> = {
    1: [
      leaf(o.max ?? "Max bonus of the exotic seed", 50, "fixedValue"),
      factor,
    ],
  };
  const top: Row = {
    node: row({
      pieceKey: null,
      value: o.value ?? 12.5,
      code: o.code ?? SEED,
      name: o.name ?? "Pommelion Seed",
      kids: "lazy",
    }),
    open: 1,
  };
  const places = makePlaces({
    nodes: [0, 1].map((i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => levels[id] ?? null,
    opened: () => null,
  });
  const [n] = places.place({ id: "root", code: "Root()" }, [top], 1, [0]);
  const open = places.expand(n?.id ?? "");
  return { open, kids: kidsOf(open) };
}

test("[pommelionPass] the Pommelion Seed is its max bonus × its level factor, the factor Level ÷ (Base + Level)", () => {
  const { open, kids } = seed();
  expect(open?.formula).toEqual([
    ["Max bonus", "×", "Level factor"],
    [50, 0.25, 12.5],
  ]);
  const fac = kids[1];
  expect(fac?.name).toBe("Level factor");
  expect(fac?.flags.unnamed).toBeUndefined();
  // the base as a number of the code, as the bench writes it
  expect(fac?.formula).toEqual([
    ["Level", "÷", "(", "75", "+", "Level", ")"],
    [25, 75, 25, 0.25],
  ]);
  expect(kidsOf(fac).map((k) => k.name)).toEqual(["Exotic level", "Base"]);
  expect(open && checkTree(open, 10)).not.toBeNull();
  expect(
    [
      "Max bonus × Level factor",
      "Level factor",
      "Base",
      "Level ÷ (75 + Level)",
    ].every(isNameText),
  ).toBe(true);
});

test.each([
  ["another name", { name: "Other Seed" }],
  ["another exotic", { code: 'FarmingStuffs("ExoticBonusQTY", 58, 0)' }],
  ["no max bonus", { max: "Bonus cap" }],
  ["no base", { base: "Start 75" }],
  ["no level", { lvKind: "fixedValue" as const }],
  ["a factor with no rows built", { built: false }],
  ["a product that is not the value", { value: 12 }],
  ["a factor that is not Level ÷ (Base + Level)", { level: 26 }],
])("[pommelionPass] %s: as it is", (_name, o) => {
  const { open, kids } = seed(o);
  expect(kids[1]?.name).not.toBe("Level factor");
  expect(open?.formula).not.toEqual([
    ["Max bonus", "×", "Level factor"],
    [50, 0.25, 12.5],
  ]);
});
