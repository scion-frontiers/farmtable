# Review: feat/f35-inspector-title-constant

**Branch:** `feat/f35-inspector-title-constant` (1 commit: `21d4abb`)
**Files changed:** 2 (1 source, 1 design log)

---

## Executive Summary

This is a low-risk, well-scoped UI layout change that moves `<ft-inspector-header>` from inside the "General" tab panel to a constant position above the `<sl-tab-group>`. The implementation is correct and the flex layout implications are handled properly.

---

## Review Summary

**Verdict:** APPROVE

**Overview:** The change relocates the task title/header component from inside a scrollable tab panel to a fixed position above the tab navigation. This is a clean structural move with appropriate CSS additions to maintain layout integrity. No logic, data flow, or event handling was altered.

### Critical Issues

None.

### Important Issues

None.

### Suggestions

- **`ft-inspector.ts:160`** — The `<ft-inspector-header>` is now rendered outside `<sl-tab-group>` but still inside the flex column host. This is correct for the stated goal. However, if `ft-inspector-header` ever renders a very long task title (multi-line with `word-break: break-word`), the `flex-shrink: 0` rule on line 63 means it will never compress — potentially squeezing the tab content area on small viewport heights. This is the right default (the title should stay visible), but worth noting for future consideration if the inspector is ever used in very constrained vertical layouts. A `max-height` + `overflow` on the header could be a future safeguard if needed.

- **`ft-inspector.ts:61-64`** — Minor: the new CSS rule uses the bare element selector `ft-inspector-header`. This is scoped by Shadow DOM and perfectly correct for a LitElement, but if consistency with the rest of the stylesheet matters, note that some rules use class-based selectors (`.header-bar`, `.body`) while others use element selectors (`sl-tab-group`, `sl-tab-panel`). The element selector here is the right choice since there's exactly one instance and no class attribute to target.

### What's Done Well

- **Correct flex layout handling:** `flex-shrink: 0` prevents the header from collapsing when the tab group's `flex: 1` claims remaining space. This is exactly the right CSS property to add.
- **No logic duplication:** The `<ft-inspector-header>` element was moved with its exact same property bindings (`.task=${task}` and `?readOnly=${this.readOnly}`), no copy/paste divergence.
- **Clean removal from the old location:** The element and its trailing blank line were removed from inside `<sl-tab-panel>`, leaving the `<div class="body">` directly wrapping the collapsible `<sl-details>` sections. No orphaned wrappers or stale styles.
- **Design log:** The `.design/project-log/` entry is clear and concise, documenting exactly what changed and why.
- **Build verified:** `tsc --noEmit && vite build` passes cleanly (zero errors, 336 modules).

### Verification Story

- **Tests reviewed:** No inspector-specific tests exist in the project. This is pre-existing — the change does not regress any test coverage.
- **Build verified:** Yes — `npm run build` in `web/` passes (tsc + vite, zero errors).
- **Lint/static analysis clean:** Yes — TypeScript strict mode (`--noEmit`) passes.
- **Security checked:** N/A — no user input handling, network calls, or data flow changes. Pure layout restructuring.
- **Performance checked:** No impact. Same number of DOM elements rendered, same binding expressions, no new reactive properties or re-render triggers. The element simply moved position in the template.

### Diff Analysis

#### `web/src/components/inspector/ft-inspector.ts`

| Lines | Change | Assessment |
|-------|--------|------------|
| 61-64 | Added `ft-inspector-header { margin-bottom: 0.5rem; flex-shrink: 0; }` | Correct. `flex-shrink: 0` is necessary since the host is `display: flex; flex-direction: column` and `sl-tab-group` has `flex: 1`. Without `flex-shrink: 0`, the header could be compressed to zero height. `margin-bottom: 0.5rem` provides visual separation matching the `.header-bar`'s `padding-bottom: 0.5rem`. |
| 160 | Moved `<ft-inspector-header>` to after `.header-bar` div | Correct. Placed between the close-button bar and the tab group — exactly the described intent. Property bindings identical to original. |
| 167-168 | Removed `<ft-inspector-header>` from inside `<sl-tab-panel>` | Clean removal. The `<div class="body">` now starts directly with `<sl-details>` sections. |

#### `.design/project-log/2026-07-21-f35-inspector-title-constant.md`

New file. Accurate description of the change. No issues.
