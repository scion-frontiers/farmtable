# Feature 29: Icon-Based View Mode Switcher — Log

## Status: PR OPEN — Awaiting merge
- **PR:** https://github.com/scion-frontiers/farmtable/pull/79
- **Branch:** feat/view-mode-icons
- **Merge status:** CLEAN / MERGEABLE
- **Commits:** 2 (feat + review fixup)

## What was done

Replaced the text-label view switcher (`sl-radio-group` with "Kanban"/"Tree" text labels) in `ft-toolbar.ts` with a compact, icon-based segmented control:

- **Kanban icon:** `kanban` (Bootstrap Icons via Shoelace)
- **Tree icon:** `diagram-3` (Bootstrap Icons via Shoelace)
- Each wrapped in `<sl-tooltip>` for hover labels
- Kept existing `sl-radio-group` / `sl-radio-button` structure — preserves keyboard nav, ARIA semantics, selected-state styling with zero custom JS
- Added `.view-switcher` CSS class with compact icon-only styling via `::part()` selectors

## Files changed

- `web/src/components/ft-toolbar.ts` — view switcher template + CSS
- `.design/project-log/feature-29-view-switcher.md` — project log

## Review cycle

### Round 1
- **Verdict:** APPROVE
- **Suggestions applied:**
  1. S1: Added explicit `aria-label` on each `sl-radio-button` for screen-reader robustness
  2. S2: Added `min-width: 2rem; min-height: 2rem` for touch-friendly hit targets
- Both suggestions addressed in fixup commit `14dac97`

## Screenshots
Saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-29-view-switcher/`
- `kanban-active.png` — Kanban icon highlighted, kanban board visible
- `tree-active.png` — Tree icon highlighted, tree view visible
- `tooltip-visible.png` — "Tree view" tooltip displayed on hover

## Key decisions
- Kept `sl-radio-group` pattern rather than custom button-group — free keyboard nav and ARIA
- Icons: `kanban` + `diagram-3` — clear visual metaphors, available in Shoelace's icon set
- Easily extensible: adding a third view is a single template addition
