# Steam setup

Steam starts the companion in place of the game: the launch option runs `"<IdleOn Companion.exe>" --keeper %command%`.
That same executable is the keeper, which opens Legends of Idleon with the command line Steam passed, reads it, opens
the companion window, and ends only after the game closes. No `.cmd` or `.bat` stands between Steam and the game, so
Steam's overlay and the gem store work. See [ARCHITECTURE.md](../ARCHITECTURE.md) for how the pieces fit.

## Install

1. Download `IdleOn-Companion-Setup-<version>.exe` from the
   [release page](https://github.com/Arkh-Company/idleon-companion-releases/releases).
2. Run it. It asks for no administrator rights, installs to `%LOCALAPPDATA%\Programs\idleon-companion\`, adds a Start
   menu shortcut and opens the companion when it ends.

The installer is not code-signed, so Windows SmartScreen may stop it: choose **More info**, then **Run anyway**. With
the game open, the installer stops with "Close the game first."

## The setup screen

Until Steam is set up for the most recent account on this computer, the window shows only this screen, with Steam, the
account, the game and the launch option it found. Closing the window postpones the setup.

If the launch option already runs another copy of the companion, the screen only warns: remove that text in Steam, or
uninstall the other copy.

**Close Steam and set up** closes Steam the normal way, keeps a copy of Steam's settings file, adds the companion's part
to the launch option of Legends of Idleon, and reopens Steam. It ends with "All set. Press Play in Steam as usual."

- A launch option you already have stays: the screen shows it before and after, and the companion only adds to it.
- **Details** shows the exact text, the file that changes and where the copy is kept.
- With the game open, the button is off and the screen says "Close the game first".
- A launch option that runs a `.cmd` or `.bat` before the game gets a warning: the gem store may not open.
- When Steam's settings cannot be read, nothing changes and the screen shows the text to paste by hand. In Steam: Library,
  right-click **Legends of Idleon**, **Properties**, **General**, **Launch Options**.

To set up another Steam account, sign in to it, then use **Set up Steam** in Settings.

## Using it

- Press Play in Steam as usual. The companion window opens next to the game (setting "Show window when the game
  starts").
- While the companion reads the game, the game's X does not close it. Press **Let the game close**, in the status bar or
  the tray icon's menu: the bar says "You can close the game now" and the X works again. **Reconnect**, in the same
  places, starts reading again, with one short pause of the game.
- The window's X hides the window in the tray; the tray icon shows it again, and its menu has "Show/Hide" and "Quit".
- When the game closes, the companion closes too, unless "Close companion when the game closes" is off.
- The companion can be closed, or crash, with the game open: the game goes on. Opening it again from the Start menu
  reconnects to the running keeper and goes live again.
- When the game code changed and contains debugger-detection markers, the game opens without the reader and the window
  says "The game code changed and contains: <markers>. Reading is off for this session." **Connect next time**
  records that code, and reading starts the next time the game opens.
- New versions download on their own. "Update ready" appears in the status bar, and **Restart to update** installs it;
  with the game open the button is off and the bar says "Update installs after the game closes". Updating does not touch
  Steam.

Logs and user data live in `%APPDATA%\IdleOn Companion\` (`keeper.log`, `game.log`, `settings.json`,
`game-hash.json`, `steam-setup.json`, and the copies of Steam's settings file in `steam-backup\`).

## Undo

The setup is undone by **uninstalling**, in Windows' Installed apps; Settings has no button for it. Close the game
first, or the uninstaller stops with "Close the game first." and leaves everything as it was. It then asks whether Steam
may close, closes and reopens Steam, and takes only the companion's part out of the launch option, in every account the
companion set up. Anything else in the option stays, and Play starts the game alone, as before. If you say no, or the
removal fails, it shows the exact text to remove from the launch option by hand, and uninstalls. It ends with the box
"IdleOn Companion was uninstalled."

The data folder `%APPDATA%\IdleOn Companion\` stays after uninstalling and can be deleted afterwards.

## Development

From the repository folder (the one with `package.json`):

```powershell
cd '<repo>' && just setup
cd '<repo>' && just build
cd '<repo>' && pnpm exec electron --version
```

- `just setup` installs the locked dependencies.
- `just build` writes `out\main\start.js` (the entry), `out\main\index.js` (the app), `out\main\keeper.js` (the keeper),
  `out\preload\index.cjs` and `out\renderer\`. Run it again after every update of the code.
- Electron downloads its binary on first use, not on install. `pnpm exec electron --version` is that first use: it puts
  `node_modules\electron\dist\electron.exe` in place, the file the launch option runs. Without it the Play button starts
  nothing.

The launch option, with `<repo>` replaced by the full path of the repository folder (no `.cmd`):

```text
"<repo>\node_modules\electron\dist\electron.exe" "<repo>" --keeper %command%
```

The setup screen writes this same text when the app runs from the repository (`cd '<repo>' && pnpm exec electron .`).
`cd '<repo>' && just package` builds the installer in `dist\`.

## Known limits

- Killing the keeper (the `IdleOn Companion.exe` process started with `--keeper`, for example from the Task Manager)
  closes the game within about 1.5 s: the game's Chromium closes when its debugging pipe closes. Progress since the
  game's last save is lost. To stop the companion, quit the app from its tray icon instead; the keeper ends on its own
  when the game closes.
- While the reader is connecting (taking the engine, rare and able to last up to about two minutes) there is no **Let
  the game close**, and the game's X may not close the game until it ends.
