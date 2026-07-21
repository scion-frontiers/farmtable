# PR Review: feat/empty-filter-message (1f5eac9)

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a small, well-scoped UI change that adds a subdued "No visible tasks match this filter." message inside kanban columns when a filter is active and hides all tasks in that column. The implementation is correct, minimal, and consistent with existing patterns in the component.

---

### Critical Issues

None.

### Important Issues

None.

### Suggestions

1. **[ft-kanban-column.ts:326-331] Accessibility: empty-filter-message lacks ARIA semantics inside the `role="listbox"` container.**

   The `.cards` container has `role="listbox"`, and the new `<div class="empty-filter-message">` is rendered inside it. A plain `<div>` is not a valid child of a `listbox` (which expects `option` children). Screen readers may ignore or misinterpret the message.

   **Suggested fix:** Add `role="status"` or `role="alert"` (if the message should be announced proactively) to the div, or alternatively use `aria-live="polite"` so screen readers announce the filter-empty state:

   ```ts
   html`<div class="empty-filter-message" role="status">
     No visible tasks match this filter.
   </div>`
   ```

   This also helps users who rely on assistive technology understand that the column isn't just empty — it's empty *because of the active filter*.

2. **[ft-kanban-column.ts:329] Prefer `nothing` over empty string for the falsy branch of lit-html ternary.**

   The existing codebase (see `ft-kanban-view.ts:349`) uses Lit's `nothing` sentinel for conditional rendering. The new code uses `''` (empty string) as the else-branch. While both work, `nothing` avoids creating an empty text node in the DOM and is the idiomatic Lit pattern.

   ```ts
   // Before
   : ''}

   // After (import `nothing` from 'lit' — already imported in ft-kanban-view.ts)
   : nothing}
   ```

   Note: `nothing` is not currently imported in `ft-kanban-column.ts`, so this would require adding it to the import. Minor, hence a suggestion.

### What's Done Well

- **Correct guard condition.** The `isFiltered && sorted.length === 0` check is exactly right. It reuses the existing `isFiltered` derivation (`totalCount > 0 && sorted.length !== totalCount`), which means:
  - A genuinely empty column (`totalCount === 0`) does NOT show the message (correct — there's nothing to filter).
  - A column with tasks that all pass the filter (`sorted.length === totalCount`) does NOT show the message (correct — no filter effect).
  - Only the case where a filter is active AND it hides everything triggers the message.
- **Minimal footprint.** The change is 13 lines of CSS + template. No new properties, no new state, no lifecycle changes. This is the right size for a purely presentational concern.
- **i18n comment.** The `NOTE(i18n)` comment is a good practice — it flags the hardcoded string for future extraction without over-engineering now.
- **Style consistency.** The CSS uses the project's existing design-token convention (`var(--sl-color-neutral-500)`) and relative units, consistent with adjacent styles in the same file.

### Verification Story

- **Tests reviewed:** No tests exist for this component (no test files found under `web/src/components/kanban/`). This is pre-existing; the change itself is simple enough (pure conditional rendering with no new logic branches beyond what `isFiltered` already covers) that the lack of a dedicated test is acceptable for this PR.
- **Build verified:** Yes — `npm run typecheck` passes cleanly.
- **Lint/static analysis clean:** No lint script configured for the web package; typecheck is the available static check and it passes.
- **Security checked:** Yes — no user input is rendered; the message is a static string literal in a Lit template (auto-escaped). No injection vector.
