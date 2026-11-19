// The name of a loop turn's part (pieces.cjs entryRows arenaTurn, turnName with names-sailing.cjs TURN_NAMES, and the
// part's own name from its rows), over turns' reads written by hand. A name from the names table is taken from the
// table itself, so this file holds no game text.
import { expect, test } from "vitest";
import { checkTree } from "../../main/tree-check.ts";
import type { TurnRead } from "./entries.ts";
import { nameOf, NAMES_BY_LABEL } from "./names.ts";
import { STATIC_NAMES } from "./names-table.ts";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { fixed, read } from "./tree-fixture.ts";
import {
  arenaTurn,
  NO_NAME,
  otherReads,
  ownName,
  sharedName,
  turnName,
  withoutRepeats,
} from "./turn-names.ts";

const passes = (name: string) =>
  checkTree(
    { id: "x", ...row({ pieceKey: null, value: 1, code: null, name }) },
    1,
  ) !== null;

test.each<[string, TurnRead[], string, string | typeof NO_NAME | null]>([
  ["a boat's level", [["Boats[2][3]", 7]], "DNSM.X", "Boat 3"],
  ["a boat's other level", [["Boats[0][5]", 7]], "DNSM.X", "Boat 1"],
  [
    "a boat's other field in the nightmariner total",
    [["Boats[4][1]", 7]],
    "DNSM.NghMrTOT",
    "Boat 5: levels above 600",
  ],
  ["a boat's other field elsewhere", [["Boats[4][1]", 7]], "DNSM.X", null],
  [
    "the star sign the turn found",
    [
      ["DNSM.StarSignsDL contains 9", true],
      ["DNSM.StarSignsDL contains 4", false],
      ["DNSM.StarSignsDL[3]", 12],
    ],
    "DNSM.X",
    "Star sign (sign 9)",
  ],
  [
    "the last star sign the turn read",
    [
      ["DNSM.StarSignsDL[3]", 12],
      ["DNSM.StarSignsDL[4]", 15],
    ],
    "DNSM.X",
    "Star sign (sign 15)",
  ],
  [
    "an endless win",
    [["CustomLists.SummonEnemies[10][6]", 1]],
    "DNSM.X",
    "Endless win, slot 7 of the 40-win cycle",
  ],
  // family 2 (audit of 19/11): with no table text, never the artifact's or the colour's index
  ["an artifact", [["Sailing[3][12]", 2]], "DNSM.X", NO_NAME],
  [
    "a worn item's slot",
    [["EquipmentMap[1][4].UQ2val", 3]],
    "DNSM.X",
    "Worn item (group 1 – slot 4) bonus value 2",
  ],
  [
    "a worn item read by its definition",
    [
      ["DNSM.TotalStatsDM.UQ1val", 3],
      ["DummyNumbersStatManager.TotalStatsDRI", 0],
      ["DummyNumbersStatManager.TotalStatsDRI2", 5],
    ],
    "DNSM.X",
    "Worn item (group 0 – slot 5) bonus value 1",
  ],
  [
    "a worn item's definition with no slot",
    [["DNSM.TotalStatsDM.UQ1val", 3]],
    "DNSM.X",
    null,
  ],
  [
    "a worn item's definition with its group and no slot",
    [
      ["DNSM.TotalStatsDM.UQ1val", 3],
      ["DummyNumbersStatManager.TotalStatsDRI", 0],
    ],
    "DNSM.X",
    null,
  ],
  [
    "a boat and a colour: the first rule decides",
    [
      ["Spelunk[9][3]", 1],
      ["Boats[2][3]", 7],
    ],
    "DNSM.X",
    "Boat 3",
  ],
  ["a colour", [["Spelunk[9][3]", 1]], "DNSM.X", NO_NAME],
  [
    "the last table row's text",
    [
      ["CustomLists.Invented[2][0]", "FIRST_ROW"],
      ["CustomLists.Invented[3][0]", "SECOND_ROW"],
    ],
    "DNSM.X",
    "Second Row",
  ],
  [
    "a row's text that is code",
    [["CustomLists.Invented[2][0]", "a; b"]],
    "DNSM.X",
    NO_NAME,
  ],
  [
    "a row's text with a keyword before a bracket",
    [["CustomLists.Invented[2][0]", "Grants if (owned)"]],
    "DNSM.X",
    NO_NAME,
  ],
  [
    "a row's text too long",
    [["CustomLists.Invented[2][0]", "a".repeat(201)]],
    "DNSM.X",
    NO_NAME,
  ],
  [
    "a row's text with no letter",
    [["CustomLists.Invented[2][0]", "12"]],
    "DNSM.X",
    null,
  ],
  ["a row's number", [["CustomLists.Invented[2][0]", 12]], "DNSM.X", null],
  [
    "a text of another cell",
    [["CustomLists.Invented[2][1]", "Text"]],
    "DNSM.X",
    null,
  ],
  ["a read that says nothing", [["Stats.a", 1]], "DNSM.X", null],
])("the turn of %s", (_name, reads, p, name) => {
  expect(turnName(reads, p)).toBe(name);
  if (typeof name === "string") expect(passes(name)).toBe(true);
});

test("[OPUS2-PATCH A] a turn of the arena loop is the threshold it reached", () => {
  const wave: TurnRead = ["CustomLists.RANDOlist[53][2]", "30"];
  const name = arenaTurn([["OptionsListAccount[89]", 41], wave]);
  expect(name).toBe("Best Pet Arena round ≥ 30 (arena bonus 3)");
  expect(passes(name ?? "")).toBe(true);
  expect(arenaTurn([wave])).toBeNull();
  expect(arenaTurn([["OptionsListAccount[89]", 41]])).toBeNull();
});

const NAMED =
  [...STATIC_NAMES.keys()].find(
    (k) =>
      !k.startsWith("DNSM.") &&
      !k.includes("(") &&
      !/ level$/i.test(nameOf(k) ?? ""),
  ) ?? "";
const LEVEL =
  [...STATIC_NAMES.keys()].find(
    (k) => !k.startsWith("DNSM.") && / level$/i.test(nameOf(k) ?? ""),
  ) ?? "";
const named = (code: string, v = 1): Row => ({
  node: row({ pieceKey: code, value: v, code }),
  open: null,
});
const none = () => false;

test("a part with no read of its own is named by the first of its rows with a proven name", () => {
  const earlier: Row = { ...read("Stats.e", 1), earlier: true };
  const rows = [
    read("Stats.q", 1),
    fixed("Fixed +2", 2),
    fixed("Base 5", 5),
    earlier,
    named(NAMED),
  ];
  expect(ownName(rows, none, [], new Set())).toBe(nameOf(NAMED));
  // a name every other part has too says nothing of this one
  expect(ownName(rows, (n) => n === nameOf(NAMED), [], new Set())).toBeNull();
  // a constant of the code with a name proven by its code is a name
  expect(
    ownName(
      [{ ...named(NAMED), node: { ...named(NAMED).node, leaf: "fixedValue" } }],
      none,
      [],
      new Set(),
    ),
  ).toBe(nameOf(NAMED));
});

test("else by a read only its turn made, with a name, no game cache, its level gone", () => {
  expect(LEVEL).not.toBe("");
  const reads: TurnRead[] = [
    ["Stats.q", 1],
    ["DNSM.X", 1],
    // a game cache with a name of its own is still no read of the turn's own
    [`DNSM.${NAMES_BY_LABEL[0]?.[0] ?? ""}`, 1],
    [NAMED, 1],
    [LEVEL, 2],
  ];
  expect(ownName([], none, reads, new Set([NAMED]))).toBe(
    (nameOf(LEVEL) ?? "").replace(/ level$/i, ""),
  );
  expect(ownName([], none, reads, new Set())).toBe(nameOf(NAMED));
  expect(ownName([], none, reads, new Set([NAMED, LEVEL]))).toBeNull();
});

test("a part's rows leave the one that only repeats the part: same name, same value, nothing under it", () => {
  const part = named(NAMED, 3).node;
  const same = named(NAMED, 3);
  const rows = [same, named(NAMED, 4), read("Stats.q", 3)];
  expect(withoutRepeats(rows, part, () => false)).toEqual(rows.slice(1));
  // a row that opens says more
  expect(withoutRepeats(rows, part, (r) => r === same)).toEqual(rows);
  // with no name, only the same code repeats the part
  const generic = read("Stats.p", 3).node;
  expect(withoutRepeats(rows, generic, () => false)).toEqual(rows);
  expect(withoutRepeats([read("Stats.p", 3)], generic, () => false)).toEqual(
    [],
  );
});

test("a name is shared when every part has it among its rows; the other turns' reads leave the turn's own", () => {
  const a = named(NAMED);
  const shared = sharedName([
    [a, read("Stats.q", 1)],
    [read("Stats.r", 2), a],
  ]);
  expect(shared(a.node.name)).toBe(true);
  expect(sharedName([[a], [read("Stats.r", 2)]])(a.node.name)).toBe(false);
  const turn = (...paths: string[]) => ({
    v: 1,
    s: [],
    k: [],
    r: paths.map((p): TurnRead => [p, 1]),
  });
  const [q1, q2, q3] = [turn("A", "B"), turn("B", "C"), turn("D")];
  expect([...otherReads([q1, q2, q3], q1)]).toEqual(["B", "C", "D"]);
});
