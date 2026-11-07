// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import { App } from "./App.tsx";

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
