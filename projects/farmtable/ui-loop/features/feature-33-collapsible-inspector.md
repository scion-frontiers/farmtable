# Feature 33: Collapsible Inspector Sections with Persisted State

## Status: PR #84 OPEN, CLEAN/MERGEABLE

## Summary
Added collapsible sections to the Inspector's General tab using Shoelace `<sl-details>` components. Each section can be expanded/collapsed via a disclosure header with an animated chevron. Collapse/expand state is persisted to `localStorage` so preferences survive page reloads.

## Implementation

### Architecture
- **Parent wrapping (ft-inspector.ts):** Properties, Description, Relations, and Code sections are wrapped in `<sl-details>` at the parent level. The Header section (task title + badges) remains always visible.
- **In-component persistence (ft-inspector-comments.ts, ft-inspector-changes.ts):** Comments and Change History already used `<sl-details>` internally for lazy-loading. Rather than double-wrapping, localStorage persistence was added directly to their existing `<sl-details>` components.
- **hide-title attribute (ft-inspector-desc.ts):** A `hide-title` boolean attribute was added so the parent's `<sl-details summary="Description">` replaces the component's own section title, avoiding redundancy.

### localStorage Keys
- `inspector.collapse.metadata` — Properties section
- `inspector.collapse.description` — Description section
- `inspector.collapse.relations` — Relations section (conditional)
- `inspector.collapse.code` — Code Context section (conditional)
- `inspector.collapse.comments` — Comments section
- `inspector.collapse.changes` — Change History section

Default: all sections expanded (`!== 'false'` check means absent keys default to true).

### Files Changed
- `web/src/components/inspector/ft-inspector.ts` — main layout changes, section wrapping, CSS
- `web/src/components/inspector/ft-inspector-comments.ts` — localStorage persistence added
- `web/src/components/inspector/ft-inspector-changes.ts` — localStorage persistence added
- `web/src/components/inspector/ft-inspector-desc.ts` — hide-title attribute added

## Review
- **Round 1:** APPROVE — blind code-reviewer agent found only suggestions/nitpicks:
  - Suggestion: redundant localStorage write on `sl-show` during initial render (not a bug)
  - Suggestion: DRY opportunity for persistence pattern (acceptable at current scope)
  - Nitpick: CSS comment for `margin-left: auto` with `hideTitle`
  - Nitpick: localStorage key `metadata` vs summary text `Properties` naming

## Screenshots
Saved at `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-33-collapsible-inspector/`:
1. `01-sections-expanded.png` — all sections expanded (default state)
2. `02-sections-collapsed.png` — Properties and Description collapsed
3. `03-persistence-after-reload.png` — collapse state persisted after page reload

## Branch
- Worktree: `/workspace/farmtable-f33-collapsible-inspector`
- Branch: `feat/inspector-collapsible-sections`
- PR: https://github.com/scion-frontiers/farmtable/pull/84
