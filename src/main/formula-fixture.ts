// Builders of the formula tests in src/main: a tree node with every field, as the tree worker sends it, and the formula
// pipeline over a fake tree host. Every value and name here is invented.
import { vi } from "vitest";
import type { FormulaTree, TreeNode } from "../shared/index.ts";
import { startFormulaPipeline } from "./formula-pipeline.ts";
import type { StatsPair } from "./stats-pipeline.ts";
import { CALCULATED } from "./stats-pipeline-fixture.ts";

export const node = (over: Partial<TreeNode> = {}): TreeNode => ({
  id: "root",
  pieceKey: '[0,"InventedBlock","sub",0,0]',
  name: "Total",
  value: 2.5,
  fmt: "x",
  leaf: null,
  condition: null,
  why: null,
  formula: [
    ["Base", "Bonus"],
    [1, 1.5],
  ],
  code: 'InventedBlock("sub", 0, 0)',
  role: "root",
  share: null,
  shareMode: "sum",
  flags: {},
  kids: [],
  ...over,
});

const NAMES = ["Invented", "Other"];
export const mosaicFor = (char: string, n = 1) =>
  JSON.stringify({
    attrs: { n, UserInfo: [char], GetPlayersUsernames: NAMES },
    vars: { A_invented: 1 },
    skipped: [],
  });
export const pairOf = (char = "Invented", n = 1): StatsPair => ({
  numbers: { ...CALCULATED },
  mosaicJson: mosaicFor(char, n),
  calculatedAt: 1_000 * n,
});

export function pipeline(start: StatsPair | null = pairOf()) {
  let pair = start;
  const sent: FormulaTree[] = [];
  const log = vi.fn();
  const host = {
    request: vi.fn(),
    dropCurrent: vi.fn(),
    setFiles: vi.fn(),
    stop: vi.fn(),
  };
  type Callbacks = Parameters<
    Parameters<typeof startFormulaPipeline>[0]["treeHost"]
  >[0];
  let on: Callbacks | undefined;
  const p = startFormulaPipeline({
    send: (t) => {
      sent.push(t);
    },
    treeHost: (callbacks) => {
      on = callbacks;
      return host;
    },
    statsPair: () => pair,
    log,
  });
  return {
    p,
    sent,
    log,
    host,
    last: () => sent.at(-1),
    setPair(next: StatsPair | null) {
      pair = next;
      p.statsChanged();
    },
    /** The id the host got in its last request. */
    asked: () => host.request.mock.calls.at(-1)?.[0] as number,
    tree: (tree: unknown) => {
      on?.onTree(host.request.mock.calls.at(-1)?.[0] as number, tree);
    },
    answer: (id: number, tree: unknown) => {
      on?.onTree(id, tree);
    },
    unavailable: () => {
      on?.onUnavailable(host.request.mock.calls.at(-1)?.[0] as number);
    },
  };
}
