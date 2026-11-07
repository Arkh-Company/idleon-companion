// The module registry (spec §6.3): the window shows the panels whose `matches` is true.
import type { CompanionModule, GameContext } from "./types.ts";

export function modulesFor(
  ctx: GameContext,
  all: CompanionModule[],
): CompanionModule[] {
  return all.filter((m) => m.matches(ctx));
}
