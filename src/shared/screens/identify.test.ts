// Which screen a reading is, by the catalog's rules. Every rule here is invented.
import { expect, test } from "vitest";
import { identifyScreen, READ_NULLS } from "../index.ts";
import type { Reading, ScreenCatalog, ScreenRule } from "../index.ts";

const reading = (over: Partial<Reading> = {}): Reading => ({
  t: 1,
  map: 0,
  menu: 0,
  menu2: 0,
  menu2tab: 0,
  skillTab: 0,
  char: "Tester",
  afk: null,
  codexTab: null,
  ...READ_NULLS,
  ...over,
});
const rule = (
  when: ScreenRule["when"],
  name: string,
  extra: Pick<ScreenRule, "tabs"> = {},
): ScreenRule => ({ when, name, proof: "foto:0001", ...extra });
const catalog = (
  screens: ScreenRule[],
  overlays: ScreenRule[] = [],
): ScreenCatalog => ({ overlays, screens, unprovenWindows: [] });

test("the one rule that matches names the screen", () => {
  const c = catalog([rule({ menu2: 5 }, "Hall"), rule({ menu2: 6 }, "Attic")]);
  expect(identifyScreen(reading({ menu2: 6 }), c)).toBe("Attic");
});

test("every condition of a rule has to match", () => {
  const c = catalog([rule({ menu2: 5, menu: 1 }, "Hall")]);
  expect(identifyScreen(reading({ menu2: 5, menu: 2 }), c)).toBe(
    "Unknown screen",
  );
});

test.each([
  ["broad rule first", ["broad", "narrow"] as const],
  ["narrow rule first", ["narrow", "broad"] as const],
])("the rule with more conditions wins: %s", (_, order) => {
  const rules = {
    broad: rule({ menu2: 5 }, "Hall"),
    narrow: rule({ menu2: 5, menu2tab: 2 }, "Hall › Stairs"),
  };
  const c = catalog(order.map((k) => rules[k]));
  expect(identifyScreen(reading({ menu2: 5, menu2tab: 2 }), c)).toBe(
    "Hall › Stairs",
  );
});

test("two rules with the same count of conditions are a tie", () => {
  const c = catalog([rule({ menu2: 5 }, "Hall"), rule({ menu: 1 }, "Attic")]);
  expect(identifyScreen(reading({ menu2: 5, menu: 1 }), c)).toBe(
    "Unknown screen",
  );
});

test("a tie among the most specific ignores a less specific rule", () => {
  const c = catalog([
    rule({ menu2: 5 }, "Hall"),
    rule({ menu2: 5, menu: 1 }, "Attic"),
    rule({ menu2: 5, menu2tab: 2 }, "Cellar"),
  ]);
  expect(identifyScreen(reading({ menu2: 5, menu: 1, menu2tab: 2 }), c)).toBe(
    "Unknown screen",
  );
});

test("an overlay beats a screen with more conditions", () => {
  const c = catalog(
    [rule({ menu2: 5, menu2tab: 2, menu: 1 }, "Hall")],
    [rule({ ol18: 1 }, "Curtain")],
  );
  expect(
    identifyScreen(reading({ menu2: 5, menu2tab: 2, menu: 1, ol18: 1 }), c),
  ).toBe("Curtain");
});

test("a tie between overlays does not fall through to the screens", () => {
  const c = catalog(
    [rule({ menu2: 5 }, "Hall")],
    [rule({ ol18: 1 }, "Curtain"), rule({ ol19: 1 }, "Veil")],
  );
  expect(identifyScreen(reading({ menu2: 5, ol18: 1, ol19: 1 }), c)).toBe(
    "Unknown screen",
  );
});

test("no rule matching is an unknown screen", () => {
  expect(identifyScreen(reading(), catalog([]))).toBe("Unknown screen");
  expect(
    identifyScreen(
      reading({ menu2: 9 }),
      catalog([rule({ menu2: 5 }, "Hall", { tabs: true })]),
    ),
  ).toBe("Unknown screen");
});

test("a winning rule with tabs says the tab is unknown", () => {
  const c = catalog([rule({ menu2: 5 }, "Hall", { tabs: true })]);
  expect(identifyScreen(reading({ menu2: 5, menu2tab: 9 }), c)).toBe(
    "Hall › Unknown tab",
  );
});

test("a tab rule beats its window's rule with tabs", () => {
  const c = catalog([
    rule({ menu2: 5 }, "Hall", { tabs: true }),
    rule({ menu2: 5, menu2tab: 2 }, "Hall › Stairs"),
  ]);
  expect(identifyScreen(reading({ menu2: 5, menu2tab: 2 }), c)).toBe(
    "Hall › Stairs",
  );
});

test("a tab value left from another window never shows", () => {
  const c = catalog([
    rule({ menu2: 5 }, "Hall", { tabs: true }),
    rule({ menu2: 5, menu2tab: 2 }, "Hall › Stairs"),
    rule({ menu2: 6 }, "Attic", { tabs: true }),
  ]);
  expect(identifyScreen(reading({ menu2: 6, menu2tab: 2 }), c)).toBe(
    "Attic › Unknown tab",
  );
});

test("a condition on a behavior reads the behaviors", () => {
  const key = "H27._GenINFO[124]";
  const c = catalog([
    rule({ menu2: 5 }, "Hall", { tabs: true }),
    rule({ menu2: 5, [key]: 3 }, "Hall › Stairs"),
  ]);
  expect(
    identifyScreen(reading({ menu2: 5, behaviors: { [key]: 3 } }), c),
  ).toBe("Hall › Stairs");
});

test.each([0, -1, "w1"])(
  "a condition on an absent behavior never matches: %s",
  (want) => {
    const c = catalog([rule({ "H3._GenINFO[8]": want }, "Hall")]);
    expect(identifyScreen(reading(), c)).toBe("Unknown screen");
  },
);

test.each<[string, number | string, Reading["behaviors"][string], boolean]>([
  ["zero", 0, 0, true],
  ["minus one", -1, -1, true],
  ["a fraction", 0.2, 0.2, true],
  ["a text", "w1", "w1", true],
  ["zero against a fraction", 0, 0.2, false],
  ["minus one against zero", -1, 0, false],
  ["a number against its text", 1, "1", false],
  ["a text against its number", "1", 1, false],
  ["one against true", 1, true, false],
  ["zero against false", 0, false, false],
  ["a text in another case", "w1", "W1", false],
])("values compare by equality: %s", (_, want, value, same) => {
  const c = catalog([rule({ "H1.x": want }, "Hall")]);
  expect(identifyScreen(reading({ behaviors: { "H1.x": value } }), c)).toBe(
    same ? "Hall" : "Unknown screen",
  );
});

test("a field of the reading compares a fraction and a text by equality", () => {
  const c = catalog([rule({ menu: 0.2, scene: "w1" }, "Hall")]);
  expect(identifyScreen(reading({ menu: 0.2, scene: "w1" }), c)).toBe("Hall");
  expect(identifyScreen(reading({ menu: 0.1, scene: "w1" }), c)).toBe(
    "Unknown screen",
  );
});

test.each<[string, ScreenRule["when"], Partial<Reading>]>([
  ["a number field against zero", { hole: 0 }, { hole: null }],
  ["a text field against an empty text", { scene: "" }, { scene: null }],
  ["a behavior against zero", { "H1.x": 0 }, { behaviors: { "H1.x": null } }],
])("null in the reading never matches: %s", (_, when, over) => {
  expect(identifyScreen(reading(over), catalog([rule(when, "Hall")]))).toBe(
    "Unknown screen",
  );
});
