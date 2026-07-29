# Security Audit Report — issue #194, `close-label-swap`

**Scope:** `d5db8c4..03bd155`, primarily `internal/platform/github/passthrough.go`
**Auditor:** security-auditor (independent; developer report read but not ratified)
**Date:** 2026-07-27
**Verdict: REQUEST CHANGES**

Two required items, both small and both inside the invariant this PR introduces
(F1, F2). The core of the change is sound: I could not defeat the `ClosedAt`
arm using any *canonical* GitHub response, and the ordering judgement is
correct. The required items are (a) the fix hangs on a single case-sensitive
comparison of untrusted remote data that the rest of the package parses
case-insensitively, and (b) Part 1 now writes a terminal label to GitHub that
survives a reopen, producing the inverse (denial-of-work) failure the developer
argued they had avoided.

---

## Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 1 (pre-existing, not introduced by this PR) |
| Medium | 3 |
| Low | 4 |
| Info | 2 |

Merge-blocking: **F1** and **F2** (both Medium, both cheap). **F3** is High but
pre-existing; it should be filed and fixed separately, it does not block #194.

### Framing correction, stated up front

The brief frames availability as the gate on claiming. In the pass-through
store it is **not** the enforcement gate, and this matters for how the residual
risk should be read:

- `ClaimTask` (`passthrough.go:518`) resolves its target from
  `listIssues(ctx, []IssueState{IssueStateOpen}, ...)`. A closed issue is never
  in that set, so it returns `store.ErrNotFound`. The enforcement gate is the
  `IssueStateOpen` filter, not `ComputeAvailability`.
- `CloseTask` (`passthrough.go:580`) is filtered the same way.
- `GetReadyTasks` (`passthrough.go:812`) never calls `ComputeAvailability` at
  all. It uses `buildIssueTree`/`computeReady` (`treewalk.go:74`), which skips
  any node whose `State != "OPEN"` and requires `Stage == StageAccepted`.

So #194 is a **reporting-correctness** bug: `task_get`/`task_list` decorate the
proto with `ComputeAvailability` output (`server.go:2184-2192`) and told an
agent `available=true` for work that is already closed. An agent that trusts
that field wastes a cycle and gets `ErrNotFound` on the claim; it does not
actually acquire closed work. The fix is right and worth landing, but it should
not be described as closing an access-control hole. The corollary is the part
that does have teeth: because availability is *advisory*, a wrong `false` is
just as damaging as a wrong `true` — it silently tells agents and humans that
open work is finished (F2).

---

## Findings

### [MEDIUM] F1 — The whole fix hangs on one case-sensitive comparison of untrusted remote data

- **Location:** `internal/platform/github/passthrough.go:161`
  (`if stateStr == "CLOSED" {`), versus `internal/platform/github/labels.go:370`
  (`isClosed := strings.EqualFold(state, "closed")`) and
  `internal/platform/github/passthrough.go:568`
  (`strings.EqualFold(string(child.State), "open")`).
- **Description:** `t.ClosedAt` — the sole non-label signal Part 2 depends on —
  is set only when the raw remote `state` string compares byte-equal to
  `"CLOSED"`. The *same field*, from the *same response*, in the *same
  function's* callee (`IssueToPhaseStage`) is parsed with `EqualFold`, and the
  sub-issue state in the same file is parsed with `EqualFold`. Three readings of
  one untrusted field, one of which is now load-bearing for an availability
  decision. The brief explicitly asked whether GitHub responses can drive the
  computation to the wrong answer; this is that hole.
- **Impact:** Fail-open. A non-canonical `state` casing restores the exact #194
  bug — `ClosedAt` stays `nil`, the Part 2 arm never fires, and a closed issue
  reports `available=true, reasons=[]`. Note the empty reason list: the original
  bug's fingerprint, reproduced with the fix fully present. The `UpdatedAt`
  fallback the second commit went to the trouble of pinning is also unreachable,
  because it lives *inside* the same `stateStr == "CLOSED"` branch. The M9
  mutation the developer ran proves the fallback matters; it does not prove the
  guard that gates it.
- **Reproduction** (drop into `internal/platform/github/`, uses the PR's own fake):

  ```go
  func TestAudit_LowercaseClosedStateDefeatsFix(t *testing.T) {
      fake := newFakeIssueRepo(t, "ft:stage/working")
      fake.state = "closed"                 // non-canonical casing
      fake.closedAt = "2026-01-02T00:00:00Z"
      s := fake.store()
      got, _ := s.GetTask(context.Background(), s.issueUUID(1))
      av, _ := s.ComputeAvailability(context.Background(), got)
      if av.Available {
          t.Errorf("FIX DEFEATED: closed issue reports available=true")
      }
  }
  ```

  Observed on `03bd155`:

  ```
  lowercase closed:      phase=in_progress stage=working closedAt=<nil> available=true reasons=[]
  lowercase closed + ts: closedAt=<nil> available=true reasons=[]
  --- FAIL: TestAudit_LowercaseClosedStateDefeatsFix
  ```

  Note `phase=in_progress` in the first line: `IssueToPhaseStage` *did* classify
  the issue as closed (it used `EqualFold`) and then let the stale label win,
  while `issueToTask` simultaneously concluded it was open. The two halves of
  one function disagree about the same field.
- **Exploitability:** Not remotely attacker-controllable over a direct TLS
  connection to github.com, which returns uppercase GraphQL enums. It is
  reachable via GitHub Enterprise (`githubv4.NewEnterpriseClient` is already the
  construction path — see `graphql_test.go:91`), any caching/replay/mock proxy in
  front of the API, or a future schema change. That is why this is Medium, not
  High. It is merge-blocking because the fix is one line and this is precisely
  the trust-boundary assumption the PR is built on.
- **Recommendation:** One reading of the field, shared by every consumer.

  ```go
  // labels.go (or a new state.go)
  // issueStateClosed reports whether a raw GitHub issue state means CLOSED.
  // Single reading of an untrusted remote field: every availability and
  // lifecycle decision must agree on it.
  func issueStateClosed(state string) bool { return strings.EqualFold(state, "closed") }
  func issueStateOpen(state string) bool   { return strings.EqualFold(state, "open") }
  ```

  ```go
  // passthrough.go:161
  -	if stateStr == "CLOSED" {
  +	if issueStateClosed(stateStr) {
  ```

  and use `issueStateClosed` in `IssueToPhaseStage:370`, `issueStateOpen` in
  `hasOpenSubIssue:568`, and in `treewalk.go:79,85,122,136`. Do **not** invert
  the guard to `if !issueStateOpen(stateStr)`: an empty or unrecognised state
  would then set `ClosedAt` and produce F2's denial-of-work. Failing open on an
  unrecognised state matches `IssueToPhaseStage`, and consistency between the two
  is the property that matters. Add a table test over
  `{"CLOSED","closed","Closed"}` asserting `ClosedAt != nil` and
  `available == false`.

---

### [MEDIUM] F2 — Part 1 writes a terminal label to GitHub that survives a reopen: open work reports terminal

- **Location:** `internal/platform/github/passthrough.go:617-628` (the new label
  swap), read back through `labels.go:386-388` and
  `passthrough.go:658`.
- **Description:** This is direction 2 of the brief, and it is introduced by
  this PR. Before the change, `ft close` left `ft:stage/working` on the issue.
  After the change it writes `ft:stage/completed` (or `ft:stage/wont_fix`).
  Reopening an issue is an ordinary GitHub operation — and in a pass-through
  collection GitHub *is* the UI, so it happens outside Farm Table. On reopen
  GitHub sets `state=OPEN` and clears `closedAt`; the label is not touched. The
  issue now carries a terminal stage label with **no** contradicting non-label
  signal, because `ClosedAt` is nil precisely because the issue is open.
  `IssueToPhaseStage` maps the label to `completed`, `phaseForStage`
  (`labels.go:423`) maps that to `PhaseClosed`, and
  `IsTerminalStage(t.Stage)` fires.

  This is the same shape as the failure mode the developer used to justify the
  close-then-swap ordering — "an issue that is still OPEN on GitHub labelled
  with a terminal stage, which no downstream check can detect"
  (`passthrough.go:613-615`). The ordering argument is correct as far as it
  goes, but it only considered a *failed close*. The successful close plus a
  later reopen reaches the identical state, and it is not an error path — it is
  a normal workflow.
- **Impact:** An open, live GitHub issue is reported to agents and operators as
  `available=false, reasons=[terminal]`, and `ft` shows `phase=closed
  stage=completed` for an issue GitHub shows as open. Work looks finished when
  it is not. Recovery requires someone to notice and run `ft update --stage
  accepted` (which does swap the label back — `passthrough.go:342-357` — so this
  is recoverable, not permanent) or to fix the label in the GitHub UI.
  Mitigating: `computeReady` (`treewalk.go:88`) already required
  `Stage == StageAccepted`, so a reopened issue was not in the ready queue before
  this change either. The delta is the reported availability and stage flipping
  from `true`/`working` to `false`/`terminal` — from "someone is on it" to "this
  is done". That is why this is Medium and not High.
- **Reproduction:**

  ```go
  func TestAudit_ReopenAfterCloseIsUnavailable(t *testing.T) {
      ctx := context.Background()
      fake := newFakeIssueRepo(t, "ft:stage/working")
      s := fake.store()
      id := s.issueUUID(1)
      if _, err := s.CloseTask(ctx, id, task.StageCompleted, "", uuid.Nil); err != nil {
          t.Fatalf("CloseTask: %v", err)
      }
      // Human reopens on GitHub: state flips back, closedAt is cleared, labels stay.
      fake.state, fake.closedAt, fake.stateReason = "OPEN", "", ""

      readBack, _ := s.GetTask(ctx, id)
      av, _ := s.ComputeAvailability(ctx, readBack)
      if !av.Available {
          t.Errorf("DENIAL-OF-WORK: reopened OPEN issue reports available=false, reasons=%v", av.Reasons)
      }
  }
  ```

  Observed on `03bd155`:

  ```
  after close: state=CLOSED labels=[ft:stage/completed]
  REOPENED:    labels=[ft:stage/completed] phase=closed stage=completed closedAt=<nil> available=false reasons=[terminal]
  --- FAIL: TestAudit_ReopenAfterCloseIsUnavailable
  ```

- **Recommendation:** Make GitHub state authoritative in **both** directions,
  which is the principle Part 2 already asserts, applied symmetrically. The
  minimal form, in `ComputeAvailability`:

  ```go
  // Real GitHub state is authoritative in both directions. ClosedAt is set
  // from issue state, never from labels (issueToTask), so:
  //   - closed issue, stale non-terminal label  -> terminal   (issue #194)
  //   - open issue, stale terminal label        -> NOT terminal (reopened)
  // A terminal stage here is label-derived only; it must not outrank an issue
  // GitHub says is open.
  if t.ClosedAt != nil || (store.IsTerminalStage(t.Stage) && t.RemoteStateClosed()) {
      reasons = append(reasons, store.AvailabilityReasonTerminal)
  }
  ```

  That needs a non-label carrier for "GitHub says open", which `ent.Task` does
  not currently have (`ClosedAt == nil` is not sufficient — the existing
  `terminal_availability_test.go` cases construct terminal tasks with nil
  `ClosedAt` and legitimately expect `terminal`). Two workable options:

  1. Carry the raw state in `RemoteData` (`issueBuildRemoteData` already exists)
     and read it in `ComputeAvailability`. Keeps the invariant in one place.
  2. Cheaper and adequate for this PR: **re-stamp on reopen**. Detect
     `state=OPEN` with a terminal stage label in `issueToTask`/`GetTask` and
     treat the stage as `accepted` rather than terminal, i.e. an open issue's
     stage may not be terminal.

  If neither is acceptable in a deploy-gating PR, the **minimum required** is a
  test that pins the current reopen behaviour explicitly (asserting
  `available=false` for a reopened issue, with a comment saying it is a known,
  accepted consequence) and a line in the project log and issue tracker. What is
  not acceptable is shipping the inverse failure undocumented and unpinned when
  the PR's own rationale claims it is the failure mode being avoided.

---

### [MEDIUM] F3 — Availability invariant is implemented three different ways; the primary store is the weakest

- **Location:** `internal/platform/github/passthrough.go:658` (`stage ||
  ClosedAt`), `internal/store/multistore.go:249` (`stage || Phase==closed`),
  `internal/store/entstore.go:1103` (`stage` only).
- **Description:** The "closed work is terminal" rule now has three
  non-equivalent implementations. `EntStore.computeAvailability` has neither a
  `ClosedAt` nor a `Phase` arm. `MultiStore.storeForCtx`
  (`multistore.go:86-100`) falls back to `m.primary` — i.e. `EntStore` — whenever
  the platform store cannot be resolved: `lazyResolve` returns nil on a
  `GetCollection` error, a missing/failed linked-account lookup, or a resolver
  error (`multistore.go:107-137`, which logs and returns nil rather than
  propagating).
- **Impact:** A transient token/GitHub failure between the read that produced
  the task and the `ComputeAvailability` call routes a GitHub-derived task to the
  Ent implementation, which has no `ClosedAt` arm — #194 reappears for that
  request. The window is narrow (both calls go through `storeForCtx`, so it
  requires a flap or a cache eviction between them) and the blast radius is one
  advisory field, hence Medium. Structurally, the more important point is drift:
  three copies of a rule that each carry a "do not reduce this to a bare
  `IsTerminalStage` call" comment is a rule that will diverge again.
- **Recommendation:** Hoist a single predicate into `internal/store` and have
  all three call it:

  ```go
  // store/availability.go
  func IsTerminal(t *ent.Task) bool {
      return IsTerminalStage(t.Stage) || t.Phase == task.PhaseClosed || t.ClosedAt != nil
  }
  ```

  Adopting the union in `EntStore` is behaviour-preserving for native tasks
  (`EntStore.CloseTask:1319-1323` sets `Phase=closed`, a terminal stage and
  `ClosedAt` together) and closes the fallback gap. Note this interacts with F2:
  whatever symmetric rule F2 lands on belongs in the same predicate.

---

### [HIGH] F4 — Unsynchronised mutation of shared store state (pre-existing; this PR adds a call site)

- **Location:** `internal/platform/github/passthrough.go:91-104`
  (`ensureLabelIndex`, writes `s.labelIndex`), `:106-109` (`labelNameToID`,
  reads it), `:80-89` (`ensureRepoID`, writes `s.repoID`). New call site added
  by this PR at `:617`.
- **Description:** The pass-through store is cached per collection in
  `MultiStore.platforms` (`multistore.go:143-151`) and shared by every
  concurrent gRPC request for that collection. `ensureLabelIndex` performs an
  unguarded `s.labelIndex != nil` check followed by an unguarded map assignment.
  There is no mutex on the struct.
- **Impact:** Concurrent map read/write in Go is a **fatal, unrecoverable
  runtime error** (`fatal error: concurrent map read and map write`) — the whole
  server process dies, taking every other tenant's requests with it. Any two
  authenticated requests that hit the same GitHub-backed collection on a cold
  label index can trigger it: `CreateTask`+`CloseTask`, two `CloseTask`s, a
  `ClaimTask` and an `UpdateTask`. No special privilege is needed beyond the
  ability to call two mutating RPCs at once. That is a remote availability
  vulnerability, hence High.
- **Reproduction** (read-only HTTP handler, so the only race reported is in
  production code):

  ```go
  func TestAudit_EnsureLabelIndexDataRace(t *testing.T) {
      fake := newFakeIssueRepo(t)
      h := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
          _ = mustReadBody(t, r.Body)
          w.Header().Set("Content-Type", "application/json")
          _, _ = w.Write([]byte(fake.repoLabelsJSON()))
      })
      s := &GitHubPassThroughStore{gql: testGraphQLClient(t, h),
          mapper: NewLabelMapper(DefaultConfig().GitHub.Labels),
          owner: "acme", repo: "repo", collectionID: uuid.New()}
      var wg sync.WaitGroup
      for i := 0; i < 8; i++ {
          wg.Add(1)
          go func() { defer wg.Done()
              _ = s.ensureLabelIndex(context.Background())
              _, _ = s.labelNameToID("ft:stage/completed") }()
      }
      wg.Wait()
  }
  ```

  `go test ./internal/platform/github/ -run TestAudit_EnsureLabelIndexDataRace -race`:

  ```
  WARNING: DATA RACE
  Write at 0x00c0002cb250 by goroutine 18:
    ...(*GitHubPassThroughStore).ensureLabelIndex()
        /workspace/internal/platform/github/passthrough.go:99
  Previous write at 0x00c0002cb250 by goroutine 17:
    ...(*GitHubPassThroughStore).ensureLabelIndex()
        /workspace/internal/platform/github/passthrough.go:99
  ...
  Previous read at 0x00c0002cb250 by goroutine 16: (same function)
  ```

  The PR's own `-race` run is clean only because every test in the package
  drives the store from a single goroutine.
- **Recommendation:** Not merge-blocking for #194 — the defect predates
  `d5db8c4` — but file it as its own issue at High priority. The fix is
  self-contained:

  ```go
  type GitHubPassThroughStore struct {
      // ...
      mu         sync.RWMutex
      labelIndex map[string]githubv4.ID
      repoID     githubv4.ID
  }

  func (s *GitHubPassThroughStore) ensureLabelIndex(ctx context.Context) error {
      s.mu.RLock(); ok := s.labelIndex != nil; s.mu.RUnlock()
      if ok { return nil }
      labels, err := s.gql.listRepoLabels(ctx)
      if err != nil { return err }
      idx := make(map[string]githubv4.ID, len(labels))
      for _, l := range labels { idx[strings.ToLower(string(l.Name))] = l.ID }
      s.mu.Lock(); if s.labelIndex == nil { s.labelIndex = idx }; s.mu.Unlock()
      return nil
  }
  ```

  (`labelNameToID` takes `s.mu.RLock()`; `ensureRepoID` gets the same
  treatment.) Add the race test above as a permanent regression test.

---

### [LOW] F5 — Label-write failure is silent: no error, no log, no counter

- **Location:** `internal/platform/github/passthrough.go:617` (`if err :=
  s.ensureLabelIndex(ctx); err == nil {` — the error is discarded), `:622` and
  `:626` (`_ = s.gql.removeLabels(...)`, `_ = s.gql.addLabels(...)`), `:636`
  (`if err != nil { return s.issueToTask(closed), nil }`).
- **Description:** Direct answer to brief item 5. A failed label write is
  swallowed at four points on the new path, and there is no logger in this
  package. The developer's own report records being misled by exactly this
  during development.
- **Does it leave the system asserting an untrue state?** No, in the dimension
  that matters, and I verified the load-bearing assumption rather than taking it
  on trust: `closeIssue` (`graphql_queries.go:293-309`) selects the full
  `issueNode`, so the fallback payload carries both `state` and `closedAt` —
  `issueToTask(closed)` therefore produces a non-nil `ClosedAt` and availability
  is correct even when the re-read fails. The returned `Stage` may understate
  (report `working` when the swap in fact succeeded), which is stale but never a
  false claim of success. The partial-failure case (remove succeeds, add fails)
  leaves the issue with no stage label at all, which reads back as
  `completed`/`wont_fix` from `stateReason` — benign.
- **Impact:** Operability, not correctness. Label drift on the remote
  accumulates with zero signal; the only witness is a human looking at the repo.
  It also means F2's terminal-label residue and the #193 stale-label residue are
  both invisible to monitoring.
- **Recommendation:** Since `internal/store/multistore.go:133` already uses
  `log.Printf`, using it here introduces no new dependency and no new pattern:

  ```go
  if err := s.ensureLabelIndex(ctx); err != nil {
      log.Printf("github passthrough: close %s/%s#%d: label index unavailable, stage label not swapped: %v",
          s.owner, s.repo, target.Number, err)
  } else {
      // ...swap...
      if err := s.gql.removeLabels(ctx, target.ID, removeIDs); err != nil {
          log.Printf("github passthrough: close %s/%s#%d: removing stale stage labels: %v", ...)
      }
  }
  ```

  Do not change the control flow — the best-effort ordering is right (see
  Positive Observations). Just make the failure observable.

---

### [LOW] F6 — Swap set is computed from a pre-close snapshot (TOCTOU) and a 20-label window

- **Location:** `internal/platform/github/passthrough.go:618`
  (`currentLabels := issueLabels(target)`, where `target` came from the
  `listIssues` call at `:580`, before `closeIssue` at `:601`), and
  `graphql_queries.go:29` (`` `graphql:"labels(first: 20)"` ``).
- **Description:** The `remove` set is derived from labels as they were before
  the close. A concurrent `ClaimTask` (or GitHub label automation, or a human)
  that adds `ft:stage/working` in that window is not in the remove set, so the
  issue ends up carrying both `ft:stage/working` and `ft:stage/completed`.
  Separately, an issue with more than 20 labels may not expose its stage label
  in the query window at all, so the stale label is never removed.
- **Impact:** The issue ends up with two stage labels; `stagePrecedence`
  (`labels.go:12-23`) ranks `working` above `completed`, so the reported stage is
  `working` — issue #193. Availability is unaffected (`ClosedAt` wins), which is
  the belt-and-braces working as designed.
- **Recommendation:** Compute the swap from the `closeIssue` payload
  (`closed`), which is post-close and one round trip fresher, rather than from
  the pre-close `target`. `closed.ID` is the same node ID, so this is a
  two-token change and strictly reduces the window:

  ```go
  -		currentLabels := issueLabels(target)
  +		currentLabels := issueLabels(closed)
  ```

  Raise `labels(first: 20)` to 100 (GitHub's page limit) as a separate change;
  the same truncation affects hold-label detection in
  `hasExternalUnavailableLabel`, which is a fail-open path.

---

### [LOW] F7 — A terminal stage label can be attached to an open issue through `UpdateTask`

- **Location:** `internal/platform/github/passthrough.go:342-357`
  (`UpdateTask` stage swap; `updateIssue` never changes GitHub issue state).
- **Description:** `ft update --stage completed` writes `ft:stage/completed` to
  an issue that stays OPEN on GitHub. The task then reports `phase=closed
  stage=completed available=false reasons=[terminal]` while GitHub says open —
  the same end state as F2, reached without any close at all. Verified:

  ```
  baseline accepted open:            available=true
  OPEN issue labelled completed:     state=OPEN phase=closed stage=completed closedAt=<nil> available=false reasons=[terminal]
  ```

- **Impact:** Pre-existing, and arguably intended (the user asked for that
  stage). Recorded because it refutes the premise in the comment at
  `passthrough.go:613-615` that a terminal label on an open issue is reachable
  only via the rejected ordering. It is reachable three ways: rejected ordering,
  reopen (F2), and `UpdateTask`. Whatever F2 settles on should account for all
  three.
- **Recommendation:** No standalone change. Fold into the F2 decision, and
  soften the comment at `:613-615` so it does not claim more than it can.

---

### [LOW] F8 — The `ClosedAt` fallback fabricates a timestamp that escapes the availability decision

- **Location:** `internal/platform/github/passthrough.go:166-170`.
- **Description:** Direct answer to brief item 4. As a *boolean*, the `ClosedAt`
  arm is sound: `ComputeAvailability:658` tests `!= nil` and never compares the
  value to a clock, so it is immune to clock skew, a future-dated `closedAt`, or
  a `closedAt` predating `createdAt`. That is a genuinely good choice and it is
  the reason remote control of the *value* does not translate into control of
  the *decision*. Control of the field's **presence** is what matters, and that
  is correctly gated on state (subject to F1).

  The fallback value, however, does escape: `t.ClosedAt` flows to
  `server/convert.go:313-314` (`timestamppb`), to `cli/output.go:65` and
  `mcp/server.go:888` (`closed_at` in user output), and to
  `server/export_import.go:430,732` (persisted JSON export, and thence to
  `entstore.go:2172-2173` on import). If a response ever omitted `updatedAt`
  too, `githubv4.DateTime` is a non-pointer struct, so `UpdatedAt.Time` is the
  zero value — `ClosedAt` becomes `0001-01-01T00:00:00Z` (still non-nil, so the
  availability arm fires; the failure is in the safe direction) and `Version`
  becomes `"-62135596800"` (`passthrough.go:148`).
- **Recommendation:** Keep the fallback — the availability reasoning is correct.
  Consider not surfacing a synthesised timestamp as fact: either sentinel it in
  `RemoteData`, or skip `pt.ClosedAt` when the source was the fallback. Low
  priority; no security impact beyond misleading audit trails.

---

### [INFO] F9 — Trust-boundary cases from the brief that the code handles correctly

Checked and found sound; recording so the next auditor need not redo them:

- **`ClosedAt` present with `state=OPEN`:** ignored. `passthrough.go:161` only
  reads `issue.ClosedAt` inside the CLOSED branch, so a remote payload claiming
  a close time for an open issue cannot make a live task terminal. This is the
  right call and it is what keeps the *inverse* failure out of the `ClosedAt`
  arm (F2 comes in through labels, not through this field).
- **`closedAt` absent with `state=CLOSED`:** the `UpdatedAt` fallback fires and
  `ClosedAt` is non-nil regardless. Pinned by
  `TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal` and mutation
  M9. Verified independently.
- **Stale non-terminal `ft:stage/*` on a closed issue:** covered — the reported
  case, and the arm fires for all five non-terminal stages.
- **Unexpected label combinations:** two stage labels resolve deterministically
  by `stagePrecedence`; availability is unaffected because `ClosedAt` short-
  circuits. `StageLabelSwap` with a disabled mapper (`labels.go:247-249`)
  returns `nil, nil`, so nothing is written and the closed issue falls through to
  `stateReason` — fine.
- **Failed re-read fallback:** `closeIssue`'s selection set is the full
  `issueNode`, so the fallback payload carries `state` and `closedAt`. The
  developer's claim here holds; I verified it at `graphql_queries.go:293-308`
  rather than trusting the report.

### [INFO] F10 — No credential, injection, or transport surface in this change

No token handling, no file I/O, no `exec`, no path handling, no new dependency
(`go.mod`/`go.sum` untouched; the diff is three files). Label names reaching the
GraphQL layer are resolved to node IDs through `labelNameToID`
(`passthrough.go:106`) and unknown names are dropped rather than interpolated,
so the label path is not an injection vector. Error strings wrap the githubv4
error and do not embed the token. Nothing in the diff logs a secret — nothing in
the diff logs at all, which is F5.

---

## Verification performed

- Read the full diff and every function it touches; traced `ClosedAt` from
  `issueNode` through `issueToTask`, `ComputeAvailability`, `taskToProto`,
  export/import, and the CLI/MCP output paths.
- Traced the real enforcement paths (`ClaimTask`, `CloseTask`,
  `GetReadyTasks`/`computeReady`) rather than assuming availability is the gate.
- Wrote and ran four independent adversarial tests against the PR's own fake
  (reopen, lowercase-with-null-`closedAt`, lowercase-with-timestamp, terminal
  label on an open issue) plus one race test. Two of the four failed (F1, F2);
  the fourth documented F7. Scratch tests were removed afterwards; the tree is
  clean (`git status --short` empty).
- Verified `closeIssue`'s GraphQL selection set independently, since the
  fallback's soundness rests on it.
- `go test ./internal/...` — all packages pass except `internal/cli`, which
  fails setup with `pattern all:web/dist: no matching files found`. That is the
  gitignored embed directory missing from this checkout, not a defect in the
  change. `go test ./internal/platform/github/ -race` clean.
- `gofmt -l internal/platform/github/` clean.
- Spot-checked the developer's mutation results by re-deriving M2 and M9's
  reasoning from the code; both hold.

## Positive observations

- **The ordering judgement is correct and well argued.** Close first, labels
  best effort, is the right call for the reason given: a failure leaves a state
  that a downstream check can still see. The reverse leaves a lie that nothing
  can detect. The developer volunteered the weakest point of their own design
  and invited pushback on it; the pushback turns out to be elsewhere.
- **`ClosedAt` used as a boolean, never as a timestamp.** This is the single
  best decision in the change. It makes the availability computation immune to
  clock skew and to remote control of the value, leaving only presence — which
  is gated on state — as the attack surface. Worth preserving explicitly if the
  code is ever refactored.
- **The `||` single-`if` form** avoids a duplicated `terminal` reason and
  matches `multistore.go:249`. Convention followed, not invented, and pinned by
  a test (M4).
- **Belt and braces genuinely works.** M1 shows Part 2 still catching the bug
  with Part 1 removed. Two independent mechanisms with independently failing
  tests is the right structure for an availability invariant.
- **Mutation testing with pasted output**, including a mutation (M9) aimed at
  code the developer did not write, to pin a premise their change depends on.
  That is the right instinct; F1 is the same instinct applied one line further
  up.
- **The test fake is stateful and its limitations are documented honestly**,
  including the dispatch-order gotcha. It was directly reusable for adversarial
  testing, which is why this audit could produce executable reproductions rather
  than speculation.

## Required before merge

1. **F1** — single case-insensitive reading of the remote `state` field, shared
   by `issueToTask`, `IssueToPhaseStage`, `hasOpenSubIssue`, and `treewalk`, plus
   a casing table test. One line of behaviour change, small blast radius.
2. **F2** — either the symmetric fix (open GitHub state must outrank a terminal
   *label*), or, if that is too large for a deploy-gating PR, an explicit test
   pinning the reopen behaviour with a comment marking it a known accepted
   consequence, plus a tracked follow-up issue. Do not ship it unpinned.

## Recommended follow-ups (do not block #194)

3. **F4** — file at High priority: mutex on `labelIndex`/`repoID`. A
   process-fatal concurrent map access reachable from two ordinary concurrent
   requests.
4. **F3** — hoist the terminal predicate into one `store.IsTerminal(t)` used by
   all three implementations; fold F2's outcome into it.
5. **F5** — make label-write failures observable with `log.Printf`; keep the
   control flow.
6. **F6** — swap from the post-close payload; raise `labels(first: 20)` to 100.
7. **F8** — do not surface the synthesised `ClosedAt` as a fact in output and
   exports.
8. Extract the thrice-duplicated stage-label swap (`UpdateTask:342`,
   `ClaimTask:546`, `CloseTask:617`) once #194 has landed — three copies of a
   block that now carries a security invariant will drift.
