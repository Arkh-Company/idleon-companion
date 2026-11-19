// The level a curve uses has the name of what it is (audit family 1, the rest; family 5): "Bubble level" in a bubble,
// "Vial level" in a vial, by the source's kind (the cauldron the level is read from, else the source's cache), the
// same everywhere, never "Level the curve uses" nor a vial's level called a bubble's. Rows written by hand, with the
// recording's shapes; invented values.
import { expect, test } from "vitest";
import { row } from "./rows.ts";
import type { Row } from "./rows.ts";
import { check, fixed, kidsOf, placed } from "./tree-fixture.ts";

const level = (name: string, value: number, code: string | null): Row => ({
  node: row({ pieceKey: code, value, code, name, leaf: "level" }),
  open: null,
});
/** A curve "add" of 3 per level over `input`, at level 13. */
const curve = (input: Row): Row => {
  const code = 'ArbitraryCode5Inputs("add", 3, 0, 13, 0, 0)';
  return {
    node: row({ pieceKey: code, value: 39, code, name: "Curve: 3 × 13" }),
    open: null,
    group: [fixed("Per-level bonus of the curve", 3), input],
  };
};
/** A source of `code` whose level is the curve over `input`, opened. */
function source(
  code: string,
  input: Row,
  more: Row[] = [check("Invented source is Prisma = 0", false)],
) {
  const { rows, expand } = placed({ 0: [curve(input), ...more] }, [
    {
      node: row({
        pieceKey: code,
        value: 39,
        code,
        name: "Invented source",
        kids: "lazy",
      }),
      open: 0,
    },
  ]);
  return kidsOf(expand(rows[0]?.id ?? "")).map((k) => k.name);
}

test("a vial's level, read from the vials' cauldron, is the Vial level, not a bubble's", () => {
  const read = level("INVENTED vial level", 13, "CauldronInfo[4][16]");
  expect(source("DNSM.AlchVials.inventedA", read)).toContain("Vial level");
});

test("a bubble's level, read from a bubbles' cauldron, is the Bubble level", () => {
  const read = level("INVENTED bubble level", 13, "CauldronInfo[1][3]");
  expect(source("DNSM.AlchBubbles.inventedB", read)).toContain("Bubble level");
});

test("a curve's level with no read of its own is named by the source's kind, never Level the curve uses", () => {
  const vial = source(
    "DNSM.AlchVials.inventedC",
    level("Level the curve uses", 13, null),
  );
  const bubble = source(
    "DNSM.AlchBubbles.inventedD",
    level("Level the curve uses", 13, null),
  );
  expect([vial, bubble]).toEqual([
    expect.arrayContaining(["Vial level"]),
    expect.arrayContaining(["Bubble level"]),
  ]);
  expect([...vial, ...bubble]).not.toContain("Level the curve uses");
});
