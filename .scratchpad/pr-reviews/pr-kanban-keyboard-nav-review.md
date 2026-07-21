# PR Review: `feat/kanban-keyboard-nav` — Kanban Card Keyboard Navigation

**Branch:** `feat/kanban-keyboard-nav` (3 commits: initial feat + R1 fixes + R2 fixes)
**Files changed:** 3 (+179 / -4)
**Reviewer pass:** R3 (against final state of branch)

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds keyboard accessibility to kanban task cards via a
well-structured roving-tabindex pattern across three Lit components. The ARIA
roles (`listbox`/`option`), focus management, cross-column arrow navigation,
and event propagation are all implemented correctly. Previous R1 review
findings (redundant sort, missing ARIA roles, `--sl-` token prefix, inline
closures) have all been addressed in follow-up commits. One remaining
efficiency issue (`updated()` vs `willUpdate()` causing double renders) is
noted below but is not blocking.

---

### Critical Issues

None.

---

### Important Issues

#### 1. [ft-kanban-column.ts:130-136] `updated()` causes double render — should use `willUpdate()`

Setting `@state()` properties (`_sortedTasks` and `activeCardIndex`) inside
`updated()` schedules a second Lit update cycle. Every time `tasks` changes
(drag-drop, task creation, priority edit), the column renders twice:

1. **First render:** uses stale `_sortedTasks` (old value or empty `[]` on mount)
2. **`updated()` runs:** sets `_sortedTasks = sortTasks(this.tasks)` and clamps `activeCardIndex` → triggers new update
3. **Second render:** uses correct `_sortedTasks`

No infinite loop occurs (the guard `if (!changedProperties.has('tasks')) return`
exits on the second cycle since only `_sortedTasks`/`activeCardIndex` changed),
and no visual flicker occurs (microtask resolution prevents paint between
renders). But it doubles the render work on every task-list mutation across all
visible columns.

The codebase already uses `willUpdate()` for derived state in
`ft-inspector-desc.ts`, `ft-inspector-header.ts`, and `ft-inspector-meta.ts`.
`willUpdate()` runs *before* `render()`, so reactive property changes there
do **not** trigger additional update cycles — this is the documented Lit
pattern for computed/derived state.

**Suggested Fix:**
```ts
protected override willUpdate(changedProperties: PropertyValues<this>) {
  if (!changedProperties.has('tasks')) return;

  this._sortedTasks = sortTasks(this.tasks);
  const lastIndex = this._sortedTasks.length - 1;
  this.activeCardIndex = Math.max(0, Math.min(this.activeCardIndex, lastIndex));
}
```

Also adds the `override` keyword to match project convention.

**Severity:** Important (efficiency, not correctness).

---

### Suggestions

#### 2. [ft-task-card.ts:366] `aria-selected` renders `"false"` on non-selected options

```ts
aria-selected=${String(this.selected)}
```

This renders `aria-selected="false"` on every non-selected card. For a
single-select `listbox`, omitting `aria-selected` on non-selected options is
equally valid and reduces DOM attribute noise. Using Lit's `nothing` sentinel
is the idiomatic approach:

```ts
aria-selected=${this.selected ? 'true' : nothing}
```

Both behaviors are spec-compliant; screen readers handle both correctly. This
is a stylistic preference.

#### 3. [ft-task-card.ts:165] Default `cardTabIndex` is `0` — consider `-1`

```ts
@property({ type: Number, attribute: 'card-tab-index' })
cardTabIndex = 0;
```

The column always passes `card-tab-index` explicitly, so this default never
takes effect in current usage. However, a default of `-1` would be defensive —
if `ft-task-card` is ever rendered outside a column (tests, other list views),
it wouldn't create an unexpected tab stop.

#### 4. [ft-kanban-column.ts:237-245] `column-nav` event has `composed: true`

The `column-nav` custom event is consumed by `ft-kanban-view`'s shadow DOM
(the `.board` / `.on-hold-columns` div listener). Since the column element is
a direct child in the view's template, the event only needs to bubble within
the view's shadow tree — `composed: true` allows it to escape the view's
shadow boundary unnecessarily. Setting `composed: false` would scope the event
tighter.

No functional impact; minor encapsulation preference.

---

### What's Done Well

1. **Correct roving tabindex implementation.** One card per column gets
   `tabindex="0"`; all others get `"-1"`. The `activeCardIndex` is clamped
   when the task list changes and synced on `focusin`. This follows the
   WAI-ARIA composite widget spec precisely.

2. **Clean ARIA semantics.** The cards container uses `role="listbox"` with
   `aria-label`, each card uses `role="option"` with `aria-label` and
   `aria-selected`. The `focus-visible` styling ensures the focus ring only
   appears for keyboard users. The `--ft-focus-ring` custom properties use
   the project's namespace convention (fixed from `--sl-` prefix in R2).

3. **Robust event propagation handling.** The column's `onCardKeyDownHandler`
   checks `e.defaultPrevented` before acting. The card's `onKeyDown` guards
   with `e.target !== e.currentTarget` to avoid interfering with child
   elements (title input, priority selector). The title editor's
   `onTitleKeyDown` calls `stopPropagation()` to prevent arrow keys from
   triggering column navigation during text editing.

4. **Cross-column navigation is well-designed.** `ArrowLeft`/`ArrowRight`
   dispatches a `column-nav` event. The view's `onColumnNav` handler
   intelligently skips empty columns, clamps the target row index to the
   destination column's length, and correctly separates board columns from
   on-hold columns into independent keyboard regions (with a clear code
   comment explaining the design intent).

5. **Delegated event handlers** (fixed in R1). The `@focusin` and `@keydown`
   handlers use `data-card-index` attributes on the host element with a
   single `cardIndexFromEvent` extractor, avoiding per-card closure
   allocation. Clean pattern.

6. **Enter/Space activation** (`onKeyDown` in `ft-task-card.ts`) dispatches
   the same `task-select` event as click via the extracted `dispatchTaskSelect`
   method, keeping the inspector panel fully keyboard-accessible.

7. **No regression to existing features.** Drag-and-drop, click-to-select,
   inline title editing, and inline priority editing are all functionally
   unaffected by these changes.

---

### Verification Story

- **Tests reviewed:** No test files changed. Keyboard navigation would
  benefit from component tests, but this is consistent with the project's
  current coverage approach. Not blocking.
- **Build verified:** Yes — `npm run typecheck` and `npm run build` both pass
  cleanly (tsc + Vite, 284 modules, 0 errors).
- **Lint/static analysis:** No lint script configured in the web project.
- **Security checked:** No new dependencies, no `innerHTML` usage, no
  credential exposure. `data-card-index` uses `Number()` coercion with
  `Number.isNaN` guard. Custom events use typed detail objects. No concerns.

---

### Summary of Findings

| # | Severity   | File                   | Line    | Finding                                                       |
|---|------------|------------------------|---------|---------------------------------------------------------------|
| 1 | Important  | ft-kanban-column.ts    | 130-136 | `updated()` → double render; use `willUpdate()` instead       |
| 2 | Suggestion | ft-task-card.ts        | 366     | `aria-selected="false"` could be omitted via `nothing`        |
| 3 | Suggestion | ft-task-card.ts        | 165     | Default `cardTabIndex` could be `-1` for defensive safety     |
| 4 | Suggestion | ft-kanban-column.ts    | 237-245 | `column-nav` event doesn't need `composed: true`              |
