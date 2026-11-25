// The choice among members (spec 010, T212; research R5; data-model "Escolha entre personagens"): the cache is the best
// of the members, and the descent goes on in the chosen one, by the turn that wrote it. The invented game's
// TreeAuthorBestMe keeps the best of TreeList's members, with a factor only when the best one is TreeMe, as the game's
// TalentCalc(-3) gives the talent 144 only when the best family bonus is the active character's.
import { expect, test } from "vitest";
import { activeAs, mosaicOf } from "../fixtures/fake-mosaic.ts";
import type { Blueprint, BlueprintNode } from "./blueprint.ts";
import { inventedRecorder } from "./lock-fixture.ts";
import { lockMessage } from "./lock.ts";
import { lockNumber } from "./real-trees-check.ts";
import type { RecordFn } from "./real-trees-check.ts";

const leaf = (key: string, read: string): BlueprintNode => ({
  key,
  name: key,
  ref: { read },
  leaf: "level",
});
const call = (
  key: string,
  ref: { call: string; args: (string | number)[] },
  children: BlueprintNode[],
): BlueprintNode => ({ key, name: key, ref, children });
const blueprint: Blueprint = {
  id: "invented-choice",
  root: { name: "Invented", ref: { call: "TreeAuthorRead", args: [0, 0, 0] } },
  pools: [
    {
      kind: "additive",
      groups: [
        {
          system: "cards",
          sources: [
            {
              key: "cache",
              name: "cache",
              ref: { read: "DNSM.TreeAuthor.v" },
              children: [
                call("author", { call: "TreeAuthorBestMe", args: [] }, [
                  call("item", { call: "TreeTurnItem", args: [1] }, [
                    leaf("list", "TreeList[1]"),
                  ]),
                  call("factor", { call: "TreeWriteCall", args: [] }, [
                    leaf("base", "TreeBase"),
                  ]),
                ]),
              ],
            },
          ],
        },
        { system: "stamps", sources: [leaf("capped", "TreeCapped")] },
      ],
    },
  ],
};

/** One run per TreeMe, the running game's cache as each run's best: 6 × 1.08 when TreeMe is the best member, else 6. */
function lockMes(mes: readonly number[]) {
  const runs = mes.map(() => ({ character: 0, characterClass: 3 }));
  let i = 0;
  const record: RecordFn = (_mosaic, _scene, roots) => {
    const me = mes[i++] ?? 0;
    const v = me === 1 ? 6 * 1.08 : 6;
    return inventedRecorder().record(
      mosaicOf({
        TreeList: [1, 3, 2],
        TreeMe: me,
        DNSM: { $m: { ...activeAs(0).DNSM.$m, TreeAuthor: { $m: { v } } } },
      }),
      roots,
      {
        recompute: [],
        builders: [
          {
            cache: "TreeAuthor",
            run: { block: "TreeAuthorBestMe", args: [] },
          },
        ],
      },
    );
  };
  return lockNumber(
    record,
    inventedRecorder().ops,
    blueprint,
    mosaicOf(),
    runs,
  ).lock.errors.map(lockMessage);
}

test("the chosen member's descent: a part only the run whose best is TreeMe has is no failure of the other run (T212)", () => {
  expect(lockMes([1, 0])).toEqual([]);
});

test("a part no run's chosen member has is still refused when the runs join (T212)", () => {
  expect(lockMes([0, 0])).toEqual([
    "filho fora da conta: invented-choice/0/cards/cache/author/factor",
  ]);
});
