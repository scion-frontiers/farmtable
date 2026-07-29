# Feature 50: Scrollable Landing Page + New Project Button — Code Review

**Branch:** `feat/f50-landing-page-scroll-newproject`
**Commit:** `9b175dc feat(web): scrollable collection list landing page + new project button (F50)`
**Files changed:** `web/src/components/ft-app.ts`, `web/src/components/ft-collection-list.ts`

## Review Summary

**Verdict:** APPROVE

**Overview:** A clean, low-risk change that adds a scroll-bounding wrapper to the landing view and integrates the existing `ft-new-collection-dialog` into the collection list page. Both the CSS and handler logic correctly replicate established patterns from the codebase with no regressions introduced.

---

### Critical Issues

None.

### Important Issues

None.

### Suggestions

- **[ft-collection-list.ts:8-13] Duplicated `NewCollectionDialog` type**
  The local type alias `NewCollectionDialog` duplicates the one in `ft-toolbar.ts` (lines 14-25). Both define the same shape (`show`, `close`, `setCreating`, `setError`). This is fine for component isolation, but if a third consumer appears, consider extracting to a shared type (e.g., in `ft-new-collection-dialog.ts` as an exported interface).

---

### What's Done Well

1. **Correct flex/scroll pattern.** The `.landing` class (`flex: 1; overflow: auto; min-height: 0;`) exactly mirrors the proven scroll-containment pattern used by `.content` / `.main` in the board view. The `min-height: 0` breaks the CSS default min-size constraint on flex items, enabling `overflow: auto` to actually scroll. This is the canonical fix.

2. **Correct removal of `min-height: 100vh`.** The old `min-height: 100vh` on `ft-collection-list`'s `:host` would have defeated the scroll container by forcing the child to always be at least viewport height. Removing it lets the collection list grow naturally and scroll within the bounded `.landing` div.

3. **Faithful replication of `onCollectionCreate`.** The handler in `ft-collection-list.ts` is a line-for-line match with the one in `ft-toolbar.ts` (lines 481-503), with the correct substitution: `this.client` here is the `unscopedClient` passed from `ft-app.ts` (line 231: `.client=${this.unscopedClient}`), so `this.client.createCollection(...)` is functionally identical to `this.unscopedClient.createCollection(...)` in the toolbar.

4. **Event propagation is correct.** The `collection-select` event dispatched after creation uses `bubbles: true, composed: true`, which crosses the shadow DOM boundary from `ft-collection-list` through the `.landing` div up to `ft-app`'s `@collection-select` handler. This triggers URL navigation via `onCollectionSelect` and loads the board.

5. **Dialog lifecycle is clean.** The handler follows the correct sequence: clear error -> set creating -> try create -> close on success / set error on failure -> always clear creating. The `ft-new-collection-dialog`'s own `onAfterHide` callback resets internal state (line 88-92), so there's no stale state on reopen.

6. **No flex layout interference from siblings.** The `ft-shortcut-overlay` sibling (rendered after `.landing`) uses `:host { display: contents; }`, so it creates no box and consumes no flex space. The `.landing` div correctly receives all available space via `flex: 1`.

7. **Accessible button.** The "New Project" `sl-button` has visible text content alongside the decorative `sl-icon`, providing a built-in accessible label with no extra `aria-label` needed.

8. **Good header layout.** The `.header` flex container with `align-items: flex-start` keeps the button top-aligned when the text wraps on narrow viewports — a thoughtful responsive detail.

---

### Verification Story

- **Tests reviewed:** No component-level tests exist for `ft-collection-list` or `ft-app` in this project (web components are verified via visual/manual testing per the screenshots in the feature directory). N/A.
- **Build verified:** Yes. `npm run build` (tsc --noEmit + vite build) passes clean with no type errors or warnings.
- **Lint/static analysis clean:** Yes (tsc noEmit passes).
- **Security checked:** Yes. No new external inputs, no credential handling, no DOM injection vectors. The `createCollection` call sends user-provided text through the existing gRPC client which handles transport-level concerns.

---

### Detailed Analysis

#### 1. Correctness: Scroll Container

The `:host` of `ft-app` is `display: flex; flex-direction: column; height: 100vh; overflow: hidden`. In the landing route, the render outputs:

```
:host (flex column, 100vh, overflow hidden)
  └─ .landing (flex: 1, overflow: auto, min-height: 0)
       └─ ft-collection-list
  └─ ft-shortcut-overlay (display: contents — no box)
```

This is a correct bounded scroll region. The `.landing` div fills the viewport height, and when the collection list exceeds that height, the div scrolls. The `min-height: 0` is essential — without it, the flex item's implicit `min-height: auto` would prevent shrinking below content size, defeating `overflow: auto`.

#### 2. CSS Consistency

| Property | `.content` (board wrapper) | `.main` (board scroll area) | `.landing` (landing scroll area) |
|---|---|---|---|
| `flex` | `1` | `1` | `1` |
| `overflow` | `hidden` | `auto` | `auto` |
| `min-height` | `0` | — | `0` |
| `min-width` | — | `0` | — |

The `.landing` class correctly combines the vertical scroll properties from both `.content` and `.main`. Since the landing view has no horizontal flex (no inspector sidebar), `min-width: 0` is correctly omitted.

#### 3. Code Reuse: `onCollectionCreate`

Side-by-side diff (toolbar left, collection-list right):

```
toolbar:  this.unscopedClient.createCollection(...)
list:     this.client.createCollection(...)
```

In `ft-app.ts`, the collection list receives `.client=${this.unscopedClient}`, so `this.client` IS the unscoped client. The guard clause, error handling, and event dispatch are identical. Correct replication.

#### 4. Edge Cases

- **Empty collection list + New Project**: Works — the button is in `.header`, separate from the conditional list/empty/loading section.
- **Dialog during loading**: The `onNewProjectClick` handler calls `show()` which awaits `updateComplete` in the dialog. Loading state doesn't block dialog opening.
- **Double-click on New Project**: Safe — the dialog's `onRequestClose` prevents closing during creation, and `setCreating(true)` disables the form inputs.
- **Network failure during create**: Handled — catches error, sets error message in dialog, logs warning. The `finally` block always clears `isCreating`.
- **`collection.id` undefined**: Theoretically possible if the API returns malformed data, but this matches the existing pattern in ft-toolbar and the gRPC client types guarantee the field.
