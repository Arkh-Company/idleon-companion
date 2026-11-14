// The weight of each row inside its parent (spec 008, data-model `share` and `shareMode`): the port of the bench's
// Share S (SCRATCH share-s/share.cjs `template`, `evaluator`, `contextShares` and `shares`, accepted as the app's spec on
// 12/11 with SPEC-share.txt). The marginal gain (+1 level) is left out: the contract has no field for it.
import type { CalcTreeNode } from "../tree-contract.ts";
import { evaluate } from "./math.ts";

/** A row as the share reads it: its formula is the bench's pair of lines, with names and with numbers. */
export interface ShareNode {
  name: string;
  v: number | null;
  formula: [names: string, numbers: string] | null;
  /** null when the row's own rows are not built yet (a lazy branch). */
  kids: ShareNode[] | null;
}
export type ShareMode =
  | "sum"
  | "product"
  | "productZero"
  | "cap"
  | "capZero"
  | "mixed"
  | "condition"
  | "unknown";
export interface Shares {
  mode: ShareMode;
  /** One per kid, 0..1; null where nothing can be said. */
  shares: (number | null)[];
  /** In a cap or a mixed formula: false on a kid that does not move the parent now. */
  binding?: boolean[];
}

interface Evaluator {
  fn: (vals: number[], sibs?: number[]) => number;
  mode: "sum" | "product" | "cap" | "mixed";
  pureProduct?: boolean;
  hasSib?: boolean;
  context?: boolean[];
}

const close = (a: number, b: number) =>
  Math.abs(a - b) <= 1e-6 * Math.max(1, Math.abs(a), Math.abs(b));
const num = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x);
const CHECK = /^If |yes →|no →/;
const DELIM = /(\s*[×÷+−*/(),^]\s*|\s+-\s+)/;
const SL = "\u0001";
const SR = "\u0002";
const SLOT = new RegExp(`^${SL}(\\d+)${SR}$`);
const prod = (v: number[]) => v.reduce((a, b) => a * b, 1);
const sumOf = (v: number[]) => v.reduce((a, b) => a + b, 0);

/** The ⓘ formula with each kid's name as a slot, checked against the row's value; null when it cannot be recomputed. */
function template(n: ShareNode, sibs: readonly ShareNode[]): Evaluator | null {
  const kids = n.kids ?? [];
  const v = n.v;
  if (!n.formula?.[1] || !kids.length || CHECK.test(n.formula[0])) return null;
  const kv = kids.map((k) => k.v ?? NaN);
  if (!num(v) || !kv.every(num)) return null;
  const names = kids
    .flatMap((k, i): [string, number][] => [
      [k.name, i],
      [k.name.replace(/ \([^()]*\)$/, ""), i],
    ])
    .concat(
      sibs.flatMap((k, j): [string, number][] =>
        k === n ? [] : [[k.name, kids.length + j]],
      ),
    )
    .filter(([nm]) => nm && !/^[\d.]+$/.test(nm))
    .sort((a, b) => b[0].length - a[0].length);
  let s = n.formula[0];
  for (const [nm, i] of names) s = s.split(nm).join(`${SL}${String(i)}${SR}`);
  if (!s.includes(SL)) return null;
  let numeric = n.formula[1];
  const eq = numeric.lastIndexOf(" = ");
  if (eq > 0) numeric = numeric.slice(0, eq);
  const ts = s.split(DELIM);
  const tn = numeric.split(DELIM);
  if (ts.length !== tn.length) return null;
  const parts: (string | { slot: number })[] = [];
  for (let j = 0; j < ts.length; j++) {
    const x = (ts[j] ?? "").trim();
    const y = (tn[j] ?? "").trim();
    if (j % 2) {
      if (x !== y && !(x === "-" && y === "−") && !(x === "−" && y === "-"))
        return null;
      parts.push(ts[j] ?? "");
      continue;
    }
    const m = SLOT.exec(x);
    if (m) parts.push({ slot: Number(m[1]) });
    else if (x === y || /^(min|max|pow|ceil|floor|round|log|log10)?$/.test(x))
      parts.push(x);
    else if (/^-?[\d.,]+(e[+-]?\d+)?$/.test(y.replace(/,/g, ""))) {
      const yv = Number(y.replace(/,/g, ""));
      const by = kv.flatMap((k, i) =>
        yv !== 0 && yv !== 1 && Math.abs(k - yv) <= 5e-4 + 1e-6 * Math.abs(yv)
          ? [i]
          : [],
      );
      parts.push(by.length === 1 ? { slot: by[0] ?? 0 } : y.replace(/,/g, ""));
    } else return null;
  }
  const sib0 = sibs.map((k) => k.v ?? NaN);
  const hasSib = parts.some(
    (p) => typeof p !== "string" && p.slot >= kids.length,
  );
  const raw = (vals: number[], sv: number[] = sib0) =>
    evaluate(
      parts
        .map((p) =>
          typeof p === "string"
            ? p
            : `(${String(p.slot < kids.length ? vals[p.slot] : sv[p.slot - kids.length])})`,
        )
        .join(""),
    );
  const r0 = raw(kv);
  if (!num(r0) || Math.abs(r0 - v) > 2e-3 * Math.max(1, Math.abs(v)))
    return null;
  // The ratio form: the display's rounding cancels.
  const fn = (vals: number[], sv?: number[]) => {
    const r = raw(vals, sv);
    return r0 === 0 ? r : (v * r) / r0;
  };
  const ops = parts.map((p) => (typeof p === "string" ? p : "K")).join("");
  const mode = /min|max/.test(ops)
    ? "cap"
    : /[×÷]/.test(ops)
      ? /[+\-−]/.test(ops)
        ? "mixed"
        : "product"
      : /[+\-−]/.test(ops)
        ? "sum"
        : "mixed";
  return {
    fn,
    hasSib,
    mode,
    pureProduct:
      mode === "product" &&
      !ops.includes("÷") &&
      ops.replace(/[K×()\s]/g, "") === "",
  };
}

/** How a branch comes from its kids: its formula, or a plain sum or product when it has none. */
function evaluator(
  n: ShareNode,
  sibs: readonly ShareNode[] = [],
): Evaluator | null {
  const kids = n.kids ?? [];
  if (!kids.length || !num(n.v)) return null;
  const t = template(n, sibs);
  if (t) return t;
  if (n.formula && CHECK.test(n.formula[0])) return null; // a condition: no guessing
  const v = n.v;
  const vals = kids.map((k) => k.v ?? NaN);
  // The kids that really combine may be a subset (the rest feed a sibling by name); a kid at 0 or 1 never changes a
  // product, so the scan runs over the others.
  const idx = vals.flatMap((x, i) => (num(x) && x !== 0 && x !== 1 ? [i] : []));
  let found: Evaluator | null = null;
  let fits = 0;
  if (idx.length <= 18)
    // ponytail: the bench's 2^n subset scan, only for branches no formula explains.
    for (let mask = (1 << idx.length) - 1; mask > 0; mask--) {
      const inc = vals.map(() => false);
      idx.forEach((i, b) => {
        if ((mask >> b) & 1) inc[i] = true;
      });
      const pick = (x: number[]) => x.filter((_, i) => inc[i]);
      if (
        close(prod(pick(vals)), v) &&
        !close(prod(vals), v) &&
        !close(sumOf(vals), v)
      ) {
        fits++;
        found = {
          fn: (x) => prod(pick(x)),
          mode: "product",
          pureProduct: true,
          context: inc.map((x) => !x),
        };
      }
    }
  if (fits === 1) return found;
  if (close(sumOf(vals), v)) return { fn: sumOf, mode: "sum" };
  if (close(prod(vals), v))
    return { fn: prod, mode: "product", pureProduct: true };
  return null;
}

/** A kid that is context feeds a sibling by name: its weight there, times the sibling's own share. */
function contextShares(
  n: ShareNode,
  ev: Evaluator,
  sh: number[],
): (number | null)[] {
  const kids = n.kids ?? [];
  const context = ev.context ?? [];
  const out: (number | null)[] = kids.map(() => null);
  kids.forEach((kj, j) => {
    if (context[j] || !kj.kids?.length) return;
    const e = evaluator(kj, kids);
    if (!e?.hasSib) return;
    const own = kj.kids.map((k) => k.v ?? NaN);
    const sv = kids.map((k) => k.v ?? NaN);
    const lw = (v1: number) =>
      num(v1) && v1 && kj.v ? Math.abs(Math.log(Math.abs(kj.v / v1))) : 0;
    const drop = (arr: number[], i: number) =>
      arr.map((x, k) => (k === i ? 0 : x));
    const wOwn = own.map((_, i) => lw(e.fn(drop(own, i), sv)));
    const wSib = kids.map((_, i) =>
      context[i] ? lw(e.fn(own, drop(sv, i))) : 0,
    );
    const tot = sumOf(wOwn) + sumOf(wSib);
    if (tot > 0)
      wSib.forEach((w, i) => {
        if (context[i] && w > 0)
          out[i] = (out[i] ?? 0) + (sh[j] ?? 0) * (w / tot);
      });
  });
  return out;
}

const nrm = (w: number[]) => {
  const t = sumOf(w);
  return w.map((x) => (t > 0 ? x / t : 0));
};

/** The shares of n's kids; `sibs` are n's own siblings, which its formula may name. */
export function shares(n: ShareNode, sibs: readonly ShareNode[] = []): Shares {
  const kids = n.kids ?? [];
  const ev = evaluator(n, sibs);
  if (!ev || !num(n.v))
    return {
      mode: n.formula && CHECK.test(n.formula[0]) ? "condition" : "unknown",
      shares: kids.map(() => null),
    };
  const v0 = n.v;
  const vals = kids.map((k) => k.v ?? NaN);
  if (ev.mode === "sum") {
    const allPos = vals.every((x) => x >= 0) && v0 > 0;
    return {
      mode: "sum",
      shares: allPos ? vals.map((x) => x / v0) : nrm(vals.map(Math.abs)),
    };
  }
  if (ev.mode === "product" && ev.pureProduct) {
    const ctx = (i: number) => ev.context?.[i] ?? false;
    const zeros = vals.filter((x, i) => x === 0 && !ctx(i)).length;
    if (zeros)
      return {
        mode: "productZero",
        shares: vals.map((x, i) => (ctx(i) ? null : x === 0 ? 1 / zeros : 0)),
      };
    const own = nrm(
      vals.map((x, i) => (ctx(i) ? 0 : Math.abs(Math.log(Math.abs(x))))),
    );
    const via = ev.context ? contextShares(n, ev, own) : [];
    return {
      mode: "product",
      shares: own.map((x, i) => (ctx(i) ? (via[i] ?? null) : x)),
    };
  }
  // cap / mixed / a product with constants: does a ±1% nudge move the parent (binding), then the log effect of
  // removing the kid.
  const binding = vals.map((x, i) => {
    if (x === 0) return true;
    const up = vals.map((y, k) => (k === i ? x * 1.01 : y));
    const dn = vals.map((y, k) => (k === i ? x * 0.99 : y));
    return !close(ev.fn(up), v0) || !close(ev.fn(dn), v0);
  });
  const w = vals.map((x, i) => {
    if (!binding[i]) return 0;
    const r = vals.map((y, k) => (k === i ? 0 : y));
    let v1 = ev.fn(r);
    if (!num(v1) || v1 === 0 || Math.sign(v1) !== Math.sign(v0)) {
      r[i] = 1; // a multiplier: neutral is 1
      v1 = ev.fn(r);
    }
    if (!num(v1) || v1 === 0 || v0 === 0 || Math.sign(v1) !== Math.sign(v0))
      return Math.abs(x) > 0 ? NaN : 0;
    return Math.abs(Math.log(Math.abs(v0) / Math.abs(v1)));
  });
  const zeroed = w.some((x) => Number.isNaN(x));
  // Removing it flips or zeroes the parent: it is the binding factor.
  const mode = zeroed
    ? ev.mode === "cap"
      ? "capZero"
      : ev.mode === "product"
        ? "productZero"
        : "mixed" // the bench's "mixed-zero": the contract has no such mode
    : ev.mode;
  return {
    mode,
    shares: nrm(zeroed ? w.map((x) => (Number.isNaN(x) ? 1 : 0)) : w),
    binding,
  };
}

const numeric = (v: number | boolean | null) =>
  typeof v === "boolean" ? Number(v) : v;

/** A row of the tree as the share reads it; its own rows are not read (they may not be built yet). */
export const shareNodeOf = (
  n: Pick<CalcTreeNode, "name" | "value">,
  formula: ShareNode["formula"] = null,
): ShareNode => ({ name: n.name, v: numeric(n.value), formula, kids: null });

/**
 * The kids of `parent` with their share and the parent's mode. In a min or max, the kid that does not count now is
 * marked (FR-012): a fixed value is a cap not reached, any other value is over the cap.
 */
export function kidShares(
  parent: Pick<CalcTreeNode, "name" | "value">,
  formula: ShareNode["formula"],
  kids: CalcTreeNode[],
  sibs: readonly ShareNode[] = [],
): CalcTreeNode[] {
  const s = shares(
    { ...shareNodeOf(parent, formula), kids: kids.map((k) => shareNodeOf(k)) },
    sibs,
  );
  return kids.map((k, i) => {
    const out: CalcTreeNode = {
      ...k,
      share: s.shares[i] ?? null,
      shareMode: s.mode,
    };
    if ((s.mode === "cap" || s.mode === "capZero") && s.binding?.[i] === false)
      out.cap = k.leaf === "fixedValue" ? "notReached" : "overTheCap";
    return out;
  });
}
