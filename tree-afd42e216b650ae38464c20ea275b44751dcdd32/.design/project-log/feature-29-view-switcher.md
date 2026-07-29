# Feature 29: Icon-Based View Mode Switcher

**Date:** 2026-07-21
**Status:** Complete

## Summary

Replaced the text-label view mode switcher ("Kanban" / "Tree" radio buttons) in
the toolbar with a compact, icon-based segmented control using Shoelace icons
and tooltips.

## Approach

Chose **Option A**: kept the existing `sl-radio-group` with `sl-radio-button`
components but replaced text labels with `sl-icon` elements. This preserves the
native radio-group keyboard accessibility (arrow keys, Enter/Space) and the
existing `onViewChange` handler without any modifications.

### Icons Used

- **Kanban view:** `kanban` (Bootstrap Icons — column layout icon)
- **Tree view:** `diagram-3` (Bootstrap Icons — hierarchical node diagram)

Both icons rendered correctly out of the box via Shoelace's built-in Bootstrap
Icons set.

### Tooltips

Wrapped each `sl-radio-button` in an `<sl-tooltip>` with descriptive content
("Kanban view" / "Tree view"). The tooltip import was already present in
`index.ts`.

### Styling

Added a `.view-switcher` CSS class on the radio group with `::part(button)` and
`::part(label)` selectors to make the icon-only buttons compact:

- Reduced padding to `0.25rem 0.5rem`
- Set font-size to `1.1rem` for the icons
- Used inline-flex centering on the label part

The styling works in both light and dark themes via existing Shoelace CSS
custom properties.

## Files Changed

- `web/src/components/ft-toolbar.ts` — replaced text radio buttons with
  icon+tooltip radio buttons; added `.view-switcher` CSS rules
- No changes needed in `web/src/index.ts` (tooltip already imported)

## Notable Decisions

1. **No changes to `onViewChange`**: The existing handler reads `target.value`
   from the radio group change event, which works identically with icon-only
   buttons. No adapter code needed.

2. **Extensibility**: Adding a third view is a one-line addition — just add
   another `<sl-tooltip><sl-radio-button>` entry inside the radio group.

3. **No `sl-button-group` fallback**: Option B (manual active-state management
   with `sl-icon-button`) was rejected because Option A gives us free keyboard
   navigation, ARIA semantics, and selected-state styling from the radio group.

## Verification

- TypeScript: `tsc --noEmit` — clean
- Vite build: `npm run build` — clean
- Go build: `go build ./...` — clean
- Screenshots taken with Playwright confirming kanban-active, tree-active, and
  tooltip-visible states
