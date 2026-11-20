// A floor or a cap of the game around a product of factors of one source each (fix tree-shape-091, rule 3; the clamp's
// answer B): max(1, (1 + a) × (1 + b) × (1 + 2 × c)), the companions of the max damage and of the Drop Rate. Its
// factors are rows of their own (tree/terms.ts), which go into their system's group with the rule in its ⓘ.
import { flat, stateSrc } from "./expr.ts";
import { strip } from "./scaled.ts";
import type { Expr } from "./steps.ts";

/** The rule, the bound and the factors of max(c, product) or min(c, product) of two factors or more, each of one source; else null. */
export function clampedProduct(
  e: Expr,
): { fn: "max" | "min"; bound: number; factors: Expr[] } | null {
  const x = strip(e);
  if (x.t !== "fn" || (x.name !== "max" && x.name !== "min")) return null;
  const [a, b] = x.args;
  if (x.args.length !== 2 || !a || !b) return null;
  const [bound, inner] = a.t === "num" ? [a, b] : [b, a];
  if (bound.t !== "num" || inner.t === "num") return null;
  const factors = flat(strip(inner), "*");
  return factors.length >= 2 && factors.every((f) => stateSrc(f) === 1)
    ? { fn: x.name, bound: Number(bound.v), factors }
    : null;
}
