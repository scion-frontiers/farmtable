# Label Write Scope R9 (#194 round 9)

Date: 2026-07-28
Role: Developer (fix leg)
Branch: `label-write-scope-r9`
Workspace: `/workspace`
Base: `158c8ae963faa5eef032e0857ecbc40d6a7c681a`
HEAD: `3675bb9`
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/dev-194-r9.md`

## Summary

Round 9 closed the four MUST items from the three-way review, plus a fifth added
mid-round by coordinator ruling, plus the four SHOULD items. No redesign: round 8's
central fix (`RestrictLabelWriteToSnapshot` deriving from `applyLabelDelta`) was
verified correct by two independent legs and was not touched.

One new finding is **OPEN and escalated, not fixed** — see the last section.

## Commits

| commit | item |
|---|---|
| `49c1c7e` | MUST 1 — server-layer pin for C-1 |
| `94c0aa9` | MUST 2 — the P2 probe drives P2 instead of a copy of P2 |
| `058a973` | MUST 3 — P3 (verbatim snapshot spelling) + an end-to-end row |
| `a08addc` | MUST 4 — the `removeKeys` belt's rationale replaced by a proof, made observable by P4 |
| `794bdce` | MUST 5 — lifecycle-label authority follows the enabled toggle; config validation ignores it |
| `3675bb9` | S1–S4 — startup banner, `stageWritePolicy` type, `allStages` pin |

Not pushed, per project policy.

## Verification

Child-process exit codes, no pipes.

- `go build ./...`: **0**
- `go test ./...`: **0**, zero FAIL lines
- `go vet ./...`: **1**, exactly the four pre-existing copylocks at
  `internal/server/server.go:1782/1892/2100/2277`, messages and line numbers
  identical to the baseline
- `git status --porcelain`: **empty**
- `gofmt`: every file touched this round is clean

`TestWatchTasks_ClosedEvent` and `_Heartbeat` appeared on one full-suite run. Scored by
NAME: the streaming path is outside the blast radius of every change in this round. Four
targeted `-run TestWatchTasks` runs and the next full run all returned exit 0. Recorded
as the known ~8%/run flake, not a regression.

## What changed, and what each change is worth

**MUST 1.** C-1 — the round-8 Critical — was pinned in exactly one file. Restoring the
round-7 implementation *and* neutering the two property oracles left `go test ./...` at
exit 0: the Critical shipped green. It now has a server-layer pin over the real gate and
real write path, with a PRESENT-snapshot twin that kills the tempting wrong fix ("drop
both lists on collision"). *Correct and backstopped are different claims.*

**MUST 2.** The probe guarding P2 never called `RestrictLabelWriteToSnapshot` and never
called `restrictProperties` — it hand-reimplemented P2 and checked the copy against
itself. P2's body is now `p2Violations`, called from both places. **When a control's
contract is "mirrors F", the oracle must BE F.**

  The extraction alone did not meet the bar, and this was measured: with the probe still
  driving identity, deleting P2's C-1 arm left the package at exit 0, because identity's
  output trips two arms at once and the A-4 arm masked the C-1 arm. **Under a probe that
  asks only "did something object?", overlapping arms hide each other.** The probe is now
  a table of five broken restrictors, each tripping exactly one arm, each asserting on
  the violation text, with two negative rows so an over-eager `p2Violations` cannot pass.

**MUST 3.** Round 8's snapshot-spelling fix had zero coverage. **P1 and P2 both compare
through `labelMatchKey` = `ToLower(TrimSpace(raw))`, and caller vs snapshot spelling can
differ only in case and padding — exactly what that oracle erases.** The 8192-triple sweep
was scaling on an axis its oracle could not see. *Ask what your oracle can discriminate
before asking what your inputs vary.* Fixed with P3 (raw verbatim membership), a named
padded row, an end-to-end server test that asserts the DENIAL first, and a second snapshot
spelling in the sweep vocabulary.

**MUST 4.** The belt's stated hazard cannot occur: `applyLabelDelta` keeps the first
occurrence of each key, so `keys(S) \ keys(after) ⊆ keys(R)` unconditionally. The clause
stays — this function *derives from* `applyLabelDelta` rather than mirroring it — but the
comment now carries the proof and the measurement instead of the story. Property P4 is what
makes the belt observable at all: before it, deleting the belt under a mutated
`applyLabelDelta` produced byte-identical output, so the rationale was **unfalsifiable**.
The comment says so, and says that deleting P4 would make it unfalsifiable again.

**MUST 5** (added by ruling: `enabled=false` removes lifecycle-label *authority*, not merely
*writes*). The two halves resolve in opposite directions, which was the item's main risk:

- **(a) runtime authority respects the toggle.** `authorizationStage` gains the `!m.enabled`
  guard its siblings already carry. **Honestly: unobservable through any production path
  today** — every privilege-reaching caller already short-circuits, and adding it changed no
  existing test. It is there so the *next* caller inherits the rule instead of having to know
  it, and one new unit test is the only thing enforcing it.
- **(b) config validation ignores the toggle.** `checkLifecycleKeyCollisions` builds its
  oracle from the mapper this config *would* produce with labels enabled. Three defects closed:
  the missing `m.labelToStage` merge (stage aliases escaped), the toggle itself (`StageToLabel`
  returns `""` when disabled, collapsing the oracle), and F-4 (that collapse fabricated an error
  naming stage `"cancelled"`). `enabled=true` and `enabled=false` now produce byte-identical
  verdicts *and* diagnostics across 15 config shapes. The newly-rejected list is in the report.

**S1–S4.** A stale test cross-reference; `loadGitHubConfig` extracted so the startup banner
is drivable by a test; `stageWritePolicy` from named `bool` to one-field struct, keeping
`stageWriteForbidden` as the zero value *by construction*; `allStages` pinned against the
proto enum.

## Findings recorded rather than claimed

- **S4 is a legible pin, not new detection.** All three `allStages` mutants were already
  killed by other tests.
- **`StageToLabel`'s fallback really is dead code** — re-measured, panic in the branch leaves
  the suite at exit 0. It is still not deletable (it keeps the function total), and my own S4
  test does not kill that mutant either.
- **A determinism test I wrote could not fail** and was rewritten. The merge is order-
  independent both shipped and mutated, so the claim was a green control by construction.
  The which-stage assertion that replaced it is what actually kills the mutant.
- **Two predictions missed** on the `labelToStage`-merge mutant, recorded in `794bdce`.
- **The ruling's "CHECKED, clean" control is accurate** — all three label swaps short-circuit
  on `!m.enabled`, so guarding `assertStageWriteAllowed` opens no escalation.

## Brief errors

Two, plus one incomplete diagnosis. Enumerated in the report; the load-bearing one is that
the ruling's prescribed fix for `checkLifecycleKeyCollisions` (merge + empty-key guard) is
necessary but not sufficient — `StageToLabel` has its own `!m.enabled` guard, which is the
*root cause* of F-4, and without addressing it every `enabled=false` diagnostic names the
colliding label as `""`. The brief's line references were accurate this round, which is new.

## OPEN — escalated, not fixed

Caller-supplied `add_labels` at `server.go:840-860`, priced via
`store.LabelDeltaLifecycleStages`, **prices nothing when `github.labels.enabled=false`**.

```
enabled=true   add ft:stage/completed with task:write -> PermissionDenied (task:close); labels stay [bug]
enabled=false  add ft:stage/completed with task:write -> nil; labels now [bug ft:stage/completed]
                                       AFTER FLIP-ON: stages = [completed], available = false
```

A bare `task:write` holder durably writes a lifecycle label while the toggle is off. GitHub does
not know about the toggle. When an operator later flips `enabled: true` — a config change nobody
would treat as a privilege grant — that label becomes authoritative and terminal with no
transition scope ever charged, and reversing it costs `task:accept`. `ErrEmptyLifecycleStageSet`
does not save it: with the mapper disabled the gate is never reached, rather than reached and
refused.

This is the mirror image of ruling half (b) — a durable write governed by a flippable toggle.
Reproduction saved at `/tmp/mut/repro_disabled_toggle.go.txt`; it needs only the
`newLabelWriteFixtureWithConfig` helper committed in `794bdce`. Left for the next round per
instruction.
