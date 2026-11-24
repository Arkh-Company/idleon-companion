// What the piece lock's tests share (spec 010, T170, T171): the invented piece, its state over the invented game
// (fake-game.js, TreeSign*) and an invented blueprint whose first source is a line that calls it.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseBlueprint } from "./blueprint.ts";

export type Raw = Record<string, unknown>;
export const SIGNS = JSON.parse(
  readFileSync(
    join(
      import.meta.dirname,
      "..",
      "fixtures",
      "blueprints",
      "invented-signs.piece.json",
    ),
    "utf8",
  ),
) as Raw & { children: (Raw & { children: Raw[] })[] };
export const state = (list: number[]) => ({
  TreeSigns: list,
  TreeSignBonus: { $m: { Drop: [0, 5, 10, 20] } },
  TreeSignMulti: 2,
});

export const CALL = { ref: { call: "TreeSigns", args: ["Drop"] } };
export const LINE = "invented-signs-number/0/cards/signs";
/** An invented blueprint whose first source is a line `line` that calls the piece, over `root`. */
export function blueprint(
  line: Raw,
  piece: unknown = SIGNS,
  root = "TreeSignsRoot",
) {
  const out = parseBlueprint(
    {
      id: "invented-signs-number",
      root: { name: "Invented", ref: { call: root, args: [0, 0, 0] } },
      pools: [
        {
          kind: "additive",
          groups: [
            {
              system: "cards",
              sources: [
                {
                  key: "signs",
                  name: "Invented Signs",
                  ...line,
                  piece: { name: "invented-signs", args: { stat: "Drop" } },
                },
              ],
            },
            {
              system: "stamps",
              sources: [
                {
                  key: "capped",
                  name: "Invented Capped",
                  ref: { read: "TreeCapped" },
                  leaf: "rawBonus",
                },
              ],
            },
          ],
        },
      ],
    },
    {
      fileId: "invented-signs-number",
      systemIds: new Set(["cards", "stamps"]),
      pieces: new Map([["invented-signs", piece]]),
    },
  );
  if (!out.ok) throw new Error(out.reason);
  return out.blueprint;
}
