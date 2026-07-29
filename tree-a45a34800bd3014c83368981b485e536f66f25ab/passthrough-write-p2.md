# Phase 2: Capability-Based UI Gating

**Date:** 2026-07-22
**Branch:** feat/passthrough-write-p2
**Base:** 2ac0945 (Phase 1: Core Write-Through)

## What Was Implemented

Replaced the binary `readOnly` prop with per-operation capability flags for
GitHub passthrough collections. Unmappable operations now show as disabled with
explanatory tooltips, while mappable operations continue to work normally.

### Capability Model

Created a new `CollectionCapabilities` interface with 15 per-operation boolean
flags. Three capability set constants cover the known platforms:

- **ALL_ENABLED** — Farmtable-platform collections (full access)
- **GITHUB_CAPABILITIES** — writable GitHub collections (true for mappable ops,
  false for unmappable ops like dates, acceptance criteria, relationships, code
  context, deletion, and drag-reorder)
- **ALL_DISABLED** — read-only external or unknown platforms

The `getCapabilities()` function derives the correct set based on the
collection's platform and `remoteData.writable` flag.

### UI Gating

Components now check granular capability flags instead of (or alongside) the
aggregate `readOnly` boolean:

- **Date edit controls:** gated by `canEditDates` — disabled with tooltip "No
  native date fields on GitHub issues" for GitHub collections
- **Assignee controls:** gated by `canChangeAssignee` — true for GitHub, so
  behavior is unchanged but future-proofed for other platforms
- **Stage-change drag:** gated by `canChangeStage` — true for GitHub
- **Add Task button:** gated by `canCreateTask` — true for GitHub
- **Hierarchy drag (reparenting):** gated by `canChangeParent` — true for GitHub

The `readOnly` prop is preserved as a fallback for operations that map directly
to GitHub (labels, title, description, etc.), ensuring backward compatibility.

## Files Changed

| File | Change |
|------|--------|
| `web/src/capabilities.ts` | **NEW** — CollectionCapabilities interface, capability sets, getCapabilities(), CAPABILITY_TOOLTIPS |
| `web/src/components/ft-app.ts` | Added `capabilities` computed getter; pass to ft-inspector, ft-kanban-view, ft-tree-view |
| `web/src/components/inspector/ft-inspector.ts` | Accept and pass capabilities to ft-inspector-meta and ft-inspector-desc |
| `web/src/components/inspector/ft-inspector-meta.ts` | Date editing gated by `canEditDates` with tooltip; assignee editing gated by `canChangeAssignee`; new `renderDisabledDateCell()` method |
| `web/src/components/inspector/ft-inspector-desc.ts` | Accept capabilities property (for future extensibility) |
| `web/src/components/kanban/ft-kanban-column.ts` | Accept capabilities; stage-change drag gated by `canChangeStage`; add-task button gated by `canCreateTask` |
| `web/src/components/kanban/ft-kanban-view.ts` | Accept capabilities; Add Task button gated by `canCreateTask`; pass capabilities to columns |
| `web/src/components/tree/ft-tree-view.ts` | Accept capabilities; hierarchy drag gated by `canChangeParent` via `isReparentDisabled` getter |

## Key Decisions

1. **Capabilities live in a separate module** (`capabilities.ts`) rather than
   in `gen/types.ts` — keeps generated types clean and makes the capability
   model independently testable.

2. **`readOnly` is preserved alongside capabilities** — components check the
   specific capability flag for operations that differ across platforms, but
   continue using `readOnly` for operations that are universally supported when
   a collection is writable. This avoids changing every readOnly check and
   maintains backward compatibility.

3. **Undefined capabilities default to allowing** — the `!== false` pattern
   (e.g., `capabilities?.canEditDates !== false`) means components without
   capabilities behave as before. This is safe because only writable external
   collections get GITHUB_CAPABILITIES; read-only collections still get the
   aggregate `readOnly=true` guard.

4. **Tooltips via `<sl-tooltip>`** — disabled date cells wrap the value in an
   `<sl-tooltip>` component with `hoist` to avoid clipping in the date grid
   layout.

5. **Tree view uses `isReparentDisabled` getter** — consolidates the
   `readOnly || !canChangeParent` check into a single getter used by all five
   drag-related methods.

6. **Kanban column uses `isStageChangeDragDisabled` getter** — same pattern
   for the four stage-change drag handlers.

## Deviations from Design Doc

- The design doc lists acceptance criteria, relationships, code context, and
  task deletion as controls to disable in ft-inspector-meta. However, these
  controls do not exist in ft-inspector-meta — they are either in other
  components (ft-inspector-relationships, ft-inspector-code) or not yet
  implemented. The capability flags and tooltips are defined and ready for
  use when those controls are added.

- The design doc suggests checking `canDragReorder` for within-column drag.
  The kanban implementation has no within-column reorder mechanism (cards are
  always sorted by priority/creation date), so `canDragReorder` is defined
  in the capability model but has no active check in the kanban column. It
  will take effect if reorder support is added later.
