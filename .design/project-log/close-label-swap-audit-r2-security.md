# #194 close-label-swap — round-2 security audit

**SHA:** `9f98ad8` · **Range:** `c1ec1ba..9f98ad8` (7 commits) · **Date:** 2026-07-28
**Verdict: REQUEST CHANGES** — 2 High, 2 Medium, 3 Low, 1 Info.
Full report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-194-r2.md`

## Outcome

F1, #198 and the F5 logging all pass. **F2 (`0b87721`) does not.** The five read-only checks
that cleared it missed two consumers, both found and both reproduced by execution. The external
disclosure resting on the F2 ruling must be voided.

## The two blocking findings

**1. [HIGH] Privilege downgrade.** `UpdateTask` derives its required scope from
`existing.Stage` (`server.go:537`), and `transitions.go:94-99` requires `task:accept` to leave a
terminal stage. F2 rewrites that stage to `accepted` before the gate reads it, so every
reopen-shaped transition now needs only `task:write`. Verified at `9f98ad8`, and the pre-F2
baseline verified at `a70d3d1` to confirm the regression is new:

```
dest=in_review  pre-F2 required=task:accept  post-F2 required=task:write
```

This is the same laundering the transition table already blocks for triage
(`transitions.go:86-88`) — F2 opens it for terminal by rewriting the source stage.

**2. [HIGH] Ready queue over-reports; "fail-safe" is false.** The `GetReadyTasks` RPC does not use
the tree walk for GitHub collections — `resolveGraphRoute` sends them to an ephemeral EntStore
(`server.go:1489`) loaded via `ListTasks`, which applies the demotion, and copies `Stage` verbatim
(`graph_routing.go:140`). `EntStore.GetReadyTasks` selects `stage == accepted`, so a wont_fix issue
is recommended as ready work:

```
IssueToPhaseStage(OPEN, wont_fix) = phase=open stage=accepted
READY QUEUE CONTAINS: "abandoned-wontfix-issue" (stage=accepted)
```

The dev's directional argument only considered `passthrough.GetReadyTasks`, which under-reports.
The path users actually hit over-reports.

Root cause common to both: **a field GitHub labels can rewrite is used for authorization and for
scheduling.** Recommend splitting display stage from authoritative lifecycle stage.

## Also found

- **[MEDIUM]** Stage labels match bare/unprefixed (`labels.go:95`), so GitHub's **stock `duplicate`
  label** on an open issue is now demoted to `accepted` and becomes claimable.
- **[MEDIUM]** `TestComputeReady_OpenTerminalLabelledIssueIsNotReady` (`reopen_test.go:187`) is
  tautological — `computeReady(nodes,false)` cannot return a non-accepted stage. Teaching
  `buildIssueTree` the symmetric rule (the change its own message says should fail it) leaves the
  **whole package green**. The divergence is not actually pinned.
- **[LOW]** `reopen_test.go:213` unfalsifiable `&&`, meant `||`; no `-race` in `Makefile`;
  `concurrency_test.go:90` near-vacuous and `cachedRepoID()` untested.
- **[LOW]** Logging: **no credential can leak** (token confined to `oauth2.Transport`; all error
  shapes traced). Residual is private repo slugs to a shared multi-tenant stderr sink.

## Mutation results (8 run, all restored)

M1 over-broad demotion **KILLED** · M2 closed-branch demotion **KILLED** ·
M3 `closed := !open` **KILLED** · M4 `open := !closed` **KILLED** ·
MUT-X unlocked read + double-check **SURVIVES** (matches dev §6 exactly) ·
MUT-Y + re-publication **KILLED, DATA RACE** · MUT-Z pre-#198 shape **KILLED, 8× DATA RACE** ·
MUT-T teach tree walk symmetric rule **SURVIVES** → finding above.

## #198 verified

Brief said nine call sites; the real count is **15**. The count is wrong, the claim is right —
all 15 are dominated by `ensureLabelIndex` on the same goroutine (CreateTask 3 @:332;
UpdateTask 8 @:418/435/452/469/478; ClaimTask 2 @:618; CloseTask 2 @:717). `cachedRepoID` is
dominated by `ensureRepoID` @:329; `collectionID` is constructor-only, correctly unguarded.
Surviving mutant is explained, not a gap. Keeping the `RLock` is correct.

## Process

Review clone never mutated — all mutation work in a disposable `/tmp` worktree, restored and
tree-hash-verified after each. Audit clone, mutation worktree and dev clone all at tree
`d6883ce5…`. No botched restore.

Note: the dispatch said to run `git rev-parse` in `/workspace`, which is not a repo but the parent
of ~159 clones. Verified `/workspace/farmtable-audit-194` = `9f98ad8` instead.
