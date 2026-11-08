// Undoing the setup (FR-009, FR-012, FR-013; research R5, R6): the uninstaller takes the
// companion's part out of every configured account and out of the last-used one, with the same close-and-reopen flow as
// the setup. Only the companion's part leaves the option; what the user changed after the setup stays.
import type { SetupProgress } from "../../shared/index.ts";
import { forgetAccount } from "../setup-store.ts";
import { removePart } from "./launch-option.ts";
import { IDLEON_APP_ID, localConfigPath } from "./locate.ts";
import type { SteamFiles } from "./locate.ts";
import {
  configText,
  currentOption,
  failed,
  GAME_IMAGE,
  keepFirstCopy,
  withSteamClosed,
} from "./setup.ts";
import type { SetupStoreLike, SteamSystem } from "./setup.ts";
import { getLaunchOptions, setLaunchOptions } from "./vdf.ts";

/** True when the option has the part, or when the file could not be read: then it is read again with Steam closed, and
 * reported. Decides only whether an account without a record is worth closing Steam for. */
async function mayHavePart(
  sys: SteamSystem,
  file: string,
  part: string,
): Promise<boolean> {
  try {
    const text = await configText(sys, file);
    if (text === undefined) return false;
    return (getLaunchOptions(text, IDLEON_APP_ID) ?? "").includes(part);
  } catch {
    return true;
  }
}

/** With Steam closed: takes the inserted text out of the account's option, or the part when that text is gone or was
 * never recorded, so the game never keeps pointing at an uninstalled exe. A missing file has nothing to take out. False,
 * with nothing written and the record kept, when the file cannot be read. */
async function takeOut(
  sys: SteamSystem,
  store: SetupStoreLike,
  steamPath: string,
  accountId: string,
  part: string,
): Promise<boolean> {
  const file = localConfigPath(steamPath, accountId);
  const record = store.load().accounts[accountId];
  let out: string | undefined;
  try {
    const text = await configText(sys, file);
    if (text !== undefined) {
      const current = currentOption(text);
      const withoutInserted = removePart(current, record?.inserted ?? "");
      const next =
        withoutInserted === current
          ? removePart(current, part)
          : withoutInserted;
      if (next !== current) out = setLaunchOptions(text, IDLEON_APP_ID, next);
    }
  } catch {
    return false;
  }
  if (out !== undefined) {
    // without a record this is the companion's first write to this account (FR-027)
    if (!record) await keepFirstCopy(sys, store, accountId, file);
    await sys.writeFileAtomic(file, out);
  }
  if (record) store.save(forgetAccount(store.load(), accountId));
  return true;
}

/** The removal. Every step goes to `onProgress`, the last one is returned. Steam is closed only when an account
 * may have something to take out. */
export async function runRemove(
  sys: SteamSystem,
  store: SetupStoreLike,
  part: string,
  onProgress: (p: SetupProgress) => void,
): Promise<SetupProgress> {
  const finish = (p: SetupProgress) => {
    onProgress(p);
    return p;
  };
  let found: SteamFiles;
  try {
    found = await sys.readSteam();
  } catch {
    return finish(failed("unreadable-config"));
  }
  const { steamPath, account } = found;
  if (!steamPath) return finish("done"); // no Steam: no option to take the part out of

  const accounts = new Set(Object.keys(store.load().accounts));
  if (
    account &&
    (await mayHavePart(sys, localConfigPath(steamPath, account.id), part))
  )
    accounts.add(account.id);
  if (accounts.size === 0) return finish("done");
  if (await sys.isRunning(GAME_IMAGE)) return finish(failed("game-open"));

  return finish(
    await withSteamClosed(sys, steamPath, onProgress, async () => {
      let allRead = true;
      for (const id of accounts)
        if (!(await takeOut(sys, store, steamPath, id, part))) allRead = false;
      return allRead;
    }),
  );
}
