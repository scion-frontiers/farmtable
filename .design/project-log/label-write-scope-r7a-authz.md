# #194 round 7, leg A — the free retryable label-destruction primitive

Branch `label-write-scope-r7a`, based on `6ced24e`. Four commits: `8098f29`
(RED), `6e98097` (A-4), `11b30c1` (M-1), `9b52260` (M-2). Not pushed.

Leg B edited test files concurrently; six files were off-limits to this leg and
none of the eleven files I touched is one of them.

Full report: `reports/dev-194-r7a.md` in the scratchpad. This entry records the
things that will not survive in the commit messages.

---

## The mechanism, written down

**This is the transferable part.** Three separately-defensible decisions
composed into a bypass that none of them contained.

1. The round-6 gate in `server.go` prices a label write by comparing lifecycle
   stage **sets** computed from the snapshot `existing`. Removing a label that
   is not in the snapshot yields `before == after`, `SameStageSet` is true, the
   gate short-circuits, and nothing is charged. Correct in isolation: a write
   that changes no stage should not cost a transition scope.
2. The write in `passthrough.go` is unconditional. `labelNamesToIDs` resolves
   names against `s.labelIndex`, which is populated from `listRepoLabels` — a
   **repo-wide** index, not the issue's own labels. So a name the snapshot never
   carried still resolves to a node ID and the mutation still lands. Correct in
   isolation: the index is how you turn a name into an ID.
3. `p.Version` is never consulted on this path. Correct in isolation: nothing
   asked for optimistic concurrency here.

Compose them: a `task:write`-only caller removes a terminal label that is not
currently on the issue, is charged nothing, and the write goes out anyway. If
another actor adds the label in the window, it is destroyed. The caller retries
**free and unbounded** until it wins. That is what turns a race into a
primitive — the attempt has no price, so the window's width stops mattering.

The addition mirror is the same defect with the arrow reversed: re-adding a
label already present is also free, and the blind write reverts another actor's
*authorized* removal.

### The generalisable lesson

An authorization decision computed from a snapshot is only sound if the write it
authorizes is **bound to that same snapshot**. Round 6 made the decision
snapshot-relative and left the write absolute. Any future gate of this shape has
the same hole unless the write is narrowed to what the gate actually saw.

---

## Why the fix went where it did

Narrowing (shape b), not `p.Version` (shape a). The decisive argument is not
cost: **`p.Version` is caller-supplied and optional on this path, so the
attacker closes the hole by sending less.** A control the adversary disables by
omitting a field is not a control. Making it mandatory would break every client
and would *still* leave the retry free.

The narrowing had to bind to the **server's** snapshot. The passthrough re-reads
`target` itself, so intersecting against that read only shrinks the window — the
retry stays free. Hence a new optional store interface,
`SnapshotLabelWriteRestrictor`, routed by `MultiStore` exactly as the two
`LifecycleStageSetStager` methods are, called once from `server.go` with
`existing`.

**Why an interface rather than an inline filter in `server.go`.** Label identity
is case-insensitive on GitHub (`labelMatchKey`) and exact-string on Ent
(`mergeLabels`). An inline filter would have to pick one. Picking exact-string
reopens the `FT:Stage/Wont_Fix` folding hole that round 6 already pinned;
picking case-folding silently changes native add semantics. The interface keeps
each store's own identity rule inside that store — same reason the stager seam
exists.

The gate's prediction and the write's narrowing **must use the same matcher**.
If they disagree about when two names are the same label, the write drops
something the gate priced or keeps something it did not.

---

## What un-discarding the write errors immediately found

All ten `_ = s.gql.{add,remove}Labels(...)` sites now route through one helper
that returns. (I predicted eight before measuring; the two in `ClaimTask` were
the miss.)

That change surfaced a defect that had been invisible for as long as the tests
have existed: both `internal/server` GraphQL mocks answered the label mutations
with `{"clientMutationId":null}`, but the real mutations select
`labelable{labels(first:1){nodes{name}}}` and never select `clientMutationId`.
`githubv4` could not unmarshal it. **Every label mutation in those two files had
been failing at the client level, silently**, because the error went into `_`.
The tests passed because the mutation still went over the wire and the mock
still applied it.

Not a production bug — real GitHub returns only the selected fields, and the
`internal/platform/github` mocks were already correct. But it is a clean example
of the actual cost of a discarded error: it hid a broken fixture from a suite
whose entire job is to measure that path.

---

## M-1: a config that only the CLI could read

`NewPlatformResolver()` took no config and passed hardcoded `nil`, and
`github.LoadConfig` is reached from `internal/cli/connect.go` and nowhere else
in non-test code. A deployed server therefore **always** ran `DefaultConfig()`.

Since B6 `push_prefix` is a security parameter — it decides which labels may
feed an authorization answer. So an operator who customised their prefix had the
round-6 gate silently **disarmed**: their labels were not recognised as
lifecycle labels at all, every terminal-label edit read as "no transition", and
the dashboard told them the control was on. A gate that is off for exactly the
operators who customised something is worse than no gate, because it
manufactures confidence.

**Why the existing suite could not see it.** There were already seven
prefix/label cells at service level
(`TestTerminalStageInput_RequiresTheConfiguredPrefix`) and they were all green.
They build the store via `NewPassThroughStore` **directly** — one layer below
the resolver, which is precisely the layer that was wrong. Injecting below the
defect is invisible to any number of cells above it. The new test drives
`NewPlatformResolver` itself.

The mutation signature confirms this and is worth remembering: restoring the
hardcoded `nil` reddens only the *custom-prefix* cells; the default-config cells
stay green. **A default-config test structurally cannot see a
config-not-threaded defect.**

`main.go` now fails fatally on an invalid config (matching the encryption-key
precedent immediately above it) but treats a *missing* file as "use defaults",
which is what `LoadConfig` documents. `DefaultConfigPath` is now shared, because
two call sites that disagree about where the config lives would put the CLI and
the server on different security parameters.

---

## M-2: rejection beat gating, for a reason beyond cost

`InsertTasksAfter` applied `step.Labels` with no lifecycle gate, unreachable on
GitHub only because passthrough returns `ErrNotImplemented`. Rejecting outright
was cheaper, but the better argument is semantic: `CreateTask` can *price* a
label because it has a `req.Stage` the caller is separately authorized for.
Every `InsertTasksAfter` step is created in **triage**, so a label naming a
terminal stage expresses an intent this endpoint cannot carry out at any price.
No legitimate request is refused.

Detection reuses `LabelDeltaLifecycleStages` rather than matching `"ft:"`, so it
follows the operator's configured prefix automatically. Hardcoding the prefix
here would have rebuilt M-1 in a new place.

The test's second row — ordinary label → `Unimplemented` — is doing double duty.
It is the differential that proves the control is label-specific, **and** it is
an executable record of the reachability status. Implement pass-through
`InsertTasksAfter` and that row changes answer, forcing the implementer here.
That is a better reachability record than a comment, because a comment cannot
fail.

---

## Carried forward to r8

Enumerating every label write path (29 rows, in the report) turned up one thing
the audit did not have:

- **`PriorityLabelSwap` and `TypeLabelSwap` in passthrough `UpdateTask` are real
  ungated GitHub label writes under bare `task:write`,** and
  `RestrictLabelWriteToSnapshot` does not cover them — it is applied to
  `req.AddLabels`/`RemoveLabels` only. Intentional today, since they are not
  lifecycle labels. But it means `writeLabelSwap` has two callers whose inputs
  are never checked against `LabelDeltaLifecycleStages`. If a configuration ever
  lets a priority or type label collide with the stage namespace, that is the
  bypass. **Unconfirmed** — I did not construct such a config. It needs r8's
  custom-prefix matrix to settle.

Also open, and deliberately not touched this round: `ImportCollection` writes
`Labels` and `Stage` independently under `collection:admin` only (defensible,
but a later `RegisterPlatform` makes an unpriced label set authoritative);
`CloseTask` bypasses the shared write helper and logs its errors, so the one
label write that cannot fail loudly is the one that stamps terminal stages;
the inbound `SyncCollection` adapters are dead code holding both `uuid.Nil`
actor literals in the repo, and whoever wires one inherits an ungated write
path.

And the standing bound on all of #194: under `ft connect`, `FARMTABLE_OPEN_ACCESS=1`,
or an unset `FARMTABLE_TOKEN`, no auth interceptor is registered, `RequireScope`
short-circuits to allow, and every gate in this workstream is computed and
thrown away.
