// The pieces that outlive feature 010 (research R17), fixed before they move: the steps `makeSteps` makes of three
// blocks of the invented game, the names read from the game's text tables and the class marks of a talent's name. The
// cases never change when the files move; only the import paths do (T005, T006).
import { createHash } from "node:crypto";
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "./fixtures/fake-mosaic.ts";
import { readGameNames } from "./game-names.ts";
import { bootRecorder, TREE_LIMITS } from "./tree-record.ts";
import { clean, isNameText } from "./names/name-text.ts";
import { nameOf, useGameNames } from "./names/names.ts";
import { NAME_RECIPES } from "./names/names-table.ts";
import type { NameRecipe } from "./names/names-table.ts";
import { makeSteps } from "./recorded/steps.ts";
import type { Expr } from "./recorded/steps.ts";
import { tableText, useGameTables } from "./names/table-names.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

/** An expression as data: its kind, the block it calls, the path it reads, the method it names or the number of the
 * code, and its parts in order. */
type Shape = string | [string, ...Shape[]];
function shape(e: Expr, blockOf: (id: number) => string): Shape {
  const s = (x: Expr) => shape(x, blockOf);
  switch (e.t) {
    case "call":
      return `call ${blockOf(e.id)}`;
    case "read":
      return `read ${e.p}`;
    case "num":
      return `num ${String(e.v)}`;
    case "fn":
      return [`fn ${e.name ?? "?"}`, ...e.args.map(s)];
    case "op":
      return [`op ${e.o}`, s(e.l), s(e.r)];
    case "def":
      return ["def", s(e.e)];
    case "not":
      return ["not", s(e.a)];
    default:
      return e.t;
  }
}

/** The steps of the root call of `block`: each step's value and its expression's shape. */
function stepsOf(block: string) {
  const rec = recorder.record(mosaicOf(), [[block, [0, 0, 0]]], {
    recompute: [],
    builders: [],
  });
  const top = rec.nodes[rec.nodes[rec.root ?? -1]?.c[0] ?? -1];
  if (!top) throw new Error("no root call");
  const blockOf = (id: number) => rec.nodes[id]?.b ?? "?";
  return makeSteps(rec, recorder.ops)
    .of(top.id)
    .steps.map((s) => ({ v: s.v, e: shape(s.e, blockOf) }));
}

test("a chain block's steps: each write to the accumulator, the one before it as a value with no source", () => {
  expect(stepsOf("TreeChain")).toEqual([
    {
      v: 37,
      e: [
        "op +",
        ["op +", "call TreeReads", "read TreeBase"],
        "read TreeLevel",
      ],
    },
    { v: 39, e: ["op +", "read DNSM.TreeChain.v", "num 2"] },
    { v: 234, e: ["op *", "val", "call TreeLoop"] },
    { v: 234.5, e: ["op +", "val", "num 0.5"] },
    {
      v: 429.135,
      e: [
        "op *",
        "val",
        [
          "op +",
          "num 1",
          ["op /", ["op +", "read TreeStats.a", "read TreeCapped"], "num 100"],
        ],
      ],
    },
    {
      v: 2574.81,
      e: ["op *", ["op *", "val", "read TreeTwins[0]"], "read TreeList[1]"],
    },
  ]);
});

test("an expression block's steps: one step, the operators over its calls and its reads", () => {
  expect(stepsOf("TreeSources")).toEqual([
    {
      v: 52,
      e: ["op +", ["op *", "call TreeReads", "call TreeLoop"], "read TreeBase"],
    },
  ]);
});

test("a loop block's steps: the last turn's write, then the step after the loop", () => {
  expect(stepsOf("TreeScaleLoop")).toEqual([
    {
      v: 10,
      e: [
        "op +",
        "read DNSM.TreeScale.v",
        ["fn round", ["op *", "val", "num 1.5"]],
      ],
    },
    {
      v: 40,
      e: ["op *", "val", ["op +", "read TreeBase", "read TreeOwned"]],
    },
  ]);
});

// Five keys of the names table, each named here from a cell of the invented game's list.
const KEYS = NAME_RECIPES.slice(0, 5).map((r) => r.key);
const LIST = JSON.stringify([["FIRST_INVENTED_II", 7], ["second|half"]]);
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const part = (index: number[], transform: string) => ({
  table: "CustomLists.ListNames",
  index,
  field: null,
  transform,
});
const RECIPES: NameRecipe[] = [
  { key: KEYS[0] ?? "", template: null, parts: [part([0, 0], "clean")] },
  { key: KEYS[1] ?? "", template: "{0} (x)", parts: [part([0, 0], "raw")] },
  {
    key: KEYS[2] ?? "",
    template: null,
    parts: [part([1, 0], "clean(split '|' [1])")],
  },
  {
    key: KEYS[3] ?? "",
    template: null,
    parts: [part([1, 0], "clean-keep-case")],
  },
  { key: KEYS[4] ?? "", template: null, parts: [part([0, 1], "clean")] },
];

test("five names read from the game's text table", () => {
  const read = readGameNames(
    recorder.context,
    TREE_LIMITS.startMs,
    RECIPES,
    new Map([["CustomLists.ListNames", sha(LIST)]]),
    () => true,
  );
  useGameNames(read.names);
  expect(KEYS.map(nameOf)).toEqual([
    "First Invented II",
    "FIRST INVENTED II (x)",
    "half",
    "second half",
    null, // a number's cell names nothing
  ]);
  // the table a table text may read is kept in the bench's form
  expect([...read.tables]).toEqual([
    ["CustomLists.ListNames", JSON.parse(LIST)],
  ]);
  useGameNames(new Map());
});

test("a table text over the game's checked table", () => {
  useGameTables(
    new Map([
      [
        "CustomLists.StarSigns",
        [
          ["THE_INVENTED_SIGN", "+{%_INVENTED_BONUS"],
          ["Second_Sign ~R", ""],
        ],
      ],
    ]),
  );
  expect([
    tableText("sign", 0),
    tableText("signBonus", 0),
    tableText("sign", 1),
    tableText("signBonus", 1),
    tableText("sign", 2),
  ]).toEqual([
    "The Invented Sign",
    "Invented Bonus",
    "Second Sign (Warrior)",
    null, // an empty cell
    null, // a row the table does not have
  ]);
  useGameTables(new Map());
});

test("a talent's class marks become the class's name", () => {
  expect(
    ["Power Strike ~R", "AIMED SHOT ~G", "Mana Bolt ~p", "No Class", "~X"].map(
      clean,
    ),
  ).toEqual([
    "Power Strike (Warrior)",
    "Aimed Shot (Archer)",
    "Mana Bolt (Mage)",
    "No Class",
    "~X",
  ]);
  expect(isNameText("Power Strike (Warrior)")).toBe(true);
});
