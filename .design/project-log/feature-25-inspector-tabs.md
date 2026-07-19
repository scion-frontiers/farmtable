# Feature 25: Inspector Tabs (General + Relationships)

## Date
2026-07-19

## Summary
Restructured the Inspector panel to use a two-tab layout: "General" (default active) and "Relationships". The General tab wraps all existing Inspector content unchanged, while the new Relationships tab provides a comprehensive view of task hierarchy and relationships.

## What Was Built

### Tab Structure
- Added Shoelace `<sl-tab-group>` / `<sl-tab>` / `<sl-tab-panel>` to `ft-inspector.ts`, placed between the header bar and the existing body content.
- General tab is the default active tab and contains all pre-existing Inspector sections (header, meta, description, relations, code, comments, changes) wrapped as-is.
- Tab panels remain in the DOM when inactive (Shoelace default behavior), preserving in-progress edits across tab switches.
- Arrow key navigation between tabs is handled natively by `sl-tab-group`.

### Relationships Tab
- New `ft-inspector-relationships` component displays six sections:
  1. **Parent** - looked up via `store.getTask(task.parentTaskId)`
  2. **Children** - via `store.getChildren(task.id)`
  3. **Blocked by** - grouped from `task.relationships` where `type === BLOCKED_BY`
  4. **Blocks** - grouped from `task.relationships` where `type === BLOCKS`
  5. **Related** - grouped from `task.relationships` where `type === RELATED`
  6. **Duplicate of** - grouped from `task.relationships` where `type === DUPLICATE`
- Each entry shows task name + stage badge (colored pill matching `ft-inspector-header.ts` styling).
- Empty sections show "None" in italic gray.
- Each entry is clickable, dispatching a `task-select` CustomEvent to navigate.

## Key Decisions
- Created a new `ft-inspector-relationships` component rather than reusing the existing `ft-inspector-relations` component, because the Relationships tab needs parent/children sections that `ft-inspector-relations` doesn't support.
- Duplicated `STAGE_LABEL` and `STAGE_COLOR` maps in the new component rather than extracting to shared module, to minimize scope of changes. These could be refactored to a shared location in a future cleanup.
- Kept existing `ft-inspector-relations` component in the General tab unchanged.

## Files Changed
- `web/src/components/inspector/ft-inspector.ts` - Added tab group wrapping body content
- `web/src/components/inspector/ft-inspector-relationships.ts` - New component (created)
- `web/src/index.ts` - Registered Shoelace tab components and new relationships component

## Build Verification
- TypeScript (`npx tsc --noEmit`): Pass
- Vite build (`npx vite build`): Pass
- Go build (`go build ./...`): Pass
