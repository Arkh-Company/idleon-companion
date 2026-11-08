// The keeper's command line and paths, packaged and in development (research R1). No electron import: the keeper
// runs in Electron's main process but stays plain Node code.
import { join } from "node:path";

/** Everything after `--keeper`, unchanged: the game's exe and the args Steam passed. Null when no exe follows. */
export function gameCommand(
  argv: string[],
): { exe: string; args: string[] } | null {
  const i = argv.indexOf("--keeper");
  if (i < 0) return null;
  const [exe, ...args] = argv.slice(i + 1);
  return exe === undefined ? null : { exe, args };
}

/** How the keeper starts the app: the same exe when packaged; electron with the repo folder in development. */
export function appCommand(p: {
  execPath: string;
  defaultApp: boolean;
  appPath: string;
}): { file: string; args: string[] } {
  return {
    file: p.execPath,
    args: p.defaultApp ? [p.appPath, "--from-steam"] : ["--from-steam"],
  };
}

/** read.js: an extra resource next to app.asar when packaged; the source file in development. */
export function readJsPath(p: {
  defaultApp: boolean;
  resourcesPath: string;
  repoRoot: string;
}): string {
  return p.defaultApp
    ? join(p.repoRoot, "src/keeper/read.js")
    : join(p.resourcesPath, "read.js");
}
