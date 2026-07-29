# Feature 50: Scrollable Collection List Landing Page + New Project Button

**Date:** 2026-07-22
**Branch:** feat/f50-landing-page-scroll-newproject
**Worktree:** /workspace/farmtable-f50
**Status:** COMPLETE — PR #127 opened, APPROVED
**PR:** https://github.com/scion-frontiers/farmtable/pull/127
**Commit:** 9b175dc (rebased on latest main)

## Problem

The landing page (`ft-collection-list`) shown when no `?collection=` is selected has two issues:
1. **Not scrollable**: `ft-app` has `overflow: hidden` on `:host`, and the collection list has `min-height: 100vh` — when the list exceeds viewport height, content is clipped with no scroll.
2. **No "New Project" button**: Users must first select an existing collection before they can create a new one. The `ft-new-collection-dialog` component (Feature 20, PR #66) already exists in the toolbar but is not available on the landing page.

## Analysis

### Scroll Issue
- `ft-app` `:host` uses `height: 100vh; overflow: hidden` — this clips everything
- When `routeView !== 'board'`, the `ft-collection-list` is rendered as a direct child of the flex column
- No intermediate scroll container exists for the landing view
- Fix: wrap landing content in a container similar to `.content > .main` pattern with `overflow: auto`
- `ft-collection-list` should remove `min-height: 100vh` and let the scroll container handle overflow

### New Project Button
- `ft-new-collection-dialog` already exists and handles the full create flow
- `ft-toolbar.ts` (lines 481-503) shows the exact pattern: call `client.createCollection()`, then emit `collection-select` event
- We can reuse this exact pattern in `ft-collection-list`
- On success, the existing `collection-select` handler in `ft-app` navigates to the new collection

## Changes Planned

### `web/src/components/ft-collection-list.ts`
1. Remove `min-height: 100vh` from `:host`
2. Add `:host { height: 100%; display: flex; flex-direction: column; overflow: auto }` for proper scroll containment
3. Import and include `ft-new-collection-dialog`
4. Add "New Project" button in the header area
5. Handle `collection-create` event: call `client.createCollection()`, emit `collection-select` on success

### `web/src/components/ft-app.ts`
1. Wrap landing-view content in a scroll container with proper flex constraints
2. Ensure the scroll container fills the available height (like `.content > .main` does for board view)

## Scroll History Context
- Features 36, 38, 39, 40 iterated on scroll for Kanban/Inspector
- Key pattern: app shell uses flex layout, bounded containers with `overflow: auto`, `min-height: 0`
- The landing page must follow the same pattern — not invent a new one

## Evidence (all in feature-50-landing-scroll-newproject/ directory)
- [x] 01-landing-initial.png — Landing page with "New Project" button, single collection
- [x] 02-list-overflowing.png — 16 collections, list exceeds viewport
- [x] 03-new-project-button.png — Button visible confirmation
- [x] 04-after-scroll.png — After wheel scroll, scrollTop 0→500 (shows collections 04-14)
- [x] 05-scrolled-further.png — Second wheel, scrollTop 500→651
- [x] 06-dialog-open.png — "New Collection" dialog open
- [x] 07-collection-created.png — Navigated to "Final Verification Collection" board

## Verification Results
- Scroll: before=0, after_wheel=500, final=651 — **SCROLL WORKS**
- New Project button visible: **YES**
- Dialog opens: **YES**
- Collection created and navigated: **YES**

## Code Review
- Reviewer: review-f50-landing (blind, code-reviewer template)
- **Verdict: APPROVE** — no critical or important issues
- One suggestion: duplicated NewCollectionDialog type (acceptable, noted for future)
- Full report: review-report.md in evidence directory

## Changes Made (actual)

### `web/src/components/ft-app.ts`
- Added `.landing { flex: 1; overflow: auto; min-height: 0; }` CSS class
- Wrapped `<ft-collection-list>` in `<div class="landing">` for bounded scroll region

### `web/src/components/ft-collection-list.ts`
- Removed `min-height: 100vh` from `:host` (was defeating scroll containment)
- Added `.header` flex layout with `.header-text` and "New Project" `sl-button`
- Imported `ft-new-collection-dialog`, added `@query` for dialog reference
- Added `onNewProjectClick()` and `onCollectionCreate()` handlers (pattern from ft-toolbar.ts)
- On success, emits `collection-select` with new collection ID → navigates to board
