// Adding and removing the companion's part of Steam's launch option (research R5, ADR 0004): the user's text is never
// removed, and undoing takes out only the exact text that was added. Pure: no electron, no child_process.

const COMMAND = "%command%";

/** `"<exe>" --keeper ` packaged; `"<electron.exe>" "<repo>" --keeper ` in development. */
export function companionPart(p: {
  execPath: string;
  defaultApp: boolean;
  appPath: string;
}): string {
  return p.defaultApp
    ? `"${p.execPath}" "${p.appPath}" --keeper `
    : `"${p.execPath}" --keeper `;
}

/** The option with the part right before the first `%command%` (or `part%command% ` before a text without one, which
 * Steam puts after the command anyway), and the exact text inserted ("" when the part was already there). */
export function addPart(
  current: string,
  part: string,
): { next: string; inserted: string } {
  if (current.includes(part)) return { next: current, inserted: "" };
  const at = current.indexOf(COMMAND);
  if (at >= 0)
    return {
      next: current.slice(0, at) + part + current.slice(at),
      inserted: part,
    };
  const inserted = current === "" ? part + COMMAND : `${part}${COMMAND} `;
  return { next: inserted + current, inserted };
}

/** The option without the text the companion inserted, once. When that text is gone, its version without the trailing
 * space is tried (the user deleted their own text after `%command% `); otherwise the option is unchanged. */
export function removePart(current: string, inserted: string): string {
  for (const text of [inserted, inserted.trimEnd()]) {
    const at = text === "" ? -1 : current.indexOf(text);
    if (at >= 0) return current.slice(0, at) + current.slice(at + text.length);
  }
  return current;
}

export function optionState(
  current: string,
  part: string,
): "not-set" | "companion" | "other" {
  if (current.trim() === "") return "not-set";
  return current.includes(part) ? "companion" : "other";
}

/** The user's text runs a .cmd or .bat before `%command%`: Steam then starts the game from a console (a warning). */
export function hasConsoleScript(current: string): boolean {
  const at = current.indexOf(COMMAND);
  return at >= 0 && /\.(cmd|bat)\b/i.test(current.slice(0, at));
}
