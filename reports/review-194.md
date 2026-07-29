# Code Review — #194 `close-label-swap`

**Reviewer:** code-reviewer (independent)
**Range reviewed:** `d5db8c4..03bd155` (2 commits)
**Files in delta:** `internal/platform/github/passthrough.go` (+45/-2),
`internal/platform/github/close_label_swap_test.go` (new, 435),
`.design/project-log/close-label-swap.md` (new)

---

## Verdict

**APPROVE** — merge is safe. No Critical issues. One High-severity *latent*
finding that is not a defect in this PR but must be tracked as a follow-up
guard, because the obvious next change in this file would silently undo #194's
work in the enforcement path.

## Executive Summary

Low-to-moderate risk change, well scoped to `GitHubPassThroughStore`, with an
unusually strong test suite. The central claim — that Part 2 (`ClosedAt` as a
terminal signal) holds independently of Part 1 (the label write) — **is true,
and I verified it by re-derivation and by re-running the mutations myself
rather than accepting the report's pasted output.**

---

## Independent verification performed

I did not ratify the developer's report. What I re-derived from source:

| Claim | How I checked | Result |
|---|---|---|
| Part 2 is independent of Part 1 | Traced `ClosedAt` to `issueToTask:161-172`; it is gated on `stateStr == "CLOSED"` from `issue.State`, never from labels | **Confirmed** |
| Passthrough `ComputeAvailability` is actually reached for GitHub tasks | `MultiStore.ComputeAvailability:236` dispatches via `storeForCtx(t.CollectionID)` to the passthrough impl | **Confirmed** |
| The bug was real pre-fix | Passthrough returns `Available: len(reasons)==0` with **no** `Phase==open && Stage==accepted` gate (unlike the MultiStore fallback:258), so stale `working` + `ClosedAt` → `reasons=[]` → `available=true` | **Confirmed** |
| Mutation M1 (remove Part 1) fails tests | Ran it | **Confirmed** (2 failures) |
| Mutation M2 (remove Part 2, Part 1 intact) fails tests | Ran it | **Confirmed** — see fidelity note below |
| Mutation M9 (remove `UpdatedAt` fallback) fails tests | Ran it | **Confirmed** (1 failure) |
| `TestWatchTasks_*` flake is pre-existing | Checked out `d5db8c4`, ran `./internal/server/` 3× | **Confirmed** — fails at base, 1/3 runs, a *different* `WatchTasks` test each time. Not attributable to #194 |
| "No logger in this package" | `grep log./slog./logger` in package, non-test | **Confirmed** — zero occurrences |
| Build / gofmt / tests | `go build ./...` exit 0; `gofmt -l internal/platform/github/` empty; package tests pass under `-race` | **Confirmed** |

Note: `go build` initially failed on `assets.go:5: pattern all:web/dist: no
matching files found`. This is an environment artifact (`web/dist` is
gitignored and unbuilt here), not a defect in the delta. Stubbing it produced a
clean build.

### The question the brief asked directly: is a failed label write silently believed?

**No — and this is the strongest part of the design.** `CloseTask` re-reads the
issue via `getIssue` (`:635`) *after* the swap and returns that. So the returned
task reflects GitHub's actual post-swap state. If the write failed, the returned
stage is the *stale* one — the system reports the truth, it does not claim
success it did not achieve.

The one fallback path (`:637`, `getIssue` itself fails → return the `closeIssue`
payload) is also safe, and I verified the load-bearing detail the report asserts
but did not prove: `closeIssue` (`graphql_queries.go:293`) selects the full
`issueNode`, which includes `State` and `ClosedAt`. So the fallback payload
carries `state=CLOSED`, and `issueToTask` sets `ClosedAt` — doubly guaranteed by
the `UpdatedAt` fallback. Availability is correct on every path. Good.

### Does Part 2 genuinely hold alone? Yes.

`ClosedAt` derives from `issue.State`, a field GitHub controls and labels cannot
influence. Every partial-failure permutation resolves safely:

- **remove OK, add fails** → issue ends with *no* stage label → `IssueToPhaseStage`
  falls through to `stateReason` → `completed`/`wont_fix`. Terminal anyway.
- **remove fails, add OK** → both labels → `stagePrecedence` picks `working` →
  stage wrong, but `ClosedAt` set → **unavailable**. Part 2 absorbs it.
- **both fail / `ensureLabelIndex` fails** → stale label survives → `ClosedAt`
  set → **unavailable**. Part 2 absorbs it.

The remove-before-add ordering is quietly the right choice: a crash between the
two leaves the issue with no stage label, which resolves *correctly*. The
reverse would leave the precedence-conflict state. Worth keeping.

---

## Findings

### Critical
None.

### High

**H1 — `issueUnavailableForClaim:575` is still purely label-derived, and is
shielded only by a query filter. The natural next fix removes that shield.**
*(Latent; not a defect in this PR; do not block merge.)*

This directly answers the cross-branch question about HIGH-2. Today a closed
issue cannot be claimed — but **not** because the predicate is truth-based.
`ClaimTask:517` and `CloseTask:580` both look up via
`listIssues(ctx, []githubv4.IssueState{githubv4.IssueStateOpen}, ...)`. Closed
issues are simply never found, so `issueUnavailableForClaim` never sees one.
The protection is structural and incidental.

The landmine: the developer's own "found but not fixed" item 3 complains that
closing an already-closed task returns `ErrNotFound` instead of a clear "already
closed". **The obvious fix is to widen that filter to include
`IssueStateClosed`.** The moment anyone does that, `issueUnavailableForClaim`
starts seeing closed issues, and it is label-derived:

```go
return t.Stage != task.StageAccepted || t.HoldReason != nil ||
       hasExternalUnavailableLabel(t.Labels) || hasOpenSubIssue(issue)
```

A closed issue carrying a stale `ft:stage/accepted` label yields
`stage == accepted` → predicate returns false → **claimable**. That is exactly
the class of bug #194 just closed, reintroduced in the *enforcement* path, where
it is worse than in the display path.

Suggested fix — make the invariant predicate-level rather than filter-dependent,
so it survives any future change to the lookup:

```go
func issueUnavailableForClaim(issue *issueNode, t *ent.Task) bool {
	// ClosedAt comes from GitHub's real issue state, never from labels. Keep
	// this arm even though callers currently filter to IssueStateOpen — the
	// filter is not the invariant, this is.
	return t.ClosedAt != nil ||
		t.Stage != task.StageAccepted || t.HoldReason != nil ||
		hasExternalUnavailableLabel(t.Labels) || hasOpenSubIssue(issue)
}
```

This is a one-line, behaviour-preserving addition today (the arm cannot fire
under the current filter), which is precisely why it is cheap to add now and
expensive to remember later.

### Medium

**M1 — `passthrough.go:617, 623, 627, 636`: four stacked silent error swallows
give zero observability of label-write degradation.**

```go
if err := s.ensureLabelIndex(ctx); err == nil {   // :617 err discarded
    _ = s.gql.removeLabels(...)                    // :623
    _ = s.gql.addLabels(...)                       // :627
}
refreshed, err := s.gql.getIssue(...)
if err != nil { return s.issueToTask(closed), nil } // :636 err discarded
```

Correctness is fine (see above). The problem is operational: a token that loses
label-write scope, or sustained secondary-rate-limiting, degrades label hygiene
on *every close, forever*, with no signal anywhere. The system stays correct but
silently accumulates issues whose displayed stage contradicts their state —
which is #193's symptom, now generated continuously rather than occasionally.

I accept the developer's reasoning for not adding a logger (there is genuinely
none in this package — I verified zero `log.`/`slog.` occurrences — and
introducing one in a deploy-gating PR is the wrong moment). Recording it so it
is not lost: this package needs a structured logger, and these four sites plus
the eight pre-existing `_ = s.gql.*Labels` calls at `:352-409, 552-556` are its
first customers. The developer's honest note that this fallback masked a bug
during their own test development is corroborating evidence, not a footnote.

**M2 — `passthrough.go:617`: `labelIndex` is an unsynchronized map, and this PR
adds a third writer.**

`ensureLabelIndex:92-104` does `s.labelIndex = make(...)` then populates it,
with no mutex. `MultiStore` **caches the `GitHubPassThroughStore` in
`m.platforms`** (`multistore.go:40, 86-93`) and shares it across concurrent gRPC
requests. Concurrent `ensureLabelIndex` (write) and `labelNameToID` (read) is a
genuine data race — Go's map implementation can throw
`concurrent map read and map write` and kill the process.

This is **pre-existing** (`UpdateTask:348`, `ClaimTask:542` already do it) and I
am not asking this PR to fix it. But `:617` is a new third call site in the
delta, so it marginally widens the window, and the existing `-race` tests do not
catch it because they never exercise concurrent calls on a shared store. Track
separately; a `sync.RWMutex` (or `sync.Once` around the fetch) is the fix.

### Low

**L1 — `graphql_queries.go:26` `labels(first: 20)` bounds the swap.** `issueLabels(target)`
feeds `StageLabelSwap`, so on an issue with >20 labels the stale stage label may
not be in the fetched set and will not be removed. Pre-existing constraint, but
the new Part 1 code now depends on it. Consequence is bounded by Part 2.

**L2 — the two `ComputeAvailability` implementations use different truth signals
for the same concept.** Passthrough (`:658`) uses `t.ClosedAt != nil`; the
MultiStore fallback (`multistore.go:250`) uses `t.Phase == task.PhaseClosed`.
Both are correct for their own inputs — and note the passthrough *cannot* use
`Phase`, because `IssueToPhaseStage` returns `PhaseOpen` for a closed issue with
a stale non-terminal label. That asymmetry is real and load-bearing, and it is
not explained in either comment. A sentence in the passthrough comment saying
"`Phase` is unusable here because it is label-derived; `ClosedAt` is not" would
prevent a future reader from "harmonising" the two.

**L3 — report fidelity (process, not code).** The report presents all nine
mutations as applied to "the committed code". The M2 output does not match the
committed tree: my M2 run produces **three** failing tests, including
`TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal`, which the
report's M2 paste omits. The report's cited line numbers also do not match the
committed file (e.g. it cites `close_label_swap_test.go:401` for
`OpenTaskStillAvailable`, actually at `:422`). The benign explanation fits: M2
was run at `605bdd1`, before `03bd155` added that test. No conclusion changes —
every mutation I re-ran reproduced — but "actual output pasted" should mean
re-captured after the final commit.

---

## Answers to the cross-branch questions (HIGH-2 overlap)

**1. Does #194 fix, partially fix, worsen, or sit alongside HIGH-2?**
**Partially fixes. It does not worsen anything.** Precisely:
- *Fixed:* the label-vs-truth defect in `ComputeAvailability` — now truth-based.
- *Reduced:* the incidence of stale labels, via Part 1.
- *Untouched:* `IssueToPhaseStage` (HIGH-1) — reported `Phase`/`Stage` are still
  label-derived and still wrong for a closed issue with a stale label.
- *Untouched:* `issueUnavailableForClaim` — still label-derived (see H1).

**2. Does the partial fix create a misleading state?**
**Yes, mildly — and it is cheap to neutralise.** The file now contains two
adjacent predicates answering "is this task workable?" from *different sources
of truth*: `ComputeAvailability:658` (truth-based, `ClosedAt`) and
`issueUnavailableForClaim:575` (label-based). The new comment at `:651-657` is
excellent and emphatic, which is itself the hazard: a reader who encounters it
could reasonably infer the file has adopted truth-based reasoning generally. The
H1 fix resolves this substantively; failing that, a two-line comment on
`issueUnavailableForClaim` noting it is label-derived and relies on the caller's
`IssueStateOpen` filter would remove the ambiguity.

**3. Do residue items 3 and 4 interact with HIGH-2?**
**Item 3 interacts, and it is the sharpest edge in this whole review** — it is
the precise mechanism described in H1. Item 3 and H1 should be linked in the
tracker so nobody fixes the `ErrNotFound` ergonomics without adding the
`ClosedAt` guard in the same change. Item 4 (`ListTasks` stage filtering) shares
#193's `stagePrecedence` root cause and is a display/query concern; it does not
touch the claim path and does not interact with HIGH-2.

**Can #194 merge while HIGH-1/HIGH-2 remain open?** Yes. #194 is strictly an
improvement on both and introduces no new dependency on the broken behaviour.
Merging does not raise the severity of either; it *raises the priority of the
H1 guard*, because it makes the item-3 cleanup look safe when it is not.

---

## What's done well

- **The layering is genuinely sound, not just rhetorically.** Part 2 does not
  depend on Part 1, and I confirmed that from source rather than from the
  argument. Belt-and-braces designs are often one brace in practice; this one
  isn't.
- **The ordering judgement (close first, labels best-effort) is correct and
  pinned by a test** (`LabelWriteFailureStillCloses`), not merely by a comment.
  Mutation M8 makes the decision falsifiable. The analysis of why the reverse
  ordering is unrecoverable — `ClosedAt` is nil precisely because the close is
  what failed — is exactly right.
- **The post-swap re-read means the system never lies about the label state.**
  This is what turns M1's "silent write failure" concern from a defect into an
  observability gap.
- **Testing the pre-existing `UpdatedAt` fallback they did not write** (M9) is
  the standout call. Part 2's soundness rests on that fallback; leaving it
  unpinned would have made this PR's central invariant depend on untested code.
  Catching that and spending the 20 lines was the right instinct.
- **The `||` single-`if` form** avoids a duplicate `terminal` reason and matches
  the established shape at `multistore.go:250`, comment and all. Guarded by its
  own test (M4).
- **The test fake is stateful and its limitations are documented honestly** —
  including the non-obvious dispatch-ordering hazard, correctly identified as a
  property of the fake rather than of production code.
- **The report volunteers its own weak points** (the swallowed `getIssue` error
  that bit them during development; #193 only partially mitigated). That is the
  behaviour that makes a report worth reading.

---

## Verification Story

- **Tests reviewed:** Yes. Seven new tests; all meaningful, none tautological.
  Coverage maps cleanly onto both arms with separately-failing tests.
- **Build verified:** Yes — `go build ./...` exit 0 (after stubbing the
  gitignored `web/dist` embed).
- **Tests pass:** Yes — `internal/platform/github` green, including under
  `-race`. Full suite green except the pre-existing `TestWatchTasks_*` flake,
  which I reproduced at base `d5db8c4`.
- **Lint/format:** `gofmt -l internal/platform/github/` clean. Pre-existing
  drift elsewhere confirmed present at base; out of scope.
- **Mutation testing:** Independently re-ran M1, M2, M9. All reproduced. One
  fidelity discrepancy in the report's M2 paste (L3), no impact on conclusions.
- **Security:** No credential exposure, no unsanitized input, no new
  dependencies, no new network surface. Two concurrency notes (M2) and one
  latent authorization-adjacent finding (H1), both tracked above.

## Recommended follow-ups (non-blocking)

1. **H1** — add the `t.ClosedAt != nil` guard to `issueUnavailableForClaim`, and
   link it to residue item 3 in the tracker. Highest value of the three.
2. **M2** — mutex-protect `labelIndex`; file against the pre-existing race.
3. **M1** — introduce a structured logger for `internal/platform/github` and
   wire up the discarded label-write errors.
4. **L2** — one clarifying sentence on why `Phase` is unusable in the
   passthrough availability check.
