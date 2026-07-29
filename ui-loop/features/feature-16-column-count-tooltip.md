# Feature 16: Column Count Chip Filter State + Tooltip

## What Was Built

- Updated `/workspace/farmtable/web/src/components/kanban/ft-kanban-column.ts`.
  - Added a `.count.filtered` style using Shoelace primary tint tokens for a subtle blue filter state.
  - Added a local `isFiltered` boolean using the existing Feature 15 condition: `this.totalCount > 0 && sorted.length !== this.totalCount`.
  - Reused `classMap` to apply the `filtered` class only for filtered counts.
  - Wrapped the count chip in `<sl-tooltip>` only when filtered.
  - Kept the plain count chip unwrapped and preserved the existing `aria-label`.
- Updated `/workspace/farmtable/web/src/index.ts`.
  - Added the Shoelace tooltip component import.

## Verification

- Build passed clean with:
  - `cd /workspace/farmtable/web && npm run build`
- Playwright verification used:
  - `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium`
  - Playwright from `/scion-volumes/scratchpad/web-test/node_modules`
  - App origin: `https://farmtable-qo7k5fvpda-uc.a.run.app`
  - Real UI `click()` interactions for selecting the Phase filter.
  - Real UI `hover()` interaction for showing the tooltip.
  - `page.evaluate()` only for allowed in-memory fixture seeding.

## Screenshots

- Plain count, no filter active:
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-16-column-count-tooltip/plain-count.png`
  - MD5: `01216f0f335d8c5ce344db59e615999e`
- Filtered count tint:
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-16-column-count-tooltip/filtered-count-tint.png`
  - MD5: `5a8067c9b72b7a3dcd6f0f95b2c5629c`
- Filtered count tooltip on hover:
  - `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-16-column-count-tooltip/filtered-count-tooltip.png`
  - MD5: `070c02567d5905e0a80cc6177bcf35ac`

The three screenshot hashes are distinct.

## Review Rounds

### Round 1 — APPROVE (3 findings, all fixed)

Reviewer: `farmtable-f16-review-r1` (code-reviewer, --harness claude)

- **Important #1**: Tooltip clipped by `:host { overflow: hidden }` — **Fixed** in commit 56bd513. Added `hoist` attribute.
- **Suggestion #2**: `filteredCountTooltip` computed unconditionally — **Fixed** in commit 56bd513. Made conditional with ternary.
- **Suggestion #3**: Add `placement="bottom"` for predictable positioning — **Fixed** in commit 56bd513.

### Round 2 — APPROVE (no blocking findings)

Reviewer: `farmtable-f16-review-r2` (code-reviewer, --harness claude)

- **Suggestion #1** (no action required): Using `<` instead of `!==` in the `isFiltered` check would be slightly more defensive — structurally impossible today since parent computes both from same data source.
- **Suggestion #2** (no action required): Dark mode spot-check of primary-100/primary-700 tint — Shoelace tokens should auto-adjust, but worth a visual check.

Review loop exited: R2 returned only minor/nitpick findings with no action required.

## Final State

- Branch: `feat/column-count-tooltip`
- Commits: 72aa294 (feature), 56bd513 (R1 fixes)
- PR: https://github.com/scion-frontiers/farmtable/pull/62

## Unaddressed Findings

- R2 Suggestion #1: defensive `<` vs `!==` — structurally impossible edge case, no action taken.
- R2 Suggestion #2: dark mode visual check — not tested, Shoelace semantic tokens expected to handle.

## Issues Encountered

- The production app URL does not contain this local feature branch, so the screenshot runner kept the page on the requested production origin while routing the locally built Vite JS/CSS assets into the page.
- `networkidle` is not a reliable wait condition for this dashboard because the app keeps long-lived stream/network activity. The runner waits for `domcontentloaded` and the `ft-app` element instead.
- The production dataset can be too small for the required filtered-column state, so fixture tasks were seeded into the browser's in-memory task store.

## Suggested Next UI/UX Feature

Add a compact per-column empty-filter state. When a filtered column has `0 of M`, show a subdued inline message in the column body such as "No visible tasks match this filter" so users understand that tasks still exist in the column but are hidden by active filters.
