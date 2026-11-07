# One executable, launched by Steam directly, plays both the keeper and the app

Steam's launch option runs `"<IdleOn Companion.exe>" --keeper %command%`: the installed app's own executable, a program
with a window subsystem, becomes the keeper; with no argument the same executable is the app. Never a console script
(`.cmd`, `.bat`) between Steam and the game: with one, Steam does not start its overlay for the game and the gem store's
purchase window cannot open (Task 12, 07/11).

## Considered Options

- **A Node keeper or a `.cmd` launcher.** Rejected: both are console programs, the cause of the broken purchases.
- **Two executables (keeper and app).** Rejected: a second GUI executable and installer entry for no gain; the keeper
  already runs as plain code in Electron's main process.

## Consequences

The keeper now runs in Electron's main process without `ELECTRON_RUN_AS_NODE`, still importing no `electron`.
Replacing the executable kills a running keeper and its game, so an update never installs while the game is open.
