// What the Stats tab shows: each number as the game writes it, the check against the game's own list (FR-023) and the
// tab's state (data-model.md). No electron import, so tests can load it.
import type { CalcNumbers, Stats } from "../shared/index.ts";

const TRILLION = 1e12;
const E_FROM = 1e15;
const separated = (n: number) => n.toLocaleString("en-US");

/** The mantissa is cut, not rounded: the game shows 1.499e33 as 1.49E33. */
function eNotation(n: number): string {
  const [mantissa = "", exponent] = n.toExponential().split("e");
  const [whole, decimals = ""] = mantissa.split(".");
  return `${whole ?? ""}.${decimals.padEnd(2, "0").slice(0, 2)}E${String(Number(exponent))}`;
}

/** Rounds up by default; `round` is for the numbers the game cuts instead (Drop Rate). */
export function formatNumber(
  n: number,
  round: (x: number) => number = Math.ceil,
): string {
  if (n >= E_FROM) return eNotation(n);
  if (n >= TRILLION) return `${separated(round(n / TRILLION))}T`;
  return separated(round(n));
}

/** Each number as its Stats row writes it: the tree's root uses the same text (FR-019 of 008). */
const NUMBERS: Record<
  keyof CalcNumbers,
  { label: string; text: (v: number) => string }
> = {
  // The game cuts it: 2,797,522.9 shows as 2,797,522x.
  dropRate: {
    label: "Drop Rate",
    text: (v) => `${formatNumber(v, Math.trunc)}x`,
  },
  damageMin: { label: "Damage (min)", text: (v) => formatNumber(v) },
  damageMax: { label: "Damage (max)", text: (v) => formatNumber(v) },
  hp: { label: "HP", text: (v) => formatNumber(v) },
  mp: { label: "MP", text: (v) => formatNumber(v) },
  str: { label: "STR", text: (v) => formatNumber(v) },
  agi: { label: "AGI", text: (v) => formatNumber(v) },
  wis: { label: "WIS", text: (v) => formatNumber(v) },
  luk: { label: "LUK", text: (v) => formatNumber(v) },
  accuracy: { label: "Accuracy", text: (v) => eNotation(v) },
  afkGains: {
    label: "AFK Gains",
    // toFixed: 1.1 * 100 is 110.00000000000001, which would round up to 111.
    text: (v) => `${formatNumber(Number((v * 100).toFixed(6)))}%`,
  },
};

/** The label and the text of one Stats number; null for an id that is not one of them. */
export function statsNumber(
  id: string,
): { label: string; text: (v: number) => string } | null {
  return Object.hasOwn(NUMBERS, id) ? NUMBERS[id as keyof CalcNumbers] : null;
}

const one = (id: keyof CalcNumbers) => ({
  label: NUMBERS[id].label,
  ids: [id],
  text: NUMBERS[id].text,
});

const ROWS: {
  label: string;
  ids: (keyof CalcNumbers)[];
  text: (...values: number[]) => string;
}[] = [
  one("dropRate"),
  {
    label: "Damage",
    ids: ["damageMin", "damageMax"],
    text: (min, max) =>
      `${NUMBERS.damageMin.text(min)} – ${NUMBERS.damageMax.text(max)}`,
  },
  one("hp"),
  one("mp"),
  one("str"),
  one("agi"),
  one("wis"),
  one("luk"),
  one("accuracy"),
  one("afkGains"),
];

export function statsRows(
  n: CalcNumbers,
  unavailable: ReadonlySet<string>,
): Stats {
  return {
    state: "ready",
    rows: ROWS.map(({ label, ids, text }) => {
      const values = ids.map((id) => n[id]);
      const shown =
        ids.some((id) => unavailable.has(id)) || values.includes(null);
      return {
        label,
        text: shown ? "unavailable" : text(...(values as number[])),
      };
    }),
  };
}

/** Positions 0 to 3 of the game's `StatList` (research R11). */
const LISTED = ["str", "agi", "wis", "luk"] as const;
/** The game writes the list every 30 s and it arrives with the whole character, in the slow reading (about 15 s more),
 * so a new equipment must not look like a broken number. */
const DIFFERENT_MS = 50_000;

/**
 * Which of the four numbers have been away from the game's own list for too long, without changing; nothing, without a
 * usable list. Each change of a number starts its time over, because the list is then behind it and not wrong.
 */
export function statListCheck(
  now: () => number,
): (n: CalcNumbers, list: unknown) => Set<string> {
  const since = new Map<string, { at: number; value: number }>();
  return (n, list) => {
    const out = new Set<string>();
    if (
      !Array.isArray(list) ||
      list.length < LISTED.length ||
      !list.slice(0, LISTED.length).every((v) => typeof v === "number")
    ) {
      since.clear();
      return out;
    }
    LISTED.forEach((id, i) => {
      const mine = n[id];
      const theirs = list[i] as number;
      if (
        mine === null ||
        Math.abs(mine - theirs) <= Math.max(1, Math.abs(theirs) * 0.01)
      ) {
        since.delete(id);
        return;
      }
      const known = since.get(id);
      const start = known?.value === mine ? known.at : now();
      since.set(id, { at: start, value: mine });
      if (now() - start > DIFFERENT_MS) out.add(id);
    });
    return out;
  };
}

/** The tab's state. Every `send` is a change, except `replay`. */
export function statsTracker(
  send: (s: Stats) => void,
  now: () => number = Date.now,
): {
  slice(): void;
  character(): void;
  result(s: Stats): void;
  unavailable(): void;
  stalled(): void;
  /** The game closed: the last numbers stay, stale (FR-022 of 008). */
  closed(): void;
  clear(): void;
  start(): void;
  replay(): void;
} {
  /** A character is being read. */
  let active = false;
  /** The calculator failed: only a new start of the game clears it. */
  let failed = false;
  /** The reading stopped: the next slice clears it. */
  let stalled = false;
  let rows: Stats | null = null;
  let calculatedAt = 0;
  /** The last numbers of a closed game: until a new start, a slice or no character. */
  let kept: Stats | null = null;
  let last: Stats = { state: "none" };

  function show(): void {
    const next: Stats =
      kept ??
      (stalled
        ? { state: "unavailable" }
        : !active
          ? { state: "none" }
          : failed
            ? { state: "unavailable" }
            : (rows ?? { state: "calculating" }));
    if (JSON.stringify(next) === JSON.stringify(last)) return;
    last = next;
    send(next);
  }

  return {
    slice() {
      kept = null;
      active = true;
      stalled = false;
      show();
    },
    character() {
      rows = null;
      show();
    },
    result(s) {
      rows = s;
      calculatedAt = now();
      show();
    },
    unavailable() {
      failed = true;
      show();
    },
    stalled() {
      stalled = true;
      show();
    },
    closed() {
      if (rows?.state === "ready")
        kept = { state: "ready", rows: rows.rows, stale: true, calculatedAt };
      active = false;
      stalled = false;
      rows = null;
      show();
    },
    clear() {
      kept = null;
      active = false;
      stalled = false;
      rows = null;
      show();
    },
    start() {
      kept = null;
      failed = false;
      active = false;
      stalled = false;
      rows = null;
      show();
    },
    replay() {
      send(last);
    },
  };
}
