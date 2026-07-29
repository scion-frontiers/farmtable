# PR Review: Inspector Panel Scroll Fix (Feature 40)

**Branch:** `feat/f40-inspector-scroll`
**Commit:** `27265af` — fix(web): add vertical scroll to Inspector panel (v4 scroll fix)
**Files changed:** 1 (`web/src/components/inspector/ft-inspector.ts` — 6 insertions, 4 deletions)

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a well-targeted CSS-only fix that correctly propagates bounded height through Shoelace's `sl-tab-group` shadow DOM, enabling vertical scroll on the Inspector panel's tab content. The changes are minimal, correct, and aligned with both the project's Lit component patterns and Shoelace's documented `::part()` styling API.

---

## Executive Summary

This change carries **low risk** — it is a CSS-only modification confined to a single component, with no logic, data-flow, or API changes. The fix correctly applies standard flexbox height-constraint techniques (`min-height: 0`, `height: 100%`) through Shoelace's shadow DOM boundary to enable scrolling at the tab-panel level.

---

## Critical Issues

None.

## Important Issues

None.

## Suggestions

### 1. Redundant `min-height: 0` on `::part(body)` (Nitpick)
**File:** `ft-inspector.ts:52` (approx)

The `::part(body)` rule sets both `overflow: hidden` and `min-height: 0`. Per the CSS Flexible Box spec (section 4.5), when a flex item has `overflow` other than `visible`, its automatic minimum size resolves to `0` rather than `auto`. So `min-height: 0` is technically redundant given `overflow: hidden`.

**Assessment:** Keeping it is defensible — it makes the intent explicit and guards against browser inconsistencies. No change needed; noting for awareness only.

### 2. Dual `overflow-y: auto` on `sl-tab-panel` host and `::part(base)` (Nitpick)
**File:** `ft-inspector.ts:54-62` (unchanged lines)

Both `sl-tab-panel` (host) and `sl-tab-panel::part(base)` declare `overflow-y: auto`. Since Shoelace's `sl-tab-panel` renders as `<slot part="base" class="tab-panel">` inside the shadow root, the effective scroll container is `::part(base)`. The host-level `overflow-y: auto` is largely inert because the host's content is the shadow root, not the slotted light DOM directly.

**Assessment:** Not introduced by this PR (these rules predate this change). No action required.

---

## Detailed Change Analysis

### Change 1: `.body` — Remove scroll responsibility
```css
/* Before */
.body {
  flex: 1;
  overflow-y: auto;
}

/* After */
.body {
  padding-bottom: 1rem;
}
```

**Correctness:** The `.body` div (line 169) is inside `sl-tab-panel`. Previously it was the scroll container (`overflow-y: auto`). The scroll responsibility is now correctly delegated to the `sl-tab-panel::part(base)` which has `height: 100%; overflow-y: auto` (lines 58-62, unchanged). Since `.body` is slotted content inside the panel's shadow-DOM slot, it flows naturally as block content and will trigger the panel's scrollbar when it overflows. The `padding-bottom: 1rem` provides breathing room at the bottom of scrollable content — good UX.

Removing `flex: 1` is correct because `.body` is no longer a flex item — it's slotted block content inside a non-flex container (`sl-tab-panel::part(base)` has `display: block` from Shoelace defaults).

### Change 2: `sl-tab-group` — Fix height constraint propagation
```css
/* Before */
sl-tab-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* After */
sl-tab-group {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
```

**Correctness:** Removing `display: flex; flex-direction: column` from the host is correct. Shoelace's internal `.tab-group` (part=base) already declares `display: flex`, and `.tab-group--top` (the default placement) adds `flex-direction: column`. Setting these on the host was redundant and potentially confusing — the host's display governs its own box model, while the shadow root's internal flex layout is independent.

Adding `min-height: 0` is the key fix. Without it, the `sl-tab-group` element (as a flex item in `ft-inspector`'s column layout) has `min-height: auto`, which prevents it from shrinking below its content's intrinsic height — the root cause of the scroll failure.

### Change 3: New `sl-tab-group::part(base)` rule
```css
sl-tab-group::part(base) {
  height: 100%;
}
```

**Correctness:** This bridges the height constraint from the host element into the shadow DOM. The host is sized by flexbox (`flex: 1; min-height: 0`), and `height: 100%` on the internal base div ensures it fills exactly the host's bounded height. Without this, the base div would grow to its content height (defeating the scroll). Verified that `base` is indeed the documented part name — confirmed in the Shoelace source (line 343 of the tab-group component: `<div part="base" class="tab-group ...">`).

### Change 4: `min-height: 0` added to `::part(body)`
```css
sl-tab-group::part(body) {
  flex: 1;
  overflow: hidden;
  min-height: 0; /* new */
}
```

**Correctness:** Same flex-shrink fix as on the host, but applied one level deeper — inside the shadow DOM's flex column. The body slot is a flex item of the base container. Adding `min-height: 0` allows it to shrink below its content size so the bounded height reaches the tab panels. Technically redundant given `overflow: hidden` (see Suggestion 1), but defensive.

---

## Layout Chain Verification

Traced the full height propagation from app root to scrollable content:

```
ft-app :host                    → height: 100vh; overflow: hidden
  .content                      → flex: 1; min-height: 0; overflow: hidden
    .inspector                  → width: 400px; overflow: hidden; padding: 1rem
      ft-inspector :host        → display: flex; flex-direction: column; height: 100%
        .header-bar             → flex-shrink: 0
        ft-inspector-header     → flex-shrink: 0
        sl-tab-group            → flex: 1; min-height: 0; overflow: hidden     [CHANGED]
          ::part(base)          → height: 100%; display: flex; flex-direction: column (Shoelace default + NEW rule)
            nav-container       → (tab strip, fixed height)
            ::part(body)        → flex: 1; min-height: 0; overflow: hidden     [CHANGED]
              sl-tab-panel      → height: 100%; overflow-y: auto               (unchanged)
                ::part(base)    → height: 100%; overflow-y: auto               (unchanged)
                  .body         → padding-bottom: 1rem (scrollable content)    [CHANGED]
```

Every link in the chain correctly bounds or propagates height. The scroll activates at `sl-tab-panel::part(base)` when content exceeds available space.

---

## Regression Risk Assessment

| Concern | Risk | Notes |
|---------|------|-------|
| Main content scroll | None | `.main` scroll in `ft-app` is independent; not touched |
| Relationships tab | None | `sl-tab-panel[name="relationships"]` uses same `sl-tab-panel` styles (height: 100%; overflow-y: auto) — scroll works identically |
| Inspector header | None | `.header-bar` and `ft-inspector-header` are `flex-shrink: 0` — unaffected |
| Shoelace version upgrade | Low | `::part(base)` and `::part(body)` are documented public API for `sl-tab-group`. Part names are stable across minor versions (verified in ^2.15.0 source). |
| Horizontal layout | None | Changes are vertical-axis only |

---

## What's Done Well

- **Correct mental model:** The fix correctly identifies the root cause (missing `min-height: 0` on flex items prevents height collapse) and addresses it at every level of the shadow DOM boundary.
- **Minimal diff:** 6 insertions / 4 deletions — the smallest possible change to fix the problem. No unnecessary refactoring.
- **Proper Shoelace integration:** Uses `::part()` selectors (the recommended API) rather than hacks like `!important`, deep combinators, or overriding `:host` display on third-party components.
- **Removing the host-level `display: flex`** on `sl-tab-group` is a clean correction — it was overriding Shoelace's `display: block` host style and was never needed since the internal base div already has its own flex layout.
- **Scroll delegation to tab panels** rather than the `.body` wrapper is architecturally cleaner — it means both the "General" tab (which has `.body`) and the "Relationships" tab (which doesn't) scroll consistently.

---

## Verification Story

- **Tests reviewed:** N/A — CSS-only change, no testable logic
- **Build verified:** Yes — `tsc --noEmit` passes clean
- **Lint/static analysis clean:** Yes — no errors
- **Security checked:** N/A — no security surface (no inputs, no data flow, no network calls)
- **Shoelace source verified:** Confirmed `part="base"` and `part="body"` exist in `sl-tab-group` render template (Shoelace ^2.15.0 source). Confirmed `.tab-group` default styles include `display: flex` and `.tab-group--top` includes `flex-direction: column`.
