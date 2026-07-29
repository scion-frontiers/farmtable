# Task State Model Phase 1 Core - Code Review R2

Date: 2026-07-27
Branch: `task-state-core`
Reviewer: Codex
Base: `origin/main` (`a2442ffa98fefc6fbb408e774344960e991f58cb`)
Report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core-r2.md`

## Outcome

Verdict: REQUEST CHANGES.

R2 confirmed that the R1 blockers are mostly fixed: Ent claim uses transactional conditional predicates, GitHub pass-through claim has an availability gate, Beads import/export normalization no longer maps accepted tasks to blocked, GitHub treewalk does not treat accepted as blocked, `IncludeUnblockedOpen` has distinct behavior, v2 import rejects removed native stages, terminal dependency availability and migration-note payloads have tests, and stale native ON_HOLD wording was largely removed.

## Findings

- High: `GetBlockedTasks` still uses `blocker.Phase != closed` to decide unresolved blockers, which hides dependents blocked by `wont_fix`, `cancelled`, or `duplicate` blockers even though the new contract says only `completed` satisfies dependencies.
- Medium: format v2 imports can persist invalid hold-state combinations because `migrateTaskState` copies `hold_reason` for native stages and `EntStore.ImportCollection` bypasses `validateTaskStateForWrite`.

## Verification

- `git diff --check origin/main...HEAD`: pass.
- `go test ./internal/store ./internal/server ./internal/platform/beads ./internal/platform/github ./internal/mcp ./internal/cli`: pass.
- `go build ./...`: pass.
- `go test ./...`: pass.
- `go generate ./internal/store/ent`: pass, no generated diff.
- `cd web && npm run build`: pass with existing Vite chunk-size warning.
- `buf generate`: unavailable in container.

## Next Step

Fix the blocked read model to share `terminalStageSatisfiesDependency`, add terminal matrix coverage for `GetBlockedTasks`, and enforce create/update state validation rules on imported v2 task state.
