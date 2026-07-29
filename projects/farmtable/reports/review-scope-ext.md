# Review: `auth-stage4-scope-ext` — Stage 4 Scope Vocabulary Extension

**Reviewer:** independent code review
**Date:** 2026-07-26
**Branch:** `auth-stage4-scope-ext` @ `0c0134d`
**Base:** `origin/main` @ `5c0e5cf` (merge-base)
**Diff:** 12 files, +1044 / −7

---

## Verdict: **REQUEST CHANGES**

**Risk level: HIGH.** The engineering quality of this change is genuinely good — the
transition table is clean, data-driven, well-commented, and backed by unusually thorough
tests and compat analysis. But the accept gate it introduces is **bypassable by an
agent-scoped token via two independent paths**, both confirmed empirically against a real
bufconn server in this review. Since Stage 4 RBAC is live in production and this PR's
entire purpose is to establish the accept/close privilege boundary, shipping a boundary
with holes is worse than not shipping it — operators will believe the gate holds.

---

## Executive Summary

This PR adds `task:accept` / `task:close` scopes, a centralized first-match-wins
transition→scope table (`internal/server/transitions.go`), a `ClaimTask` triage
precondition, and wires all three into `UpdateTask` / `ClaimTask` / `CloseTask`. The
default-path behavior (wildcard admin/human/legacy-nil tokens) is correct and unchanged,
the reopen protection holds, and the scope check correctly fires only on stage changes.
Two gaps in enforcement coverage — on-hold stage laundering and unconstrained
`CreateTask` initial stage — let an `agent`-typed token reach `working` on a
never-accepted task using only its default scopes.

---

## Critical Issues

### C1 — Accept gate is bypassable by laundering through an on-hold stage
**`internal/server/transitions.go:139-142`** (rule 8: `any → on-hold` ⇒ `task:write`)
**`internal/server/transitions.go:127-130`** (rule 6: `any → working` ⇒ `task:claim`)
**`internal/server/transitions.go:167`** (fall-through default ⇒ `task:write`)

`stagesOnHold` (`blocked`, `waiting_for_input`, `deferred`, `scheduled`) is reachable
*from triage* with only `task:write`, and every stage is reachable *from* an on-hold stage
without `task:accept`. An `agent` token (default scopes `task:read`, `task:write`,
`task:claim`, `collection:read`) therefore performs:

```
UpdateTask(triage → blocked)   # rule 8 → task:write   ✅ agent has it
UpdateTask(blocked → ready)    # no rule matches → default task:write  ✅
```
…or, skipping a step entirely:
```
UpdateTask(triage → blocked)   # task:write   ✅
ClaimTask(id)                  # handler only rejects stage == triage  ✅
```

Both reach `working` on a task no one ever accepted. Verified with a scratch test on this
branch:

```
zz_review_bypass_test.go:27: triage->blocked ALLOWED with agent scopes
zz_review_bypass_test.go:36: BYPASS: agent laundered triage->blocked->ready without task:accept
zz_review_bypass_test.go:43: BYPASS: agent claimed a never-accepted task after parking it in blocked
```

This is not a latent edge case — **the test suite explicitly asserts it as correct
behavior**, which is how it survived review:
- `internal/server/transitions_test.go:63` — `{"triage to blocked", … ScopeTaskWrite}`
- `internal/server/transitions_test.go:64` — `{"triage to scheduled", … ScopeTaskWrite}`
- `internal/server/transitions_test.go:70` — `{"blocked to ready", … ScopeTaskWrite}`
- `internal/server/transitions_test.go:29` — `{"blocked to working", … ScopeTaskClaim}`

The developer's stated deviation #1 ("triage→working/handoff requires `task:accept` to
prevent bypassing the accept gate") is exactly right in intent, but was applied to only
two of the four non-terminal target groups. The gate needs to be a property of *leaving
triage*, not of specific destinations.

**Suggested fix** — make triage a sticky prefix by moving a single catch-all row above the
on-hold and claim rules, replacing rules at lines 99-112:

```go
{
    // Leaving triage in any direction other than closing is an accept.
    // Placed above the on-hold and claim rules so no destination stage can
    // be used to launder a task out of triage without task:accept.
    from:   stagesTriage,
    to:     nil,
    scope:  ScopeTaskAccept,
    reason: "any move out of triage is an accept",
},
```

Note this must sit *below* the `any → terminal` close rule (line 92-96) so
`triage → cancelled` remains a `task:close` operation, matching
`transitions_test.go:40`. Then update `transitions_test.go:63,64` to expect
`ScopeTaskAccept`, and add a regression test for the two-hop laundering sequence at the
RPC level.

---

### C2 — `CreateTask` lets an agent choose any initial stage, defeating both new scopes
**`internal/server/server.go:91`** (`RequireScope(ctx, ScopeTaskWrite)`)
**`internal/server/server.go:109-116`** (`if req.Stage != nil { stage = … }`)

`CreateTask` gates on `task:write` only and then accepts an arbitrary `req.Stage`. The new
transition table governs `UpdateTask` exclusively, so task *creation* is an ungoverned
entry point into any stage. Confirmed:

```
zz_review_bypass_test.go:62: BYPASS: agent created task directly in READY without task:accept
zz_review_bypass_test.go:64: BYPASS: ...and claimed it
zz_review_bypass_test.go:75: BYPASS: agent created task directly in COMPLETED without task:close
```

An agent can self-serve its own accepted work (`create(stage=ready)` → `ClaimTask`), and
can create-and-close in a single call (`create(stage=completed)`), defeating `task:close`
and polluting the terminal-state audit trail that `task:close` exists to protect.

The code path itself pre-dates this PR, but it is the control this PR introduces that it
defeats, so it is in scope. The compat analysis (§1) enumerates every producer's *default*
stage but never asks whether a caller can *override* it.

**Suggested fix** — treat creation as a transition from triage, reusing the same table:

```go
stage := task.StageTriage
phase := task.PhaseOpen
if req.Stage != nil {
    if err := validateDefinedEnum("stage", int32(*req.Stage), pb.TaskStage_name); err != nil {
        return nil, err
    }
    stage = convert.StageFromProto(*req.Stage)
    // Creating a task directly in a non-default stage is the same privilege
    // as creating it in triage and transitioning it there.
    if s := TransitionScope(string(task.StageTriage), string(stage)); s != ScopeTaskWrite {
        if err := RequireScope(ctx, s); err != nil {
            return nil, err
        }
    }
    phase = phaseForStage(stage)
}
```

This is behavior-preserving for wildcard tokens and for any create that omits `stage`.
Confirm with the decomposer (`internal/decomposer/writer.go:104-109`, sends explicit
`TASK_STAGE_TRIAGE` — unaffected) and `ImportTasks`
(`internal/server/export_import.go:266`, gated on `collection:admin` — acceptable, but
worth an explicit note in the design doc that import is intentionally exempt).

---

## Important Issues

### I1 — Compat analysis understates the CloseTask breaking change
**`/…/auth-stage4-scope-ext-evidence/compat-findings.md`** (§4, "Bottom line")

The document's behavioral summary is entirely about the claim gate: *"Agent-typed tokens
can no longer start work on a freshly created task."* It never states the second,
independent break: **agent-typed tokens can no longer close tasks at all.** `agents.md:17`
("5. Close it with `task_close`") is the documented terminal step of the agent core loop,
and MCP `task_close` (`internal/mcp/server.go:133`) is its only affordance. Every existing
agent token in production has persisted scopes `[task:read, task:write, task:claim,
collection:read]`, so this is an immediate `PermissionDenied` on rollout, not a
default-derivation change.

`agents.md:11-17` is listed in §4's table, but a reader scanning the bottom line will not
register that agents lose the ability to complete their own work. Please call it out
explicitly and pair it with a rollout decision (who closes agent work now?).

### I2 — Adding a new stage to the enum silently defaults to `task:write`
**`internal/server/transitions.go:11-41`** (stage group vars), **`:167`** (fall-through)

All 15 current stages are correctly partitioned across the six `stageSet` groups — I
verified this against `internal/store/ent/task/task.go:225-239`. But nothing enforces the
partition. A future `StageArchived` would belong to no group, match no rule, and fall
through line 167 to `task:write` — fail-open, with no test failure.
`TestTransitionScope_AllStagePairsResolveToKnownScope`
(`transitions_test.go:105-133`) does not catch this: it asserts the result is *a* known
scope, and `task:write` is one.

**Suggested fix** — add an exhaustiveness test that fails when the enum grows:

```go
func TestStageGroups_PartitionAllStages(t *testing.T) {
    groups := map[string]stageSet{
        "triage": stagesTriage, "accepted": stagesAccepted, "working": stagesWorking,
        "handoff": stagesHandoff, "onHold": stagesOnHold, "terminal": stagesTerminal,
    }
    for _, s := range allStages { // same list as task.StageValidator
        var in []string
        for name, g := range groups {
            if g.contains(s) {
                in = append(in, name)
            }
        }
        if len(in) != 1 {
            t.Errorf("stage %q belongs to groups %v, want exactly 1", s, in)
        }
    }
}
```
(Requires an in-package `_test.go` file, since the groups are unexported.)

### I3 — Unknown user types still fall through to wildcard
**`internal/server/scopes.go:128-137`** (new `reviewer`/`orchestrator` cases)
**`internal/server/scopes.go:143-144`** (`default: return nil // nil = wildcard`)

`User.Type` is a free-form `field.String("type")` with no enum constraint
(`internal/store/schema/user.go:19`), and `DefaultScopesForUserType` returns `nil`
(= wildcard) for anything unrecognized. So a token provisioned for `"reviewr"`,
`"Reviewer"`, or `"orchestrater"` gets **full wildcard**, which is strictly more
privilege than the correctly-spelled role this PR adds. The `default` branch is
pre-existing, but this PR is the first change to make user-type strings a privilege
boundary for lifecycle operations, which raises the blast radius of a typo from
"slightly wrong scopes" to "full admin."

At minimum, log a warning on the default branch. Better: validate `userType` against a
known set at user-creation / token-issuance time
(`internal/serverapp/provisioning.go:139`, `internal/cli/token.go:80`) and reject
unknown values. Flagging for the architect — this may be a deliberate
backward-compatibility choice, in which case it deserves a comment saying so.

---

## Observations (Medium / Low)

### O1 — TOCTOU between the scope decision and the write
**`internal/server/server.go:474-478`** (read) → **`:511-515`** (decide) → store write

`existing.Stage` is read outside any transaction, and `p.Version` is only populated when
the client supplies `req.Version` (`server.go:485-487`). A concurrent stage change between
the `GetTask` and the store write means the authorization decision is made against a stale
`from` stage while the write applies to the current one. Exploitability is narrow (the
attacker does not control the racing transition), so this is not a blocker — but for an
auth-critical path it is worth either requiring `req.Version` on stage-changing updates or
re-validating the transition inside the store transaction. Please record the decision in
the design doc rather than leaving it implicit.

### O2 — Rule 4 is fully subsumed by rule 5
**`internal/server/transitions.go:113-118`** (`terminal → stagesReopen` ⇒ `task:accept`)
**`internal/server/transitions.go:119-125`** (`terminal → nil` ⇒ `task:accept`)

Both rows yield `ScopeTaskAccept`, and rule 5's `to: nil` matches everything rule 4
matches. Rule 4 can never change an outcome. It reads as intentional documentation of the
approved policy, which has value — but as written a reader has to work out that it is
inert. Either delete it, or fold the two into one row with a comment covering both cases.
`stagesReopen` (`transitions.go:40-41`) becomes dead once rule 4 goes.

### O3 — `ClaimTask` precondition message prescribes a route agents cannot take
**`internal/server/server.go:682-683`**

> `"task must be accepted before it can be claimed — use UpdateTask to move from triage to accepted first"`

For the agent tokens that will hit this error most often, `UpdateTask(triage → *)` is
precisely what they lack `task:accept` for. The message sends them into a second
`PermissionDenied`. Suggest: *"task must be accepted out of triage before it can be
claimed; this requires the task:accept scope."*

### O4 — Ready queue will surface tasks agents can neither claim nor accept
Correctly identified in compat-findings §5 (`internal/store/entstore.go:2021-2027` includes
`StageTriage` in `stagePreds`). Restating here because it is the most likely
production symptom of this rollout: agents polling `GetReadyTasks(include_unblocked)` get
triage tasks, then hard-stop on `FailedPrecondition`. This needs a companion change or a
rollout note before enabling for agent fleets — not a code defect in this PR.

### O5 — `ClaimTaskRequest.stage` remains silently ignored
Noted in compat-findings §7. Not introduced here, no action required for this PR, but now
that `ClaimTask` has an explicit precondition, a client passing `stage` may reasonably read
it as the escape hatch. Worth a follow-up to either honor or reject it.

---

## Positive Feedback

- **The transition table is the right abstraction.** Replacing scattered inline scope
  checks with a declarative, ordered rule list is a real architectural improvement, and the
  `reason` field on every row (`transitions.go:70-71`) is an excellent touch — it makes the
  policy self-documenting and turns the table into something a non-Go reader can audit.
- **`stageSet.contains` treating `nil` as match-any** (`transitions.go:57-63`) is a neat,
  allocation-free way to express wildcard rows. The whole table is built once at package
  init (including the `union()` call at line 109), so `TransitionScope` is a bounded
  8-iteration loop of map lookups with zero allocations. No performance concern.
- **The scope check correctly fires only on stage changes.** `RequireScope(ScopeTaskWrite)`
  stays at the top of `UpdateTask` (`server.go:464`) and the transition check is nested
  inside `if req.Stage != nil` (`server.go:511`), with the `!= ScopeTaskWrite` guard
  avoiding a redundant re-check. `TestScopedToken_AgentCannotAcceptFromTriage`
  (`rbac_test.go:677-684`) explicitly proves non-stage writes still work — exactly the
  right test to have written.
- **Reopen protection genuinely holds.** The `terminal → nil` catch-all (deviation #2) is
  well-judged and I confirmed it empirically: `completed→blocked`, `completed→working`,
  and `completed→deferred` all correctly return
  `PermissionDenied: missing required scope "task:accept"` for an agent token. This is the
  deviation that should have been applied to triage as well (see C1).
- **`lifecycle_evidence_test.go` is a model of verification evidence.** Running the real
  interceptor over bufconn with real tokens and logging every role/operation/code triple
  produces an artifact an auditor can read directly. More auth changes should ship this.
- **The refactor from `if x, err := …; err != nil { } else if` to a plain assignment**
  (`server.go:474-480`, `:673-679`) was necessary to hoist `existing` into scope and was
  done cleanly without altering the error-handling semantics.
- **compat-findings.md is above the bar** — §6 (GitHub pass-through unaffected because the
  gate is at the handler, with the correct caveat if it ever moves down) and §2 (proving
  the web dashboard has no `ClaimTask` usage at all) are precisely the questions a reviewer
  would otherwise have to ask. My criticisms are of two specific omissions, not the method.

---

## Answers to the Stated Review Questions

| # | Question | Finding |
|---|---|---|
| 1 | Are the two deviations justified? | **Yes, both.** Deviation #1 (triage→working/handoff ⇒ accept) and #2 (terminal→any ⇒ accept) are correct and I verified #2 holds at runtime. The problem is that #1 was applied too narrowly — see **C1**. |
| 2 | Is rule ordering correct? Anything shadowed? | Ordering of the rules *as written* is correct: close-first is right, and no legitimate transition is shadowed by a wrong rule. The defect is a **missing** rule, not a misordered one. Rule 4 is redundant (**O2**). |
| 3 | Is the compat analysis complete? | Nearly. Misses that `CreateTask` can override the initial stage (**C2**) and understates the CloseTask break (**I1**). Everything else checks out, including the GitHub pass-through and web-UI claims, which I spot-verified. |
| 4a | Can an agent bypass the accept gate via UpdateTask triage→working? | Not directly (that row is covered). **But yes via `triage→blocked→ready/working`, and yes via `CreateTask(stage=ready)`** — **C1**, **C2**. |
| 4b | Is the CloseTask scope change correct? | Yes — `server.go:726`. Correct mechanically; the rollout impact is under-documented (**I1**) and it is bypassable at create time (**C2**). |
| 4c | Does RequireScope fire only for stage changes? | **Yes, correct.** Nested in `if req.Stage != nil` at `server.go:511`, with an explicit passing test. |
| 4d | Are legacy nil-scope tokens still wildcard? | **Yes**, verified by `TestScopedToken_LegacyNilScopesKeepLifecycleAccess` (`rbac_test.go:863-879`) and by the unchanged `default` branch in `DefaultScopesForUserType`. |
| 5 | Default path safety (admin/human wildcard)? | **Safe.** `admin`, `human`, `service_account` all return `ScopeWildcard`; full suite green with no fixture changes outside the five documented ClaimTask tests. |
| 6 | Do the new tests exercise enforcement? | Yes, and well — but they **encode C1 as expected behavior** (`transitions_test.go:63,64,70`), and no test covers multi-hop laundering or agent-initiated `CreateTask` with an explicit stage. See Test Coverage below. |

---

## Test Coverage

**Strong:** table-driven unit coverage of 40 transition pairs, RPC-level enforcement tests
per role, an all-pairs sanity sweep, legacy-nil-token regression, and a real-server
evidence transcript. Fixture updates across the five ClaimTask tests are the minimal
correct fix and match the compat doc exactly.

**Gaps, in priority order:**
1. **No multi-hop sequence tests.** Every transition is tested in isolation, so a
   two-`UpdateTask` laundering path is invisible to the suite. Add an RPC-level test that
   walks `triage → blocked → {ready, working}` with an agent token and asserts denial.
2. **No agent-initiated `CreateTask`-with-stage test.** Every fixture in
   `rbac_test.go` and `lifecycle_evidence_test.go` creates tasks with `adminCtx`
   (`rbac_test.go:610`, `lifecycle_evidence_test.go:27`), so the agent-creates-in-`ready`
   path is never exercised. Add negative tests for `CreateTask(stage=ready)` and
   `CreateTask(stage=completed)` under an agent token.
3. **No stage-group partition test** — see **I2**.
4. **Nit:** `assertPermissionDenied` (`rbac_test.go:883`) does not guard `err == nil` the
   way `assertFailedPrecondition` (`rbac_test.go:635-639`) does. `status.FromError(nil)`
   returns `ok=true, code=OK`, so it still fails, but via `Errorf` rather than `Fatalf` and
   with a confusing message. All current callers pre-check, so this is cosmetic.

---

## Backward Compatibility

No wire-format changes; no proto edits; no removed or newly-required fields. Two
behavioral breaks, both intentional and both requiring a rollout companion:

1. **`ClaimTask` rejects triage-stage tasks** for *all* tokens including wildcard admins
   (`FailedPrecondition`, `server.go:681-684`). Correct per the approved design; breaks the
   documented `task_ready → task_claim` loop.
2. **`CloseTask` requires `task:close`** — every already-issued agent token has persisted
   scopes without it, so this breaks on rollout, not on re-provisioning (**I1**).

Docs/tooling not updated by this PR and tracked as follow-up in compat-findings §4:
`agents.md`, `.agents/skills/farmtable/*`, `docs/architecture.md:402`,
`.design/cli-design.md:507` (directly contradictory), MCP/CLI help text. **There is still
no `accept` affordance in CLI or MCP** — the only path is
`ft task update --stage ready`, which agents cannot invoke. That should land with or
before this change.

---

## Verification Story

| Check | Result |
|---|---|
| Build (`go build ./...`) | ✅ clean |
| Full suite (`go test ./...`) | ✅ all packages pass, exit 0 |
| Focused (`-run 'Scope\|Transition\|Lifecycle\|Evidence\|Claim' -count=1`) | ✅ pass |
| `go vet ./...` | ✅ exit 0 (4 pre-existing `copylocks` diagnostics at `server.go:1466/1576/1784/1961`, all outside the diff) |
| `go vet -tags integration ./internal/server/...` | ✅ exit 0 — integration-gated fixture fix compiles |
| Security | ⚠️ two bypasses **confirmed empirically**, not inferred: scratch test on this branch reproduced both C1 and C2, and confirmed the terminal-reopen protection holds. Scratch file removed; suite re-run green afterward. |
| Stage enum coverage | ✅ all 15 stages in `task.StageValidator` are partitioned across the six groups today (unenforced — **I2**) |

---

## Required Before Merge

1. **C1** — close the on-hold laundering path (one reordered catch-all row) and update the
   three test rows that currently assert the hole as correct.
2. **C2** — gate `CreateTask`'s explicit `req.Stage` through `TransitionScope`, or document
   an explicit, justified exemption.
3. **I1** — amend compat-findings to state the CloseTask break plainly, with a rollout plan
   for who closes agent work.
4. Add the two missing negative tests (multi-hop laundering; agent `CreateTask` with stage).

**I2** and **I3** should land in the same cleanup pass if cheap; **O1**–**O5** are
follow-ups and need not block.

Once C1 and C2 are fixed and covered by tests, I expect this to be a straightforward
approve — the underlying design is sound and the surrounding rigor is high.
