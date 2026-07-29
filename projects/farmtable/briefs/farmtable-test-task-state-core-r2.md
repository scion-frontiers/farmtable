# Brief: Test Engineer R2 — Farmtable Task State Model Phase 1 Core

## Scope
Freshly evaluate tests on branch `task-state-core` in workspace `/workspace` inside your container, against `origin/main`.

Host path for the manager is `/workspace/farmtable-task-state-core`, but inside your container the mounted repo is `/workspace`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`
Prior reports to verify, not blindly trust:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core.md`

## R2 Focus
- Verify whether tests now cover the prior gaps: v2 import rejection, exact migration-note JSON payloads, terminal dependency outcomes, Beads status projection, GitHub pass-through/treewalk claim/read behavior, IncludeUnblockedOpen, and claim atomicity or best available concurrency coverage.
- Run focused tests or full tests as needed. Inspect actual assertions, not just test names.

## Required Deliverables
- Write a test review report to `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core-r2.md`.
- Write a project log entry to `.design/project-log/task-state-model-phase1-test-review-r2.md`.
- The report must include verdict `APPROVE` or `REQUEST CHANGES`, coverage findings with file:line references, commands/results, and residual test risks.

## Termination
You MUST write both deliverables and then mark the task complete.
