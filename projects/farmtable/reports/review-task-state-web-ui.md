# Review: task-state-web-ui

## Executive Summary
Risk level: MEDIUM. The Phase 2 UI mostly adopts the task-state contract vocabulary, server availability model, rank ordering, and dependency attention workflow, but the board still drops three native terminal outcomes and mock change history still surfaces deleted stage vocabulary.

## Critical Issues
None.

## Important Issues
- [web/src/components/kanban/ft-kanban-view.ts:29] The kanban board only defines columns through `Completed`, while `WONT_FIX`, `DUPLICATE`, and `CANCELLED` remain valid native terminal stages and are exposed by the toolbar stage filter via `NATIVE_STAGE_OPTIONS`. A user can filter for those stages, receive matching data from the server/store, and still see no tasks because `render()` only iterates `BOARD_COLUMNS`; the missing terminal stages are therefore not reachable in the board UI even though Phase 2 requires replacing the old queue/stage vocabulary with the full native contract vocabulary.

  Suggested Fix:

  ```ts
  const BOARD_COLUMNS: ColumnDef[] = [
    { stage: TaskStage.TRIAGE, label: 'Triage', phase: TaskPhase.OPEN },
    { stage: TaskStage.ACCEPTED, label: 'Accepted', phase: TaskPhase.OPEN },
    { stage: TaskStage.WORKING, label: 'Working', phase: TaskPhase.IN_PROGRESS },
    { stage: TaskStage.IN_REVIEW, label: 'In Review', phase: TaskPhase.IN_PROGRESS },
    { stage: TaskStage.IN_QA, label: 'In QA', phase: TaskPhase.IN_PROGRESS },
    { stage: TaskStage.DEPLOYING, label: 'Deploying', phase: TaskPhase.IN_PROGRESS },
    { stage: TaskStage.COMPLETED, label: 'Completed', phase: TaskPhase.CLOSED },
    { stage: TaskStage.WONT_FIX, label: "Won't Fix", phase: TaskPhase.CLOSED },
    { stage: TaskStage.DUPLICATE, label: 'Duplicate', phase: TaskPhase.CLOSED },
    { stage: TaskStage.CANCELLED, label: 'Cancelled', phase: TaskPhase.CLOSED },
  ];
  ```

  Also update [web/src/components/kanban/ft-kanban-column.ts:11] so `STAGE_COLOR` includes the same terminal stages, or reuse `STAGE_COLOR` from `task-state-utils.ts`.

- [web/src/gen/service.ts:396] The mock service's visible change-history fixtures still contain deleted stage labels: `Ready -> Working` at line 400 and `Working -> Blocked` at line 424. These values are rendered verbatim by the inspector change history, so deleted native vocabulary remains visible in the UI despite the Phase 2 guardrail to avoid vocabulary survival through labels.

  Suggested Fix:

  ```ts
  const MOCK_CHANGES: Record<string, Change[]> = {
    '10000000-0000-0000-0000-000000000002': [
      {
        id: 'ch1', taskId: '10000000-0000-0000-0000-000000000002',
        field: 'stage', oldValue: 'Accepted', newValue: 'Working',
        changedBy: MOCK_USERS.u2, changedAt: NOW,
      },
      // ...
    ],
    '10000000-0000-0000-0000-000000000006': [
      {
        id: 'ch5', taskId: '10000000-0000-0000-0000-000000000006',
        field: 'hold_reason', oldValue: null, newValue: 'Waiting for input',
        changedBy: MOCK_USERS.u2, changedAt: NOW,
      },
    ],
  };
  ```

## Observations
- [web/src/components/ft-dashboard-view.ts:158] The implementation uses `computeReadyCount` and `navigateToReadyQueue` internal names/comments while rendering the contract label `Available`. This is not user-facing except comments and method names, so it is not blocking, but renaming these to `computeAvailableCount` and `navigateToAvailableQueue` would reduce future vocabulary drift.

## Positive Feedback
- [web/src/util/task-state-utils.ts:30] `NATIVE_STAGE_OPTIONS` contains only the Phase 2 native stage set and excludes `ready`, `blocked`, `scheduled`, `backlog`, `waiting_for_input`, and `deferred` as stages.
- [web/src/components/ft-toolbar.ts:328] The old phase filter is replaced with active/closed group, native stage, hold, availability, and assignee filters.
- [web/src/util/task-state-utils.ts:103] Queue sorting correctly implements priority, rank, created-at, then task ID, and the targeted test covers that order.
- [web/src/components/inspector/ft-inspector-relationships.ts:213] The dependency attention workflow correctly detects unsuccessful terminal prerequisites and offers remove/rewire actions.
- [web/src/gen/types.ts:22] The hand-written generated `TaskStage` enum no longer exposes the deleted native stage values.

## Test Coverage
New utility coverage exists for queue ordering, availability filters, active/closed grouping, and unsuccessful terminal attention blockers in [web/src/util/task-state-utils.test.ts:60]. There is still no component-level coverage proving every native terminal stage is rendered in the board, which would have caught the missing `wont_fix` / `duplicate` / `cancelled` columns.

## Backward Compatibility
The UI still carries `phase` in generated `Task` objects as a wire projection, which matches the contract. The changed UI controls do not expose native phase selection or deleted stage selection, but the mock change history does still expose deleted stage labels.

## Verification Story
- Tests reviewed: yes; focused on `task-ready` and `task-state-utils` coverage.
- Build verified: yes; `cd web && npm run build` passed with Vite's existing chunk-size warning.
- Lint/static analysis clean: no dedicated lint script is defined in `web/package.json`; TypeScript checks passed as part of build/test.
- Security checked: yes; no new credential exposure or untrusted HTML injection found in the reviewed delta.
- Diff basis: the requested base commit `7a0f220dbd9332cb8db62138c841777432b4eda4` was not present locally and `git fetch origin main` failed because GitHub credentials were unavailable, so review used the checked-out target commit `2f912bb` and the locally available changed web files.

## Final Verdict
REQUEST CHANGES
