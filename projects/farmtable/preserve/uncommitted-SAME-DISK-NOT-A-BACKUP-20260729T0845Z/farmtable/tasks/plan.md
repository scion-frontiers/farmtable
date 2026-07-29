# Implementation Plan: Task State Model Refactor

## Overview
Implement the approved task-state contract in three strictly sequenced phases: core data/API/CLI/MCP first, then web UI against the stabilized API, then final user and process documentation. Phase 1 carries the migration and API-contract blast radius, so it runs in a dedicated worktree and receives independent code, test, and security review before any merge or deployment.

## Architecture Decisions
- `stage` remains the native asserted workflow field, but its allowed native values become exactly `triage`, `accepted`, active stages, and terminal stages.
- `phase` remains as a compatibility wire projection, not a native UX control.
- `hold_reason`, `start_date`, dependency graph state, terminal outcome, priority, and rank drive server-computed availability.
- Lossy migration decisions must persist notes using the existing change-log shape unless the implementation proves a dedicated migration actor/table is required.
- Phase 1 must complete and be reviewed before web work starts because the web UI depends on generated types and server-computed availability semantics.

## Task List

### Phase 1: Core Data/API/CLI/MCP
- [ ] Task 1: Implement core persisted model, generated types, validation, migration notes, and old-format import/export migration.
- [ ] Task 2: Implement computed availability and claim gate semantics across store, RPC, CLI, and MCP.
- [ ] Task 3: Update external adapters, CLI/MCP vocabulary, generated schemas, tests, and phase-1 process docs to remove native deleted stages.

### Checkpoint: Phase 1
- [ ] `go generate ./internal/store/ent` completed after schema/proto changes.
- [ ] `go test ./...` and `go build ./...` pass in the phase worktree.
- [ ] Evidence demonstrates real migration transformations on realistic old-state data.
- [ ] Search evidence shows removed native stage vocabulary cannot be written/selected as native values.
- [ ] Independent code-reviewer, test-engineer, and security-auditor approve or only leave accepted non-blocking findings.
- [ ] Coordinator is notified before any live Cloud Run deployment because stored shape/API contracts change.

### Phase 2: Web UI
- [ ] Remove native phase, Ready, Blocked, Scheduled, and On Hold controls/columns.
- [ ] Add hold reason display/filtering, computed availability indicators, accepted queue ordering, rank drag/drop, and attention workflow.
- [ ] Verify locally with Playwright screenshots using the local-first protocol.

### Phase 3: Documentation Polish
- [ ] Update README, architecture docs, root agent guidance, CLI/MCP help docs, migration notes, and adapter fidelity notes.
- [ ] Verify docs match the final implemented CLI/MCP/web vocabulary.

## Risks and Mitigations
| Risk | Impact | Mitigation |
|------|--------|------------|
| Deleted vocabulary survives in a write path or generated artifact | High | Require `rg` evidence over proto, generated code, CLI, MCP, adapters, web, tests, and docs in every review. |
| Data migration loses meaning for blocked/scheduled/deferred rows | High | Persist compact old/new migration notes and test realistic lossy transformations. |
| Claim-by-ID bypasses computed availability | High | Enforce in store transaction and RPC path; add direct claim rejection tests. |
| Web begins against unstable core types | High | Do not launch web phase until phase 1 is merged and stable. |
| Live deployment mutates production collections unexpectedly | High | Stop after phase 1 approval and explicitly notify coordinator before live deployment. |

## Open Questions
- None for phase 1 planning. Exact proto field numbers and enum names are implementation details bounded by the approved contract.
