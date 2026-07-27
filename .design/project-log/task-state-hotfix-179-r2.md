# Task State Hotfix 179 R2

Date: 2026-07-27
Branch: `task-state-hotfix-179-r2`

## Summary

Fixed the Available Queue fallback eligibility predicate used when
`task.availability` is absent. The fallback now excludes already-assigned
accepted tasks because the queue represents claim/start eligibility and assigned
tasks cannot be claimed from that queue.

The existing explicit-availability branch remains authoritative when present.
The fallback still requires `OPEN/ACCEPTED`, still excludes held tasks and
future-start tasks, and still excludes tasks with incomplete `BLOCKED_BY`
blockers.

## Verification

- `npm test` in `web/` - pass
- `npm run build` in `web/` - pass; Vite emitted the existing large chunk warning
- `git diff --check` - pass from manager worktree after recovering the agent's
  changes
