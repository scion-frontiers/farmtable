# dev-terminal-predicate-r2 — close the round-1 review findings on #191

## Context

You are continuing PR #191 (`terminal-predicate`), which pinned and consolidated
the terminal-stage availability rule. **All three independent reviews came back
APPROVE with zero Critical and zero in-diff High findings.** The work was good —
the consolidation was verified semantics-preserving by all three reviewers, and
the test reviewer's 11-mutation battery killed all 10 in-scope mutations.

This round closes a small set of findings that all three reviewers converged on.
Your workspace is `/workspace/farmtable-terminal-predicate`, branch
`terminal-predicate`, currently at `d5db8c4`. Tree is clean. Do not rebase, do
not merge any Phase 2 branch in.

**Still behaviour-preserving.** Everything below is additive test coverage plus
one mechanical 3-line refactor. If you find yourself changing what production
code *does* beyond that refactor, stop and report.

**Reminder for the Go build:** a fresh clone fails `go build ./...` with
`assets.go:5:12: pattern all:web/dist: no matching files found` because
`web/dist` is gitignored but required by a `go:embed`. If your tree lacks it:
`cp -r /workspace/farmtable/web/dist /workspace/farmtable-terminal-predicate/web/dist`.
It stays gitignored — do not commit it.

Also: do not read build success from a pipeline's exit code. `go build ./... |
tail -3; echo $?` reports `tail`'s status, not the build's. Redirect to a file,
then check `$?`.

---

## Task 1 — consolidate `treewalk.go:104` (all three reviewers flagged this)

`internal/platform/github/treewalk.go:103-106` is a **fifth hand-copy** of the
terminal-stage set that the round-1 scope analysis missed:

```go
if includeUnblocked && !hasOpenChildren && node.Stage != task.StageAccepted {
    isTerminal := node.Stage == task.StageCompleted || node.Stage == task.StageWontFix ||
        node.Stage == task.StageDuplicate || node.Stage == task.StageCancelled
    if !isTerminal && len(node.Children) > 0 {
```

**Decision: consolidate it.** I considered leaving it as a distinct concept and
rejected that. The genuine LEAVE sites (`CloseTask`'s close-target validation,
`phaseForStage`) differ in *what question they answer*. This site asks the same
question as availability — "is this work still live enough to surface as ready" —
and merely packages the answer as a `readyResult` instead of an
`AvailabilityReason`. Packaging is not concept.

Replace with:

```go
if !store.IsTerminalStage(node.Stage) && len(node.Children) > 0 {
```

**One correction to the review report:** it says the `store` import is already
present. That is true at *package* level (`passthrough.go` imports it) but Go
imports are per-file, and `treewalk.go` currently imports only
`internal/store/ent/task`. You must add
`"github.com/farmtable-io/farmtable/internal/store"` to `treewalk.go`'s import
block. There is no import cycle — same package already depends on `store`.

### This site currently has ZERO coverage — that is the important half

The test reviewer's mutation M11 replaced the whole expression with
`isTerminal := false` and **the entire `internal/platform/github` suite still
passed**. Consolidating without adding a test just moves an untested line.

**Required:** a `computeReady` test covering a terminal node with children, such
that mutating the predicate fails the suite. Then re-run M11 yourself against
the consolidated code and paste the now-**killed** output.

---

## Task 2 — make `TestIsTerminalStage_ClassifiesEveryStage` true to its name

`internal/store/terminal_availability_test.go:25` hardcodes a 10-row table, and
`IsTerminalStage` has `default: return false`. So adding a stage to the data
model tomorrow yields a **silently claimable** stage while this test still
passes. That is the exact failure mode this PR exists to fix, one level up — the
same "naming manufactured the appearance of coverage" defect the design log
argues against.

The asymmetry worth internalising: add `StageArchived` today and
`transitions.go`'s `TestStageGroupsPartitionAllStages` **fails**, while
`TestIsTerminalStage_ClassifiesEveryStage` **passes**. The weaker guard is
protecting the load-bearing invariant.

The repo already has the right pattern at
`internal/server/transitions_internal_test.go:13` — a proto-derived `allStages`.
The reviewer verified an additive port compiles and passes from `internal/store`
with no import cycle (`terminal_availability_test.go` is already
`package store_test`, so it can import `pb` and `internal/convert`):

```go
// Derived from the proto enum so a stage added to the data model shows up here
// without touching this test. Mirrors allStages in
// internal/server/transitions_internal_test.go.
func allStages(t *testing.T) []task.Stage {
	t.Helper()
	var stages []task.Stage
	for value, name := range pb.TaskStage_name {
		if name == pb.TaskStage_TASK_STAGE_UNSPECIFIED.String() {
			continue
		}
		stage := convert.StageFromProto(pb.TaskStage(value))
		if err := task.StageValidator(stage); err != nil {
			t.Fatalf("proto stage %s does not map to a valid task stage: %v", name, err)
		}
		stages = append(stages, stage)
	}
	return stages
}
```

Then close the loop after the existing table loop:

```go
// The table above must classify every stage in the data model. IsTerminalStage
// returns false by default, so a stage missing here would be silently claimable
// — the exact failure this predicate exists to prevent.
covered := make(map[task.Stage]bool, len(tests))
for _, tt := range tests {
	covered[tt.stage] = true
}
for _, stage := range allStages(t) {
	if !covered[stage] {
		t.Errorf("stage %q is not classified by this test; add it to the table "+
			"and confirm IsTerminalStage treats it correctly", stage)
	}
}
```

**Verify it actually works** — don't just add it. Temporarily add a stage to the
proto enum mapping (or otherwise simulate an unclassified stage), confirm the
test **fails**, restore, confirm green. Paste both outputs. A guard against
future drift that has never been observed failing is not yet a guard.

---

## Task 3 — fix the vacuous `ClaimTask` assertion (F2)

`internal/store/terminal_availability_test.go:85-87`:

```go
if _, err := s.ClaimTask(ctx, created.ID, uuid.New(), ""); err == nil {
    t.Fatalf("ClaimTask on %s task succeeded, want rejection", stage)
}
```

This never reaches the terminal arm. `ClaimTask` rejects on a `PhaseClosed`
guard that fires *before* `computeAvailability` is called, and `CloseTask` sets
`PhaseClosed`, so the task is always closed by the time it claims. The test
reviewer proved vacuity: with `IsTerminalStage` hardwired to `false`, this
assertion **still passes** on all four stages.

It is the same species of trap this PR exists to eliminate, reproduced inside
the fix. Pin what actually happens:

```go
if !errors.Is(err, store.ErrAlreadyClosed) { t.Fatalf(...) }
```

**Do NOT change it to assert `ErrUnavailable`** — that would fail today.

Add a short comment recording *why*: because of this guard ordering, EntStore's
terminal availability arm is unreachable through `ClaimTask` in normal
operation. It still matters — `ComputeAvailability` is exposed directly for
availability display and over the API — but on the claim path it is
defence-in-depth, not the primary gate. Worth knowing before someone
"simplifies" it away on the grounds that claims are already blocked.

---

## Task 4 — correct the two overclaims

1. **Doc comment.** `IsTerminalStage`'s comment says it is "the single source of
   truth for the terminal arm of availability, shared by every availability
   implementation". That is not literally true for `MultiStore`, which
   deliberately ORs in a `PhaseClosed` arm. As written it could invite a future
   reader to "simplify" `multistore.go` down to a bare `IsTerminalStage` call
   and silently drop that arm — the precise behaviour change round 1 was warned
   about. Reword so it describes the shared *stage* rule without claiming each
   site is nothing but this call.

2. **Design-log table.** `.design/project-log/terminal-predicate.md`'s site table
   never enumerated `treewalk.go`. Add the row with the consolidate decision and
   its rationale, so the next reader doesn't re-derive it.

---

## Explicitly OUT of scope — I am filing these separately, do not fix

The security audit found two **pre-existing HIGH** defects in the GitHub
pass-through path. Both are real (I verified HIGH-2 myself), both are outside
this diff, and neither blocks it. They are becoming their own issues:

- **HIGH-1** `labels.go:374-384` — for a closed issue, labels are consulted
  before real GitHub state, so an `accepted` label forges `available=true` with
  an empty reason list.
- **HIGH-2** `passthrough.go:579-606` — `CloseTask` never swaps stage labels
  (unlike `UpdateTask:348` and `ClaimTask:548`), so claimed-then-closed tasks
  keep `ft:stage/working` and report available on the ordinary happy path.

Also out of scope: MEDIUM-2 (`ClaimTask` non-atomic / fails open), MEDIUM-3
(hardcoded `ft:` prefix), MEDIUM-4 (advertised ≠ enforced availability).

Do not widen this PR into any of them.

---

## Acceptance criteria

- treewalk consolidated, `store` import added to that file, **M11 re-run and now
  KILLED**, real output pasted.
- Exhaustiveness guard added AND **observed failing** on a simulated new stage,
  both outputs pasted.
- F2 assertion pins `ErrAlreadyClosed`, with the explanatory comment.
- Both overclaims corrected.
- `go build ./...` and `go test ./...` green, output pasted. `gofmt` clean.
- No web/frontend files touched. No Phase 2 branch merged in.

## Deliverables — all required

1. Commits on branch `terminal-predicate`.
2. Updated `.design/project-log/terminal-predicate.md` including the new
   treewalk row and a "Not done, and why" section covering the deferred HIGHs.
3. A report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/dev-terminal-predicate-r2.md`
   with every mutation's real output.

**Do not push.** Commit locally; the manager pushes.

You MUST commit your work, write the project log entry, write the report file at
the exact path above, and then mark the task complete.
