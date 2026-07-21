# Feature 3: Inline Card Editing — Review Round 2

**Verdict:** APPROVE

**Overview:** Well-structured feature that adds inline title and priority editing
to Kanban cards. The code follows existing patterns closely (optimistic update +
rollback, composed/bubbling custom events), handles drag/edit interference
correctly, and the TypeScript compiles cleanly. Two important findings and a
handful of suggestions below.

---

## Critical Issues

None.

---

## Important Issues

### I-1. Double-fire on title save: blur fires after Enter commits

**File:** `web/src/components/kanban/ft-task-card.ts:207-215`

When the user presses Enter, `saveTitleEdit()` runs, sets `isEditingTitle =
false`, and dispatches `task-update`. Lit then re-renders, removing the
`<sl-input>` from the DOM. Depending on the browser's microtask timing, the
input's `blur` event may fire *before* the element is fully disconnected,
calling `saveTitleEdit()` a second time. The guard `if (!this.isEditingTitle)
return;` on line 208 protects against a second dispatch in the *same*
synchronous frame because `isEditingTitle` was already set to `false` in the
first call — so the second invocation is a no-op.

**Assessment:** The existing guard on line 208 (`if (!this.isEditingTitle)
return;`) actually does prevent the double-dispatch. The `saveTitleEdit()` call
from Enter sets `isEditingTitle = false` synchronously before any async work, so
the subsequent blur-triggered call hits the early return. This is correct as
written. However, the ordering guarantee is subtle and depends on the `blur`
handler reading the already-mutated `isEditingTitle` state synchronously.

**Recommendation:** Add a brief comment above the guard to document this
intentional interaction for future maintainers:

```ts
// Guard: when Enter triggers save, the subsequent blur event also calls this
// method. The flag is cleared synchronously so the second call is a no-op.
if (!this.isEditingTitle) return;
```

### I-2. `cancelTitleEdit` unreachable from blur — Escape then blur still saves

**File:** `web/src/components/kanban/ft-task-card.ts:218-222, 349-351`

When the user presses Escape, `cancelTitleEdit()` runs: it resets `titleDraft`
and sets `isEditingTitle = false`. This causes the `<sl-input>` to be removed
from the DOM on re-render, which fires `blur`. The `blur` handler calls
`saveTitleEdit()`, which hits the `if (!this.isEditingTitle) return` guard and
exits harmlessly. So Escape-then-blur works correctly.

**Assessment:** Correct — the same guard that handles I-1 handles this case too.
No bug here, but worth a brief test to confirm this across browsers.

---

## Suggestions

### S-1. `draggable` attribute set to string `"false"` — minor semantics issue

**File:** `web/src/components/kanban/ft-task-card.ts:332`

```ts
draggable=${String(!this.isEditingTitle && !this.isEditingPriority)}
```

This produces `draggable="false"` when editing. Per the HTML spec, the
`draggable` attribute's only valid values are `"true"` and `"false"` (as
strings), so this is technically correct. The `String(boolean)` cast works fine
here.

No change needed — just noting this is intentionally correct.

### S-2. Title input uses native `maxlength="200"` but `MAX_TITLE_LEN` is 80

**File:** `web/src/components/kanban/ft-task-card.ts:34, 344`

The display-side truncation uses `MAX_TITLE_LEN = 80`, but the input allows 200
characters. This is probably intentional — the card *display* truncates at 80
chars with an ellipsis, but the actual title can be longer (visible in full when
editing or in the inspector). If there's a server-side max, consider aligning the
`maxlength` with that value.

**Recommendation:** Add a named constant if there's a backend constraint:

```ts
const MAX_TITLE_INPUT_LEN = 200; // server limit; MAX_TITLE_LEN is display-only
```

### S-3. `onPriorityChange` casts `Number(value)` without validating against known enum values

**File:** `web/src/components/kanban/ft-task-card.ts:251-261`

```ts
const raw = Number((e.currentTarget as HTMLInputElement).value);
if (Number.isNaN(raw)) return;
const nextPriority = raw as TaskPriority;
```

The `Number.isNaN` guard rejects non-numeric strings, but any integer (e.g. 999)
would pass through and be dispatched as a priority. Since the `<sl-select>`
options are fully controlled by `PRIORITY_OPTIONS`, this is not a practical
attack vector, but a defensive check would be cleaner:

```ts
if (!PRIORITY_OPTIONS.includes(raw)) return;
```

### S-4. `onPriorityBlur` bound to `@sl-after-hide` instead of `@blur`

**File:** `web/src/components/kanban/ft-task-card.ts:288`

```ts
@sl-after-hide=${this.onPriorityBlur}
```

This closes the priority editor when the Shoelace dropdown overlay hides, which
is the right UX — if the user clicks away, the dropdown hides, and
`sl-after-hide` fires. Using native `@blur` would be unreliable with Shoelace's
hoisted popups because the select element may not lose focus when the popup
closes. This is well-chosen.

### S-5. The `onTaskUpdate` handler in `ft-kanban-view.ts` duplicates the `parentTaskId` logic from `MockFarmTableClient.updateTask`

**File:** `web/src/components/kanban/ft-kanban-view.ts:160-166` and
`web/src/gen/service.ts:351-357`

Both the view handler and the mock client have identical `parentTaskId`
null-handling:

```ts
const { parentTaskId, ...rest } = fields;
const updated: Task = { ...task, ...rest };
if (parentTaskId === null) {
  delete updated.parentTaskId;
} else if (parentTaskId !== undefined) {
  updated.parentTaskId = parentTaskId;
}
```

This duplication is intentional — the view builds the optimistic local version
while the client handles the server-side. However, if the merge logic ever
diverges, the optimistic state will be inconsistent with the server response.
Consider extracting a shared `applyTaskFields(task, fields)` utility.

### S-6. `onClick` still fires after editing interactions

**File:** `web/src/components/kanban/ft-task-card.ts:181-189, 335`

The card's `@click` handler dispatches `task-select`. When a user clicks the
pencil icon or the priority badge, `stopCardInteraction` prevents the
`mousedown` from propagating, but the `click` event on the outer `div` still
fires because `click` is a separate event. This means clicking the pencil icon
opens the title editor *and* selects the card (dispatching `task-select`).

**Assessment:** This is likely acceptable UX — selecting the card while starting
to edit it is reasonable. But if it causes an unwanted inspector panel open, you
may want to guard `onClick`:

```ts
private onClick() {
  if (this.isEditingTitle || this.isEditingPriority) return;
  // ... dispatch task-select
}
```

---

## What's Done Well

1. **Pattern consistency:** `onTaskUpdate` in the kanban view follows the exact
   same optimistic-update + rollback pattern as the existing `onStageChange`
   handler. Clean, predictable, easy to review.

2. **Drag/edit conflict prevention:** Both the `draggable` attribute toggle and
   the `onDragStart` early-return guard prevent dragging while editing. This is a
   common source of bugs in kanban UIs, and it's handled proactively here.

3. **Event isolation:** Consistent use of `stopCardInteraction` on `mousedown`
   and `click` for interactive elements prevents unintended card selection and
   drag initiation during editing.

4. **Keyboard handling:** Enter-to-save, Escape-to-cancel, and `stopPropagation`
   on `keydown` prevent keyboard events from leaking to parent components — a
   detail that's often missed.

5. **MockFarmTableClient fix:** The `findIndex` + array mutation fix is a genuine
   bug fix — without it, mock-mode updates were silently discarded.

6. **Accessibility:** The pencil button has an `aria-label` ("Edit title"), the
   priority button has a `title` attribute, and `focus-visible` styles are
   provided for keyboard navigation. The `<button type="button">` wrapping the
   priority badge is semantically correct.

---

## Verification Story

- **Tests reviewed:** No new tests added. This is UI interaction code in a Lit
  component — the project has a `TODO(test-coverage)` for component tests. The
  feature was verified with Playwright screenshots per the project log.
- **Build verified:** Yes — `npx tsc --noEmit` passes cleanly.
- **Lint/static analysis:** TypeScript strict mode passes. No lint configuration
  found to run separately.
- **Security checked:** Yes — no XSS vectors (Lit's template literals auto-escape
  interpolated values), no credential exposure, no unsafe innerHTML usage. The
  title input has `maxlength` limiting input size.
