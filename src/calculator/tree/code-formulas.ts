// The ⓘ a row takes from the game's code before its own rows exist (spec 008, T022): the port of pieces.cjs
// `exprTexts`, `exprFormula`, `callFormula` and `familyFormula` from the bench at BASELINE-4. An expression is written
// twice, with its parts as tokens (found later among the row's parts, tree/formulas.ts) and with its numbers, and kept
// only when it gives the row's value; it is computed here, never by `Function` (FR-010: nothing of the code runs). A
// part with no row is its name (pieces.cjs `pathName`, `callName`), else its path or its call as it is (FR-012a). The
// bench's `OPEN_XF` (NR-G 2b) is once.ts `onlyCache`'s, given to the call once its rows are built (tree-build.ts). Left
// out: the talent's curve read from its table when the recording did not keep it (the 007 index), as in raw-passes.ts.
import type { RecNode } from "../recording.ts";
import { curveFormula, curveOf, fx3 } from "./curves.ts";
import { near as nearRounded, token } from "./formulas.ts";
import type { Pair } from "./formulas.ts";
import { near } from "./math.ts";
import { callName, pathName } from "./names.ts";
import { callText } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { valPath } from "./val-path.ts";
import type { Reads } from "./val-path.ts";

const SYMB: Readonly<Record<string, string>> = {
  "+": " + ",
  "-": " − ",
  "*": " × ",
  "/": " ÷ ",
};
const DO: Readonly<Record<string, (a: number, b: number) => number>> = {
  "+": (a, b) => a + b,
  "-": (a, b) => a - b,
  "*": (a, b) => a * b,
  "/": (a, b) => a / b,
};
const FN: Readonly<Record<string, (...x: number[]) => number>> = {
  min: Math.min,
  max: Math.max,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  pow: Math.pow,
  abs: Math.abs,
};
/** A 0 of the code or of an earlier step: the start of a total. */
export const isZero = (x: Expr) =>
  (x.t === "val" || x.t === "num") && Number(x.v) === 0;
/** An expression written with its parts, with its numbers, and its own value from the recorded values. */
interface Texts {
  names: string;
  nums: string;
  value: number;
}

export interface CodeFormulas {
  /** pieces.cjs `exprFormula`: expression `e` as an ⓘ, when it is arithmetic of `minOps` parts or more that gives `v`. */
  expr: (
    e: Expr | undefined,
    reads: Reads,
    v: unknown,
    minOps?: number,
  ) => Pair | null;
  /** pieces.cjs `callFormula`: a call's ⓘ, from its family, its last step with its value or the curve it returns. */
  call: (k: RecNode) => Pair | null;
}

export function makeCodeFormulas(
  nodes: readonly RecNode[],
  stepsOf: (id: number) => readonly Step[],
): CodeFormulas {
  const kidsOf = (k: RecNode) =>
    k.c.flatMap((c) => (nodes[c] ? [nodes[c]] : []));
  // pieces.cjs callName: the curve block is "Curve"; any other call its name (tree/names.ts), else as it is
  const termOfCall = (k: RecNode) =>
    k.b === "ArbitraryCode5Inputs" ? "Curve" : callName(callText(k));

  function texts(e: Expr): { t: Texts; ops: number } | null {
    let ops = 0;
    function r(x: Expr): Texts | null {
      if (x.t === "def") return r(x.e);
      if (x.t === "num") {
        const v = Number(x.v);
        return { names: fx3(v), nums: fx3(v), value: v };
      }
      if (x.t === "val" || x.t === "read" || x.t === "call") {
        ops++;
        if (typeof x.v !== "number") return null;
        const v = x.v;
        if (x.t === "val")
          return {
            names: token(`v:${String(v)}`, fx3(v)),
            nums: fx3(v),
            value: v,
          };
        if (x.t === "read")
          return {
            names: token(`c:${x.p}@${String(v)}`, pathName(x.p)),
            nums: fx3(v),
            value: v,
          };
        const k = nodes[x.id];
        // a talent inside a sum shows its own curve
        if (k?.b === "GetTalentNumber") {
          const cf = family(k);
          if (cf?.[1].includes(" = ") && !cf[0].startsWith("0 while"))
            return {
              names: `(${cf[0]})`,
              nums: `(${cf[1].replace(/ = [^=]*$/, "")})`,
              value: v,
            };
        }
        return {
          names: token(`c:${k ? callText(k) : ""}`, k ? termOfCall(k) : "?"),
          nums: fx3(v),
          value: v,
        };
      }
      if (x.t === "op") {
        const sym = SYMB[x.o];
        const op = DO[x.o];
        const a = sym && r(x.l);
        const b = sym && r(x.r);
        if (!sym || !op || !a || !b) return null;
        // [F2-PAREN] a def is the step under it
        const wrap = (y: Expr, s: string) => {
          while (y.t === "def") y = y.e;
          return y.t === "op" && SYMB[y.o] ? `(${s})` : s;
        };
        return {
          names: wrap(x.l, a.names) + sym + wrap(x.r, b.names),
          nums: wrap(x.l, a.nums) + sym + wrap(x.r, b.nums),
          value: op(a.value, b.value),
        };
      }
      const fn =
        x.t === "fn" && x.name !== null && Object.hasOwn(FN, x.name)
          ? FN[x.name]
          : undefined;
      if (x.t === "fn" && fn) {
        const as = x.args.map(r);
        if (as.some((y) => !y)) return null;
        const ok = as as Texts[];
        return {
          names: `${String(x.name)}(${ok.map((y) => y.names).join(", ")})`,
          nums: `${String(x.name)}(${ok.map((y) => y.nums).join(", ")})`,
          value: fn(...ok.map((y) => y.value)),
        };
      }
      return null;
    }
    const t = r(e);
    // one named part with constants of the code is a formula too ("5 × talent")
    return t && ops <= 30 ? { t, ops } : null;
  }

  function expr(
    e: Expr | undefined,
    reads: Reads,
    v: unknown,
    minOps = 1,
  ): Pair | null {
    // "0 + X" is X: a total that starts at 0 says nothing of its own
    if (e?.t === "op" && e.o === "+" && isZero(e.l) !== isZero(e.r))
      return expr(isZero(e.l) ? e.r : e.l, reads, v, minOps);
    if (
      !e ||
      typeof v !== "number" ||
      ["read", "call", "val", "num"].includes(e.t)
    )
      return null;
    const out = texts(e);
    if (!out || out.ops < minOps || !nearRounded(out.t.value, v)) return null;
    return [out.t.names, `${out.t.nums} = ${fx3(v)}`];
  }

  /** pieces.cjs `familyFormula`: the families whose rows the bench writes by hand, with their formula from N.js. */
  function family(k: RecNode): Pair | null {
    const kids = kidsOf(k);
    const v = Number(k.v);
    const args = k.a;
    const reads = k.r ?? [];
    // N.js GetTalentNumber: 0 when the talent has no points, else the talent's curve of its levels (50 in a dungeon)
    if (k.b === "GetTalentNumber") {
      const cv = kids.find((x) => x.b === "ArbitraryCode5Inputs");
      const c = cv && curveOf(cv.b, cv.a);
      if (!c)
        return v === 0
          ? ["0 while Points in the talent ≤ 0", "0 points → 0"]
          : null;
      const inDungeon =
        c[3] === 50 && !kids.some((x) => x.b === "RunCodeOfTypeXforThingY");
      return curveFormula(
        c,
        v,
        inDungeon
          ? "50 (in a dungeon)"
          : "(Points in the talent + All-talent levels)",
      );
    }
    // [PROPOSAL D9-10] N.js StampBonusOfTypeX: a type with no stamp of its own returns the 0 it starts from
    if (
      k.b === "StampBonusOfTypeX" &&
      v === 0 &&
      !reads.some(([p]) => p.startsWith("StampLevel["))
    )
      return [
        `0: no stamp description has the type ${String(args[0])}`,
        "no stamp of this type → 0",
      ];
    // [PROPOSAL D9-9] N.js RiftStuff 5starCards: 0 while Rift[0] < 45, else 1
    if (k.b === "RiftStuff" && args[0] === "5starCards") {
      const rl = reads.find(([p]) => p === "Rift[0]");
      return [
        "1 when the Rift level ≥ 45, else 0",
        `${rl ? `Rift level ${String(rl[1])}` : "Rift level"} → ${String(v)}`,
      ];
    }
    // [PROPOSAL D9-4] N.js GetBuffBonuses: 0 unless the buff is on, then a talent's value (615 and 46 are other cases)
    if (
      k.b === "GetBuffBonuses" &&
      Number(args[0]) !== 615 &&
      Number(args[0]) !== 46
    ) {
      if (kids.some((x) => x.b === "GetTalentNumber" && near(Number(x.v), v)))
        return [
          `The talent's value while buff ${String(args[0])} is on (0 when it is off)`,
          `buff on → ${fx3(v)}`,
        ];
    }
    // N.js AllTalentLV: 0 when the talent has no points or is banned from the all-talent levels
    if (
      k.b === "RunCodeOfTypeXforThingY" &&
      /^AllTalentLVz?$/.test(String(args[0])) &&
      v === 0
    ) {
      const banned = kids.find(
        (x) =>
          x.b === "RunCodeOfTypeXforThingY" &&
          x.a[0] === "TalentBannedforAllLV",
      );
      if (banned && Number(banned.v) === 1)
        return [
          "0: this talent is banned from the All-talent levels",
          "banned → 0",
        ];
      return ["0 while Points in the talent ≤ 0.5", "0 points → 0"];
    }
    // N.js prayersReal: 0 while the prayer is in no prayer slot
    if (k.b === "prayersReal") {
      const slots = reads
        .filter(([p]) => /^PrayersActive\[\d+\]$/.test(p))
        .map(([, x]) => Number(x));
      if (v === 0 && slots.length && !slots.includes(Number(args[0])))
        return [
          "0 while this prayer is in no prayer slot",
          `slots: ${[...new Set(slots.filter((x) => x !== -1))].join(", ")} → 0`,
        ];
    }
    // N.js getbonus2: the best of the characters' bonuses, each the talent's curve of that character's level
    if (k.b === "getbonus2") {
      const vals = kids
        .filter((x) => x.b === "ArbitraryCode5Inputs")
        .map((x) => Number(x.v));
      if (vals.length < 2 || !near(Math.max(...vals), v)) return null;
      return [
        "max(the bonus of each character: the talent's curve of its level)",
        `max(${[...new Set(vals.map(fx3))].join(", ")}) = ${fx3(v)}`,
      ];
    }
    // N.js CardLv: 1 when owned, then the highest star passed, up to 4 + Rift's 5th + Spelunking's 6th
    if (k.b === "RunCodeOfTypeXforThingY" && args[0] === "CardLv") {
      const r = Number(kids.find((x) => x.b === "RiftStuff")?.v ?? 0);
      const sp = Number(kids.find((x) => x.b === "Spelunk")?.v ?? 0);
      if (v === 0) return ["0 while no card is collected", "0 cards → 0"];
      if (v - 1 > 4 + r + sp)
        return [
          `Forced to ${String(v)} by the card list of the account`,
          `→ ${String(v)}`,
        ];
      // [NR-C] C2-3: an ⓘ is plain arithmetic a reader can recompute
      return [
        "1 + min(Stars passed, Base stars + Rift 5th star + Spelunking 6th star)",
        `1 + min(${String(v - 1)}, 4 + ${String(r)} + ${String(sp)}) = ${String(v)}`,
      ];
    }
    return null;
  }

  let byCode: Map<string, RecNode[]> | null = null;
  function call(k0: RecNode): Pair | null {
    let k = k0;
    let fam = family(k);
    // a call that came from a cache has no calls under it: its twin (same code and value) that has them
    if (!fam && !k.c.length) {
      const twin = nodes.find(
        (x) =>
          x !== k &&
          x.c.length &&
          callText(x) === callText(k) &&
          near(Number(x.v), Number(k.v)),
      );
      if (twin) fam = family(twin);
    }
    if (fam) return fam;
    if (!stepsOf(k.id).length) {
      if (!byCode) {
        byCode = new Map();
        for (const x of nodes)
          if (stepsOf(x.id).length)
            byCode.set(callText(x), [...(byCode.get(callText(x)) ?? []), x]);
      }
      const twin = byCode
        .get(callText(k))
        ?.find((x) => near(Number(x.v), Number(k.v)));
      if (!twin) return null;
      k = twin;
    }
    const v = Number(k.v);
    const reads: Reads = new Map((k.r ?? []).map(([p, x]) => [p, x]));
    const st = [...stepsOf(k.id)].reverse().find((x) => near(x.v, v));
    const viaStep = st ? expr(st.e, reads, v) : null;
    if (viaStep) return viaStep;
    // a call whose value is one curve it called: the curve of the read that holds its input, or of "Level"
    const cv = kidsOf(k).find(
      (x) => x.b === "ArbitraryCode5Inputs" && near(Number(x.v), v),
    );
    const c = cv && curveOf(cv.b, cv.a);
    if (!c) return null;
    return curveFormula(c, v, valPath(c[3], reads) ?? "Level");
  }

  return { expr, call };
}
