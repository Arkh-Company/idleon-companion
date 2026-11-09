// The map and monster names of the installed game, found by regular expressions over the text of its code, which is
// never run (FR-014). Any sign of a new format drops that whole table: half a table could give a wrong name (FR-016).
import type { GameTables } from "../shared/index.ts";

const spaced = (name: string) => name.replaceAll("_", " ");

/** A `.field=function(){return"A B C".split(" ")}` list, looked up by field: the minified object's name changes. */
function list(code: string, field: string): string[] | null {
  const found = [
    ...code.matchAll(
      new RegExp(
        `\\.${field}=function\\(\\)\\{return"([^"]*)"\\.split\\(" "\\)\\}`,
        "g",
      ),
    ),
  ];
  if (found.length !== 1) return null;
  const items = (found[0]?.[1] ?? "").split(" ");
  return items.length > 1 && items.every((i) => i !== "") ? items : null;
}

function readMaps(code: string): string[] | null {
  const names = list(code, "MapDispName");
  const ids = list(code, "MapName");
  return names && names.length === ids?.length ? names.map(spaced) : null;
}

function readMonsters(code: string): Record<string, string> | null {
  const byId = new Map<string, string>(); // a repeated id keeps the last, as in the game
  for (const [, id = "", name] of code.matchAll(
    /\.addNewMonster\("([^"]+)",(?:\s*\{\s*Name:\s*"([^"]+)")?/g,
  )) {
    if (name === undefined) return null;
    byId.set(id, spaced(name));
  }
  // fromEntries defines own keys, so an id like `__proto__` is an ordinary key.
  return byId.size > 0 ? Object.fromEntries(byId) : null;
}

export function readGameTables(code: string): GameTables {
  return { maps: readMaps(code), monsters: readMonsters(code) };
}
