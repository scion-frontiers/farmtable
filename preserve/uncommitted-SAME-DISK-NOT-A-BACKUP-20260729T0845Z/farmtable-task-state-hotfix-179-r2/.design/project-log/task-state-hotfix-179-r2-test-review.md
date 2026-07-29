# Task State Hotfix PR #179 R2 Test Review

Date: 2026-07-27
Agent: `test-task-state-hotfix-179-r2`
Verdict: REQUEST CHANGES

Reviewed checked-out branch `task-state-hotfix-179-r2` for commit `6eaae26` against the requested fallback Ready Queue eligibility contract.

Git metadata in the workspace is not usable: `/workspace/.git` points to a missing worktree Git dir under `/workspace/farmtable/.git/worktrees/farmtable-task-state-hotfix-179-r2`. I reviewed the source files directly instead of diffing against `582793ea1d7e8fcf9c0be28390a553abf2c7916f`.

Findings:
- `web/src/utils/task-ready.test.ts` proves the main regression: assigned accepted tasks without explicit `availability` are not ready.
- The same file also covers explicit `available: true`, unassigned accepted fallback eligibility, and incomplete blockers.
- Coverage is still missing for explicit `available: false`, holds, future `startDate`, non-open phases, and non-accepted stages. These are requested preserved behaviors for the fallback path, so the gaps block approval from a test-review standpoint.

Verification:

```bash
cd /workspace/web && npm test
```

Result: passed.

```bash
cd /workspace/web && npm run build
```

Result: passed. Vite reported the existing large chunk warning.

Primary report written to:

```text
/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-hotfix-179-r2.md
```
