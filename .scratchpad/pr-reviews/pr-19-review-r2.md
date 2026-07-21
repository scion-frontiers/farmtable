# PR Review (R2) — Feature 19: Collection Picker

**Branch:** `feat/collection-picker`
**Commit range:** `7fee9ce..d6690af` (2 commits: feature + R1 fixes)
**Files changed:** 6 (295 lines added, 21 removed)
**Build status:** `tsc --noEmit` passes cleanly — no type errors.

---

## Review Summary

**Verdict:** APPROVE

**Overview:** A clean, low-risk feature that adds a Shoelace dropdown collection picker to the toolbar. All R1 review findings (shared `platformLabel` extraction, `caret` attribute, hardcoded color token, redundant z-index, typed event detail, redundant index.ts import, freshness TODO) were addressed in `d6690af`. The remaining code follows established project patterns precisely, integrates correctly with Feature 18's URL-driven routing, and leaves a clean seam (`.collection-controls` wrapper) for Feature 20's "new collection" button.

---

### Critical Issues

None.

---

### Important Issues

None.

---

### Suggestions

**1. `Platform.UNSPECIFIED` falls through to the `default` case silently**
- **File:** `web/src/util/platform-label.ts:17`
- **Description:** The `Platform` enum includes `UNSPECIFIED = 0` (the protobuf default). If a collection arrives with `platform = 0`, `platformLabel` returns `"Unknown platform"` via the `default` branch. This is functionally correct, but an explicit `case Platform.UNSPECIFIED:` makes the intent clearer and prevents future developers from mistakenly thinking UNSPECIFIED was overlooked.
- **Suggested fix:**
  ```ts
  case Platform.UNSPECIFIED:
    return 'Unknown platform';
  default:
    return 'Unknown platform';
  ```
- **Severity:** Nitpick — the behavior is already correct.

**2. Toolbar's `onCollectionSelect` re-dispatch is correct but adds boilerplate**
- **File:** `web/src/components/ft-toolbar.ts:193–200`
- **Description:** The toolbar intercepts the picker's `composed: true` event, calls `stopPropagation()`, and re-dispatches its own. This is a valid encapsulation pattern (the toolbar controls its public event API), and it matches how the toolbar already intermediates other child events. However, since `ft-collection-picker` is a private child of the toolbar (imported only by the toolbar), an alternative would be to let the picker's composed event bubble naturally and drop the re-dispatch. Either pattern works — this is a style call, not a correctness concern.
- **Severity:** Observation — no change needed.

**3. `sl-dropdown::part(base__popup)` may be a no-op in newer Shoelace versions**
- **File:** `web/src/components/ft-collection-picker.ts:24–26`
- **Description:** The `base__popup` part name targets the internal `sl-popup` component. Shoelace's documented exported parts for `sl-dropdown` are `base`, `trigger`, and `panel`. If the part name doesn't match, the CSS rule is silently ignored — no runtime error. The `hoist` attribute and `--sl-z-index-dropdown` custom property are the effective z-index controls anyway, so this is a no-op safety net at worst.
- **Severity:** Nitpick — harmless if it's a no-op.

---

### What's Done Well

1. **R1 feedback fully addressed.** All seven items from the initial review (shared `platformLabel` utility, `caret` attribute, design-token colors, redundant z-index removal, `@sl-show` TODO, typed `CustomEvent<{ collectionId: string }>`, redundant import cleanup) were resolved cleanly in `d6690af`. The fixes are mechanical and correct.

2. **Shared `platformLabel` utility is a genuine improvement.** Extracting the switch statement into `web/src/util/platform-label.ts` and updating both `ft-collection-list` and `ft-collection-picker` to import it eliminates the maintenance risk of duplicated platform-name mappings. The refactor of `ft-collection-list` is clean — only the import and call site changed.

3. **Async load-token pattern is battle-tested.** The `loadToken` guard in `loadCollections()` (lines 183–211) is identical in shape to `ft-collection-list.loadCollections()` and `ft-toolbar.loadUsers()`. The pattern correctly handles: (a) concurrent client changes cancelling stale responses, (b) no-client early return that clears state, and (c) error state that surface user-facing messages while logging details to console.

4. **Event contract matches `ft-collection-list` exactly.** The picker dispatches `collection-select` with `{ collectionId: string }` detail, matching the existing event shape from `ft-collection-list`. `ft-app.onCollectionSelect` handles both uniformly — no conditional logic or type checks needed.

5. **`currentCollectionId` state is set/cleared at the right lifecycle points.** It's set in `showBoard()` (when entering a collection) and cleared to `null` in `showCollectionList()` (when returning to the landing page). The `?? ''` coercion in the template (`this.currentCollectionId ?? ''`) correctly bridges the `string | null` state to the picker's `string` property.

6. **No-op guard on re-selecting the active collection.** `onMenuSelect` returns early when `collectionId === this.collectionId` (line 216), avoiding an unnecessary teardown/rebuild cycle through `applyRoute() → showBoard()`.

7. **Forward-thinking layout.** The `.collection-controls` wrapper div provides a clean insertion point for Feature 20's "new collection" button without any layout refactoring.

---

### Verification Story

- **Tests reviewed:** No tests added. Consistent with the project's current approach — no test infrastructure exists for Lit web components. Not flagged.
- **Build verified:** Yes — `tsc --noEmit` completes with zero errors. All imports resolve correctly, including the new `platform-label.ts` utility and Shoelace component side-effect imports.
- **Lint/static analysis clean:** No ESLint configuration in this project. TypeScript strict checks pass.
- **Security checked:** Yes — no user input flows into `innerHTML` or unsanitized DOM. Collection IDs are opaque strings passed through custom events and URL query params. The `listCollections()` RPC is a read-only call with no user-controlled payload. The `loadError` message is a hardcoded string literal, not derived from the server error.

---

### R1 Fix Verification

| R1 # | Item | Status |
|-------|------|--------|
| 1 | Use `sl-button caret` instead of manual chevron | ✅ Fixed — `caret` attribute added, `<sl-icon>` removed |
| 2 | Extract shared `platformLabel` helper | ✅ Fixed — `web/src/util/platform-label.ts` created, both components updated |
| 4 | Remove redundant `z-index: 30` from picker host | ✅ Fixed — removed |
| 5 | Hardcoded RGB → `--sl-color-primary-50` | ✅ Fixed — now uses Shoelace design token |
| 6 | Add TODO for re-fetch on dropdown open | ✅ Fixed — comment added at line 125 |
| 7 | Type the `CustomEvent` detail in toolbar handler | ✅ Fixed — `CustomEvent<{ collectionId: string }>` |
| 8 | Remove redundant `ft-collection-picker` import from `index.ts` | ✅ Fixed — removed |

---

**Bottom line:** Approve with no blocking issues. The three remaining suggestions are nitpicks/observations that don't warrant a revision cycle. The code is correct, follows project conventions, and the R1 feedback was thoroughly addressed.
