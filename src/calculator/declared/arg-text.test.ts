// A text argument of a call (spec 010, FR-003): recorder.js keeps a call's text argument cut to a limit, and the
// blueprint's check on load accepts one only up to that same limit, or a term with a longer text would never meet its
// recorded node. recorder.js runs as text inside the game and cannot import it: one test pins the limit on both sides
// (CODING_STANDARDS, "A forced copy of a shared literal is pinned both ways").
import { beforeAll, expect, test } from "vitest";
import { GAME, mosaicOf, PAK } from "../fixtures/fake-mosaic.ts";
import { bootRecorder } from "../tree-record.ts";
import { parseBlueprint } from "./blueprint.ts";
import { ARG_TEXT_MAX } from "./refs.ts";

let recorder: ReturnType<typeof bootRecorder>;
beforeAll(() => {
  recorder = bootRecorder(GAME, PAK, { startMs: 5_000, numberMs: 500 });
});

test("the recorder cuts a text argument to the limit the blueprint accepts", () => {
  const rec = recorder.record(
    mosaicOf(),
    [["TreeDeclChain", ["x".repeat(ARG_TEXT_MAX + 1), 0, 0]]],
    { recompute: [], builders: [] },
  );
  const call = rec.nodes.find((n) => n.b === "TreeDeclChain");
  expect(call?.a[0]).toBe("x".repeat(ARG_TEXT_MAX));
  const load = (n: number) =>
    parseBlueprint(
      {
        id: "invented-number",
        root: {
          name: "Invented",
          ref: { call: "Invented", args: ["x".repeat(n)] },
        },
      },
      { fileId: "invented-number", systemIds: new Set() },
    ).ok;
  expect([load(ARG_TEXT_MAX), load(ARG_TEXT_MAX + 1)]).toEqual([true, false]);
});
