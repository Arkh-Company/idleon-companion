# The update watch fails closed: no proof the game code is clean, no debugging pipe

Before launching, the keeper hashes the installed game code (`N.js`, from `resources\app.asar` or the unpacked
`resources\app\`) and scans a changed one for the text a debugger detection would need. The game opens without
`--remote-debugging-pipe`, and so without reading, whenever that check cannot clear it: the code changed and has
markers, the game's `N.js` is missing or unreadable, or the keeper failed before launching (link server or data folder).
Zero ban risk (spec §3) wins over a session without the panel, and the game always opens (decided on 07/11).

## Considered Options

- **Open with the pipe and ask "Connect anyway?"** Rejected: the pipe itself is what a detection would see, before the
  player answers.
- **Skip the check when the code cannot be read.** Rejected: an update that moved `N.js` would then be read unchecked.

## Consequences

"Connect next time" records the hash of code with markers, so only the next session reads it; until then every session
warns again. Clean code is recorded by the keeper after the check, and a hash that cannot be saved keeps the pipe (the
next session just checks again). An exe that is not the game's (Edge in the tests) with no game code is read as before.
