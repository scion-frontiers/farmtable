# Security Audit Brief: Task State Phase 1 Predeploy Migration

## Context

Farm Table Phase 1 core is merged, but deployment is held until a predeploy patch safely migrates already-persisted old task state rows and ships narrow Phase1-aware web correctness.

Developer branch/worktree:

- Branch: `task-state-predeploy-migration`
- Worktree: `/workspace/farmtable-task-state-predeploy`
- Review range: `origin/main...HEAD`
- Implementation commits: `aab015bc40f9b4dc8f0208e35487d9db81910d4b`, plus manager evidence commit `d5f12d2`

Read:

- `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
- `.design/project-log/task-state-model-phase1-predeploy-migration.md`

## Audit Scope

Audit deploy/security risk for:

- Startup migration mutating every persisted old-state row.
- `changes` audit note creation, including actor identity, spoofing/attribution concerns, and whether zero UUID is acceptable under current schema.
- Transactionality and failure behavior: no partially migrated task without an audit note, no duplicated notes, no silent corruption.
- SQLite and Postgres compatibility, including lock duration and large dataset behavior.
- Availability and claim semantics after migration.
- Minimal web correctness patch, including whether it can expose stale or misleading state in ways that affect operational safety.
- Dependency/vulnerability hygiene.

Classify findings as Critical, High, Medium, Low, or Informational. Critical/High findings should block merge.

## Suggested Verification

- `PATH="/home/scion/go/bin:$PATH" go test ./...`
- `PATH="/home/scion/go/bin:$PATH" go build ./...`
- `PATH="/home/scion/go/bin:$PATH" govulncheck ./...`
- `npm audit --omit=dev` in `web/`
- `git diff --check origin/main...HEAD`
- focused search for removed native stage write paths

## Deliverables

Write both:

- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-predeploy.md`
- `.design/project-log/task-state-model-phase1-predeploy-security-audit.md`

Report format:

- Verdict: `APPROVE` or `REQUEST CHANGES`
- Findings first, ordered by severity with file:line references
- Verification commands and outcomes
- Residual risks or follow-ups

You MUST write both deliverables and then mark the task complete.
