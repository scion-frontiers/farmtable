# PR Review: feat/filter-chips — Active Filter Chips

**Branch:** `feat/filter-chips` (1 commit: `c87d2ec feat: add active filter chips with clear-all action`)
**Files changed:** 2 (`ft-app.ts` +38/-1, `ft-filter-chips.ts` +134 new)
**Reviewer date:** 2026-07-19

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds a clean, well-structured `ft-filter-chips` LitElement component that displays removable chips for active phase/assignee filters, with a "Clear all" button when both are active. The implementation follows existing project patterns (Lit decorators, event dispatching with `TaskFilterChangeDetail`, stale-response tokens) and introduces no correctness or security issues. Two minor code-quality items and one subtle visual glitch are noted below.

---

### Critical Issues

None.

---

### Important Issues

**1. `onFilterClear` is an exact duplicate of `onFilterChange`** — *Readability/Maintainability*

`ft-app.ts:181-185` — The new `onFilterClear` handler is byte-for-byte identical to the existing `onFilterChange` handler (lines 175-179). Having two methods with the same body is a maintenance hazard — a future change to one could miss the other.

```typescript
// Current (duplicated)
private onFilterChange(e: CustomEvent) {
    const { phase, assigneeId } = e.detail as TaskFilterChangeDetail;
    this.phaseFilter = phase;
    this.assigneeFilter = assigneeId;
}

private onFilterClear(e: CustomEvent) {
    const { phase, assigneeId } = e.detail as TaskFilterChangeDetail;
    this.phaseFilter = phase;
    this.assigneeFilter = assigneeId;
}
```

**Suggested fix:** Reuse the existing handler directly. Both events carry the same `TaskFilterChangeDetail` shape, so they can share a single handler:

```typescript
// Option A: alias in the template
@filter-clear=${this.onFilterChange}

// Option B: delegate
private onFilterClear(e: CustomEvent) {
    this.onFilterChange(e);
}
```

Option A is simplest — the semantic distinction ("change" vs. "clear") is already encoded in the event name, not the handler logic.

---

### Suggestions

**2. Phantom 1px border when no filters are active** — *Visual/CSS*

`ft-filter-chips.ts:17-20` — The `:host` block always applies `display: block` and `border-bottom: 1px solid var(--sl-color-neutral-200)`. When `render()` returns `nothing` (no active filters), the host element is still in the DOM (rendered unconditionally by `ft-app`). A block element with no content and no padding collapses to 0px content height, but the 1px border still renders, producing a faint phantom line between the toolbar and the content area.

**Suggested fix:** Toggle visibility at the host level:

```typescript
// In render(), before returning nothing:
render() {
    const activeFilterCount = ...;
    if (activeFilterCount === 0) {
      this.removeAttribute('has-filters');
      return nothing;
    }
    this.setAttribute('has-filters', '');
    // ... rest of render
}
```

```css
:host {
  border-bottom: 1px solid var(--sl-color-neutral-200);
  background: var(--sl-color-neutral-0);
}
:host(:not([has-filters])) {
  display: none;
}
:host([has-filters]) {
  display: block;
}
```

Alternatively, just set `this.hidden = (activeFilterCount === 0)` and add `:host([hidden]) { display: none !important; }` to override the `:host` display rule.

**3. Duplicate `listUsers` RPC on page load** — *Performance*

`ft-app.ts:187-200` — `ft-app` now calls `this.client.listUsers()` in `connectedCallback` to populate the chips component's user list. However, `ft-toolbar.ts:182` also independently calls `listUsers()` to populate its assignee dropdown. This means two identical RPCs fire on every page load.

This isn't blocking — the user list is small and the calls are idempotent — but consider consolidating by having `ft-app` own the single source of truth and pass `users` down as a property to both `ft-toolbar` and `ft-filter-chips`. That would require a small refactor of `ft-toolbar`, so this is fine to defer.

**4. Consider `role="list"` or `role="group"` for the chips container** — *Accessibility*

`ft-filter-chips.ts:51` — The container has `aria-label="Active filters"` which is good, but a `<div>` with an `aria-label` and no explicit role may not be announced by all screen readers. Adding `role="group"` or `role="list"` (with `role="listitem"` on each chip wrapper) would ensure the label is reliably announced.

```html
<div class="chips" role="group" aria-label="Active filters">
```

---

### What's Done Well

- **Clean component design.** `ft-filter-chips` is a focused, stateless presentation component. It receives data via properties and communicates via events — the correct Lit pattern. No internal state management, no side effects.
- **Reuses `TaskFilterChangeDetail` type.** The event detail type is shared with `task-filters.ts`, maintaining a single interface for filter-change events across the app. This prevents type drift.
- **Defensive label resolution.** `assigneeLabel` handles the `UNASSIGNED_FILTER_VALUE` sentinel, falls back through `name → email → raw ID`, and `phaseLabel` uses `?? String(phase)` for unknown enum values. Both are robust against unexpected data.
- **Stale-response token pattern.** The `userLoadToken` in `ft-app.loadUsers()` matches the established pattern in `ft-toolbar`, correctly guarding against out-of-order async responses.
- **Correct Shadow DOM event configuration.** `bubbles: true, composed: true` on the custom event ensures it crosses shadow boundaries — required for `ft-app` to catch it.
- **Conditional "Clear all" button.** Only shown when 2+ filters are active (`activeFilterCount >= 2`), avoiding a redundant button when a single chip's × already clears everything.

---

### Verification Story

- **Tests reviewed:** No tests included (consistent with other UI components in this project). Not blocking.
- **Build verified:** Yes — `tsc --noEmit && vite build` passes cleanly.
- **Lint/static analysis clean:** Yes — TypeScript strict-mode compilation succeeds with no errors.
- **Security checked:** Yes — No raw HTML injection vectors. All user-provided strings (names, emails, IDs) are rendered through Lit's auto-escaping template literals. Event detail is a typed interface. No credential exposure.
