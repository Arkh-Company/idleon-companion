// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vitest";
import type { GameContext, Status } from "../shared/index.ts";
import { App } from "./App.tsx";
import { stubCompanion } from "./companion-stub.ts";

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
  names: { map: "Emperor's Castle Doorstep" },
  unnamed: [],
  updatedAt: 1,
};
const status: Status = { game: "running", reader: "attached" };

beforeEach(() => {
  const companion = stubCompanion();
  // The preload replays the last value to a late subscriber at once.
  companion.onContext.mockImplementation((cb) => {
    cb(ctx);
    return () => undefined;
  });
  companion.onStatus.mockImplementation((cb) => {
    cb(status);
    return () => undefined;
  });
});
afterEach(cleanup);

test("index.html allows only the app's own resources", () => {
  const html = readFileSync(join(import.meta.dirname, "index.html"), "utf8");
  const page = new DOMParser().parseFromString(html, "text/html");
  const csp = page.querySelector('meta[http-equiv="Content-Security-Policy"]');

  expect(csp?.getAttribute("content")).toBe("default-src 'self'");
  expect(page.title).toBe("IdleOn Companion");
});

test("App shows the companion heading", () => {
  render(<App />);

  expect(
    screen.getByRole("heading", { name: "IdleOn Companion" }),
  ).toBeDefined();
});

test("App shows the status and the Screen map panel of the last context", async () => {
  render(<App />);

  expect(screen.getByText("Reader attached")).toBeDefined();
  expect(screen.getByRole("heading", { name: "Screen map" })).toBeDefined();
  expect(screen.getByText("264 Emperor's Castle Doorstep")).toBeDefined();
  expect(await screen.findByLabelText("Always on top")).toBeDefined();
});
