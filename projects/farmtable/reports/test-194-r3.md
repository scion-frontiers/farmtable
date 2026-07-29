# Test review — #194 `close-label-swap`, round 3

> ## ⚠️ SUPERSEDED IN PART — READ THE ADDENDUM FIRST
>
> **This round-3 body says "the fix is sound". That is WRONG and is formally retracted.**
> A **Critical** multi-label bypass was later confirmed by execution, including a
> **self-service** escalation path needing one token, two ordinary API calls, and no second
> actor. **Verdict is REQUEST CHANGES, blocking on F7.**
>
> The body below is left unedited on purpose — it stands as the round-3 record, mistake
> included. Jump to **[ADDENDUM](#addendum--multi-label-bypass-independent-verification-and-why-i-missed-it)**
> at the end of this file for the retraction, the confirmed findings (F7 Critical, F8 High,
> revised F1), and the account of why the vector was missed.
>
> Still valid from the body: **V2** (production reachability), **V5**, **V6**, and the
> sink-binding results **V1/V4** — they were executed and correct, they just answered
> narrower questions than the body claimed.

**SHA reviewed:** `651da265783ce8cbfda5d902e2a3f640ef345529` (verified `git rev-parse HEAD`;
`git diff --stat 651da26` empty and `git status --porcelain` empty at start and finish)
**Clone:** `/workspace/farmtable-test-194`
**Reviewer:** test leg
**Verdict: REQUEST CHANGES** — one High, one Medium, four Low. No production changes requested.

---

## Immediate flag — HIGH

**The centrepiece authz test has no floor. Deleting its entire table leaves it reporting PASS.**

The EM asked directly whether the 4 × 5 table is *pinned to an asserted count, not merely
produced*. Answered by execution: **it is not pinned**. This is the workstream's own named
defect class — "tests that disappear instead of failing" — living in the test that is the
blocking sink-binding for round 3's central claim.

The fix is ~10 lines of test code and touches no production code. Details in F1.

---

## Summary

The **fix itself is sound, reachable in production, and genuinely pinned.** I tried hard to
break it and could not. Specifically, the round-2 audit failure mode — proving something
against a faithful reassembly of an unwired path — is **not** repeated here; I confirmed
production reachability by execution (V2 below). The scheduling trade-off is pinned in both
halves. The tautological pin is genuinely fixed. `make race` is load-bearing.

Every finding I raise is in the **test scaffolding**, not the fix. But two of them
(F1, F2) are the specific questions the gate asked, answered in the negative, so the verdict
is REQUEST CHANGES rather than APPROVE-with-nits.

| # | Sev | Subject |
|---|-----|---------|
| F1 | **High** | Authz test table not pinned to a count; emptying it passes at rc=0 |
| F2 | **Medium** | Stock `duplicate` label escalates RBAC scope — undisclosed sink, unpinned |
| F3 | Low | Positive control passes vacuously when the terminal label is absent |
| F4 | Low | Mock repo label index is inert but carries a load-bearing claim |
| F5 | Low/Info | `TerminalLabelStage` nil guard is total but fails **open** |
| F6 | Low | `go test ./...` not green from a clean clone (pre-existing, environment) |

---

## Method note (and two self-corrections)

Per the standing bars: all mutations addressed **by content** via an anchor-checked helper
that aborts unless the anchor appears exactly once; restores by `cp` from `/tmp/ft194bak`
(outside the repo); `git status --porcelain` asserted empty after every restore.

I hit both traps the EM warned about, in my own tooling, and record them because they
changed my conclusions:

1. **A false "KILLED".** My first harness passed the package list as a single quoted
   argument, producing `rc=1 / [setup failed]`. Two mutations were briefly recorded as
   killed on the strength of the exit code alone. I added a guard requiring at least one
   real `--- FAIL` line, and re-ran; both were then genuinely killed, but the first result
   was worthless. A `rc=1` with zero FAIL lines is now reported INCONCLUSIVE, not KILLED.
2. **A false positive from my own probe.** My first stock-`duplicate` probe targeted
   `stage=working` and logged "DOES escalate" on any error. The error was
   `InvalidArgument: use ClaimTask` — a different gate entirely. Re-run against `in_review`
   and `accepted` with an explicit `PermissionDenied` + scope-name check, plus a `bug`
   control that must be ALLOWED. F2 rests on the corrected probe.

I also deviated from protocol once: I mutated `treewalk.go` for MUT-T without having taken a
`cp` backup of it first, and restored via `git show 651da26:… > file`. The tree was verified
byte-identical to the SHA immediately afterwards, but this is the restore mode the standing
bars forbid and I should have backed the file up first.

Everything below is marked **BY EXECUTION** or **REASONED**.

---

## Findings

### F1 — HIGH — Authz test table is not pinned to an asserted count

**File:** `internal/server/authz_terminal_reopen_test.go:218` (destination loop) and `:230`
(label loop)

**Reproduction.** Empty the label table, by content:

```
-		for _, label := range []string{"ft:stage/wont_fix", "ft:stage/duplicate", "ft:stage/cancelled", "ft:stage/completed"} {
+		for _, label := range []string{} {
```

```
$ go test ./internal/server/ -run 'TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen' -v
RC=0
--- PASS: TestUpdateTask_TerminalLabelledIssueStillRequiresAcceptToReopen (0.00s)
PASS
ok  	github.com/farmtable-io/farmtable/internal/server	0.008s
```

**BY EXECUTION.** Zero subtests, `0.00s`, exit 0, no diagnostic. The only count assertion
anywhere in the 310 lines is `len(list.GetItems()) != 1` at `:195`, which is per-fixture, not
per-table.

**Why it matters here specifically.** The EM's gate note records that at round 2 reverting F2
failed *zero* tests in `internal/server`, and that this test is what closed that sink-binding
gap. A test that silently degrades to zero cells reopens exactly that gap, and the only
signal is a runtime that drops to `0.00s` — which nobody reads on a green run.

To be fair to the change: the tables are inline composite literals, so they cannot be emptied
by *data*; this requires an edit. That is why it is High and not Critical. But "requires an
edit" is the normal way regressions arrive.

**Recommendation.** Pin the executed cell count. Cheapest version, at the top of the parent:

```go
dests := []struct{ name string; stage pb.TaskStage }{ ... }
labels := []string{ ... }
if got := len(dests) * len(labels); got != 20 {
    t.Fatalf("table covers %d cells, want 20 (4 terminal labels x 5 non-terminal destinations)", got)
}
```

Apply the same to the three other tables that carry the round's claims, all of which have the
identical shape:
- `authz_terminal_reopen_test.go:285` `TestUpdateTask_RestampingTheExistingTerminalStageStaysTaskWrite` (want 4)
- `internal/platform/github/reopen_test.go:196` `TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable` (want 5)
- `internal/platform/github/reopen_test.go:288` `TestComputeReady_OpenTerminalLabelledIssueIsNotReady` (want 4)

---

### F2 — MEDIUM — GitHub's stock `duplicate` label escalates the RBAC scope required for `UpdateTask`

**Files:** `internal/platform/github/labels.go:445` (`TerminalLabelStage` → `MapLabelsToStage`,
which matches prefix-insensitively via `stripForMatch`) feeding
`internal/server/server.go:551` (`authStage := store.LifecycleStage(ctx, s.store, existing)`)

The shared context discloses the stock-label consequence in the **scheduling** direction only:
*"anyone with GitHub triage rights can remove a task from the ready queue by applying a stock
label."* Round 3 added a **second sink** for the same root cause, and it is not disclosed and
not pinned: the same unprefixed label now also raises the scope required for an ordinary stage
write.

**Reproduction** (temporary probe, since removed; `bug` is the negative control):

```
label=duplicate          -> in_review : code=PermissionDenied accept-denial=true msg=missing required scope "task:accept"
label=duplicate          -> accepted  : code=PermissionDenied accept-denial=true msg=missing required scope "task:accept"
label=ft:stage/duplicate -> in_review : code=PermissionDenied accept-denial=true msg=missing required scope "task:accept"
label=ft:stage/duplicate -> accepted  : code=PermissionDenied accept-denial=true msg=missing required scope "task:accept"
label=bug                -> in_review : ALLOWED with agent token
label=bug                -> accepted  : ALLOWED with agent token
```

**BY EXECUTION.** GitHub's stock `duplicate` — shipped in every new repository, appliable by
anyone with triage rights, carrying no `ft:` prefix — is indistinguishable from
`ft:stage/duplicate` at the authorization gate.

**Severity reasoning (the independent read the EM asked for).** This is denial-of-work, not
privilege bypass: it makes the gate *stricter*, and the actor needs triage rights on the repo.
That caps it below High. It is above Low because (a) the coordinator ruled explicitly that
"it happened to get stricter" must get the same scrutiny as "it happened to get looser," and
this round created a brand-new stricter path keyed on an attacker-controllable, unprefixed
label; (b) the blast radius is wider than the disclosed scheduling case — an agent fleet loses
the ability to move the task at all, not merely to see it in the ready queue; and (c) it is
**invisible to the test suite**.

**Coverage asymmetry, which is the actionable part.** The claim-gate test *does* cover the
bare label — `TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable/duplicate` is one of
its five rows. The authz table covers only `ft:`-prefixed labels. So the branch tests the
stock-label behaviour on the scheduling path it disclosed, and not on the authz path it did
not.

**Recommendation.** Add one row — bare `"duplicate"` — to the label list at
`authz_terminal_reopen_test.go:230`, so the behaviour is pinned and visible to whoever takes
the product decision. (This raises the pinned count in F1 from 20 to 25.) Separately: if the
`ft:`-prefix requirement lands from the product call, it must land inside
`TerminalLabelStage` so it reaches **both** sinks; fixing it only in the scheduling path would
leave this one live.

---

### F3 — LOW — The positive control passes vacuously when the terminal label is absent

**File:** `internal/server/authz_terminal_reopen_test.go:260`
`TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue`

**Reproduction.** Make the fixture serve a non-stage label instead of the terminal one — i.e.
simulate "the mock issue never gets its terminal label":

```
-            "labels": {"nodes": [{"name": %q}]},
+            "labels": {"nodes": [{"name": "%.0sbug"}]},
```

```
$ go test ./internal/server/ -run 'TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue' -v
RC=0
--- PASS: TestUpdateTask_AcceptScopedCallerCanReopenTerminalLabelledIssue (0.01s)
ok  	github.com/farmtable-io/farmtable/internal/server	0.016s
```

**BY EXECUTION.** Under the same mutation the two negative tests both fail (rc=1) — so the
suite as a whole fails closed, which is why this is Low. But the control itself cannot
distinguish *"allowed because the caller holds `task:accept` on a terminal-labelled issue"*
from *"allowed because there was no terminal label and this was an ordinary write."* Its
docstring claims it rules out a gate that denies everything; it does not rule out a fixture
that labels nothing.

**Recommendation.** Make it a differential on one fixture rather than a bare allow:

```go
svc, taskID := newTerminalLabelledService(t, "ft:stage/wont_fix")
stage := pb.TaskStage_TASK_STAGE_ACCEPTED
req := &pb.UpdateTaskRequest{Id: taskID, Stage: &stage}

// Precondition: without task:accept this exact request must be denied.
if _, err := svc.UpdateTask(scopedCtx(agentScopes()), req); err == nil {
    t.Fatal("precondition failed: the fixture is not terminal-labelled, so this control proves nothing")
}
// The property: adding task:accept, and nothing else, must flip it to allowed.
if _, err := svc.UpdateTask(scopedCtx(append(agentScopes(), server.ScopeTaskAccept)), req); err != nil {
    t.Fatalf("UpdateTask with task:accept was rejected: %v", err)
}
```

(For the record: `append(agentScopes(), …)` is **safe** — `DefaultScopesForUserType` returns a
fresh composite literal per call at `internal/server/scopes.go:128`, so there is no shared
backing array to alias. I checked this because it is a classic table-test isolation bug.)

---

### F4 — LOW — The mock repo label index is inert but its comment claims otherwise

**File:** `internal/server/authz_terminal_reopen_test.go:120-132`

The fixture hard-codes all ten stage labels under a comment asserting it is load-bearing:

```go
case strings.Contains(bodyStr, "labels(first:"):
    // The repo label index. Every stage label must resolve or the
    // swap silently skips writes.
```

**Reproduction.** Delete every node from that response:

```
$ go test ./internal/server/ -run 'TestUpdateTask_(TerminalLabelled...|AcceptScoped...|Restamping...)'
rc=0
FAIL lines=0
ok  	github.com/farmtable-io/farmtable/internal/server	0.093s
```

**BY EXECUTION.** All 25 subtests pass with the index completely empty. The comment states a
dependency the tests do not have. On a workstream where round 2 went wrong partly because a
comment was read as a verified claim, an inert fixture asserting its own necessity is worth
removing.

Secondary point: those ten names duplicate what `LabelMapper` derives from
`prefix + "stage/" + s.String()`. A prefix change would desynchronise fixture from production
silently.

**Recommendation.** Either delete the index and its comment, or add a case that actually
depends on it. If kept, build it from `NewLabelMapper(DefaultConfig().GitHub.Labels)` rather
than hard-coding the strings.

---

### F5 — LOW / INFORMATIONAL — `TerminalLabelStage`'s nil guard is total, but fails *open*

**File:** `internal/platform/github/labels.go:441-443`

The shared context asked to prove the nil-receiver guard keeps `ComputeAvailability` total on
a zero-value store. **Confirmed BY EXECUTION** — probe against `var zero GitHubPassThroughStore`
with a task carrying `ft:stage/wont_fix`:

```
zero-value store: availability={Available:true Reasons:[]} err=<nil>
--- PASS: TestProbe_ZeroValueStoreComputeAvailabilityIsTotal (0.00s)
```

No panic; the claim holds. Noting only the direction of the failure: when the guard fires it
returns `("", false)`, `LifecycleStage` falls back to the demoted `t.Stage`, and availability
reports **declined work as available** — precisely the pre-fix behaviour this round removed.
The guard makes the code total by restoring the bug.

**This is unreachable in production** and I verified why rather than assuming: `NewLabelMapper`
(`labels.go:75`) always returns a non-nil `*LabelMapper`, and `NewPassThroughStore`
(`passthrough.go:53-67`) always assigns it. Informational only.

**Recommendation.** No action this round. Optionally record the fail-open direction in the doc
comment so a future caller does not read "total" as "safe."

---

### F6 — LOW — `go test ./...` is not green from a clean clone (pre-existing)

```
# github.com/farmtable-io/farmtable
assets.go:5:12: pattern all:web/dist: no matching files found
FAIL	github.com/farmtable-io/farmtable [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/farmtable-server [setup failed]
FAIL	github.com/farmtable-io/farmtable/cmd/ft [setup failed]
FAIL	github.com/farmtable-io/farmtable/internal/cli [setup failed]
```

`go test ./...` is rc=1 in my clone with **zero test failures** — four packages fail *setup*
on the missing embed artifact. Same for `go build ./...` and `go vet ./...`.

This is an environment artifact (web assets never built here), not a defect in this diff,
which touches no web assets. I record it only because the gate is quoted as `go test ./...
rc=0` and CLAUDE.md names that command: the difference between the EM's rc=0 and my rc=1 is
whether `make web` has been run, not anything about the branch. All my package-scoped runs
were green.

**Recommendation.** Out of scope for #194. Worth a separate ticket to document `make web` as a
prerequisite or guard the embed.

---

## What I verified and found sound

Everything in this section is **BY EXECUTION** unless marked.

### V1 — The seam is sink-bound in both directions (mutation)

| Mutation | Result |
|---|---|
| `MultiStore.LifecycleStage` → `return t.Stage` (break forwarding) | **KILLED**, 26 failing tests |
| `GitHubPassThroughStore.LifecycleStage` → `return t.Stage` | **KILLED**, 34 failing tests |

M3 fails tests in *both* `internal/platform/github` and `internal/server` — the sink-binding
the EM wanted is real and spans the layer boundary that round 2 missed.

### V2 — Production reachability CONFIRMED — the round-2 audit failure is not repeated

This was my highest-priority check, and the one the EM flagged as having bitten the audit leg.
The test builds its own resolver closure rather than calling `github.NewPlatformResolver()`,
so I did not take the wiring on trust. Probe against the **actual** production resolver:

```
concrete type from production resolver: *github.GitHubPassThroughStore
OK: *github.GitHubPassThroughStore implements store.LifecycleStager
terminal-labelled: display=accepted lifecycle=wont_fix
OK: un-demotion reachable through the production resolver
```

`main.go:60-61,98` builds `NewEntStore → NewMultiStore → SetResolver(github.NewPlatformResolver()) →
NewFarmTableService`. The test builds the same chain with a hand-written resolver returning the
same concrete type. Two divergences, both benign:

- **cfg `nil` (prod) vs `DefaultConfig()` (test)** — I checked this specifically, because a nil
  mapper would make `LifecycleStage` silently inert in production while the test passed. It
  cannot: `NewPassThroughStore` normalises `cfg == nil` to `DefaultConfig()` at
  `passthrough.go:54-56`.
- **no event bus in the test** — not on the authz path. REASONED.

Also included a fail-closed control (an unlabelled task must pass through unchanged), so the
probe is not asserting a tautology.

### V3 — The seam is symmetric under configuration

`TerminalLabelStage` → `MapLabelsToStage`, which returns `("", false)` when `!m.enabled`
(`labels.go:151`). My concern was that a deployment with label mapping disabled would keep the
demotion but lose the un-demotion, silently restoring the round-2 privilege downgrade.

It cannot. The demotion at `labels.go:414` is gated on the *same* `MapLabelsToStage` call, so
with labels disabled an open issue reaches `StageAccepted` via the plain fallback and there is
no demotion to undo. Producer and un-demoter are gated by one flag. **REASONED** from the two
call sites, corroborated by V2's execution results.

This was the "does the new seam change behaviour for any other caller" question, and it holds.

### V4 — The stated trade-off is pinned by tests, both halves (mutation)

| Mutation | Result |
|---|---|
| `ComputeAvailability`: `s.LifecycleStage(ctx, t)` → `t.Stage` | **KILLED**, 2 tests |
| Claim gate call site: `s.LifecycleStage(ctx, current)` → `current.Stage` | **KILLED**, 6 tests |

```
--- FAIL: TestAudit_ReopenAfterCloseIsDisplayedOpenButNotScheduled (0.00s)
    reopen_test.go:89: an OPEN issue still carrying a terminal stage label is offered as
    available work; the demotion must not reach computed availability, or a maintainer's
    wont_fix is laundered into claimable work (stage = accepted, reasons = [])
--- FAIL: TestPassThroughStore_OpenTerminalLabelledIssueIsDisplayedOpenButNotScheduled (0.00s)
    reopen_test.go:353: open terminal-labelled issue reports available=true; reasons = []
```

```
--- FAIL: TestPassThroughClaimTask_TerminalLabelledIssueIsNotClaimable (0.01s)
    --- FAIL: .../ft:stage/completed   --- FAIL: .../ft:stage/wont_fix
    --- FAIL: .../ft:stage/duplicate   --- FAIL: .../ft:stage/cancelled
    --- FAIL: .../duplicate
```

The log's claim that "the cost is written into the test that pins it" is **accurate**. The
scheduling-conservative choice fails loudly if reverted, on both the advisory and the
enforcement path, and `TestPassThroughClaimTask_ClearingTheStaleLabelRestoresClaimability` is a
real positive control for the remedy (unlike F3's).

### V5 — The tautological pin fix is genuine (MUT-T)

Re-ran audit-194-r2's MUT-T — teach `buildIssueTree` the demotion, the mutation that left the
whole package green at round 2:

```
$ go test ./internal/platform/github/    # with buildIssueTree demoting OPEN+terminal
MUT-T go test rc=1
--- FAIL: TestComputeReady_OpenTerminalLabelledIssueIsNotReady (0.00s)
    --- FAIL: .../ft:stage/completed  --- FAIL: .../ft:stage/wont_fix
    --- FAIL: .../ft:stage/duplicate  --- FAIL: .../ft:stage/cancelled
```

The rewrite drives the real constructor and uses `includeUnblocked=true`, and it kills the
mutation the old version survived. Genuine fix.

**Sibling check (the EM's specific ask).** `TestComputeReady_TerminalParentIsNotReady`
(`treewalk_test.go:59`, via `parentWithClosedChild` at `:14`) **still hand-builds its node
map**. I judge this acceptable rather than a finding: it is now honestly scoped by its comment
as a unit test of one `computeReady` arm, it explicitly disclaims saying anything about which
stage a real issue gets, and it names the end-to-end test that covers the constructor. That is
the correct resolution — the round-2 problem was a hand-built test *claiming* end-to-end
coverage, not hand-building as such. The other two hand-built maps
(`passthrough_test.go:105,120`) test `computeBlocked` and are unrelated to demotion.

### V6 — `make race` is load-bearing — reproduced independently

Stripped the `cacheMu` RLock/Lock from `ensureRepoID`:

```
════ plain 'go test' (no -race) ════
go test rc=0
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.063s

════ 'make race' ════
make race rc=2
DATA RACE blocks: 1
--- FAIL: TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace (0.00s)
```

```
WARNING: DATA RACE
Read at 0x00c0002204b8 by goroutine 363:
  ...(*GitHubPassThroughStore).ensureRepoID()  passthrough.go:115
Previous write at 0x00c0002204b8 by goroutine 368:
  ...(*GitHubPassThroughStore).ensureRepoID()  passthrough.go:116
```

The dev's claim is **correct**: broken synchronisation is invisible to `go test` and caught by
`make race`. The target earns its place. One nit: the claim says `make race` gives rc=1; it
gives **rc=2** (make's exit status for a failed recipe — the inner `go test -race` is rc=1).
Immaterial to the argument, but anyone scripting the gate on `rc == 1` would mis-handle it.

The accessor rewrite in `concurrency_test.go` is a genuine improvement: reading `s.labelIndex`
directly was the exact access pattern the test forbids, and routing through `labelNameToID`
means a weakened barrier races rather than silently passing.

### V7 — No fifteenth self-built oracle found

I enumerated all 25 locally-defined functions across the six changed test files and classified
each: HTTP-boundary mocks (`terminalLabelledIssuesResponse`, `mockGitHubForStageUpdate`,
`statelessIssueHandler`, the nine `fakeIssueRepo` methods), input builders
(`openParentWithClosedChildIssues`, `parentWithClosedChild`), wiring
(`newTerminalLabelledService`, `scopedCtx`), and trivial projections (`readyNumbers`,
`captureLog`). None re-implements an exported symbol and asserts against it.

`agentScopes()` **calls** `server.DefaultScopesForUserType("agent")` rather than restating the
scope list — the obvious place for oracle #15, and it was avoided.

Worth crediting explicitly: `TestIssueUnavailableForClaim` (`passthrough_test.go:131`) adds a
`lifecycle` column stated per row, with a comment saying it is stated *"rather than derived
from tc.task, so that these rows say what the predicate is being asked, instead of re-running
the mapper's demotion logic here and agreeing with it by construction."* That is an oracle
being actively designed out. Two near-misses are recorded above as F4 (hard-coded label index)
and V5 (hand-built node maps).

**Caveat, stated honestly:** absence of evidence. I classified by reading every helper, not by
a mechanical check. Fourteen prior instances say the pattern is subtle.

### V8 — `go vet` copylocks confirmed pre-existing

Exactly **4** `copies lock value` findings, all in the ephemeral handlers:

```
internal/server/server.go:1516:14: assignment copies lock value to ephReq: ...GetReadyTasksRequest
internal/server/server.go:1626:14: assignment copies lock value to ephReq: ...GetBlockedTasksRequest
internal/server/server.go:1834:13: assignment copies lock value to ephReq: ...GetCriticalPathRequest
internal/server/server.go:2011:13: assignment copies lock value to ephReq: ...GetBottlenecksRequest
```

The only `server.go` hunk in `9f98ad8..651da26` is the `UpdateTask` change at ~line 534. These
four lines are untouched. Confirmed, no scope creep.

---

## Not examined

Stated so the code-review leg can cover the gaps rather than assume I did:

- **Shared-context item 4 — the `taskToProto` / `availabilityComputer` wire seam.** I did not
  verify the `availability` field actually arrives for the web dashboard, `ft ready`, and MCP
  `task_ready`, nor that `web/src/utils/task-ready.ts`'s fallback is correct when the field is
  absent. My round went to items 1-3 and 5-6 as dispatched. **This is the largest unexamined
  area and it spans a language boundary; it needs an explicit owner.**
- Audit F7 (`UpdateTask` relabels to terminal without closing) — untouched, as disclosed.
- The disclosed surviving `labelNameToID` RLock mutant — I did not re-examine the dominance
  invariant.
- I did not review the project-log entry as prose.

---

## Verdict

**REQUEST CHANGES.**

To be clear about what is and is not being asked: **the fix is good.** It is reachable in
production (V2), symmetric under configuration (V3), sink-bound across the layer boundary that
round 2 missed (V1), pinned in both directions of the trade-off it makes (V4), and it genuinely
repairs the tautological pin (V5). `make race` earns its place (V6). I found no self-built
oracle (V7). I requested no production change.

What blocks is that the gate asked two specific questions about the test that carries all of
this, and both answers are no, proven by execution:

1. Is the 4 × 5 table pinned to an asserted count? **No** — emptying it passes at rc=0 (F1).
2. Does the positive control genuinely distinguish allow from deny? **No** — it passes with no
   terminal label present at all (F3).

Plus F2: round 3 created a second, undisclosed sink for the stock-label problem, on the
authorization path, and the authz table is the one place that does *not* test the bare label —
while the claim-gate table does.

The remedy is small and confined to test code: count assertions on four tables, one extra row
(`"duplicate"`), a two-call differential in the positive control, and delete-or-justify the
inert label index. I would expect to re-approve on inspection of that diff without another
full round.

**Re-review:** happy to take it at the next SHA. Per the sequencing note I have written this
assuming the code-review leg may contradict me; F2 and the V2 reachability result are the two
places I would most want a second pair of eyes, and item 4 (the wire seam) is unexamined by me
entirely.

---
---

# ADDENDUM — multi-label bypass: independent verification, and why I missed it

**Written after the round-3 report above, in response to the EM's report that the audit leg
broke the fix.** The report above stands unedited as my round-3 record, including the sentence
that was wrong. This addendum supersedes its verdict and its "the fix is sound" section.

**Verdict changes: REQUEST CHANGES — now with 1 Critical (new), 1 High, 1 Medium, 4 Low.**

## The retraction, stated plainly

I wrote: *"The fix itself is sound, reachable in production, and genuinely pinned. I tried hard
to break it and could not."* That is **false**. The fix closes the single-label case only. It
is bypassed by adding a second label, and I have now confirmed that by execution three ways
plus two of my own that go further than the audit's.

I also wrote, of the `enabled`-flag symmetry, **"it holds"** — flagged REASONED, not executed.
It does hold *on the axis I tested* (config desynchronisation). I stated it without the
qualifier, and an unqualified "it holds" about a security seam is the kind of sentence that
stops the next reviewer from looking. That is the more serious of the two errors, because F1
and V3 together told the EM that the centrepiece was verified when only its perimeter was.

---

## Ask 1 — Verify independently: **CONFIRMED, not refuted. And it is worse.**

### 1a. Not a reconstruction. Reachable through the production resolver.

This is the question the EM said my opinion carries weight on, so I answered it with the same
apparatus as V2 rather than by reading the PoC. I drove the **production**
`github.NewPlatformResolver()` — the one `cmd/farmtable-server/main.go:61` installs — over all
4 terminal labels × 5 second labels:

```
16 of 20 combinations LOSE the terminal stage.
All 4 single-label controls HONOUR it.
```

Second label `accepted`, `working`, `in_review`, **and `triage`** each defeat the seam; only
adding a *second terminal* label leaves it intact. So this is not the round-2 situation where a
flaw was proved against a faithful reassembly of an unwired path. **V2 corroborates the PoC:**
the graph the PoC exercises is the graph `main.go` builds, and I verified that independently
last round before the bypass was known. Reachability is not in doubt.

### 1b. The audit's PoC reproduces exactly, at my hands.

`audit-194-r3-poc.go` run directly: **12 of 16 BYPASS, 4 triage PASS** — the EM's numbers to the
row.

```
baseline [ft:stage/wont_fix] -> DENIED
BYPASS: agent token reopened [ft:stage/wont_fix ft:stage/accepted]
```

PoC2, the scheduling side:

```
baseline [ft:stage/wont_fix]                        -> Available=false Reasons=[terminal]
attack   [ft:stage/wont_fix ft:stage/accepted]      -> Available=true  Reasons=[]
```

### 1c. NEW — the CLAIM gate is bypassed too. (Not in the audit's PoC.)

The audit showed availability, which is advisory. The claim gate is **enforcement**, and it
falls the same way:

- `[ft:stage/wont_fix, ft:stage/accepted]` → `ClaimTask` returns nil **and stamps
  `ft:stage/working=true`** on an issue still labelled `wont_fix`.
- `[duplicate, ft:stage/accepted]` also bypasses — this connects the bypass to my F2.
- `[wont_fix, working]` is refused, but only *accidentally*: lifecycle resolves to `working`,
  which is not `accepted`, so a different gate catches it. Not a defence.

### 1d. NEW — the 4 "triage PASS" rows are not a mitigation.

My unit probe shows `triage` **also** defeats the lifecycle seam (`lifecycle=triage`,
terminal-honoured=false). Those 4 rows survive only because *leaving triage* independently
costs `task:accept` — a second, unrelated gate. The attacker picks the second label, and 3 of
5 choices work. Nobody should read "4 PASS" as partial protection.

### 1e. NEW, and it should change how this is scheduled — **incomplete fix, not new regression.**

I reverted the round-3 authz fix and re-ran the audit's own PoC. Its baseline collapses:

```
BASELINE BROKEN: single ft:stage/wont_fix already allowed; harness is not exercising the gate
```

Pre-round-3, **both** single- and multi-label were allowed. Round 3 closed the single-label
half and left the other half open. This is materially different from round 2, which *introduced*
a downgrade: round 3 is a net improvement that stops short. It still blocks, but it is not a
"revert the branch" situation, and the fix is a narrowing of `TerminalLabelStage`, not a
rethink.

### 1f. NEW — **it is self-service.** This is the finding that sets severity at Critical.

The remaining question was whether the attacker needs a second actor or GitHub UI access to get
the second label onto the issue. They do not. `UpdateTaskRequest.add_labels` (field 20) is
handled inside `UpdateTask` under the blanket `task:write` at the top of the method; the
transition-scope gate fires **only when `req.Stage` is set**. So the label can be added by the
same token, through the same gRPC API, in a call that never touches `Stage`.

Executed against a **stateful** mock whose `addLabelsToLabelable` handler actually mutates the
issue's label set, so the two-call sequence behaves as it would against real GitHub:

```
step 0  baseline reopen with agent token      -> DENIED (rpc error: code = PermissionDenied
                                                 desc = missing required scope "task:accept")
        [github] label ft:stage/accepted added -> set is now [ft:stage/wont_fix ft:stage/accepted]
step 1  AddLabels[ft:stage/accepted], task:write  -> ALLOWED. labels=[ft:stage/wont_fix ft:stage/accepted]
--- FAIL: TestProbe_SelfServiceEscalationViaAddLabels (0.01s)
    SELF-SERVICE ESCALATION CONFIRMED: a token holding only task:write reopened an issue still
    labelled ft:stage/wont_fix, using two ordinary UpdateTask calls and no GitHub access.
    Final labels: [ft:stage/wont_fix ft:stage/accepted]
```

Note the fail-closed construction: step 0 is a hard `t.Fatal` if the gate is already open, so a
green baseline cannot silently make the probe meaningless. The probe file was deleted after the
run; tree re-verified identical to `651da26`.

**Two ordinary API calls. One token. No second actor. No GitHub access.** `task:accept` is not
a boundary; it is a speed bump you walk around.

### F7 (Critical) — `internal/platform/github/labels.go`, `TerminalLabelStage` + `stagePrecedence`

`TerminalLabelStage` delegates to `MapLabelsToStage`, which collects candidates into a set and
returns the **single** highest-precedence stage. `stagePrecedence` orders every non-terminal
above every terminal, so any non-terminal label present masks the terminal one entirely — and
the function reports `false` for "is terminal", which is the answer both the authz gate
(`server.go`, via `store.LifecycleStage`) and the availability/claim gates consume.

**Recommendation — fix at the root, not per-caller.** `TerminalLabelStage` must not ask "what is
the winning stage, and is it terminal?" It must ask "**is any terminal stage label present?**":
scan the label set for terminal stages directly and return one if found, independent of
`stagePrecedence`. Terminal-ness is a property of the *set*, not of the precedence winner. One
change, and all three sinks (authz, availability, claim) close together — which matters given
the EM's note that tonight has repeatedly produced two partial remedies.

Also required: **pin `stagePrecedence` itself.** Nothing anywhere asserts its order today. A
future reorder is currently a silent security change.

---

## Ask 2 — Why V1/V3 missed it. (The part worth keeping.)

**I varied the code. I never varied the shape of the input.**

Every instrument I brought perturbs the *implementation*: V1 mutated the forwarding and the
passthrough, V4 the availability read and the claim gate, V5 the tree walk, V6 the cache sync,
V3 flipped the `enabled` config, V2 swapped the resolver. Seven axes. Every one of them holds
the fixture constant and asks whether the code under it is load-bearing.

**That is what mutation testing is *for*, and it is exactly what mutation testing cannot see.**
A mutant dies when an existing test notices it. The question it answers is "is this line
load-bearing *for the tests you already have*?" A defect whose trigger is **an input no fixture
supplies** is invisible by construction — no mutation of correct code produces a failing test
for a case nobody wrote. My mutation score was high *and* the bypass was wide open, and those
two facts are perfectly consistent. I treated a high kill count as coverage. It is not; it is
sink-binding for the coverage you happen to have. I should have said so in the report.

**The specific miss, which is more embarrassing than the general one.** I *read*
`MapLabelsToStage` during V3. I saw `candidates` — a **set** — and I saw `stagePrecedence`. I
was checking whether the `enabled` flag gated demotion and un-demotion symmetrically. It does,
so I got my answer and moved on. The word "set" was on my screen and I did not ask the obvious
follow-up: **what does this return when two labels match?** I was verifying a hypothesis instead
of interrogating the function. The `candidates` set is the tell that the function has a
multi-match branch, and a multi-match branch in a security predicate is the whole ballgame.

**And the same blind spot is in the suite under review — structurally, which is your point.**

- **Every row of the authz table is single-label.** 4 labels × 5 destinations = 20 cells, all
  one label per issue. The table cannot express the attack.
- **No test anywhere supplies two stage labels to one issue.** I grepped and manually verified
  both hits as false positives.
- **No test pins `stagePrecedence`.**

So the check and the defect share the assumption "an issue has one stage label" — the defect
class from the brief, one level up: not a self-built oracle, but a **self-shaped fixture**. The
test suite and the production code inherited the same mental model of the input domain, and no
amount of mutating either one can surface a disagreement they do not have.

**The generalisable lesson, in one line:** *mutation testing proves your tests are bound to your
code; only input-domain variation proves your tests are bound to reality.* For predicates over
collections, the fixture axis that matters is **cardinality** — zero, one, **two**, conflicting.
I tested zero (nil guard, F5) and one (all 20 cells) and never two. Concretely, for the next
round: any predicate taking a `[]string` gets a two-element adversarial case, and any function
resolving a conflict gets its resolution order pinned.

---

## Ask 3 — Does F1's remedy close this? **No. Confirmed, and it is worse than neutral.**

F1 asks for `len(dests) * len(labels) == 20`. That is a **cardinality assertion over a table
whose schema is single-label**. It proves 20 rows exist and none silently vanished. It adds
exactly **zero** multi-label coverage, because there is no multi-label row for it to count.

The two requirements are independent, and the dependency runs one way only:

| | closes vacuity (F1) | closes bypass (F7) |
|---|---|---|
| Pin table to 20 | yes | **no** |
| Fix `TerminalLabelStage` | no | yes |
| Both | yes | yes |

**And a warning I want on the record.** Had F1 landed as I specified it, the authz table would
have carried a rigorous-looking count assertion, pinned to a number, over a table that
**structurally cannot see the live Critical bypass**. It would have made the single-label
schema look deliberate and verified, and it would have been *harder* for the next reviewer to
question — the assertion signals "someone thought carefully about the shape of this table."
F1 as written would have cemented the blind spot with a green checkmark. That is a real hazard
of count pins on the wrong axis, and I propose it as a standing bar:

> **A count pin must be accompanied by a statement of what the table's rows can and cannot
> express.** Pinning cardinality on an axis that cannot vary the defect is worse than not
> pinning at all, because it launders an assumption as a verification.

**Revised F1:** pin the count *and* extend the table's schema to multi-label — `20 single-label
cells + 4 terminal × 4 second-label = 36`, pinned — so the count is over a table that can
actually fail.

---

## Revised findings and verdict

| ID | Sev | Location | Finding |
|---|---|---|---|
| **F7** | **Critical** | `internal/platform/github/labels.go` — `TerminalLabelStage`/`stagePrecedence` | Multi-label bypass. Any non-terminal label masks a terminal one. Defeats authz, availability, **and claim**. **Self-service** via `add_labels` — one token, two calls, no second actor. Confirmed by execution 5 ways. |
| F1 | High → **restated** | `internal/server/authz_terminal_reopen_test.go` | Table not pinned *and* structurally single-label. Fix both; pinning alone cements the gap. |
| F8 | High | `internal/platform/github/labels.go` | `stagePrecedence` order is unpinned by any test; reordering it is a silent security change. |
| F2 | Medium | authz table vs claim-gate table | Stock `duplicate` reaches the new authz sink; undisclosed, untested, and asymmetric with the claim-gate table. |
| F3–F6 | Low | per main report | Unchanged. |

**Verdict: REQUEST CHANGES.** Blocking on F7. My round-3 report's "the fix is sound" section is
withdrawn; everything in it about *reachability* (V2), the `make race` target (V6), the
tautological pin (V5), and sink-binding (V1, V4) stands and was executed — those results are
still good, they were just answering narrower questions than I claimed.

**Method note.** Every claim in this addendum is BY EXECUTION except the reading of
`UpdateTask`'s scope-check placement, which is REASONED from source and then **confirmed by
execution** in 1f. The self-service probe was written, run, and deleted;
`git status --porcelain` is empty and the tree is byte-identical to `651da26` apart from my
committed project-log entry. Probe source preserved outside the repo at
`/tmp/ft194bak/zz_probe_selfservice_test.go.keep` — **it should be adopted as a regression test
with the assertion inverted** once F7 is fixed.

**Still unexamined by me:** shared-context item 4, the `taskToProto`/`availabilityComputer` wire
seam. The EM notes the audit leg may cover it. Given F7 defeats the availability computation
upstream of that seam, the seam should be re-checked *after* the fix, not before.
