## Review Summary

**Verdict:** APPROVE

**Overview:** This is a small, well-scoped UI change that adds a subdued inline message ("No visible tasks match this filter.") inside kanban columns when a filter hides all tasks. The implementation is clean, correctly reuses the existing `isFiltered` derived state, and uses appropriate Lit idioms (`nothing` sentinel, `role="status"` for accessibility).

### Critical Issues

None.

### Important Issues

None.

### Suggestions

- **[ft-kanban-column.ts:276] Edge case: `totalCount` could theoretically be greater than 0 while `sorted.length` is 0 for non-filter reasons (e.g., a race where `tasks` is set to `[]` before `totalCount` updates to `0`).** The existing `isFiltered` derivation (`this.totalCount > 0 && sorted.length !== this.totalCount`) was already in use for the count chip and tooltip before this PR, so this is pre-existing behavior the PR inherits, not something it introduces. However, the new empty-filter message makes this edge case more user-visible — a stale `totalCount` would flash "No visible tasks match this filter" even when no filter is active. Worth noting but not blocking; the parent view (`ft-kanban-view.ts:270-284`) recomputes both `tasks` and `totalCount` in the same render pass, so the property pair should always be coherent in practice.

- **[ft-kanban-column.ts:327-330] The `role="status"` element is rendered inside a `role="listbox"`.** ARIA spec says `listbox` children should have `role="option"` (or `role="group"` containing options). A `role="status"` live region nested inside a listbox is technically non-conformant. Screen readers generally handle this gracefully (the live-region announcement fires regardless of DOM position), but to be spec-safe, consider moving the message *after* the `.cards` div, as a sibling, rather than a child of the listbox. This is a minor a11y suggestion, not a blocker.

  **Suggested fix:**
  ```ts
  </div>
  ${isFiltered && sorted.length === 0
    ? html`<div class="empty-filter-message" role="status">
        <!-- NOTE(i18n): Hardcoded English; extract if i18n is added. -->
        No visible tasks match this filter.
      </div>`
    : nothing}
  ```
  (Placed after the closing `</div>` of `.cards`, as a child of `:host` rather than the listbox.)

### What's Done Well

- **Correct use of `nothing`:** Importing Lit's `nothing` sentinel and using it as the else-branch avoids rendering an empty text node. This is the idiomatic Lit approach and was correctly adopted in the second commit.
- **`role="status"` for accessibility:** The live-region semantics mean screen readers will announce the message when it appears, which is the right UX for a filter-driven state change.
- **`i18n` comment breadcrumbs:** The `NOTE(i18n)` comment matches the existing convention at line 277 — nice consistency. This makes future i18n extraction straightforward.
- **Minimal footprint:** Only one file changed, the CSS uses existing design tokens (`--sl-color-neutral-500`), and no new properties or events were added. The change is well-contained.
- **Defensive condition:** `isFiltered && sorted.length === 0` is correct — it only shows the message when there are unfiltered tasks (`totalCount > 0`) *and* none match the active filter. A column that's genuinely empty (no tasks at all, `totalCount === 0`) correctly shows nothing.

### Verification Story

- **Tests reviewed:** No tests exist for this component (no test files found under `web/src/`). This is pre-existing — the PR doesn't reduce coverage. The logic added is purely presentational (a conditional template fragment), so the risk of untested behavior is low.
- **Build verified:** Not applicable (web component, no Go code changed).
- **Lint/static analysis clean:** Not checked (no lint config invoked), but the TypeScript is syntactically correct and matches project conventions.
- **Security checked:** Yes — no user input is rendered (the message is a hardcoded string), no new event handlers, no new data flow. No security concerns.
