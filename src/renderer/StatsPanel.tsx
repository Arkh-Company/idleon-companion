// The Stats panel (contracts/ipc.md): a plain list, on purpose; the final tab is another feature (FR-017). Each value is
// a button that opens its tree in the side panel (spec 008 FR-001); the table stays a table.
import { useEffect, useState } from "react";
import type { Stats } from "../shared/index.ts";

/** The trees each Stats row opens: Damage shows Min and Max, so it opens a choice of two (design.md C9). */
export const STATS_TREES: Readonly<
  Record<string, readonly (readonly [id: string, name: string])[]>
> = {
  "Drop Rate": [["dropRate", "Drop Rate"]],
  Damage: [
    ["damageMax", "Max damage"],
    ["damageMin", "Min damage"],
  ],
  HP: [["hp", "HP"]],
  MP: [["mp", "MP"]],
  STR: [["str", "STR"]],
  AGI: [["agi", "AGI"]],
  WIS: [["wis", "WIS"]],
  LUK: [["luk", "LUK"]],
  Accuracy: [["accuracy", "Accuracy"]],
  "AFK Gains": [["afkGains", "AFK Gains"]],
};

export interface StatsRow {
  label: string;
  text: string;
}

/** "last reading N s ago", counting each second; outside any live region, like the status bar's. */
export function LastReading({
  at,
  before = "",
}: {
  at: number;
  before?: string;
}) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => {
      clearInterval(timer);
    };
  }, []);
  return (
    <p>{`${before}last reading ${String(Math.max(0, Math.floor((now - at) / 1000)))} s ago`}</p>
  );
}

export function StatsPanel({
  stats,
  onOpen,
}: {
  stats: Stats | null;
  onOpen?: (row: StatsRow, opener: HTMLButtonElement) => void;
}) {
  if (stats?.state === "calculating") return <p>Calculating</p>;
  if (stats?.state === "unavailable") return <p>Calculator unavailable</p>;
  if (stats?.state !== "ready") return null;
  return (
    <>
      {"stale" in stats && <LastReading at={stats.calculatedAt} />}
      {onOpen && (
        <span id="stats-open-hint" hidden>
          See how it's calculated
        </span>
      )}
      <table className="screen-map">
        <tbody>
          {stats.rows.map((row) => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>
                {onOpen && Object.hasOwn(STATS_TREES, row.label) ? (
                  <button
                    type="button"
                    className="value-button"
                    aria-describedby="stats-open-hint"
                    onClick={(e) => {
                      onOpen(row, e.currentTarget);
                    }}
                  >
                    {row.text}
                    <span aria-hidden="true"> ›</span>
                  </button>
                ) : (
                  row.text
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
