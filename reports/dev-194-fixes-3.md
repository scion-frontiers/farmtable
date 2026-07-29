# dev-194 fixes, round 3

**Branch:** `close-label-swap` · **Range:** `9f98ad8..651da26` (4 commits) · **Not pushed.**

Round 2 failed the gate on two REQUEST CHANGES. All six scope items are done. One
consequence is reported rather than fixed, per the brief. Nothing Critical or High was
found beyond the item-1 blocker, and `-race` surfaced nothing new.

```
9f98ad8  (round 2 head, baseline)
d768d0d  Keep the F2 stage demotion out of authorization and scheduling
4ea2fc8  Reconcile the tree-walk and pass-through comments with F2
32f4b01  Add a race make target and read the caches through their accessors
651da26  Log the #194 round-3 authorization and scheduling fixes
```

---

## Item 1 — BLOCKER: authorization must read the un-demoted stage

### What was wrong

`server.go` computed the required scope from `existing.Stage`. `transitions.go` requires
`task:accept` for any move out of a terminal stage. F2 rewrote that *source* value from
terminal to `accepted`, so the rule stopped matching and the call fell through to the
`task:write` default. A token with `task:write` and deliberately without `task:accept`
could move a reopened `wont_fix`/`duplicate`/`cancelled`/`completed` issue back into the
active pipeline.

### The fix

Restored the pre-F2 authorization behaviour without touching the transition table. F2
keeps the demoted stage for display; authorization reads the label-derived stage.

| Symbol | File | Role |
|---|---|---|
| `LabelMapper.TerminalLabelStage` | `labels.go` | the terminal stage a label set names, pre-demotion |
| `GitHubPassThroughStore.LifecycleStage` | `passthrough.go` | that stage, else `t.Stage` |
| `store.LifecycleStager` + `store.LifecycleStage` | `store.go` | optional-capability seam, falls back to `t.Stage` |
| `MultiStore.LifecycleStage` | `multistore.go` | routes to the store owning the collection |
| `FarmTableService.UpdateTask` | `server.go` | `authStage := store.LifecycleStage(...)` feeds `TransitionScope` |

**I did not use the audit's suggested carrier.** The brief said `NativeLabel` "is already
populated at passthrough.go:218" and to verify rather than paste on trust. It is populated
— from the **post**-demotion stage (`NativeLabel: string(stage)`). Reading it would have
been a silent no-op that looked like a fix. It is also user-visible as `NativeStatus` and
copied into the ephemeral mirror, so it is a poor place for an authorization input
regardless.

### The tightening direction — examined, and it is not a policy change

The brief required the `task:write` → `task:close` tightening be given the same scrutiny
as the loosening. It is not a separate policy decision; it is the same bug seen from the
other side.

`TransitionScope` short-circuits to `ScopeTaskWrite` when `from == to`, because
re-asserting a stage a task already holds is an ordinary write, not a lifecycle
transition. Pre-F2, setting `stage=completed` on a `completed`-labelled issue hit that
short-circuit. Post-F2 the source read `accepted`, so it presented as `accepted →
completed`, matched the any→terminal rule, and demanded `task:close`.

Reading the lifecycle stage restores the no-op detection automatically. **One fix, both
directions** — no separate justification for `task:close` is needed, because none was ever
intended. The reviewers observed this only for `completed`; I measured it across all four
terminal stages and pinned all four.

### Acceptance: the sink-binding gap is closed

The brief's acceptance criterion was a test in `internal/server` that fails when the authz
fix is reverted. At `9f98ad8`, reverting F2 failed tests only in
`internal/platform/github` — **zero** in `internal/server`.

New file `internal/server/authz_terminal_reopen_test.go` wires the production object graph
(EntStore → MultiStore → `github.NewPlatformResolver()` → `NewFarmTableService`) around a
real OPEN issue carrying a terminal label:

- `TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen` — 4 labels × 5
  destinations, asserts `PermissionDenied` naming `task:accept`
- `TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue` — positive control, so
  "deny everything" does not pass
- `TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite` — the tightening
  direction, all four terminal stages

**Mutation `R-AUTHZ`** — revert `authStage := store.LifecycleStage(ctx, s.store, existing)`
to `TransitionScope(string(existing.Stage), ...)`:

```
=== R-AUTHZ: KILLED (rc=1) 2 funcs / 24 subtests ===
--- FAIL: TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen   (20 subtests)
--- FAIL: TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite   ( 4 subtests)
--- R-AUTHZ restored, git status --porcelain empty
```

Every failure in `internal/server`. That is the binding the brief asked for.

---

## Item 2 — BLOCKER: live over-report of abandoned work

### Assessment of where to fix it

The auditor named the ephemeral path; the brief said that vector is unwired (#202). I
verified the wiring rather than reconstructing it: `main.go` builds `NewMultiStore` +
`SetResolver(github.NewPlatformResolver())` + `NewFarmTableService(s, version,
WithEventBus(eventBus))`, with **no ephemeral pool**. The ephemeral vector is dead; the
pass-through path is live.

The test reviewer called the real vector "cosmetic". It is not: `ComputeAvailability` is
what decides whether an abandoned task is offered as work.

**Fixed server-side, and this is the right layer.** `taskToProto` type-asserts
`availabilityComputer` on `s.store` (the MultiStore), which delegates to the pass-through
store's `ComputeAvailability`, and the result goes on the proto `availability` field.
`web/src/utils/task-ready.ts:9-11` defers to that field when present. So the web
dashboard, `ft ready` and the MCP `task_ready` tool all inherit one answer.

**`task-ready.ts` needs no change.** Stated explicitly, as asked.

### Changes

- `ComputeAvailability`: `store.IsTerminalStage(t.Stage)` → `store.IsTerminalStage(s.LifecycleStage(ctx, t))`
- `issueUnavailableForClaim(issue, t, lifecycleStage)`: gains the lifecycle stage as an
  explicit parameter and gates on it

The claim gate moved with availability because its own doc comment states the two "must
not disagree" about what unavailable means, and the claim gate is the enforcing half. The
auditor predicted items 1+2 would largely subsume the claim laundering; see the assessment
below.

**Mutation `R-AVAIL`** — revert to `t.Stage`:

```
=== R-AVAIL: KILLED (rc=1) 2 funcs / 0 subtests ===
--- FAIL: TestAudit_ReopenAfterCloseIsDisplayedOpenButNotScheduled
--- FAIL: TestPassThroughStore_OpenTerminalLabelledIssueIsDisplayedOpenButNotScheduled
--- R-AVAIL restored, git status --porcelain empty
```

### A trade-off I took rather than hid

OPEN + terminal label has two producers that labels and issue state cannot distinguish: a
legitimate reopen (live work) and a maintainer declining an issue without closing it (not
work). This is the root cause behind #203. F2 chose the display-optimistic reading; I took
the scheduling-conservative one.

They are not in conflict — the issue displays as open and unfinished, and is not handed to
an agent — but a genuinely reopened issue now needs its stale label cleared before it can
be claimed. That cost is written into the test comment, not left implicit.
`stateReason=REOPENED` is the signal that could actually separate the two cases; flagged
as a #203 candidate, **not implemented** (scope discipline).

Three F2-authored tests failed after this change. I verified with `git log -S` that all
three originated in `0b87721` (F2 itself), so rewriting them narrows F2's own claim rather
than reverting pre-existing policy. They now encode the display/scheduling split.

---

## Item 3 — the tautological tree-walk pin

`TestComputeReady_OpenTerminalLabelledIssueIsNotReady` hand-built the node map it then
asserted on, so it could not fail whatever the constructor did — proved by the auditor's
MUT-T surviving. Rewritten to drive the real constructor: `buildIssueTree(...)` over real
issue nodes carrying real labels, then `computeReady(nodes, true)`, across all four
terminal labels. `TestComputeReady_OpenNonTerminalLabelledIssueIsReady` guards the other
side so "return nothing" cannot pass.

**Acceptance — MUT-T must now kill it.** Teaching `buildIssueTree` the symmetric demotion
rule:

```
=== MUT-T: KILLED (rc=1) 1 funcs / 4 subtests ===
--- FAIL: TestComputeReady_OpenTerminalLabelledIssueIsNotReady
    --- FAIL: .../ft:stage/completed  .../ft:stage/wont_fix
    --- FAIL: .../ft:stage/duplicate  .../ft:stage/cancelled
--- MUT-T restored, git status --porcelain empty
```

Previously **SURVIVED** with the package fully green. Criterion met.

---

## Item 4 — same-file items

**(a) `reopen_test.go` compound `&&` guard that could never fire.** Removed by splitting
the store-path assertion into its own test,
`TestPassThroughStore_OpenTerminalLabelledIssueIsDisplayedOpenButNotScheduled`, with an
unconditional `HasReason` assertion. One `&&` remains in the file — in the comment
recording why the guard was removed.

**(b) `treewalk_test.go` comment asserting the negation of F2's premise.** Reconciled
rather than deleted, because the two statements are about two different paths and both are
true:

- pass-through store → `IssueToPhaseStage` → demotes; the terminal label survives as the
  lifecycle stage, which availability and the claim gate consult
- tree walk → `buildIssueTree` → calls `MapLabelsToStage` directly, does **not** demote;
  the terminal stage reaches `computeReady` intact and the terminal arm excludes it

Different mechanisms, same outcome: an OPEN issue carrying a terminal label is never
scheduled. The comment now says that, scopes the test to what a hand-built map can prove,
and points at the end-to-end version in `reopen_test.go`.

**(c) `close_label_swap_test.go` ClosedAt arm.** Arm unchanged, as instructed. Added the
sentence naming the real call path — and it is reachable, not defence-in-depth:
`issueToTask` sets `ClosedAt` for every CLOSED issue (including the `UpdatedAt` fallback),
while `IssueToPhaseStage`'s closed branch lets a label override the stage without checking
whether that label is terminal. A CLOSED issue still labelled `ft:stage/working` therefore
arrives with exactly `Phase=open, Stage=working, ClosedAt` set. Two live producers:
`CloseTask`'s label swap failing after the close landed (the end-to-end case in the test
directly above it), and a maintainer closing an issue in the GitHub UI while it is
labelled in-flight — which in a pass-through collection is the normal way to close things.
Also documented that the test uses a zero-value store, which is what makes the
nil-receiver guard in `TerminalLabelStage` load-bearing.

---

## Item 5 — the race target

**`make race`** added (`go test -race ./internal/platform/github/`), scoped to the package
that has concurrency tests. Run: **rc=0, no `WARNING: DATA RACE`, nothing new surfaced.**

**Proof the target is load-bearing, not decorative.** Stripping the synchronisation off the
repoID cache (`RACE-REPOID`, run at HEAD where the test reads through the accessor):

```
plain go test  rc=0     0 failures, 0 races     <- the existing `test` target misses it
go test -race  rc=1     WARNING: DATA RACE
--- FAIL: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace
Write at 0x00c0000ca3d8 by goroutine 363:
  ...github.(*GitHubPassThroughStore).ensureRepoID()  passthrough.go:116
  ...github.TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace.func1()  concurrency_test.go:113
--- restored, git status --porcelain empty
```

Production-vs-production, not test-vs-production. The `test` target alone would never have
caught it.

**Accessors.** `concurrency_test.go` now asserts through `s.cachedRepoID()` and
`s.labelNameToID(...)` instead of reading `s.repoID` / `s.labelIndex` directly. Safe before
via the `wg.Wait()` barrier, but it modelled the exact access pattern the fix forbids and
meant the assertion stopped exercising the lock it covers.

**Off-goroutine failure reporting.** `concurrency_test.go:182` was already `t.Errorf`; the
actual defect was one level down — `statelessIssueHandler` read its body with
`mustReadBody`, whose `t.Fatalf` runs on an `http.Server` goroutine, where `FailNow` calls
`runtime.Goexit` on the wrong goroutine and the test hangs or fails somewhere unrelated
instead of stopping. Read inline, report with `t.Errorf`. Scoped to this file rather than
changing the shared `mustReadBody` helper.

---

## Item 6 — report corrections

### (a) Mutex call sites: 9 → **15**

The audit is right and round 2's report was wrong. Counted independently by content at
HEAD; 16 lines match, but one is inside `labelNamesToIDs` itself (the fan-out), so
**15 reaching call sites**:

| Function | Sites | Guards |
|---|---|---|
| `CreateTask` | 3 (`labelNameToID` direct) | one `ensureLabelIndex` |
| `UpdateTask` (pass-through) | 8 (via `labelNamesToIDs`) | five, one per branch |
| `ClaimTask` | 2 | one |
| `CloseTask` | 2 | one, `if err := s.ensureLabelIndex(ctx); err == nil {` |

**The dominance invariant** (which round 2 asserted without naming):

> Every one of the 15 sites is preceded, on the same goroutine and within the same call, by
> an `ensureLabelIndex` that returned; **and** `ensureLabelIndex` never publishes twice
> (`if s.labelIndex == nil`). Together these give: the map a reader observes is the one
> published under `cacheMu.Lock()` before that reader's own `cacheMu` acquisition inside
> `ensureLabelIndex`, and it is never mutated after publication.

Both halves are required, which is exactly why the mutation results split the way they do:
**MUT-X** (drop the `RLock`, keep the double-check) survives because the invariant still
holds, while **MUT-Y** (drop the `RLock` *and* allow re-publication) dies immediately
because it breaks the second half. The invariant spans two functions and rests on a
property of a third, which is why the lock stays — it is what keeps the read safe under a
future caller or a relaxed publish, rather than the argument above being re-derived.

`cachedRepoID` has exactly 1 production call site, dominated by `ensureRepoID`.

### (b) §7 row (e): 10 → **8**

Confirmed by execution, not conceded on assertion. Mutation (e) is `if
issueStateClosed(stateStr)` → `if true`, re-run at the exact commit the original figure was
measured at:

```
=== (e) at 9f98ad8: rc=1  funcs=6  subtests=8      <- reviewer is right; round 2 said 10
=== (e) at 32f4b01: rc=1  funcs=5  subtests=8
```

**Disclosure — the function count dropped 6 → 5 at HEAD.**
`TestComputeReady_OpenTerminalLabelledIssueIsNotReady` no longer fails under (e), because
item 3 rewrote it to go through `buildIssueTree` + `computeReady`, neither of which
consults `ClosedAt`. That is a real loss of *incidental* detection, traded for the test no
longer being tautological — it previously could not fail on its own subject matter at all
(MUT-T survived), and now does. (e) remains comfortably dead via five other functions.

### (c) Check (1) conflated a producer with the consumer

Round 2's check (1) argued: *"`UpdateTask:342-357` is itself one of the three producers of
this state, not a consumer of it."*

That is true of **`GitHubPassThroughStore.UpdateTask`** (`passthrough.go:389`), which
writes the labels. But the function that mattered for the question actually being asked —
does any live workflow depend on the un-demoted stage? — is **`FarmTableService.UpdateTask`**
(`server.go:483`), which *reads* `existing.Stage` and computes the transition scope from
it. Two different functions with the same method name at different layers.

The check answered "is `UpdateTask` a consumer of open+terminal state?" about the producer,
concluded no, and on that basis cleared the field for the demotion. The consumer sat one
layer up and was the exact thing F2 broke. This is why the round-2 impact analysis
concluded "no legitimate workflow is affected" while item 1's privilege downgrade was live
in the same commit.

The other four sub-checks (transitions table, `graph_routing.go`, import, `ft close` / `ft
release`) I re-read and they stand.

---

## Out of scope — assessed and reported, not fixed

### The stock GitHub `duplicate` label

`MapLabelsToStage` strips the configured prefix before matching, so GitHub's own
unprefixed `duplicate` label maps to `StageDuplicate`. Probed all ten stock GitHub labels:
**`duplicate` is the only collision** — `wontfix` does not match `wont_fix`, and none of
`bug`, `documentation`, `enhancement`, `good first issue`, `help wanted`, `invalid`,
`question` map to any stage.

**Does the fix subsume the laundering? Yes, in the escalation direction.** A bare
`duplicate`-labelled OPEN issue is now unavailable (`ComputeAvailability` reads the
lifecycle stage), unclaimable (`issueUnavailableForClaim` returns `ErrUnavailable` — there
is a test row for exactly the bare `duplicate` case), excluded from `ft ready` (the
tree-walk terminal arm already did this), and moving it out of terminal now requires
`task:accept`. **No live claimable path remains.**

**But the fix creates a consequence in the other direction, which I am reporting and not
fixing.** The stock `duplicate` label is now a denial-of-work primitive: anyone with GitHub
triage rights — a much wider set than Farm Table's RBAC, and in a pass-through collection
often including automation — can remove a live accepted task from the ready queue by
applying it. Two mitigating facts: for `ft:stage/duplicate` this was already true on the
tree-walk path, and for `duplicate` specifically the behaviour is arguably *correct*, since
a maintainer applying it means "don't work on this." What is new is that an unprefixed,
casually-applied stock label now reaches availability and the claim gate.

Assessed **Medium** — availability-affecting, requires repo triage permission, and it is
the conservative side of the trade-off — so not a STOP condition. Requiring the `ft:`
prefix for terminal stage labels would close it, and the brief is right that this is a
user-visible change needing its own decision. **Reported, not fixed.**

### #203 and #202

Untouched. #203 (splitting display from authoritative stage at the source) is the real fix
for this whole family and is architect-scoped; `LifecycleStager` is a seam that holds until
then, and a caller can still reach for `t.Stage` and get the display value. #202 (ephemeral
pool unwired) confirmed dead by inspecting `main.go`.

---

## Verification gate

Each redirected to a file, exit code read from `$?`, not from a pipeline.

```
go build ./...                              rc=0
go test ./...                               rc=0
make race                                   rc=0
go vet ./...                                rc=1   <- pre-existing, see below
```

### The `go vet` failure is pre-existing

Four `assignment copies lock value to ephReq` findings in the ephemeral handlers in
`server.go`. **Verified by execution, not by assertion**: checked out `9f98ad8` in the
throwaway worktree, supplied the `web/dist` assets the embed needs (without them vet aborts
early at `assets.go` and never reaches `internal/server` — that confounded the first
comparison), and got the identical four findings at lines `1500/1610/1818/1995`, matching
HEAD's `1516/1626/1834/2011` under this round's +16 net line shift. `git diff
9f98ad8..HEAD -- internal/server/server.go` contains **zero** occurrences of `ephReq`.

Same unwired ephemeral code as #202. Not fixed: unrelated to this brief, and an unreviewed
change to shared server code.

---

## Mutation testing

**Protocol.** Every mutation addressed **by content** — the harness replaces an exact
literal and **aborts unless the pattern occurs exactly once**, then verifies a diff exists
before running anything. This is the direct fix for round 2's line-addressed `sed` landing
in a docblock and reporting a false SURVIVED. Every run happened in a **disposable git
worktree at `/tmp/mut194`**, never in the dev clone, so restore-by-`git checkout` operates
on a tree holding no uncommitted work. `git status --porcelain` asserted empty after every
restore; all outputs written to `/tmp/mutout/`, outside the worktree.

### Acceptance mutations (this round's fixes)

| ID | Mutation | Result |
|---|---|---|
| `R-AUTHZ` | authz reads `existing.Stage` again | **KILLED** 2 funcs / **24 subtests, all in `internal/server`** |
| `R-AVAIL` | `ComputeAvailability` reads `t.Stage` again | **KILLED** 2 funcs |
| `MUT-T` | teach `buildIssueTree` the symmetric rule | **KILLED** 1 func / 4 subtests (was SURVIVED) |
| `RACE-REPOID` | strip synchronisation from the repoID cache | plain `go test` **rc=0**; `make race` **KILLED**, `WARNING: DATA RACE` |

### Regression set — the five previously-dead mutants stay dead

| ID | Mutation | Result |
|---|---|---|
| `M1` | demote every labelled open issue (over-broad) | **KILLED** 3 funcs / 10 subtests |
| `M2` | apply the demotion on the closed branch | **KILLED** 2 funcs / 3 subtests |
| `M3` | `issueStateClosed := !issueStateOpen` | **KILLED** 2 funcs / 5 subtests |
| `M4` | `issueStateOpen := !issueStateClosed` | **KILLED** 1 func / 3 subtests |
| `R-F2-BROAD` | demote on both branches | **KILLED** 4 funcs / 13 subtests |
| `R-F2-CLOSED` | apply demotion to the closed branch | ≡ `M2`, see note |

**Note on `R-F2-CLOSED`.** As described in `audit-194-r2` (M2) and `test-194-r2`
(R-F2-CLOSED), these are the *same* mutation under two IDs, and they produce the same
signature (2 funcs / 3 subtests) — which is itself the confirmation. Recorded once rather
than run twice under different names and presented as independent evidence.

Killer detail:

```
M1: OpenIssueStaysAvailable(5), IssueToPhaseStage_LabelsOverride,
    IssueToPhaseStage_OpenIssueKeepsNonTerminalStage(5)
M2: IssueToPhaseStage_LabelsOverride,
    IssueToPhaseStage_ClosedIssueKeepsTerminalStage(wont_fix, duplicate, cancelled)
M3: IssueStateHelpers_Casing(3), IssueToTask_UnrecognisedStateIsNotClosed(2)
M4: IssueStateHelpers_Casing(3)
R-F2-BROAD: the union of M1 and M2's killers
```

### The disclosed surviving mutant

MUT-X / RACE-B (drop the `RLock` in `labelNameToID`, keep the double-check) still survives.
Accepted per the brief and **not chased**. It is explained by the dominance invariant in
item 6(a), and MUT-Y confirms the guard is load-bearing the moment the invariant's second
half weakens.

### No self-built oracles

The one place this was a live risk is `TestIssueUnavailableForClaim`, which gained a
`lifecycle` column. That column is **stated per case**, not derived from `tc.task` —
deriving it would have re-run the mapper's demotion logic inside the test and agreed with
production by construction. There is a comment in the table saying so.

---

## Deliverables

- **Commits:** `9f98ad8..651da26` on `close-label-swap`. **Not pushed** — the manager
  pushes.
- **Project log:** `.design/project-log/close-label-swap-authz-and-scheduling.md`, with a
  "Not done, and why" section.
- **This report.**

## For the deploy disclosure

Two things belong in it that were not true of the round-2 artefact:

1. **The round-2 F2 impact analysis was void** and its conclusion should not be carried
   forward. "No legitimate workflow is affected" rested on check (1), which examined the
   wrong `UpdateTask` — see item 6(c). The F2 *fix* survives review; the *analysis* did
   not.
2. **The `duplicate` denial-of-work consequence** in the out-of-scope section above is a
   live, user-visible behaviour change shipping with this branch, and it is unticketed.
