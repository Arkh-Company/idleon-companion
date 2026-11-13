# One long-lived calculation context

The calculator worker keeps the installed game's code loaded in a single `node:vm` context and redoes the state and the helper actors for each calculation, because a fresh context per calculation costs over 600 ms and the sub-second target leaves about 100 ms. A prototype matched a from-zero calculation in 135 of 135 pairs, while applying only the changed pieces matched 70, so the state is always rebuilt whole. The isolation of ADR 0006 is unchanged: the context still has no host object and no network. A limit exceeded inside the context gives `null` numbers for that calculation and the next one tries again in the same context; only the host's 15 s for the whole calculation bring the worker down.

Amended by [ADR 0008](0008-a-second-worker-records-formula-trees.md).
