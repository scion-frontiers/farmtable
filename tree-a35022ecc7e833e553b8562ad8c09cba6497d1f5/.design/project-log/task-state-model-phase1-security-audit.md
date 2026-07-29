# Task State Model Phase 1 Security Audit

Date: 2026-07-27
Branch: `task-state-core`
Auditor: Security Auditor
Report: `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core.md`
Verdict: `REQUEST CHANGES`

## Scope

Reviewed `/workspace` against `origin/main` for the Phase 1 task-state core contract, with focus on claim self-assignment, `ClaimTaskRequest.assignee_id` rejection, store-level claim gating, migration actor semantics, import/export trust boundaries, adapter normalization, API compatibility, and data integrity risks.

## Findings

- High: GitHub pass-through `ClaimTask` bypasses the new availability and accept gates because `MultiStore` dispatches directly to `GitHubPassThroughStore.ClaimTask`, which only swaps labels to `working`.
- Medium: Ent-backed claim availability is computed before the write and is not atomically guarded against concurrent blocker state changes.
- Medium: Beads adapter projection maps every accepted task to external `blocked`, and the Beads JSONL import converter still emits removed native stage strings before generic migration.

## Verification

- `git diff --check origin/main...HEAD`: pass.
- Removed generated/native stage constants search: no matches.
- Focused package tests: store, platform/beads, platform/github, MCP, and CLI passed; server package failed only in `TestWatchTasks_CreatedEvent` timeout.
- Targeted state/security tests passed for import migration, claim triage rejection, store availability/claim rejection, GitHub label mapping, and Beads mapping tests.
- `npm audit --omit=dev`: found 0 vulnerabilities.
- `go list -m -json -mod=readonly all`: pass.
- `go tool govulncheck ./...`: unavailable in this toolchain.

## Follow-Up Required

Fix the GitHub pass-through claim gate before merge. The Ent claim race and Beads projection issues should be addressed in the same branch or an immediate follow-up before enabling this model broadly across external stores.
