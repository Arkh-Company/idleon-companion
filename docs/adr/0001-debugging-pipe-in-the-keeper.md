# The debugging pipe lives in a keeper process, apart from the app

The reader talks to the game over `--remote-debugging-pipe` (fd 3 and 4, no TCP port), and the game's Chromium closes
as soon as that pipe closes (Task 0, 06/11). So the process that holds the pipe must live exactly as long as the game:
it is the keeper, a plain Node process (`electron.exe` with `ELECTRON_RUN_AS_NODE=1`) that Steam starts in place of the
game, and it ends only after the game. The app (window, tray, catalog) is a separate process that talks to the keeper
over a local named pipe, so it can close, crash or be killed with the game open.

## Considered Options

- **One Electron app that spawns the game.** Rejected: closing or crashing the app would close the pipe and the game,
  losing the player's progress.
- **`--remote-debugging-port`.** Rejected: a TCP port is reachable by any local program and is the first thing a
  debugger detection would look for; the spec allows no network code.

## Consequences

Killing the keeper still closes the game within about 1.5 s (the known limit in
[docs/steam-setup.md](../steam-setup.md)). The keeper imports no `electron` and nothing of the app (`just arch`).
