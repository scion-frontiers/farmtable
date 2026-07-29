# Tree View Infinite Growth Measurements

Measured: 2026-07-20 19:19 UTC

## Method

- Browser: Playwright Chromium, headless, viewport 1440x900.
- Collection/view URL: `?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d&view=tree`.
- Metric sampled: `document.documentElement.scrollHeight` and the `.canvas-container` height inside the `ft-tree-view` shadow DOM.
- Timing: waited for `ft-tree-view` SVG render, waited 2 seconds for initial layout, then sampled at T=0s, T=5s, and T=10s.
- Before-fix page: production URL, unmodified.
- After-fix page: production URL with the branch fix applied by runtime CSS injection because the local Vite app could not load the production collection data. Local dev returned gRPC 500s and stayed on the collection-list screen. Injected CSS matched the fixed branch behavior: `.canvas-container { min-height: 0 }` and `svg { display: block }`.

Raw data: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-28-tree-view-fix/measurement-raw.json`

## Before Fix: Production, Unmodified

URL: `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d&view=tree`

| Time | Document scrollHeight | Canvas height | SVG display | Canvas min-height | SVG viewBox height |
|---:|---:|---:|---|---|---:|
| T=0s | 1696px | 1552px | `inline` | `auto` | 5160 |
| T=5s | 2896px | 2752px | `inline` | `auto` | 9160 |
| T=10s | 4096px | 3952px | `inline` | `auto` | 13160 |

Growth over 10 seconds:

- Document height: 4096px - 1696px = 2400px, or 240px/s.
- Canvas height: 3952px - 1552px = 2400px, or 240px/s.

Screenshot: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-28-tree-view-fix/tree-view-before-bug.png`

## After Fix: Runtime CSS Fix Applied

URL: same production URL, with runtime CSS injection matching commit `b4ac5ac`.

| Time | Document scrollHeight | Canvas height | SVG display | Canvas min-height | SVG viewBox height |
|---:|---:|---:|---|---|---:|
| T=0s | 1208px | 1064px | `block` | `0px` | 3546.666666666667 |
| T=5s | 1208px | 1064px | `block` | `0px` | 3546.666666666667 |
| T=10s | 1208px | 1064px | `block` | `0px` | 3546.666666666667 |

Growth over 10 seconds:

- Document height: 1208px - 1208px = 0px, or 0px/s.
- Canvas height: 1064px - 1064px = 0px, or 0px/s.

Screenshot: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-28-tree-view-fix/tree-view-post-fix.png`

## Conclusion

The unmodified production tree view grows continuously at 240px/s on both the document and shadow-DOM canvas metrics. Applying the two-line CSS fix stops the feedback loop completely in the same production page and data set: both metrics stayed unchanged for the 10-second measurement window, for a measured post-fix growth rate of 0px/s.
