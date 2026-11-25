// The draft of a blueprint (spec 010, research R7, FR-004, FR-009): what the machine proves of a number from its
// answer key and its recording, for an agent to finish. The pools in the game's order; each source and constant in a
// group of its own, by its structured reference; below each source, the parts the lock asks for (lock-levels.ts
// partsOf), level by level, down to the leaves the recording shows. A name only with its proof in the names table, a
// talent's class only from the game's talent order; anything else is pending (`name`, `system`, `leaf`, `descend`),
// never guessed. The draft carries no value, count or expression, and its JSON is already as prettier leaves it.
import type { Op } from "../instrument.ts";
import type { Recording } from "../recording.ts";
import { makeSteps } from "../recorded/steps.ts";
import type { AnswerKey, PoolKind } from "./answer-key.ts";
import type {
  Blueprint,
  BlueprintNode,
  BlueprintPending,
} from "./blueprint.ts";
import { classesOf, sourceClass } from "./draft-class.ts";
import { linkedTree } from "./draft-link.ts";
import {
  callListOf,
  callModel,
  ITEM,
  listOf,
  modelName,
} from "./draft-list.ts";
import type { ListModel } from "./draft-list.ts";
import { branchOf, COMMON_BRANCHES, piecePasses } from "./draft-pieces.ts";
import type { CommonBranch, DraftPiece } from "./draft-pieces.ts";
import { codeOf, keyIn, partName, refOf } from "./draft-names.ts";
import { walkTerm } from "./draft-walk.ts";
import type { Walked } from "./draft-walk.ts";
import type { LevelContext } from "./lock-levels.ts";
import { unmarked } from "./refs.ts";
import { markedRef } from "./save-args.ts";

export interface DraftContext {
  /** The recorded character: a read of its own is `{character}`, another's `*` (research R5). */
  character: number;
  /** The game's `CustomLists.TalentOrder`, for a talent source's class; empty gives none. */
  talentOrder: readonly unknown[];
  /** The game's ReturnClasses of each class (T207): a talent's classes are each class whose tabs hold its tab. */
  families?: ReadonlyMap<number, readonly number[]>;
  /** The blueprints of `blueprints/` (T200): a part that is the root of one is a line with a link to its tree. */
  trees?: readonly Pick<Blueprint, "id" | "root">[];
  /** The common branches (T203): a part that calls one is a line with its piece; COMMON_BRANCHES by default. */
  branches?: readonly CommonBranch[];
}
export const NO_CONTEXT: DraftContext = { character: 0, talentOrder: [] };

export { gameList, sourceClass, talentClass } from "./draft-class.ts";

export type DraftNode = Omit<BlueprintNode, "name" | "children"> & {
  /** Null where `pending` says `name`. */
  name: string | null;
  children?: DraftNode[];
};
export interface DraftBlueprint {
  id: string;
  root: Blueprint["root"];
  pools: {
    kind: PoolKind;
    weight?: 0.01;
    groups: { system: string | null; sources: DraftNode[] }[];
  }[];
  pending: BlueprintPending[];
  /** The pieces of its common branches (T203), each written apart, never in the draft's JSON. */
  pieces?: DraftPiece[];
  /** Why a common branch's line is written whole, for the guide: never in the draft's JSON. */
  notes?: string[];
}

export { walkTerm };
export type { Walked };

export { marked, partName, provenName } from "./draft-names.ts";

export function draftBlueprint(
  id: string,
  root: Blueprint["root"],
  key: AnswerKey,
  rec: Recording,
  ops: readonly Op[],
  dc: DraftContext = NO_CONTEXT,
): DraftBlueprint {
  const made = makeSteps(rec, ops);
  const ctx: LevelContext = {
    rec,
    stepsOf: (n) => made.of(n),
    turnOf: made.turnOf,
    character: dc.character,
    where: id,
    ops,
  };
  const pending: BlueprintPending[] = [];
  const passes = piecePasses();
  const wait = (
    where: string,
    kind: BlueprintPending["kind"],
    sink = pending,
  ) => {
    sink.push({ where, kind });
  };

  /** A list's model child: its item's read, a name only when it gives each item's own, one pending each (T202). */
  const model = (l: ListModel, where: string, sink: BlueprintPending[]) => {
    const names = l.items.map(
      (w) => partName(w, dc.character, rec, ops, root.ref)?.name ?? null,
    );
    const name = modelName(names, l.indices);
    if (name === null) wait(where, "name", sink);
    wait(where, "leaf", sink);
    // each item's proof is its own path (draft-names.ts provenName): the model's, its read
    return {
      key: keyIn(new Set(), l.list.replace("[*]", "")),
      name,
      ...(name !== null && { nameProof: { names: l.read } }),
      ref: { read: l.read },
    };
  };

  /** A part's node; its pending places go to `sink`, the recipe's by default. */
  const node = (
    w: Walked,
    where: string,
    taken: Set<string>,
    extra: Partial<DraftNode> = {},
    sink = pending,
  ): DraftNode => {
    const code = refOf(w, dc.character);
    // the argument the game gave from the character's index is `{character}`, by its place (character-args.ts)
    const ref = w.call ? markedRef(code, rec, ops, w.call, root.ref) : code;
    // the names table goes by the game's own arguments; a name proven by the character's index waits for the agent's
    // proof by the row (research R5), and the key keeps only the other arguments
    const named = partName(w, dc.character, rec, ops, root.ref);
    if (!named) wait(where, "name", sink);
    if (w.termPart) wait(where, "system", sink);
    const tree = linkedTree(ref, id, dc.trees ?? [], dc.character);
    const own = new Set<string>();
    const keyRef = unmarked(ref);
    const below = tree === undefined && Array.isArray(w.below) ? w.below : null;
    // a long list below a node, never a pool's source (its each is the answer key's): one model child (T202)
    const list =
      below && where.includes("/children/")
        ? listOf(below, dc.character)
        : null;
    // a list of calls of one block (T205): one model, its descent the agent's, its name too (each item has its own)
    const calls = below && !list ? callListOf(below) : null;
    // a common branch (T203): its children's pending places wait for the piece's verdict
    const branch =
      below && !list && !calls
        ? branchOf(ref, dc.branches ?? COMMON_BRANCHES)
        : null;
    const mine: BlueprintPending[] = branch ? [] : sink;
    const children = list
      ? [model(list, `${where}/children/0`, mine)]
      : calls && below
        ? [
            callModel(below, calls, rec, ops, root.ref, (k) => {
              wait(`${where}/children/0`, k, mine);
            }),
          ]
        : below?.map((c, i) =>
            node(c, `${where}/children/${String(i)}`, own, {}, mine),
          );
    const use =
      branch && children
        ? passes.meet({ where, branch, children, pending: mine })
        : null;
    if (branch) sink.push(...(use ? use.pending : mine));
    const out: DraftNode = {
      key: keyIn(taken, "call" in keyRef ? codeOf(keyRef, w.key) : keyRef.read),
      name: named?.name ?? null,
      ...(named ? { nameProof: named.nameProof } : {}),
      ref,
      ...extra,
      ...(tree !== undefined
        ? { tree }
        : use
          ? { piece: use.piece }
          : {
              ...(list && { each: { list: list.list, as: ITEM } }),
              ...(calls && { each: { calls: calls.block, as: ITEM } }),
              ...(children && { children }),
            }),
    };
    // a line with a link waits for nothing below it: its tree is the other number's
    if (tree !== undefined) return out;
    if (!Array.isArray(w.below)) wait(where, w.below, sink);
    // any other argument of a leaf call equal to the character's index may be the character or a number that happens
    // to be it: the agent writes `{character}` or keeps it (research R5); a node with children is descended already
    if (
      w.below !== "descend" &&
      !children &&
      "call" in ref &&
      ref.args.includes(dc.character)
    )
      wait(where, "descend", sink);
    return out;
  };

  const poolOf = (p: AnswerKey["pools"][number], i: number) => {
    const weight =
      p.kind === "additive" && p.terms.some((t) => t.weight === 0.01)
        ? 0.01
        : 1;
    const taken = new Set<string>();
    const groups = p.terms.map((t, j) => {
      const gw = `pools/${String(i)}/groups/${String(j)}`;
      wait(gw, "system");
      const sw = `${gw}/sources/0`;
      // a source's own weight only where it differs from its pool's (the curve of the LUK at 1 in a pool of 0.01)
      const own = p.kind === "additive" && t.weight !== weight;
      const extra = own ? { weight: t.weight } : {};
      if (t.kind === "constant") {
        wait(sw, "name");
        const constant: DraftNode = {
          key: keyIn(taken, `constant ${String(t.value)}`),
          name: null,
          constant: t.value,
          ...extra,
          leaf: "fixedValue",
        };
        return { system: null, sources: [constant] };
      }
      const c = sourceClass(rec.nodes[t.nodes[0] ?? -1], dc.talentOrder);
      const classes = c === null ? {} : { classes: classesOf(c, dc.families) };
      return {
        system: null,
        sources: [node(walkTerm(t, ctx), sw, taken, { ...extra, ...classes })],
      };
    });
    return {
      kind: p.kind,
      ...(weight === 0.01 ? { weight: 0.01 as const } : {}),
      groups,
    };
  };
  // the first pass sees the common branches' occurrences, the second writes them by the plan
  key.pools.forEach(poolOf);
  passes.plan();
  pending.length = 0;
  const pools = key.pools.map(poolOf);
  const written = [...passes.pieces.values()].map((p): DraftPiece => ({
    id: p.id,
    params: p.params,
    children: p.children,
  }));
  return {
    id,
    root,
    pools,
    pending,
    ...(written.length > 0 && { pieces: written }),
    ...(passes.notes.length > 0 && { notes: passes.notes }),
  };
}
