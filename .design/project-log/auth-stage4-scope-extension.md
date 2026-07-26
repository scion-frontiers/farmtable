# Auth Stage 4 Extension: `task:accept` / `task:close` Scope Vocabulary

**Date:** 2026-07-26
**Author:** developer agent
**Branch:** `auth-stage4-scope-ext` (not pushed — manager pushes after review)
**Builds on:** `.design/project-log/auth-stage4-scoped-tokens-rbac.md`

## Summary

Extends the live Stage 4 RBAC vocabulary with two lifecycle scopes,
`task:accept` and `task:close`, and replaces the flat "all stage changes need
`task:write`" rule with a centralized, data-driven transition→scope table.

The policy intent: **agents can work tasks but cannot decide what gets worked
on or when it is done.** Accepting a task out of triage and closing it are now
distinct privileges held by humans, admins, and the new `reviewer` /
`orchestrator` roles.

## Changes

### Scope vocabulary — `internal/server/scopes.go`

- Added `ScopeTaskAccept = "task:accept"` and `ScopeTaskClose = "task:close"`
  to the constants and to `AllScopes` (so `ValidateScopes` accepts them and
  `ft token create --scope` can grant them).
- `DefaultScopesForUserType`: added `reviewer` and `orchestrator` →
  `task:read, task:write, task:claim, task:accept, task:close, collection:read`.
  All pre-existing user types are unchanged; `agent` deliberately does **not**
  get the two new scopes.

### Transition table — `internal/server/transitions.go` (new)

`TransitionScope(fromStage, toStage string, collectionID ...uuid.UUID) string`
resolves the scope required for a stage change from an ordered rule table.
Stages are grouped once (`stagesTriage`, `stagesAccepted`, `stagesWorking`,
`stagesHandoff`, `stagesOnHold`, `stagesTerminal`) mirroring the existing
`phaseForStage` grouping; rules are `{from, to, scope, reason}` rows with a nil
set meaning "any stage". First match wins.

| From | To | Scope |
|---|---|---|
| any | terminal | `task:close` |
| triage | any non-terminal | `task:accept` |
| terminal | any non-terminal | `task:accept` |
| any | working | `task:claim` |
| working | in_review / in_qa / deploying | `task:write` |
| any | blocked / waiting_for_input / deferred / scheduled | `task:write` |
| *(no match, or from == to)* | | `task:write` |

The `collectionID` variadic is accepted and ignored — reserved for future
per-collection policy binding, as specified.

### RPC enforcement — `internal/server/server.go`

- **UpdateTask**: the existing `GetTask` (previously only used for the
  collection access check) is now hoisted into a named `existing` variable and
  reused. When `req.Stage` is set, `TransitionScope(existing.Stage, newStage)`
  is consulted; if it returns anything other than `task:write`, that scope is
  additionally required. Non-stage field updates are untouched and still need
  only `task:write`. No extra store round-trip was added.
- **ClaimTask**: after the collection check, a task still in `triage` is
  rejected with `FailedPrecondition` and a message pointing at UpdateTask. This
  lives at the handler level, not in the store, so it applies uniformly across
  Ent, multistore, and the GitHub pass-through backend.
- **CloseTask**: `RequireScope(ScopeTaskWrite)` → `RequireScope(ScopeTaskClose)`.
- **CreateTask**: when `req.Stage` is set, the explicit stage runs through
  `TransitionScope(triage, stage)` and the resulting scope is required. Creating
  a task in a stage is the same privilege as creating it in triage and moving it
  there; without this, `create(stage=ready)` skipped the accept gate and
  `create(stage=completed)` skipped `task:close`.

## Design decisions

1. **Table, not conditionals.** One ordered data table means the whole policy is
   auditable in a single screen and testable exhaustively (a test asserts every
   one of the 225 stage pairs resolves to a known scope).
2. **Close is the first rule.** It is the most privileged transition and applies
   from every stage including terminal ones, so it must win over the reopen
   rules — otherwise `completed → cancelled` would only require `task:accept`.
3. **The triage gate is a precondition, not a permission.** ClaimTask from
   triage returns `FailedPrecondition` for *every* caller including wildcard
   admins. Permission errors say "you may not"; this says "not yet".
4. **Handler-level, not store-level.** Keeps all four storage backends
   consistent and keeps store tests (which legitimately exercise raw claim
   semantics) unchanged.
5. **`from == to` is a write.** A no-op stage set accompanying an ordinary field
   update must not escalate to `task:claim` or `task:close`.
6. **Unknown transitions fall back to `task:write`** — the pre-extension
   baseline, so there is no path that becomes *less* restricted than before.

### Two deliberate deviations from the approved table (flagged for review)

Both generalize a spec row in the **strict** direction to close a bypass, and
both are single rows that can be deleted if the reviewer disagrees:

- `triage → any non-terminal` requires `task:accept`, not `task:claim` for the
  working/handoff destinations. Otherwise an agent could move a triage task to
  `working` via UpdateTask and sidestep the ClaimTask gate entirely. Supported by
  the spec's own parenthetical ("task must already be accepted… NOT triage").
- `terminal → any non-terminal` requires `task:accept`, not just
  `terminal → triage/backlog`. Otherwise `completed → working` would resolve to
  `task:claim` and an agent could resurrect closed work. Supported by the spec's
  "reopen = re-accept" principle.

### Post-review amendment: closing two bypasses

Independent review found that the first cut of the table gated only *specific*
destinations out of triage, which left two holes. Both are now closed:

1. **On-hold laundering.** `triage → blocked` matched the `any → on hold`
   row and needed only `task:write`, so an agent could do
   `triage → blocked → ready → claim` and never present `task:accept`. The two
   destination-specific triage rows are replaced by one catch-all
   `triage → any` row placed *below* the close rule and *above* the claim and
   on-hold rules: every exit from triage except closing is an accept.
2. **CreateTask stage override.** See the CreateTask bullet above.

`TestLeavingTriageAlwaysRequiresAcceptOrClose` (internal test) now asserts the
first property over every stage rather than an enumerated list, and
`TestStageGroupsPartitionAllStages` asserts the stage groups partition the stage
enum so no future stage silently falls through to `task:write`.

The redundant `terminal → triage/backlog` row (subsumed by
`terminal → any`) and the now-unused `stagesReopen` set and `union` helper were
removed at the same time.

## Backward compatibility

Full investigation:
`/scion-volumes/scratchpad/projects/farmtable/reports/auth-stage4-scope-ext-evidence/compat-findings.md`

- Legacy tokens with nil scopes remain wildcard — unaffected, test-covered.
- Open-access mode (no auth configured) is unaffected: `RequireScope` returns
  early.
- **Store layer untouched** — zero `internal/store` test changes.
- **Four server tests** created a task (defaulting to `triage`) and claimed it;
  each now creates its fixture in `ready`: `TestRPC_ClaimTask`,
  `TestWatchTasks_ClaimEvent`, `TestClaimTask_PropagatesUserID`,
  `TestIdentity_MutatingRPCsAcceptValidAuth`. Plus `TestPostgresRPC_ClaimTask`
  behind the `integration` tag.
- **Web dashboard: no breakage** — it never calls ClaimTask; kanban drags go
  through UpdateTask, and web sessions carry wildcard-scoped human tokens.

### Known follow-ups (not in this change)

- **Agent docs now contradict the rule.** `agents.md`, the five
  `.agents/skills/farmtable` files, `docs/architecture.md:402`, and
  `.design/cli-design.md:507` ("Claimable stages: triage, backlog, ready") all
  teach claim-without-accept.
- **No `accept` affordance.** The only triage→ready path is
  `ft task update --stage ready` / MCP `task_update`. An explicit
  `ft task accept` would make the new gate discoverable.
- **Ready queue still surfaces triage tasks.** `GetReadyTasks` with
  `include_unblocked` returns triage tasks (`internal/store/entstore.go:2021-2027`)
  that agents can now neither claim nor accept — a dead end in the documented
  agent loop. Needs a product decision.
- **Proto `UserType` has no `reviewer`/`orchestrator` values.** Tokens work
  (user type is a free string in the store) but those users serialize as
  `USER_TYPE_AGENT` over the wire.
- `ClaimTaskRequest.stage` remains silently ignored by the handler
  (pre-existing).

## Tests

- `internal/server/transitions_test.go` (new) — table-driven coverage of every
  transition class, no-op transitions, unknown stages, exhaustive 15×15 stage
  pair sweep, the ignored `collectionID` variadic, `AllScopes`/`ValidateScopes`
  acceptance, and the new default-scope roles.
- `internal/server/rbac_test.go` — eleven new RPC-level tests over the real
  authenticated gRPC stack: agent cannot accept from triage, agent cannot
  launder a task out of triage through an on-hold stage, agent cannot create in
  `ready` or `completed` (reviewer can create in `ready`), agent cannot close
  (both RPC and UpdateTask paths), agent can still claim accepted work, claim
  from triage rejected, reviewer/orchestrator full lifecycle, reopen requires
  accept, legacy nil-scope tokens unaffected.
- `internal/server/transitions_internal_test.go` (new, package `server` so it
  can reach the unexported stage groups) — stage-group partition
  exhaustiveness and the "every exit from triage is accept-or-close" property.
- `internal/server/lifecycle_evidence_test.go` (new) —
  `TestEvidence_Stage4ScopeMatrix`, a transcript-style matrix test that logs the
  observed gRPC status code for each role/operation pair. Run with `-v` to
  regenerate the evidence transcript.

Verification: `go build ./...` clean, `go test ./...` all green,
`go vet -tags integration ./internal/server/` clean apart from two pre-existing
warnings on `origin/main`.

Evidence:
`/scion-volumes/scratchpad/projects/farmtable/reports/auth-stage4-scope-ext-evidence/`
