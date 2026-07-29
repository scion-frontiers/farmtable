# Security Audit Report — #194 `close-label-swap`, round 2

**SHA reviewed:** `9f98ad8` (branch `close-label-swap`)
**Range:** `c1ec1ba..9f98ad8` (7 commits), whole branch `d7314cf..9f98ad8` in scope
**Auditor:** security-auditor (round 1 author of F1–F8)
**Date:** 2026-07-28

## VERDICT: REQUEST CHANGES

Two blocking findings, both against **F2 (`0b87721`)**, both **verified by execution**.

> **The F2 ruling does not survive this review. The external disclosure that depends on it must be VOIDED.**
>
> The dev's five read-only checks missed the sixth path — in fact two of them. F2 is not a
> contained stage-reporting change: it silently **downgrades an authorization requirement**
> (`task:accept` → `task:write`) and it **over-reports abandoned work as ready** through the
> ephemeral graph path, which is the path that actually serves the `GetReadyTasks` RPC for
> GitHub collections. The "fail-safe / under-reports" argument in brief §2 is falsified in the
> dangerous direction.

Everything else in the round is good work, and some of it is excellent — see Positive
Observations. F1, the #198 mutex, and the F5 logging all pass. The problem is F2 alone.

### Precondition check

`git rev-parse --short HEAD` in `/workspace` **fails** — `/workspace` is not a git repository, it
is the parent of ~159 clones. This is a defect in the dispatch instruction, not the SHA divergence
the gate guards against. The review clone `/workspace/farmtable-audit-194` is at **`9f98ad8`**, as
required. Independently corroborated: the dev clone `/workspace/farmtable-close-label-swap` is at
the same SHA and the same tree hash `d6883ce5…`. Proceeded on that basis.

### Summary

| Severity | Count |
|---|---|
| Critical | 0 |
| High | 2 |
| Medium | 2 |
| Low | 3 |
| Info | 1 |

---

## Findings

### [HIGH] F2 demotion silently downgrades the scope required to reopen a terminal task

- **Location:** `internal/platform/github/labels.go:415` (cause);
  `internal/server/server.go:537` (gate); `internal/server/transitions.go:94-99` (rule bypassed)
- **Verified:** BY EXECUTION.

**Description.** `UpdateTask` computes its required scope from the *current* stage:

```go
if transitionScope := TransitionScope(string(existing.Stage), string(st)); transitionScope != ScopeTaskWrite {
```

`transitions.go:94-99` requires `task:accept` for any move out of a terminal stage — "reopening a
closed task is a re-accept". `existing` comes from `s.store.GetTask` (`server.go:497`), which for a
GitHub collection routes through `MultiStore` → the pass-through store → `issueToTask` →
`IssueToPhaseStage`. F2 rewrites that value from terminal to `accepted`, so the rule no longer
matches and the transition falls through to the default `ScopeTaskWrite` (`transitions.go:134-135`).

This is the same laundering the transition table already defends against for triage — note the
existing comment at `transitions.go:86-88`: *"Placed above the on-hold and claim rules so no
destination stage can be used to launder a task out of triage without task:accept."* F2 opens that
exact hole for terminal, not via the destination but by rewriting the **source**.

**Impact.** A token holding `task:write` but deliberately **not** `task:accept` can move a
wont_fix / duplicate / cancelled / completed issue back into the active pipeline on any GitHub
pass-through collection. The scope separation is intentional and is silently voided.

**Proof of concept (actual output).** Both halves executed at `9f98ad8`:

```
label=wont_fix   -> phase=open     stage=accepted
label=duplicate  -> phase=open     stage=accepted
label=cancelled  -> phase=open     stage=accepted
label=completed  -> phase=open     stage=accepted
dest=triage     pre-F2 required=task:accept  post-F2 required=task:write
  PRIVILEGE DOWNGRADE: reopen-shaped transition wont_fix->triage required "task:accept", now requires only "task:write"
dest=in_review  pre-F2 required=task:accept  post-F2 required=task:write
dest=in_qa      pre-F2 required=task:accept  post-F2 required=task:write
dest=deploying  pre-F2 required=task:accept  post-F2 required=task:write
dest=accepted   pre-F2 required=task:accept  post-F2 required=task:write
```

Baseline confirmed at the parent commit `a70d3d1` in an isolated worktree — the downgrade is
genuinely introduced by `0b87721`, not pre-existing:

```
PRE-F2: OPEN + wont_fix   -> phase=closed   stage=wont_fix
PRE-F2: OPEN + duplicate  -> phase=closed   stage=duplicate
PRE-F2: OPEN + cancelled  -> phase=closed   stage=cancelled
PRE-F2: OPEN + completed  -> phase=closed   stage=completed
```

**Recommendation.** The scope decision must not read a field that the label mapper can rewrite.
Derive it from GitHub's own authoritative signals. Either:

1. Preserve the pre-demotion stage for authorization. Have `issueToTask` retain the label-derived
   stage on the task (e.g. `NativeLabel`, already populated at `passthrough.go:218`) and gate on it:

```go
// server.go — authorization reads the un-demoted stage.
authStage := existing.Stage
if native := task.Stage(existing.NativeLabel); store.IsTerminalStage(native) {
    authStage = native  // a terminal label still means "reopen" for RBAC
}
if transitionScope := TransitionScope(string(authStage), string(st)); transitionScope != ScopeTaskWrite {
```

2. Or require `task:accept` whenever the target issue carries a terminal stage label, independent
   of the mapped stage.

Do not "fix" this by reverting the RBAC rule.

---

### [HIGH] F2 makes abandoned work appear in the ready queue — the "fail-safe" claim is false

- **Location:** `internal/server/graph_routing.go:140` (`Stage: t.Stage`);
  `internal/server/graph_routing.go:72` (loader); `internal/store/entstore.go:2518-2520`;
  `internal/server/server.go:1489`
- **Verified:** BY EXECUTION.

**Description.** Brief §2 asks whether the pass-through/tree-walk divergence is genuinely
fail-safe. It is not. The dev's analysis considered only `passthrough.GetReadyTasks`, which uses
the tree walk and therefore *under*-reports. But for a GitHub collection the `GetReadyTasks` **RPC
does not use that path at all**. `resolveGraphRoute` (`graph_routing.go:44-47`) sends any
non-`farmtable` collection to `graphRouteEphemeral`, and `server.go:1489-1494` loads an ephemeral
store instead.

`loadEphemeralStore` populates it via `s.store.ListTasks` (`graph_routing.go:72`) — the pass-through
path, which **applies the F2 demotion** — then copies `Stage` verbatim into a real SQLite EntStore
(`taskToCreateParams`, `graph_routing.go:140`). `EntStore.GetReadyTasks` selects
`PhaseEQ(open) AND StageEQ(accepted)` (`entstore.go:2518-2520`). The demoted task matches both.

So the two ready paths disagree, and the one that serves users over-reports. This is precisely the
"asymmetric case hiding in a directional argument" the brief warned about.

**Impact.** An issue a maintainer marked wont_fix / duplicate / cancelled, or one abandoned and
reopened, is actively **recommended as ready work** to every agent and human consuming
`ft ready`, MCP `task_ready`, and the web ready queue. Absence from a queue is safe; presence is
not. Agents burn cycles on work explicitly declined.

**Proof of concept (actual output).** Composed end-to-end, using the real mapper output fed through
the real EntStore ready query exactly as `taskToCreateParams` does:

```
IssueToPhaseStage(OPEN, wont_fix) = phase=open stage=accepted
READY QUEUE CONTAINS: "abandoned-wontfix-issue" (stage=accepted)
--- FAIL: TestAuditor_DemotedTaskBecomesReadyInEphemeralStore
    OVER-REPORT: a wont_fix-labelled OPEN issue is reported as READY work (1 task(s))
```

**Recommendation.** The ephemeral mirror must not inherit a demoted stage. In
`taskToCreateParams` (`graph_routing.go:134`), carry the label-derived terminal stage through, or
exclude terminal-labelled issues from the mirror:

```go
// graph_routing.go — do not let a demoted stage enter the graph store as ready work.
p := store.CreateTaskParams{ /* … */ Stage: t.Stage}
if native := task.Stage(t.NativeLabel); store.IsTerminalStage(native) {
    p.Stage, p.Phase = native, task.PhaseClosed
}
```

Whichever direction is chosen, the two ready paths must be made to agree, and a test must assert
they agree. Today nothing does.

---

### [MEDIUM] A stock GitHub `duplicate` label is now laundered into claimable work

- **Location:** `internal/platform/github/labels.go:95-97` (bare-name mapping);
  `internal/platform/github/passthrough.go:663-669` (claim gate)
- **Verified:** demotion BY EXECUTION; claim-gate arm BY INSPECTION.

**Description.** Stage labels are matched **bare and unprefixed** — `labels.go:95-97` registers
`strings.ToLower(s.String())` for every stage, so the literal label `duplicate` maps to
`StageDuplicate`, and `stripForMatch` (`labels.go:430`) only *optionally* strips `ft:`/`stage/`.
`duplicate` is one of the **default labels GitHub ships in every new repository**. `cancelled` and
`completed` are likewise plausible organic labels.

Pre-F2, an open issue carrying such a label was terminal and unavailable. Post-F2 it is
`accepted`, and `issueUnavailableForClaim` (`passthrough.go:663`) tests
`t.Stage != task.StageAccepted || t.ClosedAt != nil` — the stage arm now passes, and `ClosedAt` is
nil because the issue is genuinely open. Nothing else stops the claim.

This is the direct answer to the question posed in the dispatch: yes, the demotion can launder a
`wont_fix`/`duplicate` into something claimable. It is Medium rather than High only because it
requires the label to exist on an open issue; findings 1 and 2 carry the real severity.

**Recommendation.** Fixing findings 1 and 2 largely subsumes this. Additionally consider requiring
the configured prefix for *terminal* stage labels specifically, so an organic GitHub `duplicate`
label cannot drive lifecycle decisions at all.

---

### [MEDIUM] The test pinning the tree-walk divergence is tautological — the pin is vacuous

- **Location:** `internal/platform/github/reopen_test.go:187-195`
- **Verified:** BY EXECUTION.

**Description.** `TestComputeReady_OpenTerminalLabelledIssueIsNotReady` builds a node with
`Stage: task.StageCompleted` and asserts `computeReady(nodes, false)` is empty. With
`includeUnblocked=false` the only arm of `computeReady` that can append requires
`node.Stage == task.StageAccepted` (`treewalk.go:92`). A node with `StageCompleted` is therefore
provably excluded **regardless of any terminal handling**. The assertion cannot fail, and because
the nodes are hand-built, `buildIssueTree` — the function that would have to learn the rule — is
never invoked.

The test's own failure message says *"if the tree walk has been taught the symmetric rule, delete
this test."* It cannot detect that.

**Proof of concept (actual output).** I taught `buildIssueTree` the symmetric rule (mutation MUT-T,
inserting the demotion at `treewalk.go:36`) — the precise change the message describes:

```
=== RUN   TestComputeReady_OpenTerminalLabelledIssueIsNotReady
--- PASS: TestComputeReady_OpenTerminalLabelledIssueIsNotReady (0.00s)
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.008s
--- full package, to see who DOES notice ---
ok  	github.com/farmtable-io/farmtable/internal/platform/github	0.057s
```

The whole package stays green with the divergence removed. Nothing pins it. This matters beyond
test hygiene: brief §2's "we pinned it rather than fixing it" is not true in effect.

**Recommendation.** Drive the real constructor and use the arm that consults `IsTerminalStage`:

```go
nodes := buildIssueTree([]issueNode{ /* OPEN issue labelled ft:stage/completed */ }, mapper)
if got := readyNumbers(computeReady(nodes, true)); len(got) != 0 { … }
```

---

### [LOW] Unfalsifiable compound assertion

- **Location:** `internal/platform/github/reopen_test.go:213-215`
- **Verified:** BY INSPECTION (exhaustive case analysis).

```go
if !availability.HasReason(store.AvailabilityReasonTerminal) && readBack.Stage != task.StageAccepted {
```

If the demotion works, `Stage == StageAccepted` → right conjunct false. If it breaks,
`HasReason(terminal)` is true → left conjunct false (and line 210 fatals first). No reachable state
fires this. Almost certainly `||` was intended.

**Recommendation.** `if !availability.HasReason(...) || readBack.Stage != task.StageAccepted`.

---

### [LOW] The concurrency tests' headline property is not enforced by any build target

- **Location:** `internal/platform/github/concurrency_test.go:40`, `:90`; `Makefile:9-10`
- **Verified:** BY INSPECTION.

`Makefile` runs `go test ./...` with no `-race`, and there is no CI workflow. The race property
these tests exist to assert is only checked when someone passes the flag by hand.
`TestPassThroughEnsureRepoID_ConcurrentUseDoesNotRace` (`:90`) is near-vacuous without it: its only
check is `s.repoID != "REPO"`, which passes with one goroutine, eight, or the mutex deleted. It
never calls `cachedRepoID()`, so the accessor added in this diff (`passthrough.go:159`) is
exercised by **no test at all**.

**Recommendation.** Add a `race` target and run it in the gate:
`go test -race ./internal/platform/github/`. Have `:90` assert via `cachedRepoID()`.

---

### [LOW] Log statements expose private repo slugs and stage vocabulary to a shared sink

- **Location:** `internal/platform/github/passthrough.go:724`, `:732`, `:738`, `:749`
- **Verified:** BY INSPECTION (full error-type trace).

**No credential can reach these lines** — this was the primary concern and it is clean. The package
defines no custom error type; the token lives only inside `oauth2.Transport` (`graphql.go:21-23`)
and is never stored on `graphqlClient` or the store. Every logged `err` bottoms out in one of three
`shurcooL/graphql` shapes: a `*url.Error` over the hardcoded `api.github.com/graphql` endpoint (no
userinfo, and `net/http` strips passwords), a non-200 message quoting the **response** body, or a
server-authored GraphQL message. `NewEnterpriseClient` is never called, so a credentialed base URL
is unreachable. No issue title, body, comment, or user email is logged.

Residual, genuinely low: `s.repoSlug()` prints a possibly-private `owner/repo`, and `add`/`remove`
print operator-configured stage-label names. Package `log` writes to process stderr with no
`SetOutput` outside tests, and one server process serves many tenants' repos
(`multistore.go:131` → `resolver.go:26`), so these correlate across tenants in a shared sink. This
is the exposure level already set by `multistore.go:133`, so it is consistent, not a regression.

**Recommendation.** Accept for now. If tenant isolation of logs becomes a requirement, introduce a
redaction helper — none exists repo-wide — and note this package now has two logging paths
(`log.Printf` here vs. the injectable `fmt.Fprintf(logWriter(), …)` at `ratelimit.go:44`).

---

### [INFO] Missing exhaustiveness and count assertions (three instances)

- `reopen_test.go:82`, `:109`, `close_label_swap_test.go:489` — hardcoded stage lists between them
  cover all ten members of `allStages`, but nothing asserts that union. An 11th stage is silently
  uncovered. `internal/store/terminal_availability_test.go:73` has exactly this guard; port it.
- `state_test.go:19-37` — the three unrecognised-state rows (`""`, `"MERGED"`, `"closed "`) are the
  entire unit-level inversion trap and are individually deletable with no count assertion.
  `"closed "` is covered **only** here.
- `close_label_swap_test.go:645` — doc says "four errors on purpose"; nothing asserts the total is
  four.

---

## What I verified BY EXECUTION vs. BY REASONING

**By execution** (all at `9f98ad8`, in a throwaway worktree; every mutation restored and verified):

| ID | Mutation | Result |
|---|---|---|
| M1 | Demote *every* labelled open issue (drop terminal check) | **KILLED** — `OpenIssueKeepsNonTerminalStage`, `LabelsOverride`, `OpenIssueStaysAvailable` |
| M2 | Apply demotion on the closed branch too | **KILLED** — `ClosedIssueKeepsTerminalStage`, `LabelsOverride` |
| M3 | `issueStateClosed := !issueStateOpen` (the inversion trap) | **KILLED** — `IssueStateHelpers_Casing`, `UnrecognisedStateIsNotClosed` |
| M4 | `issueStateOpen := !issueStateClosed` (reverse) | **KILLED** — `IssueStateHelpers_Casing` |
| MUT-X | Drop `RLock` in `labelNameToID`, keep double-check | **SURVIVES** — reproduces the dev's disclosed mutant exactly |
| MUT-Y | MUT-X + allow re-publication | **KILLED** — `WARNING: DATA RACE`, `ConcurrentClosesDoNotRaceLabelIndex` |
| MUT-Z | Revert to pre-#198 shape (unlocked, incremental populate) | **KILLED** — 8× `WARNING: DATA RACE` |
| MUT-T | Teach `buildIssueTree` the symmetric rule | **SURVIVES** — package fully green (finding above) |

Also by execution: the F2 privilege downgrade (both halves), the pre-F2 baseline at `a70d3d1`, and
the ephemeral over-report.

**By reasoning / inspection:** the call-site dominance analysis below; the `existing.Stage`
provenance chain through `MultiStore`; the error-type trace for the logging finding; the
unfalsifiable-`&&` case analysis.

## The #198 happens-before argument — checked, and it holds

The brief asked me to check "all nine call sites". **The real count is 15 reaching sites, not 9**,
so the dev's count is wrong — but the substance of the claim is correct. Every one of them is
dominated by `ensureLabelIndex` on the same goroutine:

- `CreateTask` — 3 direct calls (`passthrough.go:340, 348, 355`), guarded at `:332`
- `UpdateTask` — 8 via `labelNamesToIDs` (`:424, 428, 441, 445, 458, 462, 472, 481`), each inside a
  branch with its own guard at `:418, 435, 452, 469, 478`
- `ClaimTask` — 2 (`:624, 628`), guarded at `:618`
- `CloseTask` — 2 (`:721, 729`), inside `if err := s.ensureLabelIndex(ctx); err == nil {` at `:717`

No site reaches `labelNameToID` without it. `cachedRepoID()` (`:159`) is called once in production
(`:372`), dominated by `ensureRepoID` at `:329`. `collectionID` is written only in the constructor
(`:66`) and never afterwards, so leaving it unguarded is correct.

The surviving mutant is therefore **explained, not a gap** — and MUT-Y/MUT-Z confirm the guards are
load-bearing the moment the premise weakens. Keeping the `RLock` is the right call: it is what makes
the read safe under a future caller or a relaxed publish. **#198 passes.**

## Restore-integrity check (the process error)

Confirmed clean, and I removed the hazard rather than trusting the ritual: **I never mutated the
review clone.** All twelve-plus mutations ran in a disposable `git worktree` under `/tmp`.

- Audit clone `/workspace/farmtable-audit-194`: `git status --porcelain` empty, HEAD `9f98ad8`,
  tree `d6883ce570ac55d774bd0b9ca3beea608a60967e`.
- Mutation worktree after every restore: `git status --porcelain` empty, tree hash **identical**.
- Dev clone `/workspace/farmtable-close-label-swap`: same tree hash — independent corroboration.
- No `.bak`/`.orig` files, no stashes, no test file modified in the committed range beyond the
  seven intended commits.

No botched restore. The committed state is what the dev believes it is.

## Positive Observations

- **F1 (`a70d3d1`) is exactly right and genuinely pinned.** `issueStateClosed` deliberately not
  being `!issueStateOpen` is the correct security default, and M3/M4 prove the trap is load-bearing
  in *both* directions. The reasoning in the `state.go` header comment is unusually good.
- **#198 (`af93cb0`) is sound, and §6 of the dev report is honest.** MUT-X reproduces the disclosed
  surviving mutant precisely as described. Disclosing a surviving mutant rather than hiding it is
  the behaviour this workstream should want.
- **Both F2 guards are load-bearing** (M1, M2) — the over-breadth concern is properly defended even
  though the change itself is wrong.
- **No self-built oracles.** Every one of the 18 test functions binds to a real production symbol;
  the fourteenth instance of that defect class is not here.
- **`claim_gate_test.go:38` is exemplary sink-binding.** Labelling the issue `ft:stage/accepted` so
  the stage arm waves it through, leaving `ClosedAt` as the only signal, is the correct way to prove
  a specific guard is load-bearing.
- **The publish-in-one-assignment reasoning** at `passthrough.go:141-146` (avoiding a partially
  filled map) is a genuinely subtle call, correctly made and correctly explained.
- The dev self-caught and corrected a bad audit reproduction (§1) under manual-restore conditions.

## Recommendations

1. **Void the external disclosure.** Findings 1 and 2 change the F2 ruling.
2. Fix findings 1 and 2 before merge. Both flow from one root cause: **a field that GitHub labels
   can rewrite is being used for authorization and for work-scheduling.** Consider whether
   `IssueToPhaseStage`'s output should be split into a *display* stage and an *authoritative*
   lifecycle stage, rather than one field serving both. That is the design question underneath F2
   and it should be answered before this lands.
3. Add a test asserting the two ready paths (`passthrough.GetReadyTasks` vs. ephemeral) agree.
   Their disagreement is currently invisible.
4. Fix the tautological pin (finding 4) — as written it will mislead the next reader.
5. Add `-race` to the build target.
6. Out of scope but surfaced again: **F7** (`UpdateTask` relabels to terminal without closing) is
   one of the three paths F2 cites as justification. F2 is partly a workaround for F7; fixing F7
   may reduce the need for the demotion entirely. Worth sequencing them together.

## Note on sequencing

The code-review leg runs later at this same SHA. Findings 1 and 2 are backed by pasted failing
output that can be re-run independently; if the third report disagrees on F2, the executable
reproductions should be the tiebreaker rather than the prose.
