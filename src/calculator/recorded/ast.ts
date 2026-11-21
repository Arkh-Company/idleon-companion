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
function unwrap(n: AstNode): AstNode {
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
