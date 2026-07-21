# Redo Feature 13 Screenshots with Real UI Interactions

The coordinator flagged that screenshot 03 shows the Assignee dropdown still displaying its placeholder text instead of "Alice", meaning the filter was likely set programmatically rather than through a real dropdown click. The screenshots must be redone using genuine UI interactions only.

## Requirements

Write a Playwright script that:
1. Loads the dashboard at http://localhost:8090
2. Takes screenshot 01: **No filters** — verify no chip row, both dropdowns at placeholder
3. Clicks the Phase dropdown, selects "Open" via real click on the sl-option
4. Waits for the chip row to appear
5. Takes screenshot 02: **One filter** — Phase dropdown shows "Open", chip "Phase: Open ×" visible, no "Clear all"
6. Clicks the Assignee dropdown, selects a real user (first available non-Unassigned user) via real click
7. Waits for the second chip to appear
8. Takes screenshot 03: **Two filters + Clear all** — BOTH dropdowns must show their selected values, both chips visible, "Clear all" visible
9. Clicks the "Clear all" button/text in the chip row
10. Waits for chips to disappear
11. Takes screenshot 04: **Post-clear** — no chips, both dropdowns back to placeholder

## CRITICAL: Real UI interactions only
- Use page.click() on actual dropdown options, NOT page.evaluate() to set filter state
- The dropdowns are Shoelace sl-select components — you need to:
  1. Click the sl-select to open it
  2. Click the sl-option inside to select a value
  3. Wait for the DOM to update

## Setup
```bash
export PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
export PATH=/workspace/.farmtable/bin:$PATH
export FARMTABLE_DB_PATH=/workspace/.farmtable/farmtable.db
```

Start the dashboard:
```bash
go run ./cmd/ft dashboard --port 8090 &
```
Wait for "http://localhost:8090" to appear.

Playwright is at `/scion-volumes/scratchpad/web-test/node_modules`.

## Save screenshots to
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-13-filter-chips/`
Overwrite the existing 01-04 files.

## After screenshots
Run md5sum on all 4 screenshots and print the hashes. Then mark task complete.
