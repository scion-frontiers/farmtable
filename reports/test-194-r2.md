# Test Review — #194 `close-label-swap`, Round 2

**Reviewer:** test engineer
**SHA reviewed:** `9f98ad8` (tree `d6883ce570ac55d774bd0b9ca3beea608a60967e`)
**Date:** 2026-07-28
**Scope:** round-2 fixes to my own round-1 findings (gaps 1–8, mutants (a)–(e)), plus the three attack targets in the brief.

---

## VERDICT: **REQUEST CHANGES**

The test work in this round is, on the whole, unusually honest and it holds up under re-execution. The mutation table reproduces almost exactly, §6's admission of a surviving mutant is accurate, the gap-8 rewrite is provably correct, and I found no silent revert. **I approve the test engineering.**

I am nonetheless returning the branch, on one blocking finding:

> **F2 changes the input to an authorization decision, no test covers it, and the analysis that cleared F2 is factually wrong about the code path in question.**

The brief said finding a sixth F2 consumer "is a blocking finding and it changes the ruling." I found one, and it is not a cosmetic one — it is the RBAC transition gate in `FarmTableService.UpdateTask`. Check (1) of the five checks reads "UpdateTask is a producer, not a consumer." That is true of `GitHubPassThroughStore.UpdateTask`. It is **false** of the server's `UpdateTask`, which reads the task back and branches on its `Stage` to pick the required OAuth scope.

**Consequence for the disclosure:** the F2 *fix* survives review — it is correct and it strictly reduces the number of broken paths. What does **not** survive is the claim that "no legitimate workflow is affected." If the disclosure rests on the fix, publish it. If it rests on the impact analysis, **void or amend it** before publication. See F-1 and §"Effect on the disclosure".

---

## Provenance gate

The literal instruction was `git rev-parse --short HEAD` in `/workspace`. `/workspace` is **not a git repository** — it is a directory holding ~159 clones — so the command errors with `fatal: not a git repository`. I did not treat that as a gate failure; I resolved the substantive question instead:

| clone | HEAD | tree |
|---|---|---|
| `/workspace/farmtable-audit-194` (mine) | `9f98ad8` | `d6883ce…967e` |
| `/workspace/farmtable-close-label-swap` (dev's) | `9f98ad8` | `d6883ce…967e` |

Identical trees, clean working directory. **Gate passed.** Flagging the path discrepancy because the concern that motivated the gate was real and the instruction as written cannot be executed — future briefs should name the clone.

**No silent revert.** I confirmed all six scope items are present in the *committed blob* at `9f98ad8`, not merely in the working tree:

```
cacheMu sync.RWMutex            ×1
issueStateClosed                ×5
!store.IsTerminalStage(stage)   ×1
t.ClosedAt != nil ||            ×1
"post-close re-read failed"     ×1
cachedRepoID                    ×3
```

All mutation work was confined to `/tmp/mut` (a `cp -a` copy). The audit clone was never mutated and ends this review byte-clean at `9f98ad8`.

---

## Findings

### F-1 — **BLOCKING (High)** — F2 silently changes the scope required to reopen a task; nothing tests it

**Where:**
- Cause: `internal/platform/github/labels.go:376-415` (the F2 demotion)
- Consumer: `internal/server/server.go:496` (read-back) and `internal/server/server.go:537` (the gate)
- Policy table: `internal/server/transitions.go:74-108`
- Token defaults: `internal/server/scopes.go:124-127`

`server.go:537`:
```go
if transitionScope := TransitionScope(string(existing.Stage), string(st)); transitionScope != ScopeTaskWrite {
    if err := RequireScope(ctx, transitionScope); err != nil {
        return nil, err
    }
}
```

`existing.Stage` is fully label-derived for a pass-through collection: `MultiStore.GetTask` → `storeForTask` (`internal/store/multistore.go:164-187`) → `GitHubPassThroughStore.GetTask` (`passthrough.go:304`) → `issueToTask` (`passthrough.go:196`) → `IssueToPhaseStage`. F2 changes that value, so F2 changes an authorization input.

**Verified BY EXECUTION.** Scope delta for an OPEN issue carrying `ft:stage/completed`:

```
=== RUN   TestF2_TransitionScopeDeltaForDemotedStage
  to=triage      before=task:accept  after=task:write   *** WEAKENED: agent token could NOT do this before, CAN now ***
  to=accepted    before=task:accept  after=task:write   *** WEAKENED ***
  to=in_review   before=task:accept  after=task:write   *** WEAKENED ***
  to=in_qa       before=task:accept  after=task:write   *** WEAKENED ***
  to=deploying   before=task:accept  after=task:write   *** WEAKENED ***
  to=completed   before=task:write   after=task:close   *** TIGHTENED: agent could before, now DENIED ***
  to=wont_fix    task:close -> task:close  (unchanged)
  to=duplicate   task:close -> task:close  (unchanged)
  to=cancelled   task:close -> task:close  (unchanged)
--- FAIL: TestF2_TransitionScopeDeltaForDemotedStage
```

Chain closed — the scope difference is a real boundary, not cosmetic:

```
=== RUN   TestF2_AgentTokenIsDeniedAcceptButAllowedWrite
  agent default scopes: [task:read task:write task:claim collection:read]
  task:accept -> rpc error: code = PermissionDenied desc = missing required scope "task:accept"
  task:close  -> rpc error: code = PermissionDenied desc = missing required scope "task:close"
--- FAIL: TestF2_AgentTokenIsDeniedAcceptButAllowedWrite
```

So `ft release <id>` (`internal/cli/task.go:861-878`, an `UpdateTask` with `Stage: accepted` — **not** `CloseTask`, which is why check (5)'s verb sweep missed it) and MCP `task_update` (`internal/mcp/server.go:397`) previously returned `PermissionDenied` for an agent token on a reopened GitHub issue. **They now succeed.** The policy "reopening a closed task is a re-accept" (`transitions.go:89-94`) stops applying to precisely the issues it was written for.

**Reachability — verified BY EXECUTION.** No feature flag, no test-only wiring:
```
cmd/farmtable-server/main.go:60:  s := store.NewMultiStore(entStore)
cmd/farmtable-server/main.go:61:  s.SetResolver(github.NewPlatformResolver())
```
Any collection with a GitHub `LinkedAccount` lazily resolves to `GitHubPassThroughStore` (`multistore.go:104-151`). This is live in the deployed server.

**Nothing detects it — verified BY EXECUTION.** Reverting F2 and running the whole tree, every failure is in one package:
```
--- FAIL: TestAudit_ReopenAfterCloseStaysAvailable                 internal/platform/github
--- FAIL: TestIssueToPhaseStage_OpenIssueMayNotHoldTerminalStage   internal/platform/github
--- FAIL: TestPassThroughClaimTask_ReopenedIssueIsClaimable        internal/platform/github
--- FAIL: TestComputeReady_OpenTerminalLabelledIssueIsNotReady     internal/platform/github
FAIL github.com/farmtable-io/farmtable/internal/platform/github
```
Zero failures in `internal/server`. This is the **sink-binding** defect class again, one layer up: F2 is thoroughly tested at its source and nothing binds it to the authorization consumer it feeds.

**I am not asserting the new behaviour is wrong.** There is a decent argument it is *right* — if GitHub says the issue is open, there is nothing to "reopen," and requiring `task:accept` was the artefact. But that argument has not been made, the tightening at `--stage completed` is a denial-of-work regression in the other direction, and an authorization boundary moved with no test and no note.

**Recommendation.**
1. Decide the policy question explicitly and record it in `transitions.go`: should an OPEN, terminal-labelled issue require `task:accept` to move out of its label stage? Either answer is defensible; silence is not.
2. Add a test in `internal/server` that binds F2 to the gate — an `UpdateTask` against a pass-through-backed collection with an agent-scoped context, asserting the resulting scope decision. This is the missing sink-binding.
3. Correct check (1) in the report: distinguish `GitHubPassThroughStore.UpdateTask` (producer) from `FarmTableService.UpdateTask` (consumer).

---

### F-2 — **Medium** — the "fail-safe" characterisation of the stage-read-two-ways divergence is wrong by the branch's own threat model

**Where:** `internal/platform/github/treewalk.go:35` (`buildIssueTree` calls `mapper.MapLabelsToStage` directly, bypassing `IssueToPhaseStage`), report §"fail-safe", `internal/platform/github/reopen_test.go:172-194`.

F2 is applied on the store path and not on the tree-walk path. The report calls the resulting divergence fail-safe, on the grounds that the graph under-reports.

**Verified BY EXECUTION** (probes): an OPEN terminal-labelled issue is absent from **both** `computeReady` and `computeBlocked` — invisible to the entire graph surface, not merely to the ready queue. A parent is reported *blocked by* such a child while that child never itself appears as ready: a deadlock presentation with no visible cause. The store reports `stage=accepted phase=open available=true` while the graph reports `ready=[]`. The task is claimable but undiscoverable.

"Under-report" is only fail-safe if absence is the safe direction. The branch itself says it is not. `labels.go`'s own comment states that treating live work as finished is "worse than the reverse error, not better," and `reopen_test.go:61` names the failure mode **DENIAL-OF-WORK**. `GetReadyTasks` — literally the queue agents pull from — still does exactly that to reopened issues.

*Reasoned, not executed:* net, F2 still **strictly reduces** the number of broken paths (before: consistently wrong everywhere; after: store correct, graph stale). That is why this is Medium, not blocking.

**Recommendation.** Restate as "a known divergence, in the denial-of-work direction, accepted for now" and file the tree-walk symmetry as a follow-up. Do not ship the word "fail-safe."

---

### F-3 — **Medium** — the package now contains two tests asserting opposing models of the same GitHub state

**Where:** `internal/platform/github/reopen_test.go:187-216` vs `internal/platform/github/treewalk_test.go:35-55`.

Pre-existing #191 test `TestComputeReady_TerminalParentIsNotReady` (commit `4361390`) carries this comment:

> "A GitHub issue can be OPEN while its stage labels say the work is finished, so the stage — not the issue state — has to be what keeps it out of the ready set."

That is the exact negation of F2's premise. Both tests pass today only because they exercise different code paths (F-2). Whoever fixes F-2 will hit a test asserting the old model with a comment defending it.

**Recommendation.** Amend the `treewalk_test.go:35-55` comment to record that it pins the *tree-walk* path pending the F-2 follow-up, and cross-reference `reopen_test.go`.

---

### F-4 — **Low** — `reopen_test.go:213-215` is dead weight (verified)

```go
if !availability.HasReason(store.AvailabilityReasonTerminal) && readBack.Stage != task.StageAccepted {
    t.Fatalf("unexpected stage %s", readBack.Stage)
}
```
The first conjunct is always true given the preceding `Available` assertion, so the guard can never fire.

**Verified BY EXECUTION:**
```
T-DEL-213      delete final assertion            SURVIVED   0 funcs / 0 subtests
T-DEL-213+F2   delete it AND revert F2           DEAD       4 funcs / 8 subtests
T-KEEP-213+F2  keep it, revert F2 (control)      DEAD       4 funcs / 8 subtests
```
Byte-identical failure sets with and without it: zero detection contribution even in the scenario it was written for. Deleting it also breaks the build with `"internal/store" imported and not used` — it is the sole consumer of that import in the file, which is the only thing keeping it there.

**Recommendation.** Replace with the assertion it was presumably meant to be — an unconditional `readBack.Stage == task.StageAccepted` — which *would* be load-bearing.

---

### F-5 — **Low** — the self-deleting test is a mild trap

**Where:** `internal/platform/github/reopen_test.go:187-216`, `TestComputeReady_OpenTerminalLabelledIssueIsNotReady`, whose failure message instructs the reader to delete the test.

I judge the pattern **sound in intent but wrongly scoped**. The instruction is only correct for the test's *first* assertion (the divergence pin). Its second half holds permanently valuable store-path assertions. A literal reading deletes those too. Worse, the test can fail for unrelated reasons and the message will then advise deleting a test that just caught a real bug.

**Recommendation.** Split into `TestComputeReady_OpenTerminalLabelledIssueIsNotReady` (the divergence pin, keeping the self-delete instruction, which is legitimate for a pin whose whole purpose is to expire) and a separate test for the store-path assertions with no such instruction.

---

### F-6 — **Low** — §7 comparison table over-counts mutation (e) by two subtests

**Where:** report §7 table, row (e).

Table records **6 tests / 10 subtests**. Actual, on re-execution: **6 tests / 8 subtests** — and the dev's own pasted §3 output also shows 8, so the table disagrees with the evidence directly above it. All eleven other rows reproduce exactly.

**Recommendation.** Correct the cell to 8. Trivial, but the table is the artefact being relied on.

---

### F-7 — **Low** — the mutex call-site count is wrong (the conclusion is not)

**Where:** report §6, "nine `labelNameToID` call sites."

There are **15**, not nine: `CreateTask` ×3, `UpdateTask` ×8, `ClaimTask` ×2, `CloseTask` ×2.

**Verified:** all 15 are preceded by an `ensureLabelIndex` call with an error return in the same function, so the happens-before argument **holds** — I checked every one rather than accepting the count, per the brief. The count is just wrong.

**Recommendation.** Fix the number, and state the invariant that actually does the work: *every* `labelNameToID` call is dominated by an `ensureLabelIndex` in the same function.

---

### F-8 — **Low/Info** — the ClosedAt arm's coverage rests entirely on the fake's deliberate infidelity

**Where:** `internal/platform/github/close_label_swap_test.go` (`fakeIssueRepo`), `passthrough.go:654` (`issueUnavailableForClaim`).

The fake ignores the GraphQL `states` variable. The dev documents this and uses it deliberately as the coverage mechanism for the new `t.ClosedAt != nil` arm. **Verified BY EXECUTION:**

```
FIDELITY GAP (deliberate): the fake returned a CLOSED issue to a states:[OPEN]
query; task stage=accepted closedAt=2026-01-02 00:00:00 +0000 UTC.
```

Real GitHub cannot produce this via this call path. The arm is therefore covered only in a state the production query cannot reach. That does not make the arm wrong — defence in depth against the other read paths is reasonable — but it means the test proves the arm *works*, not that it is ever *exercised*.

**Recommendation.** Add one sentence to the arm's comment naming the real call path that can deliver a closed issue (e.g. the post-close re-read), or accept it explicitly as unreachable defence-in-depth.

---

### F-9 — **Low/Info** — `concurrency_test.go` reads mutex-guarded fields directly, and calls `t.Fatalf` off-goroutine

**Where:** `internal/platform/github/concurrency_test.go:79`, `:83`, `:114` (direct `s.labelIndex` / `s.repoID` reads, bypassing the accessors added by this very change); `t.Errorf` from HTTP handler goroutines at `:182`.

The direct reads are safe *today* purely via `wg.Wait()` happens-before, but they model the exact access pattern the fix exists to forbid. `t.Fatalf` from a non-test goroutine is documented-incorrect (it calls `runtime.Goexit` on the wrong goroutine).

**Recommendation.** Use `cachedRepoID()` / `labelNameToID()` in the assertions — they exist now — and convert handler-goroutine failures to a channel or `t.Errorf`.

---

### F-10 — **Info** — stage-label construction duplicates production string-building

**Where:** test inputs built as `"ft:stage/" + stage.String()`, vs production `StageToLabel` at `labels.go:216`.

Not a self-built oracle (the oracle is a stage constant, not a re-implementation of the assertion target) so it does **not** belong on the 13-removed list. It is an input-construction drift risk only. **Verified BY EXECUTION** that the two agree today for all 10 stages.

---

## What I verified BY EXECUTION

**The §7 mutation table reproduces.** All twelve mutations re-run independently with sha256-verified restore between each. The *set of killing tests* matches the dev's table exactly for every one:

| mutation | dev's record | mine | agrees |
|---|---|---|---|
| M1 | 5 / 3 | 5 / 3 | yes |
| M2 | 6 / 11 | 6 / 11 | yes |
| M3 | 1 / 4 | 1 / 4 | yes |
| M4 | 1 / 0 | 1 / 0 | yes |
| M5 | 6 / 13 | 6 / 13 | yes |
| M6 | 1 / 0 | 1 / 0 | yes |
| M7 | 3 / 1 | 3 / 1 | yes |
| M8 | 2 / 2 | 2 / 2 | yes |
| M9 | 2 / 3 | 2 / 3 | yes |
| (c) | DEAD 2 / 1 | DEAD 2 / 1 | yes |
| (d) | DEAD 2 / 1 | DEAD 2 / 1 | yes |
| (e) | 6 / **10** | 6 / **8** | **no — F-6** |

**(c), (d), (e) genuinely went SURVIVED → DEAD.** Confirmed. Note (c) as literally described does not compile — it needs `_ = closed` to silence `declared and not used` before it can be evaluated.

**F2 and both over-breadth guards are load-bearing.**
```
R-F2         revert the demotion              DEAD  4 funcs /  8 subtests
R-F2-BROAD   demote on both branches          DEAD  3 funcs / 10 subtests
R-F2-CLOSED  apply demotion to closed branch  DEAD  2 funcs /  3 subtests
```
(`R-F2-CLOSED`'s `/completed` subtest correctly cannot detect it — the `stateReason` default yields the same value.)

**F1 state helpers are pinned.** `R-STATE-NEG` (make `issueStateClosed` the negation of `issueStateOpen`) DEAD 2/5; `R-STATE-EXACT` (drop `EqualFold`) DEAD 3/4. The "must not become `!issueStateOpen`" warning is enforced, not merely written down.

**The claim gate and its premise-pinning both work.**
```
R-CLAIM-ARM     delete the ClosedAt arm       DEAD  2 / 1
R-CLAIM-FILTER  break the ListsOnlyOpen premise DEAD 1 / 0
```
`TestPassThroughClaimTask_ListsOnlyOpenIssues` is genuine premise-pinning, not decoration — priority (4) answered affirmatively.

**Logging is pinned.** `R-LOG` DEAD 1 func / 4 subtests.

**§6 is fully honest about the surviving mutant.** I reproduced the dev's A/B isolation exactly:
```
RACE-A  full revert (no mutex at all)             DEAD
RACE-B  keep double-check, drop RLock (dev's)     SURVIVED
RACE-C  no double-check + RLock                   SURVIVED
RACE-D  no double-check, no RLock                 DEAD
```
The report's characterisation of what the suite can and cannot detect is accurate. No overclaiming.

**The gap-8 `removeLabelByID` rewrite is correct, not merely different.** 200,000-case differential of the old aliased form against the new fresh-slice form: **0 divergences**, modulo nil-vs-empty-slice, which is unobservable (`hasLabel` ranges; `issueJSON` marshals to `[]` either way). Priority (2) answered.

**Fake fidelity for the 10-stage expansion is genuine.**
```
--- PASS: TestFidelity_FakeLabelUniverseMatchesProduction
--- PASS: TestFidelity_EveryTerminalStageSwapsForReal/{completed,wont_fix,duplicate,cancelled}
```
Every `StageToLabel` output is a key in the fake's `labelIDs`; 10 entries for 10 stages; every terminal stage genuinely round-trips through a real `CloseTask` leaving exactly one correct label. Not vacuous.

**The "tests that disappear instead of failing" class is CLEAN in this round.** Priority (1) answered negatively, which is the good answer. No case list in the new tests is built by filtering through the predicate under test — every stage list is a hard-coded literal, so none is blind to narrowing. No suite counts its own subtests without asserting the total. The lists are exhaustive today (10 = 10) but nothing *enforces* it: there is no generated `Stages()` enumerator, so a new stage would silently go untested. **Recommendation (Low):** assert `len(list)` against the enum, or generate the enumerator.

**Self-built-oracle list (§7 end) verified rather than trusted.** Priority (3): the enumerated symbols are the real exported ones; no test in this round asserts against a local re-implementation of its assertion target. The 14th rejected candidate was correctly rejected. F-10 is an input-construction duplication, not an oracle, and correctly absent from the list.

**No silent revert; suite green after every mutation.** Every harness run ended `post-restore rc=0 GREEN`. `labels.go` restored byte-identical at the end. Audit clone ends clean at `9f98ad8`.

*(The `internal/cli` / `cmd/ft` `setup failed` on `pattern all:web/dist: no matching files found` is pre-existing — identical in the untouched clone — and out of scope.)*

## What I reasoned about but did not execute

- The net judgement in F-2 that F2 strictly reduces broken paths.
- F-3's claim that the two tests are contradictory *in intent* (both pass today; the contradiction is in the comments and the models they encode).
- F-5's trap assessment.
- The latent ephemeral-graph consumers below.
- Whether F-1's new behaviour is *desirable*. I established that it changed and that nothing tests it; I did not rule on the policy.

## Latent, not blocking — for the follow-up file

`resolveGraphRoute` (`internal/server/graph_routing.go:32-47`) sends every GitHub collection down `graphRouteEphemeral`, which copies derived `Phase`/`Stage` verbatim into a real SQLite store (`graph_routing.go:135-137`) and then runs *native* graph queries against them. There, F2's `(closed, completed)` → `(open, accepted)` flip **adds** the issue to the ready queue (`internal/store/entstore.go:2518-2520`), moves it inside `GetCriticalPath` / `GetBottlenecks`' analysed set (`server.go:1848`, `:2014`, against the `maxGraphTasks = 500` budget), and decrements `BLOCKERS_RESOLVED` (`entstore.go:2565,2577,2585`).

**Verified BY EXECUTION that this is currently unreachable in production:** `WithEphemeralPool` is called only from `internal/testutil/testserver.go:69` and `internal/server/graph_routing_test.go:34`. `cmd/farmtable-server/main.go` does not pass it, so `loadEphemeralStore` bails at `graph_routing.go:59`. **It goes live the moment anyone wires the pool.** Note also the client-side mirror at `web/src/utils/task-ready.ts:25`, which applies the same rule in the browser and is *not* gated by the pool.

Dashboard counters (`web/src/components/ft-dashboard-view.ts:132-153`, `kanban/ft-kanban-column.ts:309`) shift a card from the Closed bucket to Open and increment the "Available" count. Cosmetic, but they are the "a count, a badge" the brief asked about, and they are reachable today.

## Effect on the disclosure

The F2 **fix** survives. It is correct, it is load-bearing under mutation, and its guards against over-breadth are real.

The F2 **impact analysis** does not. One of the five checks is wrong about the code path it names, and the missed consumer is an authorization gate. If the external disclosure asserts that the change is behaviourally contained or that no legitimate workflow is affected, **amend or void it.** If it asserts only that the terminal-label-outranks-open-state bug was real and is now fixed, it stands.

## Note for the third report

I reviewed as though the code-review leg will contradict me. The place I am most exposed is F-1's *severity*: a reviewer could reasonably argue the new scope behaviour is the correct one and downgrade it to a documentation gap. I would not resist that re-grading of the *policy* question — but the *test* gap stands regardless of which way the policy falls, because nothing in `internal/server` fails when the behaviour flips. That is the part I am asking to be fixed before merge.

---

## Summary of recommendations, by priority

| # | Sev | Where | Action |
|---|---|---|---|
| F-1 | **Blocking** | `server.go:537`, `labels.go:376` | Decide the reopen-scope policy; add an `internal/server` test binding F2 to the gate; correct check (1) |
| F-2 | Medium | `treewalk.go:35` | Drop "fail-safe"; restate as an accepted denial-of-work divergence; file the follow-up |
| F-3 | Medium | `treewalk_test.go:35-55` | Amend the contradictory comment; cross-reference `reopen_test.go` |
| F-4 | Low | `reopen_test.go:213-215` | Replace the dead guard with an unconditional stage assertion |
| F-5 | Low | `reopen_test.go:187-216` | Split the self-deleting test from the store-path assertions |
| F-6 | Low | report §7 row (e) | 10 → 8 |
| F-7 | Low | report §6 | 9 → 15; state the dominance invariant |
| F-8 | Low | `passthrough.go:654` | Name the real call path, or mark as defence-in-depth |
| F-9 | Low | `concurrency_test.go:79,83,114,182` | Use the accessors; no `t.Fatalf` off-goroutine |
| F-10 | Info | test inputs | Consider `StageToLabel` for input construction |
| — | Low | new stage lists | Assert `len(list)` against the enum |
