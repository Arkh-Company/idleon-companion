// The game's code as the steps read it (spec 008, T022): the acorn helpers of build-tree.cjs step 8d at BASELINE-4, the
// closed MATH list a step may name, a block's call (`_customBlock_`) and the path a node of the code reads (`astPattern`).
import type { Op } from "../instrument.ts";

/** An acorn node, read by field name. */
export type AstNode = Op["node"];
export const at = (n: AstNode, k: string) => n[k] as AstNode;
export const MATH = new Set([
  "min",
  "max",
  "pow",
  "floor",
  "ceil",
  "round",
  "abs",
  "log",
  "sqrt",
]);
export const CUSTOM = "_customBlock_";

/** The name of a call's method (`a.b(…)` → "b"), or null when the callee is no member. */
export function methodOf(n: AstNode): string | null {
  if (n.type !== "CallExpression") return null;
  const callee = at(n, "callee");
  if (callee.type !== "MemberExpression") return null;
  const name = (callee.property as AstNode | undefined)?.name;
  return typeof name === "string" ? name : null;
}

/** `asNumber(x)` is x. */
export function unwrap(n: AstNode): AstNode {
  const [a, ...rest] = (n.arguments as AstNode[] | undefined) ?? [];
  return methodOf(n) === "asNumber" && a && !rest.length ? unwrap(a) : n;
}
/** C (inv-2): the path a node reads, from its own text: the constant keys in order, a computed key as null. */
export function astPattern(
  node: AstNode,
): { toks: (string | null)[]; root: boolean } | null {
  let n = unwrap(node);
  const toks: (string | null)[] = [];
  let root = false;
  for (;;) {
    if (n.type === "MemberExpression") {
      const prop = at(n, "property");
      if (n.computed)
        toks.push(prop.type === "Literal" ? String(prop.value) : null);
      else if (prop.name !== "h") toks.push(prop.name as string);
      n = at(n, "object");
      continue;
    }
    const arg = (n.arguments as AstNode[] | undefined)?.[0];
    if (methodOf(n) === "getGameAttribute" && arg?.type === "Literal") {
      toks.push(String(arg.value));
      root = true;
    }
    break;
  }
  toks.reverse();
  if (!toks.length || (!root && toks.length < 2)) return null;
  // a length is a guard of the code, not a number of the formula
  if (toks[toks.length - 1] === "length") return null;
  return { toks, root };
}
export function matchPattern(
  path: string,
  pat: { toks: (string | null)[]; root: boolean },
) {
  const P = path.split(/[^A-Za-z0-9_$]+/).filter(Boolean);
  const T = pat.toks;
  if (pat.root ? P.length !== T.length : P.length < T.length) return false;
  return T.every((t, i) => t === null || t === P[P.length - T.length + i]);
}

/**
 * The node whose text a number was read from, through `asNumber(replace("" + string(x), mark, ""))` (spec 010, T209,
 * form 2: the game's "50TOT"); null for any other node.
 */
function textOf(node: AstNode): AstNode | null {
  const n = unwrap(node);
  if (methodOf(n) !== "replace") return null;
  let a = (n.arguments as AstNode[] | undefined)?.[0];
  if (a?.type === "BinaryExpression" && at(a, "left").value === "")
    a = at(a, "right");
  if (a && methodOf(a) === "string") a = (a.arguments as AstNode[])[0];
  return a ?? null;
}

/** The one read whose text the number `v` was read from (textOf), by the path the code names; null with none or two. */
export function textRead(
  node: AstNode,
  pool: readonly (readonly [string, unknown])[],
  v: number,
): string | null {
  const tn = textOf(node);
  const pat = tn ? astPattern(tn) : null;
  const hits = pat
    ? pool.filter(
        ([p, val]) =>
          typeof val === "string" &&
          matchPattern(p, pat) &&
          Number.parseFloat(val) === v,
      )
    : [];
  return hits.length === 1 ? (hits[0]?.[0] ?? null) : null;
}

/** Each block's parameters, from its function's text (spec 010, T209, form 1). */
export function blockParams(ops: readonly Op[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const o of ops)
    if (!out.has(o.block))
      out.set(
        o.block,
        (/function\s*\(([^)]*)\)/.exec(o.fnText)?.[1] ?? "")
          .split(",")
          .map((p) => p.trim()),
      );
  return out;
}
