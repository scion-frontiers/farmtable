# Independent Test Re-Review (Round 2) — #191 terminal-stage availability

**Reviewer:** test engineer (independent; verified, did not ratify)
**Branch / commit:** `terminal-predicate-r2` @ `d7314cf`
**Range reviewed:** `git log --oneline d5db8c4..HEAD` → three commits, confirmed
**Tree:** clean before and after every mutation
**Date:** 2026-07-27

```
d7314cf Correct two overclaims about the terminal predicate
3bef89c Make the terminal-stage tests keep the promises their names make
4361390 Consolidate treewalk terminal check and cover computeReady
```

---

## Verdict: **APPROVE**

Both round-1 findings are genuinely closed, proven by mutation rather than inspection. The
consolidation is real — not cosmetic — and I verified that by a mutation neither the dev nor
round 1 ran: dropping `StageCancelled` from the shared predicate now propagates into the GitHub tree
walk, which it could not have done before.

The developer's report is the most honest one I have reviewed on this workstream. Two things stand
out: they refused to count a compile error as a mutation kill (correctly — I hit the identical trap
and discarded it too), and they self-disclosed a real limitation in their own exhaustiveness guard
that I independently found. Neither was something a reviewer would necessarily have caught.

Two new **Low** findings below. Neither blocks merge; one is undisclosed and worth a follow-up.

---

## Per-item status of round-1 findings

| # | Round-1 finding | Severity | Status | Proof |
|---|---|---|---|---|
| F1 | `treewalk.go:104` un-consolidated *and* untested (M11 survived) | Medium | **CLOSED** | R2-M1b, R2-M2b, R2-M3 all kill |
| F2 | `ClaimTask` assertion vacuous w.r.t. terminal predicate | Low/Med | **CLOSED** | R2-M4 kills |
| F3 | Frontend `isReady` shares the masking shape | Info | **Open, correctly out of scope** | `web/` untouched (verified) |
| F4 | `..._RequiresOpenAccepted` excluded by `-run Terminal` | Info | **Open, cosmetic** | still true; also `..._AcceptedTakesTheAcceptedBranch` |

### F1 — closed, and the consolidation is genuine

The fifth hand-copy is gone; `computeReady` now calls `store.IsTerminalStage`. Both directions are
pinned by new tests. The round-1 survivor is dead:

```
MUTATION: R2-M1b: treewalk terminal check neutralised, import preserved (true M11 re-run)
-			if !store.IsTerminalStage(node.Stage) && len(node.Children) > 0 {
+			if (store.IsTerminalStage(node.Stage) || true) && len(node.Children) > 0 {

--- FAIL: TestComputeReady_TerminalParentIsNotReady/completed
        treewalk_test.go:49: computeReady returned [1] for terminal stage completed, want none; a task in a terminal stage must never surface as ready
--- FAIL: TestComputeReady_TerminalParentIsNotReady/wont_fix
--- FAIL: TestComputeReady_TerminalParentIsNotReady/duplicate
--- FAIL: TestComputeReady_TerminalParentIsNotReady/cancelled
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.023s
RESULT: KILLED
```

Inverse direction, so that "return nothing" cannot satisfy the above:

```
MUTATION: R2-M2b: treewalk always-terminal, import preserved
+			if (store.IsTerminalStage(node.Stage) && false) && len(node.Children) > 0 {

--- FAIL: TestComputeReady_NonTerminalParentIsReady/triage
        treewalk_test.go:71: computeReady returned [] for non-terminal stage triage, want [1]
--- FAIL: .../working  --- FAIL: .../in_review  --- FAIL: .../in_qa  --- FAIL: .../deploying
RESULT: KILLED
```

**Note on mutation validity.** My first two attempts at these used the literal
`if len(node.Children) > 0` / `if false && ...` edits. Both "failed" — but only with
`"internal/store" imported and not used`, a **build error, not a test kill**. I discarded them and
re-ran in a form that keeps the call site referenced. The dev independently hit and reported the
same trap. Any kill claimed from a compile failure would be worthless; both of us caught it.

**The mutation that proves consolidation is real, which neither round 1 nor the dev ran.** Cosmetic
consolidation (calling the function but having the caller not actually depend on it) would pass
R2-M1b. So I mutated the *shared* predicate and checked whether the tree walk feels it:

```
MUTATION: R2-M3: drop StageCancelled from shared IsTerminalStage - does treewalk now feel it?
-	case task.StageCompleted, task.StageWontFix, task.StageDuplicate, task.StageCancelled:
+	case task.StageCompleted, task.StageWontFix, task.StageDuplicate:

--- FAIL: TestPassThroughComputeAvailability_OwnTerminalStageBlocksClaim/cancelled
        terminal_availability_test.go:34: available = true, want false; reasons = []
--- FAIL: TestComputeReady_TerminalParentIsNotReady/cancelled
        treewalk_test.go:49: computeReady returned [1] for terminal stage cancelled, want none; ...
FAIL	github.com/farmtable-io/farmtable/internal/platform/github	0.012s
--- FAIL: TestIsTerminalStage_ClassifiesEveryStage/cancelled
        terminal_availability_test.go:66: IsTerminalStage(cancelled) = false, want true
--- FAIL: TestComputeAvailability_OwnTerminalStageBlocksClaim/cancelled
        terminal_availability_test.go:121: available = true, want false; reasons = []
--- FAIL: TestMultiStoreComputeAvailability_OwnTerminalStageBlocksClaim/cancelled
        terminal_availability_test.go:156: reasons = [], want exactly [terminal]
FAIL	github.com/farmtable-io/farmtable/internal/store	0.082s
RESULT: KILLED
```

A one-stage change to the single source of truth now fails in **five** places across two packages,
including the tree walk. In round 1 the tree walk was silent. That is the finding closed properly —
one predicate, five sites, all bound.

### F2 — closed; the assertion now fails when behaviour breaks

The assertion pins `errors.Is(err, store.ErrAlreadyClosed)`. Proof it is load-bearing — I changed
which error the guard returns:

```
MUTATION: R2-M4: ClaimTask PhaseClosed guard returns ErrUnavailable instead of ErrAlreadyClosed
-			return nil, ErrAlreadyClosed
+			return nil, ErrUnavailable

--- FAIL: TestComputeAvailability_OwnTerminalStageBlocksClaim/completed
        terminal_availability_test.go:136: ClaimTask on completed task: err = task unavailable, want ErrAlreadyClosed
--- FAIL: .../wont_fix  --- FAIL: .../duplicate  --- FAIL: .../cancelled
FAIL	github.com/farmtable-io/farmtable/internal/store	0.030s
RESULT: KILLED
```

This is the right fix, and I want to be precise about why, because it is subtle. The assertion still
does **not** exercise the terminal predicate — with `IsTerminalStage` hardwired false it would still
pass, exactly as in round 1. What changed is that it no longer *claims* to. It now pins real,
specific behaviour (guard ordering: `PhaseClosed` before `computeAvailability`), and the comment
states plainly that the terminal arm is defence-in-depth on the claim path rather than the primary
gate. The terminal coverage comes from `assertTerminalUnavailable` above it, which does kill.

The dev's own M15 makes the same point from the other side — every failure at `:66` and `:121`, none
at `:136`. Diagnosing it that way, rather than papering over it, is the correct engineering call.

---

## Exhaustiveness guard — confirmed working, with a disclosed blind spot

**It genuinely fires.** A stage present in the model but absent from the table fails the test.
I verified by removing a table row, which is equivalent to the guard's perspective on a newly added
stage:

```
MUTATION: R2-M5: remove 'deploying' row from the table
-		{task.StageDeploying, false},

--- FAIL: TestIsTerminalStage_ClassifiesEveryStage
        terminal_availability_test.go:81: stage "deploying" is not classified by this test; add it to the table and confirm IsTerminalStage treats it correctly
FAIL	github.com/farmtable-io/farmtable/internal/store	0.011s
RESULT: KILLED
```

**But it is blind to one path** — see N2. `convert.StageFromProto` ends in
`default: return task.StageTriage`, so a stage added to the proto enum *without* updating the
converter maps to an already-classified stage and the guard stays silent:

```
MUTATION: R2-M6: inject a NEW proto stage that StageFromProto does not map
+	pb.TaskStage_name[99] = "TASK_STAGE_ARCHIVED"
+	defer delete(pb.TaskStage_name, 99)

ok  	github.com/farmtable-io/farmtable/internal/store	0.011s
RESULT: ***SURVIVED***
```

The dev found and disclosed this independently (their M13 note) and responded by doing the
simulation properly — ent enum + converter + proto — rather than reporting the cheap version as a
pass. I confirm their conclusion: the guard defends a *complete* data-model addition, which is the
realistic case, and it works for that. The blind spot is the intermediate state.

---

## Self-built oracle check (standing defect class)

**Clean. No instances in either new test file.**

| Test file | Expectations derived how? | Verdict |
|---|---|---|
| `treewalk_test.go` | hardcoded stage lists as *inputs*; asserts against literal expected node numbers and reason strings; calls the real `computeReady` | Clean |
| `terminal_availability_test.go` | table of `{stage, want}` literals; `store.IsTerminalStage` appears only at line 65 as the *subject* of the assertion | Clean |

Neither file re-implements the predicate to compute an expected value. `store.IsTerminalStage` is
never used to derive a `want`.

**This matters more than it looks.** The obvious "tidy-up" here — deriving `terminalStages` from
`store.IsTerminalStage` instead of hardcoding it — would be exactly the defect class, and would
actively destroy the coverage R2-M3 demonstrates: if the predicate broke for `cancelled`, the driver
list would shrink to match and the availability tests would silently stop testing `cancelled`. The
hardcoding is load-bearing. Anyone reviewing N1 below must not "fix" it that way.

The proto-derived `allStages` helper is not an oracle — it enumerates inputs from the real proto
registry and the real converter. It is duplicated from `transitions_internal_test.go` (N4).

---

## New findings

### N1 — LOW (undisclosed): the `terminalStages` driver list can silently shrink

`internal/store/terminal_availability_test.go:39-45`. Removing a stage from this var causes **no**
test to fail, across the whole store package:

```
MUTATION: R2-M7b: shrink terminalStages driver list, FULL store package (no -run filter)
-	task.StageCancelled,

ok  	github.com/farmtable-io/farmtable/internal/store	1.404s
RESULT: ***SURVIVED***
```

`terminalStages` drives `TestComputeAvailability_OwnTerminalStageBlocksClaim` and
`TestMultiStoreComputeAvailability_OwnTerminalStageBlocksClaim`. Delete a stage and those two tests
quietly stop covering it, in both the EntStore and the masked MultiStore path. The new exhaustiveness
guard protects the `tests` table in `ClassifiesEveryStage` but not this list.

Impact is bounded: the predicate itself stays covered by `ClassifiesEveryStage`, so what erodes is
per-implementation availability coverage — including the MultiStore path where only an exact-reason
assertion catches regressions. It is coverage erosion, not a live bug, and it requires someone to
edit the list. Hence Low.

*Recommended fix — and not the obvious one.* Do **not** derive the list from `IsTerminalStage` (see
above; that reintroduces masking). Instead cross-check the two existing sources against each other:
assert that `terminalStages` contains exactly the stages the `ClassifiesEveryStage` table marks
`want: true`. That keeps the list independent of the function under test while making silent
shrinkage impossible. Roughly five lines.

### N2 — LOW (disclosed by dev, independently confirmed): guard blind to proto-only stage additions

Reproduced above as R2-M6. `StageFromProto`'s `default: return task.StageTriage` swallows an
unmapped proto value. No test anywhere in the repo guards `StageFromProto` exhaustiveness — I
checked (`grep -rn "StageFromProto" --include="*_test.go"` → only the two `allStages` helpers).

Inherited from the pre-existing `transitions_internal_test.go` idiom the dev deliberately mirrored,
so this is not newly introduced, and the same blind spot exists in the server package today.

*Recommended fix:* harden `allStages` — if the proto name is not `TASK_STAGE_TRIAGE` but
`StageFromProto` returned `StageTriage`, the value is unmapped; fail. Apply to both copies. Worth a
small follow-up ticket covering the shared idiom, not this PR.

### N3 — INFO: `TestWatchTasks_*` flake is pre-existing; dev's analysis confirmed

I did not take this on trust. Three full-suite runs with cleared cache on each of branch and base:

| | run 1 | run 2 | run 3 |
|---|---|---|---|
| **Branch `d7314cf`** | ALL PASS | `TestWatchTasks_ClaimEvent` timeout | `TestWatchTasks_NoInitial`, `..._CreatedEvent` timeout |
| **Base `d5db8c4`** | ALL PASS | `TestWatchTasks_ClaimEvent` timeout | `TestWatchTasks_NoInitial` timeout |

Identical failure rate (2/3 both), same tests, same 5.01s hard timeout, different test each run.
Pre-existing timing flake under parallel load, unrelated to this diff. The dev's characterisation is
accurate. Should be its own ticket — a 5s fixed deadline on a streaming assertion will keep doing
this.

### N4 — INFO: `allStages` duplicated across two test packages

Identical helper in `internal/store/terminal_availability_test.go` and
`internal/server/transitions_internal_test.go`. Cross-package test helpers are awkward to share in
Go and the dev documented the mirroring, so this is acceptable — but if N2 is fixed, both copies
need it, which is precisely the hazard duplication creates.

---

## Full mutation ledger (round 2, all my own runs)

| # | Target | Mutation | Result |
|---|---|---|---|
| R2-M1 | `treewalk.go` | drop check literally | *invalid — build error, discarded* |
| R2-M2 | `treewalk.go` | invert literally | *invalid — build error, discarded* |
| R2-M1b | `treewalk.go` | neutralise, import preserved | **KILLED** — `..._TerminalParentIsNotReady`, 4/4 stages |
| R2-M2b | `treewalk.go` | always terminal, import preserved | **KILLED** — `..._NonTerminalParentIsReady`, 5/5 stages |
| R2-M3 | shared `IsTerminalStage` | drop `StageCancelled` | **KILLED** — 5 tests, 2 packages, incl. treewalk |
| R2-M4 | `ClaimTask` guard | return `ErrUnavailable` | **KILLED** — `:136`, 4/4 stages |
| R2-M5 | exhaustiveness table | remove `deploying` row | **KILLED** — guard fires by name |
| R2-M6 | proto enum | inject unmapped stage | **SURVIVED** → N2 (disclosed) |
| R2-M7b | `terminalStages` var | drop `cancelled` | **SURVIVED** → N1 (undisclosed) |
| R2-M8 | `multistore.go` | drop terminal-stage arm (r1 M2) | **KILLED** — `reasons = [], want exactly [terminal]` |
| R2-M9 | `multistore.go` | drop `PhaseClosed` arm (r1 M3) | **KILLED** — `..._ClosedPhaseIsTerminal` |

R2-M8/M9 are regression checks: round 1's two masked paths — where `Available` is already `false` and
only an exact-reason assertion can catch the break — are still correctly pinned after the r2 edits.

---

## Verification performed

```
go build ./...                                                  exit 0
go test ./...                                                   green (modulo N3 flake)
go test <3 pkgs> -count=2 -race                                 ok (store 6.2s, github 1.2s, server 7.8s)
gofmt -l <4 touched files>                                      clean
go vet ./internal/store ./internal/platform/github ./internal/server
                                                                4 findings, ALL pre-existing
                                                                (same 4 on base d5db8c4 — verified)
git status --short                                              clean before/after every mutation
```

`-count=2 -race` confirms the new `treewalk_test.go` tests are order-independent and repeat-safe;
`parentWithClosedChild` builds a fresh graph per call with no shared state.

Integration tests (`-tags integration`) not run — no live Postgres. Unchanged from round 1: the
predicate is pure Go over an in-memory struct field, no dialect surface.

Temporary probe artefacts: none left. All mutations reverted via `git checkout`; tree clean at
`d7314cf`.

---

## Severity summary

| Severity | Finding |
|---|---|
| Critical / High | none |
| Medium | none |
| **Low** | **N1** — `terminalStages` driver list shrinks silently (undisclosed; fix must not derive from the predicate) |
| **Low** | **N2** — exhaustiveness guard blind to proto-only additions (disclosed; shared with pre-existing idiom) |
| Info | N3 — pre-existing `TestWatchTasks` flake, confirmed equal on base |
| Info | N4 — `allStages` duplicated across two test packages |

**APPROVE.** Round-1 F1 and F2 are closed with real mutation evidence. N1 and N2 are coverage-erosion
hazards, not defects, and belong in a small follow-up together with the shared `allStages` idiom.
