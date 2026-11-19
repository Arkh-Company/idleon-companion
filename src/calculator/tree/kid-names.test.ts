// pieces.cjs `fixNames` at BASELINE-4 (tree/kid-names.ts): the names a level's rows take from the rows above them (the
// parent's name said again, the system a level above already shows, the cycles of an Endless win) and the parent that
// says its one child again, which the child's rows then replace. Rows and names written by hand, with invented names.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import { collapsed, FIX_NAMES, kidNames, shinyLevel } from "./kid-names.ts";
import { isNameText } from "./name-text.ts";
import { makePlaces } from "./places.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { tagOf } from "./tags.ts";
import { kidsOf, recNode } from "./tree-fixture.ts";

const named = (name: string, value = 1, code: string | null = null): Row => ({
  node: row({ pieceKey: null, value, code, name, leaf: "rawBonus" }),
  open: null,
});
const opening = (name: string, open: number, value = 6): Row => ({
  node: row({
    pieceKey: name,
    value,
    code: `Call${String(open)}()`,
    name,
    kids: "lazy",
  }),
  open,
});
const names = (rows: readonly Row[]) => rows.map((r) => r.node.name);

test.each<[string, string, string]>([
  ["a level of the parent's item", "Skull of Major Droprate level", "Level"],
  ["a part in parentheses", "Skull of Major Droprate (grade)", "Grade"],
  ["after a colon, any case", "skull of major droprate: chance", "Chance"],
  ["a comparison", "Skull of Major Droprate ≥ 5", "Value ≥ 5"],
  [
    "a vague word",
    "Skull of Major Droprate bonus",
    "Skull of Major Droprate bonus",
  ],
  [
    "a vague word with its system",
    "Skull of Major Droprate multi (Drop Rate)",
    "Skull of Major Droprate multi (Drop Rate)",
  ],
  [
    "the parent's name only",
    "Skull of Major Droprate",
    "Skull of Major Droprate",
  ],
  ["another name", "Skull level", "Skull level"],
])("[fixNames 4] %s: %s is %s", (_case, kid, name) => {
  const [r] = kidNames(
    [named(kid)],
    { name: "Skull of Major Droprate", code: null },
    [],
  );
  expect(r?.node.name).toBe(name);
  expect(isNameText(r?.node.name ?? "")).toBe(true);
});

test("[fixNames 4] a parent with no proven name renames no child (R14: a generic name names nothing)", () => {
  const generic = { name: "Game value", code: null, flags: { unnamed: true } };
  expect(
    names(kidNames([named("Game value (At 0 (1))")], generic, [])),
  ).toEqual(["Game value (At 0 (1))"]);
  expect(
    names(
      kidNames([named("Game value (At 0 (1))")], { ...generic, flags: {} }, []),
    ),
  ).toEqual(["At 0 (1)"]);
});

test("a pool or a system's group keeps the app's name under any parent (spec 009)", () => {
  const group = (name: string, role: "pool" | "system"): Row => ({
    node: row({ pieceKey: null, value: 0, code: null, name, role }),
    open: null,
    group: [named("A"), named("B")],
  });
  expect(
    names(
      kidNames(
        [group("Multi pool 1", "pool"), group("📕 Grimoire", "system")],
        { name: "Multi pool", code: 'Summoning("GrimoireUpgBonus", 5)' },
        [],
      ),
    ),
  ).toEqual(["Multi pool 1", "📕 Grimoire"]);
});

test("[fixNames 4] the parent is compared without its system's emoji, its parentheses and what follows a dot", () => {
  expect(
    names(
      kidNames(
        [named("Stamps: Drop Rate")],
        { name: "📜 Stamps", code: null },
        [],
      ),
    ),
  ).toEqual(["Drop Rate"]);
  expect(
    names(
      kidNames(
        [named("Stamps: Drop Rate")],
        { name: "Stamps · page 2 (World 1)", code: null },
        [],
      ),
    ),
  ).toEqual(["Drop Rate"]);
  // a parent of 3 letters or fewer names nothing
  expect(
    names(kidNames([named("Owl level")], { name: "Owl", code: null }, [])),
  ).toEqual(["Owl level"]);
});

test.each<[string, string[], string]>([
  ["a system a level above shows", ["Upgrade 5 Grimoire 5"], "Bonus per level"],
  ["by its name, in any case", ["the grimoire"], "Bonus per level"],
  [
    "a system no level above shows",
    ["Upgrade 5 Vault 5"],
    "Bonus per level (Grimoire)",
  ],
])("[fixNames 5] %s", (_case, above, name) => {
  expect(
    names(
      kidNames(
        [named("Bonus per level (Grimoire)")],
        { name: "Upgrade", code: null },
        above,
      ),
    ),
  ).toEqual([name]);
});

test("[fixNames 5] only a word in parentheses goes, never a piece of a sum; the parent's own name and tag count", () => {
  expect(
    names(
      kidNames(
        [named("Total (÷ 100)"), named("Bonus per level (Grimoire)")],
        { name: "Upgrade 5", code: 'Summoning("GrimoireUpgBonus", 5)' },
        [],
      ),
    ),
  ).toEqual(["Total (÷ 100)", "Bonus per level"]);
});

test("[fixNames] an Endless win's slot that comes back is told by its cycle; a slot once keeps its name", () => {
  const rows = kidNames(
    [
      named("Endless win, slot 1"),
      named("Endless win, slot 2"),
      named("Endless win, slot 1"),
    ],
    { name: "Summoning", code: null },
    [],
  );
  expect(names(rows)).toEqual([
    "Endless win, slot 1 (cycle 1)",
    "Endless win, slot 2",
    "Endless win, slot 1 (cycle 2)",
  ]);
  // any other name said twice keeps it
  expect(
    names(
      kidNames(
        [named("Win"), named("Win")],
        { name: "Summoning", code: null },
        [],
      ),
    ),
  ).toEqual(["Win", "Win"]);
});

test("[fixNames] a parent named for a pet's shiny EXP is the pet's shiny level", () => {
  const exp = named("Shiny EXP", 40, "Breeding[22][3]");
  expect(shinyLevel(named("Shiny EXP", 3), [exp])).toBe("Shiny level");
  expect(isNameText("Shiny level")).toBe(true);
  // another code, or another parent, is no shiny level
  expect(
    shinyLevel(named("Shiny EXP", 3), [named("Shiny EXP", 40, "Other[1]")]),
  ).toBeNull();
  expect(shinyLevel(named("Pet", 3), [exp])).toBeNull();
  expect(
    shinyLevel(named("Shiny EXP", 3), [
      named("Pet EXP", 40, "Breeding[22][3]"),
    ]),
  ).toBeNull();
});

test("[fixNames] a parent whose one child says it again, with its value and rows of its own, is that child", () => {
  const twice = opening("Drop bonus (total)", 2);
  expect(collapsed(opening("Drop bonus", 1), [twice], () => true)).toBe(twice);
  // another name, another value, a child with no rows, or two children: no
  expect(collapsed(opening("Drop", 1), [twice], () => true)).toBeNull();
  expect(
    collapsed(opening("Drop bonus", 1, 7), [twice], () => true),
  ).toBeNull();
  expect(collapsed(opening("Drop bonus", 1), [twice], () => false)).toBeNull();
  expect(
    collapsed(
      opening("Drop bonus", 1),
      [twice, named("Drop bonus")],
      () => true,
    ),
  ).toBeNull();
});

test("[fixNames] two rows with no proven name never say each other again (R14: a generic name names nothing)", () => {
  const generic = (open: number): Row => ({
    node: row({ pieceKey: null, value: 6, code: null, kids: "lazy" }),
    open,
  });
  expect(generic(1).node.flags.unnamed).toBe(true);
  expect(collapsed(generic(1), [generic(2)], () => true)).toBeNull();
  expect(
    collapsed(opening("Game value", 1), [generic(2)], () => true),
  ).toBeNull();
  expect(
    collapsed(generic(1), [opening("Game value", 2)], () => true),
  ).toBeNull();
});

test("the tag of a system's call is the bench's (pieces.cjs tagOf); any other call has none", () => {
  expect(tagOf('Summoning("GrimoireUpgBonus", 5)')).toBe("Grimoire 5");
  expect(tagOf("GetTalentNumber(1, 207)")).toBe("Talent 207");
  expect(tagOf('RunCodeOfTypeXforThingY("CardLv", "mushG")')).toBe(
    "Card mushG",
  );
  expect(tagOf('Labb("SigilBonus", 0, 3)')).toBe("Sigil 3");
  expect(tagOf('Breeding("ShinyBonusS", 0, 7)')).toBe("Breeding 7");
  expect(tagOf("GoldFoodBonuses(1)")).toBe("");
  expect(tagOf("Invented(1)")).toBe("");
  expect(tagOf("DNSM.Pool.total")).toBe("");
  expect(tagOf(null)).toBe("");
});

test("every fixNames rule has a test", () => {
  expect(Object.keys(FIX_NAMES).sort()).toEqual(
    ["collapse", "cycle", "prefix", "shiny", "system"].sort(),
  );
});

const levels: Record<number, Row[]> = {
  // a parent that says its one child again: its rows are the child's
  1: [opening("Drop bonus (total)", 2)],
  2: [named("Drop bonus from cards", 2), named("Drop bonus from stamps", 4)],
  3: [named("Endless win, slot 1", 2), named("Endless win, slot 1", 4)],
  // a pet's shiny EXP under a row named for it
  4: [named("Shiny EXP", 40, "Breeding[22][3]"), named("Base levels", 19)],
  // a system's call two levels above (another value: a row whose one child has its value would be that child)
  5: [opening("Inner", 6, 5)],
  6: [named("Bonus per level (Grimoire)", 2), named("Other", 4)],
};

test("a placed row says its one child again: it takes the child's rows, its own name, and its kids lose its name", () => {
  const places = makePlaces({
    nodes: [0, 1, 2, 3, 4, 5, 6].map((i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => levels[id] ?? null,
    opened: () => null,
  });
  const placed = places.place(
    { id: "root", code: "Root()" },
    [
      opening("Drop bonus", 1),
      opening("Summoning wins", 3),
      opening("Shiny EXP", 4, 3),
      {
        ...opening("Upgrade", 5),
        node: {
          ...opening("Upgrade", 5).node,
          code: 'Summoning("GrimoireUpgBonus", 5)',
        },
      },
    ],
    1,
    [0],
  );
  expect(placed.map((p) => [p.name, p.kids])).toEqual([
    ["Drop bonus", "lazy"],
    ["Summoning wins", "lazy"],
    ["Shiny level", "lazy"],
    ["Upgrade", "lazy"],
  ]);
  // the system's tag two levels above names the level under "Inner"
  const inner = kidsOf(places.expand(placed[3]?.id ?? ""))[0];
  expect(kidsOf(places.expand(inner?.id ?? "")).map((k) => k.name)).toEqual([
    "Bonus per level",
    "Other",
  ]);
  const drop = places.expand(placed[0]?.id ?? "");
  expect(kidsOf(drop).map((k) => k.name)).toEqual([
    "From cards",
    "From stamps",
  ]);
  const endless = places.expand(placed[1]?.id ?? "");
  expect(kidsOf(endless).map((k) => k.name)).toEqual([
    "Endless win, slot 1 (cycle 1)",
    "Endless win, slot 1 (cycle 2)",
  ]);
  for (const n of [drop, endless])
    expect(n && checkTree({ ...n, kids: kidsOf(n) }, 100)).not.toBeNull();
});

test("a branch with no code that says its one call again takes the call's code and opens as it", () => {
  const places = makePlaces({
    nodes: [0, 1, 2].map((i) => recNode(i, `Call${String(i)}`)),
    bugs: [],
    keyOf: (n) => String(n.id),
    openXf: new Map(),
    explain: (id) => levels[id] ?? null,
    opened: () => null,
  });
  const drop: Row = {
    node: row({ pieceKey: null, value: 6, code: null, name: "Drop bonus" }),
    open: null,
    group: [opening("Drop bonus (total)", 2)],
  };
  const [placed] = places.place({ id: "root", code: "Root()" }, [drop], 1, [0]);
  expect([placed?.code, placed?.kids]).toEqual(["Call2()", "lazy"]);
  expect(kidsOf(places.expand(placed?.id ?? "")).map((k) => k.name)).toEqual([
    "From cards",
    "From stamps",
  ]);
});
