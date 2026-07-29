# Task State Model Phase 1 Test Review

Date: 2026-07-27
Reviewer role: Test Engineer
Branch: `task-state-core`
Worktree: `/workspace`

## Summary

Completed QA/test coverage review for the Phase 1 core task state model changes against the design contract at `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`.

Verdict: REQUEST CHANGES.

The Go and web verification commands pass, but the test suite does not yet guard several contract-critical boundaries: new-format import rejection for removed stages, full terminal dependency semantics, exact persistent migration note fidelity, and adapter round-trip status mapping. One concrete Beads adapter defect was identified: `phaseStageToStatus` has duplicate `StageAccepted` branches, so accepted tasks are exported as `blocked`.

## Verification

- `go test ./internal/store ./internal/server ./internal/platform/beads ./internal/platform/github`: PASS
- `go test ./internal/cli ./internal/mcp`: PASS
- `go test ./...`: PASS
- `git diff --check origin/main...HEAD`: PASS
- `cd web && npm install && npm run build`: PASS, with npm reporting 1 high severity audit finding and Vite reporting the large chunk warning.

## Deliverables

- Test review report written to `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-core.md`.

## Required Follow-Up

- Add a v2 import rejection test for every removed native stage.
- Add terminal dependency matrix coverage for `completed`, `wont_fix`, `cancelled`, and `duplicate` without canonical replacement; add canonical duplicate coverage when persistence exists.
- Assert exact old/new JSON payloads for persistent migration notes.
- Add Beads adapter round-trip/export tests and fix the accepted/blocked/deferred mapping defect.
- Add CLI/MCP/help/schema vocabulary snapshot coverage so removed native vocabulary cannot reappear as selectable native state.
