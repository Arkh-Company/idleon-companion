// Golden Food (spec 008, T023): the port of pieces.cjs `explainRaw` `goldFood` from the bench at BASELINE-4. The block's
// steps vary by its key: [the shared multiplier, the worn food?, …, the emporium's?]. Step 0 is the multiplier, a set's
// multi × (the Family Bonus 66, at least 1, + its sources ÷ 100); the worn food is an op at step 1 with a log call of
// its own (its quantity); the emporium's is the last op "+" after it with a log call (its level), added to the bonus
// the block had before. Each row has the ⓘ of its step. A food is named by the item table's text (tree/table-names.ts);
// with none, its row keeps the generic name (the bench writes the item's id).
import type { RecNode, RecValue } from "../recording.ts";
import type { CodeFormulas } from "./code-formulas.ts";
import { fx3 } from "./curves.ts";
import { flat, topOp } from "./expr.ts";
import type { Pair } from "./formulas.ts";
import { near } from "./math.ts";
import { isNameText } from "./name-text.ts";
import { row, valueOf } from "./rows.ts";
import type { Row } from "./rows.ts";
import type { Expr, Step } from "./steps.ts";
import { termOf } from "./share.ts";
import { tableText } from "./table-names.ts";
import type { Reads } from "./val-path.ts";

export const GOLD_FOOD = {
  test: /^GoldFoodBonuses$/,
  proof: "bench pieces.cjs explainRaw goldFood NR-G 1; N.js GoldFoodBonuses",
};

export interface GoldFoodContext {
  nodes: readonly RecNode[];
  /** One term of a sum as a row, with no step around it (tree/terms.ts `term`). */
  term(e: Expr, op: "+", reads: Reads): Row | null;
  /** A level's rows with their types and shares, under a parent of value `v` (rows.ts `finish`). */
  finish(v: unknown, rows: Row[], ones: boolean): Row[];
  formulas: CodeFormulas;
}

/** The log calls of an expression, in order: the bench's `logsOf` walks an op's sides and a function's arguments only. */
function logsOf(e: Expr | undefined, nodes: readonly RecNode[]): Expr[] {
  if (!e) return [];
  const here = e.t === "call" && nodes[e.id]?.b === "getLOG" ? [e] : [];
  const subs = e.t === "op" ? [e.l, e.r] : e.t === "fn" ? e.args : [];
  return [...here, ...subs.flatMap((x) => logsOf(x, nodes))];
}

/**
 * A row of the pass with a fixed name, or the generic one when `name` is null; `f` is its finished ⓘ, `xf` its step's,
 * `fmt` "x" a multiplier's.
 */
function part(
  name: string | null,
  value: unknown,
  group: Row[] = [],
  ip: { f?: Pair | null; xf?: Pair | null; fmt?: "x" } = {},
): Row {
  return {
    node: row({
      pieceKey: null,
      value: valueOf(value as RecValue),
      code: null,
      ...(name === null ? {} : { name }),
      ...(ip.fmt ? { fmt: ip.fmt } : {}),
    }),
    open: null,
    ...(group.length ? { group } : {}),
    ...(ip.f ? { f: ip.f } : {}),
    ...(ip.xf ? { xf: ip.xf } : {}),
  };
}
/** A source in the sources' ⓘ: its name without its tag in parentheses, or its code when it has no name. */
export const sourceTerm = (r: Row) =>
  r.node.flags.unnamed
    ? termOf(r.node)
    : r.node.name.replace(/\s*\(.*?\)\s*$/, "");
/** "<what>: <the food's text>", when the item has a text and the whole is a name. */
function foodName(what: string, text: string | null): string | null {
  const name = text === null ? null : `${what}: ${text}`;
  return name !== null && isNameText(name) ? name : null;
}

const slotOf = (k: string) => Number(/\[(\d+)\]$/.exec(k)?.[1]);
/**
 * The quantity read of the food that counts (A18): N.js GoldFoodBonuses walks the slots i = 0 … n − 1 and sets the bonus
 * to slot i's product for each slot whose food is of the effect, so the last such slot i is the one that counts.
 */
const quantityKey = (reads: Reads) =>
  [...reads.keys()]
    .filter((k) => /^EquipmentQuantity\[2\]\[\d+\]$/.test(k))
    .sort((a, b) => slotOf(a) - slotOf(b))
    .at(-1);
/** The texts of the worn food and of the emporium's (the worn food's when it has none), from the block's reads. */
function foodTexts(reads: Reads): {
  foodText: string | null;
  emText: string | null;
} {
  const qtyKey = quantityKey(reads);
  const slot = qtyKey && /\[(\d+)\]$/.exec(qtyKey)?.[1];
  const food = slot ? reads.get(`EquipmentOrder[2][${slot}]`) : undefined;
  const foodText = typeof food === "string" ? tableText("item", food) : null;
  const niKey = [...reads.keys()].find((k) => /^Ninja\[104\]\[\d+\]$/.test(k));
  const ni = niKey && /\[(\d+)\]$/.exec(niKey)?.[1];
  const emFood = ni
    ? reads.get(`CustomLists.NinjaInfo[29][${String(2 + 3 * Number(ni))}]`)
    : undefined;
  const emText =
    (typeof emFood === "string" ? tableText("item", emFood) : null) ?? foodText;
  return { foodText, emText };
}
/**
 * The emporium's row name, "Beanstalk: <the food's text>", or null with no text (spec 009, 009 r2; the Vinicius's name
 * of 19/11). N.js GoldFoodBonuses adds the food i of NinjaInfo[29][2 + 3i] when Ninja[104][i] > 0, the level of the
 * Jade Emporium's upgrade the game names "Gold Food Beanstalk" ("Grows a giant beanstalk behind the ninja castle!").
 */
export const emporiumName = (reads: Reads): string | null =>
  foodName("Beanstalk", foodTexts(reads).emText);
/**
 * Whether a log call of argument `arg` measures a worn food: N.js GoldFoodBonuses takes getLOG(1 + quantity) of a food
 * slot's quantity, and the emporium's getLOG(1 + 1e3·10^level) (009 T023 r4).
 */
export const measuresWorn = (arg: unknown, reads: Reads): boolean =>
  [...reads].some(
    ([k, v]) =>
      /^EquipmentQuantity\[2\]\[\d+\]$/.test(k) && near(arg, 1 + Number(v)),
  );
/** The worn food's row name, "Equipped: <the food's text>", or null with no text (009 T023 r3). */
export const equippedName = (reads: Reads): string | null =>
  foodName("Equipped", foodTexts(reads).foodText);

/**
 * The shared multiplier's ⓘ, its step `s0` (bench pieces.cjs goldFood): SECRET_SET multi × (max(Family Bonus 66, 1) +
 * Sources ÷ 100), when the step gives it; else null.
 */
export function multiFormula(s0: Step, reads: Reads): Pair | null {
  const [secret, rest] = flat(s0.e, "*");
  const div =
    rest?.t === "op" && rest.r.t === "op" && rest.r.o === "/" ? rest.r : null;
  const sumE = div?.l ?? null;
  const famV = Math.max(Number(reads.get("DNSM.FamBonusQTYs[66]")) || 0, 1);
  const sumV = Number(sumE?.v);
  return sumE && secret && near(Number(secret.v) * (famV + sumV / 100), s0.v)
    ? [
        "SECRET_SET multi × (max(Family Bonus 66, 1) + Sources ÷ 100)",
        `${fx3(Number(secret.v))} × (${fx3(famV)} + ${fx3(sumV / 100)}) = ${fx3(s0.v)}`,
      ]
    : null;
}

/** The rows of a Golden Food block with its four steps or more, or null for any other block. */
export function goldFood(
  n: RecNode,
  steps: readonly Step[],
  reads: Reads,
  ctx: GoldFoodContext,
): Row[] | null {
  const s0 = steps[0];
  if (!GOLD_FOOD.test.test(n.b) || steps.length < 4 || !s0) return null;
  const { nodes } = ctx;
  const logs = (st: Step | null | undefined) => logsOf(st?.e, nodes);
  const s1 = steps[1]?.e.t === "op" && logs(steps[1]).length ? steps[1] : null;
  const s3 =
    steps
      .slice(2)
      .reverse()
      .find((st) => topOp(st.e) === "+" && logs(st).length) ?? null;
  // the food bonus before the emporium adds to it: the read of the bonus on the left of the sum, else the worn food's
  const left = s3?.e.t === "op" ? s3.e.l : null;
  const before3 =
    left?.t === "read" && left.p === "DNSM.GfoodBonus"
      ? Number(left.v)
      : (s1?.v ?? 0);
  const [secret, rest] = flat(s0.e, "*");
  // rest = max(Family, 1) + (Σ sources) ÷ 100
  const div =
    rest?.t === "op" && rest.r.t === "op" && rest.r.o === "/" ? rest.r : null;
  const sumE = div?.l ?? null;
  const sources = sumE
    ? flat(sumE, "+").flatMap((x) => ctx.term(x, "+", reads) ?? [])
    : [];
  const fam = reads.get("DNSM.FamBonusQTYs[66]");
  // the bench reads the set's parts with no reads of the block
  const secretKids =
    secret?.t === "op" && secret.r.t === "op"
      ? flat(secret.r.l, "+").flatMap((x) => ctx.term(x, "+", new Map()) ?? [])
      : [];
  const amount = reads.get("DNSM.GfoodMap.Amount");
  const qtyKey = quantityKey(reads);
  const { foodText, emText } = foodTexts(reads);
  // the ⓘ of these rows, from the steps of the block
  const sumV = Number(sumE?.v);
  const multiF = multiFormula(s0, reads);
  // the sources as the step adds them, before a level groups those at 0
  const sourcesF: Pair | null =
    sources.length >= 2 &&
    near(
      sources.reduce((a, x) => a + Number(x.node.value), 0) / 100,
      sumV / 100,
    )
      ? [
          `(${sources.map(sourceTerm).join(" + ")}) ÷ 100`,
          `(${sources.map((x) => fx3(Number(x.node.value))).join(" + ")}) ÷ 100 = ${fx3(sumV / 100)}`,
        ]
      : null;
  const emE = s3?.e.t === "op" ? s3.e.r : undefined;
  // each level's rows with their types and shares, none of them a product's
  const level = (v: unknown, rows: Row[]) => ctx.finish(v, rows, false);
  return [
    part(
      "GFood Multi",
      s0.v,
      level(s0.v, [
        part("Family Bonus 66", fam),
        part("Sources ÷ 100", sumE ? sumV / 100 : null, level(sumV, sources), {
          f: sourcesF,
        }),
        part("SECRET_SET multi", secret?.v, level(secret?.v, secretKids), {
          xf: secret ? ctx.formulas.expr(secret, reads, secret.v, 1) : null,
          fmt: "x",
        }),
      ]),
      { f: multiF, fmt: "x" },
    ),
    ...(s1
      ? [
          part(
            foodName("Equipped", foodText),
            s1.v,
            level(s1.v, [
              part("Base Amount", amount),
              part("Quantity", qtyKey ? reads.get(qtyKey) : null),
              part("Log Factor", logs(s1)[0]?.v),
            ]),
            { xf: ctx.formulas.expr(s1.e, reads, s1.v, 1) },
          ),
        ]
      : []),
    ...(s3
      ? [
          part(
            foodName("Beanstalk", emText),
            s3.v - before3,
            level(s3.v - before3, [
              part("Base Amount", amount),
              part("Log Factor", logs(s3)[0]?.v),
            ]),
            { xf: ctx.formulas.expr(emE, reads, s3.v - before3, 1) },
          ),
        ]
      : []),
  ];
}
