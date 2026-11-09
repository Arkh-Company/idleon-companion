import { expect, test } from "vitest";
import type { CompanionModule, GameContext } from "./index.ts";
import { modulesFor } from "./index.ts";

const ctx: GameContext = {
  screen: { world: 6, map: 264, label: "None" },
  character: null,
  afk: null,
  names: { map: "Unknown map", afk: "None" },
  updatedAt: 1,
};

const module = (id: string, matches: boolean): CompanionModule => ({
  id,
  title: id,
  needs: ["live-screen"],
  matches: () => matches,
  Panel: () => null,
});

test("modulesFor keeps only the modules that match the context", () => {
  const always = module("always", true);
  const never = module("never", false);
  expect(modulesFor(ctx, [always, never])).toEqual([always]);
});
