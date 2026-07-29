# Feature 47: Fix Ready Queue Table Title Alignment

**Date:** 2026-07-22
**Branch:** fix/f47-ready-queue-alignment
**Commit:** 79c0316

## Problem

In the Ready Queue view (`ft-ready-queue-view.ts`), priority badges (`<sl-badge>`)
have variable widths depending on their text content ("Urgent", "High", "Normal",
"Low", "No priority"). Since the badge was a direct flex child with no fixed width,
the task ID hash and title columns shifted horizontally depending on badge width,
causing visual misalignment across rows.

Reported by ptone@google.com with a reference screenshot showing the issue.

## Root Cause

The `.queue-row` uses `display: flex` with `gap: 0.75rem`. The `<sl-badge>` element
was placed inline without a fixed-width container, so its natural width varied with
content length. Everything after it (task ID, title) inherited that offset.

## Fix

Added a `.priority-cell` CSS class with:
- `display: inline-flex` — wraps the badge
- `flex-shrink: 0` — prevents collapse
- `min-width: 6.5rem` — wide enough for the longest label ("No priority" as a pill badge)

Wrapped the `<sl-badge>` in a `<span class="priority-cell">` in the `renderRow` template.

**Files changed:** `web/src/components/ready-queue/ft-ready-queue-view.ts` (7 lines added, 1 changed)

## Verification

Before/after screenshots taken with Playwright against local dashboard with seed data
containing tasks across all priority levels (Urgent, High, Normal, Low, No priority).

- Before: task IDs and titles misaligned due to variable badge widths
- After: all task IDs and titles consistently aligned regardless of badge content

Screenshots saved to:
`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-47-ready-queue-alignment/`
