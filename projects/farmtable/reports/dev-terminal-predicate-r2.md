# dev-terminal-predicate-r2 — round-1 review findings closed

Branch `terminal-predicate`, base `d5db8c4`. Three commits, no push.

| Commit | Task |
|---|---|
| `4361390` | Task 1 — treewalk consolidation + `computeReady` coverage |
| `3bef89c` | Tasks 2 & 3 — exhaustiveness guard, `ClaimTask` assertion |
| `d7314cf` | Task 4 — both overclaims |

```
 .design/project-log/terminal-predicate.md    | 71 ++++++++++++++++++++
 internal/platform/github/treewalk.go         |  5 +-
 internal/platform/github/treewalk_test.go    | 96 ++++++++++++++++++++++++++++
 internal/store/entstore.go                   | 14 +++-
 internal/store/terminal_availability_test.go | 54 +++++++++++++++-
 5 files changed, 232 insertions(+), 8 deletions(-)
```

No `web/` files touched (verified: `git diff --name-only d5db8c4 HEAD | grep -c
'^web/'` → `0`). No Phase 2 branch merged, no rebase. Behaviour-preserving apart
from the one mechanical refactor, as instructed.

---

## Task 1 — treewalk consolidated

`internal/platform/github/treewalk.go`:

```diff
 import (
 	"strings"
 
+	"github.com/farmtable-io/farmtable/internal/store"
 	"github.com/farmtable-io/farmtable/internal/store/ent/task"
 )
@@
 		if includeUnblocked && !hasOpenChildren && node.Stage != task.StageAccepted {
-			isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
-				node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
-			if !isTerminal && len(node.Children) > 0 {
+			if !store.IsTerminalStage(node.Stage) && len(node.Children) > 0 {
```

The brief's correction was right: `treewalk.go` imported only
`internal/store/ent/task` and needed the `internal/store` import added. No cycle.

New tests in `internal/platform/github/treewalk_test.go`, written and run
**before** the consolidation (they pass against the original hand-copied
expression, which is how the refactor is shown to be semantics-preserving):

```
=== RUN   TestComputeReady_TerminalParentIsNotReady
--- PASS: TestComputeReady_TerminalParentIsNotReady (0.00s)
    --- PASS: TestComputeReady_TerminalParentIsNotReady/completed (0.00s)
    --- PASS: TestComputeReady_TerminalParentIsNotReady/wont_fix (0.00s)
    --- PASS: TestComputeReady_TerminalParentIsNotReady/duplicate (0.00s)
    --- PASS: TestComputeReady_TerminalParentIsNotReady/cancelled (0.00s)
=== RUN   TestComputeReady_NonTerminalParentIsReady
--- PASS: TestComputeReady_NonTerminalParentIsReady (0.00s)
    --- PASS: TestComputeReady_NonTerminalParentIsReady/triage (0.00s)
    --- PASS: TestComputeReady_NonTerminalParentIsReady/working (0.00s)
    --- PASS: TestComputeReady_NonTerminalParentIsReady/in_review (0.00s)
    --- PASS: TestComputeReady_NonTerminalParentIsReady/in_qa (0.00s)
    --- PASS: TestComputeReady_NonTerminalParentIsReady/deploying (0.00s)
=== RUN   TestComputeReady_AcceptedTakesTheAcceptedBranch
--- PASS: TestComputeReady_AcceptedTakesTheAcceptedBranch (0.00s)
PASS
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.007s
```

### M11 — the required re-run

**M11 against the ORIGINAL pre-consolidation code, with the new test present**
(`isTerminal := false`, exactly round 1's mutation):

```
--- FAIL: TestComputeReady_TerminalParentIsNotReady (0.00s)
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/completed (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage completed, want none; a task in a terminal stage must never surface as ready
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/wont_fix (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage wont_fix, want none; a task in a terminal stage must never surface as ready
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/duplicate (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage duplicate, want none; a task in a terminal stage must never surface as ready
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/cancelled (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage cancelled, want none; a task in a terminal stage must never surface as ready
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.049s
```

**M11 against the CONSOLIDATED code — now KILLED:**

A note on how the mutation was applied. The literal edit
(`if !false && len(node.Children) > 0`) does not produce a test result at all —
it orphans the new `store` import and the package fails to compile:

```
# github.com/farmtable-io/farmtable/internal/platform/github [.../github.test]
internal/platform/github/treewalk.go:6:2: "github.com/farmtable-io/farmtable/internal/store" imported and not used
FAIL	github.com/farmtable-io/farmtable/internal/platform/github [build failed]
```

That is a compile error, not a kill, so it would be dishonest to report it as
one. Re-applied in a form that keeps the import used and isolates the predicate
as the only thing mutated:

```go
_ = store.IsTerminalStage(node.Stage) // M11: keep import used
isTerminal := false                   // M11
if !isTerminal && len(node.Children) > 0 {
```

```
--- FAIL: TestComputeReady_TerminalParentIsNotReady (0.00s)
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/completed (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage completed, want none; a task in a terminal stage must never surface as ready
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/wont_fix (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage wont_fix, want none; a task in a terminal stage must never surface as ready
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/duplicate (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage duplicate, want none; a task in a terminal stage must never surface as ready
    --- FAIL: TestComputeReady_TerminalParentIsNotReady/cancelled (0.00s)
        treewalk_test.go:49: computeReady returned [1] for terminal stage cancelled, want none; a task in a terminal stage must never surface as ready
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.021s
```

**M11 KILLED.** Previously it survived the entire suite.

### M12 — the inverse, because M11 alone is satisfiable by "return nothing"

`if !(store.IsTerminalStage(node.Stage) || true) && ...`:

```
--- FAIL: TestComputeReady_NonTerminalParentIsReady (0.00s)
    --- FAIL: TestComputeReady_NonTerminalParentIsReady/triage (0.00s)
        treewalk_test.go:71: computeReady returned [] for non-terminal stage triage, want [1]
    --- FAIL: TestComputeReady_NonTerminalParentIsReady/working (0.00s)
        treewalk_test.go:71: computeReady returned [] for non-terminal stage working, want [1]
    --- FAIL: TestComputeReady_NonTerminalParentIsReady/in_review (0.00s)
        treewalk_test.go:71: computeReady returned [] for non-terminal stage in_review, want [1]
    --- FAIL: TestComputeReady_NonTerminalParentIsReady/in_qa (0.00s)
        treewalk_test.go:71: computeReady returned [] for non-terminal stage in_qa, want [1]
    --- FAIL: TestComputeReady_NonTerminalParentIsReady/deploying (0.00s)
        treewalk_test.go:71: computeReady returned [] for non-terminal stage deploying, want [1]
FAIL
```

Both directions pinned. Post-consolidation, unmutated: `ok ... 0.021s`.

---

## Task 2 — exhaustiveness guard, observed failing

Ported the proto-derived `allStages` helper into
`internal/store/terminal_availability_test.go` (already `package store_test`, so
`pb` and `internal/convert` import cleanly — no cycle) and closed the loop after
the existing table.

Unmutated:

```
--- PASS: TestIsTerminalStage_ClassifiesEveryStage (0.00s)
    --- PASS: .../triage    --- PASS: .../accepted   --- PASS: .../working
    --- PASS: .../in_review --- PASS: .../in_qa      --- PASS: .../deploying
    --- PASS: .../completed --- PASS: .../wont_fix   --- PASS: .../duplicate
    --- PASS: .../cancelled
PASS
ok  	github.com/farmtable-io/farmtable/internal/store	0.008s
```

### M13 — simulated new stage, guard OBSERVED FAILING

**A finding worth flagging: the cheap simulation does not work, and the reason
matters.** Adding a value to the proto enum alone is *not* enough to trip the
guard — `convert.StageFromProto` has `default: return task.StageTriage`, so an
unknown proto stage maps to an already-classified stage and the guard stays
silent. The guard defends against a full data-model addition, so the simulation
has to be one. Three temporary edits:

1. `internal/store/ent/task/task.go` — `StageArchived Stage = "archived"` plus
   the `StageValidator` switch entry.
2. `internal/convert/convert.go` — `case pb.TaskStage(99): return task.StageArchived`.
3. the test — `pb.TaskStage_name[99] = "TASK_STAGE_ARCHIVED"`.

```
--- FAIL: TestIsTerminalStage_ClassifiesEveryStage (0.00s)
    terminal_availability_test.go:82: stage "archived" is not classified by this test; add it to the table and confirm IsTerminalStage treats it correctly
FAIL
FAIL	github.com/farmtable-io/farmtable/internal/store	0.008s
```

That is the precise failure mode the brief describes: a new stage would
otherwise have been silently claimable. All three edits reverted (`git status`
showed only the intended test file modified), then re-run:

```
ok  	github.com/farmtable-io/farmtable/internal/store	0.011s
```

---

## Task 3 — `ClaimTask` assertion no longer vacuous

Guard ordering confirmed in `entstore.go`: the `PhaseClosed` check is at `:1189`,
`computeAvailability` at `:1193`. Now pins `errors.Is(err, store.ErrAlreadyClosed)`,
with the comment recording why the terminal arm is defence-in-depth on the claim
path rather than the primary gate. Not `ErrUnavailable`, per the brief.

### M14 — remove `ClaimTask`'s `PhaseClosed` guard

Proves the new assertion pins the guard ordering rather than restating "some
error happened":

```
--- FAIL: TestComputeAvailability_OwnTerminalStageBlocksClaim (0.01s)
    --- FAIL: .../completed (0.00s)
        terminal_availability_test.go:136: ClaimTask on completed task: err = task unavailable, want ErrAlreadyClosed
    --- FAIL: .../wont_fix (0.00s)
        terminal_availability_test.go:136: ClaimTask on wont_fix task: err = task unavailable, want ErrAlreadyClosed
    --- FAIL: .../duplicate (0.00s)
        terminal_availability_test.go:136: ClaimTask on duplicate task: err = task unavailable, want ErrAlreadyClosed
    --- FAIL: .../cancelled (0.00s)
        terminal_availability_test.go:136: ClaimTask on cancelled task: err = task unavailable, want ErrAlreadyClosed
FAIL
```

Independent confirmation of the reviewer's analysis from the other side: remove
the guard and the terminal arm *does* run, returning `ErrUnavailable`.

### M15 — `IsTerminalStage` → `return false`

```
--- FAIL: TestIsTerminalStage_ClassifiesEveryStage (0.00s)
    --- FAIL: .../completed (0.00s)
        terminal_availability_test.go:66: IsTerminalStage(completed) = false, want true
    --- FAIL: .../wont_fix (0.00s)
        terminal_availability_test.go:66: IsTerminalStage(wont_fix) = false, want true
    --- FAIL: .../duplicate (0.00s)
        terminal_availability_test.go:66: IsTerminalStage(duplicate) = false, want true
    --- FAIL: .../cancelled (0.00s)
        terminal_availability_test.go:66: IsTerminalStage(cancelled) = false, want true
--- FAIL: TestComputeAvailability_OwnTerminalStageBlocksClaim (0.01s)
    --- FAIL: .../completed (0.00s)
        terminal_availability_test.go:121: available = true, want false; reasons = []
    --- FAIL: .../wont_fix (0.00s)
        terminal_availability_test.go:121: available = true, want false; reasons = []
    --- FAIL: .../duplicate (0.00s)
        terminal_availability_test.go:121: available = true, want false; reasons = []
    --- FAIL: .../cancelled (0.00s)
        terminal_availability_test.go:121: available = true, want false; reasons = []
FAIL
```

Read the line numbers: every failure is at `:66` and `:121`, and **none at
`:136`**. The `ClaimTask` assertion still passes with the predicate hardwired
false. That is the reviewer's vacuity proof reproduced exactly — and it is why
the fix pins a specific error and documents the unreachability rather than
pretending the assertion covers the terminal arm.

---

## Task 4 — overclaims corrected

1. **Doc comment.** Now says `IsTerminalStage` is the source of truth for the
   *stage half* of the rule, that sites reach it through this function rather
   than restating the stage set, and names what individual sites add on top —
   MultiStore's `PhaseClosed` arm, the tree walk's sub-issue check — with an
   explicit warning not to simplify a site to a bare call without checking what
   else its condition carries.
2. **Design log.** `treewalk.go:103` added to the site table as
   *consolidated in round 2*, plus a section on why it is a CONSOLIDATE and not
   a LEAVE (same question, different packaging), the per-file import point, and
   the fact that the missing coverage was the more important half.

---

## Verification

- `go build ./...` → **exit 0** (redirected to a file, `$?` checked directly —
  not read from a pipeline's exit code).
- `gofmt -l` on all four touched Go files → **clean**.
- `go test ./internal/store/ ./internal/platform/github/ ./internal/server/
  -count=1` → **exit 0**, all three `ok`.

### One caveat: a pre-existing flaky test, not mine

`go test ./...` with a cleared cache intermittently fails:

```
--- FAIL: TestWatchTasks_CreatedEvent (5.01s)
    watch_test.go:153: timed out waiting for event
--- FAIL: TestWatchTasks_UpdatedEvent (5.01s)
    watch_test.go:196: timed out waiting for event
```

I did not report this as green without running it down. It is a pre-existing
timing flake under full-suite parallel load, unrelated to this diff:

| Condition | Result |
|---|---|
| Base `d5db8c4`, `go test ./internal/server/` alone | 5/5 pass (incl. `-race`) |
| Base `d5db8c4`, full `go test ./...` | **2/5 runs FAIL**, same `TestWatchTasks` timeouts |
| This branch, full `go test ./...` | 1/4 runs fail, same tests |
| This branch, `./internal/server/` alone | pass |

Base fails at a comparable-or-higher rate, and the only file this PR touches
outside the store/github test path is a doc comment in `entstore.go`, which
cannot affect runtime. The tests time out at a hard 5s waiting for a streaming
event, so they lose under parallel load. Out of scope per the brief's
instruction not to widen the PR — flagging it for the EM as a separate issue.

---

## Out of scope, confirmed untouched

Per the brief, the two pre-existing HIGH defects in the GitHub pass-through path
(HIGH-1 `labels.go:374-384`, HIGH-2 `passthrough.go:579-606`) and MEDIUM-2/3/4
were **not** fixed. They are recorded in the design log's "Not done, and why"
section with their rationale, so the next reader does not re-derive them. Worth
noting they are a different failure class from this PR's: label-vs-truth defects
where the pass-through trusts labels over real GitHub state, rather than one
rule hand-copied five times.
