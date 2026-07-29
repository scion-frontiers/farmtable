# Test Review: Task State Hotfix PR #179 R3

Verdict: APPROVE

Review target:
- Branch: `task-state-hotfix-179-r2`
- Final HEAD requested: `7a0f220`
- Prior R2 report: `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-hotfix-179-r2.md`

Note: local Git metadata is still not usable in this workspace. `git -C /workspace rev-parse HEAD` fails because `/workspace/.git` points at a missing worktree Git dir under `/workspace/farmtable/.git/worktrees/farmtable-task-state-hotfix-179-r2`. I reviewed the checked-out files directly.

## Test Coverage Analysis

### Current Coverage

`web/src/utils/task-ready.test.ts` now covers the requested fallback Available Queue eligibility behavior:

- Explicit availability is authoritative:
  - `availability.available: true` keeps an assigned task ready.
  - `availability.available: false` keeps an otherwise fallback-eligible task unavailable.
- Fallback eligibility includes unassigned accepted tasks.
- Fallback eligibility excludes:
  - assigned accepted tasks;
  - held accepted tasks;
  - future-start accepted tasks;
  - non-open tasks;
  - non-accepted open tasks;
  - terminal tasks;
  - tasks blocked by incomplete blockers.

These assertions cover the R2 blocking gaps and directly prove the regression guard for assigned accepted tasks when `task.availability` is absent.

### Recommended Tests

No blocking coverage gaps remain for the requested hotfix scope.

Optional future hardening:
- Add a case for a completed blocker allowing readiness to document the positive blocker path.
- Move from the custom `assertEqual` runner to the project’s eventual web test framework if one is adopted later.

### Priority

- Critical: none.
- High: none.
- Medium: optional completed-blocker positive-path coverage.
- Low: optional runner ergonomics cleanup when broader web test infrastructure exists.

## Verification Commands

Command:

```bash
cd /workspace/web && npm test
```

Expected output:
- TypeScript test build succeeds.
- `task-ready.test.js` exits 0.

Actual output:
- Passed.

Command:

```bash
cd /workspace/web && npm run build
```

Expected output:
- `tsc --noEmit` succeeds.
- Vite production build succeeds.

Actual output:
- Passed.
- Vite emitted the existing large chunk warning for `dist/assets/index-*.js`; this is not related to the hotfix.

## Root Cause Analysis

The R2 gap was test coverage, not observed implementation failure. R3 closes that gap by adding direct state-based assertions for each requested fallback exclusion and both directions of explicit availability authoritativeness.

## Verdict

APPROVE. The R3 tests prove the regression and preserve the expected fallback behavior requested for this hotfix.
