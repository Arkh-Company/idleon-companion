// The name of a loop turn's part (spec 008, T023): the port of pieces.cjs `entryRows` `arenaTurn`, `turnName` (with
// names-sailing.cjs TURN_NAMES) and the part's name from its own rows, from the bench at BASELINE-4. A turn is known by
// what it read: a boat, a star sign, an artifact, a worn item's slot, a colour of the palette, or the text of a table
// row the recording kept. Left out: the names that need a game table the app does not read (the item a turn found or
// read, the monster of a battle, the star sign's, artifact's and colour's own names: the bench's own words for a row
// with no text stand in) and the bench's "Part N" (a part with no name keeps the generic one, FR-012a).
import { isConstant } from "./formulas.ts";
import type { Entry, TurnRead } from "./entries.ts";
import { clean, isNameText, termName } from "./names.ts";
import { near } from "./math.ts";
import type { Node, Row } from "./rows.ts";

interface Rule {
  test: RegExp;
  proof: string;
}
const index = (re: RegExp, rs: readonly TurnRead[]) =>
  rs.map(([p]) => re.exec(p)).find(Boolean);
const valueOf = (rs: readonly TurnRead[], path: string) =>
  rs.find(([p]) => p === path)?.[1];

/**
 * pieces.cjs `turnName` with names-sailing.cjs TURN_NAMES first: each rule names the turn from the paths and values it
 * read (`rs`) in the cache `p`; the first that names it decides.
 */
export const TURN_NAMES: readonly (Rule & {
  name: (rs: readonly TurnRead[], p: string) => string | null;
})[] = [
  {
    test: /^Boats\[(\d+)\]\[[35]\]$/,
    proof: "bench names-sailing.cjs TURN_NAMES; N.js MenagerieStuff",
    name: (rs) => {
      const m = index(/^Boats\[(\d+)\]\[[35]\]$/, rs);
      return m ? `Boat ${String(Number(m[1]) + 1)}` : null;
    },
  },
  {
    // the sign the turn found in the list of signs (the game's search), else the last entry of that list it read
    test: /^DNSM\.StarSignsDL(?: contains \d+|\[\d+\])$/,
    proof: "bench pieces.cjs entryRows turnName, sign; N.js StarSigns",
    name: (rs) => {
      const found = rs
        .filter(
          ([p, v]) => v === true && /^DNSM\.StarSignsDL contains \d+$/.test(p),
        )
        .pop();
      const sign = found
        ? /(\d+)$/.exec(found[0])?.[1]
        : rs.filter(([p]) => /^DNSM\.StarSignsDL\[\d+\]$/.test(p)).pop()?.[1];
      return sign === undefined ? null : `Star sign (sign ${String(sign)})`;
    },
  },
  {
    test: /^CustomLists\.SummonEnemies\[10\]\[(\d+)\]$/,
    proof: "bench pieces.cjs entryRows turnName, endless; N.js Summoning",
    name: (rs) => {
      const m = index(/^CustomLists\.SummonEnemies\[10\]\[(\d+)\]$/, rs);
      return m
        ? `Endless win, slot ${String(Number(m[1]) + 1)} of the 40-win cycle`
        : null;
    },
  },
  {
    test: /^Boats\[(\d+)\]\[\d+\]$/,
    proof: "bench pieces.cjs entryRows turnName OPUS1-P4; N.js MenagerieStuff",
    name: (rs, p) => {
      const m = index(/^Boats\[(\d+)\]\[\d+\]$/, rs);
      return m && p === "DNSM.NghMrTOT"
        ? `Boat ${String(Number(m[1]) + 1)}: levels above 600`
        : null;
    },
  },
  {
    test: /^Sailing\[3\]\[(\d+)\]$/,
    proof: "bench pieces.cjs entryRows turnName, artifact; N.js Sailing",
    name: (rs) => {
      const m = index(/^Sailing\[3\]\[(\d+)\]$/, rs);
      return m ? `Artifact ${m[1] ?? ""} (artifact ${m[1] ?? ""})` : null;
    },
  },
  {
    test: /^EquipmentMap\[(\d+)\]\[(\d+)\]\.UQ([12])val$/,
    proof: "bench pieces.cjs entryRows turnName D9-6; N.js TotalStats",
    name: (rs) => {
      const m = index(/^EquipmentMap\[(\d+)\]\[(\d+)\]\.UQ([12])val$/, rs);
      return m
        ? `Worn item (group ${m[1] ?? ""} – slot ${m[2] ?? ""}) bonus value ${m[3] ?? ""}`
        : null;
    },
  },
  {
    // the turn that reads only the item's definition: the group and the slot are in the block's working numbers
    test: /^DNSM\.TotalStatsDM\.UQ([12])val$/,
    proof: "bench pieces.cjs entryRows turnName D9-6; N.js TotalStats",
    name: (rs) => {
      const m = index(/^DNSM\.TotalStatsDM\.UQ([12])val$/, rs);
      const group = valueOf(rs, "DummyNumbersStatManager.TotalStatsDRI");
      const slot = valueOf(rs, "DummyNumbersStatManager.TotalStatsDRI2");
      return m && group !== undefined && slot !== undefined
        ? `Worn item (group ${String(group)} – slot ${String(slot)}) bonus value ${m[1] ?? ""}`
        : null;
    },
  },
  {
    test: /^Spelunk\[9\]\[(\d+)\]$/,
    proof: "bench pieces.cjs entryRows turnName, colour; N.js Spelunk",
    name: (rs) => {
      const m = index(/^Spelunk\[9\]\[(\d+)\]$/, rs);
      return m ? `Colour ${m[1] ?? ""} (palette ${m[1] ?? ""})` : null;
    },
  },
  {
    // the last text of a table row the turn read: the row's own name
    test: /\[\d+\]\[0\]$/,
    proof: "bench pieces.cjs entryRows turnName, row",
    name: (rs) => {
      const text = rs
        .filter(
          ([p, v]) =>
            typeof v === "string" &&
            /\[\d+\]\[0\]$/.test(p) &&
            /[A-Za-z]/.test(v),
        )
        .pop()?.[1];
      const name = typeof text === "string" ? clean(text) : "";
      return name && isNameText(name) ? name : null;
    },
  },
];

/**
 * OPUS2-PATCH A, pieces.cjs `arenaTurn`: a turn of the arena loop (the best round against each wave of the arena's
 * list) is one threshold reached.
 */
export const ARENA_TURN = {
  test: /^CustomLists\.RANDOlist\[53\]\[(\d+)\]$/,
  best: "OptionsListAccount[89]",
  proof: "bench pieces.cjs entryRows OPUS2-PATCH A; N.js TalentCalc",
};
export function arenaTurn(rs: readonly TurnRead[]): string | null {
  if (!rs.some(([p]) => p === ARENA_TURN.best)) return null;
  const t = rs.find(([p]) => ARENA_TURN.test.test(p));
  const r = t && ARENA_TURN.test.exec(t[0])?.[1];
  return t && r !== undefined
    ? `Best Pet Arena round ≥ ${String(t[1])} (arena bonus ${String(Number(r) + 1)})`
    : null;
}

export const turnName = (rs: readonly TurnRead[], p: string): string | null =>
  TURN_NAMES.reduce<string | null>((got, r) => got ?? r.name(rs, p), null);

/** pieces.cjs `entryRows` `shared`: a name every added part has among its rows says nothing of one of them. */
export const sharedName =
  (parts: readonly (readonly Row[])[]) =>
  (name: string): boolean =>
    parts.every((rows) => rows.some((x) => x.node.name === name));

/** The paths the turns other than `q` read: a read only `q` made says which item its turn is. */
export const otherReads = (
  turns: readonly Entry[],
  q: Entry,
): ReadonlySet<string> =>
  new Set(turns.filter((x) => x !== q).flatMap((x) => x.r.map(([p]) => p)));

/**
 * pieces.cjs `entryRows`, the name of a part with no read of its own: the first of its rows with a proven name that no
 * other part shares (never a constant of the code, a "Fixed" one included), else the name of a read only this turn made (no game cache), its
 * " level" gone; null leaves the part named by its call.
 */
export function ownName(
  rows: readonly Row[],
  shared: (name: string) => boolean,
  rs: readonly TurnRead[],
  others: ReadonlySet<string>,
): string | null {
  const own = rows.find(
    (x) =>
      !x.node.flags.unnamed && // a value of an earlier step has no name either
      !isConstant(x.node) &&
      !shared(x.node.name),
  );
  if (own) return own.node.name;
  for (const [p] of rs) {
    const name = !others.has(p) && !p.startsWith("DNSM.") && termName(p);
    if (name) return name.replace(/ level$/i, "");
  }
  return null;
}

/**
 * pieces.cjs `entryRows`: a part's rows without the one that only repeats the part (its name and its value, nothing
 * under it); with no name, the generic name is no name to repeat, so the code must be the same too.
 */
export const withoutRepeats = (
  rows: readonly Row[],
  part: Node,
  opens: (r: Row) => boolean,
): Row[] =>
  rows.filter(
    (x) =>
      !(
        x.node.name === part.name &&
        (!part.flags.unnamed || x.node.code === part.code) &&
        near(x.node.value, part.value) &&
        !opens(x)
      ),
  );
