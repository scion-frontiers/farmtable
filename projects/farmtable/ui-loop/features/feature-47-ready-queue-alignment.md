# Feature 47: Ready Queue Badge Alignment — Log

## Status: MERGED (commit cb19a2f on main)

**Date:** 2026-07-22
**Branch:** fix/f47-ready-queue-alignment
**Commit:** 79c0316

## Summary

Fixed visual misalignment in the Ready Queue table where variable-width priority
badges ("Urgent", "High", "Normal", "Low", "No priority") caused task IDs and
titles to shift horizontally across rows.

## Fix Applied

Added `.priority-cell` CSS wrapper with `min-width: 6.5rem` around the `<sl-badge>`
element in `ft-ready-queue-view.ts`. This gives all priority badges a consistent
column width so downstream columns (task ID, title) stay aligned.

**File:** `web/src/components/ready-queue/ft-ready-queue-view.ts`
**Diff:** +7 lines (CSS class + template wrap), -1 line (unwrapped badge)

## Verification

- Before/after screenshots captured with varied priority data
- Before: clear misalignment of task IDs between "Urgent" (narrow) and "No priority" (wide) rows
- After: all task IDs and titles consistently aligned

## Agent Notes

- Developer agents crashed twice during Go builds (OOM in container). Fix was applied
  directly by eng-manager as a trivial CSS change (2 edits in 1 file).
- Screenshots taken from eng-manager container using Playwright + seed DB + custom
  tasks with varied priorities.

## Review

- Code review: **APPROVE** (no critical or important issues)
- Reviewer confirmed min-width is the right technique, 6.5rem covers all labels, no regressions
- TypeScript compiles clean

## PR

- PR #121: https://github.com/scion-frontiers/farmtable/pull/121
- State: MERGED (cb19a2f)
