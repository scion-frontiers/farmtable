# #194 close-label-swap — round-4 code review (independent leg)

Reviewed `03ab6b6` (parent `651da26`). Production delta is `internal/platform/github/labels.go`
and `internal/platform/github/passthrough.go` only; everything else is tests.

**Verdict: REQUEST CHANGES.** Full report:
`/scion-volumes/scratchpad/projects/farmtable/reports/review-194-r4.md`.

## What round 4 got right

`TerminalLabelStage`'s direct scan, its deterministic tiebreak, and the added
`!m.enabled` guard are all correct for the function they change. The guard is genuinely
load-bearing — `NewLabelMapper` populates `labelToStage` regardless of `Enabled`
(`labels.go:133-148`), so it can no longer be inherited from `MapLabelsToStage` — and the
symmetry argument behind declining rather than scanning holds: with mapping off,
`IssueToPhaseStage` also declines, so there is no demotion to undo.

`TestTerminalLabelStage_DisabledMapperDeclines` asserts that *premise* rather than the
conclusion, with an enabled control. The schema-disclosure blocks
(`terminal_label_stage_test.go:64-70`, `authz_terminal_reopen_test.go:324-342`), including
the volunteered admission that four `triage`-mask cells pass for the wrong reason, are the
right answer to "a count pin must state what its rows cannot express."

## Gate (each exit code from the child process, not through a pipe)

    go build ./...   rc=0
    go test ./...    rc=0, 0 failures
    make race        rc=0, 0 data races
    go vet ./...     rc=1, exactly 4 pre-existing copies-lock findings, all in
                     internal/server/server.go (:1516 :1626 :1834 :2011)

Agrees with the coordinator's own measurements exactly. No disagreement.

## Blocking findings

**C1 — `ft ready` still schedules terminal-labelled work (Critical).**
`GetReadyTasks` on the pass-through store goes `buildIssueTree` → `MapLabelsToStage`
(`treewalk.go:36`) → `computeReady`, which asks terminal-ness of the *precedence-collapsed
winner* at `treewalk.go:105` and `== StageAccepted` at `:92`. `TerminalLabelStage` is not
on that path. Measured: 7 of 12 label sets bypass; every cardinality-1 row passes, which
is exactly why the shipped fixture cannot see it — `openParentWithClosedChildIssues`
(`reopen_test.go:252`) still takes a single label *string*, the same fixture defect the
round-4 authz tests were rewritten to eliminate.

Two comments assert the opposite. `passthrough.go:815-816`, new in this diff, points at
`GetReadyTasks` as the reason the availability arm's insufficiency is acceptable — and
`GetReadyTasks` applies the bypassable filter. `treewalk_test.go` (from `4ea2fc8`) says
outright "Different mechanisms, same outcome: an OPEN issue carrying a terminal label is
never scheduled." That sentence is false. It is the workstream's recurring defect — a
property true of one consumer stated as if true of all — the same defect this diff
corrects one instance of.

Overlaps disclosed item #202, but #202 reads as plumbing consistency; measured it is a
live bypass, and it is not fixed by the round-5 `add_labels` control either.

**R1 — the new tiebreak fails open (Required).** `labels.go:517-525`: a stage that
`IsTerminalStage` accepts but `terminalStagePrecedence` does not rank is dropped and
reported `("", false)`. Proven by removing `StageCancelled` from the list: an unmasked
`ft:stage/cancelled` became invisible to the gate. `MapLabelsToStage` has a fallback for
this case (`:213-216`); the security-critical function does not. Fix: fail closed —
if `present` is non-empty, return a deterministically chosen member.

**R2 — every new pin is vacuous under an enum addition (Required).** All four pins iterate
`allStages`, a hand-maintained slice in production code (`labels.go:65`) that nothing pins
against the enum. Adding a tenth terminal stage to `task.Stage` + `IsTerminalStage` and
forgetting the three github-package lists leaves the whole package green, while
`MapLabelsToStage` sees the stage and `TerminalLabelStage` does not — the #194 inversion,
reintroduced. The repo already has the right pattern in
`internal/server/transitions_internal_test.go:13` and
`internal/store/terminal_availability_test.go:20`, both deriving from `pb.TaskStage_name`.

**R3 (Required).** `fixtureStages()`'s comment claims a derivation it does not perform;
four stage lists in that file are hand-maintained.

## Outside view on the `terminalStagePrecedence` decision

The dev's decoupling argument is correct — two questions want two declarations, and the
`stagePrecedence` guard test deliberately leaves the order *among* terminals unpinned, so
filtering really would leave a privilege answer riding on a display reorder.

But the cost he accepted is not the cost he described. The completeness pin does not cover
the likely miss (R2), the consequence of a miss is a fail-open (R1), and filtering
`stagePrecedence` would have had the *identical* hole, because that list is hand-maintained
and pinned against `allStages` too. The safety difference between the two designs is zero;
the debate was about coupling, which is maintainability, not safety.

The move that resolves it is R1: make the tiebreak total by construction. Then list
completeness stops being a safety precondition, and the second list is unambiguously right
for the reason the dev gave, rather than despite it. Keep `terminalStagePrecedence`.

## Method

Two content-addressed mutations (anchor uniqueness asserted, abort otherwise), backups
outside the repo, restored and verified both by an empty `git status --porcelain` and by
positively re-asserting the restored property. No production code modified in this commit.
The cardinality probe is salvaged as a real file at
`/scion-volumes/scratchpad/projects/farmtable/salvage/review194r4_treewalk_cardinality_probe_test.go`;
it carries a fail-closed harness self-check so its negative rows cannot be vacuous.

Limit disclosed: C1 was proven at `buildIssueTree`/`computeReady`, not driven through the
gRPC `GetReadyTasks` RPC end to end. The remainder of the chain was read, not executed.
