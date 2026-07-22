# F53: Remove General Tab Relations Section

**Date:** 2026-07-22
**Author:** farmtable-em-f53
**Status:** Completed

## Summary

Removed the redundant read-only "Relations" section from the Inspector's General
tab. The dedicated Relationships tab remains unchanged as the sole place for
viewing and managing task relationships.

## Context

The Inspector had two confusingly similar views for relationships:
1. **General tab → "Relations"** — read-only clickable links, shown conditionally
   when `task.relationships.length > 0`. No add/delete capabilities.
2. **Relationships tab** — full CRUD with add (+), delete (trash), drag-and-drop,
   stage badges, and keyboard support.

This caused user confusion (reported in F46 investigation) — users expected
relationship management features on the General tab and didn't realize they
needed the separate Relationships tab.

## Changes

- `web/src/components/inspector/ft-inspector.ts`: Removed the `<sl-details
  summary="Relations">` conditional block (12 lines) from the General tab
  template.
- `web/src/components/inspector/ft-inspector-relations.ts`: **Deleted** entirely
  (94 lines). This read-only component is no longer needed.
- `web/src/index.ts`: Removed import of `ft-inspector-relations.js`.

No shared utilities were affected — `inspector-stage-utils.ts` exports
(`REL_GROUP_LABEL`, `REL_GROUP_ORDER`) are still used by
`ft-inspector-relationships.ts`.

## Verification

- Before/after screenshots captured on a task with BLOCKS relationship
- Before: General tab shows "Relations" section with "BLOCKS → Test task 3"
- After: General tab shows Properties → Description → Comments (no Relations)
- Relationships tab confirmed fully functional with BLOCKS entry, +/delete
  buttons, stage badges
- TypeScript check passes (`tsc --noEmit`)
- Vite build succeeds (bundle size reduced from 791.77 KB to 789.55 KB)
- Go build succeeds

## Screenshots

Before/after screenshots saved to:
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-53-remove-general-tab-relations/`
