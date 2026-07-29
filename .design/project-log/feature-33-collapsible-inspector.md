# Feature 33: Collapsible Inspector Sections with Persisted State

**Date:** 2026-07-21
**Branch:** `feat/inspector-collapsible-sections`
**Status:** Complete

## Summary

Wrapped each section in the inspector's General tab with Shoelace `sl-details` components, enabling users to collapse and expand sections. Section open/closed state is persisted to localStorage so preferences survive page reloads.

## Changes

### ft-inspector.ts (main inspector layout)
- Removed all `sl-divider` separators between sections
- Wrapped Properties (meta), Description, Relations, and Code sections in `sl-details` components
- Added `isSectionOpen(key)` and `persistSectionState(key, open)` helper methods for localStorage persistence
- All sections default to expanded (open) on first visit
- localStorage keys follow the pattern `inspector.collapse.<section>` (e.g., `inspector.collapse.metadata`, `inspector.collapse.description`, `inspector.collapse.relations`, `inspector.collapse.code`)
- Added cohesive `sl-details` styling via `::part()` selectors (base border, header padding, content padding)
- Added consistent `margin-top: 0.75rem` spacing for all section elements (sl-details, ft-inspector-comments, ft-inspector-changes)

### ft-inspector-comments.ts
- Added localStorage persistence to existing `sl-details` (`inspector.collapse.comments` key)
- Added `?open` binding reading from localStorage for initial state
- Added `@sl-hide` handler (`onCollapse`) to persist collapsed state
- Modified `onExpand` to also persist expanded state

### ft-inspector-changes.ts
- Same pattern as comments: added `isSectionOpen()`, `onCollapse()`, localStorage persistence
- Key: `inspector.collapse.changes`

### ft-inspector-desc.ts
- Added `hideTitle` boolean property (attribute: `hide-title`) to suppress the "Description" section title when the parent sl-details already provides it
- Added `margin-left: auto` to `.actions` and direct `sl-icon-button` children in section-header so action buttons align right even without the title span
- Imported `nothing` from lit for conditional rendering

## Design Decisions

1. **No double-wrapping for comments/changes:** These components already use `sl-details` internally for lazy-loading behavior. Rather than wrapping them in another `sl-details`, localStorage persistence was added directly to their existing toggle logic.

2. **localStorage key convention:** Used `inspector.collapse.<section>` with value `'true'`/`'false'`. Default is expanded (absence of key or any value other than `'false'` means open).

3. **Global preference, not per-task:** Collapse state is per-section, not per-task. This matches the UX expectation that section visibility is a user preference, not task-specific data.

4. **sl-hide vs sl-after-hide:** Used `sl-hide` (fires at start of close) rather than `sl-after-hide` (fires after animation) for persistence to ensure state is saved promptly.

## Verification

- `npm run build` (tsc --noEmit + vite build) passes successfully
- No lint configuration was found in the project; type checking via tsc covers the quality gate
