# close-label-swap — round 3: keeping the F2 demotion out of authorization

Third pass on `close-label-swap`. Round 2 (`9f98ad8`) failed the gate: both the
security audit (`audit-194-r2`) and the test review (`test-194-r2`) returned
REQUEST CHANGES. Three commits, `9f98ad8..32f4b01`.

The headline defect was a privilege downgrade introduced by round 2's own F2
fix, so most of this entry is about undoing an authorization consequence while
keeping the display behaviour that F2 was written for.

## The defect

F2 (`0b87721`) made `IssueToPhaseStage` demote a terminal stage label on an OPEN
issue to `accepted`. The reasoning was sound for display: an OPEN issue carrying
`ft:stage/completed` is not finished work, and reporting it as finished hides
live work from every agent and human reading the queue.

But `Task.Stage` is read for two different questions, and F2 only considered
one. `FarmTableService.UpdateTask` computes the required scope from
`existing.Stage`, and the transition table requires `task:accept` for any move
out of a terminal stage. With the source value rewritten from terminal to
`accepted`, that rule stopped matching and the call fell through to the
`task:write` default.

The result: a token holding `task:write` but deliberately *not* `task:accept`
could take a `wont_fix`, `duplicate`, `cancelled` or `completed` issue and move
it back into the active pipeline. The accept gate is exactly the control that is
supposed to stop that, and it was silently bypassed for the entire class of
issues that had been closed and reopened on GitHub.

There was a second, opposite-direction consequence that the reviewers only
observed for `completed`. `TransitionScope` short-circuits to `task:write` when
`from == to`, because re-asserting a stage a task already holds is an ordinary
write, not a lifecycle transition. Pre-F2, re-stamping `completed` on a
`completed`-labelled issue hit that short-circuit. Post-F2 the source read
`accepted`, so it looked like `accepted → completed`, matched the any→terminal
rule, and started demanding `task:close`. Measured across all four terminal
stages, not just the one that was reported.

## The fix

Both directions come from the same root cause — authorization reading a field
that a GitHub label can rewrite — so both are fixed by one change: give
authorization a way to ask for the *un-demoted* stage.

- `LabelMapper.TerminalLabelStage` reports the terminal stage a label set names,
  before F2's demotion. Nil-receiver guarded, because `ComputeAvailability` is
  total on a zero-value store and has to stay that way.
- `GitHubPassThroughStore.LifecycleStage` returns that stage if there is one,
  and `t.Stage` otherwise.
- `store.LifecycleStager` is the optional-capability interface, with
  `store.LifecycleStage` as the free function that type-asserts and falls back
  to `t.Stage`. `MultiStore` forwards to whichever store owns the collection.
- `FarmTableService.UpdateTask` computes the transition scope from that value.

Deliberately **not** fixed by changing the transition table. The table is
correct; the value being fed into it was wrong.

The proper repair is #203 — splitting the display stage and the authoritative
stage apart at the source so a caller cannot pick the wrong one by accident.
That is architect-scoped and out of this round. `LifecycleStager` is the narrow
seam that holds until then, and the comment at the call site says so.

### Rejected: carrying it in `NativeLabel`

The audit suggested `NativeLabel` as the carrier, noting it was already
populated. It is — from the *post*-demotion stage (`NativeLabel: string(stage)`),
so reading it would have been a silent no-op that looked like a fix. It is also
user-visible as `NativeStatus` and is copied into the ephemeral mirror, which
makes it a poor place to put an authorization input regardless.

## Scheduling: the same demotion was over-reporting available work

The demoted stage also reached `ComputeAvailability`, so an OPEN issue carrying
a terminal label reported `available=true`. Fixed server-side rather than in the
web client: `taskToProto` type-asserts `availabilityComputer` on the store and
puts the result on the proto, and `web/src/utils/task-ready.ts` defers to that
field when it is present. `task-ready.ts` needs no change.

**Correction (round 4):** the sentence originally here claimed the web dashboard,
`ft ready` and the MCP `task_ready` tool "all inherit it" — that is false, and
only the web dashboard does. `ft ready` filters server-side via `GetReadyTasks`
and never reads the availability field, and MCP `task_ready` calls that same RPC
and drops it; unifying them is #202.

`issueUnavailableForClaim` moved with it. Its own doc comment says it and
`ComputeAvailability` must not disagree about what unavailable means, and the
claim gate is the enforcing half.

### The trade-off, stated

OPEN + terminal label has two producers that labels and issue state cannot tell
apart: a legitimate reopen (live work) and a maintainer declining the issue
without closing it (not work). F2 chose the display-optimistic reading; this
round chooses the scheduling-conservative one. They are not in conflict — the
issue shows as open and unfinished, and is not handed to an agent — but a
genuinely reopened issue now needs its stale label cleared before it can be
claimed. The cost is written into the test that pins it.

GitHub's `stateReason=REOPENED` is the signal that could actually distinguish
the two. Noted as a candidate for #203, not implemented here.

## Tests

The gap that mattered most was a *sink-binding* gap. Reverting F2 at `9f98ad8`
failed tests only in `internal/platform/github` — zero in `internal/server`,
which is where the authorization consequence lives. `internal/server/authz_terminal_reopen_test.go`
closes that: it wires the production object graph (EntStore → MultiStore →
PlatformResolver → FarmTableService) around a real OPEN issue carrying a
terminal label and drives `UpdateTask` over 4 labels × 5 destinations, plus a
positive control holding `task:accept`, plus the `from == to` no-op case across
all four terminal stages. Reverting the authz fix now fails 24 subtests in
`internal/server`.

The tree-walk pin `TestComputeReady_OpenTerminalLabelledIssueIsNotReady` was
tautological — it hand-built the node map it then asserted on, so it could not
fail whatever the constructor did. It now drives `buildIssueTree` with real
labels. Confirmed by mutation: teaching `buildIssueTree` the demotion rule
previously left the package green and now kills the test.

## `make race`

The #198 concurrency tests only assert anything under the race detector, and
nothing in the repo ran them that way, so `go test ./...` was green against the
exact code they exist to reject. Added a `race` target scoped to that package.

Verified it is load-bearing rather than decorative: stripping the
synchronisation off the repoID cache leaves `go test` at rc=0 with zero failures
and `make race` at rc=1 with `WARNING: DATA RACE` — a production-vs-production
race, `ensureRepoID` writing against `ensureRepoID` reading.

## Not done, and why

- **#203 — splitting `IssueToPhaseStage` into display and authoritative
  stages.** The real fix for this whole family. Architect-scoped and explicitly
  out of this round. `LifecycleStager` is a seam, not the split; it means a
  caller can still reach for `t.Stage` and get the display value. Route it.
- **#202 — the ephemeral pool is unwired.** The audit named the ephemeral path
  as the over-report vector. It is not reachable: `main.go` builds
  `NewMultiStore` + `SetResolver` + `NewFarmTableService` with no ephemeral
  pool. The live vector was the pass-through path, which is what got fixed.
- **The stock GitHub `duplicate` label.** GitHub's own `duplicate` label carries
  no `ft:` prefix, and the mapper strips prefixes before matching, so it maps to
  `StageDuplicate`. The claim and availability fixes subsume the escalation
  direction — a `duplicate`-labelled issue is no longer claimable, and moving it
  out now requires `task:accept`. The *opposite* direction is a live consequence
  worth a decision: anyone with GitHub triage rights can remove a task from the
  ready queue by applying a stock label. Requiring the `ft:` prefix would close
  it, but that is user-visible and needs its own ticket. Reported, not fixed.
  `duplicate` is the only stock GitHub label that collides — `wontfix` does not
  match `wont_fix`.
- **audit F7 — `UpdateTask` relabels to a terminal stage without closing the
  issue.** Untouched, as in round 2. Still worth a ticket.
- **`go vet ./...` reports 4 `copies lock value` findings** in the ephemeral
  handlers in `server.go`. Pre-existing at `9f98ad8`, verified by execution
  against that commit — identical findings, and this round's diff does not touch
  those lines. Same unwired code as #202. Not fixed here because it is unrelated
  to this brief and would be an unreviewed change to shared server code.
- **The disclosed surviving mutant (dropping the `RLock` in `labelNameToID`
  while keeping the double-check)** is still accepted and still survives. It is
  explained by a dominance invariant, not a gap — see the report.
