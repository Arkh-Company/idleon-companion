// A declared call's arguments against its place (spec 010, research R5; moved out of save-args.ts, r1 of parts P and Q):
// the character's index and the save's number are never written out, and a `*` stands only where the game gave the save.
import { callRef } from "./answer-key-pool.ts";
import type { LevelContext } from "./lock-levels.ts";
import type { LockError } from "./lock.ts";
import { CHARACTER, keyMatches, SAVE } from "./refs.ts";
import type { Ref } from "./refs.ts";
import type { RecNode } from "../recording.ts";
import { characterArgs, saveArgs } from "./save-args.ts";

/**
 * A declared call against its place: the character's index and the save's number are never written out, and a `*`
 * stands only where the game gave the save (research R5).
 */
export function writtenArgs(
  ref: Ref | undefined,
  scope: RecNode,
  ctx: LevelContext,
  /** A call list's item's argument (T205): its turn's, no mark to check. */
  skip?: number,
): LockError[] {
  if (
    !ctx.ops ||
    !ref ||
    !("call" in ref) ||
    !keyMatches(ref, callRef(scope), ctx.character)
  )
    return [];
  const arg = (i: number) => `o argumento ${String(i + 1)} de ${ref.call}`;
  const { save, unsure } = saveArgs(ctx.rec, ctx.ops, scope, ctx.rootRef);
  const { yes: character, unsure: unsureCharacter } = characterArgs(
    ctx.rec,
    ctx.ops,
    scope,
    ctx.rootRef,
  );
  const out: LockError[] = [];
  const undecided = (i: number, from: string) =>
    out.push({
      kind: "rootForm",
      where: ctx.where,
      got: `o lugar não decide se ${arg(i)} vem do ${from}`,
    });
  ref.args.forEach((a, i) => {
    if (i === skip) return;
    // what the recipe writes where the place does not decide is refused, `{character}` too, before any other check
    if (unsureCharacter.includes(i)) undecided(i, "personagem");
    else if (unsure.includes(i)) undecided(i, "save");
    else if (character.includes(i)) {
      if (a !== CHARACTER)
        out.push({ kind: "characterWritten", where: ctx.where, got: arg(i) });
    } else if (a === CHARACTER)
      out.push({
        kind: "rootForm",
        where: ctx.where,
        got: `${arg(i)} não vem do personagem`,
      });
    else if (save.includes(i) && a !== SAVE)
      out.push({ kind: "saveWritten", where: ctx.where, got: arg(i) });
    else if (a === SAVE && !save.includes(i))
      out.push({
        kind: "rootForm",
        where: ctx.where,
        got: `${arg(i)} está no código, não vem do save: a receita escreve o número`,
      });
  });
  return out;
}
