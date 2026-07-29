# PR 179: Fix available queue fallback filtering - Review

## Executive Summary

Risk level: MEDIUM. The hotfix correctly stops the observed fallback leak of `triage` and active-stage tasks by requiring `OPEN/ACCEPTED`, but it is not fully correct as a claim/start queue fallback because assigned accepted tasks can still appear when `task.availability` is absent.

## Critical Issues

None.

## Important Issues

- `web/src/utils/task-ready.ts:13` - The fallback predicate still does not exclude assigned accepted tasks. Under the Phase 1 contract, assignment is separate from availability, but the primary work queue is for tasks "available for claim/start"; `ClaimTask` rejects already assigned rows and the store queue path supports `Unassigned` filtering. With `task.availability` absent, an `OPEN/ACCEPTED` task with `assignees.length > 0`, no hold, no future start date, and no blockers returns `true`, so the web fallback can still show work that cannot be claimed from the queue.

  Suggested Fix:

  ```ts
  if (task.assignees.length > 0) {
    return false;
  }

  if (task.phase !== TaskPhase.OPEN || task.stage !== TaskStage.ACCEPTED) {
    return false;
  }
  ```

  Keep the existing early return for `task.availability` if the intended contract is that explicit server availability remains authoritative when present; otherwise split the helper into `isAvailable()` and `isQueueEligible()` so the queue can layer assignment policy over server availability without weakening the response model.

## Observations

- `web/src/utils/task-ready.ts:9` - Explicit `task.availability` remains authoritative when present. The fallback path is only used for older/incomplete frontend objects.
- `web/src/utils/task-ready.ts:13` - The changed condition requires `phase=OPEN` and `stage=ACCEPTED`, matching the hotfix target for excluding `triage` and `in_review` from fallback queue results.
- `web/src/utils/task-ready.ts:16` - Existing fallback checks still exclude held tasks and future-start tasks.
- `web/src/utils/task-ready.ts:19` - Existing fallback dependency scanning still excludes tasks with a `BLOCKED_BY` relationship whose blocker is not `COMPLETED`, matching the Phase 1 completed-only blocker satisfaction rule for the supported web snapshot case.
- `web/src/utils/task-ready.ts:13` - The hotfix does not reintroduce removed native stages such as `ready`, `blocked`, `scheduled`, or `backlog`.

## Positive Feedback

- The hotfix is narrowly scoped and addresses the live smoke symptom directly without reviving old native stage vocabulary.
- The explicit availability branch preserves the intended server-owned read model whenever the API supplies it.

## Verification Story

- Tests reviewed: yes. There are no focused web tests for `web/src/utils/task-ready.ts`, so the assigned-task fallback gap is not covered.
- Build verified: yes. `cd web && npm run build` passed; Vite emitted the existing chunk-size warning.
- Lint/static analysis clean: partial. `git diff --check 49f2e9dc7e78928e05acf41d2b35748a7da03078..582793ea1d7e8fcf9c0be28390a553abf2c7916f` passed.
- Security checked: yes. No new security-sensitive input handling, credential exposure, or dependency changes were introduced by this one-line web predicate change.

## Final Verdict

REQUEST CHANGES.

The hotfix is correct for `phase=OPEN` and `stage=ACCEPTED`, held, future-start, dependency-blocked, explicit availability, and old-vocabulary requirements. It still needs the fallback queue eligibility guard for assigned accepted tasks to satisfy the requested Phase 1 claim/start semantics.
