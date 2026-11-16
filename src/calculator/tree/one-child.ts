// pieces.cjs `structurePass` from the bench at BASELINE-4 (spec 008, T023): a row whose one child has its value is that
// child, a leaf when the child is one (its type, why and code), else with the child's rows; a vague name or a name that
// is only a sum takes the child's. It runs when the row gets its place, over the level built under it then
// (tree/parent-passes.ts). Left out, each a deviation (research R14): the system's bucket of the bench's V1 page (the
// app's first level has none, tree/mould.ts), and "Multi" and the companion's "Bonus" renamed (the app never gives them:
// tree/raw-passes.ts names the companion's bonus).
import { withName } from "./rows.ts";
import type { Row } from "./rows.ts";

/** Each rule, with what it tests. */
export const ONE_CHILD = {
  /** A name that says nothing of its own: the child's is taken. */
  vague: {
    test: /^(Multi|Multiplier|Bonus|Value)$/,
    proof: "bench pieces.cjs structurePass",
  },
  /** (12/11) the characters of a name that is only a sum, an operator or a call with a literal argument. */
  sum: {
    test: /^[\d\s.()+×÷−\-a-z,]+$/i,
    proof: "bench pieces.cjs structurePass",
  },
};

/** The bench's guard: a chain of single children merged at most this many times. */
export const MERGES = 8;

const callLit = (s: string) => /^\w+\([\d., ]+\)$/.test(s);
/** Whether `name` is only a sum, an operator or a call with a literal argument, here or in the name `under` it. */
export const isSum = (name: string, under: string): boolean =>
  /\d/.test(name) &&
  (/[+×÷−]/.test(name) || callLit(name) || callLit(under)) &&
  ONE_CHILD.sum.test.test(name);

/**
 * Row `n` with the name its child `c` gives it: `c`'s when `n`'s is vague or only a sum and `c`'s is proven (a generic
 * name names nothing, R14).
 */
export function nameFrom(n: Row, c: Row): Row {
  const takes =
    !c.node.flags.unnamed &&
    (ONE_CHILD.vague.test.test(n.node.name) || isSum(n.node.name, c.node.name));
  return takes ? withName(n, c.node.name) : n;
}

/**
 * Row `n` as its one leaf `c`: the leaf's type and why, its code when `n` has none, `n`'s name unless it is vague and
 * the leaf's is proven (R14).
 */
export function leafOf(n: Row, c: Row): Row {
  const vague = ONE_CHILD.vague.test.test(n.node.name);
  const own = vague && !c.node.flags.unnamed ? withName(n, c.node.name) : n;
  return {
    node: {
      ...own.node,
      leaf: c.node.leaf,
      condition: c.node.condition,
      why: c.node.why,
      code: n.node.code ?? c.node.code,
      kids: [],
    },
    open: null,
  };
}
