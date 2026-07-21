# PR Review (R2): feat/shortcut-overlay — Keyboard Shortcut Overlay

> R1 review findings (General group missing, toggle behavior, focus restore, focus trap, CSS consolidation, unique title ID) have all been addressed in commit `9f4291b`. This R2 review covers the branch as it stands now.

## Review Summary

**Verdict:** APPROVE

**Overview:** This branch adds a well-crafted keyboard shortcut overlay modal (`ft-shortcut-overlay`) with proper ARIA dialog semantics, focus management, and dismiss behaviors. The code is clean, follows existing project conventions, and integrates correctly with the app shell. One Important accessibility finding around the focus trap with Shoelace shadow DOM, and a handful of minor suggestions.

---

## Executive Summary

This is a low-risk, self-contained UI feature. The component architecture is sound — state ownership is properly centralized in `ft-app`, the overlay is a stateless presentational component driven by a single `open` prop, and event flow uses the established `CustomEvent` + bubbling pattern. All R1 findings have been resolved. The one new substantive issue is a focus-trap escape hatch caused by a shadow DOM boundary mismatch in the `activeElement` lookup.

---

### Critical Issues

_(None)_

### Important Issues

#### 1. Focus trap can escape on forward Tab due to shadow DOM element mismatch

**File:** `web/src/components/ft-shortcut-overlay.ts:239–256`

`focusableElements()` returns Shoelace host elements (e.g. the `<sl-icon-button>` close button), but `activeElement()` traverses into shadow roots and returns the *internal* `<button>` element inside `sl-icon-button`'s shadow DOM. This means `focusableElements.indexOf(active)` returns `-1`.

With `currentIndex = -1` and the close button being the only focusable element (`lastIndex = 0`):
- **Shift+Tab:** `shouldWrapBackward = shiftKey && (-1 <= 0)` → **true** — wraps correctly.
- **Forward Tab:** `shouldWrapForward = !shiftKey && (-1 === 0)` → **false** — handler returns without calling `e.preventDefault()`, and the browser's default Tab behavior moves focus *outside* the dialog panel.

**Impact:** Breaks the focus trap on forward Tab, violating the `aria-modal="true"` contract. Keyboard-only users can Tab out of the dialog into the page behind the backdrop.

**Suggested Fix:**

```typescript
private trapFocus(e: KeyboardEvent) {
  const focusableElements = this.focusableElements();
  if (focusableElements.length === 0) {
    e.preventDefault();
    this.renderRoot.querySelector<HTMLElement>('.panel')?.focus();
    return;
  }

  const active = this.activeElement();
  // Match against the host element even when focus is inside its shadow root.
  const currentIndex = active
    ? focusableElements.findIndex(
        (el) => el === active || el.contains(active) || el.shadowRoot?.contains(active),
      )
    : -1;

  const lastIndex = focusableElements.length - 1;
  const shouldWrapBackward = e.shiftKey && currentIndex <= 0;
  const shouldWrapForward = !e.shiftKey && (currentIndex === lastIndex || currentIndex === -1);

  if (!shouldWrapBackward && !shouldWrapForward) return;

  e.preventDefault();
  focusableElements[shouldWrapBackward ? lastIndex : 0].focus();
}
```

The key changes: (a) use `findIndex` with a predicate that checks `shadowRoot?.contains(active)` so the host matches even when focus is on its internal element, and (b) treat `currentIndex === -1` on forward Tab as a wrap condition (fallback to first element) rather than silently returning.

---

### Suggestions

#### 1. `?` key handler doesn't stop propagation when overlay is open

**File:** `web/src/components/ft-app.ts:182–188`

When the overlay is open and the user presses `?`, `ft-app`'s capture handler fires first and toggles the overlay closed, but the event continues to propagate to the overlay's own capture handler (which harmlessly ignores `?` today). Adding `e.stopPropagation()` would make the ownership boundary explicit and prevent accidental regressions if the overlay's handler were broadened in the future.

```typescript
private onDocumentKeyDown = (e: KeyboardEvent) => {
  if (e.key !== '?' || e.defaultPrevented) return;
  if (this.isEditableEventTarget(e)) return;

  e.preventDefault();
  e.stopPropagation();
  this.shortcutOverlayOpen = !this.shortcutOverlayOpen;
};
```

#### 2. Body scroll is not locked while overlay is open

**File:** `web/src/components/ft-shortcut-overlay.ts:165–177`

The page behind the backdrop can still scroll (especially noticeable on mobile/touch). Consider toggling `overflow: hidden` on `document.body` when the overlay opens and restoring it on close.

#### 3. Module-level `let overlayId` could be a static class field

**File:** `web/src/components/ft-shortcut-overlay.ts:38`

Minor stylistic preference — the counter is logically a class concern:

```typescript
export class FtShortcutOverlay extends LitElement {
  private static nextId = 0;
  private readonly titleId = `shortcut-overlay-title-${++FtShortcutOverlay.nextId}`;
  // ...
}
```

#### 4. Consider `inert` attribute for background content

As browser support for the `inert` attribute is now universal, toggling `inert` on the main content container while the overlay is open would complement the manual focus trap — it prevents all interaction with background content including screen reader virtual cursor navigation. This can be done from `ft-app` when setting `shortcutOverlayOpen`.

---

### What's Done Well

- **Excellent ARIA dialog pattern.** `role="dialog"`, `aria-modal="true"`, `aria-labelledby` with a generated unique ID — textbook accessible modal implementation.
- **Thorough `composedPath()` usage** in `isEditableEventTarget()` correctly traverses shadow DOM boundaries to detect Shoelace form elements (`sl-input`, `sl-textarea`, `sl-select`). This prevents the `?` shortcut from firing while typing in inputs.
- **Clean focus save/restore lifecycle.** `previouslyFocusedElement` is captured before opening, guarded with `isConnected` on restore, and nulled after use. Handles the edge case where the previously-focused element is removed from the DOM while the overlay is open.
- **Proper listener cleanup.** Both `ft-app` and `ft-shortcut-overlay` symmetrically add/remove document-level listeners in lifecycle callbacks and open/close transitions. No leak risk.
- **Good CSS refactoring.** Renaming `.theme-toggle` → `.toolbar-icon-button` in `ft-toolbar.ts` is a clean generalization that avoids style duplication for the new help button.
- **Responsive mobile layout.** The `@media (max-width: 520px)` query adapts to full-screen with single-column `<dl>` layout.
- **Semantic HTML.** `<dl>/<dt>/<dd>` for key-description pairs and `<kbd>` for key labels.
- **Clean event architecture.** The toolbar fires a composed/bubbling custom event, `ft-app` coordinates state — consistent with the existing `view-change` pattern.
- **Proper use of `nothing` sentinel.** Returning `nothing` when `!this.open` avoids rendering any DOM, which is better than `display: none` for performance and accessibility tree cleanliness.

---

### Verification Story

- **Tests reviewed:** No tests in this PR. The web project has no test framework configured, so this is consistent with existing practice. The component is purely presentational.
- **Build verified:** Yes — `tsc --noEmit` passes with zero errors.
- **Lint/static analysis clean:** Yes — no lint tool configured; TypeScript strict mode passes.
- **Security checked:** Yes — no user input rendered unsanitized; shortcut data is static; no external data flows; no credentials exposed. No security concerns.

---

*Reviewed: 2026-07-19 | Branch: feat/shortcut-overlay | Commits: 08f41c7, 9f4291b*
