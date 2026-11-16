// pieces.cjs `opus2Arena` (OPUS2-PATCH A, E and F) from the bench at BASELINE-4 (spec 008, T023): the rules on a row and
// the level under it, run when the row gets its place, after opus1Sailing's (tree/parent-passes.ts), as the bench runs
// them; and the name the yes/no beside the arena's count takes, over a level's rows (tree/places.ts). Its "B C D again"
// (opus2Leaf's names on a leaf, also one structurePass merged with its read) is tree/leaf-passes.ts's `leafRules`, run
// in the level's `finish` and on the leaf a merge makes (tree/parent-passes.ts). Left out, a deviation (research R14): F's measured amount
// under a row that opens later (the app builds a level when its row gets its place: the reads F renames are found in
// the call's level and in the branches built in it).
import { near } from "./math.ts";
import type { Level } from "./places.ts";
import { bare, unlinked } from "./rows.ts";
import { untyped, withName } from "./row-checks.ts";
import type { Row } from "./rows.ts";
import { tableText } from "./table-names.ts";

/** A: the arena's count, the waves of the arena's list its best round reached (each one a turn, tree/turn-names.ts). */
export const ARENA = {
  test: "DNSM.CalcTalentMAP.arena",
  wave: "Best Pet Arena round ≥ ",
  name: "Arena waves reached by the best round",
  /** The name the count has with no name of its own (tree/names.ts), which the yes/no beside it repeats. */
  generic: "Working value of the game (CalcTalentMAP)",
  proof: "bench pieces.cjs opus2Arena OPUS2-PATCH A; N.js TalentCalc",
};
/** E: a collectible's per-unit number, the second field of its text. */
export const JAR = {
  test: /^Holes\("JarCollectibleBonus", (\d+), 0\)$/,
  // the bench's name is the table's path; here what the number is
  name: "Per-unit number in the collectible's text",
  proof: "bench pieces.cjs opus2Arena E; N.js Holes2",
};
/** F: the measured amount the call sets before its curve reads it again. */
export const MEASURE = {
  test: /^Holes\("MeasurementQTYfound", \d+, 99\)$/,
  read: "DNSM.HoleozDNm",
  proof: "bench pieces.cjs opus2Arena F; N.js Holes",
};

/** A: the arena's count named, its waves limits reached, its ⓘ their sum. */
function arenaCount(n: Row, lv: Level): { row: Row; level: Level } | null {
  const ks = lv.rows;
  if (
    n.node.code !== ARENA.test ||
    !ks.length ||
    !ks.every((k) => k.node.name.startsWith(ARENA.wave) && bare(k))
  )
    return null;
  const rows = ks.map((k) => ({
    ...k,
    node: {
      ...k.node,
      leaf: "condition" as const,
      condition: "limit" as const,
      why: null,
    },
  }));
  const f: [string, string] = [
    ks.map((k) => k.node.name).join(" + "),
    `${ks.map((k) => String(Number(k.node.value))).join(" + ")} = ${String(Number(n.node.value))}`,
  ];
  return {
    row: withName(n, ARENA.name),
    level: { ...lv, row: { ...lv.row, f }, rows },
  };
}

/** E: the collectible's unlinked earlier value that is the number in its text. */
function jarNumber(n: Row, lv: Level): Level | null {
  const t = JAR.test.exec(n.node.code ?? "")?.[1];
  const text = t === undefined ? null : tableText("jar", t);
  if (text === null) return null;
  const per = Number(text);
  return {
    ...lv,
    rows: lv.rows.map((k) => {
      if (!unlinked(k) || !bare(k) || !near(k.node.value, per)) return k;
      const j = withName(k, JAR.name);
      return { ...j, node: { ...j.node, leaf: "fixedValue", why: null } };
    }),
  };
}

/** F: each read of the measured amount, in the level and its built branches, named and typed as the amount the call shows. */
function measured(n: Row, lv: Level): Level | null {
  if (!MEASURE.test.test(n.node.code ?? "")) return null;
  const src = lv.rows.find(
    (k) =>
      bare(k) && !!k.node.code && !untyped(k) && k.node.code !== MEASURE.read,
  );
  if (!src) return null;
  const as = (k: Row): Row => {
    const flags = { ...k.node.flags };
    delete flags.unnamed;
    if (src.node.flags.unnamed) flags.unnamed = true;
    return {
      ...k,
      node: {
        ...k.node,
        name: src.node.name,
        leaf: src.node.leaf,
        condition: src.node.condition,
        why: null,
        flags,
      },
    };
  };
  const walk = (rows: readonly Row[]): Row[] =>
    rows.map((k) => {
      if (
        bare(k) &&
        k.node.code === MEASURE.read &&
        k.node.leaf === "unknown" &&
        near(k.node.value, src.node.value)
      )
        return as(k);
      return k.group ? { ...k, group: walk(k.group) } : k;
    });
  return { ...lv, rows: walk(lv.rows) };
}

/** Row `n` and its level after opus2Arena's rules on them. */
export function arenaPasses(
  n: Row,
  lv: Level | null,
): { row: Row; level: Level | null } {
  if (!lv) return { row: n, level: lv };
  const a = arenaCount(n, lv);
  if (a) return a;
  return { row: n, level: jarNumber(n, lv) ?? measured(n, lv) ?? lv };
}

/** A: the rows beside the arena's count read the same count: its generic name in theirs is the count's. */
export function besideArena(rows: readonly Row[]): Row[] {
  if (!rows.some((k) => k.node.code === ARENA.test)) return [...rows];
  return rows.map((k) =>
    k.node.name.includes(ARENA.generic)
      ? withName(k, k.node.name.replace(ARENA.generic, ARENA.name))
      : k,
  );
}
