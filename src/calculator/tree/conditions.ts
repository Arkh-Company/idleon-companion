// The checks a block made, as Condition rows (spec 008, FR-013): the port of pieces.cjs `comparisons`, `condText`,
// `condSub`, `condRows`, `isFlagTest` and `mergeTests` [H1-MERGE] from the bench at BASELINE-4. A check on the player's
// state is one Condition leaf, yes or no, with its subtype; a yes/no read and the test the block made of it are one
// leaf. A side of a comparison is written by its name, else by its path or its call (FR-012a); a yes/no read merged into
// its test "= 1" is said by its name, and the ban flag tested for 0 by what it means. The row is named by its comparison
// when every side has a name, as in the bench (spec Open Questions); else it keeps the generic name. Left out: the 007
// dictionary's names of a side (ownSearchName). OPUS4-T2 (the outcome row of a lone check) is in once.ts, over the
// calls `t1` keeps.
import type { CALC_CONDITION_KINDS } from "../tree-contract.ts";
import type { RecNode } from "../recording.ts";
import { classify } from "./kinds.ts";
import { isNameText, termName } from "./names.ts";
import { callText, row } from "./rows.ts";
import { withName } from "./row-checks.ts";
import type { Row } from "./rows.ts";
import { termOf } from "./share.ts";
import type { BlockSteps, Expr } from "./steps.ts";
import { searchNames } from "./search-names.ts";
import { near, num } from "./math.ts";
import { firstSrc } from "./expr.ts";
import { hasKids } from "./tidy.ts";
import { COND_SUBS } from "./cond-subs.ts";

export { COND_SUBS } from "./cond-subs.ts";

type Condition = (typeof CALC_CONDITION_KINDS)[number];
const CMP: Readonly<Record<string, string>> = {
  "==": "=",
  "===": "=",
  "!=": "≠",
  "!==": "≠",
  ">": ">",
  "<": "<",
  ">=": "≥",
  "<=": "≤",
};
const FLIP: Readonly<Record<string, string>> = {
  ">": "<",
  "<": ">",
  ">=": "<=",
  "<=": ">=",
};
interface Cmp {
  l: Expr;
  r: Expr;
  o: string;
}

/** The comparisons of a check that compare two known things, the named side first ("level ≤ 0", not "0 ≥ level"). */
function comparisons(e: Expr, out: Cmp[] = []): Cmp[] {
  if (e.t === "op" && (e.o === "||" || e.o === "&&")) {
    comparisons(e.l, out);
    comparisons(e.r, out);
  } else if (e.t === "not") comparisons(e.a, out);
  else if (e.t === "op" && Object.hasOwn(CMP, e.o)) {
    const known = (x: Expr) => !(x.t === "val" && x.v == null);
    if (!known(e.l) || !known(e.r)) return out;
    const bare = (x: Expr) => x.t === "num" || x.t === "val";
    out.push(
      bare(e.l) && !bare(e.r)
        ? { l: e.r, r: e.l, o: FLIP[e.o] ?? e.o }
        : { l: e.l, r: e.r, o: e.o },
    );
  }
  return out;
}

/** [H1-MERGE] the ban flag of a talent: tested for 0, the talent counts for the All-talent levels (N.js). */
export const BAN_FLAG = {
  /** The ban flag's call, by the start of its code. */
  test: 'RunCodeOfTypeXforThingY("TalentBannedforAllLV"',
  name: "Counts for All-talent levels",
  proof: "bench pieces.cjs mergeTests H1-MERGE; N.js RunCodeOfTypeXforThingY",
};

export function makeConditions(
  nodes: readonly RecNode[],
  /** The calls that wrote each path (the recording's writes), to tell a block's own cache of its search. */
  writersOf: ReadonlyMap<string, readonly number[]> = new Map(),
) {
  const t1 = new Set<number>();
  const searchName = searchNames(nodes, writersOf);
  /** The text of a side; with `named`, null when a term of it has no name (the row then keeps the generic name). */
  function condText(
    e: Expr,
    n: RecNode,
    own: BlockSteps,
    named = false,
  ): string | null {
    const side = (code: string) =>
      named ? termName(code) : (termName(code) ?? code);
    // OPUS4-T1: numbers and the call's own argument only (a block with no step and one check): its number
    if (
      e.t === "op" &&
      "+-*/".includes(e.o) &&
      typeof e.v === "number" &&
      !own.steps.length &&
      own.checks.length === 1
    ) {
      const args = n.a.filter((a) => typeof a === "number");
      let vals = 0;
      const pure = (x: Expr): boolean =>
        x.t === "num" ||
        (x.t === "val" && args.includes(x.v as number) && ++vals > 0) ||
        (x.t === "op" && "+-*/".includes(x.o) && pure(x.l) && pure(x.r));
      if (pure(e) && vals) {
        t1.add(n.id);
        return num(e.v);
      }
    }
    if (e.t === "num") return num(e.v);
    if (e.t === "val") return e.v == null ? null : num(e.v);
    if (e.t === "read") return searchName(e.p, n) ?? side(e.p);
    if (e.t === "call") {
      const k = nodes[e.id];
      return k ? side(callText(k)) : null;
    }
    if (e.t === "not") {
      const a = condText(e.a, n, own, named);
      return a ? `not ${a}` : null;
    }
    if (e.t === "op" && (e.o === "||" || e.o === "&&")) {
      const l = condText(e.l, n, own, named);
      const r = condText(e.r, n, own, named);
      if (l && r) return l + (e.o === "||" ? " or " : " and ") + r;
      return named ? null : (l ?? r);
    }
    if (e.t === "op" && Object.hasOwn(CMP, e.o)) {
      const l = condText(e.l, n, own, named);
      const r = condText(e.r, n, own, named);
      return l && r ? `${l} ${CMP[e.o] ?? e.o} ${r}` : null;
    }
    if (e.t === "op" || e.t === "fn") {
      const s = firstSrc(e);
      const k = s?.t === "call" ? nodes[s.id] : undefined;
      return s?.t === "read" ? side(s.p) : k ? side(callText(k)) : null;
    }
    return null;
  }

  /** pieces.cjs `condSub`: the subtype of a check, from what it compares (the bench's words, by the contract's kinds). */
  function condSub(c: Cmp, txt: string): Condition {
    const j = JSON.stringify(c.l) + JSON.stringify(c.r);
    const big = c.r.t === "num" && Number(c.r.v) >= 50;
    const on = { paths: j, text: j + txt, cmp: c.o };
    const r = COND_SUBS.find(
      (x) =>
        x.test.test(on[x.on]) &&
        (!x.big || big) &&
        (!x.eq || /^={2,3}$/.test(c.o)),
    );
    return r?.condition ?? "equalsValue";
  }

  /** The code of the read or call one comparison sets against a literal: the check's subject (audit family 3). */
  function subjectOf([c, ...more]: Cmp[]): { subject?: string } {
    const s =
      c && !more.length
        ? c.r.t === "num"
          ? c.l
          : c.l.t === "num"
            ? c.r
            : null
        : null;
    const k = s?.t === "call" ? nodes[s.id] : undefined;
    const code = s?.t === "read" ? s.p : k ? callText(k) : null;
    return code ? { subject: code } : {};
  }

  /** pieces.cjs `condRows`: one Condition leaf per check on the player's state, yes (1) or no (0). */
  function condRows(n: RecNode, own: BlockSteps): Row[] {
    const out: Row[] = [];
    const seen = new Set<string>();
    for (const q of own.checks) {
      // [NR-C] a comparison with no named side is the member selector of the code, and a test of a list's .length
      // against no literal is its guard: neither is a condition of the player's state
      const bare = (x: Expr) => x.t === "num" || x.t === "val";
      const isLen = (x: Expr) => x.t === "read" && x.p.endsWith(".length");
      const guard = (c: Cmp) =>
        (isLen(c.l) && c.r.t !== "num") || (isLen(c.r) && c.l.t !== "num");
      const cs = comparisons(q.e).filter(
        (c) => !(bare(c.l) && bare(c.r)) && !guard(c),
      );
      // (spec Open Questions) the row is its comparison when every side of it has a name, as in the bench
      const said = cs.flatMap((c) => {
        const l = condText(c.l, n, own);
        const r = condText(c.r, n, own);
        if (!l || !r) return [];
        const named =
          !!condText(c.l, n, own, true) && !!condText(c.r, n, own, true);
        const op = CMP[c.o] ?? c.o;
        // a search is a yes/no: "Found Heroic Spirit = 1" is "Found Heroic Spirit" (pieces.cjs condRows, 11/11)
        const search =
          /^(Found |Red Tome Pages added)/.test(l) &&
          op === "=" &&
          (r === "1" || r === "0");
        const text = !search
          ? `${l} ${op} ${r}`
          : r === "0"
            ? `Not ${l.charAt(0).toLowerCase()}${l.slice(1)}`
            : l;
        return [{ text, named }];
      });
      const parts = said.map((x) => x.text);
      const allNamed = said.every((x) => x.named);
      const [first] = cs;
      if (!first || !parts.length) continue;
      const txt = parts.join(
        cs.length > 1 && JSON.stringify(q.e).includes('"o":"&&"')
          ? " and "
          : " or ",
      );
      if (seen.has(txt)) continue;
      seen.add(txt);
      const condition = condSub(first, txt);
      // the game marks a finished achievement or dream with -1 (pieces.cjs condRows): it is said done
      const meant =
        condition === "done"
          ? txt.replace(/ = -1$/, " completed").replace(/ ≤ 0$/, " reached")
          : txt;
      out.push({
        node: row({
          pieceKey: null,
          value: q.v ? 1 : 0,
          code: null,
          leaf: "condition",
          condition,
          ...(allNamed && isNameText(meant) ? { name: meant } : {}),
        }),
        open: null,
        test: meant,
        ...subjectOf(cs),
      });
    }
    return out;
  }

  // [H1-MERGE] a read and its test are one leaf only when the read is a true yes/no and what follows its term in the
  // test is the comparison itself; a level, a count or a choice that happens to be 0 or 1 stays a row of its own.
  const NOT_FLAG = new Set([
    "level",
    "investedPoints",
    "quantity",
    "choice",
    "tier",
    "record",
    "fixedValue",
  ]);
  function isFlagTest(x: Row, rest: string): boolean {
    if (!/^(?:[=≠<>≤≥] \S|completed$)/.test(rest)) return false;
    const { leaf, condition } = x.node;
    // (the bench first asks a Condition its subtype before its value; a Condition is 0 or 1, so the value test below
    // never stops one)
    if (![0, 1, -1].includes(Number(x.node.value))) return false;
    const k = leaf ? { leaf, condition } : classify(x.node);
    if (k.leaf === "condition" && k.condition !== "equalsValue") return true;
    if (NOT_FLAG.has(k.leaf)) return false;
    return /^(?:[=≠] (?:0|1|-1)(?: (?:and|or) .+)?|completed)$/.test(rest);
  }

  /** pieces.cjs `mergeTests`: the block's rows, its data rows and its checks, a yes/no read merged into its test. */
  function mergeTests(
    n: RecNode,
    rows: Row[],
    data: Row[],
    conds: Row[],
    own: BlockSteps,
  ): Row[] {
    const all = [...rows, ...data];
    const merged = new Map<Row, Row>();
    for (const c of conds) {
      const test = c.test ?? "";
      const r = all.find((x) => {
        const term = termOf(x.node);
        return (
          !merged.has(x) &&
          !hasKids(x) &&
          !!term &&
          test.startsWith(`${term} `) &&
          isFlagTest(x, test.slice(term.length + 1))
        );
      });
      if (r) merged.set(r, c);
    }
    const kept = all.filter((x) => !merged.has(x));
    // r3-g3: a block left with one row would fold into it and lose its "If X completed: 1": keep read and test
    if (merged.size && kept.length + conds.length <= 1)
      return [...all, ...conds];
    const out = conds.map((c) => {
      const r = [...merged].find(([, x]) => x === c)?.[0];
      if (!r) return c;
      // the read merged into it: the row is that state, no check of it
      const state: Row = { ...c };
      delete state.subject;
      // a yes/no read tested for 1 is said by its name; the ban flag tested for 0 by what it means
      const term = termOf(r.node);
      const test =
        c.test === `${term} = 1` && [0, 1].includes(Number(r.node.value))
          ? term
          : c.test === `${term} = 0` &&
              (r.node.code ?? "").startsWith(BAN_FLAG.test)
            ? BAN_FLAG.name
            : c.test;
      // [INT3-MERGE-CODE] the read's code only with the read's own value
      const code =
        !c.node.code && r.node.code && near(c.node.value, r.node.value)
          ? r.node.code
          : c.node.code;
      // the row says its new test when it said its comparison (every side named), and the ban flag by what it means
      const name =
        test !== undefined && (test === BAN_FLAG.name || !c.node.flags.unnamed)
          ? test
          : null;
      return withName(
        {
          ...state,
          ...(test === undefined ? {} : { test }),
          node: { ...c.node, code },
        },
        name,
      );
    });
    const v = Number(n.v);
    if (
      Number.isFinite(v) &&
      ![0, 1, -1].includes(v) &&
      out.some((c) => c.node.value === 1) &&
      ![...kept, ...out].some(
        (x) => x.node.leaf !== "condition" && near(x.node.value, v),
      ) &&
      !own.steps.length &&
      !n.c.some((id) => near(nodes[id]?.v, v))
    )
      kept.push({
        node: row({
          pieceKey: null,
          value: v,
          code: null,
          name: "Fixed value",
          leaf: "fixedValue",
          flags: {},
        }),
        open: null,
      });
    return [...kept, ...out];
  }

  return {
    condRows,
    mergeTests,
    /** OPUS4-T1: the calls whose check got its number from the call's own argument (T2 opens only those). */
    t1: t1 as ReadonlySet<number>,
  };
}
