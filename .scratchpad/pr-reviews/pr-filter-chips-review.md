# PR Review: `feat/filter-chips`

**Branch:** `feat/filter-chips` (2 commits: `c87d2ec`, `a45f33e`)
**Files changed:** `web/src/components/ft-filter-chips.ts` (new), `web/src/components/ft-app.ts` (modified)
**Lines added:** 171 | **Lines removed:** 1

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This PR adds an `<ft-filter-chips>` Lit component that renders active filter state as removable tag chips below the toolbar, with a "Clear all" action when both filters are active. The implementation is clean, well-scoped, type-safe, and follows the project's existing patterns closely. No critical or blocking issues found.

---

### Critical Issues

None.

---

### Important Issues

**1. [ft-filter-chips.ts:51] Side-effect in `render()` — setting `this.hidden` triggers re-render loop risk**

Setting `this.hidden` inside `render()` mutates the host element's attribute during the render cycle. In Lit, setting a reflected property that schedules an update inside `render()` can trigger an infinite re-render loop. The `hidden` attribute on `HTMLElement` is a native reflected attribute, so setting `this.hidden = true` will call `attributeChangedCallback` and may re-trigger rendering depending on Lit's dirty-checking.

In practice Lit guards against synchronous re-entrancy, so this is unlikely to loop, but it's a code smell that violates the Lit guidance of keeping `render()` side-effect-free.

**Suggested Fix:**

Use Lit's `willUpdate()` lifecycle instead:

```typescript
protected willUpdate(changedProperties: PropertyValues) {
  super.willUpdate(changedProperties);
  const activeFilterCount =
    Number(this.phaseFilter !== null) + Number(this.assigneeFilter !== null);
  this.hidden = activeFilterCount === 0;
}

render() {
  if (this.hidden) return nothing;
  // ... rest unchanged
}
```

Alternatively, use the `updated()` lifecycle, or move the host visibility logic to the parent (`ft-app`) via a conditional render with `?hidden=`.

---

**2. [ft-app.ts:87,181-197] Duplicate `listUsers()` call — redundant network request on startup**

The PR adds a second `listUsers()` call at the app level while `ft-toolbar` already calls the same endpoint independently (noted in the TODO on line 182-183). This means every page load fires two identical gRPC calls. While acknowledged by the TODO, for a PR introducing new code this is a good time to consolidate rather than commit to the duplication.

**Suggested Fix (for follow-up):**

Pass `this.users` into `ft-toolbar` as a property (same pattern as `ft-filter-chips`), and make `ft-app` the single owner of the user list. This eliminates a race between the two independent loads and halves startup RPC calls.

---

### Suggestions

**3. [ft-filter-chips.ts:6-12] `PHASE_LABELS` Record is exhaustive today but fragile if enum grows**

The `Record<TaskPhase, string>` type ensures completeness at compile time, which is good. However, the fallback `PHASE_LABELS[phase] ?? String(phase)` on line 92 is unreachable by the type system (`Record<TaskPhase, string>` guarantees a value for every enum member). If a new phase is added to the proto and the generated enum without updating this map, TypeScript will catch it at build time because `Record<TaskPhase, string>` would be incomplete. This is already well-handled — just noting the `?? String(phase)` is defensive dead code, which is fine.

**4. [ft-filter-chips.ts:40-46] Consider using `@state()` instead of `@property()` for internal-only data**

The `phaseFilter`, `assigneeFilter`, and `users` properties use `@property({ attribute: false })`. Since these are only set programmatically from the parent (never via HTML attributes), `@state()` would be semantically more accurate and slightly more efficient (skips attribute reflection logic entirely).

This is a minor style point; `@property({ attribute: false })` works correctly and is a valid alternative.

**5. [ft-app.ts:118] Event name `filter-clear` vs `filter-change` — intentional but worth a comment**

The chips component fires `filter-clear` while the toolbar fires `filter-change`. Both are handled by the same `onFilterChange` handler in `ft-app`, which works because they share the same `TaskFilterChangeDetail` shape. The semantic distinction is reasonable (one sets filters, one clears them), but a brief comment at the handler or the event listener would help future readers understand why two event names map to one handler.

**6. [ft-app.ts:184] `userLoadToken` staleness guard is good but `loadUsers` is only called once**

The token-based staleness guard (`++this.userLoadToken` / `if (token === this.userLoadToken)`) is the correct pattern for preventing stale async responses. However, since `loadUsers()` is only called once in `connectedCallback()` and never again, the guard is currently unnecessary. It does protect against a future scenario where re-loads are added, so keeping it is fine as forward-compatible defensive code.

---

### What's Done Well

1. **Clean component boundary.** `FtFilterChips` is purely presentational — it receives filter state via properties and emits events upward. No internal state management, no direct store access. This is textbook Lit component design.

2. **Correct event composition.** The `filter-clear` event is dispatched with `bubbles: true, composed: true`, which correctly crosses shadow DOM boundaries. This matches the existing `filter-change` event pattern in `ft-toolbar`.

3. **Reuse of `TaskFilterChangeDetail`.** Both the toolbar and filter chips share the same event detail type, so the parent's `onFilterChange` handler works for both without any adapter logic. Good DRY practice.

4. **Accessibility.** The `role="group"` with `aria-label="Active filters"` on the chips container is a nice touch for screen reader users.

5. **Graceful degradation.** The `assigneeLabel()` method falls back through `user.name` -> `user.email` -> raw `assigneeId`, which handles cases where the user list hasn't loaded yet or the user was deleted.

6. **TypeScript strictness.** The `PHASE_LABELS` is typed as `Record<TaskPhase, string>`, which will produce a compile error if a new phase is added to the enum — no runtime surprises.

7. **Hidden-when-empty.** The component hides itself when no filters are active, avoiding an empty bar with padding. The `:host([hidden])` style override ensures `display: none !important` takes effect.

---

### Verification Story

- **Tests reviewed:** No tests exist for this component. No test files were added in the PR. This is consistent with the existing component test coverage in this project (other Lit components also lack unit tests). **Recommendation:** Consider adding basic tests in a follow-up, especially for the `assigneeLabel` fallback chain and the "Clear all" visibility threshold.
- **Build verified:** Yes — `tsc --noEmit` passes cleanly with zero errors.
- **Lint/static analysis clean:** Yes — TypeScript strict mode check passes.
- **Security checked:** Yes — no user input handling, no innerHTML, no credential exposure. All data flows through typed properties. No concerns.
