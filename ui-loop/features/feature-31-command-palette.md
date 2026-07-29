# Feature 31: Command Palette / Global Search

**Status:** Complete — PR pending  
**Branch:** `feat/command-palette`  
**Commits:** `e4f6f27` (feat), `e448f32` (fix)  
**Date:** 2026-07-21

## Summary

Added a `<ft-command-palette>` Lit web component providing a modal overlay
triggered by `Cmd+K` / `Ctrl+K` for instant fuzzy search across all tasks
in the current collection. Searches across task name, ID, description, type,
stage label, and assignee names. Results navigable with keyboard (arrows,
Enter, Escape) and mouse (hover, click). Capped at 50 results with scroll.

## Files Changed

| File | Change |
|---|---|
| `web/src/components/ft-command-palette.ts` | **New** (500 lines) — complete palette component |
| `web/src/components/ft-app.ts` | Wired Cmd+K shortcut, state, rendering (board-view only), event handlers |
| `web/src/components/ft-shortcut-overlay.ts` | Added Cmd+K / Ctrl+K to General shortcuts group |

## Design Decisions

- **Custom overlay pattern** — Follows `ft-shortcut-overlay.ts` (fixed backdrop + centered panel), not `sl-dialog`. Better fit for search overlays.
- **Fuzzy scoring** — Custom `fuzzyScore()` with ordered character matching, gap penalties, and word-boundary bonuses. Pre-compiled regex (`WORD_BOUNDARY_RE`). Module-level `STAGE_NAMES` constant.
- **Full-field search** — `searchableText()` helper joins name, ID, description, type, stage label, and assignee names. Scores against name, ID, and full text independently; best score wins.
- **Board-view gate** — Cmd+K only opens palette when `routeView === 'board'`. Component not rendered on landing/validating pages.
- **Empty query** — Returns empty results with hint text ("Type to search tasks…"). No unfiltered task dump.
- **ARIA** — combobox + listbox + aria-activedescendant pattern, instance-unique IDs, focus trap, deep focus restoration.

## Review (Round 1)

Blind code-reviewer (--harness claude) → **APPROVE** with suggestions:
- 2 Important: stageLabel allocation, filteredTasks multiple calls → fixed
- 4 Suggestions: unique listbox ID, pre-compile regex, stage naming, editable-target comment → fixed
- Additional spec compliance fixes: full-field search, result cap (50), empty-query behavior, board-view gate → fixed

All findings addressed in fixup commit `e448f32`.

## Screenshots

Saved to `feature-31-command-palette/`:
- `02-palette-search-results.png` — palette with "task" query, filtered results with stage badges
- `04-inspector-after-select.png` — inspector opened after selecting a task

## Verification

- `tsc --noEmit` passes
- `vite build` succeeds
- Rebased cleanly onto main (including Feature 32 dashboard merge)
