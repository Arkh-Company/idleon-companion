// A cache read opened by the write it saw, not by its value (fix/tree-scratch-keys, Vinicius 19/11). In the turn of a
// loop being opened, a read of the box with the value of the opening is the total of the earlier turns (EARLIER_TURNS,
// tree/scratch-names.ts) when it saw one of the loop's turns; when it saw the box's start, a write before the turns that
// copied a read (a running total that starts from a source), it opens into that read: the start keeps its source.
import type { Entries } from "./entries.ts";
import type { LoggedRead, ScratchWrite } from "./links.ts";

/** The read the write `own` of `path` copied, when that write is no turn of its writer's loop; else null. */
export function startSource(
  own: ScratchWrite | null,
  path: string,
  entries: Entries,
): LoggedRead | null {
  if (!own) return null;
  const turns = entries.get(`${String(own.call.id)}|${path}`) ?? [];
  if (turns.some((q) => q.seq === own.seq)) return null;
  return own.source() ?? null;
}
