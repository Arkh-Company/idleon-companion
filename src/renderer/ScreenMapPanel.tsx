// The Screen map panel (contracts/ipc.md): where the player is and what is open.
import type { ComponentProps } from "react";
import type { CompanionModule } from "../shared/index.ts";

type PanelProps = ComponentProps<CompanionModule["Panel"]>;

export function ScreenMapPanel({ ctx }: PanelProps) {
  const rows = [
    ["Screen", ctx.screen.label],
    ["World", ctx.screen.world],
    ["Map", ctx.names.map],
    ["Character", ctx.character ?? "No character selected"],
    ["AFK target", ctx.names.afk],
  ] as const;
  return (
    <table className="screen-map">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}>
            <th scope="row">{label}</th>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
