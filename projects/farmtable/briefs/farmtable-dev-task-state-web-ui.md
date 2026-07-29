# Brief: Farm Table Task State Model Phase 2 Web UI

## Goal
Implement the phase-2 web UI pass against the now-stable task-state contract.

## Scope
Work only in the web UI layer unless a direct contract mismatch forces a small
supporting change. The backend data model, migration, CLI, MCP, and adapters are
already merged and deployed.

Required UI outcomes:

- Remove native phase controls and deleted native stage selectors from the UI.
- Replace legacy queue labels with the contract vocabulary.
- Surface hold-reason state and computed availability in list/board/detail views.
- Show the attention workflow for dependents blocked by unsuccessful terminal
  prerequisites.
- Implement accepted queue ordering semantics that respect rank.
- Update generated TypeScript usage if needed so deleted vocabulary is not
  reachable through UI controls.

## Guardrails

- Do not reintroduce native `ready`, `blocked`, `scheduled`, `backlog`, or
  stage-level `waiting_for_input` / `deferred` controls.
- Use the server-computed availability model; do not invent client-side state
  that contradicts the contract.
- Keep changes focused on the web experience. Avoid unrelated UI redesigns.

## Deliverables

1. A commit on branch `task-state-web-ui` implementing the phase-2 UI changes.
2. A project log entry at `.design/project-log/task-state-web-ui.md`.
3. Verification evidence in the commit or summary:
   - `npm run build` in `web/`
   - targeted tests covering the affected UI behavior
   - `git diff --check`

## Termination
You MUST write the project log entry, commit the work, and then mark the task
complete.
