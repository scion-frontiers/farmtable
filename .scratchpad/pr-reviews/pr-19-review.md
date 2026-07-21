# PR Review — Feature 19: Collection Picker

**Branch:** `feat/collection-picker`
**Commit range:** `7fee9ce..aef3a15`
**Files changed:** 4 (292 lines added)
**Build status:** TypeScript compiles cleanly; Vite build succeeds.

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a well-structured, low-risk feature that adds a Shoelace-based dropdown collection picker to the toolbar. The component follows established project patterns closely (nearly identical async-load/token-guard/event-dispatch shape as `ft-collection-list`), integrates cleanly with the existing `applyRoute()` URL-driven navigation from Feature 18, and the code is ready for Feature 20's "new collection" button thanks to the `.collection-controls` wrapper. No critical or blocking issues found.

---

### Critical Issues

None.

---

### Important Issues

**1. `sl-button` trigger missing `caret` attribute**
- **File:** `ft-collection-picker.ts:136`
- **Description:** The trigger button manually renders a `<sl-icon name="chevron-down">` in the suffix slot. Shoelace's `<sl-button>` has a built-in `caret` boolean attribute specifically designed for dropdown triggers — it renders a properly styled and animated caret icon, handles rotation on open/close, and is the idiomatic Shoelace pattern. The manual icon works, but it won't animate and it adds a slightly different visual weight compared to Shoelace's native caret.
- **Recommended fix:**
  ```html
  <sl-button slot="trigger" size="small" caret>
    <span class="trigger-label">${triggerLabel}</span>
  </sl-button>
  ```
  Remove the `<sl-icon slot="suffix" name="chevron-down">` line. This also simplifies the template.

**2. Duplicated `platformLabel` helper**
- **File:** `ft-collection-picker.ts:225–241` (identical copy in `ft-collection-list.ts:178–194`)
- **Description:** The `platformLabel` switch statement is duplicated verbatim between the two components. If a new platform is added, both must be updated in lockstep — a maintenance risk. This is a new-code duplication introduced by this PR.
- **Recommended fix:** Extract to a shared utility:
  ```ts
  // web/src/lib/platform-label.ts
  import { Platform } from '../gen/types.js';
  export function platformLabel(platform: Platform): string { /* switch */ }
  ```
  Import in both components. This can be a follow-up if preferred, but it's cheap to do now.

---

### Suggestions

**3. Consider using Shoelace's `sl-button` `caret` attribute for automatic open/close animation**
- *(Covered above as Important — mentioning here for completeness.)*

**4. `hoist` positioning is correct but `z-index` layering is belt-and-suspenders**
- **File:** `ft-collection-picker.ts:10, 16, 24–26`
- **Description:** The component sets `--sl-z-index-dropdown: 2000` on `:host`, `z-index: 30` on `:host`, and targets `sl-dropdown::part(base__popup)`. With `hoist` enabled on the dropdown, the popup is portaled to the document body, so the host's `z-index: 30` doesn't actually influence the popup's stacking context. The `--sl-z-index-dropdown` CSS custom property is the effective lever. Meanwhile, the toolbar sets `z-index: 100` on `:host`. This all works, but the `z-index: 30` on the picker's host is redundant given `hoist` — it only affects the trigger button's stacking within the toolbar, which is already handled by the toolbar's own `z-index: 100`.
- **Recommendation:** Consider removing `z-index: 30` from `:host` in the picker to reduce cognitive overhead. The toolbar's `z-index: 100` and the dropdown's `hoist` + `--sl-z-index-dropdown: 2000` are sufficient.

**5. Hardcoded highlight color for current item**
- **File:** `ft-collection-picker.ts:62`
- **Description:** `background: rgb(239, 246, 255)` is a hardcoded light-blue that won't adapt to dark mode. Every other color in the component uses Shoelace design tokens.
- **Recommended fix:**
  ```css
  sl-menu-item.current::part(base) {
    background: var(--sl-color-primary-50);
    color: var(--sl-color-primary-800);
  }
  ```
  This uses the Shoelace token equivalent and will respect theme changes.

**6. Collection list is loaded only when `client` changes — not on dropdown open**
- **File:** `ft-collection-picker.ts:124–128`
- **Description:** Collections are fetched when the `client` property is set/changed (via `updated()`). This means the list is loaded once on component mount and then only when the client reference changes. If a user creates a new collection in another tab and opens the picker, the list will be stale. This is acceptable for an MVP, but a future enhancement could re-fetch on each dropdown open via `@sl-show`.
- **Recommendation:** No change needed now, but consider adding a comment or TODO:
  ```ts
  // TODO: Consider re-fetching on @sl-show for freshness.
  ```

**7. Event re-dispatch in toolbar could use `detail` type narrowing**
- **File:** `ft-toolbar.ts:193`
- **Description:** `onCollectionSelect(e: CustomEvent)` uses an untyped `CustomEvent`. The `ft-collection-picker` emits a well-typed `{ collectionId: string }` detail. Adding a type parameter improves maintainability:
  ```ts
  private onCollectionSelect(e: CustomEvent<{ collectionId: string }>) {
  ```

**8. Double registration of `ft-collection-picker` in `index.ts`**
- **File:** `web/src/index.ts:31`
- **Description:** `ft-collection-picker.js` is imported both in `index.ts` (line 31) and in `ft-toolbar.ts` (line 7 via side-effect import). This is not a bug — Lit's `@customElement` decorator is idempotent and won't double-register — but the `index.ts` import is redundant since the toolbar already pulls it in. All other components that are consumed by a parent follow the same pattern (imported by their parent), so the `index.ts` import is only needed for top-level components.
- **Recommendation:** Remove the `ft-collection-picker` import from `index.ts` to match the pattern where parents import their children. Or keep it if the project prefers explicit top-level registration for all components. Either way, no runtime issue.

---

### What's Done Well

1. **Async load-token pattern is exactly right.** The `loadToken` guard against stale async responses (`if (token === this.loadToken)`) matches the established pattern in `ft-collection-list` and `ft-toolbar.loadUsers()` perfectly. This prevents race conditions when the client changes mid-flight.

2. **`composed: true` on all custom events.** Events correctly cross Shadow DOM boundaries, which is essential for the picker → toolbar → app event chain. The `stopPropagation` + re-dispatch pattern in the toolbar is correct for preventing the inner `collection-select` from leaking while still letting the toolbar's own event bubble up to `ft-app`.

3. **`hoist` attribute on `sl-dropdown`.** This prevents the dropdown panel from being clipped by the toolbar's `overflow: hidden` ancestors — a common pitfall with Shadow DOM + positioned elements.

4. **Clean integration with Feature 18.** The picker dispatches the same `collection-select` event shape (`{ collectionId }`) that `ft-collection-list` uses, and `ft-app.onCollectionSelect` handles both uniformly via `pushState` + `applyRoute()`. No special-casing needed.

5. **Forward-thinking `.collection-controls` wrapper.** The `div.collection-controls` with `display: flex; gap: 0.5rem` is clearly prepared for Feature 20's "new collection" button — clean seam for the next PR.

6. **No-op guard on same-collection select.** `onMenuSelect` correctly returns early when `collectionId === this.collectionId`, preventing a full teardown/rebuild cycle when the user clicks the already-active collection.

7. **Error and empty states are handled.** The picker gracefully degrades to "Unable to load collections." on error and "No collections are available." when the list is empty.

---

### Verification Story

- **Tests reviewed:** No tests added (no test infrastructure visible for Lit components in this project). Not flagged — consistent with the existing component test strategy.
- **Build verified:** Yes — `tsc --noEmit` and `vite build` both pass cleanly with no errors or new warnings.
- **Lint/static analysis clean:** No ESLint config in this project; TypeScript strict checks pass.
- **Security checked:** Yes — no user input flows into `innerHTML` or unsanitized DOM. Collection IDs are passed as opaque strings through events and URL params. `listCollections()` is a read-only gRPC call with no user-controlled payload beyond the client's auth context.

---

### Summary of Recommendations

| # | Severity | Item | Action |
|---|----------|------|--------|
| 1 | Important | Use `sl-button caret` instead of manual chevron icon | Fix or justify |
| 2 | Important | Extract shared `platformLabel` helper | Fix now or create follow-up |
| 5 | Suggestion | Hardcoded `rgb(239, 246, 255)` — use `--sl-color-primary-50` | Fix for dark mode compat |
| 4 | Suggestion | Remove redundant `z-index: 30` from picker host | Clean up |
| 6 | Suggestion | Add TODO for re-fetch on dropdown open | Add comment |
| 7 | Suggestion | Type the `CustomEvent` detail in toolbar handler | Improve types |
| 8 | Suggestion | Remove redundant `index.ts` import | Align with pattern |

**Bottom line:** Approve. The two Important items are low-risk improvements that can be addressed in this PR or as immediate follow-ups without blocking merge. The code is correct, well-structured, and follows project conventions.
