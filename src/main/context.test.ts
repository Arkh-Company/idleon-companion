import { expect, test } from "vitest";
import { READ_NULLS } from "../shared/index.ts";
import type { Reading } from "../shared/index.ts";
import { DEFAULT_CATALOG, unnamedIn } from "./catalog/catalog.ts";
import { toContext } from "./context.ts";

const base: Reading = {
  t: 1234,
  map: 264,
  menu: 0,
  menu2: 44,
  menu2tab: 2,
  skillTab: 0,
  char: "Tester",
  afk: "w6d3",
  codexTab: null,
  ...READ_NULLS,
};

test("the world comes from the map", () => {
  expect(toContext({ ...base, map: 264 }, DEFAULT_CATALOG).screen.world).toBe(
    6,
  );
  expect(toContext({ ...base, map: 41 }, DEFAULT_CATALOG).screen.world).toBe(1);
  expect(toContext({ ...base, map: 326 }, DEFAULT_CATALOG).screen.world).toBe(
    7,
  );
});

test("the catalog names the map, the window and the AFK target", () => {
  const ctx = toContext(base, DEFAULT_CATALOG);

  expect(ctx.names.map).toBe("Emperor's Castle Doorstep");
  expect(ctx.names.window?.name).toBe("Sailing");
  expect(ctx.names.afk).toBe("Samurai Guardian");
  expect(ctx.screen).toEqual({
    world: 6,
    map: 264,
    menu: 0,
    window: 44,
    tab: 2,
    codexTab: null,
    codexSel: null,
  });
});

test("a Quik Ref shortcut is named by its own fractional key", () => {
  expect(toContext({ ...base, menu: 0.1 }, DEFAULT_CATALOG).names.menu).toEqual(
    {
      name: "Quik Ref shortcut (Anvil)",
      status: "deduced",
    },
  );
});

test("the Codex tab is named only while the Codex is open", () => {
  expect(
    toContext({ ...base, menu: 3, codexTab: 5 }, DEFAULT_CATALOG).names.codexTab
      ?.name,
  ).toBe("Friends");
  expect(
    toContext({ ...base, menu: 0, codexTab: 5 }, DEFAULT_CATALOG).names
      .codexTab,
  ).toBeUndefined();
});

test("no character gives a null character", () => {
  expect(
    toContext({ ...base, char: null }, DEFAULT_CATALOG).character,
  ).toBeNull();
});

test("unnamed numbers and the time come from the reading", () => {
  const reading = { ...base, menu2: 999, t: 5678 };
  const ctx = toContext(reading, DEFAULT_CATALOG);

  expect(ctx.unnamed).toEqual(unnamedIn(DEFAULT_CATALOG, reading));
  expect(ctx.unnamed).toEqual([{ table: "menu2", key: "999" }]);
  expect(ctx.updatedAt).toBe(5678);
});
