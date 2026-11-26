// The character's index a root passes on by its parameter (r2 of parts P and Q; moved out of draft.test.ts, which keeps
// under 400 lines): the top call has no caller's code, so its marks are its recipe root's reference's, as the game's
// Divinity("DivPerHr_EXP", {character}, 0) passes its character below it.
import { expect, test } from "vitest";
import { draftBlueprint } from "./draft.ts";
import type { DraftBlueprint } from "./draft.ts";
import { recorded } from "./lock-fixture.ts";
import { lockBlueprint } from "./lock.ts";

const sourceAt = (d: DraftBlueprint, pool: number, group: number) => {
  const s = d.pools[pool]?.groups[group]?.sources[0];
  if (!s) throw new Error("no source");
  return s;
};

test("the character's index a root passes on by its parameter is {character} where the recipe's root has it, in the draft and the lock (r2 of P and Q)", () => {
  // TreeDeclPass(c) passes its c to TreeDeclOwn and TreeDeclRow, as the game's Divinity("DivPerHr_EXP", {character}, 0)
  const { rec, key, ops } = recorded("TreeDeclPass");
  const ref = { call: "TreeDeclPass", args: ["{character}", 0, 0] };
  const d = draftBlueprint("decl-pass", { name: "Pass", ref }, key, rec, ops);
  expect(sourceAt(d, 0, 1).ref).toEqual({
    call: "TreeDeclOwn",
    args: ["{character}"],
  });
  expect(sourceAt(d, 0, 2).ref).toEqual({
    call: "TreeDeclRow",
    args: ["{character}"],
  });
  const lock = (root: typeof ref) =>
    lockBlueprint({
      rec,
      key,
      ops,
      character: 0,
      characterClass: 3,
      blueprint: {
        id: "decl-pass",
        root: { name: "Pass", ref: root },
        pools: [
          {
            kind: "additive",
            groups: [
              {
                system: "luk-stats",
                sources: [
                  {
                    key: "row",
                    name: "Row",
                    ref: { call: "TreeDeclRow", args: ["{character}"] },
                    leaf: "level",
                  },
                ],
              },
            ],
          },
        ],
      },
    }).errors.map((e) => e.got);
  const notCharacter = "o argumento 1 de TreeDeclRow não vem do personagem";
  expect(lock(ref)).not.toContain(notCharacter);
  // a root that writes its number: the index below it is no character's
  expect(lock({ ...ref, args: [0, 0, 0] })).toContain(notCharacter);
});
