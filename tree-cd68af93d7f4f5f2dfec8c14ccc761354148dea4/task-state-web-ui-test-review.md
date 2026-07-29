# Task State Web UI Test Review

Date: `2026-07-27T09:20:28Z`

Reviewed branch `task-state-web-ui` at commit `2f912bbee2f4cfc2f40f2650164a56c69a697fb9`.

Requested comparison base `origin/main` at `7a0f220dbd9332cb8db62138c841777432b4eda4` was unavailable in this local checkout. Fetching `origin/main` failed because the remote required GitHub credentials in this environment.

Verification run from `/workspace/web`:

- `npm test` passed.
- `npm run build` passed. Vite emitted the existing-style large chunk warning for an 835.33 kB minified JS asset.

Verdict: REQUEST CHANGES

Primary reason: the new tests are helper-level only and do not prove several contract-facing UI behaviors. More importantly, native stage controls remain reachable in the implementation: `ft-toolbar` renders a `Stage` select from `NATIVE_STAGE_OPTIONS`, and kanban drag/drop still emits and handles native `stage-change` updates that send `{ stage, phase }` to `updateTask()`. The current `npm test` suite passes despite those reachable controls because it never renders or interacts with the toolbar, kanban column, or kanban view.

Coverage summary:

- Fallback ready predicate tests are meaningful and cover server availability precedence plus conservative legacy fallback cases.
- Rank ordering is covered for `compareAcceptedQueueOrder()`, but not in ready queue or kanban rendering.
- Hold-reason and availability filters are partially covered through `matchesTaskFilters()`, but rendered labels, select options, chip labels, and clear events are untested.
- Attention workflow is covered only through `attentionBlockers()` for a cancelled blocker; the visible `Needs attention` badge and other unsuccessful terminal stages are untested.
- No tests prove native phase controls are absent or that native stage selectors/mutators are unreachable.

Full report written to `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-web-ui.md`.

