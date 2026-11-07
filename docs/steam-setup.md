# Steam setup

> **Changing (feature 002):** `scripts\steam-launch.cmd` is gone. The launch option is now
> `"<exe>" --keeper %command%`, where `<exe>` is the installed `IdleOn Companion.exe` (in development:
> `"<repo>\node_modules\electron\dist\electron.exe" "<repo>" --keeper %command%`), and the installer's setup screen
> writes it for you. The rest of this page describes the old setup and is rewritten when the feature is done.

Steam starts the companion in place of the game: the launch option runs `scripts\steam-launch.cmd`, which starts the
keeper (`electron.exe` running `out\main\keeper.js` as plain Node). The keeper opens Legends of Idleon with the
command line Steam passed, reads it, opens the companion window, and ends only after the game closes. See
[ARCHITECTURE.md](../ARCHITECTURE.md) for how the pieces fit.

## Once, before the first game

From the repository folder (the one with `package.json`):

```powershell
cd '<repo>' && just setup
cd '<repo>' && just build
cd '<repo>' && pnpm exec electron --version
```

- `just setup` installs the locked dependencies.
- `just build` writes `out\main\index.js` (the app), `out\main\keeper.js` (the keeper), `out\preload\index.cjs` and
  `out\renderer\`.
- Electron downloads its binary on first use, not on install. `pnpm exec electron --version` is that first use: it
  puts `node_modules\electron\dist\electron.exe` in place, the file the launch script runs. Without it the Play button
  starts nothing.

Run `just build` again after every update of the code.

## The launch option

In Steam: Library, right-click **Legends of Idleon**, **Properties**, **General**, **Launch Options**, and write:

```text
"<repo>\scripts\steam-launch.cmd" %command%
```

with `<repo>` replaced by the full path of the repository folder, inside the quotes (for example
`"C:\Users\you\idleon-companion\scripts\steam-launch.cmd" %command%`). Steam replaces `%command%` with the game's own
command line, which the script passes to the keeper unchanged.

Then press Play. The companion window opens next to the game (setting "Show window when the game starts").

## Using it

- The window's X hides the window in the tray; the tray icon shows it again, and its menu has "Show/Hide" and "Quit".
- When the game closes, the companion closes too, unless "Close companion when the game closes" is off.
- The companion can be closed, or crash, with the game open: the game goes on. Opening the app again by hand
  (`cd '<repo>' && pnpm exec electron .`) reconnects to the running keeper and goes live again.
- When the game code changed and contains debugger-detection markers, the game opens without the reader and the window
  says "The game code changed and contains: <markers>. Reading is off for this session." **Connect next time**
  records that code, and reading starts the next time the game opens.

Logs and user data live in `%APPDATA%\IdleOn Companion\` (`keeper.log`, `game.log`, `names.json`, `settings.json`,
`game-hash.json`).

## Undo

Clear the **Launch Options** field in the game's Steam properties. Play then starts the game alone, as before. The
data folder `%APPDATA%\IdleOn Companion\` can be deleted afterwards.

## Known limit

Killing the keeper (the `electron.exe` process running `keeper.js`, for example from the Task Manager) closes the game
within about 1.5 s: the game's Chromium closes when its debugging pipe closes. Progress since the game's last save is
lost. To stop the companion, quit the app from its tray icon instead; the keeper ends on its own when the game closes.
