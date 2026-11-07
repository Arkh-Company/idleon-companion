// The Screen map panel (spec §5.6): where the player is and what is open, with "Name it" for unnamed numbers.
import type { ComponentProps } from "react";
import type {
  CatalogTable,
  CompanionModule,
  Entry,
  GameContext,
} from "../shared/index.ts";
import { NameIt } from "./NameIt.tsx";

type PanelProps = ComponentProps<CompanionModule["Panel"]>;

/** A number with its catalog name, "unnamed #N" with "Name it", or the bare number. */
function Named({
  ctx,
  table,
  value,
  entry,
}: {
  ctx: GameContext;
  table: CatalogTable;
  value: number | null;
  entry: Entry | undefined;
}) {
  if (entry)
    return (
      <>
        <span className="num">{value}</span> <span>{entry.name}</span>
        {entry.status === "deduced" && (
          <span className="deduced" title="from game code">
            *
          </span>
        )}
      </>
    );
  // unnamedIn lists at most one key per table: the one on screen now.
  const unnamed = ctx.unnamed.find((u) => u.table === table);
  if (unnamed)
    return (
      <>
        <span>{`unnamed #${unnamed.key}`}</span>{" "}
        <NameIt table={table} catalogKey={unnamed.key} />
      </>
    );
  return <span className="num">{value}</span>;
}

export function ScreenMapPanel({ ctx }: PanelProps) {
  const { screen, names } = ctx;
  const codexOpen = screen.menu === 3;
  return (
    <table className="screen-map">
      <tbody>
        <tr>
          <th>World</th>
          <td>{screen.world}</td>
        </tr>
        <tr>
          <th>Map</th>
          <td>{`${String(screen.map)} ${names.map ?? ""}`.trim()}</td>
        </tr>
        <tr>
          <th>Menu</th>
          <td>
            <Named
              ctx={ctx}
              table="menu"
              value={screen.menu}
              entry={names.menu}
            />
          </td>
        </tr>
        <tr>
          <th>Window</th>
          <td>
            <Named
              ctx={ctx}
              table="menu2"
              value={screen.window}
              entry={names.window}
            />
          </td>
        </tr>
        <tr>
          <th>Codex tab</th>
          <td>
            {codexOpen ? (
              <>
                <Named
                  ctx={ctx}
                  table="codex"
                  value={screen.codexTab}
                  entry={names.codexTab}
                />
                {screen.codexSel !== null && (
                  <>
                    {" · "}
                    <span>{screen.codexSel}</span>
                  </>
                )}
              </>
            ) : (
              <span>Not open</span>
            )}
          </td>
        </tr>
        <tr>
          <th>Character</th>
          <td>
            <span>{ctx.character ?? "No character selected"}</span>
          </td>
        </tr>
        <tr>
          <th>AFK target</th>
          <td>
            <span>{names.afk ?? ctx.afk ?? "None"}</span>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
