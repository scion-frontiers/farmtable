# PR Review: feat/filtered-count-badge

**Branch:** `feat/filtered-count-badge`  
**Commits:** 2 (`60e65ea feat: add filtered task count badge to filter chips row`, `451b784 fix: use attribute-false property binding for count props`)  
**Files changed:** 4 (48 insertions, 17 deletions)  
**Reviewer:** Code Review Agent  
**Date:** 2026-07-19

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR extracts the inline filter-matching logic from `ft-kanban-view` into a shared `matchesTaskFilters()` pure function in `task-filters.ts`, reuses it in `ft-app` to compute filtered/total task counts, and displays the result as an "N of M tasks" badge in the filter chips row. The change is clean, well-scoped, and correctly preserves existing behavior while adding a useful UI affordance with minimal risk.

---

### Critical Issues

None.

---

### Important Issues

None.

---

### Suggestions

1. **[ft-app.ts:100–106] Filter computation runs on every render**

   The `filteredCount` is computed inside `render()` by iterating `allTasks.filter(...)` on every Lit re-render. For typical kanban board sizes (low hundreds of tasks) this is negligible. The short-circuit guard on line 103 (`this.phaseFilter !== null || this.assigneeFilter !== null`) correctly avoids the `.filter()` when no filters are active — which is the common path — so this is well-optimized for the default case.

   **Note for future:** If task counts grow into the thousands and frequent re-renders are observed, consider moving this to `willUpdate()` with a dirty check on `phaseFilter`, `assigneeFilter`, and the task store version. Not needed at current scale.

2. **[ft-filter-chips.ts:92] Badge visibility when `totalCount` is 0**

   When the task store is empty (loading complete but no tasks match the collection, or a transient empty state), the badge will render "0 of 0 tasks". This is technically correct and not a bug, but could look odd to users. A minor UI polish would be to hide the badge when `totalCount === 0`:

   ```typescript
   ${this.totalCount > 0
     ? html`<span class="task-count">${this.filteredCount} of ${this.totalCount} tasks</span>`
     : nothing}
   ```

   This is purely cosmetic and not blocking.

3. **[ft-filter-chips.ts:92] Badge placement and flex-wrap interaction**

   The `.chips` container uses `flex-wrap: wrap`. The badge uses `margin-left: auto` to push itself right. When the viewport is narrow enough to trigger wrapping, the badge will still grab all available space on its line via `margin-left: auto`. This should be fine since `white-space: nowrap` prevents the badge text from wrapping internally, but it's worth a quick manual verification that the layout doesn't look odd at narrow widths with both filter chips, the badge, and the "Clear all" button all present.

4. **[ft-app.ts:100] Double iteration of `allTasks`**

   The `allTasks` getter creates a new array via `[...this.tasks.values()]` on each call. The PR correctly assigns this to a local `const allTasks` and reuses it — both for `.length` and for the conditional `.filter()`. This is an improvement over the pre-PR code which called the getter and `.length` on the same line. No action needed; noting the good pattern.

---

### What's Done Well

1. **Clean extraction of shared logic.** The `matchesTaskFilters()` function is a well-designed pure function: it takes explicit parameters (no `this` binding), is collocated with `UNASSIGNED_FILTER_VALUE` in `task-filters.ts`, and exactly preserves the original semantics. Line-by-line comparison of the removed kanban code vs. the new shared function confirms identical logic.

2. **Short-circuit optimization.** The guard on `ft-app.ts:103` (`this.phaseFilter !== null || this.assigneeFilter !== null`) avoids allocating a filtered array in the no-filter case, which is the most common state. This is a thoughtful and correct optimization.

3. **Follow-up commit addresses prior review feedback.** The second commit (`451b784`) correctly changes `@property({ type: Number })` to `@property({ attribute: false })` for `filteredCount` and `totalCount`, aligning with the convention used by every other property in `FtFilterChips`. This is the right pattern since these props are only set programmatically via Lit's `.prop=` binding.

4. **Proper import cleanup.** The old `UNASSIGNED_FILTER_VALUE` import in `ft-kanban-view.ts` is correctly removed since the constant is now used only internally by the shared `matchesTaskFilters()`. The new `matchesTaskFilters` import replaces it cleanly.

5. **Minimal, focused diff.** Four files, ~50 lines changed, no unrelated changes. The kanban view's `matchesFilters()` method is simplified to a one-line delegation without changing its `private` visibility or call site — consumers see no change.

6. **CSS approach is idiomatic.** `margin-left: auto` in a flex container is the standard pattern for pushing an element right. Combined with `white-space: nowrap`, the badge is robust against text truncation.

---

### Verification Story

- **Tests reviewed:** No new tests added. `matchesTaskFilters()` is a pure function that could benefit from unit tests, but since the logic is an exact extraction of code already exercised by the kanban view's runtime behavior, the risk is minimal. Consider adding tests if the filter logic grows (e.g., label filters, priority filters).
- **Build verified:** Yes — `tsc --noEmit` passes cleanly with zero errors.
- **Lint/static analysis clean:** Yes — TypeScript compilation shows no warnings or errors.
- **Security checked:** Yes — no user input handling, no network calls, no credential exposure, no DOM injection. The change is purely presentational computation on already-sanitized data from the task store.
