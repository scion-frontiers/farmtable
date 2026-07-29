# PR 179 Follow-Up R3: Fallback Available Queue Semantics - Review

## Executive Summary

Risk level: LOW. The R3 follow-up fixes the assigned-task fallback gap and adds focused coverage for the Phase 1 fallback semantics without reintroducing removed native stage vocabulary.

## Critical Issues

None.

## Important Issues

None.

## Observations

- `web/src/utils/task-ready.ts:9` - Explicit `task.availability` remains authoritative before any fallback checks, including the new assigned-task exclusion.
- `web/src/utils/task-ready.ts:13` - The fallback continues to require `phase=OPEN` and `stage=ACCEPTED`, excluding non-open, non-accepted, active, and terminal tasks.
- `web/src/utils/task-ready.ts:16` - The prior R2 gap is fixed: fallback now excludes tasks with existing assignees, matching claim/start queue semantics where already assigned work is not claimable from the queue.
- `web/src/utils/task-ready.ts:19` and `web/src/utils/task-ready.ts:22` - Held, future-start, and incomplete-blocker exclusions remain intact. Blocker satisfaction still uses completed-only semantics.
- `web/src/utils/task-ready.test.ts:55` - The new test suite directly covers assigned fallback exclusion and the explicit-availability override. It also covers held, future-start, non-open, non-accepted, terminal, and incomplete-blocker cases.
- `web/package-lock.json` - The audit-driven lockfile change is limited to transitive npm metadata and patched `postcss`/`nanoid` versions; no new direct dependency was added.

## Positive Feedback

- The fix is deliberately scoped: it adds only the missing claim/start fallback guard while preserving the server-owned availability contract.
- The lightweight TypeScript test harness gives the previously untested predicate a fast regression check without pulling in a larger web test framework during the hotfix follow-up.

## Verification Story

- Tests reviewed: yes. Focused fallback tests cover the requested R3 cases.
- Build verified: yes. `cd web && npm run build` passed; Vite emitted the existing chunk-size warning.
- Lint/static analysis clean: yes. `git diff --check 582793ea1d7e8fcf9c0be28390a553abf2c7916f..HEAD` passed.
- Security checked: yes. `cd web && npm audit` passed with 0 vulnerabilities, and no security-sensitive code paths were changed.
- Additional verification: `cd web && npm test` passed.

## Final Verdict

APPROVE.
