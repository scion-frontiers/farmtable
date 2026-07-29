# Test Review: Task State Hotfix PR #179 R2

Verdict: REQUEST CHANGES

Review target:
- Branch: `task-state-hotfix-179-r2`
- Commit under review: `6eaae26` (`Fix fallback availability for assigned tasks`)
- Base requested: `origin/main` at `582793ea1d7e8fcf9c0be28390a553abf2c7916f`

Note: local Git metadata is broken in this workspace. `/workspace/.git` points at `/workspace/farmtable/.git/worktrees/farmtable-task-state-hotfix-179-r2`, which is absent, so I could not run `git diff` locally. I reviewed the checked-out files directly.

## Test Coverage Analysis

### Current Coverage

- `web/src/utils/task-ready.test.ts` is the only web test file.
- `npm test` runs `tsc -p tsconfig.test.json && node .tmp-test/utils/task-ready.test.js`.
- Covered cases in `web/src/utils/task-ready.test.ts`:
  - Assigned accepted task with no explicit `availability` is fallback-ineligible.
  - Explicit `availability.available: true` overrides fallback ineligibility for an assigned task.
  - Unassigned accepted task with no explicit `availability` is fallback-eligible.
  - Task blocked by an incomplete blocker is fallback-ineligible.

### Blocking Coverage Gaps

1. Missing authoritative negative explicit availability coverage.
   - File: `web/src/utils/task-ready.test.ts:60`
   - Current test proves explicit `available: true` wins over fallback ineligibility, but does not prove explicit `available: false` wins over fallback eligibility.
   - Why it matters: the contract is that explicit availability is authoritative. A future change could incorrectly combine explicit availability with fallback and still pass the current suite.
   - Recommended test: accepted, unassigned task with `availability: { available: false, reasons: [...] }` returns `false`.

2. Missing fallback exclusions for holds and future start dates.
   - File: `web/src/utils/task-ready.ts:19`
   - No tests exercise `holdReason !== undefined` or `hasFutureStartDate(task)`.
   - Why it matters: these are part of the requested preserved behavior for the fallback Available Queue path. The current test suite would not catch a regression that makes held or future-start tasks claimable when backend availability is absent.
   - Recommended tests:
     - accepted, unassigned task with `holdReason: TaskHoldReason.WAITING_FOR_INPUT` returns `false`.
     - accepted, unassigned task with a future `startDate` returns `false`.

3. Missing fallback exclusions for non-open and non-accepted tasks.
   - File: `web/src/utils/task-ready.ts:13`
   - No tests exercise `phase !== TaskPhase.OPEN` or `stage !== TaskStage.ACCEPTED`.
   - Why it matters: the hotfix is specifically a fallback eligibility guard when `task.availability` is absent. Without these tests, `working`, `triage`, or closed states could re-enter the Ready Queue without failing `npm test`.
   - Recommended tests:
     - `phase: TaskPhase.IN_PROGRESS`, `stage: TaskStage.WORKING` returns `false`.
     - `phase: TaskPhase.OPEN`, `stage: TaskStage.TRIAGE` returns `false`.
     - At least one closed/terminal task returns `false`.

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
- Vite emitted the existing large chunk warning for `dist/assets/index-*.js`; this is not related to the hotfix test coverage.

## Root Cause

The added regression test proves the reported assigned-task fallback bug directly, but the test file is not a comprehensive specification of fallback readiness. It has four hand-written assertions and only covers one branch of each broader rule. The implementation currently contains the expected checks, but the test suite does not preserve several required behaviors.

## Required Before Approval

Add focused `isReady` assertions covering:
- explicit `availability.available: false` remains authoritative for an otherwise fallback-eligible task;
- held accepted tasks are fallback-ineligible;
- future-start accepted tasks are fallback-ineligible;
- non-open phase tasks are fallback-ineligible;
- non-accepted stage tasks are fallback-ineligible.

Re-run:

```bash
cd /workspace/web && npm test
cd /workspace/web && npm run build
```
