// The blueprint's types (spec 010, data-model.md "Receita", contracts/blueprint.md): its shape, never a value, a
// formula or the game's code. blueprint.ts checks a blueprint against them on load and re-exports them.
import type {
  CALC_CONDITION_KINDS,
  CALC_LEAF_KINDS,
} from "../tree-contract.ts";
import type { Ref } from "./refs.ts";

export type LeafKind = Exclude<(typeof CALC_LEAF_KINDS)[number], "unknown">;
export type ConditionKind = (typeof CALC_CONDITION_KINDS)[number];
export type NameProof =
  { table: string; row: number | string } | { names: string };

export interface BlueprintNode {
  key: string;
  /** In a draft, null where `pending` says `name`. */
  name: string;
  nameProof?: NameProof;
  ref?: Ref;
  /** A loose constant of a pool (the `+ 2`, the `× 1.2`): no `ref`, leaf `fixedValue`. */
  constant?: number;
  weight?: number;
  classes?: readonly number[];
  condition?: BlueprintNode;
  termPart?: { system: string };
  children?: readonly BlueprintNode[];
  leaf?: LeafKind;
  conditionKind?: ConditionKind;
  /** A recipe piece in place of the children (T169): on load, its body, the args filled in, comes in its place. */
  piece?: { name: string; args: PieceArgs };
  /** Only in a piece: the level closes by the sum or the product of its children (T171). */
  combine?: "sum" | "product";
  /** Only in a piece: the one model child stands for one child per item of the recorded list (T170). */
  each?: { list: string; as: string };
}
/** A piece's args: a value for each of its params, in place of `{param}` in its references. */
export type PieceArgs = Readonly<Record<string, string | number>>;
/**
 * A recipe piece (T169; GLOSSARY "Recipe piece", never a "Tree piece"): `blueprints/pieces/<id>.piece.json`, the count
 * and the children a node that calls it takes.
 */
export interface BlueprintPiece {
  id: string;
  params: readonly string[];
  combine: "sum" | "product";
  each?: { list: string; as: string };
  children: readonly BlueprintNode[];
}
export interface BlueprintGroup {
  /** In a draft, null where `pending` says `system`. */
  system: string;
  sources: readonly BlueprintNode[];
}
export interface BlueprintPool {
  kind: "additive" | "multi";
  weight?: 1 | 0.01;
  groups: readonly BlueprintGroup[];
}
export interface BlueprintPending {
  /** The place in the file: `pools/0/groups/1/sources/2/children/0`. */
  where: string;
  kind: "name" | "system" | "leaf" | "descend";
}
export type CallRef = Extract<Ref, { call: string }>;
/**
 * The root (spec, Open Questions 21/11; ADR 0010: never a calculation): one call, or the sum of several calls (Tome
 * Score); a call may name its `part`, the recorded step that holds those references (a reducer inside a cost), and a
 * `scratch` marker, set only on the copy of the game the recorder runs on, before the call.
 */
export interface BlueprintRoot {
  name: string;
  nameProof?: NameProof;
  ref?: CallRef;
  combine?: "sum";
  calls?: readonly CallRef[];
  part?: readonly Ref[];
  /** The list a branch of the call's loop searches: only the turns that found their item there give the part (T163). */
  branch?: string;
  scratch?: Readonly<Record<string, string | number>>;
  /** A routine of the game run on the recorder's copy only (a block, or a helper actor's event; T152)… */
  routine?: RoutineStep | readonly RoutineStep[];
  /** …and the state path, `[*]` for any index, whose written values it sums (through a helper too). */
  sum?: string;
  /** The index of the item of the list the call returns (TotalTalentPoints(…)[tab], T159). */
  item?: number;
}
export type RoutineStep =
  | CallRef
  | {
      slot: number;
      behavior: string;
      event: string;
      args?: readonly (string | number)[];
      /** A field of the helper set before the event (the text that triggers it, as `_TRIGGEREDtext`). */
      set?: readonly [string, string | number];
    };
export interface Blueprint {
  id: string;
  root: BlueprintRoot;
  /** Empty in a sketch. */
  pools: readonly BlueprintPool[];
  pending?: readonly BlueprintPending[];
}
export type BlueprintStage = "sketch" | "draft" | "complete";
