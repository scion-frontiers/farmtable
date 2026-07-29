# Brief: Code Reviewer R2 — Farmtable Task State Model Phase 1 Core

## Scope
Freshly review branch `task-state-core` in workspace `/workspace` inside your container, against `origin/main`.

Host path for the manager is `/workspace/farmtable-task-state-core`, but inside your container the mounted repo is `/workspace`.

Authoritative contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
Developer project log: `.design/project-log/task-state-model-phase1-core.md`
Prior reports to verify, not blindly trust:
- `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core.md`
- `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-core.md`

## R2 Focus
- Verify whether the prior blockers are actually fixed: atomic Ent claim gate, GitHub pass-through claim gate, Beads projection/import normalization, GitHub treewalk blocked read model, IncludeUnblockedOpen semantics, v2 import rejection, terminal dependency matrix, migration-note payload assertions, and stale ON_HOLD/docs/comments.
- Inspect real diffs and run/cite real commands. Do not rely on developer or prior-review summaries.
- Continue to check for accidental survival of deleted native stage values.

## Required Deliverables
- Write a review report to `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-core-r2.md`.
- Write a project log entry to `.design/project-log/task-state-model-phase1-code-review-r2.md`.
- The report must include verdict `APPROVE` or `REQUEST CHANGES`, findings ordered by severity with file:line references, verification commands/results, and residual risks.

## Termination
You MUST write both deliverables and then mark the task complete.
