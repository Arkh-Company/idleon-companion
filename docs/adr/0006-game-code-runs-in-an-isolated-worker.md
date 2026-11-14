# The game's code runs in an isolated worker, and only there

To calculate the player's numbers, the app runs a copy of the installed `N.js` in a worker of its own process, with no network object, no host object in its context and code generation turned off. This is the one exception to "the game's file is only read as text": it never happens in the keeper, because a crash there closes the game, and it never touches the running game. `node:vm` is not a security barrier, so the code is kept off the network by what its context lacks, and the remaining risk, a deliberate escape from the context, is accepted because the code run is the official game's own.

Amended by [ADR 0008](0008-a-second-worker-records-formula-trees.md).
