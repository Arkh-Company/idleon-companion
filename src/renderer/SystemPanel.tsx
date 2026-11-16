// The system panels (spec 008 FR-003, FR-004, FR-034): the panel tab shows the panel of each system whose screen was
// last open in the game. On top, the numbers the game does not show, in groups that start closed (Costs, Caps, Chances,
// Rates); below, the system's other numbers. What is in view goes live, as in the Formulas tab, and every value opens
// its own tree in the side panel.
import { createContext, useContext, useState } from "react";
import { TREE_CATALOG } from "../shared/index.ts";
import type {
  CatalogNumber,
  CompanionModule,
  GameContext,
  LiveValues,
  Stats,
} from "../shared/index.ts";
import { isWaiting, NumberTable, OpenHint, useInView } from "./FormulasTab.tsx";
import type { OpenTree } from "./FormulasTab.tsx";
import { LastReading } from "./StatsPanel.tsx";

const GROUPS = [
  ["cost", "Costs"],
  ["cap", "Caps"],
  ["chance", "Chances"],
  ["rate", "Rates"],
] as const;

/** A group's key in the tab's open set: one system's kind of number. */
const groupKey = (system: string, kind: CatalogNumber["notShown"]) =>
  `${system}:${String(kind)}`;

/** What every panel of the tab shares: a module's `Panel` gets only the context, as any module (spec §6.3). */
const PanelView = createContext<{
  live: LiveValues | null;
  open: ReadonlySet<string>;
  toggle: (key: string) => void;
  onOpen: OpenTree;
} | null>(null);

/** One system's panel. */
export function SystemPanel({ system }: { system: string }) {
  const view = useContext(PanelView);
  if (!view) return null;
  const { live, open, toggle, onOpen } = view;
  const numbers = TREE_CATALOG.filter((n) => n.system === system);
  return (
    <>
      {GROUPS.map(([kind, label]) => {
        const group = numbers.filter((n) => n.notShown === kind);
        if (group.length === 0) return null;
        const key = groupKey(system, kind);
        return (
          <section key={kind}>
            <h3>
              <button
                type="button"
                aria-expanded={open.has(key)}
                onClick={() => {
                  toggle(key);
                }}
              >
                {label}
              </button>
            </h3>
            {open.has(key) && (
              <NumberTable numbers={group} live={live} onOpen={onOpen} />
            )}
          </section>
        );
      })}
      <NumberTable
        numbers={numbers.filter((n) => n.notShown === null)}
        live={live}
        onOpen={onOpen}
        title="Shown in the game"
      />
    </>
  );
}

/** The panel tab: the panels of `modules`, the systems of the last screen that had one (FR-033). */
export function SystemTab({
  modules,
  ctx,
  stats,
  live,
  onOpen,
}: {
  modules: readonly CompanionModule[];
  ctx: GameContext;
  stats: Stats | null;
  live: LiveValues | null;
  onOpen: OpenTree;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const waiting = isWaiting(stats);
  const shown = new Set(modules.map((m) => m.id));
  useInView(
    waiting
      ? []
      : TREE_CATALOG.filter(
          (n) =>
            shown.has(n.system) &&
            (n.notShown === null || open.has(groupKey(n.system, n.notShown))),
        ).map((n) => n.id),
  );

  if (waiting) return <p>Waiting for the game</p>;
  function toggle(key: string): void {
    setOpen((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  }
  return (
    <PanelView.Provider value={{ live, open, toggle, onOpen }}>
      {live?.stale && <LastReading at={live.calculatedAt} />}
      <OpenHint />
      {modules.map(({ id, title, Panel }) => (
        <section key={id}>
          <h2>{title}</h2>
          <Panel ctx={ctx} send={() => Promise.resolve()} />
        </section>
      ))}
    </PanelView.Provider>
  );
}
