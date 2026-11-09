// The mosaic after the first lap: what is due, the actions' confirmation and the character's subkeys (data-model.md, R7,
// R8). Every value and character name here is made up (FR-021).
import { expect, test } from "vitest";
import { NONE, piece, setup, WHOLE } from "./state-store-fixture.ts";
import type { Piece } from "./state-store-fixture.ts";

test("after the first lap, a changed fast piece outside the actions is due in that same slice", () => {
  const h = setup();
  h.add([]);
  h.add([piece("Cards", 1)], WHOLE);
  h.add([piece("Cards", 2)], WHOLE);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ Cards: 2 });
  h.add([piece("Cards", 2)], { fast: 2, all: 1 }); // a rise, nothing changed
  expect(h.texts).toHaveLength(2);
});

test("a slow piece that changed is not due alone", () => {
  const h = setup();
  h.add([]);
  h.add([piece("ChestMap", 1)], WHOLE);
  h.add([piece("ChestMap", 2)], { fast: 2, all: 2 });
  expect(h.texts).toHaveLength(1);
});

test("a whole character that changed is not due alone", () => {
  const h = setup();
  const own = (value: number): Piece => ({
    path: ["PlayerDATABASE", "Aria"],
    value,
  });
  h.add([]);
  h.add([own(1)], WHOLE);
  h.add([own(2)], { fast: 2, all: 1 });
  expect(h.texts).toHaveLength(1);
});

test("_vars that changed are not due alone, and go with the next calculation", () => {
  const h = setup();
  h.add([]);
  h.add([piece("_vars", { TomePct: 1 }), piece("Cards", 1)], WHOLE);
  h.add([piece("_vars", { TomePct: 2 })], { fast: 2, all: 2 });
  expect(h.texts).toHaveLength(1);
  h.add([piece("Cards", 2)], { fast: 2, all: 2 });
  expect(h.dues[1]?.vars).toEqual({ TomePct: 2 });
});

const worn = (value: unknown) => piece("EquipmentMap", value);

test("a changed actions piece is due only when its next read comes equal", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1)], WHOLE);
  h.add([worn(2)], WHOLE);
  expect(h.texts).toHaveLength(1);
  h.add([worn(2)], WHOLE);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ EquipmentMap: 2 });
  h.add([worn(2)], WHOLE);
  expect(h.texts).toHaveLength(2);
});

test("a different next read of an actions piece waits again", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1)], WHOLE);
  h.add([worn(2)], WHOLE);
  h.add([worn(3)], WHOLE);
  expect(h.texts).toHaveLength(1);
  h.add([worn(3)], WHOLE);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ EquipmentMap: 3 });
});

test("an actions piece changing just as another settles keeps the calculation waiting", () => {
  const h = setup();
  const bonus = (value: unknown): Piece => ({
    path: ["DNSM", "SetBonusTOTz"],
    value,
  });
  h.add([]);
  h.add([worn(1), bonus(1)], WHOLE);
  h.add([worn(2), bonus(1)], WHOLE);
  h.add([worn(2), bonus(2)], WHOLE);
  expect(h.texts).toHaveLength(1);
  h.add([worn(2), bonus(2)], WHOLE);
  expect(h.texts).toHaveLength(2);
});

test("a fast piece that changes during a confirmation waits for it, in one calculation", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1), piece("Cards", 1)], WHOLE);
  h.add([worn(2)], WHOLE);
  h.add([piece("Cards", 2)], WHOLE);
  expect(h.texts).toHaveLength(1);
  h.add([worn(2)], WHOLE);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ EquipmentMap: 2, Cards: 2 });
});

test("an actions piece that changes at every read is due at the third read", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1)], WHOLE);
  h.add([worn(2)], WHOLE);
  h.add([worn(3)], WHOLE);
  expect(h.texts).toHaveLength(1);
  h.add([worn(4)], WHOLE);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ EquipmentMap: 4 });
});

test("a confirmation at the second read asks for one calculation and counts no read", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1)], WHOLE);
  h.add([worn(2)], WHOLE);
  h.add([worn(3)], WHOLE);
  h.add([worn(3)], WHOLE); // confirmed: the two reads before it no longer count
  expect(h.texts).toHaveLength(2);
  h.add([worn(3)], WHOLE);
  h.add([worn(4)], WHOLE);
  h.add([worn(5)], WHOLE);
  expect(h.texts).toHaveLength(2);
});

test("after the limit the count of reads starts over", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1)], WHOLE);
  for (const value of [2, 3, 4]) h.add([worn(value)], WHOLE);
  expect(h.texts).toHaveLength(2);
  for (const value of [5, 6]) h.add([worn(value)], WHOLE);
  expect(h.texts).toHaveLength(2);
  h.add([worn(7)], WHOLE);
  expect(h.texts).toHaveLength(3);
});

test("what the limit calculated is not calculated again when the piece settles", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1)], WHOLE);
  for (const value of [2, 3, 4, 4]) h.add([worn(value)], WHOLE);
  expect(h.texts).toHaveLength(2);
});

test("a read of another slice during a confirmation does not count for the limit", () => {
  const h = setup();
  h.add([]);
  h.add([worn(1), piece("Cards", 1)], WHOLE);
  h.add([worn(2)], WHOLE);
  h.add([piece("Cards", 2)], WHOLE);
  h.add([piece("Cards", 3)], WHOLE);
  h.add([worn(3)], WHOLE);
  expect(h.texts).toHaveLength(1);
});

test("after a map change the limit waits for cycles.fast to rise", () => {
  const h = setup();
  const map6 = { char: "Aria", map: 6 };
  h.add([]);
  h.add([worn(1)], WHOLE);
  for (const value of [2, 3, 4])
    h.add([worn(value)], { fast: 0, all: 1 }, map6);
  expect(h.texts).toHaveLength(1);
  h.add([], { fast: 1, all: 1 }, map6);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ EquipmentMap: 4 });
});

test("a confirmation during a map change starts the count of reads over", () => {
  const h = setup();
  const held = { fast: 0, all: 1 };
  const map6 = { char: "Aria", map: 6 };
  h.add([]);
  h.add([worn(1)], WHOLE);
  for (const value of [2, 3, 3, 4]) h.add([worn(value)], held, map6);
  h.add([], { fast: 1, all: 1 }, map6);
  expect(h.texts).toHaveLength(1);
});

test("after a map change nothing is due until cycles.fast rises", () => {
  const h = setup();
  const map6 = { char: "Aria", map: 6 };
  h.add([]);
  h.add([piece("Cards", 1)], WHOLE);
  h.add([piece("Cards", 2)], { fast: 0, all: 1 }, map6);
  h.add([piece("Cards", 3)], { fast: 0, all: 1 }, map6);
  expect(h.texts).toHaveLength(1);
  h.add([], { fast: 1, all: 1 }, map6);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ Cards: 3 });
  h.add([piece("Cards", 4)], { fast: 1, all: 1 }, map6);
  expect(h.texts).toHaveLength(3);
});

test("a character change wipes the mosaic and starts the first lap again", () => {
  const h = setup();
  const bruno = { char: "Bruno", map: 5 };
  h.add([]);
  h.add([piece("Cards", 1)], WHOLE);
  h.add([piece("Cards", 2)], NONE, bruno);
  h.add([piece("Cards", 3)], NONE, bruno);
  expect(h.texts).toHaveLength(1);
  h.add([], WHOLE, bruno);
  expect(h.texts).toHaveLength(2);
  expect(h.dues[1]?.attrs).toEqual({ Cards: 3 });
});

const skill = (value: unknown, char = "Aria"): Piece => ({
  path: ["PlayerDATABASE", char, "SkillLevels"],
  value,
});
const aria = (m: Record<string, unknown>): Piece => ({
  path: ["PlayerDATABASE", "Aria"],
  value: { $m: m, $c: "InventedMap" },
});
const ariaIn = (m: Record<string, unknown>) => ({
  PlayerDATABASE: { $m: { Aria: { $m: m, $c: "InventedMap" } } },
});
const onlySkill = {
  PlayerDATABASE: { $m: { Aria: { $m: { SkillLevels: 7 } } } },
};

test("a subkey enters the mosaic under its character, and its change is due", () => {
  const h = setup();
  h.add([]);
  h.add([aria({ Level: 3 })], WHOLE);
  h.add([skill(7)], WHOLE);
  expect(h.dues[1]?.attrs).toEqual(ariaIn({ Level: 3, SkillLevels: 7 }));
});

test("a subkey with no whole character yet still enters the mosaic", () => {
  const h = setup();
  h.add([]);
  h.add([skill(7)], WHOLE);
  expect(h.dues[0]?.attrs).toEqual(onlySkill);
});

test.each([[null], [{ $x: 1 }]])(
  "a subkey over a character read as %j gives a character with only it",
  (value) => {
    const h = setup();
    h.add([]);
    h.add([{ path: ["PlayerDATABASE", "Aria"], value }, skill(7)], WHOLE);
    expect(h.dues[0]?.attrs).toEqual(onlySkill);
  },
);

test("a whole character drops its own stored subkeys, and the newest read wins", () => {
  const h = setup();
  h.add([]);
  h.add([skill(1), skill(5, "Bruno")]);
  h.add([aria({ SkillLevels: 9 }), piece("Cards", 1)], WHOLE);
  expect(h.dues[0]?.attrs.PlayerDATABASE).toEqual({
    $m: {
      Aria: { $m: { SkillLevels: 9 }, $c: "InventedMap" },
      Bruno: { $m: { SkillLevels: 5 } },
    },
  });
  h.add([skill(2)], WHOLE);
  expect(h.dues[1]?.attrs).toMatchObject(ariaIn({ SkillLevels: 2 }));
  h.add([aria({ SkillLevels: 3 })], WHOLE);
  h.add([piece("Cards", 2)], WHOLE);
  expect(h.dues[2]?.attrs).toMatchObject(ariaIn({ SkillLevels: 3 }));
});

test("building the mosaic leaves the stored character as it was read", () => {
  const h = setup();
  const value = { $m: { SkillLevels: 9 } };
  h.add([]);
  h.add([{ path: ["PlayerDATABASE", "Aria"], value }, skill(7)], WHOLE);
  h.add([skill(8)], WHOLE);
  expect(value).toEqual({ $m: { SkillLevels: 9 } });
});
