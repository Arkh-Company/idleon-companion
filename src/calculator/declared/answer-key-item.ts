// A write's place and a constant's item in the answer key (spec 010, T176; spec, Open Questions 23/11), read from the
// call's step log and the game's code in memory only, never from a value. A write's place is the step recorded right
// before it; a constant of the code under an `if` whose test finds an item in a list (`contains(<list>, "76")`) takes
// that item, the literal the code compares.
import type { Op } from "../instrument.ts";
import type { RecNode, RecWrite } from "../recording.ts";
import { astPattern, at } from "../recorded/ast.ts";

/**
 * The root's step at a write's place (`xi`, how many steps had run): its index when that step's last recording is the
 * one right before the write; -1 when it is a step recorded again later (an earlier turn of a loop); else undefined.
 */
export function placeOfWrite(
  top: RecNode,
  stepAt: readonly number[] | undefined,
  xi: number,
  ops?: readonly Op[],
): number | undefined {
  const opAt = (p: number) => top.x?.[p]?.[0];
  const own = opAt(xi - 1);
  if (own === undefined || !stepAt) return undefined;
  // a variable a turn added to (`t += x`) and then wrote: the turn's own assignment, never a step by its value (T177)
  if (ops?.[own]?.kind === "assign") return -1;
  const j = stepAt.findIndex((p) => opAt(p) === own);
  if (j < 0) return undefined;
  return stepAt[j] === xi - 1 ? j : -1;
}

/** `list[item]`: the path a list's item is at, from the code's own text of the list and the item it compares. */
function itemPath(test: Op["node"]): string | undefined {
  if (test.type !== "CallExpression") return undefined;
  const [list, item, ...rest] = test.arguments as Op["node"][];
  if (!list || !item || rest.length > 0 || item.type !== "Literal")
    return undefined;
  const value = String(item.value);
  const pat = astPattern(list);
  if (!/^\d+$/.test(value) || !pat?.root || pat.toks.includes(null))
    return undefined;
  const path = pat.toks
    .map((t, i) =>
      /^\d+$/.test(t ?? "") ? `[${String(t)}]` : `${i ? "." : ""}${String(t)}`,
    )
    .join("");
  return `${path}[${value}]`;
}

/**
 * The item of the test that guards the step recorded at `pos`: the latest test before it, of an `if` of the block
 * whose yes branch holds the step, when it held and finds an item in a list; else undefined.
 */
export function itemOfStep(
  top: RecNode,
  ops: readonly Op[] | undefined,
  pos: number | undefined,
): string | undefined {
  const x = top.x ?? [];
  const step = ops?.[x[pos ?? -1]?.[0] ?? -1];
  if (!ops || !step || pos === undefined) return undefined;
  const [s, e] = step.node.range;
  for (let k = pos - 1; k >= 0; k--) {
    const [id, v] = x[k] ?? [];
    const t = ops[id ?? -1];
    if (t?.kind !== "test" || t.block !== top.b) continue;
    if (t.owner?.type !== "IfStatement") continue;
    const [ys, ye] = at(t.owner, "consequent").range;
    if (s < ys || e > ye) continue;
    return v ? itemPath(t.node) : undefined;
  }
  return undefined;
}

/** A read of the game's own table by an item's name: `ItemDefinitionsGET.<name>.<field>` (T179). */
const TABLE_ROW = /^(?:ItemDefinitionsGET|MonsterDefinitionsGET)\.([^.[\]]+)\./;

/**
 * The save's path that gave the key of a game table's read (T179, the LUK's equipment: `ItemDefinitionsGET[<
 * EquipmentOrder[r][o]>].LUK`): of the call's reads whose text is the row's name, the latest one made before the step
 * recorded at `pos`, by the last of `writes` at or before it (a read keeps the last write before its first read); else undefined.
 * Turns are told apart only by some write between them (any one, the loop's index or another), so it is the slot of the
 * step's own turn, never the first slot with that item; two reads in one stretch between writes tie by nothing.
 */
export function tableItem(
  top: RecNode,
  writes: readonly RecWrite[],
  ref: string,
  pos: number | undefined,
): string | undefined {
  const name = TABLE_ROW.exec(ref)?.[1];
  if (name === undefined || pos === undefined) return undefined;
  const before = writes.filter((w) => w.xi <= pos).at(-1)?.seq ?? 0;
  const hits = (top.r ?? []).filter(
    ([p, v, seq]) =>
      v === name &&
      typeof seq === "number" &&
      seq <= before &&
      !TABLE_ROW.test(p),
  );
  const last = Math.max(...hits.map((h) => Number(h[2])));
  const [only, ...more] = hits.filter((h) => h[2] === last);
  return only && more.length === 0 ? only[0] : undefined;
}
