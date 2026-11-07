import { expect, test } from "vitest";
import type { CompanionModule, GameContext } from "./index.ts";
import { modulesFor } from "./index.ts";

const ctx: GameContext = {
  screen: {
    world: 6,
    map: 264,
    menu: 0,
    window: 0,
    tab: 0,
    codexTab: null,
    codexSel: null,
  },
  character: null,
  afk: null,
  names: {},
  unnamed: [],
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
