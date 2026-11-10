// The harness of the mosaic's tests. Every value and character name here is made up (FR-021).
import type { StateSlice } from "../shared/index.ts";
import { createStateStore } from "./state-store.ts";

export type Piece = StateSlice["pieces"][number];
interface Mosaic {
  attrs: Record<string, unknown>;
  vars: Record<string, unknown>;
  skipped: string[];
}

export const WHOLE = { fast: 1, all: 1 };
export const NONE = { fast: 0, all: 0 };

export function setup() {
  const dues: Mosaic[] = [];
  const texts: string[] = [];
  const chars: (string | null)[] = [];
  const store = createStateStore({
    onDue: (json) => {
      texts.push(json);
      dues.push(JSON.parse(json) as Mosaic);
    },
    onCharacter: (c) => chars.push(c),
  });
  const add = (
    pieces: Piece[],
    cycles = NONE,
    sentinel: StateSlice["sentinel"] = { char: "Aria", map: 5 },
  ) => {
    store.add({ sentinel, pieces, at: 1, cycles });
  };
  return { store, add, dues, texts, chars };
}

export const piece = (top: string, value: unknown): Piece => ({
  path: [top],
  value,
});
