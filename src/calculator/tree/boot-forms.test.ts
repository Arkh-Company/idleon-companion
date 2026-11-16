// The two tables the game changes after its boot (N.js: NinjaInfo's rows 3, 9 and 10 rescaled by
// OptionsListAccount[231]; LabMainBonus grown by NinjaInfo[25..28] with an Emporium bonus): the boot checks them by
// their form at the boot, as the tree worker reads them, and the Lab's bonuses 14 to 17 are read where the boot has
// them. Invented tables; the hashes are the installed game's at 0e47e87b.
import { expect, test } from "vitest";
import { resolveNames } from "./names.ts";
import { NAME_RECIPES, partTable, TABLE_HASHES } from "./names-table.ts";
import type { NamePart } from "./names-table.ts";
import stateHashes from "./state-hashes.json" with { type: "json" };

const LAB =
  "PixelHelperActor[22].behaviors.getBehavior(ActorEvents_548)._GenINFO[92]";
const bonus = (name: string) => ["0", "0", "0", "0", "0", "0", name];
const ninja: unknown[] = new Array<unknown>(35);
for (const k of [25, 26, 27, 28])
  ninja[k] = bonus(`Emporium_Bonus_${String(k - 11)}`);
ninja[34] = Array.from({ length: 20 }, (_, i) => `Farm_Upgrade_${String(i)}`);
/** The boot's forms: the Lab's list has its first 14 bonuses only. */
const BOOT: Readonly<Record<string, unknown>> = {
  "CustomLists.LabMainBonus": Array.from({ length: 14 }, (_, k) =>
    bonus(`Lab_Bonus_${String(k)}`),
  ),
  "CustomLists.NinjaInfo": ninja,
};
const cell = (p: NamePart): string | null => {
  let v: unknown = BOOT[partTable(p)];
  for (const k of p.index)
    v = Array.isArray(v) ? (v as unknown[])[Number(k)] : undefined;
  return typeof v === "string" ? v : null;
};
const RECIPES = NAME_RECIPES.filter((r) =>
  r.parts.some((p) => /^CustomLists\.(LabMainBonus|NinjaInfo)$/.test(p.table)),
);

test("each recipe on the two tables names over their boot form", () => {
  const names = resolveNames(cell, (id) => id in BOOT, RECIPES);
  expect(names.get(`${LAB}[8]`)).toBe("Lab Bonus 8 connected");
  expect(names.get("DNSM.LabMFbonuses[13]")).toBe("Lab Bonus 13 (Lab)");
  // the bonuses the game adds to the Lab's list after the boot
  expect(names.get(`${LAB}[15]`)).toBe("Emporium Bonus 15 connected");
  expect(names.get("DNSM.LabMFbonuses[17]")).toBe("Emporium Bonus 17 (Lab)");
  expect(names.get("FarmRank[2][9]")).toBe("Farm Upgrade 9 rank level");
});

test("with NinjaInfo changed, its rows name nothing, the Lab's own still do", () => {
  const names = resolveNames(
    cell,
    (id) => id === "CustomLists.LabMainBonus",
    RECIPES,
  );
  expect(names.has(`${LAB}[15]`)).toBe(false);
  expect(names.has("FarmRank[2][9]")).toBe(false);
  expect(names.get(`${LAB}[8]`)).toBe("Lab Bonus 8 connected");
});

test("the boot checks both by the installed game's form at the boot", () => {
  const boot = new Map(
    stateHashes.hashes.map(([sha = "", id = ""]) => [id, sha]),
  );
  for (const id of ["CustomLists.LabMainBonus", "CustomLists.NinjaInfo"]) {
    expect(boot.get(id)).toMatch(/^[0-9a-f]{64}$/);
    expect(TABLE_HASHES.get(id)).toBe(boot.get(id));
  }
});
