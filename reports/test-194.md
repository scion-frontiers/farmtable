# test-194 — independent test review, `close-label-swap`

**Issue:** #194, closed pass-through tasks report available
**Branch:** `close-label-swap`, range `d5db8c4..03bd155`
**Reviewer:** test engineer, independent verification (dev report read, not ratified)
**Under review:** `internal/platform/github/passthrough.go` (+45/-2),
`internal/platform/github/close_label_swap_test.go` (new, 435 lines)

## Verdict: REQUEST CHANGES

Narrowly scoped, and **no production change is requested**. The production diff
is correct and both arms of the fix are genuinely and independently verified —
mutations (a) and (b) both fail tests, and mutation (b) fails with Part 1 fully
intact, which is the acceptance criterion that matters most. The dev's core
claims hold up under independent re-execution.

The block is one coverage gap with total-outage blast radius: **Part 2 makes
`issueToTask`'s `ClosedAt` assignment safety-critical for the first time, and
only one direction of that premise is pinned.** A mutation that sets `ClosedAt`
for OPEN issues makes every open task in the GitHub pass-through unavailable and
**passes the entire 435-line suite**. The missing test is ~15 lines; I wrote it
and proved it catches the mutation. Two further error-path mutations also
survive.

---

## 1. Standing defect class: self-built oracle — NOT PRESENT

Cleared. This was checked first and specifically, given thirteen prior instances
on this workstream.

The tests exercise the real production path end to end:

- `s.CloseTask(...)` is the real exported method; the label decision is made by
  the real `LabelMapper.StageLabelSwap` (`labels.go:246`), constructed from real
  production config via `NewLabelMapper(DefaultConfig().GitHub.Labels)`
  (`close_label_swap_test.go:220`).
- `s.ComputeAvailability(...)` is the real method; assertions use the real
  `store.AvailabilityReasonTerminal` and `availability.HasReason`.
- `store.IsTerminalStage` is called, not re-implemented.

`fakeIssueRepo` is a **transport stub, not a second implementation**. It serves
JSON over the existing `testGraphQLClient` httptest harness
(`graphql_test.go:91`) and maintains a label list keyed by node ID. It never
decides *which* labels to add or remove — it applies whatever node IDs the
production code puts on the wire (`labelIDsInBody` → `addLabelByID` /
`removeLabelByID`, lines 83–104, 144–153). The swap logic has no shadow copy.

Corroborating evidence that the fake is not an oracle: mutation (a) removes the
production swap and the fake immediately reports the un-swapped label state
(`labels = [ft:stage/working]`). A re-implementing fake would have kept passing.

**Is 435 lines real coverage or padding?** Real. Lines 19–225 (~200) are the
reusable stateful harness, shared by four tests; lines 227–435 (~210) are seven
tests. The harness's *statefulness* is load-bearing, not decoration — mutations
(a), M6 and M7 are only detectable because a label written by one call is
visible to the next. Not padding.

---

## 2. Part 2 without a successful write — COVERED

This was flagged as the most important invariant. It is verified, two
independent ways:

| Test | Write status | Proves |
|---|---|---|
| `..._ClosedAtOverridesStaleLabel` (:334) | **No write ever happens** — pure unit, bare `&ent.Task{}`, no fake, no HTTP | `ClosedAt` set + `Phase=open` + each of the 5 non-terminal stages → `available=false` |
| `..._LabelWriteFailureStillCloses` (:294) | **Write actively fails** (`failLabelWrites=true`) | Close succeeds, stale `ft:stage/working` survives, availability still `false` |

The first parameterises across all five non-terminal stages, so a closed issue
carrying any stale `ft:stage/*` label is covered. Both fail under mutation (b)
with Part 1 present and working. **The invariant is not unverified — I can state
that plainly, having re-run it myself.**

---

## 3. Inverse case (OPEN issue not made terminal) — PARTIALLY COVERED, this is the gap

Covered at the **hand-constructed-struct** level:
- `..._OpenTaskStillAvailable` (:422) — one stage (`accepted`), bare `&ent.Task{}`.
- Pre-existing `..._NonTerminalStagesAreNotTerminal` (`terminal_availability_test.go:47`) — five stages, bare `&ent.Task{}`.

**Not covered at the read-path level.** Every inverse test constructs `ent.Task`
by hand and therefore bypasses `issueToTask` entirely. No test reads an OPEN
issue through `GetTask`/`issueToTask` and asserts it is available.

That matters specifically *because of this PR*. Before Part 2, `ClosedAt` had no
effect on availability at all. After Part 2, `ClosedAt` alone determines
terminality. The dev correctly identified this and pinned the premise in one
direction — `..._ClosedWithNullClosedAtStillTerminal` (:391) proves `ClosedAt`
is non-nil when CLOSED (their M9). The opposite direction — `ClosedAt` **must be
nil when OPEN** — is unpinned, and it is the direction with the larger blast
radius:

- Unpinned direction breaks → *every open task* becomes unavailable. Ready queue
  empties. All work stops.
- Pinned direction breaks → *one closed task* wrongly reports available.

See mutation (e) below for the demonstration.

---

## 4. Mutation testing — actual output

All mutations applied to committed code with **no test file modified**, then
`cp` restore + re-verify green. Baseline before starting:
`ok github.com/farmtable-io/farmtable/internal/platform/github 0.033s`.

### (a) Remove the label swap — Part 1

Deleted the `if err := s.ensureLabelIndex(ctx); err == nil { ... }` block from
`CloseTask` (the `StageLabelSwap` / `removeLabels` / `addLabels` sequence).

```
--- FAIL: TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable (0.01s)
    close_label_swap_test.go:246: issue still carries ft:stage/working after close; labels = [ft:stage/working]
    close_label_swap_test.go:249: issue missing ft:stage/completed after close; labels = [ft:stage/working]
    close_label_swap_test.go:252: CloseTask returned stage working, want completed
--- FAIL: TestPassThroughCloseTask_WontFixSwapsToWontFixLabel (0.00s)
    close_label_swap_test.go:284: labels after wont_fix close = [ft:stage/working], want ft:stage/wont_fix only
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.065s
```

**2 tests fail. Part 1 is covered.** Reproduces the dev's M1 exactly, including
line numbers. Note the *availability* assertion inside the first test still
passes here — Part 2 absorbs it. That is the belt-and-braces design working, and
it is exactly why the two arms need separately-failing tests.

### (b) Remove the closed-state-is-terminal check — Part 2

`if store.IsTerminalStage(t.Stage) || t.ClosedAt != nil {` →
`if store.IsTerminalStage(t.Stage) {`. **Part 1 left fully intact and working.**

```
--- FAIL: TestPassThroughCloseTask_LabelWriteFailureStillCloses (0.00s)
    close_label_swap_test.go:325: closed task with failed label swap reports available = true; reasons = []
--- FAIL: TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel (0.00s)
    --- FAIL: TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel/accepted (0.00s)
        close_label_swap_test.go:358: closed task with stale accepted label reports available = true
    --- FAIL: TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel/working (0.00s)
        close_label_swap_test.go:358: closed task with stale working label reports available = true
    --- FAIL: TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel/in_review (0.00s)
        close_label_swap_test.go:358: closed task with stale in_review label reports available = true
    --- FAIL: TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel/in_qa (0.00s)
        close_label_swap_test.go:358: closed task with stale in_qa label reports available = true
    --- FAIL: TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel/deploying (0.00s)
        close_label_swap_test.go:358: closed task with stale deploying label reports available = true
--- FAIL: TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal (0.00s)
    close_label_swap_test.go:414: closed issue with null closedAt reports available = true; stage = working, reasons = []
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.036s
```

**3 test functions / 7 subtests fail, with Part 1 present. Part 2 is
independently covered.** The `reasons = []` symptom is the original #194 bug
report reproduced exactly.

> **Discrepancy vs. the dev report.** My mutation (b) produces *one more*
> failure than their M2: `..._ClosedWithNullClosedAtStillTerminal` at :414. Their
> M2 output predates commit `03bd155`, which added that test. Their M5 output
> cites `close_label_swap_test.go:401` for `..._OpenTaskStillAvailable`, which is
> at :433 in the committed file — same cause. **The mutation outputs in the dev
> report were not re-run after the final commit.** Conclusions are unaffected
> and in fact slightly stronger than reported, but the pasted evidence is stale.

### (c) SURVIVED — invert the `getIssue` re-read fallback

`return s.issueToTask(closed), nil` → `return nil, err`.

```
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.064s
```

**No test fails.** The dev devotes a full section to defending this fallback
("the one place I knowingly diverged from the existing pattern and it is the
thing to push back on if you disagree") and admits it silently hid a bug during
development. It is entirely unpinned.

### (d) SURVIVED — make `ensureLabelIndex` failure fatal

`if err := s.ensureLabelIndex(ctx); err == nil {` → `if err != nil { return nil, err }`.

```
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.053s
```

**No test fails.** This is the dev's other named "deliberate deviation" from
`UpdateTask`/`ClaimTask`. Their M8 pins the *label-write* failure mode; it does
not pin the *label-index* failure mode. The claim "the ordering decision is
pinned by a test, not just by a comment" is true for one of three failure modes.

**Why (c) and (d) matter beyond style.** `CloseTask` looks up its target via
`listIssues` filtered to `IssueStateOpen` (`passthrough.go:580`). Once the close
succeeds the issue is CLOSED, so a retry returns `store.ErrNotFound`. Either
mutation therefore produces: *close succeeds on GitHub → user sees an error →
user retries → "not found" → user believes the close failed.* That is precisely
the trap the dev's design reasoning exists to avoid, and nothing enforces it.

### (e) SURVIVED — `issueToTask` sets `ClosedAt` for OPEN issues

`if stateStr == "CLOSED" {` → `if true {` (`passthrough.go:161`).

```
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.044s
```

**No test fails.** Every open task in the GitHub pass-through would report
`available=false` with reason `terminal`. Total ready-queue outage, zero test
signal.

Proof the gap is closable and that I am not asserting it abstractly — I wrote
the missing test, confirmed it **passes on unmutated HEAD**:

```
=== proposed test on UNMUTATED HEAD (expect PASS) ===
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.015s
```

then re-applied mutation (e) and ran the **full suite** including it:

```
--- FAIL: TestGapOpenIssueEndToEndStaysAvailable (0.00s)
    zz_gap_test.go:19: ClosedAt = 2026-01-02 00:00:00 +0000 UTC for an OPEN issue, want nil
    zz_gap_test.go:26: OPEN accepted issue reports available = false; reasons = [terminal]
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.034s
```

The proposed test is the **only** failure. The committed 435-line suite passes
mutation (e) in full.

Test used (scratch file, removed; not committed):

```go
func TestGapOpenIssueEndToEndStaysAvailable(t *testing.T) {
	fake := newFakeIssueRepo(t, "ft:stage/accepted")
	s := fake.store()

	readBack, err := s.GetTask(context.Background(), s.issueUUID(1))
	if err != nil {
		t.Fatalf("GetTask: %v", err)
	}
	if readBack.ClosedAt != nil {
		t.Errorf("ClosedAt = %v for an OPEN issue, want nil", readBack.ClosedAt)
	}
	availability, err := s.ComputeAvailability(context.Background(), readBack)
	if err != nil {
		t.Fatalf("ComputeAvailability: %v", err)
	}
	if !availability.Available {
		t.Fatalf("OPEN accepted issue reports available = false; reasons = %v", availability.Reasons)
	}
}
```

### Mutation summary

| # | Mutation | Result |
|---|---|---|
| (a) | remove label swap | **caught** — 2 tests |
| (b) | remove `\|\| t.ClosedAt != nil` | **caught** — 3 tests / 7 subtests, Part 1 intact |
| (c) | re-read fallback → return error | **SURVIVED** |
| (d) | `ensureLabelIndex` failure → fatal | **SURVIVED** |
| (e) | `ClosedAt` set for OPEN issues | **SURVIVED** |

I independently reproduced (a) and (b); I did not re-run the dev's M3–M9, whose
pasted output is internally consistent with the committed line numbers except
where noted above.

---

## 5. Error-path coverage

| Path | Covered? | Notes |
|---|---|---|
| Label write rejected (GraphQL error) | **Yes** | `failLabelWrites`; close still succeeds, availability still false |
| Label *index* read failure | **No** | mutation (d) survives |
| `getIssue` re-read failure | **No** | mutation (c) survives |
| Network/transport failure, timeout | **No** | fake returns GraphQL-level errors only; never a connection error, 5xx or context deadline. Different code path in the client. |
| Rate limit vs. permissions distinction | **No** | Low value — production treats all label errors identically (`_ =`), so distinguishing them cannot change behaviour |
| `closeIssue` failure | **No** | the `return nil, err` early exit is untested |
| Null `closedAt` on CLOSED issue | **Yes** | `..._ClosedWithNullClosedAtStillTerminal` |
| Null/absent `updatedAt` | **No** | would yield zero-time `ClosedAt`; still non-nil so terminal fires — benign, but unpinned |
| Malformed JSON / missing `labels` node | **No** | fake always emits well-formed payloads |
| Pagination, concurrency, partial GraphQL errors | **No** | dev states these plainly as out of scope; agreed |

The dev's "what it does not simulate" list is accurate and honest — I found no
undisclosed limitation in the fake.

---

## 6. Coverage gaps, classified

### Critical
1. **No end-to-end test that an OPEN issue stays available.** Mutation (e)
   survives the full suite. Part 2 newly makes `issueToTask`'s `ClosedAt`
   assignment the sole determinant of terminality, and only the CLOSED direction
   of that premise is pinned. Blast radius is every open task. Fix: the ~15-line
   test above.

### High
2. **`getIssue` re-read fallback is unpinned** — mutation (c). A documented,
   deliberate divergence from `ClaimTask`, defended at length, enforced by
   nothing. Combined with the `IssueStateOpen` lookup filter, regressing it makes
   a successful close look like a failure that cannot be retried. Fix: a fake
   mode that fails the *post-swap* `getIssue` and asserts `CloseTask` returns no
   error and a populated `ClosedAt`.
3. **`ensureLabelIndex` failure guard is unpinned** — mutation (d). Same class,
   same consequence. Fix: a fake mode that errors the repository-labels query and
   asserts the close still succeeds.

### Medium
4. **No transport-level failure simulation.** All error injection is
   GraphQL-body-level. Connection reset, 5xx and context cancellation take a
   different path through the client and are untested on the close path.
5. **`closeIssue` failure path untested.** The primary mutation's own error
   branch has no coverage; nothing asserts that no label is touched when the
   close itself fails — which is the stated safety property of the chosen
   ordering.

### Low
6. **Inverse coverage is struct-level only.** Once gap 1 is closed this largely
   resolves; parameterising the new test across non-terminal stages would fully
   close it.
7. **Fake's label universe is narrower than production's** — `labelIDs` omits
   `in_review`, `in_qa`, `deploying`, `duplicate`. Fails safe (an unmapped label
   silently no-ops and the assertion catches it), but it means the swap is only
   exercised for `completed` and `wont_fix`.
8. **`removeLabelByID` uses `kept := f.labels[:0]`**, aliasing the backing array
   while ranging over it. Correct as written, fragile to edit. Test-harness only.

---

## 7. Findings outside test scope (recommendations, not escalations)

- **`go build ./...` fails from a clean checkout**, at HEAD *and* at base
  `d5db8c4`: `assets.go:5:12: pattern all:web/dist: no matching files found`.
  Pre-existing and unrelated to this PR — `web/dist` is gitignored and must be
  built first. Flagging only because the dev report records `BUILD exit=0`, which
  is not reproducible without a pre-built frontend; CI should be checked.
- Verified clean at HEAD: `gofmt -l internal/platform/github/` empty;
  `go test ./internal/platform/github/ -race -count=1` ok (1.096s);
  `internal/store`, `internal/mcp` unaffected. Working tree restored to
  `03bd155`, `git status --short` clean.
- The dev's Part 1/Part 2 ordering argument (close first, labels best-effort) is
  sound and I agree with it — the failure-mode table is correct, and the reverse
  ordering really is undetectable. My objection is only that two of its three
  failure modes are unenforced.
- #193 remains unfixed (stage still misreported for closed issues with stale
  labels); the dev states this accurately and it was out of scope.

## 8. What would flip this to APPROVE

The three tests for gaps 1–3. No production change. Gap 1 alone is arguably
sufficient given the blast-radius asymmetry; I would take all three, and the
test for gap 1 is already written and verified above.
