# Feature 22: View Mode URL Routing

## What Was Built

Made the Kanban/Tree view toggle URL-addressable in the Farm Table dashboard. Previously, view mode was ephemeral — reloading or sharing a link always landed on the default Kanban view. Now:

1. **`?view=kanban`** → Kanban view (same as default, explicit)
2. **`?view=tree`** → Tree view rendered directly on load
3. **No `?view=` param** → Falls back to Kanban (preserves backward compatibility)
4. **Invalid `?view=` values** → Fall back to Kanban gracefully
5. **Toggle the view** → URL updates via `pushState`
6. **Back/forward** → View mode restored via `popstate` → `applyRoute()`

Both params coexist: `?collection=<uuid>&view=tree` works correctly.

## URL Param Mechanism

| Concept | Detail |
|---------|--------|
| URL param name | `view` (as in `?view=kanban` or `?view=tree`) |
| Reading view | `params.get('view') === 'tree' ? 'tree' : 'kanban'` inlined in `applyRoute()` |
| Writing view (toggle) | `url.searchParams.set('view', view); window.history.pushState({}, '', url);` |
| Clearing view | `url.searchParams.delete('view')` in `removeCollectionFromUrl()` |
| Back/forward | Existing `popstate` → `applyRoute()` reads both params from shared `URLSearchParams` |

## How It Extends Feature 18

Feature 18 introduced URL-driven collection routing with `?collection=<uuid>`, `pushState`, and `popstate` → `applyRoute()`. Feature 22 adds a second orthogonal query parameter using the exact same mechanism:

- **Shared `URLSearchParams`**: Both `collection` and `view` are parsed from a single `new URLSearchParams()` in `applyRoute()`, replacing the two separate helper methods.
- **Same `pushState` pattern**: `onViewChange()` follows the same URL-update pattern as `onCollectionSelect()`.
- **Same `popstate` flow**: The existing listener calls `applyRoute()`, which now reads both params.

The only intentional divergence: `onViewChange()` does NOT call `applyRoute()` after `pushState` — a view-only change doesn't need collection revalidation (documented with an inline comment).

## Files Changed

- `web/src/components/ft-app.ts` — All changes in this single file:
  - `applyRoute()`: Reads `?view=` from shared `URLSearchParams` (+3 lines)
  - `onViewChange()`: Pushes view to URL via `pushState` (+5 lines, replaces 1)
  - `removeCollectionFromUrl()`: Also clears `?view=` (+1 line)
  - Removed `currentCollectionIdFromUrl()` and `currentViewFromUrl()` helpers (inlined)

## Review Rounds

### Round 1: APPROVE (2 Suggestions, 1 Nitpick — all fixed)

1. ✅ **S1**: Added comment explaining why `onViewChange` skips `applyRoute()`
2. ✅ **S2**: Clear `?view=` in `removeCollectionFromUrl()` alongside `?collection=`
3. ✅ **N1**: Shared `URLSearchParams` in `applyRoute()` — inlined both helpers

### Round 2: APPROVE (2 Suggestions, 2 Nitpicks — all minor, shipped as-is)

Per review loop exit criteria: Round 2 returned only minor/nitpick findings → shipped.

Unaddressed R2 findings (all minor/optional):
- **S1**: `onCollectionSelect` doesn't preserve `?view=` when switching collections (design choice — new collection = fresh default view)
- **S2**: `onViewChange` could fire when no collection is loaded (non-issue — toolbar not visible without collection)
- **N1**: Positive acknowledgment of cleanup
- **N2**: `as 'kanban' | 'tree'` cast in `onViewChange` trusts event detail (safe — event only fired from radio group with those two values)

## Final State

- **Branch:** `feat/view-mode-urls`
- **PR:** https://github.com/scion-frontiers/farmtable/pull/69
- **Commits:** 2 (feat + R1 fixes)
- **Build:** Clean (`tsc --noEmit`, `vite build`, `go build ./...`, `go test ./...` all pass)
- **PR Status:** CLEAN / MERGEABLE
- **Screenshots:** 3 distinct PNGs verified via md5sum
  - `a-kanban-view-param.png` (6bce604e) — Kanban view with `?view=kanban` in URL
  - `b-tree-view-after-toggle.png` (a28abf30) — Tree view with `?view=tree` after toggling
  - `c-direct-tree-view-param.png` (7d08627e) — Direct navigation to `?view=tree`

## Worktree Experience

The git worktree setup at `/workspace/farmtable-f22-view-urls` worked smoothly:
- Created from `origin/main` in seconds
- `npm ci && npm run build` took ~15 seconds with warm cache
- No absolute-path issues (as predicted by the experiment report)
- Ran dev server on port 8082 to avoid conflicts with Feature 23's worktree
- Branch exclusivity prevented any cross-feature interference
- Total worktree cost: ~114 MB disk — trivial

## Developer's Next-Feature Suggestion

URL routing for additional dashboard state — e.g., `?phase=working` to deep-link to a specific phase filter, or `?task=<uuid>` to auto-select and open a task in the inspector.
