# Re-Review v2 — PR #166 `auth-stage4-scope-ext`

**Reviewer:** code-reviewer (independent)
**Date:** 2026-07-26
**Branch:** `auth-stage4-scope-ext` @ `fb458ec` → `main` @ `5c0e5cf`
**Prior review:** `review-scope-ext.md` (at `0c0134d`) — verdict REQUEST CHANGES (C1, C2, I1, I2, I3)
**Fix commits under review:** `d7bedf0`, `fb458ec` (`git diff 0c0134d..fb458ec`)

---

## Review Summary

**Verdict:** **APPROVE** — with two non-blocking follow-ups that should be picked up in a cleanup pass.

**Overview:** Both prior Critical findings are genuinely closed, and closed in the right way — C1 was fixed by *generalizing* the rule (one catch-all `triage → any` row placed between the close rule and the claim/on-hold rules) rather than by patching the specific hole, and C2 by routing `CreateTask`'s explicit stage through the same `TransitionScope` function so the create and update paths cannot drift. The new internal property test converts the accept-gate invariant from an enumerated list into an exhaustive assertion over the proto enum, which is the difference between "this bug is fixed" and "this class of bug is fixed." Remaining items are documentation/rollout and one previously-unexamined backend interaction; none are exploitable.

---

## Executive Summary (risk level)

Risk of the delta is **low and fail-closed**: every change tightens authorization, and the two adversarial escape routes found in v1 are demonstrably shut. The residual risk is *operational*, not security — the new gates break the documented agent loop and silently disable `ClaimTask` on the GitHub pass-through backend, and neither consequence is fully captured in the in-repo record that survives the merge.

---

## Verification of prior findings

| ID | Prior finding | Status | Evidence |
|---|---|---|---|
| **C1** | On-hold laundering (`triage→blocked→ready`) bypasses accept gate | **FIXED** | `transitions.go:93-101`; `TestLeavingTriageAlwaysRequiresAcceptOrClose`, `TestScopedToken_AgentCannotLaunderOutOfTriageViaOnHold` — both pass |
| **C2** | `CreateTask(stage=ready\|completed)` skips accept/close gate | **FIXED** | `server.go:115-121`; `TestScopedToken_AgentCannotCreateInReadyStage`, `...InCompletedStage`, `TestScopedToken_ReviewerCanCreateInReadyStage` — all pass |
| **I1** | Compat findings understated the `CloseTask` break | **ADDRESSED** (external doc) / **PARTIAL** (in-repo) | `compat-findings.md` §8 states it plainly; in-repo project log does not — see Important #1 |
| **I2** | No stage-group partition exhaustiveness test | **FIXED** | `transitions_internal_test.go:35-70`, `TestStageGroupsPartitionAllStages` passes |
| **I3** | Unknown user types silently get wildcard | **PARTIAL** | `scopes.go:145-154` — warning added, fail-open behavior deliberately retained; see Important #2 |

### C1 — rule placement verified

The row ordering in `transitionTable` is correct and the invariant it depends on is now documented in-code:

```go
{from: nil,           to: stagesTerminal, scope: ScopeTaskClose},   // 1. close wins
{from: stagesTriage,  to: nil,            scope: ScopeTaskAccept},  // 2. any exit from triage
{from: stagesTerminal,to: nil,            scope: ScopeTaskAccept},  // 3. reopen
{from: nil,           to: stagesWorking,  scope: ScopeTaskClaim},   // 4.
{from: stagesWorking, to: stagesHandoff,  scope: ScopeTaskWrite},   // 5.
{from: nil,           to: stagesOnHold,   scope: ScopeTaskWrite},   // 6.
```

I walked the laundering sequence manually against the table and against the live RPC stack:

- `triage → blocked` / `waiting_for_input` / `deferred` / `scheduled` → row 2 fires before row 6 → `task:accept` → agent gets `PermissionDenied`. Hop 1 fails, so hops 2–3 are unreachable.
- `triage → working` → row 2 fires before row 4 → `task:accept`, not `task:claim`.
- `triage → completed` → row 1 still wins → `task:close`. Correct: closing untriaged work is a close, not an accept.
- Terminal→terminal (`completed → cancelled`) still resolves to `task:close`, not the reopen row, because row 1 precedes row 3. Correct.

The `TestScopedToken_AgentCannotLaunderOutOfTriageViaOnHold` test only asserts hop 1, which is normally a coverage smell — but here it is sound, because `TestLeavingTriageAlwaysRequiresAcceptOrClose` independently proves the property over *every* stage in the enum. The comment in the test ("Hop 1 of the laundering path is refused, so the rest is unreachable") makes the reasoning explicit. Good.

### C2 — no alternate creation path

The `CreateTask` gate is correct, but the interesting question is whether it is *sufficient* — i.e. whether another RPC can create a task in an arbitrary stage. I audited every stage-writing path:

| Path | Arbitrary stage? | Gate |
|---|---|---|
| `CreateTask` | yes | **now gated** via `TransitionScope(triage, stage)` |
| `InsertTasksAfter` (`server.go:244-252`) | no — hard-codes `StageTriage` | n/a |
| `ImportCollection` (`export_import.go:266,631`) | yes | `collection:admin` — not in any agent-facing default scope set |
| `beads_import.go:295` | yes | not an RPC; a converter feeding `ImportCollection`, no independent entrypoint |
| `internal/mcp/server.go:326,402,493,526` | yes | it is a `pb.FarmTableServiceClient`, so it inherits handler enforcement |
| `CloseTask` `req.Stage` (`server.go:748-754`) | **no** — `EntStore.CloseTask` (`entstore.go:833-837`) rejects non-terminal stages with `ErrInvalidArgument`; the GitHub pass-through unconditionally closes the issue | n/a |

That last row is worth calling out because it is the one place where a `task:close`-only token could plausibly have laundered a reopen (`CloseTask(id, stage=ready)`). It cannot — the store validates. The invariant is load-bearing for the new scope separation but is not asserted by any test in this PR (see Suggestions).

---

## Critical Issues

**None.** Both prior Criticals are closed, and I found no new bypass introduced by the fix.

---

## Important Issues

### 1. The in-repo project log still understates the `CloseTask` break (I1, residual)

`compat-findings.md` §8 is excellent and says exactly the right thing — *"agents cannot complete their own work"*, plus the point that already-issued tokens carry stored scopes so re-provisioning is a data migration, not a config flip. The problem is that `compat-findings.md` lives at `/scion-volumes/scratchpad/...`, and the only thing merging into the repo is `.design/project-log/auth-stage4-scope-extension.md`, which links to that unreachable path (line 130) and whose own **Backward compatibility** section (lines 127-141) lists only: legacy tokens, open-access mode, store layer, five test fixtures, web dashboard. The headline behavioral break is absent, and **Known follow-ups** (lines 143-160) covers the accept-gate doc contradiction but never mentions close.

Anyone reading the merged repo six months from now gets the mild version of the story.

**Suggested fix** — add to `.design/project-log/auth-stage4-scope-extension.md` under *Backward compatibility*:

```markdown
- **BREAKING for agent-typed tokens — both ends of the lifecycle.**
  1. `CloseTask` now requires `task:close`, which is *not* in
     `DefaultScopesForUserType("agent")`. Reaching a terminal stage via
     `UpdateTask` requires the same scope, so there is no alternative route.
     **Agents can no longer close their own work.** `agents.md` step 5
     ("Close it with `task_close`") and
     `.agents/skills/farmtable/commands/close.md` now describe an
     unauthorized operation.
  2. `ClaimTask` on a `triage` task now fails `FailedPrecondition` for
     *every* role including wildcard/admin, and leaving triage requires
     `task:accept`.

  Scopes are stored on the token row, not resolved per request, so
  already-provisioned agent tokens break at deploy time. Rollout requires
  either re-provisioning agent tokens with `task:close`, or a hand-off
  protocol where a reviewer/orchestrator closes on the agent's behalf.
  This is a data migration, not a config flip.
```

### 2. `ClaimTask` is now unusable on the GitHub pass-through backend (new — introduced by this delta)

`LabelMapper.IssueToPhaseStage` (`internal/platform/github/labels.go:396-402`) maps **every open GitHub issue with no recognized stage label** to `task.StageTriage`. That is the default for the overwhelming majority of real GitHub issues — in that backend `triage` does not mean "an intake decision is pending", it means "nobody applied a `stage/*` label".

Combined with the new gate at `server.go:688-690`, on a pass-through-backed collection:

- `ClaimTask` on any unlabelled issue returns `FailedPrecondition` for **all roles, including wildcard/admin** (confirmed by the PR's own `TestEvidence_Stage4ScopeMatrix` subtest `d_claim_from_triage_rejected_for_every_role`).
- The only remedy is `UpdateTask stage=ready` first, which requires `task:accept` for agents and side-effects a `stage/*` label onto the customer's GitHub issue.

This is fail-closed, so it is not a security hole — but it silently disables the documented agent loop for that backend. `compat-findings.md` §7 asserts *"the accept gate is not bypassable through the UI… dashboard behavior is unchanged"* and the bottom line claims *"Web UI: zero breakage"*, neither of which considered the pass-through store. There is no test coverage of `ClaimTask`/`UpdateTask` through `GitHubPassThroughStore` at the handler level, which is why the full suite stayed green.

**Suggested fix** — pick one, and record the choice:

```go
// Option A (recommended, smallest blast radius): in labels.go, an unlabelled
// open issue has not been *triaged out*, it was never triaged in. Treat it as
// accepted-but-unprioritised so the agent loop keeps working.
	// Fallback for open issues.
-	return task.PhaseOpen, task.StageTriage
+	return task.PhaseOpen, task.StageBacklog
```

Option B: leave the mapping alone and add an explicit section to the project log + `compat-findings.md` stating that pass-through collections require an accept step (and a `stage/*` label) before any issue can be claimed. Option A changes behavior for a backend with no handler-level tests; Option B is zero-risk but pushes the cost onto operators. Either is acceptable — silently shipping neither is not.

---

## Observations / Suggestions

### S1 — TOCTOU between the stage read and the store write (low severity)

`UpdateTask` (`server.go:477-482, 513-521`) and `ClaimTask` (`server.go:680-690`) both read `existing` via `s.store.GetTask` and then act on a separate store call. The transition scope is therefore evaluated against a stage that can change in between. The exploitable direction is narrow — an unprivileged caller would have to race a *privileged* actor moving a task back into `triage` in the window between the read and the write — and the pre-existing `RequireCollectionAccess` check has had the same shape since before this PR, so this is not a regression. But the PR newly makes an authorization decision depend on that read.

The store already supports optimistic concurrency and `UpdateTask` already threads `req.Version`, so the fix is nearly free when a privileged transition was involved:

```go
if transitionScope := TransitionScope(string(existing.Stage), string(st)); transitionScope != ScopeTaskWrite {
    if err := RequireScope(ctx, transitionScope); err != nil {
        return nil, err
    }
    // The scope decision was made against existing.Stage; pin the write to
    // that revision so a concurrent stage change cannot land under it.
    if p.Version == "" {
        p.Version = existing.Version
    }
}
```

`ClaimTask` has no equivalent lever without a store change; worth a note in the project log that the triage gate is advisory-under-concurrency, since the doc explicitly justifies keeping it at the handler level.

### S2 — Partition test enumerates from proto, not from Ent

`allStages` (`transitions_internal_test.go:13-27`) iterates `pb.TaskStage_name` and validates each against `task.StageValidator`. This catches a proto stage missing from the Ent model, but not the reverse: a stage added to `internal/store/schema/task.go` and *not* to the proto would be absent from `allStages`, so it could sit in no stage group, fall through to `task:write`, and the test would still pass. Ent does not generate an exported slice of stage values, so the cheap version is a count assertion:

```go
// Ent has no exported stage list; assert the count so a stage added to the
// Ent schema but not the proto fails here rather than silently defaulting
// to task:write in TransitionScope.
if got, want := len(stages), 15; got != want {
    t.Fatalf("stage count = %d, want %d — did the Ent stage enum change?", got, want)
}
```

### S3 — `DefaultScopesForUserType("")` is the one unknown type that does *not* warn

The `userType != ""` guard (`scopes.go:150`) suppresses the warning for empty string. I checked the schema: `internal/store/schema/user.go:19` is `field.String("type").Default("agent")` — a **free-form string, not an Ent enum** — so the typo scenario the comment describes ("reviewr") is genuinely reachable, and so is `""` via `UserProvisioner.CreateSessionToken(ctx, id, userType string)` where the type is passed as a bare string from OAuth/IAP results (`oauth.go:235`, `unified.go:158`). Empty string is arguably the *most* dangerous input here — an unset type silently minting a wildcard session token — and it is the only one that logs nothing.

```go
-		if userType != "" {
-			log.Printf("WARNING: unrecognized user type %q ...", userType)
-		}
+		log.Printf("WARNING: unrecognized user type %q in DefaultScopesForUserType — granting wildcard scopes (backward compat)", userType)
```

Also: I3 was resolved by making the fail-open *visible* rather than closing it. That is a defensible call for backward compatibility, but it is not recorded anywhere — the project log never mentions the warning or the residual fail-open. It should appear under **Known follow-ups** with an intended end state (e.g. "unknown types return the `viewer` scope set once token provenance is audited").

### S4 — Missing tests for three invariants the security model now leans on

None of these are gaps in the fix; they are properties the fix silently depends on:

1. **`CloseTask` cannot reopen.** `EntStore.CloseTask` rejecting non-terminal stages is what stops a `task:close`-only token from using `CloseTask(id, stage=ready)` as an accept-gate bypass. No test in this PR asserts it at the RPC level. One case in `transitions_test.go`-style form would lock it in.
2. **`DefaultScopesForUserType` default branch.** `TestDefaultScopesForUserType` (`rbac_test.go:167-191`) covers admin/agent/viewer/human/service_account; the `default:` branch that returns wildcard is untested. Add `{"reviewr", nil}` and `{"", nil}` rows.
3. **`CreateTask` in `working` and `blocked`.** Both now require `task:accept` (row 2 beats rows 4 and 6). Creating in `blocked` requiring accept is *necessary* — `blocked → ready` is only `task:write`, so an ungated create-in-blocked would reopen C1 through the create path. It deserves an explicit table row so a future reader does not "fix" it as over-restrictive:

```go
{"triage to blocked (create-path equivalent)", task.StageTriage, task.StageBlocked, server.ScopeTaskAccept}, // already present ✓
```
   …and an RPC-level `TestScopedToken_AgentCannotCreateInBlockedStage` mirroring the existing pair.

### S5 — `gofmt` (nit, pre-existing)

`gofmt -l` flags `internal/server/scopes.go`. The misaligned `const` block predates the branch (`origin/main`'s copy fails too), so this is not a regression — but the PR adds two lines *into that exact block*, so `gofmt -w internal/server/scopes.go` is a zero-cost cleanup while it is already open. Note it would touch 4 unrelated lines.

---

## What's Done Well

- **The C1 fix generalizes instead of patching.** Replacing two destination-specific triage rows with one catch-all `triage → any`, placed deliberately between the close rule and the claim/on-hold rules, means the *class* of "find another destination stage" bypass is closed, not just the `blocked` instance. The in-code comment states the ordering constraint that makes it work, so the next person to reorder the table has been warned.
- **`TestLeavingTriageAlwaysRequiresAcceptOrClose` is a property test, not a list.** This is exactly the right response to "you missed a stage" — the assertion is now derived from the enum, so a new stage cannot reintroduce the bug. Same for `TestStageGroupsPartitionAllStages`, which additionally catches the *double*-membership case where the required scope would silently depend on row order.
- **C2 reuses `TransitionScope` rather than re-deriving the rule.** `CreateTask` asking "what would it cost to move a triage task here?" makes create and update structurally incapable of diverging — a hand-written `if stage == ready || stage == backlog` would have rotted at the next policy change. The `!= ScopeTaskWrite` guard also keeps the common no-stage / stage-is-triage path free of an extra check.
- **Dead code was removed, not left behind.** `stagesReopen` and the `union` helper became unreachable and were deleted in the same commit, and the project log records *why* the `terminal → triage/backlog` row went away (subsumed). Refactors that leave orphaned helpers are the norm; this one didn't.
- **`compat-findings.md` §8 is a model of an honest compat note** — it names the break in bold, enumerates the only two remediation paths, and correctly identifies that stored-on-the-row scopes make this a data migration rather than a config change. My only complaint is that it lives outside the repo.
- **The improved `ClaimTask` error message** now names the required scope, which turns a confusing `FailedPrecondition` into an actionable one.
- **`TestEvidence_Stage4ScopeMatrix`** as a transcript-style artifact is a genuinely good pattern for auth work — the `-v` output is directly reviewable as evidence without reading the assertions.

---

## Verification Story

- **Build:** `go build ./...` — clean.
- **Full suite:** `go test ./...` — **all green**, exit 0. No skips beyond `integration`-tagged Postgres tests.
- **Targeted:** `go test ./internal/server/... -run 'Scope|Transition|Lifecycle|Evidence|Launder|Create.*Stage|Partition|Triage' -v` — **42/42 PASS**, including all four named in the re-review brief (`TestScopedToken_AgentCannotLaunderOutOfTriageViaOnHold`, `TestScopedToken_AgentCannotCreateInReadyStage`, `TestScopedToken_AgentCannotCreateInCompletedStage`, `TestStageGroupsPartitionAllStages`).
- **Evidence transcript regenerated** and read: agent gets `PermissionDenied missing required scope "task:accept"` on `triage→ready` and `triage→working`, and `"task:close"` on both close paths; reviewer/orchestrator complete the full lifecycle; claim-from-triage is `FailedPrecondition` for all four roles including admin.
- **Static analysis:** `go vet ./internal/...` — 4 warnings, all `assignment copies lock value` at `server.go:1473/1583/1791/1968`, all on lines untouched by this branch (present on `origin/main`). `gofmt -l` flags `internal/server/scopes.go`; also flags on `origin/main` — pre-existing, see S5.
- **Security — adversarial pass:** manually walked the row-ordering table for all six rule interactions; audited all 6 stage-writing code paths for an ungated create/transition (table in the C2 section above); verified `EntStore.CloseTask` and `GitHubPassThroughStore.CloseTask` both make `CloseTask(stage=<non-terminal>)` a dead end; confirmed MCP is a gRPC client and inherits enforcement; confirmed `user.type` is a free-form string, validating the premise of the I3 warning. Found no new bypass. Two non-security issues surfaced: the pass-through/triage interaction (Important #2) and the read-then-write window (S1).
- **Not verified:** integration-tagged Postgres tests (no live instance); no handler-level test coverage exists for the GitHub pass-through backend, so Important #2 is reasoned from the code, not observed.

---

## Recommended Follow-ups (non-blocking)

| Priority | Item |
|---|---|
| High | Important #1 — fold the `CloseTask` / `ClaimTask` break into the in-repo project log |
| High | Important #2 — decide and record the GitHub pass-through `triage` mapping |
| Medium | S3 — warn on `""`; record the residual fail-open as a tracked follow-up |
| Medium | S4 — three missing invariant tests |
| Low | S1 — pin `p.Version = existing.Version` on privileged transitions |
| Low | S2, S5 — Ent stage-count assertion; `gofmt -w scopes.go` |

**Recommend escalating the agent-token rollout to the manager as a separate work item.** The code is correct; the deploy is not self-executing. Merging this without re-provisioning agent tokens (or landing a hand-off protocol) will break the live agent loop at both ends the moment it ships.
