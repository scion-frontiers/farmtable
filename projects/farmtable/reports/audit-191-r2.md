# Security Audit R2 — Issue #191, terminal-stage availability predicate

**Auditor:** security-auditor (independent re-review)
**Date:** 2026-07-27
**Subject:** `terminal-predicate-r2` @ `d7314cf`, diff vs r1 head `d5db8c4` (3 commits)
**Round-1 report:** `audit-191.md`

---

## Verdict: **APPROVE**

The r2 changes are correct, semantics-preserving, and close both round-1 findings that were in
scope. I verified the central security question empirically rather than by inspection: **the
consolidated predicate cannot be made to report a terminal task as available, nor an available task
as terminal, without a test failing.** Both mutation directions are killed at all five call sites.

No new findings above **Low**. The two round-1 HIGH findings remain open, but they were correctly
scoped out of a behaviour-preserving PR and are now documented in the design log with accurate
technical detail.

**Independence note:** I completed all verification below *before* reading
`dev-terminal-predicate-r2.md`, deliberately, so the developer's conclusions did not anchor mine.
Where we agree I say so; where I found something they had already disclosed I credit them; where I
differ I say that too. Nothing in this report is ratified on the strength of their evidence.

---

## Summary

| Severity | Count | Notes |
|---|---|---|
| Critical | 0 | — |
| High | 0 new | 2 round-1 HIGHs remain open, deliberately deferred |
| Medium | 0 new | — |
| Low | 3 new | All minor; none block merge |
| Info | 4 | — |

---

## Part 1 — The security question, answered empirically

> *"Whether the consolidated terminal predicate can be made to report a terminal task as available,
> or an available task as terminal."*

I mutated `IsTerminalStage` in both directions and ran the full affected surface. Repo restored and
verified clean after each (`git status --porcelain` empty).

**Mutation A — `return false` (terminal task reported AVAILABLE, the authorization-relevant
direction):**

```
--- FAIL: TestIsTerminalStage_ClassifiesEveryStage                        (store)
--- FAIL: TestComputeAvailability_OwnTerminalStageBlocksClaim             (store/entstore)
--- FAIL: TestMultiStoreComputeAvailability_OwnTerminalStageBlocksClaim   (store/multistore)
--- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim  (github)
--- FAIL: TestComputeReady_TerminalParentIsNotReady                       (github/treewalk)  <- NEW in r2
--- FAIL: TestBasicAvailabilityForTask_OwnTerminalStageBlocksClaim        (server)
```

All five availability implementations plus the predicate itself. **In round 1 the treewalk site
survived this mutation entirely** — that is the concrete security improvement in r2.

**Mutation B — `return true` (available task reported TERMINAL):**

```
--- FAIL: TestIsTerminalStage_ClassifiesEveryStage
--- FAIL: TestMultiStoreComputeAvailability_RequiresOpenAccepted
--- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal
--- FAIL: TestComputeReady_NonTerminalParentIsReady                       <- NEW in r2
--- FAIL: TestBasicAvailabilityForTask_NonTerminalStagesAreNotTerminal
--- FAIL: TestClaimTask, TestComputeAvailability_TerminalDependencyMatrix,
          TestGraphIntegration_GetReadyTasks_*, TestMultiStore_*_RoutesToPlatform  (+8 more)
```

Both directions are comprehensively pinned. This is the answer to the question asked: **no.**

### The treewalk consolidation is semantics-preserving

`internal/platform/github/treewalk.go:105`:

```go
- isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
-     node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
- if !isTerminal && len(node.Children) > 0 {
+ if !store.IsTerminalStage(node.Stage) && len(node.Children) > 0 {
```

Identical stage set; `IsTerminalStage`'s body is unchanged in r2 (verified: the `entstore.go` diff
is **comment-only**, no executable line altered). The `internal/store` import is new to this file
but the package already depended on `store` via `passthrough.go` — no cycle, and `go build ./...`
is clean.

### The `ErrAlreadyClosed` correction is accurate

The r2 test now asserts `errors.Is(err, store.ErrAlreadyClosed)` rather than `err != nil`. I
verified the guard ordering directly in `entstore.go`:

```go
if old.Phase == task.PhaseClosed {          // :1199 — fires first
    _ = tx.Rollback()
    return nil, ErrAlreadyClosed
}
availability, err := computeAvailability(...)   // :1202 — terminal arm lives here
```

`CloseTask` sets `PhaseClosed`, so for a task closed the normal way the phase guard short-circuits
and the terminal availability arm is genuinely not reached. **This corrects an imprecision in my own
round-1 report**, which stated the terminal arm was enforced on the claim path without noting the
phase guard pre-empts it. The correction is right and I accept it.

One refinement, in the developer's favour rather than against it: the arm is *not* dead code. It
becomes load-bearing for any task with a terminal stage but a non-closed phase. I checked the
desync paths and found them all closed today — server `UpdateTask` derives phase from stage
(`server.go:542-543`, `ph := phaseForStage(st)`), import does the same (`export_import.go:657`),
and `CloseTask` sets both. But `EntStore.UpdateTask` itself sets `Phase` and `Stage` independently
(`entstore.go:848-853`), so any future direct store caller could desync them, and the arm is what
would catch it. The comment's practical conclusion — keep the arm — is correct.

---

## Part 2 — Per-item status of every round-1 finding

| # | Round-1 finding | Status | Verified how |
|---|---|---|---|
| **HIGH-1** | GitHub label overrides closed state, forges `available=true` | **OPEN — deferred** | Unchanged (`labels.go:374-384`). Correctly out of scope; now documented in design log with accurate detail. |
| **HIGH-2** | `CloseTask` leaves stale stage label ⇒ closed tasks report available | **OPEN — deferred** | Unchanged (`passthrough.go:579-606`). Same. |
| **MEDIUM-1** | Fifth un-consolidated copy in `treewalk.go` (ready queue) | **CLOSED** ✅ | Consolidated at `:105`; semantics-preserving; now covered by 3 new tests; mutation A newly killed here. |
| **MEDIUM-2** | Pass-through `ClaimTask` non-atomic, fails open, ignores `assigneeID`/`version` | **OPEN — deferred** | Unchanged. Listed in design log "Not done, and why". |
| **MEDIUM-3** | `hasExternalUnavailableLabel` hardcodes `ft:` vs configurable prefix | **OPEN — deferred** | Unchanged. Listed. |
| **MEDIUM-4** | Advertised availability ≠ enforced availability | **OPEN — deferred** | Unchanged. Listed. |
| **LOW-1** | `..._ClassifiesEveryStage` didn't actually cover every stage | **CLOSED with residual** ⚠️ | Proto-derived `allStages` guard added. Works for a full data-model addition; a narrow hole remains — see **R2-L1**. |
| **LOW-2** | `noComputeStore` fragile if `ComputeAvailability` joins `Store` | **OPEN** | No compile-time guard added. Informational; fails loudly if it ever breaks. Not tracked in the design log's deferral list. |
| **LOW-3** | Reopen leaves `ClosedAt` set | **OPEN** | Unchanged. Not tracked in the design log's deferral list. |
| **INFO** | `TestWatchTasks_*` flaky | **ACKNOWLEDGED** | Now documented by the developer with base-vs-branch rates. See **R2-I3** for a small correction. |

**Assessment of the deferrals.** Deferring HIGH-1/HIGH-2 and MEDIUM-2/3/4 is the right call. They
are label-vs-truth defects in the pass-through's trust model, structurally different from "one rule
hand-copied five times," and fixing them inside a PR whose entire claim is that it changes no
behaviour would undermine the reviewability of both. The design log records them accurately enough
that the next reader will not have to re-derive them. **They must still be filed as issues before
the Phase 2 client ships** — that recommendation from round 1 stands unchanged and is the single
most important open item.

---

## Part 3 — New findings

### [LOW] R2-L1 — The new exhaustiveness guard has a silent-fallback hole

- **Location:** `internal/store/terminal_availability_test.go:18-33` (`allStages`), via
  `internal/convert/convert.go:23` (`StageFromProto`)
- **Credit:** the developer found and disclosed this independently (dev report, M13; design log,
  "Round 2 mutations"). I reproduced it before reading their report. Recording it because a
  complete fix exists and is cheap.

`StageFromProto` ends in `default: return task.StageTriage`. A proto stage with no `case` maps to
`triage`, which is already in the table, so `covered[stage]` is true and the guard stays silent.
The helper's `task.StageValidator(stage)` check cannot catch this — `triage` is always valid, so
that line can never fail for this failure mode.

**Reproduction** (temporary test, run and deleted; repo verified clean):

```
StageFromProto(16) = "triage"
validator ACCEPTED "triage" -> guard does NOT fire; the new stage is invisible to
allStages() and IsTerminalStage never classifies it
```

**Assessment.** Materially narrower than round-1 LOW-1. The guard *does* fire for a full data-model
addition (proto + ent + `StageFromProto`), which the developer demonstrated by actually performing
one. The residual is the partial-update case: proto and ent updated, `StageFromProto` not. The
developer's position is that this case "doesn't matter" because such a stage is broken system-wide
anyway. That is largely fair — but it is precisely the case where the stage is silently claimable,
and closing it costs three lines.

**Recommendation.** Assert the proto name round-trips. I validated this against all ten real stages
(zero mismatches — every stage string is the lowercased proto suffix) and confirmed it fires for
the simulated unmapped value:

```go
stage := convert.StageFromProto(pb.TaskStage(value))
if want := "TASK_STAGE_" + strings.ToUpper(string(stage)); name != want {
    t.Fatalf("proto stage %s maps to task stage %q (expected proto name %s); "+
        "StageFromProto is probably missing a case for %s", name, stage, want, name)
}
```

### [LOW] R2-L2 — `computeReady`'s `includeUnblocked` branch ignores triage and hold, and the new test now pins that

- **Location:** `internal/platform/github/treewalk.go:104-111`;
  `internal/platform/github/treewalk_test.go:57` (`TestComputeReady_NonTerminalParentIsReady`)
- **Pre-existing behaviour; not introduced by r2.** Flagged because a *new* test locks it in.

The `includeUnblocked` branch checks only the terminal arm. Unlike the accepted branch immediately
above it (`treewalk.go:92-94`), it does **not** call `hasExternalUnavailableLabel`, and it does not
exclude `StageTriage`. So with the flag on, triage-stage and held tasks surface as ready. The new
test explicitly asserts `task.StageTriage` ⇒ ready.

This sits awkwardly against the contract quoted in the round-1 brief — *"ClaimTask rejects
unavailable tasks by ID, including triage, terminal, held..."* — and against the native
implementation: `EntStore.GetReadyTasks` with `IncludeUnblockedOpen` relaxes **only**
`AvailabilityReasonBlockedByDependency` (`entstore.go:2553`), keeping triage and hold excluded. Two
implementations of one flag, diverging — the same class of drift #191 exists to eliminate.

Severity is Low because `IncludeUnblockedOpen` is an explicit, off-by-default, caller-supplied API
flag (`server.go:1520`) whose result is labelled "candidate for ready," not "claimable." No
authorization decision is made here.

**Recommendation.** Not a merge blocker. But the test comment should state that triage-as-ready is
*current behaviour being pinned*, not *desired behaviour*, so that a future correction to
`computeReady` isn't reverted to keep this test green.

### [LOW] R2-L3 — `allStages` is now hand-copied across two packages

- **Location:** `internal/store/terminal_availability_test.go:18` and
  `internal/server/transitions_internal_test.go` — byte-identical bodies

The helper is acknowledged as a copy ("Mirrors allStages in..."). A helper whose purpose is to
prevent a hand-copied stage list from drifting is itself a hand-copied stage list. If R2-L1's
round-trip fix is applied to one copy and not the other, they diverge silently.

**Recommendation.** Move it to `internal/testutil` (which already exists and is already imported by
`terminal_availability_test.go`) and have both call sites use it.

---

## Info

- **R2-I1 — Design log line reference is off by two.** The site table says `treewalk.go:103`; the
  consolidated call is at `:105`. Trivial, but line-numbered tables rot fast; consider citing the
  function name (`computeReady`) instead.
- **R2-I2 — Round-1 LOW-2 and LOW-3 are not in the design log's "Not done, and why" list.** HIGH-1/2
  and MEDIUM-2/3/4 are all recorded; the two LOWs are simply absent, so they are the items most
  likely to be lost. Both are minor (a test-double fragility and a stale `ClosedAt` on reopen), but
  LOW-3 interacts with my recommended `ClosedAt`-based hardening for HIGH-1 and is worth keeping
  visible.
- **R2-I3 — The `TestWatchTasks_*` flake is slightly more prevalent than the dev report's table
  suggests.** Their table records "This branch, `./internal/server/` alone → pass." I saw it fail
  running just the three affected packages together (`TestWatchTasks_NoInitial`, `_UpdatedEvent`,
  `_ClosedEvent`, plus `TestListUsers` "total = 3, want 2"), then pass on an immediate re-run of the
  same commit. So it reproduces under narrower load than "full suite," and `TestListUsers` looks
  like a *separate* ordering/pollution bug rather than a timeout. **This is definitively not caused
  by this diff** — the diff contains zero `internal/server` files, and the same binary passes and
  fails across runs of the same commit. Agreeing with the dev's conclusion, correcting the scope.
  Worth its own issue: a flaky gate is a security problem in slow motion, because it trains
  reviewers to disregard exactly the signal these new tests provide.
- **R2-I4 — `validateDefinedEnum` is a good pre-existing control.** `server.go:527` rejects
  undefined proto enum values *before* `StageFromProto` can silently map them to `triage`, so the
  R2-L1 fallback is not reachable from the RPC surface — only from the test helper. Worth noting
  since it bounds R2-L1's blast radius to test-time.

---

## Positive observations

- **The r2 work does the harder, more valuable half.** Consolidating `treewalk.go` moves an
  untested line; adding `TestComputeReady_*` is what actually protects it. The design log says this
  explicitly ("The consolidation was the less important half"), and my mutation runs confirm it —
  that site went from surviving mutation A to killing it.
- **`TestComputeReady_AcceptedTakesTheAcceptedBranch` is a genuinely thoughtful test.** It pins the
  distinction between "excluded because handled earlier" and "excluded because terminal" — a
  distinction that is invisible in the code and exactly the kind of thing a future refactor would
  collapse. Most test suites would not have bothered.
- **The developer disclosed the weakness in their own fix.** The `StageFromProto` fallback (R2-L1)
  was volunteered in both the report and the permanent design log, not buried. They also refused to
  claim a mutation kill when the mutation produced a compile error instead, and re-derived it in a
  valid form. That is the behaviour that makes a report worth reading.
- **The corrected doc comment on `IsTerminalStage` is better than the original.** Naming what each
  site adds on top — MultiStore's `PhaseClosed` arm, the tree walk's sub-issue check — and warning
  against simplifying a site to a bare call directly targets the failure mode this issue exists to
  prevent. It converts tribal knowledge into a comment at the point of temptation.
- **Both round-1 in-scope findings were fixed as specified, with no scope creep.** Zero `web/`
  files, no unrelated refactors, no opportunistic fixes to the deferred items.

---

## What I checked (coverage statement)

Verified directly by reading source and executing code:

- `git log --oneline d5db8c4..HEAD` → three commits as stated; branch `terminal-predicate-r2`
  @ `d7314cf`; working tree clean before and after.
- Full `git diff d5db8c4..HEAD` — every changed line in all five files.
- Confirmed the `entstore.go` change is **comment-only** (no executable line altered).
- Semantic equivalence of the `treewalk.go` consolidation against the original expression.
- **Mutation testing of `IsTerminalStage` in both directions** across
  `internal/store`, `internal/platform/github`, `internal/server` — the primary evidence for the
  verdict. Repo restored and verified clean after each.
- **PoC reproduction of R2-L1** (temporary test, run, deleted), plus validation that my proposed
  round-trip fix holds for all ten real stages and fires for an unmapped one.
- `ClaimTask` guard ordering at `entstore.go:1199-1210`, and the phase/stage desync paths
  (`server.go:542`, `export_import.go:657`, `entstore.go:848-853`) that determine whether the
  terminal arm is reachable.
- `EntStore.GetReadyTasks` `IncludeUnblockedOpen` semantics (`entstore.go:2519, 2553`) versus
  `computeReady`'s, and how the flag is driven (`server.go:1520`, `passthrough.go:778`).
- `StageFromProto` and the proto `TaskStage_name` enum; `validateDefinedEnum` at `server.go:527`.
- `gofmt -l` on all four touched Go files → clean. `go build ./...` → clean.
- Test runs: `internal/store` and `internal/platform/github` pass consistently; `internal/server`
  flakes non-deterministically on the same commit (see R2-I3). 60 passing subtests across the
  terminal/ready surface.
- Cross-checked every substantive claim in `dev-terminal-predicate-r2.md` against my own findings,
  after completing them independently.

**Not covered:** no live GitHub instance, so the deferred HIGH-1/HIGH-2 were re-confirmed as
*unchanged* by diff inspection rather than re-exploited. No Postgres, so integration tests were not
run. Zero web files in the diff; the Phase 2 client is not in this tree.

---

## Recommendations

1. **Merge r2.** The in-scope work is correct and well-tested.
2. **File HIGH-1 and HIGH-2 as issues now, blocking the Phase 2 web client.** Unchanged from round
   1 and unaffected by this diff. Once the client has no defensive check, these are the only things
   between a caller and a terminal task, and HIGH-2 fires on the ordinary happy path.
3. **Apply the R2-L1 round-trip guard** (three lines, validated above) and move `allStages` to
   `internal/testutil` (R2-L3) — ideally together, since the second prevents the first from
   drifting.
4. **File the `internal/server` test flakiness separately** (R2-I3), including the `TestListUsers`
   ordering failure, which looks distinct from the timeouts.
5. **Add round-1 LOW-2 and LOW-3 to the design log's deferral list** (R2-I2) so they are not lost.
