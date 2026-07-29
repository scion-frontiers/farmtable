# PR Review: feat/f38-independent-scroll

**Branch:** `feat/f38-independent-scroll` (1 commit ahead of `main`)
**Commit:** `47fd58b fix(web): fix app shell flex layout so main scrolls independently`
**Reviewer:** Code Review Agent
**Date:** 2026-07-21

---

## Review Summary

**Verdict:** APPROVE

**Overview:** This is a small, well-targeted CSS fix that resolves a conflict between the external stylesheet (`theme.css`) and the Shadow DOM `:host` styles in `ft-app.ts`. The prior `display: block` in `theme.css` was overriding the `:host { display: flex }` declaration (per Shadow DOM cascade rules — outer author styles beat `:host`), which broke the flex column layout and caused the entire page to scroll instead of just the main content area. The fix is correct and uses idiomatic flexbox patterns.

---

## Executive Summary

**Risk Level: Low.** The change is a 6-line CSS-only fix across 2 files with no logic changes. The root cause (external `display: block` overriding shadow `:host { display: flex }`) is clearly identified and the fix correctly aligns the two declarations while adding standard defensive flex properties.

---

### Critical Issues

None.

### Important Issues

None.

### Suggestions

1. **`theme.css:39` / `ft-app.ts:23` — Pre-existing `height` conflict (not introduced by this PR)**

   `theme.css` sets `height: 100%` on `ft-app` while `:host` sets `height: 100vh`. Per Shadow DOM cascade rules, the outer `100%` wins. Both resolve to full viewport height on a simple page, but `100vh` on mobile includes the address bar area while `100%` doesn't. Since the outer rule wins anyway, the `:host` value for `height` is effectively dead code. Consider removing `height: 100vh` from `:host` and keeping it only in `theme.css` (or vice versa) for clarity.

   *Note: This is pre-existing, not introduced by this PR. Flagging for awareness only.*

---

## Detailed Analysis

### 1. Correctness — ✅ Correct

**Root cause analysis:** The Shadow DOM spec defines that author-origin styles from the outer document take precedence over `:host` styles in the shadow tree. On `main`, `theme.css` declared `ft-app { display: block }`, which overrode the shadow DOM's `:host { display: flex; flex-direction: column }`. This collapsed the intended flex column layout, causing `ft-toolbar`, `.content`, and siblings to stack in normal block flow — with no height constraint, the whole page scrolled as one unit.

**Fix correctness:**

| Change | Purpose | Correct? |
|--------|---------|----------|
| `theme.css`: `display: block` → `display: flex` | Aligns outer rule with `:host` so flex layout applies | ✅ |
| `:host`: `+ overflow: hidden` | Prevents the app shell itself from scrolling; scroll is delegated to `.main` | ✅ |
| `.content`: `+ min-height: 0` | Classic flex item fix — allows the content area to shrink below its intrinsic content height, enabling child overflow to kick in | ✅ |
| `.main`: `+ min-width: 0` | Prevents `.main` from being forced wider than the container by long content (since `.content` is a flex row) | ✅ |

All four changes follow the well-established CSS flexbox scrollable-container pattern: outer container clips (`overflow: hidden`), flex items allow shrinking (`min-height: 0` / `min-width: 0`), and the scroll target uses `overflow: auto`.

### 2. Side Effects — ✅ No regressions identified

- **`ft-app` references:** Only used in `index.html` (`<ft-app></ft-app>`) and `theme.css`. No other component or stylesheet targets the `ft-app` element externally.
- **Child components:** All rendered inside the shadow DOM. The host's `display` type doesn't affect their internal layouts.
- **Inspector panel:** The `.inspector` div has `overflow: hidden` which clips its own content, but the `ft-inspector` component internally manages scroll with `overflow-y: auto` on its content areas. No regression.
- **Kanban/Tree/Dashboard views:** These already use `min-height: 0` and `overflow: auto` internally (verified in `ft-kanban-view.ts` and `ft-tree-view.ts`), so they compose correctly with the new parent constraints.

### 3. CSS Cascade — ✅ Handled correctly

- `display: flex` in `theme.css` (outer) now matches `display: flex` in `:host` (inner). The outer rule wins per spec, but since they agree, no conflict.
- `overflow: hidden`, `flex-direction: column`, `font-family` are only set in `:host` and have no competing outer declarations, so they apply as intended.
- The `height` property has a pre-existing mismatch (outer `100%` vs inner `100vh`) but both resolve to full viewport height in practice. Not a new issue.

### 4. Completeness — ✅ Sufficient

The fix addresses the scroll issue at the correct level — the app shell. The prior commit (`8b15408`, feat/f36) already added the necessary `min-height: 0` / `overflow: auto` to the kanban view's internal `.board` container. This PR completes the fix by ensuring the outer layout actually constrains height via flex, which is the prerequisite for the inner overflow to work.

### 5. Code Quality — ✅ Clean and well-placed

- `overflow: hidden` on `:host` — correct placement; the outermost container should clip.
- `min-height: 0` on `.content` — placed on the flex item that needs to shrink (the row between toolbar and bottom edge).
- `min-width: 0` on `.main` — defensive but appropriate; prevents content blowout in the flex row direction of `.content`.
- All three properties are standard, well-documented flexbox patterns.

---

### What's Done Well

- **Root cause fix, not a workaround.** The real bug was the `display: block` in the external stylesheet overriding Shadow DOM's flex layout. Fixing it at the source (theme.css) rather than adding hacks (e.g., `!important`, extra wrapper divs) is the right call.
- **Defensive CSS properties.** Adding `min-height: 0` and `min-width: 0` prevents future content from breaking the scroll containment, even though only one axis is needed today.
- **Small, focused diff.** 6 lines of CSS across 2 files, no logic changes, no refactoring noise. Easy to review, easy to revert if needed.
- **Good commit message.** Clearly describes the intent: "fix app shell flex layout so main scrolls independently."

---

### Verification Story

- **Tests reviewed:** No web component tests exist in this project; CSS layout fixes are visual by nature. Manual browser verification is the appropriate validation method.
- **Build verified:** No build-breaking changes (CSS-only, no import/type changes).
- **Lint/static analysis:** N/A for CSS-only changes within a Lit `css` template literal.
- **Security checked:** No security implications — pure CSS layout change with no user input handling, no network calls, no data flow changes.

---

**Final Verdict: APPROVE** — Clean, correct CSS fix that resolves a real layout bug caused by a Shadow DOM cascade conflict. No issues found.
