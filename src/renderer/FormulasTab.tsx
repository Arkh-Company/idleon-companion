// The Formulas tab (spec 008 FR-002, FR-008, FR-034, FR-038): every catalog number, grouped by system in the catalog's
// order, with no search. Groups start closed; the open ones are what the main keeps live (plan B), and a tapped value
// opens its tree in the side panel, as the Stats does.
import { useEffect, useState } from "react";
import { statsNumber, TREE_CATALOG } from "../shared/index.ts";
import type { CatalogNumber, LiveValues, Stats } from "../shared/index.ts";
import type { Side } from "./SidePanel.tsx";
import { LastReading, STATS_TREES } from "./StatsPanel.tsx";
import { plain } from "./tree-text.ts";

/** The groups in the catalog's order: a Map keeps the order each system first appears in. */
const GROUPS = [
  ...TREE_CATALOG.reduce((m, n) => {
    m.set(n.system, [...(m.get(n.system) ?? []), n]);
    return m;
  }, new Map<string, CatalogNumber[]>()),
];

/** The Stats numbers by the names their trees have in the Stats (design.md C9: Damage is Max and Min damage). */
const STATS_NAMES = new Map(Object.values(STATS_TREES).flat());
// ponytail: a catalog id is the name until the names table (US1c) names the trees.
const nameOf = (id: string) => STATS_NAMES.get(id) ?? id;

function valueText(id: string, v: number | null | undefined): string {
  if (v === undefined) return "calculating";
  if (v === null) return "unavailable";
  return statsNumber(id)?.text(v) ?? plain(v);
}

export function FormulasTab({
  stats,
  live,
  onOpen,
}: {
  stats: Stats | null;
  live: LiveValues | null;
  onOpen: (side: Side, opener: HTMLButtonElement) => void;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const waiting =
    !stats || stats.state === "none" || stats.state === "calculating";

  // What is in view: the open groups' numbers, and nothing once the tab is gone.
  useEffect(() => {
    const ids = waiting
      ? []
      : TREE_CATALOG.filter((n) => open.has(n.system)).map((n) => n.id);
    void window.companion.formulaValues({ ids });
  }, [open, waiting]);
  useEffect(
    () => () => {
      void window.companion.formulaValues({ ids: [] });
    },
    [],
  );

  if (waiting) return <p>Waiting for the game</p>;
  function toggle(system: string): void {
    setOpen((s) => {
      const next = new Set(s);
      if (!next.delete(system)) next.add(system);
      return next;
    });
  }
  return (
    <>
      {live?.stale && <LastReading at={live.calculatedAt} />}
      <span id="formulas-open-hint" hidden>
        See how it's calculated
      </span>
      {GROUPS.map(([system, numbers]) => (
        <section key={system}>
          <h3>
            <button
              type="button"
              aria-expanded={open.has(system)}
              onClick={() => {
                toggle(system);
              }}
            >
              {system}
            </button>
          </h3>
          {open.has(system) && (
            <table className="screen-map formulas">
              <tbody>
                {numbers.map(({ id }) => {
                  const name = nameOf(id);
                  const text = valueText(id, live?.values[id]);
                  return (
                    <tr key={id}>
                      <th scope="row">{name}</th>
                      <td>
                        <button
                          type="button"
                          className="value-button"
                          aria-describedby="formulas-open-hint"
                          onClick={(e) => {
                            onOpen(
                              { label: name, text, trees: [[id, name]], id },
                              e.currentTarget,
                            );
                          }}
                        >
                          {text}
                          <span aria-hidden="true"> ›</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
