# Task State Model Phase 1 Code Review

Date: 2026-07-27
Reviewer: `review-task-state-core`
Branch: `task-state-core`
Base: `origin/main`
Report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core.md`

## Outcome

Verdict: REQUEST CHANGES.

The branch passes the available Go and web verification, and the core enum/generated surfaces largely reflect the new native task-state vocabulary. Review found blocking correctness issues in claim invariant enforcement and external adapter/read-model normalization that should be fixed before merge.

## Findings Filed

- Critical: store `ClaimTask` computes availability before the update but does not enforce the same availability predicates atomically in the final claim write.
- Critical: Beads `phaseStageToStatus` maps every accepted task back to external `blocked`, with the `deferred` branch unreachable.
- Critical: GitHub treewalk treats every accepted open issue, and every accepted child, as blocked.
- Important: `GetReadyTasksParams.IncludeUnblockedOpen` is still exposed but ignored by the store implementation.
- Important: Beads JSONL import still emits old native stage strings into the intermediate Farm Table import document instead of normalizing at the adapter boundary.
- Important: docs/agent guidance still describe native `ON_HOLD` projection for held accepted tasks, which conflicts with the contract's compatibility-only phase guidance.

## Verification Run

- `git diff --stat origin/main...HEAD`: reviewed.
- Removed native stage constant search across proto/API/internal/web schema surfaces: no deleted enum constants found.
- Vocabulary survival search: remaining matches were expected graph/hold terms plus stale comments/docs noted in the report.
- `go test ./...`: pass.
- `go build ./...`: pass.
- `go generate ./internal/store/ent`: pass, no generated diff.
- `npm run build` in `web/`: pass with existing Vite chunk-size warning.
- `git diff --check origin/main...HEAD`: pass.
- `buf generate`: not run; `buf` is not installed in this container.

## Residual Risk

Postgres-tagged integration tests and `buf generate` still need to be run in a fully provisioned environment. Existing database row migration for pre-refactor native stage values should receive explicit migration coverage before production rollout.
