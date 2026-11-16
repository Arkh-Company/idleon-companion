// The Formulas tab (spec 008 FR-002, FR-008, FR-034, FR-038): every catalog number, in its group (Character, Account,
// W1…W7, the skills) and then its system, with no search. Groups start closed; the numbers of the open ones are what
// the main keeps live (plan B), and a tapped value opens its tree in the side panel, as the Stats does. The system
// panels (SystemPanel.tsx) list their numbers with the same table and the same live values.
import { useEffect, useState } from "react";
import { catalogName, statsNumber, TREE_CATALOG } from "../shared/index.ts";
import type { CatalogNumber, LiveValues, Stats } from "../shared/index.ts";
import type { Side } from "./SidePanel.tsx";
import { LastReading, STATS_TREES } from "./StatsPanel.tsx";
import { plain } from "./tree-text.ts";

/** Groups, then systems, in the catalog's order: a Map keeps the order each key first appears in. */
const GROUPS = [
  ...TREE_CATALOG.reduce((groups, n) => {
    const systems = groups.get(n.group) ?? new Map<string, CatalogNumber[]>();
    systems.set(n.system, [...(systems.get(n.system) ?? []), n]);
    return groups.set(n.group, systems);
  }, new Map<string, Map<string, CatalogNumber[]>>()),
].map(([group, systems]) => [group, [...systems]] as const);

/** The Stats numbers by the names their trees have in the Stats (design.md C9: Damage is Max and Min damage). */
const STATS_NAMES = new Map(Object.values(STATS_TREES).flat());
/** A number's name on screen: the catalog's, or the Stats row's for a Stats number. */
export const nameOf = (id: string) =>
  STATS_NAMES.get(id) ?? catalogName(id) ?? id;

export function valueText(id: string, v: number | null | undefined): string {
  if (v === undefined) return "calculating";
  if (v === null) return "unavailable";
  return statsNumber(id)?.text(v) ?? plain(v);
}

export type OpenTree = (side: Side, opener: HTMLButtonElement) => void;

/** Before the first reading, or with no character, there are no numbers to show (FR-034). */
export const isWaiting = (stats: Stats | null): boolean =>
  !stats || stats.state === "none" || stats.state === "calculating";

/** Tells the main what is in view (plan B), and nothing once the view is gone. */
export function useInView(ids: readonly string[]): void {
  // Catalog ids have no space: the joined list is a stable dependency.
  const key = ids.join(" ");
  useEffect(() => {
    void window.companion.formulaValues({ ids: key ? key.split(" ") : [] });
  }, [key]);
  useEffect(
    () => () => {
      void window.companion.formulaValues({ ids: [] });
    },
    [],
  );
}

/** The hint every value button points to; one per tab. */
export function OpenHint() {
  return (
    <span id="formulas-open-hint" hidden>
      See how it's calculated
    </span>
  );
}

/** Each number with its live value, a button that opens its tree in the side panel. */
export function NumberTable({
  numbers,
  live,
  onOpen,
  title,
}: {
  numbers: readonly CatalogNumber[];
  live: LiveValues | null;
  onOpen: OpenTree;
  /** The table's caption, when nothing above names it. */
  title?: string;
}) {
  return (
    <table className="screen-map formulas">
      {title && <caption>{title}</caption>}
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
  );
}

export function FormulasTab({
  stats,
  live,
  onOpen,
}: {
  stats: Stats | null;
  live: LiveValues | null;
  onOpen: OpenTree;
}) {
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const waiting = isWaiting(stats);

  // What is in view: the open groups' numbers, and nothing once the tab is gone.
  useInView(
    waiting
      ? []
      : TREE_CATALOG.filter((n) => open.has(n.group)).map((n) => n.id),
  );

  if (waiting) return <p>Waiting for the game</p>;
  function toggle(group: string): void {
    setOpen((s) => {
      const next = new Set(s);
      if (!next.delete(group)) next.add(group);
      return next;
    });
  }
  return (
    <>
      {live?.stale && <LastReading at={live.calculatedAt} />}
      <OpenHint />
      {GROUPS.map(([group, systems]) => (
        <section key={group}>
          <h3>
            <button
              type="button"
              aria-expanded={open.has(group)}
              onClick={() => {
                toggle(group);
              }}
            >
              {group}
            </button>
          </h3>
          {open.has(group) &&
            systems.map(([system, numbers]) => (
              <section key={system}>
                <h4>{system}</h4>
                <NumberTable numbers={numbers} live={live} onOpen={onOpen} />
              </section>
            ))}
        </section>
      ))}
    </>
  );
}
