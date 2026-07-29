# #194 round 6 — shared brief for all three review legs

You are one of **three independent reviewers** running in parallel on the same
tree. The other two are a code reviewer, a security auditor, and a test reviewer
(you are one of these). **You will not talk to each other.** Everything goes
through the engineering manager.

## The tree

```
branch  label-write-scope-r6
SHA     6ced24e53234da12def832c46df1c2be906fc038
```

Your workspace is mounted at `/workspace`. Verify with `git rev-parse HEAD`
before you touch anything. If it does not match, stop and tell me.

This is a **merge** of two parallel development legs off
`ea8ac390dad3d2401d65608684e5d6623ab15ac5`:

- **leg A** (`internal/platform/github/`) — label/prefix authorization surface
- **leg B** (`internal/server/`, `internal/store/`) — the authorization gate and store

31 files, 5102 insertions, 218 deletions. The merge was clean — no conflicts.

## THE GATE — I measured this myself on this exact SHA

Every line below was executed by me on a fresh `--no-local` clone of 6ced24e with
a harness that **aborts on a failed prerequisite** rather than continuing:

```
go build ./...   BEFORE make web -> EXIT 1   "pattern all:web/dist: no matching files found"
make web                         -> EXIT 0   4109 files
go build ./...   AFTER  make web -> EXIT 0
go vet ./...                     -> EXIT 1   EXACTLY 4 findings
go test ./...                    -> EXIT 0   panics 0, setup-failed 0
go test ./... -v                 -> 625 top-level / 1825 result lines
make race                        -> EXIT 0   (scoped to ./internal/platform/github/ only)
go test -race ./internal/server/ -> exit 0 x3, 0 data races
```

**`go build ./...` FAILS ON A FRESH CLONE until you run `make web`.** `assets.go`
embeds `all:web/dist` and `web/dist` is gitignored (`.gitignore:17`). I am telling
you the symptom because I measured it; **establish your own remedy and report what
you did.** Do not assume mine.

**The four `go vet` findings are PRE-EXISTING and are not yours to fix.** All four
are `assignment copies lock value to ephReq` in `internal/server/server.go`, naming
`GetReadyTasksRequest`, `GetBlockedTasksRequest`, `GetCriticalPathRequest`,
`GetBottlenecksRequest`. **Verify them BY REQUEST TYPE, never by line number** —
the lines moved this round (1601/1711/1919/2096 → 1664/1774/1982/2159) and a
by-line check would report four false new findings. `internal/platform/github/`
has ZERO, so any finding there is new and is a defect.

**There is no CI.** Nothing runs any of this but you. (Tracked as #12, blocked on
a GitHub App permission scope; no agent token can write `.github/workflows/`.)

## The defect class this branch keeps producing

**A check that derives from the thing it is checking cannot falsify it.**
**Eight instances so far.** Related forms, all of which have bitten us here:

1. A check that cannot falsify what it checks.
2. **A fixture that cannot express the input.** The test passes because the
   harness cannot construct the breaking case.
3. A correct check answering a question nobody meant to ask.
4. A transport that succeeds at delivering something nobody wrote.
5. **A post-hoc tally.** A reconciliation computed after seeing the total cannot
   be refuted by the total.

When you evaluate any pin, ask: *what input would make this fail, and can the
fixture even build that input?* If it cannot, the pin is decorative.

## WHAT IS KNOWN-OPEN. Do not report these as closed; do not credit them as fixed.

I am telling you these so you spend your time on what is *not* on this list.
If you find that any of them is **worse** than stated, that is a finding.

1. **THE STAGE-COLLAPSE SEAM IS OPEN.** `terminal_label_stages.go` builds
   `present := make(map[task.Stage]bool)`, so two distinct labels resolving to the
   same stage collapse to one entry. Removing one leaves a byte-identical stage
   set, `SameStageSet` reports no change, the gate short-circuits, and the label
   is destroyed on a bare `task:write`. It is **live in the default config** — ten
   stages, four authorized spellings each, zero configuration required. It is
   deliberately **characterized, not fixed**, by two active tests that assert the
   DEFECTIVE behaviour so it cannot be closed silently:
   - `internal/server/authz_label_set_collapse_seam_test.go` —
     `TestUpdateTask_TwoLabelsOneStageCollapseIsUngatedToday`
   - `internal/platform/github/label_stage_collision_test.go` —
     `TestSpellingCollision_IsInvisibleToTheStageSetGate`

   Routed to round 7. Neither is a `t.Skip` and neither should become one.
2. **The TOCTOU window** between the authorization decision and the actual label
   write is NOT closed. It should not be claimed as closed anywhere.
3. **A5 is "benign, not closed"** — `transitions.go:124` still short-circuits
   `from == to` to `task:write`. The call is still permitted; what changed is that
   it no longer destroys a label the system does not own.
4. **`ft:priority:completed` authorizes as the terminal STAGE `completed`**,
   because `stripForMatch` removes priority segments before a stage lookup. Found
   and deliberately not chased.
5. **A custom-prefix end-to-end control is NOT landed.** A 12-cell matrix proving
   the gate holds at a non-default `push_prefix` exists in the round-5 audit
   probes and was deliberately deferred to avoid colliding with leg A's prefix
   unification. `push_prefix` is now a security parameter, so judge for yourself
   whether its absence is blocking.
6. Stale comment at `internal/platform/github/passthrough.go:54` names
   `store.LifecycleStagesOf` / `store.LabelDeltaLifecycleStagesOf`, which do not
   exist under those names.

## Standing bars — not optional, and they apply to YOUR harness too

1. **Positive control before any negative claim.** If you report "X is not
   reachable" or "this mutation is caught", first demonstrate your harness can
   detect the thing when it IS present. A green result from a harness you have
   never seen go red is worth nothing. **Five void harnesses were produced on this
   workstream in a single night** — including two of mine — and every one printed
   a complete, plausible table. None of them errored. The only thing that has ever
   caught one is *a number contradicting something visible*.
2. **A harness must ABORT on a failed prerequisite**, never continue and report
   downstream numbers.
3. **Exit codes from the child, never through a pipe.** (`cmd > log 2>&1; E=$?`,
   not `cmd | tail; E=$?`.)
4. **Mutations content-addressed, never line-addressed.** Anchor on unique
   surrounding text and **abort if the anchor is not unique.**
5. **"Clean" is not "unchanged."** Verify restoration with sha256 against an
   out-of-repo pristine copy, not `git status`.
6. **Verify a green mutation actually weakens the thing.** A mutation that fails
   to compile is not a surviving mutant; it is a void run.
7. **Name the rule that fired, not just the colour.**
8. **Predict a count BEFORE you measure it, or label the reconciliation post-hoc.**
9. **Costly disclosure is the trust signal.** Report dead ends, voided runs, and
   places you were wrong. **A narrower true claim beats a broader unverified one.**

## Two standing charges — answer both explicitly in your report

**C-A. List every factual claim THIS BRIEF makes that you did not independently
verify, and say which ones you relied on.** A shared brief defeats leg
independence: you three are not independent about anything I assert here, and if
I am wrong my error arrives in all three of your reports looking exactly like
convergence. This charge is how that becomes visible instead of invisible.

**C-B. Falsification.** Beyond your targeted charges, name the single claim in
this round's work that you consider least supported by evidence, and say what
would falsify it. This is ADDITIVE to your specific charges, not a replacement.

## Deliverables

1. A report at `/scion-volumes/scratchpad/projects/farmtable/reports/<yourleg>-194-r6.md`.
   **This file is the deliverable.** A finished analysis that is not written to
   that path does not exist.
2. A **project log entry** at `.design/project-log/`, committed. Not optional.
3. A summary message to me (`scion message farmtable-em-task-state-model-v2`) with your verdict
   (APPROVE / REQUEST CHANGES), your finding counts by severity, and your answers
   to C-A and C-B.
4. **Do not push.** Commit locally only. I am the only agent permitted to push.
5. **Do not modify production code.** Your independence depends on it. Probe
   files and mutations are fine if you restore the tree and verify by sha256.

You MUST write the report file, write the project log entry, send me the summary,
and then mark the task complete.
