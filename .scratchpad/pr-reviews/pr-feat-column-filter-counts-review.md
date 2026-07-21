# PR Review: feat/column-filter-counts (377b17b)

**Feature 15 — Per-column filtered count summaries in kanban column headers**

## Review Summary

**Verdict:** APPROVE

**Overview:** A clean, minimal 14-line change that adds "N of M" count labels to
kanban column headers when filters are active. The logic is correct, the CSS
overrides are necessary and appropriate, and the data flow is sound. No blocking
issues found.

---

## Critical Issues

None.

## Important Issues

### 1. Double `getByStage()` call per column — minor efficiency concern

**File:** `web/src/components/kanban/ft-kanban-view.ts:271-280`

`getColumnTasks()` already calls `this.store.getByStage(col.stage)` internally
(line 134), and `totalCount` calls it again. For each column, `getByStage`
iterates over *all* tasks in the store twice — once for filtered tasks and once
for the unfiltered total.

```typescript
// Current — two getByStage calls per column:
tasks: this.getColumnTasks(col.stage),        // calls getByStage + filter
totalCount: this.store.getByStage(col.stage).length,  // calls getByStage again
```

**Severity:** Suggestion (not Important). With typical task counts (dozens to low
hundreds), the cost is negligible. This becomes relevant only at scale.

**Suggested fix (optional):**
```typescript
const boardColumns = BOARD_COLUMNS.map((col) => {
  const allForStage = this.store.getByStage(col.stage);
  return {
    ...col,
    tasks: allForStage.filter((task) => this.matchesFilters(task)),
    totalCount: allForStage.length,
  };
});
```

This halves the iteration per column and makes the relationship between
`tasks` and `totalCount` explicit. The same pattern applies to `onHoldColumns`.

---

## Suggestions

### 2. Edge case: `totalCount === 0` hides "0 of 0" — intentional and correct

**File:** `web/src/components/kanban/ft-kanban-column.ts:259-262`

The guard `this.totalCount > 0` means that when a column has zero total tasks,
it simply shows `"0"` via the fallback branch. This is correct behavior — if
there are no tasks at all, "0 of 0" would be redundant noise.

The second guard `sorted.length !== this.totalCount` correctly suppresses the
"N of M" format when no filter is active (or the filter doesn't exclude
anything from this column). Good.

**One subtle case:** if `totalCount` is never explicitly set (defaults to `0`),
the column will always show just the filtered count. This is safe because the
parent view always passes `totalCount` now, and the default of `0` is a
reasonable fallback for standalone usage.

No action needed — documenting that the logic was reviewed.

### 3. Consider ARIA live region for screen readers

**File:** `web/src/components/kanban/ft-kanban-column.ts:268`

The count badge now conveys filtering state that screen-reader users might miss.
Adding `aria-label=${`${countLabel} tasks`}` to the `.count` span would improve
accessibility.

```html
<span class="count" aria-label=${`${countLabel} tasks`}>${countLabel}</span>
```

**Severity:** Suggestion — a nice-to-have for accessibility.

### 4. The "of" text is English-only

**File:** `web/src/components/kanban/ft-kanban-column.ts:261`

The string `${sorted.length} of ${this.totalCount}` is hardcoded English.
If i18n is ever a concern, this would need extraction. Not a problem today
given the rest of the codebase uses hardcoded strings throughout.

**Severity:** Nitpick — no action needed now.

---

## What's Done Well

- **Minimal surface area.** Only 14 lines added across 2 files. The feature is
  implemented exactly where it belongs — data sourced in the view, rendered in
  the column — with no unnecessary abstractions.

- **Correct CSS inheritance fix.** The `.header` sets `text-transform: uppercase`
  and `letter-spacing: 0.04em`, which would turn "of" into "OF" and add spacing
  inside the count badge. The overrides on `.count` (`text-transform: none;
  letter-spacing: 0;`) are precisely targeted and necessary.

- **Defensive defaults.** `totalCount` defaults to `0`, and the conditional
  `this.totalCount > 0 && sorted.length !== this.totalCount` gracefully handles
  both "no filter active" and "component used without totalCount" scenarios.

- **Consistent data source.** Both `tasks` (filtered) and `totalCount`
  (unfiltered) derive from `this.store.getByStage()`, which guarantees they
  reference the same stage's data. There's no risk of count mismatch from
  different data sources.

---

## Verification Story

- **Tests reviewed:** No component tests exist for kanban columns (noted by
  existing TODO in the codebase). No new tests added, which is acceptable for a
  pure UI display change of this size.
- **Build verified:** Yes — `tsc --noEmit` passes cleanly.
- **Lint/static analysis clean:** Yes — no type errors.
- **Security checked:** Yes — no user input, no network calls, no DOM
  manipulation beyond Lit templating. No concerns.
