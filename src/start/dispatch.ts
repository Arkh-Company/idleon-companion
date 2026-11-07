// The role of the one executable, from its command line (contracts/command-line.md). Pure: tested without Electron.

export type Role = "keeper" | "remove-from-steam" | "app";

/** The first recognized flag wins: a game arg after `--keeper` never changes the role. No flag → the app. */
export function roleFor(argv: string[]): Role {
  for (const a of argv) {
    if (a === "--keeper") return "keeper";
    if (a === "--remove-from-steam") return "remove-from-steam";
  }
  return "app";
}
