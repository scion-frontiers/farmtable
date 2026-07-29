# PR Review: Feature 46 — Relationships Tab Delete + Quick-Add via Command Palette

**Branch:** `feat/f46-relationships-add-remove`
**Files Changed:** 6 files, +296/-19 lines
**Reviewed:** 2026-07-22

## Review Summary

**Verdict:** APPROVE (with recommendations)

**Overview:** A well-structured feature that extends the command palette with a relationship-add mode and adds inline delete for relationship rows. The code follows existing project patterns, the optimistic-update + rollback mechanism is correctly reused, and event propagation across shadow DOM boundaries is properly handled. Two issues should be addressed in a follow-up.

---

### Critical Issues

None.

---

### Important Issues

#### 1. "+" button appears on unsupported relationship types (UX/Correctness)

**File:** `web/src/components/inspector/ft-inspector-relationships.ts:225-244`

The "+" icon button renders on **every** `REL_GROUP_ORDER` section header, which includes `RELATED` and `DUPLICATE` types. However, the proto only supports `addBlocks` / `addBlockedBy` mutations (field IDs 22/23 in `farmtable.json`). The command palette only offers "Blocks" / "Blocked by" pills, and `onRelationshipAdd` in `ft-app.ts:800-804` funnels any non-BLOCKED_BY type into `addBlocks`.

**Impact:** Clicking "+" on the "Related" or "Duplicate of" section opens the command palette, but the user can only add a BLOCKS or BLOCKED_BY relationship — not the type suggested by the section heading. This is misleading.

**Suggested Fix — Option A (hide button on unsupported types):**

```typescript
// ft-inspector-relationships.ts render()
const ADDABLE_TYPES = new Set([RelationshipType.BLOCKED_BY, RelationshipType.BLOCKS]);

${REL_GROUP_ORDER.map((type) => {
    const tasks = grouped.get(type) ?? [];
    const canAdd = canEdit && ADDABLE_TYPES.has(type);
    return html`
      <div class="section">
        <div class="section-header">
          <div class="section-label">${REL_GROUP_LABEL[type]}</div>
          ${canAdd
            ? html`<sl-icon-button ...></sl-icon-button>`
            : nothing}
        </div>
        ...
      </div>
    `;
})}
```

**Suggested Fix — Option B (pass section type to pre-select pill):**

Thread the `type` through `onAddRelationship(type)` → event detail → `commandPaletteMode` initial `relationshipType` so the pill pre-selects correctly when the "+" is clicked on a supported section. Still hide the button on RELATED/DUPLICATE.

#### 2. Missing `readOnly` guard on `onRelationshipAdd` (Consistency)

**File:** `web/src/components/ft-app.ts:790-807`

`onTaskUpdate` (line 536) guards with `if (this.isReadOnly) return;`, but the sibling handler `onRelationshipAdd` does not. While the UI hides the "+" button in read-only mode, the handler is exposed as an event listener on the DOM and could be triggered programmatically or if the timing of `isReadOnly` changes after the palette opens.

**Suggested Fix:**

```typescript
private async onRelationshipAdd(e: CustomEvent) {
    if (this.isReadOnly) return;          // ← add guard
    const { targetTaskId, relationshipType } = e.detail as { ... };
    // ...
}
```

---

### Suggestions

#### 3. Quadratic array copying in `applyTaskUpdateFields` for multi-item adds

**File:** `web/src/gen/service.ts:104-128`

The `addBlocks` and `addBlockedBy` loops each do `updated.relationships = [...updated.relationships, newItem]` inside the for-loop, copying the entire array per iteration. For N items added to a task with R existing relationships, this is O(N*R).

In practice N=1 (the UI adds one at a time), so this is not a real performance issue — but it's a code-quality observation worth noting for future maintainers who might batch-add.

**Suggested Fix:**

```typescript
if (addBlocks !== undefined) {
    const existing = new Set(
        updated.relationships
            .filter((r) => r.type === RelationshipType.BLOCKS)
            .map((r) => r.targetTaskId),
    );
    const toAdd = addBlocks
        .filter(id => !existing.has(id))
        .map(id => ({ type: RelationshipType.BLOCKS, targetTaskId: id }));
    if (toAdd.length) {
        updated.relationships = [...updated.relationships, ...toAdd];
    }
}
```

#### 4. Relationship type pills lack proper ARIA role grouping

**File:** `web/src/components/ft-command-palette.ts:559-572`

The pills use `<button>` elements with `aria-selected`, but `aria-selected` is not a valid attribute for the `button` role per the ARIA spec. These act as a single-select group (like radio buttons). The container should have `role="radiogroup"` and each pill should have `role="radio"`.

**Suggested Fix:**

```html
<div class="rel-type-row" role="radiogroup" aria-label="Relationship type">
    <span class="rel-type-label">Type</span>
    ${REL_TYPE_LABELS.map(({ type, label }) => html`
        <button
            class="rel-type-pill"
            role="radio"
            aria-checked=${type === this.relationshipType ? 'true' : 'false'}
            @click=${() => this.onRelTypePillClick(type)}
        >${label}</button>
    `)}
</div>
```

#### 5. Consider pre-selecting relationship type from section context

**File:** `web/src/components/inspector/ft-inspector-relationships.ts:140-148`

`onAddRelationship()` doesn't pass the section's `type` to the event detail. The command palette always defaults to `BLOCKS`. Passing the type would let the palette pre-select the correct pill when opened from a specific section (e.g., clicking "+" on "Blocked by" should default the pill to "Blocked by").

```typescript
// In render(), pass the type from REL_GROUP_ORDER iteration:
@click=${() => this.onAddRelationship(type)}

// Update the method:
private onAddRelationship(relType?: RelationshipType) {
    if (this.readOnly) return;
    this.dispatchEvent(new CustomEvent('open-add-relationship', {
        detail: { taskId: this.task.id, defaultRelType: relType },
        bubbles: true, composed: true,
    }));
}
```

#### 6. Delete button has no keyboard accessibility on its own

**File:** `web/src/components/inspector/ft-inspector-relationships.ts:169-175`

The `sl-icon-button` inherits keyboard support from Shoelace so this is technically fine — it's focusable and activatable via Enter/Space. However, since the `.delete-btn` has `opacity: 0` by default and only shows on `:hover`, keyboard-only users who Tab into the entry won't see the trash icon appear. Consider adding a `:focus-within` rule on `.entry`:

```css
.entry:focus-within .delete-btn {
    opacity: 1;
}
```

---

### What's Done Well

1. **Clean command palette extension.** The `mode` property pattern cleanly extends the palette without breaking existing navigation behavior. The mode-conditional rendering (`isRelMode`) is minimal and well-isolated.

2. **Correct event propagation.** All new events (`open-add-relationship`, `relationship-add`, `task-update`) use `bubbles: true, composed: true` correctly, allowing them to cross shadow DOM boundaries from `ft-inspector-relationships` → `ft-inspector` → `ft-app` without requiring explicit re-dispatch.

3. **Proper state reset.** The `onCommandPaletteClose` handler and the Cmd+K toggle both reset `commandPaletteMode` and `addRelationshipTaskId`. The palette's `updated()` lifecycle also resets `relationshipType` when `open` changes. No stale state leaks between uses.

4. **Self-referential prevention.** The `excludeTaskId` prop correctly filters out the current task from search results in add-relationship mode, preventing self-referential relationships.

5. **Duplicate detection in optimistic update.** `applyTaskUpdateFields` checks for existing relationships before adding, preventing duplicates in the optimistic state. This matches the expected server-side behavior.

6. **Optimistic update + rollback reuse.** Both add and delete flows route through the existing `applyTaskUpdate()` method, inheriting the established pattern of optimistic store update → server call → rollback on error. No new error handling paths to maintain.

7. **Consistent read-only enforcement at the UI layer.** The `readOnly` prop correctly propagates from `ft-inspector` → `ft-inspector-relationships`, hiding "+" and trash buttons. The delete handler also short-circuits with `if (this.readOnly) return;` as a defense-in-depth measure.

---

### Verification Story

- **Tests reviewed:** No test files exist in the web/src directory. The project does not appear to have frontend unit tests. *(Not introduced by this PR.)*
- **Build verified:** Yes — `tsc --noEmit` passes cleanly with no errors.
- **Lint/static analysis:** No ESLint configuration present. TypeScript strict mode catches type errors.
- **Security checked:** Yes — no user-input injection vectors. All new data flows use typed event details with no raw HTML interpolation. Relationship IDs are passed as opaque strings to the server.
