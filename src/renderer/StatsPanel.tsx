// The Stats panel (contracts/ipc.md): a plain list, on purpose; the final tab is another feature (FR-017).
import type { Stats } from "../shared/index.ts";

export function StatsPanel({ stats }: { stats: Stats | null }) {
  if (stats?.state === "calculating") return <p>Calculating</p>;
  if (stats?.state === "unavailable") return <p>Calculator unavailable</p>;
  if (stats?.state !== "ready") return null;
  return (
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
  );
}
