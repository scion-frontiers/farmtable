# dev-194-close-label-swap — report

**Issue:** #194, closed pass-through tasks report available
**Branch:** `close-label-swap` @ `03bd155`, base `d5db8c4` (PR #191, `terminal-predicate`)
**Commits:** 2, not pushed
- `605bdd1` — the two fixes plus their tests
- `03bd155` — the `ClosedAt` fallback test plus the project log entry

**Files changed:** `internal/platform/github/passthrough.go`,
`internal/platform/github/close_label_swap_test.go` (new),
`.design/project-log/close-label-swap.md` (new)

No web/frontend files touched. `web/dist` is present in the tree for the
`go:embed` but is gitignored and not committed (`git status` clean after the
commit, `git diff --name-only d5db8c4 HEAD` lists exactly the three files above).
No Phase 2 branch merged in.

---

## Part 1 — stage-label swap in `CloseTask`

`CloseTask` closed the issue with a `state_reason` and returned. Since
`ClaimTask` stamps `ft:stage/working`, the ordinary claim-then-close lifecycle
left that label in place, and `IssueToPhaseStage` reads it back as
`Phase=in_progress, Stage=working`.

The fix follows the pattern at `:348` (`UpdateTask`) and `:548` (`ClaimTask`):
`ensureLabelIndex` → `mapper.StageLabelSwap(issueLabels(target), stage)` →
`labelNamesToIDs` → `removeLabels` then `addLabels`.

Two deviations from those two call sites, both deliberate:

- **`ensureLabelIndex` failure does not abort.** `UpdateTask`/`ClaimTask` do
  `return nil, err`, but in those the label index is fetched *before* the
  primary mutation. Here it is after a completed close, so the block is guarded
  with `if err := s.ensureLabelIndex(ctx); err == nil`.
- **A re-read after the swap.** `closeIssue`'s payload is captured before the
  labels change, so returning it directly would report `Stage=working` for a
  task the user just closed as completed — a user-visible wrong answer in
  `ft close` output. `ClaimTask` solves the same problem with a `getIssue`
  re-read and this does the same, except that a failing re-read falls back to
  the `closeIssue` payload instead of returning an error (see below).

### Judgement call: failure ordering

**Decision: close first, label swap second, label writes best effort.**

The two orderings fail differently:

| Order | Failure | Resulting state | Detectable? |
|---|---|---|---|
| close → swap | swap fails | Issue CLOSED on GitHub, stale `ft:stage/working` | **Yes** — `ClosedAt` is set, Part 2 catches it |
| swap → close | close fails | Issue **OPEN** on GitHub, labelled `ft:stage/completed` | **No** — `ClosedAt` is nil; the terminal label makes the task read as terminal |

The second is strictly worse. An open, unfinished task acquires a terminal
stage from a *label*, disappears from the available queue, and there is no
non-label signal left that contradicts it — `ClosedAt` is nil precisely because
the close is the thing that failed. Part 2 cannot rescue it. The work is
silently dropped and nobody will pick it up.

The first is the residue Part 2 exists to absorb. It is also the only ordering
where a failure leaves the system in a state a retry can fix cleanly: the close
is the user's actual request and it succeeded.

Secondary reasons: it matches `UpdateTask` and `ClaimTask`, which both perform
the primary mutation first and discard label errors with `_ =`; and it means a
label-permission or rate-limit problem degrades label hygiene rather than
breaking the close path outright.

**Related call: the re-read fallback.** If `getIssue` fails after a successful
close, `CloseTask` returns the `closeIssue` payload rather than an error. This
deviates from `ClaimTask`, which returns the error. The reasoning is that
returning an error for a close that genuinely happened is actively misleading:
`CloseTask` looks up its target via `listIssues` filtered to
`IssueStateOpen`, so a user who retries after that error gets `ErrNotFound` on
an issue that is already closed. The cost is that the returned `Stage` may be
stale in that narrow window — but `ClosedAt` is populated on that payload, so
availability is still correct. I consider this the right trade, but it is the
one place I knowingly diverged from the existing pattern and it is the thing to
push back on if you disagree.

**Honest note on that fallback:** it swallows the `getIssue` error silently, and
it bit me during development — my first version of the test fake mis-dispatched
the `getIssue` query and the fallback hid it, surfacing only as a wrong stage
assertion. There is no logger in this package (every label error is already
`_ =`'d), so I did not add one rather than introduce logging as a new pattern in
a deploy-gating PR. Worth revisiting if this package gains structured logging.

## Part 2 — real GitHub state authoritative

```go
// The ClosedAt arm is intentional and unique to the pass-through store: ...
// Do not reduce this to a bare IsTerminalStage call.
if store.IsTerminalStage(t.Stage) || t.ClosedAt != nil {
    reasons = append(reasons, store.AvailabilityReasonTerminal)
}
```

`store.IsTerminalStage` is kept for the stage arm; nothing is hand-rolled.

**Why one `if` and not a second `append`.** A separate `if t.ClosedAt != nil`
block would emit `terminal` **twice** for the ordinary closed-and-completed
task, since both arms fire. That is user-visible in the reason list and would
have broken the existing `len(availability.Reasons) != 1` assertion in
`terminal_availability_test.go` for real closed tasks. The `||` form keeps both
arms load-bearing (mutations M2 and M3 prove each independently) without the
duplicate. This is also exactly the shape already used in
`MultiStore.ComputeAvailability` (`internal/store/multistore.go:249`,
`IsTerminalStage(t.Stage) || t.Phase == PhaseClosed`), including its
"do not reduce this" comment — so this is the established convention, not a new
one.

**Mitigation of #193.** #193 is labels overriding closed state. Part 2
**partially** mitigates it: *availability* is now correct for a closed issue
regardless of what its labels say. The reported *stage* is still wrong — a
closed issue with a stale `ft:stage/working` label still displays as `working`,
because `IssueToPhaseStage` (`labels.go:374-384`) still checks labels first and
`stagePrecedence` still ranks `working` (index 0) above `wont_fix` (index 7).
**#193 itself is not fixed and was not attempted**, per the brief.

## Test double

There *is* an existing GraphQL fake harness in this package, contrary to the
brief's note: `testGraphQLClient(t, http.HandlerFunc)` at
`graphql_test.go:91` builds a `*graphqlClient` pointed at an `httptest` server
via `githubv4.NewEnterpriseClient`, and `passthrough_test.go:49` already drives
`CreateTask` through it. I reused it rather than building a parallel mechanism.

On top of it I added `fakeIssueRepo` — a **stateful** single-issue repository.
State mutates: a label written by `addLabelsToLabelable` is visible to the next
`getIssue`, and `closeIssue` flips `state`, `stateReason` and `closedAt`. That
statefulness is what makes the claimed-then-closed test meaningful; a
stub returning canned responses would not have caught mutation M7.

**What it does not simulate**, stated plainly:

- Requests are matched by **substring on the raw request body**, not parsed.
  There is no GraphQL validation, so a malformed query still gets a response.
- No pagination (`hasNextPage` is always false), no permissions model, no rate
  limiting, no partial-error responses (`data` + `errors` together), no
  concurrency.
- No GitHub-side behaviour: GitHub's own `state_reason` semantics, label
  automation, and webhooks are absent.
- `failLabelWrites` returns a GraphQL-level error for label mutations. It stands
  in for a permissions failure or rate limit, but does not distinguish them and
  does not simulate a network-level failure or timeout.
- One issue, number 1, no sub-issues, no assignees, no parent.

One thing worth flagging: the dispatch order in the handler matters, because
every issue selection also selects `labels(first: 20)`. The single-issue and
issue-list queries must be matched before the repository-labels query or the
fake answers a `getIssue` with a label list. This is called out in a comment in
the fake — it is a property of the fake, not of production code.

## Tests added

| Test | Covers |
|---|---|
| `TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable` | **The reported scenario.** Issue labelled `ft:stage/working`, closed as completed; asserts the label swapped, the returned stage is `completed`, and the read-back task reports `available=false` with reason `terminal`. |
| `TestPassThroughCloseTask_WontFixSwapsToWontFixLabel` | The not-planned close path swaps to `ft:stage/wont_fix`, not a hard-coded completed. |
| `TestPassThroughCloseTask_LabelWriteFailureStillCloses` | Ordering judgement: a failing label write does not error the close; the stale label survives; availability is **still** `false` (Part 2 absorbing Part 1's failure). |
| `TestPassThroughComputeAvailability_ClosedAtOverridesStaleLabel` | **The Part 2 invariant alone.** `ClosedAt` set, `Phase=open`, stage one of the five non-terminal stages → `available=false`. Pure unit test, no fake, so it fails on Part 2's removal regardless of Part 1. |
| `TestPassThroughComputeAvailability_ClosedAtDoesNotDuplicateTerminalReason` | Guards the single-`if` form against a second `append`. |
| `TestPassThroughComputeAvailability_OpenTaskStillAvailable` | The other side: an accepted open task stays available. |
| `TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal` | Part 2's premise: a CLOSED issue with a null `closedAt` still gets a non-nil `ClosedAt` via the `UpdatedAt` fallback, so the Part 2 arm can fire. |

---

## Mutation testing

Nine mutations. Each applied to the committed code, test run, **actual output
pasted**, then `git checkout -- internal/platform/github/passthrough.go` and
re-verified green. No test file was touched during any mutation.

### M1 — remove Part 1 entirely (delete the label-swap block from `CloseTask`)

```
--- FAIL: TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable (0.00s)
    close_label_swap_test.go:246: issue still carries ft:stage/working after close; labels = [ft:stage/working]
    close_label_swap_test.go:249: issue missing ft:stage/completed after close; labels = [ft:stage/working]
    close_label_swap_test.go:252: CloseTask returned stage working, want completed
--- FAIL: TestPassThroughCloseTask_WontFixSwapsToWontFixLabel (0.00s)
    close_label_swap_test.go:284: labels after wont_fix close = [ft:stage/working], want ft:stage/wont_fix only
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.014s
```

Note the *availability* assertion in the first test still passed under M1 —
because Part 2 catches it. That is the belt-and-braces design working, and it is
why the two parts need separately-failing tests rather than one.

### M2 — remove Part 2 (`|| t.ClosedAt != nil`), Part 1 left intact

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
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.028s
```

This is the acceptance criterion "must fail if Part 2 is removed, even with
Part 1 present" — Part 1 was present and unmodified for this run. Note the
`reasons = []` in the first failure: the empty-reason-list symptom from the
original bug report, reproduced exactly.

### M3 — drop the `IsTerminalStage` arm, keep only `ClosedAt`

```
--- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim (0.00s)
    --- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim/completed (0.00s)
        terminal_availability_test.go:34: available = true, want false; reasons = []
    --- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim/wont_fix (0.00s)
        terminal_availability_test.go:34: available = true, want false; reasons = []
    --- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim/duplicate (0.00s)
        terminal_availability_test.go:34: available = true, want false; reasons = []
    --- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim/cancelled (0.00s)
        terminal_availability_test.go:34: available = true, want false; reasons = []
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.025s
```

Confirms Part 2 is genuinely *additional* — it does not subsume the stage arm.
Caught by PR #191's existing test.

### M4 — bolt Part 2 on as a second `append` instead of `||`

```
--- FAIL: TestPassThroughComputeAvailability_ClosedAtDoesNotDuplicateTerminalReason (0.00s)
    close_label_swap_test.go:383: reasons = [terminal terminal], want exactly [terminal]
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.009s
```

### M5 — make the terminal arm unconditional (`if true`)

```
--- FAIL: TestPassThroughComputeAvailability_OpenTaskStillAvailable (0.00s)
    close_label_swap_test.go:401: accepted open task reports available = false; reasons = [terminal]
--- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal (0.00s)
    --- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal/accepted (0.00s)
        terminal_availability_test.go:68: stage accepted reported terminal; reasons = [terminal]
    --- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal/working (0.00s)
        terminal_availability_test.go:68: stage working reported terminal; reasons = [terminal]
    --- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal/in_review (0.00s)
        terminal_availability_test.go:68: stage in_review reported terminal; reasons = [terminal]
    --- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal/in_qa (0.00s)
        terminal_availability_test.go:68: stage in_qa reported terminal; reasons = [terminal]
    --- FAIL: TestPassThroughComputeAvailability_NonTerminalStagesAreNotTerminal/deploying (0.00s)
        terminal_availability_test.go:68: stage deploying reported terminal; reasons = [terminal]
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.007s
```

Behaviour preservation: the fix cannot over-block.

### M6 — hard-code `task.StageCompleted` in the swap, ignoring the requested stage

```
--- FAIL: TestPassThroughCloseTask_WontFixSwapsToWontFixLabel (0.00s)
    close_label_swap_test.go:284: labels after wont_fix close = [ft:stage/completed], want ft:stage/wont_fix only
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.018s
```

### M7 — drop the post-swap re-read (return the `closeIssue` payload directly)

```
--- FAIL: TestPassThroughCloseTask_ClaimedThenClosedIsUnavailable (0.00s)
    close_label_swap_test.go:252: CloseTask returned stage working, want completed
--- FAIL: TestPassThroughCloseTask_WontFixSwapsToWontFixLabel (0.00s)
    close_label_swap_test.go:287: CloseTask returned stage working, want wont_fix
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.015s
```

This also proves the fake is genuinely stateful — the `closeIssue` payload is
rendered pre-swap, `getIssue` post-swap, and the tests distinguish them.

### M8 — make label writes fatal (invert the ordering judgement)

```
--- FAIL: TestPassThroughCloseTask_LabelWriteFailureStillCloses (0.00s)
    close_label_swap_test.go:303: CloseTask returned error when only the label write failed: label write rejected
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.015s
```

The ordering decision is pinned by a test, not just by a comment.

### M9 — remove the `UpdatedAt` fallback for a null `ClosedAt` (`issueToTask`)

```
--- FAIL: TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal (0.00s)
    close_label_swap_test.go:403: ClosedAt is nil for a CLOSED issue; the ClosedAt availability arm cannot fire
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.009s
```

This mutation targets code I did **not** write — the pre-existing fallback that
Part 2's soundness depends on. Without it, a CLOSED issue whose API response
carries a null `closedAt` gets `ClosedAt = nil`, the Part 2 arm never fires, and
the bug reappears for exactly that case. The premise is now pinned rather than
assumed.

### Restore and re-verify

```
$ git checkout -- internal/platform/github/passthrough.go
$ git status --short
(clean)
$ gofmt -l internal/platform/github/
(no output)
$ go build ./... > /tmp/build.log 2>&1; echo "BUILD exit=$?"; cat /tmp/build.log
BUILD exit=0
$ go test ./... > /tmp/test.log 2>&1; echo "TEST exit=$?"
TEST exit=0
```

Build status read from a redirected file's own `$?`, not a pipeline's, per the
brief.

Full `go test ./...`:

```
?   	github.com/farmtable-io/farmtable	[no test files]
?   	github.com/farmtable-io/farmtable/api/farmtable/v1	[no test files]
?   	github.com/farmtable-io/farmtable/cmd/decomposer	[no test files]
ok  	github.com/farmtable-io/farmtable/cmd/farmtable-server	0.027s
?   	github.com/farmtable-io/farmtable/cmd/ft	[no test files]
ok  	github.com/farmtable-io/farmtable/internal/cli	0.025s
?   	github.com/farmtable-io/farmtable/internal/convert	[no test files]
ok  	github.com/farmtable-io/farmtable/internal/decomposer	0.010s
ok  	github.com/farmtable-io/farmtable/internal/mcp	0.013s
?   	github.com/farmtable-io/farmtable/internal/platform	[no test files]
ok  	github.com/farmtable-io/farmtable/internal/platform/beads	0.024s
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.033s
ok  	github.com/farmtable-io/farmtable/internal/server	0.864s
ok  	github.com/farmtable-io/farmtable/internal/serverapp	0.037s
ok  	github.com/farmtable-io/farmtable/internal/store	0.576s
ok  	github.com/farmtable-io/farmtable/internal/streaming	0.914s
?   	github.com/farmtable-io/farmtable/internal/testutil	[no test files]
(ent/* and schema packages: no test files)
```

Also clean under the race detector:

```
$ go test ./internal/platform/github/ -race -count=1
ok  	github.com/farmtable-io/farmtable/internal/platform/github	1.089s
```

Integration tests (`-tags integration`) were not run — no live Postgres in this
workspace, and nothing in this change touches the Ent/Postgres path.

---

## Behaviour preservation for non-GitHub stores

Both changes are confined to `GitHubPassThroughStore` methods. The Ent store
(`internal/store/entstore.go:1094`) and the `MultiStore` fallback
(`internal/store/multistore.go:235`) have their own `ComputeAvailability` and
are untouched; `MultiStore` dispatches to the pass-through implementation for
GitHub collections and to its own otherwise. `store.IsTerminalStage` is read,
not modified. No interface changed. Nothing had to be widened, so the brief's
"stop and report" escape hatch was not needed.

---

## Found but not fixed

1. **#193 is only partially mitigated.** Detail above and in the project log.
   Availability is correct; reported stage is not. Not attempted, per the brief.
2. **The label-swap block is now duplicated three times** — `UpdateTask:348`,
   `ClaimTask:548`, `CloseTask`. Extracting a `swapStageLabels` helper is the
   obvious cleanup, but it means editing two working code paths for no
   behavioural gain in a PR that gates a deploy. Deliberately deferred.
3. **`CloseTask` looks up its target with `listIssues` filtered to
   `IssueStateOpen`** (`:580`), so closing an already-closed task returns
   `ErrNotFound` rather than a clear "already closed". Pre-existing, unrelated
   to #194, not touched. It is the reason the `getIssue` fallback matters —
   see the Part 1 judgement section.
4. **`ListTasks` stage filtering is unreliable for terminal stages** for the
   same `stagePrecedence` reason behind #193. A `--stage completed` filter maps
   to a label query, and an issue carrying both `ft:stage/completed` and a stale
   `ft:stage/working` resolves to `working`. Same root cause as #193; will be
   fixed with it.
5. **Pre-existing `gofmt` drift**, present at base `d5db8c4` and left alone:
   `internal/server/scopes.go`,
   `internal/serverapp/{oauth,tokenrefresh,linkflows_test,unified_test}.go`,
   `internal/streaming/eventbus{,_test}.go`. Verified pre-existing by running
   `gofmt -l` at `d5db8c4`. The two files in this PR are clean.
6. *(Found, then fixed — kept here for the trail.)* The `ClosedAt` `UpdatedAt`
   fallback at `passthrough.go:161-172` had no test, yet Part 2's entire
   soundness argument rests on it. I nearly shipped that as a flagged
   follow-up, then added `TestPassThroughIssueToTask_ClosedWithNullClosedAtStillTerminal`
   instead, since it is the load-bearing premise and cost ~20 lines. Mutation
   M9 below proves it.
