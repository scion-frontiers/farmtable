# Round-2 Re-review — Issue #191, `terminal-predicate-r2` @ d7314cf

**Reviewer:** independent code review (same reviewer as round 1)
**Base for this pass:** `d5db8c4` (round-1 HEAD) → `d7314cf`, 3 commits, 5 files, +232/−8
**Dev report read:** `dev-terminal-predicate-r2.md` — verified independently, not ratified

---

## Verdict: APPROVE

Both round-1 findings I raised are **genuinely closed**, not papered over — I confirmed each
by re-running my own pre-registered mutations rather than reading the dev's transcript. My
round-1 acceptance criterion for finding 2 (mutation M8) flipped from SURVIVED to KILLED
exactly as pre-registered.

Two new findings, both Medium and both non-blocking: one factual inaccuracy in a comment
added by r2, and one residual hole in the new exhaustiveness guard that the dev partly
identified themselves. Neither affects behaviour. Recommend merge with a follow-up.

---

## Round-1 finding status (explicit, per item)

| # | Round-1 finding | Severity then | Status |
|---|---|---|---|
| R1-1 | `treewalk.go:104` fifth hand-copy, never enumerated | Important | **CLOSED** |
| R1-2 | `TestIsTerminalStage_ClassifiesEveryStage` not exhaustive | Important | **CLOSED** |
| R1-3 | Move `IsTerminalStage` from `entstore.go` to `store.go` | Suggestion | **NOT CLOSED** |
| R1-4a | Doc overclaim: "single source of truth for the terminal arm" | Suggestion | **CLOSED** |
| R1-4b | Doc does not disambiguate from `terminalStageSatisfiesDependency` | Suggestion | **NOT CLOSED** |
| R1-4c | Named consumer roster will go stale | Suggestion | **PARTIALLY CLOSED** (and materialized — see M-3) |

### R1-1 — CLOSED

`treewalk.go:105` now reads `if !store.IsTerminalStage(node.Stage) && len(node.Children) > 0`.
Behaviour-identical to the hand-copied disjunction: `IsTerminalStage` returns true for exactly
the four stages the old expression tested. The `!hasOpenChildren` / `includeUnblocked` /
`!= StageAccepted` conditions are untouched.

I re-ran the mutations myself rather than accept the dev's transcript:

- **M11** (predicate never terminal, import kept live so it compiles):
  KILLED by `TestComputeReady_TerminalParentIsNotReady`.
- **M12** (predicate always terminal): KILLED by `TestComputeReady_NonTerminalParentIsReady`.

In round 1 M11 survived the entire `internal/platform/github` suite. It no longer does. The
dev's point that consolidating an untested line "only moves it" is correct and is the right
framing — the coverage was the valuable half.

`TestComputeReady_AcceptedTakesTheAcceptedBranch` is a good addition nobody asked for: it pins
that `StageAccepted` is excluded from the `includeUnblocked` arm because it is handled
earlier, not because it is terminal. That distinction is exactly the kind of thing a future
refactor would collapse.

Import is per-file, so adding `internal/store` to `treewalk.go` was required even though
`passthrough.go` already had it. No cycle; `go build ./...` exit 0.

### R1-2 — CLOSED, verified against my pre-registered criterion

In round 1 I pre-registered mutation **M8** (delete the `{task.StageCancelled, true}` row from
the classification table) as the acceptance test, recording that it SURVIVED at `d5db8c4` and
"must flip to KILLED" for the fix to count.

**Result at `d7314cf`: M8 KILLED**, by `TestIsTerminalStage_ClassifiesEveryStage`. Full battery
re-run at r2: M1–M7 KILLED (unchanged), M8 KILLED (flipped). The `allStages` helper is the
proto-derived pattern from `transitions_internal_test.go`, ported faithfully, and the coverage
loop is placed after the table as recommended.

The dev's own M13 — simulating a real data-model addition across ent + validator +
`StageFromProto` — is a more thorough demonstration than I asked for, and their note about
*why* the cheap simulation fails is a genuine finding, not an excuse. See M-2 below, where I
take it further.

### R1-3 — NOT CLOSED

`IsTerminalStage` is still at `internal/store/entstore.go:1093`. This was a Suggestion and was
not in the EM's r2 task list, so this is a note rather than a complaint. Still worth doing:
the function is cross-package API and `store.go` already holds `AvailabilityReason`,
`TaskAvailability`, and the `Store` interface. Pure move, no behaviour change.

### R1-4a — CLOSED, and the correction is accurate

The new text at `entstore.go:1075-1087` says `IsTerminalStage` is the source of truth for the
**stage half** of the rule, that sites reach it through the function rather than restating the
stage set, and that callers may legitimately test more — naming MultiStore's `PhaseClosed` arm
and the tree walk's sub-issue check, with an explicit warning not to simplify a site to a bare
call.

I verified each claim against the code:

- "every availability implementation ... reaches it through this function rather than
  restating the stage set" — **true**. `grep` for `IsTerminalStage(` returns exactly five
  non-test callers, and no availability site restates the four stages.
- "MultiStore's fallback ORs in a PhaseClosed arm" — **true**, `multistore.go:250`.
- "the GitHub tree walk pairs it with a sub-issue check" — **true**, `treewalk.go:104-105`
  (`!hasOpenChildren` plus `len(node.Children) > 0`).

The specific thing I flagged in round 1 — that a reader could conclude MultiStore's
`PhaseClosed` arm is redundant and delete it — is now explicitly guarded against.

---

## New findings

### M-1 (Medium, non-blocking) — `internal/store/terminal_availability_test.go:124-127`: "unreachable through ClaimTask" is not accurate

The comment added by `3bef89c` states:

> EntStore's terminal availability arm is unreachable through ClaimTask in normal operation.

**This is demonstrably false at the store layer.** `EntStore.UpdateTask` (`entstore.go:807-830`)
sets `Phase` and `Stage` from independent pointers with no coupling, so a task can hold a
terminal stage while `Phase` is still open. I probed that state directly:

```
after update: phase=open stage=completed
availability: available=false reasons=[terminal]
ClaimTask -> ErrUnavailable   == TERMINAL ARM IS REACHABLE
```

The `PhaseClosed` guard at `:1197` does not fire, `computeAvailability` at `:1201` runs, the
terminal arm produces the sole reason, and `ClaimTask` returns `ErrUnavailable` **because of
the terminal arm**. So the arm is reached, and in that state it is the gate the comment says
it is not.

**But the comment's practical conclusion is still right, for a reason it does not mention.**
Chasing this, I found a third layer the analysis misses: `ClaimTask`'s CAS update carries
`task.StageEQ(task.StageAccepted)` (`:1221`), and the `n == 0` recheck at `:1263` returns
`ErrUnavailable` for any task whose stage is not `accepted`. A terminal task is therefore
blocked on the claim path by three independent layers:

| Layer | Location | Fires when |
|---|---|---|
| 1. `PhaseClosed` guard | `:1197` → `ErrAlreadyClosed` | task was closed via `CloseTask` |
| 2. availability terminal arm | `:1201` → `ErrUnavailable` | terminal stage, phase still open |
| 3. CAS `StageEQ(accepted)` + recheck | `:1221`, `:1263` → `ErrUnavailable` | always |

So the accurate statement is not "unreachable" but **"reachable, yet never load-bearing on the
claim path, because layer 3 blocks independently of it."** That is a stronger and more useful
claim than the one in the comment.

**I tested my own proposed fix and it does not work — reporting that rather than recommending
it.** My instinct was to add a claim-path case for terminal-stage-with-open-phase asserting
`ErrUnavailable`, to make the assertion non-vacuous. I wrote it: it passes unmutated, and it
**still passes with `IsTerminalStage` hardwired to false**, because layer 3 catches the claim
and returns the same error. It is exactly as vacuous as the assertion the dev replaced. This
**vindicates the dev's judgement**: no claim-path assertion can be made non-vacuous for the
terminal arm, which is precisely why pinning `ErrAlreadyClosed` and documenting the situation
was the right call. Their M15 evidence (kills at `:66`/`:121`, never at `:136`) is reproduced
and correct.

**Suggested fix — comment only, no code change:**

```go
// ClaimTask rejects here on its PhaseClosed guard, which runs BEFORE
// computeAvailability, and CloseTask set PhaseClosed. So this pins
// ErrAlreadyClosed, not ErrUnavailable.
//
// The terminal arm is reachable on this path — UpdateTask sets Phase and
// Stage independently, so a terminal stage with an open phase does reach
// computeAvailability and returns ErrUnavailable — but it is never
// load-bearing here: the CAS update's StageEQ(StageAccepted) predicate
// (and the n==0 recheck) blocks any non-accepted stage regardless. That is
// why no claim-path assertion can be made non-vacuous for this arm, and why
// this one pins a specific error instead of `err != nil`.
//
// The arm still matters: ComputeAvailability is exposed directly for
// availability display and over the API, which is what the assertion above
// covers.
```

Why Medium rather than Low: the comment is guidance about whether a gate on a two-phase
load-bearing invariant can be weakened, and it states the enforcement model incorrectly. Why
non-blocking: no behavioural defect, and the operative advice ("don't simplify it away") is
correct.

### M-2 (Medium, non-blocking) — the new exhaustiveness guard has a residual hole; a 5-line addition closes it

The dev correctly identified that `convert.StageFromProto` has `default: return task.StageTriage`
(`internal/convert/convert.go:45-46`), so an unmapped proto stage silently becomes an
already-classified stage. They treated this as a reason the *simulation* had to be thorough. It
is also a hole in the *guard itself*, which I do not think was followed through.

`allStages` catches a new stage only if proto, `StageFromProto`, and the ent enum are all
updated together. If `StageFromProto` is missed — the easiest of the three to forget, since
nothing else fails loudly — the new stage never appears in `allStages`, the coverage loop stays
silent, and `IsTerminalStage` returns false for it. That is the original finding-2 failure mode
surviving in a narrower form.

This is an inherited limitation of the pattern **I recommended** in round 1, not something the
dev introduced — `transitions_internal_test.go` has it too. But it is cheap to close, and this
is the copy guarding the load-bearing invariant.

**Suggested fix**, inside `allStages`. I verified it both directions: passes today
("injective over 10 stages"), and catches a simulated proto-only addition —
`proto stages TASK_STAGE_TRIAGE and TASK_STAGE_ARCHIVED both map to "triage"`:

```go
seen := make(map[task.Stage]string, len(pb.TaskStage_name))
// ... inside the loop, after StageValidator:
if prev, dup := seen[stage]; dup {
    t.Fatalf("proto stages %s and %s both map to task stage %q; StageFromProto is "+
        "probably missing a case and falling through to its default, which would "+
        "hide the new stage from every caller of allStages", prev, name, stage)
}
seen[stage] = name
```

### M-3 (Low) — `entstore.go:1077-1080`: the named roster went stale inside this PR

Round-1 Suggestion 4c warned that enumerating consumers by name would go stale. It did, within
the same branch. The doc says "every availability implementation (EntStore, MultiStore's
fallback, the server's basic projection, and the GitHub pass-through store) reaches it through
this function" — four names, while commit `4361390` added a fifth caller in the same PR, and
the design log's own site table classifies that fifth site as **"availability"**.

The substantive claim (nobody restates the stage set) remains true, and paragraph 2 does mention
the tree walk, so a reader is not badly misled. But an enumeration introduced by "every ... (list)"
should either be complete or not be a list. Suggest dropping the parenthetical.

### M-4 (Low) — R1-4b still open: nearest-neighbour confusable undocumented

The third paragraph still disambiguates only from `CloseTask`'s close-target check and
`phaseForStage`. `terminalStageSatisfiesDependency` sits ~20 lines above at `entstore.go:1071`,
shares the word "terminal", and means something entirely different (only `StageCompleted`
satisfies a dependency). That is the collision a reader actually hits. One clause would fix it.
`server/transitions.go:27`'s `stagesTerminal` is a second such neighbour.

---

## Independent verification

| Check | Result |
|---|---|
| `go build ./...` | exit 0 |
| `gofmt -l` on all 4 touched Go files | clean |
| `go vet` on the 3 touched packages | 4 findings, all pre-existing in untouched `server.go` |
| `go test ./internal/store/ ./internal/platform/github/ -count=1` | both `ok` |
| Mutation battery M1–M8 | M1–M7 KILLED (unchanged), **M8 flipped SURVIVED → KILLED** |
| M11, M12 re-run independently | both KILLED |
| Working tree after all mutations | clean |

### Pre-existing flake — dev's claim verified, and they understated it

`TestWatchTasks_*` timeouts under full-suite load. I did not take this on trust: I created a
worktree at the **base commit `d5db8c4`** and ran the full suite three times.

**Base failed 3/3 runs** (1, 2, and 2 `TestWatchTasks` failures respectively). On r2,
`./internal/server/` alone failed 1 of 3 runs and passed the other 2. The failing tests wait on
a hard 5s streaming deadline and lose under parallel load.

This is pre-existing and unrelated — the only file this PR touches outside the store/github test
paths is a doc comment. The dev's reported base rate (2/5) is if anything *lower* than what I
measured. They ran it down instead of reporting green, which is the right call. Recommend a
separate issue to deflake; out of scope here.

### Scope

`git diff --name-only d5db8c4..HEAD` = 5 files, zero under `web/`. No rebase, no Phase 2
commits. The four genuine LEAVE sites (`CloseTask`, both `phaseForStage`, both `export_import`
enumerations) are untouched, as are `transitions.go:27` and the out-of-scope pass-through
defects. Nothing swept in.

---

## What's done well

- **The dev refused two easy dishonesties.** They reported that the literal M11 edit produces a
  compile error rather than a kill, and re-applied it in a form that isolates the predicate —
  "it would be dishonest to report it as one" is exactly right, and a compile error masquerading
  as a mutation kill is a real way these exercises go wrong. Separately, they ran down the
  `TestWatchTasks` flake with a 4-condition comparison table instead of reporting green.
- **M15's line-number argument is the sharpest thing in the r2 report.** Showing that failures
  land at `:66` and `:121` and *never* at `:136` proves the `ClaimTask` assertion's vacuity from
  the inside. That analysis was correct and I reproduced it.
- **M12 was added unprompted** because M11 alone is satisfiable by "return no results" — the
  same both-directions discipline the round-1 tests showed. The `AcceptedTakesTheAcceptedBranch`
  test shows the same instinct.
- **The `StageFromProto` default discovery** is a genuine finding the dev surfaced against their
  own work, when the easy path was to run the cheap simulation, watch it not fire, and quietly
  adjust. M-2 above is a direct extension of their observation.
- **The design log entry explains the CONSOLIDATE-vs-LEAVE call rather than just recording it**
  ("It asks the same question as availability and merely packages the answer as a `readyResult`
  … packaging is not concept"). That is the reasoning round 1 said was missing, and it is now
  the strongest paragraph in the log.

---

## Recommendations (all follow-up, none blocking)

1. **M-1** — correct the "unreachable" comment; document the CAS `StageEQ(accepted)` layer.
2. **M-2** — add the injectivity check to `allStages` (verified both directions).
3. **M-3** — drop the stale parenthetical roster from the doc comment.
4. **M-4** — one clause disambiguating `terminalStageSatisfiesDependency`.
5. **R1-3** — move `IsTerminalStage` to `store.go`.
6. Separate issue for the `TestWatchTasks` flake (pre-existing, reproduced on base 3/3).
