# Feature 25: Inspector Tabs (General + Relationships)

## Status
COMPLETE — PR #71 opened, CLEAN/MERGEABLE, awaiting coordinator merge.

## Investigation Findings

### Data Model (proto/farmtable.proto)
- **`Task.parent_task_id`** (field 15): Optional UUID, supports up to 8 levels of hierarchy.
- **`Task.relationships`** (field 16): Repeated `Relationship` messages.
- **`Relationship` message** (line 211): `type` (RelationshipType enum) + `target_task_id` (UUID).
- **`RelationshipType` enum** (line 83): BLOCKS (1), BLOCKED_BY (2), RELATED (3), DUPLICATE (4).

### Existing Frontend Support — NO NEW BACKEND NEEDED
1. **`TaskStore.getTask(id)`**: Returns a Task by ID from the in-memory store (all board tasks loaded via WatchTasks stream).
2. **`TaskStore.getChildren(parentId)`**: Already exists! Client-side filter: `allTasks.filter(t => t.parentTaskId === parentId)`.
3. **`ft-inspector-relations.ts`**: Already renders non-hierarchical relationships, grouped by type. Dispatches `task-select` events for navigation.
4. **`task-select` custom event**: Already handled by `ft-app.ts` — sets `selectedTaskId` to open Inspector for a different task. Navigation already works.
5. **`task.parentTaskId`** field available on the frontend Task type, can look up parent via `store.getTask(task.parentTaskId)`.

### Implementation Approach
- **Pure frontend change** — no backend/proto changes needed.
- **General tab**: Wrap existing Inspector body content in Shoelace `<sl-tab-panel>`. sl-tab-group keeps inactive panels in DOM, preserving in-progress edits.
- **Relationships tab**: New `<ft-inspector-relationships>` component combining:
  - Parent task (from `store.getTask(task.parentTaskId)`) — name + stage badge
  - Children (from `store.getChildren(task.id)`) — name + stage badge
  - Blocking/blocked-by/related/duplicate relationships — name + stage badge
  - Empty states ("None") for each category
  - Click-to-navigate via existing `task-select` event pattern
  - Full keyboard accessibility (tabindex, role=button, Enter/Space, focus-visible)
- **Tab chrome**: Shoelace `<sl-tab-group>` with native ARIA tabs pattern and arrow key navigation.
- **Shared utils**: Extracted STAGE_LABEL, STAGE_COLOR, REL_GROUP_LABEL, REL_GROUP_ORDER to `inspector-stage-utils.ts`.

## What Was Built

### Files Changed
| File | Change |
|------|--------|
| `web/src/components/inspector/ft-inspector.ts` | Added `sl-tab-group` with General + Relationships tabs |
| `web/src/components/inspector/ft-inspector-relationships.ts` | **New** — Relationships tab component |
| `web/src/components/inspector/inspector-stage-utils.ts` | **New** — Shared stage/relationship label maps |
| `web/src/components/inspector/ft-inspector-header.ts` | Imports from shared utils (dedup) |
| `web/src/components/inspector/ft-inspector-relations.ts` | Imports from shared utils (dedup) |
| `web/src/index.ts` | Registers Shoelace tab components + new component |

### Commits
1. `f56e5eb` → feat: add Inspector tabs with General and Relationships views (rebased)
2. `2eb9b99` → fix: address R1 review findings for inspector tabs (rebased)

## Review Rounds
- **R1**: APPROVE — 2 Important (unused import, keyboard a11y), 2 Minor (stage/rel map duplication), 1 Nitpick. All fixed.
- **R2**: APPROVE — only nitpicks remaining (pre-existing a11y gap in old relations component). Per exit criteria, shipped.

## Conflict/Rebase Notes
- Feature 24 (PR #70) merged to main as commit b3826bd while F25 was in review.
- F24 touched ONLY `ft-inspector-meta.ts` (date-field 2×2 grid). F25 did NOT touch that file.
- Rebase onto `origin/main` was **clean — no conflicts**.
- F24's date grid renders correctly inside F25's General tab (black-box wrap approach validated).
- All builds (tsc, vite, go) pass after rebase.

## Worktree Experience
- Created at `/workspace/farmtable-f25-inspector-tabs` on branch `feat/inspector-tabs` from `origin/main`
- `npm ci` + `vite build` completed successfully (~5 seconds each)
- Clean worktree isolation — no interference with main checkout or F24's parallel worktree
- Branch exclusivity correctly prevented accidental collisions
- Worktree pattern continues to work smoothly (3rd feature using it)

## Screenshots

Saved under `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-25-inspector-tabs/`:

| File | md5sum | Description |
|------|--------|-------------|
| `01-general-tab.png` | `35684a81a7b778847fd26f0719db45ef` | General tab active (default), showing full Inspector content incl. F24's date grid |
| `02-relationships-populated.png` | `4f4ed0b6df926d14f4bb126a624e130b` | Relationships tab with 2 children populated (stage badges), other sections "None" |
| `03-relationships-empty.png` | `cfbf28fdf0204d4d82b40ac6b06757ea` | Relationships tab, all 6 sections showing "None" empty state |

All 3 md5sums are distinct. Captured via Playwright against local dashboard + Vite dev server.

## PR
- **PR #71**: https://github.com/scion-frontiers/farmtable/pull/71
- **Status**: CLEAN/MERGEABLE
- **Base**: main (includes F24 merge)
