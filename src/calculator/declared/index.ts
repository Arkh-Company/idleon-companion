// The declared engine's API (spec 010, plan "Source Code"): the blueprints and the answer key the tree engine reads.
// review.ts stays out: the app never reads a review (contracts/review.md).
export { answerKey } from "./answer-key.ts";
export type {
  AnswerKey,
  AnswerPool,
  AnswerTerm,
  RootFormError,
} from "./answer-key.ts";
export type {
  Blueprint,
  BlueprintGroup,
  BlueprintNode,
  BlueprintPool,
  BlueprintStage,
  ConditionKind,
  LeafKind,
} from "./blueprint.ts";
export { blueprintOf } from "./blueprints.ts";
