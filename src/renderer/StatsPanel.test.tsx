// @vitest-environment jsdom
// The Stats panel (contracts/ipc.md): its fixed texts, the ten rows and no field to fill in (FR-020).
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test } from "vitest";
import type { Stats } from "../shared/index.ts";
import { StatsPanel } from "./StatsPanel.tsx";

afterEach(cleanup);

const LABELS = [
  "Drop Rate",
  "Damage",
  "HP",
  "MP",
  "STR",
  "AGI",
  "WIS",
  "LUK",
  "Accuracy",
  "AFK Gains",
];
const READY: Stats = {
  state: "ready",
  rows: LABELS.map((label) =>
    label === "HP"
      ? { label, text: "unavailable" }
      : { label, text: `value of ${label}` },
  ),
};

test("calculating shows its text and no row", () => {
  render(<StatsPanel stats={{ state: "calculating" }} />);
  expect(screen.getByText("Calculating")).toBeDefined();
  expect(screen.queryAllByRole("rowheader")).toEqual([]);
});

test("unavailable shows its text and no row", () => {
  render(<StatsPanel stats={{ state: "unavailable" }} />);
  expect(screen.getByText("Calculator unavailable")).toBeDefined();
  expect(screen.queryAllByRole("rowheader")).toEqual([]);
});

test("ready shows the ten rows with their text", () => {
  render(<StatsPanel stats={READY} />);
  expect(screen.getAllByRole("rowheader").map((h) => h.textContent)).toEqual(
    LABELS,
  );
  expect(
    screen.getByRole("row", { name: "Damage value of Damage" }),
  ).toBeDefined();
  expect(screen.getByRole("row", { name: "HP unavailable" })).toBeDefined();
});

test.each<[string, Stats | null]>([
  ["none", { state: "none" }],
  ["null", null],
])("%s shows nothing", (_name, stats) => {
  const { container } = render(<StatsPanel stats={stats} />);
  expect(container.textContent).toBe("");
});

test.each<[string, Stats | null]>([
  ["none", { state: "none" }],
  ["null", null],
  ["calculating", { state: "calculating" }],
  ["unavailable", { state: "unavailable" }],
  ["ready", READY],
])("%s has no field to fill in", (_name, stats) => {
  const { container } = render(<StatsPanel stats={stats} />);
  expect(container.querySelector("input, textarea, select")).toBe(null);
});
