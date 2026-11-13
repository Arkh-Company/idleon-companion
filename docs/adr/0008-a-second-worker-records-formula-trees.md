# A second calculation worker records the formula trees

The formula trees run in a second instance of the same `calculator.js`, with a 2 GB heap and limits of its own, kept alive until the game closes. It runs a copy of the installed `N.js` that we rewrite in memory with a parser (acorn), only adding calls to `__X` defined inside its own context, so the risk accepted in ADR 0006 stays the same. The Stats worker keeps its single context and its sub-second budget, because a tree recording needs over 1 GB and seconds, which would break both in a shared worker (prototype of spec 008).

Amends [ADR 0006](0006-game-code-runs-in-an-isolated-worker.md) (the code run is now our in-memory rewrite of the game's own code) and [ADR 0007](0007-one-long-lived-calculation-context.md) (two long-lived contexts, one per worker).
