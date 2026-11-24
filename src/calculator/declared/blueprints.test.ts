// Every blueprint of the calculator (spec 010, FR-001, FR-024a): one per `arvore` number of the catalog, in its lot's
// folder, none more, each loading in a stage. The catalog is read as a file: the calculator imports none of it.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vitest";
import type { BlueprintNode } from "./blueprint.ts";
import { BLUEPRINTS, loadBlueprints } from "./blueprints.ts";
import { notLeafOf } from "./not-leaves.ts";
import type { Ref } from "./refs.ts";
import { hasRawCharacterIndex, refKey } from "./refs.ts";
import { treeCatalog } from "./tree-catalog-fixture.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..");
const DIR = join(ROOT, "src", "calculator", "blueprints");
const catalog = treeCatalog();
const files = readdirSync(DIR, { recursive: true, encoding: "utf8" })
  .map((f) => f.replaceAll("\\", "/"))
  .filter((f) => f.endsWith(".blueprint.json"));

test("each tree number of the catalog has exactly one blueprint, in its lot's folder, and no file is extra", () => {
  expect(catalog).toHaveLength(301);
  const expected = catalog.map((n) => `${n.lot}/${n.id}.blueprint.json`);
  expect(files.toSorted()).toEqual(expected.toSorted());
});

test("every tree a number of the catalog says it goes into is a number of the catalog", () => {
  const all = JSON.parse(
    readFileSync(join(ROOT, "docs", "catalogo", "numeros.json"), "utf8"),
  ) as { id: string; arvore_mae?: string[] }[];
  const ids = new Set(all.map((n) => n.id));
  expect(
    all.flatMap((n) =>
      (n.arvore_mae ?? [])
        .filter((m) => !ids.has(m))
        .map((m) => `${n.id} -> ${m}`),
    ),
  ).toEqual([]);
});

test("the Drop Rate's blueprint is complete: Additive, Multi, Additive, Multi, no character written out, every source proven (T031)", () => {
  const out = loadBlueprints(BLUEPRINTS);
  expect(out.stages.get("stats-drop-rate")).toBe("complete");
  const bp = out.complete.get("stats-drop-rate");
  expect(bp?.pools.map((p) => p.kind)).toEqual([
    "additive",
    "multi",
    "additive",
    "multi",
  ]);
  const nodes: BlueprintNode[] = [];
  const walk = (n: BlueprintNode) => {
    nodes.push(n);
    if (n.condition) walk(n.condition);
    n.children?.forEach(walk);
  };
  bp?.pools.forEach((p) => {
    p.groups.forEach((g) => {
      g.sources.forEach(walk);
    });
  });
  expect(
    nodes.filter(
      (n) => n.ref && "read" in n.ref && hasRawCharacterIndex(n.ref.read),
    ),
  ).toEqual([]);
  expect(nodes.filter((n) => n.nameProof === undefined)).toEqual([]);
});

test("the Star Signs piece loads below a line that reads a star sign's field: the active signs' bases, then the multis (T172)", () => {
  const probe = {
    id: "star-signs-probe",
    root: {
      name: "Drop Rate",
      ref: { call: "TotalStats", args: ["Drop_Rarity", 0, 0] },
    },
    pools: [
      {
        kind: "additive",
        groups: [
          {
            system: "star-signs",
            sources: [
              {
                key: "signs-drop",
                name: "Star Signs total: Drop Rate",
                nameProof: { names: "DNSM.StarSigns.Drop" },
                ref: { read: "DNSM.StarSigns.Drop" },
                piece: { name: "star-signs", args: {} },
              },
            ],
          },
        ],
      },
    ],
  };
  const out = loadBlueprints({
    ...BLUEPRINTS,
    "probe/star-signs-probe.blueprint.json": probe,
  });
  expect(out.refused).toEqual([]);
  const line = out.all.get("star-signs-probe")?.pools[0]?.groups[0]?.sources[0];
  expect(line?.pools?.map((p) => p.kind)).toEqual(["additive", "multi"]);
  expect(line?.pools?.[0]?.groups[0]?.sources[0]?.each).toEqual({
    list: "DNSM.StarSignsDL[*]",
    as: "sign",
  });
});

test("the LUK's blueprint loads with the game's 5 pools, the equipment's items and upgrades as an each over two indices (T172)", () => {
  const out = loadBlueprints(BLUEPRINTS);
  const bp = out.all.get("stats-luk");
  expect(bp?.pools.map((p) => p.kind)).toEqual([
    "additive",
    "multi",
    "additive",
    "multi",
    "additive",
  ]);
  // two groups: two each sources in one group would interleave their slots (sourceOrder)
  const [items, upgrades] =
    bp?.pools[0]?.groups.slice(0, 2).map((g) => g.sources[0]) ?? [];
  expect(bp?.pools[0]?.groups.slice(0, 2).map((g) => g.sources.length)).toEqual(
    [1, 1],
  );
  expect([items?.each, upgrades?.each]).toEqual([
    { list: "EquipmentOrder[*][*]", as: ["r", "s"] },
    { list: "EquipmentMap[*][*].LUK", as: ["r", "s"] },
  ]);
  const reads: string[] = [];
  const walk = (n: BlueprintNode) => {
    if (n.ref && "read" in n.ref) reads.push(n.ref.read);
    n.children?.forEach(walk);
    n.pools?.forEach((p) => {
      p.groups.forEach((g) => {
        g.sources.forEach(walk);
      });
    });
  };
  bp?.pools.forEach((p) => {
    p.groups.forEach((g) => {
      g.sources.forEach(walk);
    });
  });
  expect(reads.filter((r) => hasRawCharacterIndex(r))).toEqual([]);
});

test("the LUK's groups each have their system: the Shimmer's in islands, the All Stat's in luk-stats, as the catalog puts them (T172)", () => {
  const bp = loadBlueprints(BLUEPRINTS).all.get("stats-luk");
  const groups = bp?.pools.flatMap((p) => p.groups) ?? [];
  expect(groups.filter((g) => typeof g.system !== "string")).toEqual([]);
  expect(bp?.pending?.filter((p) => p.kind === "system")).toEqual([]);
  const systemOf = (ref: string) =>
    groups.find((g) =>
      g.sources.some((s) => s.ref && JSON.stringify(s.ref).includes(ref)),
    )?.system;
  expect([systemOf("OptionsListAccount[177]"), systemOf('"AllStat"')]).toEqual([
    "islands",
    "luk-stats",
  ]);
});

test("the LUK's EtcBonuses that read no part are raw bonuses, by tree/kinds.ts's rule of a block with no part (T172)", () => {
  const raw = BLUEPRINTS[
    "../blueprints/character/stats-luk.blueprint.json"
  ] as {
    pending: { where: string; kind: string }[];
  };
  const at = (w: string) =>
    w
      .split("/")
      .reduce<Record<string, unknown>>(
        (o, k) => o[k] as Record<string, unknown>,
        raw as unknown as Record<string, unknown>,
      );
  const etc = (w: string) =>
    (at(w).ref as { call?: string } | undefined)?.call === "EtcBonuses";
  expect(raw.pending.filter((p) => p.kind === "leaf" && etc(p.where))).toEqual(
    [],
  );
});

// The kinds the bench's rules prove for the LUK's leaves (bench pieces.cjs KIND_PATHS and RULES, T172): an achievement is
// a condition, a vote of the week too, a game table's cell a fixed value and a talent's level the points invested.
const LUK_KINDS: readonly [RegExp, string][] = [
  [/^AchieveReg\[\d+\]$/, "condition"],
  [
    /^OptionsListAccount\[453\]$|ActorEvents_670\)\._GenINFO\[36\]$/,
    "condition",
  ],
  [/^(CustomLists|CustomMaps)\./, "fixedValue"],
  [
    /^(PlayerDATABASE\[\{character\}\]\.)?SkillLevels\[\d+\]$/,
    "investedPoints",
  ],
];

test("the LUK's leaves have the kind the bench's rules prove, and none of those waits for one (T172)", () => {
  const raw = BLUEPRINTS[
    "../blueprints/character/stats-luk.blueprint.json"
  ] as { pending: { where: string; kind: string }[] };
  const waits = new Set(
    raw.pending.filter((p) => p.kind === "leaf").map((p) => p.where),
  );
  const bp = loadBlueprints(BLUEPRINTS).all.get("stats-luk");
  const wrong: string[] = [];
  const walk = (n: BlueprintNode, w: string): void => {
    (n.children ?? []).forEach((k, i) => {
      walk(k, `${w}/children/${String(i)}`);
    });
    const ref = n.ref;
    // a leaf, typed or waiting for its kind; a call that waits to descend is no leaf yet
    if (!ref || n.children?.length || (!n.leaf && !waits.has(w))) return;
    const code = "call" in ref ? refKey(ref, 0) : ref.read;
    const k = LUK_KINDS.find(([re]) => re.test(code))?.[1];
    if (k === undefined) return;
    if (waits.has(w) ? true : n.leaf !== k) wrong.push(`${code}: ${k}`);
  };
  bp?.pools.forEach((p, pi) => {
    p.groups.forEach((g, gi) => {
      g.sources.forEach((s, si) => {
        walk(
          s,
          `pools/${String(pi)}/groups/${String(gi)}/sources/${String(si)}`,
        );
      });
    });
  });
  expect(wrong).toEqual([]);
});

test("every blueprint loads in a stage, and its file's name is its id", () => {
  const out = loadBlueprints(BLUEPRINTS);
  expect(out.refused).toEqual([]);
  expect(out.stages.size).toBe(files.length);
  for (const f of files) {
    const raw = JSON.parse(readFileSync(join(DIR, f), "utf8")) as {
      id?: unknown;
    };
    expect(`${String(raw.id)}.blueprint.json`).toBe(f.split("/").at(-1));
  }
});

test("no node of any recipe or piece has a part of not-leaves.ts as its ref: a curve, a log or a context goes to the ⓘ (research R6)", () => {
  const found: string[] = [];
  const walk = (x: unknown, file: string, under: string): void => {
    if (Array.isArray(x)) {
      x.forEach((v) => {
        walk(v, file, under);
      });
      return;
    }
    if (typeof x !== "object" || x === null) return;
    const ref = (x as { ref?: Ref }).ref;
    if (ref !== undefined && under !== "root" && under !== "condition") {
      const key = refKey(ref, 0);
      if (notLeafOf(key, 0) !== null) found.push(`${file}: ${key}`);
    }
    for (const [k, v] of Object.entries(x)) walk(v, file, k);
  };
  for (const [file, raw] of Object.entries(BLUEPRINTS)) walk(raw, file, "");
  expect(found).toEqual([]);
});

test("no node whose ref takes {character} at an argument writes a number there in its nameProof or its key (Fase 4 r2)", () => {
  const found: string[] = [];
  const walk = (x: unknown, file: string): void => {
    if (Array.isArray(x)) {
      x.forEach((v) => {
        walk(v, file);
      });
      return;
    }
    if (typeof x !== "object" || x === null) return;
    const n = x as Partial<BlueprintNode>;
    const ref = n.ref;
    if (ref && "call" in ref && ref.args.includes("{character}")) {
      const marks = ref.args.flatMap((a, i) =>
        a === "{character}" ? [i] : [],
      );
      const proof =
        n.nameProof && "names" in n.nameProof ? n.nameProof.names : "";
      const m = /^[^(]+\((.*)\)$/.exec(proof);
      const args = m ? (JSON.parse(`[${m[1] ?? ""}]`) as unknown[]) : [];
      if (marks.some((i) => typeof args[i] === "number"))
        found.push(`${file}: ${n.key ?? "?"} nameProof ${proof}`);
      // the key's numbers are only the call's other numbers, never the character's index
      const others = ref.args.filter((a) => typeof a === "number").map(String);
      const left = [...others];
      const extra = (n.key ?? "").split("-").filter((t) => {
        if (!/^\d+$/.test(t)) return false;
        const at = left.indexOf(t);
        if (at < 0) return true;
        left.splice(at, 1);
        return false;
      });
      if (extra.length) found.push(`${file}: key ${n.key ?? "?"}`);
    }
    for (const v of Object.values(x)) walk(v, file);
  };
  for (const [file, raw] of Object.entries(BLUEPRINTS)) walk(raw, file);
  expect(found).toEqual([]);
});
