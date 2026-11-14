// The Stats panel (contracts/ipc.md): a plain list, on purpose; the final tab is another feature (FR-017).
import { useEffect, useState } from "react";
import type { Stats } from "../shared/index.ts";

/** "last reading N s ago", counting each second; outside any live region, like the status bar's. */
function LastReading({ at }: { at: number }) {
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
    <p>{`last reading ${String(Math.max(0, Math.floor((now - at) / 1000)))} s ago`}</p>
  );
}

export function StatsPanel({ stats }: { stats: Stats | null }) {
  if (stats?.state === "calculating") return <p>Calculating</p>;
  if (stats?.state === "unavailable") return <p>Calculator unavailable</p>;
  if (stats?.state !== "ready") return null;
  return (
    <>
      {"stale" in stats && <LastReading at={stats.calculatedAt} />}
      <table className="screen-map">
        <tbody>
          {stats.rows.map(({ label, text }) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td>{text}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
