# dev-194-fixes — audit/review/test fix round on `close-label-swap`

Branch `close-label-swap`, confirmed at `c1ec1ba` before starting. Review range
`d7314cf..c1ec1ba` (rebased onto the full #191 branch). Seven commits added, not
pushed.

```
9f98ad8 Log the #194 audit fix round
af93cb0 Guard the pass-through store's lazy caches with a mutex
1d889ba Leave a trace when CloseTask's best-effort writes fail
4ac117e Give the claim gate the same ClosedAt arm availability has
c973a51 Pin the three close-path premises that nothing enforced
0b87721 Stop a terminal stage label outranking an open GitHub issue
a70d3d1 Read the remote issue state field exactly one way
```

---

## Summary of the six scope items

| # | Item | Commit | Status |
|---|---|---|---|
| 1 | audit F1 — one reading of remote `state` | `a70d3d1` | done |
| 2 | audit F2 — the reopen inverse | `0b87721` | done, **preferred symmetric route** |
| 3 | test-194 gaps 1–3 | `c973a51` | done, plus gaps 5–8 |
| 4 | review-194 H1 — `ClosedAt` arm on the claim gate | `4ac117e` | done |
| 5 | audit F5 / review-194 M1 — four silent swallows | `1d889ba` | done |
| 6 | audit F4 / review-194 M2 / GitHub #198 — mutex | `af93cb0` | done, separate commit |

---

## 1. F1 — the remote state field, read exactly one way

`issueToTask` compared the raw state string byte-for-byte against `"CLOSED"`;
`IssueToPhaseStage` immediately next to it used `EqualFold`; `treewalk.go`
compared exactly in four more places. New `internal/platform/github/state.go`
holds the only two readings in the package:

```go
func issueStateClosed(state string) bool { return strings.EqualFold(state, "closed") }
func issueStateOpen(state string) bool   { return strings.EqualFold(state, "open") }
```

Call sites converted: `issueToTask`, `hasOpenSubIssue`, `IssueToPhaseStage`, and
four in `treewalk.go` (`computeReady` ×2, `computeBlocked` ×2).

**The inversion warning is honoured and pinned.** `issueStateClosed` is not
`!issueStateOpen`. `TestIssueStateHelpers_Casing` includes `""`, `"MERGED"` and
`"closed "` and asserts **both** `closed=false` and `open=false` for each, and
`TestPassThroughIssueToTask_UnrecognisedStateIsNotClosed` asserts end-to-end
that an unrecognised state leaves `ClosedAt` nil and the task available.

**Interaction with #191: no conflict.** The brief asked me to stop and report if
there were one. #191 consolidated the *terminal-stage* predicate in
`computeReady` (`store.IsTerminalStage(node.Stage)`); F1 touches the *issue-state*
string comparisons. Orthogonal, different fields. F1 additionally fixed two real
latent bugs the tree walk had: a lowercase parent state emptied the ready queue,
and a lowercase child state stopped blocking its parent.

### Audit reproduction — `TestAudit_LowercaseClosedStateDefeatsFix`

BEFORE (test added, fix not yet applied):

```
--- FAIL: TestAudit_LowercaseClosedStateDefeatsFix/closed
    state_test.go:83: ClosedAt is nil for state="closed"; the ClosedAt availability arm cannot fire
--- FAIL: TestAudit_LowercaseClosedStateDefeatsFix/closed/null-closedAt
--- FAIL: TestAudit_LowercaseClosedStateDefeatsFix/Closed
--- FAIL: TestAudit_LowercaseClosedStateDefeatsFix/Closed/null-closedAt
```

AFTER: all 6 subtests pass. Committed as a permanent regression test.

**One correction to the audit's reproduction, self-caught.** My first version of
this test also asserted `Phase == PhaseClosed`. That failed even for canonical
`"CLOSED"`, because `IssueToPhaseStage`'s closed branch checks labels before
`stateReason` — which is **#193, out of scope**. I removed the assertion and
replaced it with a comment explaining that `ClosedAt` is precisely the non-label
signal that keeps availability correct in spite of #193. The audit's reproduction
as written would have failed for a reason unrelated to F1.

---

## 2. F2 — the reopen inverse

### Route taken: the **preferred symmetric fix**

In `IssueToPhaseStage`, a terminal stage label may not outrank GitHub saying the
issue is open:

```go
if stage, ok := m.MapLabelsToStage(labels); ok && !store.IsTerminalStage(stage) {
    return phaseForStage(stage), stage
}
```

Such an issue falls through to `accepted` — the same stage an unlabelled open
issue gets. Placed in `IssueToPhaseStage` because it has exactly one production
caller, `issueToTask`, so the change stays on the pass-through read path.

### The `UpdateTask` analysis the brief gated this on

The question: *does any legitimate workflow depend on an open issue holding a
terminal stage?* If yes, stop and report — a product decision. **Answer: no.**
Five checks, all read-only against `internal/server/`:

1. **`UpdateTask:342-357` is itself one of the three producers of this state,
   not a consumer of it.** `ft update --stage completed` relabels the issue and
   `updateIssue` never changes GitHub issue state, so the issue stays OPEN with
   a terminal label. That is audit F7. It is a bug in the same family, not a
   workflow to preserve — a user who types `--stage completed` means the work is
   finished, and leaving the issue open on GitHub already fails that intent. The
   demotion makes the failure visible rather than creating it.
2. **`transitions.go` does not require the state.** The transition table gates
   any→terminal on `task:close` and terminal→non-terminal on `task:accept`.
   `TransitionScope` only relaxes the un-privileged direction, so nothing needs
   a task to *rest* in open+terminal to move through it.
3. **`graph_routing.go` never sets `Stage`.** Ruled out as a producer entirely.
4. **Import cannot reach the pass-through store.** `MultiStore.ImportCollection`
   (`multistore.go:377`) always routes to the primary store, and
   `GitHubPassThroughStore.ImportCollection` (`passthrough.go:806`) returns
   `ErrNotImplemented`. So no import path can deliberately construct open+terminal
   on a GitHub-backed collection.
5. **`ft close` and `ft release` are unaffected.** `ft close` closes the issue,
   so the state is CLOSED and the closed branch is unchanged. `ft release` moves
   to a non-terminal stage.

The only producers of open+terminal are the three failure modes named in the
code comment (reopen, `ft update --stage completed`, a partially failed close),
and all three already fail the user's intent. So the preferred route was taken,
per the brief's instruction.

### Audit reproduction

Filed by the audit as `TestAudit_ReopenAfterCloseIsUnavailable`; committed as
`TestAudit_ReopenAfterCloseStaysAvailable`, named for the property it now
asserts rather than the bug. The rename is documented in the doc comment.

BEFORE:

```
--- FAIL: TestAudit_ReopenAfterCloseStaysAvailable
    reopen_test.go:61: DENIAL-OF-WORK: reopened OPEN issue reports available=false;
        stage = completed, reasons = [terminal]
```

AFTER: passes. Four more tests were added around it, two of them specifically to
stop the rule being over-broad — `OpenIssueKeepsNonTerminalStage` (all six
non-terminal stages must still win on an open issue) and
`ClosedIssueKeepsTerminalStage` (a closed `wont_fix` must not become `completed`).

### Known divergence, pinned not fixed

`buildIssueTree` calls `MapLabelsToStage` directly rather than
`IssueToPhaseStage`, so the tree walk still sees `completed` for an open
terminal-labelled issue. Such an issue is available and claimable but does not
appear in `GetReadyTasks`. I did **not** close this: it changes the semantics of
a ready-queue predicate that #191 consolidated in the commit immediately below
this branch, and the divergence is fail-safe (the queue under-reports).
`TestComputeReady_OpenTerminalLabelledIssueIsNotReady` pins both halves and its
failure message instructs the next reader to delete it once the tree walk is
taught the rule.

---

## 3. test-194 gaps 1–3 (plus 5–8)

No production change. Gaps 1, 2, 3 as specified; 5, 6, 7, 8 came along because
they were in the same file and cheap:

- **Gap 1** — `TestPassThroughGetTask_OpenIssueStaysAvailable`, parameterised
  over all six non-terminal stages (which also closes **gap 6**). This is the
  one with real blast radius: #194 Part 2 made `issueToTask`'s `ClosedAt`
  assignment safety-critical for the first time, only the CLOSED direction was
  pinned, and every inverse test built `ent.Task` by hand and bypassed
  `issueToTask` entirely.
- **Gap 2** — `TestPassThroughCloseTask_ReReadFailureStillReportsClosed`.
- **Gap 3** — `TestPassThroughCloseTask_LabelIndexFailureStillCloses`.
- **Gap 5** — `TestPassThroughCloseTask_CloseFailureTouchesNoLabel`: nothing
  asserted that a failed close touches no label, which is the entire safety
  property the close-then-swap ordering exists to provide.
- **Gap 7** — the fake's `labelIDs` universe omitted `in_review`, `in_qa`,
  `deploying` and `duplicate`, so the swap was only ever exercised for two
  stages. Now all ten.
- **Gap 8** — `removeLabelByID` aliased `f.labels[:0]` while ranging over
  `f.labels`. Correct as written, a trap to edit. Rebuilt into a fresh slice.

The fake gained three failure modes (`failLabelIndex`, `failIssueRead`,
`failClose`), each failing one GraphQL operation so the test drives the real
`CloseTask` through the real error branch.

**Gap 4 not covered.** Transport-level failures (connection reset, 5xx, context
cancellation) take a different path through the client and need harness work
beyond this round. Named in the commit message and the project log.

### test-194's mutant (e) now dies

Mutation (e): set `ClosedAt` for OPEN issues too (`if issueStateClosed(stateStr)`
→ `if true`).

```
########## mutation e ##########
  --- FAIL: TestPassThroughClaimTask_ListsOnlyOpenIssues (0.00s)
  --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable (0.00s)
      --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable/triage (0.00s)
      --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable/accepted (0.00s)
      --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable/working (0.00s)
      --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable/in_review (0.00s)
      --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable/in_qa (0.00s)
      --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable/deploying (0.00s)
  --- FAIL: TestAudit_ReopenAfterCloseStaysAvailable (0.00s)
  --- FAIL: TestPassThroughClaimTask_ReopenedIssueIsClaimable (0.00s)
  --- FAIL: TestComputeReady_OpenTerminalLabelledIssueIsNotReady (0.00s)
  --- FAIL: TestPassThroughIssueToTask_UnrecognisedStateIsNotClosed (0.00s)
      --- FAIL: TestPassThroughIssueToTask_UnrecognisedStateIsNotClosed/state= (0.00s)
      --- FAIL: TestPassThroughIssueToTask_UnrecognisedStateIsNotClosed/state=MERGED (0.00s)
  FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.080s
```

Was: **SURVIVED**. Now: 6 test functions, 10 subtests.

Mutants (c) and (d) also now die — see §7.

---

## 4. review-194 H1 — `ClosedAt` on the claim gate

```go
func issueUnavailableForClaim(issue *issueNode, t *ent.Task) bool {
	return t.Stage != task.StageAccepted ||
		t.ClosedAt != nil ||
		t.HoldReason != nil ||
		hasExternalUnavailableLabel(t.Labels) ||
		hasOpenSubIssue(issue)
}
```

The doc comment states plainly that it is a behaviour-preserving no-op today and
why: `ClaimTask` resolves from a `listIssues` call filtered to `IssueStateOpen`,
so `ClosedAt` is always nil at this point.

Two tests, per the brief's "would fail if it were removed *and* the enforcement
path changed":

- `TestPassThroughClaimTask_ClosedIssueIsNotClaimable` **changes the enforcement
  path** — the fake matches by substring and ignores the `states` variable, so
  pointing it at a CLOSED issue delivers exactly what a widened filter or a
  stale cache would. The label is `ft:stage/accepted` deliberately: on the closed
  branch labels still win, so `Stage` reads `accepted` and waves it through, and
  `ClosedAt` is the only signal left. `ErrAlreadyClaimed` does not cover for it
  either, since a closed issue need not carry an assignee.
- `TestPassThroughClaimTask_ListsOnlyOpenIssues` **pins the premise**, so
  widening the filter fails a test next to the comment explaining what the arm
  then starts doing.
- Plus a `{"closed", ...}` case in the existing `TestIssueUnavailableForClaim`
  table.

Mutations:

```
=== H1 mutation: remove the ClosedAt arm from issueUnavailableForClaim ===
--- FAIL: TestPassThroughClaimTask_ClosedIssueIsNotClaimable (0.00s)
--- FAIL: TestIssueUnavailableForClaim (0.00s)
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.043s

=== H1 premise mutation: widen ClaimTask's list filter to include CLOSED ===
--- FAIL: TestPassThroughClaimTask_ListsOnlyOpenIssues (0.00s)
    claim_gate_test.go:83: ClaimTask's issue-list query does not filter to OPEN only.
        If that is intentional, the ClosedAt arm of issueUnavailableForClaim is no
        longer a no-op — it is now the gate stopping closed issues from being claimed.
        ... "states":["OPEN","CLOSED"]}}
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.013s
```

---

## 5. F5 / review-194 M1 — the four silent swallows

**Control flow is exactly as it was**, as instructed. `log.Printf` added at all
four sites; the only structural addition is an `else` branch on
`ensureLabelIndex`, which did not previously exist because the error was
discarded by the `err == nil` guard.

Each line names repo and issue (`acme/repo#1`), what failed, and what state the
issue is left in. `s.repoSlug()` is a new two-line helper — a process serves many
pass-through stores, so a bare issue number is ambiguous. `log.Printf` matches
`internal/store/multistore.go:133`, so no new dependency or pattern.

`TestPassThroughCloseTask_BestEffortFailuresAreLogged` asserts each line **and**
that the close still succeeds in the same subtest, so it also catches a future
change that promotes one of these to a returned error.

Mutation — remove all four `log.Printf` calls:

```
=== F5 mutation: restore the four silent swallows ===
--- FAIL: TestPassThroughCloseTask_BestEffortFailuresAreLogged (0.00s)
    --- FAIL: .../label_index (0.00s)
    --- FAIL: .../label_writes (0.00s)
    --- FAIL: .../post-close_re-read (0.00s)
    --- FAIL: .../add_label (0.00s)
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.048s
```

---

## 6. #198 — the mutex (separate commit `af93cb0`)

### All three touch points were checked — this is the part flagged as likely to go wrong

The manager's correction was that `CloseTask` touches the racy map at three
points, not one: the write in `ensureLabelIndex` and the two reads via
`labelNamesToIDs` for the remove set and the add set. **The before-fix race
report confirms all three independently**, which is the evidence that the reads
were not overlooked:

```
WARNING: DATA RACE
Read at 0x00c00034b1f0 by goroutine 12:
  (*GitHubPassThroughStore).ensureLabelIndex()  passthrough.go:100     <-- read #1 (fast path)
  (*GitHubPassThroughStore).CloseTask()          passthrough.go:651

Previous write at 0x00c00034b1f0 by goroutine 11:
  (*GitHubPassThroughStore).ensureLabelIndex()  passthrough.go:107     <-- the write
  (*GitHubPassThroughStore).CloseTask()          passthrough.go:651
```

```
WARNING: DATA RACE
Read at 0x00c0003ca018 by goroutine 13:
  (*GitHubPassThroughStore).labelNameToID()      passthrough.go:115    <-- read #2/#3
  (*GitHubPassThroughStore).labelNamesToIDs()    passthrough.go:122
  (*GitHubPassThroughStore).CloseTask()          passthrough.go:655

Previous write at 0x00c0003ca018 by goroutine 11:
  (*GitHubPassThroughStore).ensureLabelIndex()  passthrough.go:109
  (*GitHubPassThroughStore).CloseTask()          passthrough.go:651
```

Seven distinct `WARNING: DATA RACE` reports in total for the `CloseTask` test,
plus one for `ensureRepoID`.

### BEFORE the mutex commit

```
=== BEFORE the mutex fix: go test -race -run Concurrent ===
--- FAIL: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.03s)
--- FAIL: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace (0.00s)
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.061s
```

### AFTER the mutex commit (`-count=5`)

```
=== AFTER the mutex fix: go test -race -run Concurrent ===
--- PASS: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.02s)
--- PASS: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace (0.00s)
--- PASS: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.02s)
--- PASS: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace (0.00s)
--- PASS: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.02s)
--- PASS: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace (0.00s)
--- PASS: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.02s)
--- PASS: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace (0.00s)
--- PASS: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.02s)
--- PASS: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace (0.00s)
ok  	github.com/farmtable-io/farmtable/internal/platform/github	1.158s
```

### The race test drives concurrent `CloseTask`, not `ensureLabelIndex` in isolation

Eight goroutines, each closing a different issue, released together from a
`start` channel. The full RPC was **not** impractical under the fake, so no
narrowing was needed.

It does **not** reuse `fakeIssueRepo`. That fake mutates its own fields on every
request, so concurrent use would trip the detector inside the test double and
either mask the production race or be mistaken for it. `statelessIssueHandler`
derives every response from the request body alone and shares nothing, so any
race reported is in the store.

### Shape

`sync.RWMutex`, read-locked fast path, fetch performed **outside** the lock,
re-check under the write lock. Holding the lock across the GitHub round trip
would serialise every caller behind one HTTP request; the fetches are idempotent
reads producing the same value, so a duplicate request is the cheaper mistake.
The index is built into a local map and published in one assignment — filling
`s.labelIndex` entry by entry would show readers a partially populated map, and a
silently missing label ID is a skipped label write, which is quieter than the
crash it replaced.

`CreateTask` read `s.repoID` directly outside any lock; it now goes through a
`cachedRepoID()` accessor. `collectionID` is written once at construction and
left unguarded, with a comment saying so.

### An honest result about the read guard

The obvious mutation — keep the double-check, drop the `RLock` in
`labelNameToID` — **survives**:

```
=== #198 mutation: guard the populate path only, drop the RLock in labelNameToID ===
ok  	github.com/farmtable-io/farmtable/internal/platform/github	1.056s
```

I chased this rather than leaving it. The reason is that every one of the nine
`labelNameToID` / `labelNamesToIDs` call sites is preceded by `ensureLabelIndex`
on the same goroutine, and that acquires `cacheMu`, establishing happens-before
with whichever publish won. Two further mutations isolate it:

```
=== A: re-publish allowed (no double-check), labelNameToID unlocked ===
WARNING: DATA RACE   (×5)
--- FAIL: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.03s)

=== B: re-publish allowed (no double-check), labelNameToID read-locked ===
ok  	github.com/farmtable-io/farmtable/internal/platform/github	1.077s
```

So: the read lock is the mechanism that actually makes the read safe (B is safe
without the double-check; A is not). The double-check adds idempotence and, as a
side effect, an ordering argument that spans two functions and would evaporate
the moment someone adds a caller or relaxes the publish. Both guards stay, and
the comment on `labelNameToID` records both measurements rather than claiming a
coverage result the test does not deliver.

### Scope held

`MultiStore.platforms` is already correctly mutex-guarded; I did not add a
second lock there, and I did not expand this into a general concurrency review.
Nothing else was found that looked racy in the paths I touched.

---

## 7. The original nine mutations, re-run at final HEAD

All twelve (M1–M9 plus test-194's (c), (d), (e)) applied to committed code with
**no test file modified**, `cp` restore between each, `git diff --stat` clean
and suite green afterwards.

```
########## mutation M1 ##########   remove the label-swap block from CloseTask
  --- FAIL: TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable (0.00s)
  --- FAIL: TestPassThroughCloseTask_WontFixSwapsToWontFixLabel (0.00s)
  --- FAIL: TestPassThroughCloseTask_BestEffortFailuresAreLogged (0.00s)
      --- FAIL: .../label_index      --- FAIL: .../label_writes
      --- FAIL: .../add_label
  --- FAIL: TestPassThroughCloseTask_ConcurrentClosesDoNotRaceLabelIndex (0.01s)
  --- FAIL: TestAudit_ReopenAfterCloseStaysAvailable (0.00s)

########## mutation M2 ##########   remove `|| t.ClosedAt != nil`, Part 1 intact
  --- FAIL: TestPassThroughCloseTask_LabelWriteFailureStillCloses (0.00s)
  --- FAIL: TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel (0.00s)
      --- FAIL: .../accepted  .../working  .../in_review  .../in_qa  .../deploying
  --- FAIL: TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal (0.00s)
  --- FAIL: TestPassThroughCloseTask_ReReadFailureStillReportsClosed (0.00s)
  --- FAIL: TestPassThroughCloseTask_LabelIndexFailureStillCloses (0.00s)
  --- FAIL: TestAudit_LowercaseClosedStateDefeatsFix (0.00s)
      --- FAIL: .../CLOSED  .../CLOSED/null-closedAt  .../closed
      --- FAIL: .../closed/null-closedAt  .../Closed  .../Closed/null-closedAt

########## mutation M3 ##########   drop the IsTerminalStage arm, keep ClosedAt
  --- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim (0.00s)
      --- FAIL: .../completed  .../wont_fix  .../duplicate  .../cancelled

########## mutation M4 ##########   Part 2 as a second append instead of ||
  --- FAIL: TestPassThroughComputeAvailability_ClosedAtDoesNotDuplicateTerminalReason

########## mutation M5 ##########   terminal arm unconditional (`if true`)
  --- FAIL: TestPassThroughComputeAvailability_OpenTaskStillAvailable (0.00s)
  --- FAIL: TestPassThroughGetTask_OpenIssueStaysAvailable (0.00s)
      --- FAIL: .../triage .../accepted .../working .../in_review .../in_qa .../deploying
  --- FAIL: TestAudit_ReopenAfterCloseStaysAvailable (0.00s)
  --- FAIL: TestComputeReady_OpenTerminalLabelledIssueIsNotReady (0.00s)
  --- FAIL: TestPassThroughIssueToTask_UnrecognisedStateIsNotClosed (0.00s)
      --- FAIL: .../state=  .../state=MERGED
  --- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal (0.00s)
      --- FAIL: .../accepted .../working .../in_review .../in_qa .../deploying

########## mutation M6 ##########   hard-code StageCompleted in the swap
  --- FAIL: TestPassThroughCloseTask_WontFixSwapsToWontFixLabel (0.00s)

########## mutation M7 ##########   drop the post-swap re-read
  --- FAIL: TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable (0.00s)
  --- FAIL: TestPassThroughCloseTask_WontFixSwapsToWontFixLabel (0.00s)
  --- FAIL: TestPassThroughCloseTask_BestEffortFailuresAreLogged/post-close_re-read

########## mutation M8 ##########   make label writes fatal
  --- FAIL: TestPassThroughCloseTask_LabelWriteFailureStillCloses (0.00s)
  --- FAIL: TestPassThroughCloseTask_BestEffortFailuresAreLogged (0.00s)
      --- FAIL: .../label_writes  .../add_label

########## mutation M9 ##########   remove the UpdatedAt fallback for null ClosedAt
  --- FAIL: TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal (0.00s)
  --- FAIL: TestAudit_LowercaseClosedStateDefeatsFix (0.00s)
      --- FAIL: .../CLOSED/null-closedAt  .../closed/null-closedAt  .../Closed/null-closedAt

########## mutation c ##########   re-read fallback → return error
  --- FAIL: TestPassThroughCloseTask_ReReadFailureStillReportsClosed (0.00s)
  --- FAIL: TestPassThroughCloseTask_BestEffortFailuresAreLogged/post-close_re-read

########## mutation d ##########   ensureLabelIndex failure → fatal
  --- FAIL: TestPassThroughCloseTask_LabelIndexFailureStillCloses (0.00s)
  --- FAIL: TestPassThroughCloseTask_BestEffortFailuresAreLogged/label_index

########## mutation e ##########   ClosedAt set for OPEN issues  (§3 above)

########## restored ##########
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.055s
```

### Comparison against the recorded results

| # | Recorded | Now | Note |
|---|---|---|---|
| M1 | 2 tests | 5 tests | +F2 reopen test, +F5 logging test, +#198 race test |
| M2 | 3 tests / 7 subtests | 6 tests / 11 subtests | +F1 audit test, +gaps 2 and 3 |
| M3 | 4 subtests | 4 subtests | unchanged |
| M4 | 1 test | 1 test | unchanged |
| M5 | 2 tests / 6 subtests | 6 tests / 13 subtests | +gap 1, +F1 and F2 tests |
| M6 | 1 test | 1 test | unchanged |
| M7 | 2 tests | 3 tests | +F5 logging test |
| M8 | 1 test | 2 tests | +F5 logging test |
| M9 | 1 test | 2 tests / 3 subtests | +F1 audit test's null-closedAt arm |
| (c) | **SURVIVED** | 2 tests | gap 2 + F5 |
| (d) | **SURVIVED** | 2 tests | gap 3 + F5 |
| (e) | **SURVIVED** | 6 tests / 10 subtests | gap 1 + F1 + F2 |

Every mutation behaves as recorded or strictly better. None weakened.

**No self-built oracles.** Every test binds to real symbols —
`GitHubPassThroughStore.{GetTask,ClaimTask,CloseTask,ComputeAvailability}`,
`LabelMapper.IssueToPhaseStage`, `issueUnavailableForClaim`, `computeReady`,
`computeBlocked`, `issueStateClosed`, `issueStateOpen`, `store.IsTerminalStage`.

---

## 8. Gate run

```
===== go build ./... =====
OK

===== go vet ./... =====
internal/server/server.go:1500:14: assignment copies lock value to ephReq: ...GetReadyTasksRequest ... contains sync.Mutex
internal/server/server.go:1610:14: assignment copies lock value to ephReq: ...GetBlockedTasksRequest ... contains sync.Mutex
internal/server/server.go:1818:13: assignment copies lock value to ephReq: ...GetCriticalPathRequest ... contains sync.Mutex
internal/server/server.go:1995:13: assignment copies lock value to ephReq: ...GetBottlenecksRequest ... contains sync.Mutex
findings: 4

===== gofmt -l . =====
internal/server/scopes.go
internal/serverapp/linkflows_test.go
internal/serverapp/oauth.go
internal/serverapp/tokenrefresh.go
internal/serverapp/unified_test.go
internal/streaming/eventbus.go
internal/streaming/eventbus_test.go
(all files): 7

===== go test ./... -race =====
exit: 0   (no failures)
```

**`go vet`: 4 before, 4 after. No new findings.** All four are the pre-existing
copylocks findings in `internal/server/server.go` filed as #199. `gofmt`: the
same 7 pre-existing files before and after. Confirmed by direct comparison —
every vet and gofmt finding is in a file this branch does not touch:

```
=== files I changed (d7314cf..HEAD) ===
.design/project-log/close-label-swap-audit-fixes.md
internal/platform/github/claim_gate_test.go
internal/platform/github/close_label_swap_test.go
internal/platform/github/concurrency_test.go
internal/platform/github/labels.go
internal/platform/github/passthrough.go
internal/platform/github/passthrough_test.go
internal/platform/github/reopen_test.go
internal/platform/github/state.go
internal/platform/github/state_test.go
internal/platform/github/treewalk.go

=== overlap with vet/gofmt findings ===
none — every vet and gofmt finding is in a file this branch does not touch
```

`gofmt -l internal/platform/github/` is empty throughout.

---

## 9. Found but not fixed

1. **The tree walk still diverges from `IssueToPhaseStage` on F2.** Detailed in
   §2. Fail-safe direction; pinned by a test that instructs its own deletion.
   Not expanded into #191's territory. **This is the one I would route next.**
2. **audit F7 — `UpdateTask` relabels to a terminal stage without closing the
   issue.** Surfaced during the F2 analysis. The F2 fix makes its *effect*
   visible (the task no longer reports as finished) but the underlying
   asymmetry — `updateIssue` never changes issue state — is untouched. Not in
   scope; worth a ticket.
3. **#193 — labels outrank `stateReason` on the closed branch.** A closed issue
   with a stale non-terminal label still *reports* stage `working`.
   Availability is correct regardless. Out of scope, as in the previous round.
   It bit me once: the audit's F1 reproduction as written asserts a Phase value
   that #193 makes wrong even for canonical `"CLOSED"` (see §1).
4. **Test gap 4** — transport-level failures. Needs harness work.
5. **The three copies of the stage-label swap now differ deliberately** in error
   handling: `CloseTask` logs and continues, `UpdateTask` and `ClaimTask`
   return. The extraction the brief put out of scope now has a design question
   in front of it rather than being a mechanical move. Worth noting for whoever
   picks it up.

## 10. Out of scope, untouched

audit **F3** (hoisting `store.IsTerminal(t)` across three implementations),
audit **F6**, audit **F8**, and the stage-label-swap extraction. None of them
became blocking as a consequence of these changes; F3 and F6 are unaffected by
anything here, and the swap extraction is discussed above. `internal/server/`
was read for the F2 analysis and not modified.

**Not pushed.** Seven commits sit locally on `close-label-swap`.
