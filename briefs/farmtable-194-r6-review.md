# #194 round 6 — CODE REVIEW leg

Read `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-194-r6-shared.md`
FIRST and in full. It carries the tree SHA, the measured gate, the standing bars,
the known-open list, and two standing charges you must answer.

You are `review-194-r6`. Report to
`/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r6.md`.

## Your charge

Correctness, readability, architecture. You are the leg that reads the code as
code, not as a set of claims to verify.

## Prior rounds — what YOUR predecessor found, so you do not re-find it

Round 5's review leg filed F1-F7. All were addressed this round. Round 5's review
ALSO reported `GO_BUILD_EXIT=0` against a stubbed `web/dist` — a non-fact, because
my brief told all three legs how to stub it. That is why charge C-A exists.

## Targeted charges

R-1. **The two legs were merged by me, not by them.** They never compiled
together until I merged them. Leg B re-signatured the package-level free
functions `store.LifecycleStages` and `store.LabelDeltaLifecycleStages` to return
an error, but deliberately left the *interface methods* 2-valued so leg A would
compile untouched. Read that decision critically. Is the resulting split — free
functions that can fail, interface methods that cannot — coherent, or does it
just relocate the problem? Every implementer of the interface can still return
an empty set silently; only the free function turns that into an error.

R-2. **`CreateTask`'s new gate uses a different shape from `UpdateTask`'s.**
`UpdateTask` charges the full cross product `for from in before { for to in after }`.
`CreateTask` charges `for to in after` against a single `from` = the creation
stage. The comment argues the creation stage is the correct origin. Is it? Note
the synthetic task it builds (`&ent.Task{Stage: stage, CollectionID: collID}`)
has a nil `ClosedAt`, so it always models an OPEN issue even when the caller is
creating a closed one.

R-3. **`Validate` now REJECTS config keys that normalise together while naming
different values.** This is a new failure mode for existing deployments: a config
that loaded yesterday can refuse to load today. Is the error message good enough
for an operator to act on without reading the source? Is rejection the right
call versus a warning? (I ruled that it ships; I want your independent read on
whether I was right.)

R-4. **`NewLabelMapper` now iterates config maps in sorted key order** as a
determinism backstop. Sorted-key iteration to fix nondeterminism is a pattern
that often hides the real problem rather than fixing it. Say whether it earns
its place here or whether it makes a latent bug quieter.

R-5. **`hasExternalUnavailableLabel` is deliberately PREFIX-TOLERANT** while
`authorizationStage` is prefix-gated. The code argues this asymmetry is correct
because the former can only WITHHOLD. Evaluate that argument. "Make it consistent"
is the plausible-sounding fix the code explicitly warns against — decide whether
the warning is right.

R-6. The `computeReady` fix (a scheduler, not a gate, reading the display
collapse). Is the withhold-shaped fix complete, and are there other consumers of
`MapLabelsToStage` or `node.Stage` that are gates or schedulers rather than
display?

R-7. Read the two project log entries added this round. Round 5's log contained
false claims that took a round to find. Check every factual assertion in the new
ones against the code.
