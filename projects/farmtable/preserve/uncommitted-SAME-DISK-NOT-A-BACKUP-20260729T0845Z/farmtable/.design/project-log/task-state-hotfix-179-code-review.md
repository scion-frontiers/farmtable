# Task State Hotfix 179 - Code Review

Date: 2026-07-27
Reviewer: Codex
Range: `49f2e9dc7e78928e05acf41d2b35748a7da03078..582793ea1d7e8fcf9c0be28390a553abf2c7916f`
Hotfix commit: `ebe4950d009219be46370dd07ecd25930bf45e1a`
Merge commit: `582793ea1d7e8fcf9c0be28390a553abf2c7916f`
Report: `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-hotfix-179.md`

## Outcome

Verdict: REQUEST CHANGES.

The one-line hotfix in `web/src/utils/task-ready.ts` correctly narrows fallback availability to `phase=OPEN` and `stage=ACCEPTED`, which addresses the live smoke leak of `triage` and `in_review` tasks. The fallback remains incomplete for the Phase 1 claim/start queue contract because it does not exclude assigned accepted tasks when `task.availability` is absent.

## Findings

- Important: `web/src/utils/task-ready.ts:13` should reject `task.assignees.length > 0` in the fallback path, or the web available queue can still show assigned accepted work that `ClaimTask` and the server unassigned ready-query path would reject.

## Verification

- Reviewed contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.
- Reviewed live evidence: `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-27-task-state-phase1-live.md` and `web-smoke-results.json`.
- Reviewed diff: one changed line in `web/src/utils/task-ready.ts`.
- `git diff --check 49f2e9dc7e78928e05acf41d2b35748a7da03078..582793ea1d7e8fcf9c0be28390a553abf2c7916f`: pass.
- `cd web && npm run build`: pass with existing Vite chunk-size warning.

## Notes

- Explicit `task.availability` remains authoritative when present.
- Held, future-start, and dependency-blocked fallback exclusions remain in place.
- No removed native stage vocabulary was introduced by PR #179.
