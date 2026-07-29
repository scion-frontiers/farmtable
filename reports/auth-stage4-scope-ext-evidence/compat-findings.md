# Backward Compatibility Findings — Stage 4 Scope Vocabulary Extension

**Date:** 2026-07-26
**Branch:** `auth-stage4-scope-ext`
**Scope of change:** new `task:accept` / `task:close` scopes, centralized
transition→scope table, ClaimTask triage gate, CloseTask scope bump.

---

## 1. Default stage for new tasks is `triage` — everywhere

| Path | Evidence |
|---|---|
| Ent schema | `internal/store/schema/task.go:24-31` — `field.Enum("stage").…Default("triage")` |
| Ent generated | `internal/store/ent/task/task.go:221` — `const DefaultStage = StageTriage` |
| gRPC CreateTask | `internal/server/server.go:108` — `stage := task.StageTriage` unless `req.Stage` set |
| gRPC InsertTasksAfter | `internal/server/server.go:238-243` — hard-codes `task.StageTriage` |
| CLI `ft task create` | `internal/cli/task.go:378-384` — stage sent only with `--stage` |
| MCP `task_create` | `internal/mcp/server.go:89,321-326` — "Initial stage (default: triage)" |
| Decomposer | `internal/decomposer/writer.go:104-109` — explicitly `TASK_STAGE_TRIAGE` |
| Beads/import | `internal/server/export_import.go:746` — empty stage ⇒ `StageTriage` |

**Consequence:** the historical happy path is *create → (triage) → claim*. The new
ClaimTask gate breaks that path by design. Every producer of tasks must now
either create tasks in an accepted stage or have someone with `task:accept`
move them out of triage.

## 2. Yes — callers today claim tasks straight from triage

Production call sites of ClaimTask (all reachable with a triage-stage task):

- gRPC handler `internal/server/server.go` (`ClaimTask`) → `store.ClaimTask`
- CLI `ft task claim <id>` — `internal/cli/task.go:716-770`
- MCP tool `task_claim` — `internal/mcp/server.go:479-509`
- Store impls: `internal/store/entstore.go:776` (Ent),
  `internal/store/multistore.go:227-232` (router),
  `internal/platform/github/passthrough.go:517-554` (GitHub pass-through)

Not affected:

- **Web dashboard: no ClaimTask usage at all.** `web/src/gen/service.ts` exposes
  no claim method and `grep -i claim web/src` is empty. Kanban drag-to-Working
  goes through `UpdateTask` (`web/src/components/kanban/ft-kanban-view.ts:163-183`),
  so it is governed by the transition table, not the ClaimTask gate.
- Shell e2e in `test/integration/*.sh` — no `ft task claim` anywhere; the
  lifecycle script is create → update → close.
- `scripts/` — no claim usage.

## 3. Tests that had to change (actual, measured)

Because the gate was implemented at the **RPC handler level** (per the approved
design), the store-level test suite was untouched. Measured by running the suite
before and after:

`internal/store` — **0 failures.** The store still permits triage claims, so
`TestClaimTask`, `TestClaimTask_ChangesRecorded`, `TestVersionIncrement_WithoutHook`,
`runClaimTask`, `runVersionIncrement`, `TestMultiStore_ClaimTask_RoutesToPlatform`
etc. all continue to pass unmodified.

`internal/server` — **4 failures**, all "create (triage) then claim". Fixed by
creating the fixture task in `TASK_STAGE_READY`:

| File | Test | Fix |
|---|---|---|
| `internal/server/server_test.go:641` | `TestRPC_ClaimTask` | `Stage: stagePtr(TASK_STAGE_READY)` |
| `internal/server/watch_test.go:243` | `TestWatchTasks_ClaimEvent` | same |
| `internal/server/identity_test.go:73` | `TestClaimTask_PropagatesUserID` | same |
| `internal/server/identity_enforcement_test.go:195` | `TestIdentity_MutatingRPCsAcceptValidAuth` | same |

Integration-gated (`//go:build integration`, needs live Postgres) — fixed
pre-emptively, verified with `go vet -tags integration`:

| File | Test | Fix |
|---|---|---|
| `internal/server/server_postgres_test.go:181` | `TestPostgresRPC_ClaimTask` | `Stage: stagePtr(TASK_STAGE_READY)` |

`internal/store/entstore_postgres_test.go` (`TestPostgres_ClaimTask`,
`TestPostgres_ClaimTask_ClosedTask`, `TestPostgres_VersionIncrement`) needed **no
change** — they exercise the store directly, which is unchanged.

Ordering note: `TestRPC_ClaimTask_ClosedTask` still passes because a closed task
has a terminal stage (not `triage`), so the triage gate does not intercept it and
the store's `ErrAlreadyClosed` → `FailedPrecondition` mapping is preserved.

## 4. Documentation and agent workflows that now contradict the rule

These instruct "claim directly after `task_ready`" with no accept step. They are
**not** updated by this change and are follow-up work for the docs owner:

- `agents.md:11-17,57` (symlinked as `CLAUDE.md`, `GEMINI.md`) — core loop
  `task_ready` → `task_get` → `task_claim`; "Always prefer `task_claim`".
- `.agents/skills/farmtable/SKILL.md:19-21,44`
- `.agents/skills/farmtable/resources/workflow.md:1-8,23`
- `.agents/skills/farmtable/commands/claim.md:8-11`
- `.agents/skills/farmtable/commands/ready.md:16`
- `.agents/skills/farmtable/commands/update.md:19`
- `docs/architecture.md:402`
- `.design/cli-design.md:507` — directly contradictory: "Claimable stages:
  `triage`, `backlog`, `ready`".
- `.design/agent-task-lifecycle.md:9` — documents triage→claim as intended.
- Tool help text: MCP `internal/mcp/server.go:126-128`, CLI `internal/cli/task.go:723`.

**There is no `accept` command.** The only triage→ready path today is
`ft task update --stage ready` / MCP `task_update`. Both now require
`task:accept`, which agent-typed tokens do not have.

## 5. Ready-queue interaction (operational risk)

`GetReadyTasks` with `include_unblocked` returns **triage** tasks —
`internal/store/entstore.go:2021-2027` (`stagePreds` includes `StageTriage` and
`StageBacklog`). Callers: MCP `internal/mcp/server.go:639`, server
`internal/server/server.go:1469`, CLI `internal/cli/graph.go:39`.

So the documented loop surfaces triage tasks that an agent can now neither claim
(FailedPrecondition) nor accept (PermissionDenied). Agents will hit a hard stop
until either the ready queue excludes triage or a human/orchestrator accepts.

## 6. Divergence risk: GitHub pass-through store

`internal/platform/github/passthrough.go:517-554` implements `ClaimTask` with no
stage guard. Because the gate lives in the **server handler** (before store
dispatch), GitHub-backed collections are covered identically — the handler reads
the task via `s.store.GetTask` regardless of backend. No divergence today. If the
gate is ever pushed down into `EntStore`, the pass-through store must be updated
too.

## 7. Other observations

- `ClaimTaskRequest.stage` is accepted by proto/CLI/MCP but **silently ignored**
  by the handler; the store hard-codes `SetStage(task.StageWorking)`
  (`internal/store/entstore.go:807`). Clients may reasonably expect `--stage` to
  be an escape hatch; it is not.
- The kanban board can drag a task Triage → Working via `UpdateTask`. That path
  now requires `task:accept` (transition table row `triage → anything
  non-terminal`), so the accept gate is not bypassable through the UI. Web sessions authenticate
  as human/admin users (wildcard scope), so dashboard behavior is unchanged.
- Legacy tokens with `nil` scopes remain wildcard and are unaffected by the two
  new scopes — verified by `TestScopedToken_LegacyNilScopesKeepLifecycleAccess`.

## 8. Agent-typed tokens can no longer close tasks at all

This is the second half of the behavioral break and is easy to miss next to the
accept gate, so state it plainly:

**`CloseTask` now requires `task:close`, which is not in the default agent scope
set** (`DefaultScopesForUserType("agent")` = `task:read`, `task:write`,
`task:claim`, `collection:read`). The same requirement applies to reaching a
terminal stage through `UpdateTask`, so there is no alternative route.

**This means agents cannot complete their own work.** After an agent claims and
finishes a task, one of the following must happen:

- a reviewer / orchestrator / admin token closes the task on the agent's behalf,
  or
- agent tokens are re-provisioned with `task:close` added to their scopes
  (`ft token create --scopes …`, or whatever provisioning path issued them).

Every existing agent token issued before this change keeps the scopes it was
minted with, so **already-provisioned agent tokens break the moment
`DefaultScopesForUserType` is not the source of their scopes** — the scopes are
stored on the token row, not resolved per request. Re-provisioning is a data
migration, not a config flip.

Consequences for the documented agent loop (`agents.md` step 5, "Close it with
`task_close`") and for `.agents/skills/farmtable/commands/close.md`: both now
describe an operation agents are not authorized to perform. Either the scope
defaults change or the docs and the hand-off protocol must change. This decision
belongs with the same owner as the accept-gate rollout in §4.

Also worth noting alongside this: `CreateTask` now runs its explicit `stage`
argument through the transition table (as if the task were created in triage and
moved). Creating a task directly in `completed`/`wont_fix`/`duplicate`/
`cancelled` therefore requires `task:close`, and creating one directly in any
other non-triage stage requires `task:accept`. Producers that set an explicit
stage — the decomposer, importers, `ft task create --stage`, MCP `task_create` —
need a token with the matching scope. Producers that leave the stage unset are
unaffected, which is all of them today except explicit `--stage` callers.

## Bottom line

- **Code blast radius: small.** 3 handler edits, 1 new file. Store layer untouched.
- **Test blast radius: 4 always-run tests + 1 integration-gated**, all the same
  one-line fixture fix. All suites green afterward.
- **Web UI: zero breakage.**
- **Behavioral blast radius: real, at both ends of the lifecycle.** Agent-typed
  tokens can no longer start work on a freshly created task without a
  human/reviewer/orchestrator accepting it first (§4, §5), and they can no
  longer close the work when they finish it (§8). This is the intended policy,
  but it needs a rollout companion: docs updates, `accept`/`close` affordances
  and hand-off protocol for agents, a decision on whether agent tokens should be
  re-provisioned with `task:close`, and a decision on whether
  `GetReadyTasks(include_unblocked)` should keep surfacing triage tasks.
