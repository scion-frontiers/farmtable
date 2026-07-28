# #194 round 6 — security audit leg (`audit-194-r6`)

Tree `label-write-scope-r6` @ `6ced24e`. Independent audit leg, one of three
parallel reviewers. Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r6.md`.

**Verdict: REQUEST CHANGES.** Critical 0, High 1, Medium 2, Low 4, Info 3.

No production code was modified. Probe files were created, run, and deleted;
restoration verified by sha256 manifest over all 466 tracked files against an
out-of-repo pristine copy.

---

## The finding that matters most: the TOCTOU window is not a window

Charge A-4 said not to accept "acknowledged" as "bounded". It is not bounded,
and the reason is worth recording as a mechanism because it will not survive in
the commit messages.

Three facts compose into a free primitive:

1. **Removing an absent terminal label is free at the gate.** `before` and
   `after` are both computed from the labels present *at authorization time*
   (`server.go:748-767`). A `remove_labels` naming a label the issue does not
   currently carry yields `before == after`, `SameStageSet` short-circuits, and
   nothing is charged. Measured with a positive control: 4 of 4 terminal labels.
2. **The write is blind.** `p.RemoveLabels` is resolved by `labelNamesToIDs`
   against the **repo-wide label index**, not against the issue's labels
   (`passthrough.go:497-505`), then removed unconditionally. Errors are
   discarded (`_ =`).
3. **`p.Version` is never consulted** anywhere in
   `GitHubPassThroughStore.UpdateTask` (verified across lines 409-610).

So the exploit needs no race precision:

```
loop:  UpdateTask(task, remove_labels=["ft:stage/wont_fix"])
```

Every iteration authorizes as free and writes unconditionally. The moment a
maintainer applies the label, the next iteration destroys it. The attacker
pre-authorizes a destructive write against a **future** state. Effective window
approaches 100%, bounded only by rate limit, on a bare `task:write`.

The general lesson, which outlives this fix: **a gate that reasons about a state
the write path never re-consults is not a gate, it is a suggestion.** Round 6
correctly made the gate read a *set* instead of a tiebreak winner; it did not
make the writer honour the set the gate read.

---

## The seam is worse than stated on reachability, not on severity

Charge A-2 asked whether the collapse seam can ESCALATE. **It cannot.** Two
independent brute-force searches, each with its own positive control, found
**0 escalations**: 12 free two-step edits leave the gate's stage set identical
(the label dies, the stage never moves), and across all 256 stage×spelling
combinations there are 0 cases where the set stayed equal while the *singular*
`TerminalLabelStage` — which drives `ComputeAvailability` and the claim gate —
drifted. That was the most plausible hidden escalation channel and it is clean.
The EM's severity characterisation stands.

It is worse on **reachability**. `stripForMatch` strips the push prefix once and
then applies **three sequential `TrimPrefix` calls** (`stage/`, `priority/`,
`priority:`). Every subset, in that fixed order, normalises to the bare stage
name. Predicted 8 before measuring; measured 8:

```
ft:completed                  ft:priority:completed
ft:stage/completed            ft:stage/priority:completed
ft:priority/completed         ft:priority/priority:completed
ft:stage/priority/completed   ft:stage/priority/priority:completed
```

**80 authorized spellings across 10 stages, uniformly 8 each** — the shared brief
says four, which undercounts by half. The consequence is that "two labels naming
one stage" is not a coincidence an attacker waits for; it is constructible.

**Honest narrowing:** those 12 destructions are measured at the *mapper* level.
At the *store* level labels are applied only via `labelNameToID` against the
cached repo label index and unknown names are **silently dropped**, so step one
requires the alternate spelling to already exist as a repo label. Farm Table only
ever writes `ft:stage/*`. End-to-end reachability is therefore conditional on
repo label inventory or on GitHub label-admin. The narrower claim is the true one.

---

## The invariant does not hold: `InsertTasksAfter`

Charge A-1 asked for the write paths *not* on the list. `InsertTasksAfter`
(`server.go:277-335`) requires only `task:write` and assigns
`Labels: step.GetLabels()` straight into `CreateTaskParams` with **no**
`LabelDeltaLifecycleStages` gate — the exact control `CreateTask` received this
round, on the sibling creation RPC that also takes a `labels` field.

It is unreachable today only because pass-through returns `ErrNotImplemented`
(`passthrough.go:405`, re-verified rather than assumed). **The protection is
incidental.** Nothing in `InsertTasksAfter` knows the invariant exists, and there
is no test or comment to catch it the day pass-through implements the RPC.

This is round 5 repeating within round 6: the gate was applied to the RPC someone
was looking at, not to the value. Also unenumerated: `ImportCollection`
(`export_import.go:710-736`, writes `Stage` and `Labels` under `collection:admin`,
which does **not** imply `task:close` — scopes are independent strings) and
inbound `SyncCollection` (`github.go:93-99`, actor `uuid.Nil`, no gate).

**Recommendation for r7:** stop asserting exhaustiveness in prose. Generate it —
reflect over every `CreateTaskParams`/`UpdateTaskParams` construction site and
every Ent `SetStage`/`SetLabels` caller and assert each is either gated or on a
named allow-list. A claim of exhaustiveness whose fixture cannot express a new
unguarded call site is decorative, by this branch's own defect taxonomy.

---

## The server throws the operator's label config away

`NewPlatformResolver()` (`resolver.go:14-27`) takes **no config parameter** and
calls `NewPassThroughStore(..., nil, ...)`, which falls back to `DefaultConfig()`.
Wired that way at `cmd/farmtable-server/main.go:61`. The CLI
(`connect.go:299`) passes the real config.

So in server mode the whole `github.labels` block — `push_prefix`, `stages`,
`priorities`, `types` — is **silently ignored**. Round 6's unification of the
push prefix between reader and writer is dead code server-side, and worse, the
disagreement it eliminated reappears across the CLI/server process boundary: with
`push_prefix: "acme:"` the CLI writes `acme:stage/completed`, the server's
`matchPrefix()` is still `"ft:"`, the terminal set is empty for every one of the
operator's own labels, and edits touching them become free. That is the A-2
disarm, reintroduced.

Two corollaries:

- **Charge A-5 answers itself.** `Validate` is not a DoS surface, because it is
  **unreachable in server mode** — `LoadConfig` is called from exactly one place,
  `connect.go:292`, with an operator-controlled path. Config is never
  attacker-influenced.
- **KNOWN-OPEN #5 is settled.** The custom-prefix end-to-end matrix is not
  blocking, but for an unstated reason: it is currently unexercisable through the
  server at all. It should be sequenced *behind* this fix, not landed before it.

---

## Corrections to the shared brief

- **"four authorized spellings each" is wrong; it is eight** (80 total). This is
  a number about the live seam, off by 2×.
- **`go test ./...` is not reliably EXIT 0.** My first run failed:
  `TestWatchTasks_CreatedEvent` timed out at 5.01s. Characterised rather than
  reported blind — 10/10 pass isolated, 6/6 pass for the package, 3/3 pass on
  further full runs; **1 failure in 4 full runs, on the cold-cache run**, where
  compile contention starved a 5s timeout. The file is not touched by this branch
  (last modified `328e347`). Not a #194 defect — but with no CI (#12), the first
  CI run *is* a cold-cache run, so whoever lands CI will see red and blame the
  wrong change.

## What I got wrong, and did not run

- My most promising lead was that an empty `before` would make
  `for _, from := range before` iterate zero times and charge nothing. **Wrong** —
  `ErrEmptyLifecycleStageSet` (`store.go:160-162, 191-195`) denies before the loop
  is reached. Recording it because its death is evidence the F7 fix is
  load-bearing, and it was the best escalation candidate I had.
- I ran `grep -c "t.Skip"` on the collapse-seam test file, got 1, and briefly
  believed the brief was wrong. **My grep was wrong**: it matched the prose of a
  comment ("do not reach for `t.Skip`"), not a call. Both characterization tests
  are active and pass. Same wrong-grep class the developers disclosed; it produced
  a false alarm rather than a false all-clear only by luck.
- **I did not run `make race` or `go test -race`.** No independent evidence about
  data races — the most material gap in my coverage, given the lazily cached label
  index is shared per collection.
- The A-4 probe models the gate with `AllTerminalLabelStages` directly, while
  production calls `lifecycleStagesForLabels`. The conclusion survives (the
  fallback returns the same value on both sides, so the edit is still free), but
  it is a simplification of the real call path, not a faithful model.
- The write half of A-4 is established by **code reading, not execution**. A fake
  GraphQL client asserting `removeLabels` fires for a label absent at decision
  time would settle it.

## Credit where due

`ErrEmptyLifecycleStageSet` is the best change in the round: one rule, one place,
and it **denies** instead of substituting — the previous `(current, current)`
fallback was fail-open and was the same rule written twice. Charging the whole
stage set rather than a tiebreak winner removes an access-control decision from an
ordering parameter, and the rank-0 argument for why no ordering fixes it is sound.
`AllTerminalLabelStages` deliberately declines to inherit two defects from
`TerminalLabelStage`; refusing to reuse a nearby function *because it fails open*
is the right instinct. Sorted map iteration, with the 60/440 non-determinism
measurement recorded as the reason, was found by measuring rather than reviewing.
