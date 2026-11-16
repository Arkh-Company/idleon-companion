// The marks and pins channels (contracts/ipc.md) over the files saved on the player's machine (saved-files.ts): each
// payload checked first, and nothing of a character's name ever saved (FR-010a). No electron import, so tests can load
// it.
import { IPC } from "../shared/index.ts";
import type { Pin } from "../shared/index.ts";
import { hasName, holdsName } from "./character-names.ts";
import {
  emptyPayload,
  markPayload,
  marksListPayload,
  pinsPayload,
} from "./payloads.ts";
import type { savedFiles, Values } from "./saved-files.ts";

export const MARK_WITH_NAME = "A mark's name can't have a character's name.";

/**
 * The marks channels (contracts/ipc.md), each payload checked first. A mark takes the open tree's values (`open`); a
 * piece whose key holds a character's name is left out, and a mark's name with one is refused (FR-010a).
 */
export function marksHandlers(
  marks: ReturnType<typeof savedFiles>["marks"],
  open: (character: number) => { values: Values; names: string[] } | null,
): Record<string, (payload: unknown) => unknown> {
  return {
    [IPC.marksList]: (payload) => {
      const r = marksListPayload(payload);
      if (!r) throw new Error("marks:list: invalid request");
      return { marks: marks.list(r.character), warning: marks.warning() };
    },
    [IPC.marksSave]: (payload) => {
      const r = markPayload(payload);
      if (!r) throw new Error("marks:save: invalid mark");
      const tree = open(r.character);
      if (!tree) throw new Error("marks:save: no tree open for that character");
      if (hasName(r.name, tree.names)) return MARK_WITH_NAME;
      const values = Object.fromEntries(
        Object.entries(tree.values).filter(
          ([key]) => !holdsName(key, tree.names),
        ),
      );
      return marks.save(r.character, r.name, values);
    },
    [IPC.marksClear]: (payload) => {
      const r = markPayload(payload);
      if (!r) throw new Error("marks:clear: invalid mark");
      return marks.clear(r.character, r.name);
    },
  };
}

/** The pins channels (contracts/ipc.md), each payload checked first; `pinned` hears each list kept. */
export function pinsHandlers(
  pins: ReturnType<typeof savedFiles>["pins"],
  pinned: (list: Pin[]) => void,
): Record<string, (payload: unknown) => unknown> {
  return {
    [IPC.pinsGet]: (payload) => {
      if (!emptyPayload(payload)) throw new Error("pins:get: invalid request");
      return { pins: pins.get(), warning: pins.warning() };
    },
    [IPC.pinsSet]: (payload) => {
      const list = pinsPayload(payload);
      if (!list) throw new Error("pins:set: invalid pins");
      const refused = pins.set(list);
      pinned(pins.get());
      return refused;
    },
  };
}
