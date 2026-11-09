// The game's two files, from the installation of each machine (FR-013, research R6). The worker gets the bytes, never a path.
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface GameBytes {
  code: Uint8Array<ArrayBuffer>;
  pak: Uint8Array<ArrayBuffer>;
}

type Read = (path: string) => Promise<Uint8Array>;

const GAME = ["distBuild", "static", "game"];

async function readFrom(root: string, read: Read): Promise<GameBytes> {
  const [code, pak] = await Promise.all([
    read(join(root, ...GAME, "N.js")),
    read(join(root, ...GAME, "lib", "default.pak")),
  ]);
  // ponytail: one copy each, so the bytes own their memory: transferring a Buffer of Node's shared pool would break it.
  return { code: new Uint8Array(code), pak: new Uint8Array(pak) };
}

/** Both files from `app.asar` (Electron's `fs` reads inside it) or, without it, both from the unpacked `app` folder. */
export function readGameFiles(
  resources: string,
  read: Read = readFile,
): Promise<GameBytes> {
  return readFrom(join(resources, "app.asar"), read).catch(() =>
    readFrom(join(resources, "app"), read),
  );
}
