# PR Review (R2): Feature 5 — Inspector Label Editing

**Branch:** `feat/inspector-label-edit` vs `main`
**Files changed:** 4 (3 source, 1 project log)
**Commits:** 3 (`da0ff6a` service+gRPC, `7f46abd` inspector UI, `04a2274` R1 fixes)
**Date:** 2026-07-19

---

## Review Summary

**Verdict:** REQUEST CHANGES

**Overview:** The feature is architecturally sound — the type-level enforcement (`Omit<..., 'labels'>` + `addLabels`/`removeLabels`), the gRPC mapping, and the optimistic-update logic are all correct. However, the `@sl-blur` handler added in the R1 fix commit creates a race condition that makes the confirm (✓) button non-functional: blur fires before click, clearing the draft, so `saveLabelAdd()` silently discards the label. This needs to be fixed before merge.

---

### Critical Issues

None.

### Important Issues

1. **[ft-inspector-meta.ts:284] `@sl-blur` → `cancelLabelAdd` races with the ✓ button click — confirm button is dead**

   When the user clicks the ✓ (`check2`) icon-button to save a label, the browser event sequence is:
   1. `mousedown` on the button
   2. Input loses focus → `sl-blur` fires → `cancelLabelAdd()` sets `labelDraft = ''`
   3. `click` fires on the button → `saveLabelAdd()` reads `this.labelDraft.trim()` → gets `""` → returns early

   The label is silently discarded. Users can only save via the Enter key. The ✓ button is visible but non-functional, which is confusing UX.

   The ✗ cancel button has the same race but is incidentally correct (blur already cancels, so the redundant cancel click is harmless).

   **Suggested fix — option A (save on blur instead of cancel):**
   ```typescript
   @sl-blur=${this.saveLabelAdd}
   ```
   This saves non-empty drafts on blur (Enter and blur both save). The ✓ button fires redundantly on empty draft, which is harmless. Clicking ✗ would need a mousedown handler to clear the draft before blur fires:
   ```html
   <sl-icon-button name="x-lg" label="Cancel" @mousedown=${this.cancelLabelAdd}></sl-icon-button>
   ```
   Note: use `@mousedown` (fires before blur) rather than `@click` (fires after blur).

   **Suggested fix — option B (remove the blur handler, match date editing):**
   ```html
   <sl-input
     class="label-input"
     size="small"
     .value=${this.labelDraft}
     @input=${this.onLabelInput}
     @keydown=${this.onLabelKeyDown}
   ></sl-input>
   ```
   This matches the date editor pattern in the same component, which has no blur handler. The input stays open until the user explicitly saves (Enter / ✓) or cancels (Escape / ✗). Simplest fix and eliminates the race entirely.

   Option B is recommended — it's the smallest diff and is consistent with the sibling pattern.

### Suggestions

1. **[ft-inspector-meta.ts:142–144] `onLabelRemove` extracts label text via `textContent?.trim()` — fragile**

   Reading `tag.textContent?.trim()` works today because `textContent` only traverses light DOM (not shadow DOM), and the only light-DOM child is the `${label}` text node. However, this couples correctness to Shoelace's internal structure — if a future Shoelace version adds light-DOM children to `sl-tag`, or if additional content is slotted alongside the label, this would break silently.

   **Suggested improvement:**
   ```html
   <sl-tag data-label=${label} size="small" variant="neutral" removable @sl-remove=${this.onLabelRemove}>
     ${label}
   </sl-tag>
   ```
   ```typescript
   private onLabelRemove(e: Event) {
     const tag = e.currentTarget as HTMLElement;
     const label = tag.dataset.label;
     if (label) this.dispatchTaskUpdate({ removeLabels: [label] });
   }
   ```

2. **[ft-inspector-meta.ts:168–176] `saveLabelAdd` resets UI state before dispatching — subtle ordering**

   `saveLabelAdd()` sets `addingLabel = false` and `labelDraft = ''` before the `includes()` check and `dispatchTaskUpdate()` call. This means the input closes before the event fires. If the event dispatch or optimistic update were to throw synchronously, the input would already be closed with no way to retry. In practice, `dispatchEvent` doesn't throw and the optimistic update is in a different component, so this is safe today. Just noting the ordering as a future maintainability concern.

3. **[service.ts:62–72] Consider guarding against `undefined` labels array in the remove path**

   ```typescript
   if (removeLabels !== undefined) {
     const labelsToRemove = new Set(removeLabels);
     updated.labels = updated.labels.filter((label) => !labelsToRemove.has(label));
   }
   ```

   If `updated.labels` were ever `undefined` (e.g., a partial Task mock missing the field), `.filter()` would throw. The `Task` type requires `labels: string[]`, so this shouldn't happen with valid data. But given that `applyTaskUpdateFields` is used for optimistic updates on client-side state, a defensive `(updated.labels ?? [])` would be resilient to malformed data from watch events.

4. **[ft-inspector-meta.ts] No maximum length enforcement on label input**

   The date input is constrained by the browser's date picker. The label input has no `maxlength` attribute, so a user could type an arbitrarily long label. The backend may or may not enforce limits — adding a reasonable `maxlength` (e.g., 100) as a UI-level guard would prevent obviously invalid input.

   ```html
   <sl-input class="label-input" size="small" maxlength="100" .value=${this.labelDraft} ...>
   ```

### What's Done Well

- **Type-level enforcement is the right call.** Omitting `'labels'` from the `Partial<Task>` base of `UpdateTaskFields` and exposing only `addLabels`/`removeLabels` makes it a compile-time error to accidentally overwrite the full labels array. This is the kind of change that prevents an entire class of bugs.

- **Optimistic update + rollback is correctly followed.** Both `ft-app.ts` (`applyTaskUpdate`) and `ft-kanban-view.ts` (`onTaskUpdate`) apply `applyTaskUpdateFields` optimistically, send the gRPC call, and rollback to the original task on failure. The `addLabels`/`removeLabels` fields flow through this pattern correctly because the parent components don't need to know about label semantics — they just pass `fields` through.

- **`applyTaskUpdateFields` label logic is clean.** Using `Set` for deduplication on add and `Set.has()` for O(1) removal lookups is correct. The ordering comment (`addLabels before removeLabels`) was added from the R1 feedback and documents the contract clearly.

- **gRPC client mapping is minimal and precise.** The `?.length` guard correctly skips empty arrays (proto no-op), and the comment explains why. The field names align with the protobufjs JSON convention against the proto descriptor — verified against `farmtable.json`.

- **R1 fix: `.value=` property binding on date input.** The change from `value=${this.dateDraft}` to `.value=${this.dateDraft}` is correct — Shoelace `sl-input` tracks state as a property, and property binding ensures the DOM stays in sync after user interaction. Good catch in R1.

- **UI-level duplicate guard.** `this.task.labels.includes(label)` in `saveLabelAdd()` silently discards no-op adds before dispatching, preventing a redundant optimistic update cycle. Combined with the `Set`-based dedup in `applyTaskUpdateFields`, duplicates are prevented at both the UI and service layers.

- **Project log documents verification steps thoroughly.** Typecheck, build, Go tests, Go build, and Playwright screenshots — this is the right level of documentation for a feature log.

### Verification Story

- **Tests reviewed:** No new unit tests. The `applyTaskUpdateFields` function would benefit from unit tests covering `addLabels`, `removeLabels`, and the combined case — this is pre-existing tech debt, not introduced here.
- **Build verified:** `npm run typecheck` and `npm run build` pass cleanly.
- **Go build/test verified:** `go build ./...` and `go test ./...` pass cleanly.
- **Security checked:** No new attack surface. Labels are user-typed strings rendered via Lit template auto-escaping (no raw HTML). The gRPC transport treats them as opaque proto strings. No credential handling, no user-controlled URLs.

---

**Action required:** Fix the blur/click race (Important #1) — recommend option B (remove `@sl-blur`, match existing date editing pattern). The rest are optional improvements.
