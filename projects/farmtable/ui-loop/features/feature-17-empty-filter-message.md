# Feature 17: Per-Column Empty-Filter State Message

## What Was Built

- Updated `/workspace/farmtable/web/src/components/kanban/ft-kanban-column.ts`.
- Added `.empty-filter-message` styling using Shoelace neutral color tokens for subdued text.
- Added conditional rendering after the task-card list:
  - Shows `No visible tasks match this filter.` only when `isFiltered && sorted.length === 0`.
  - Does not show for genuinely empty columns because `isFiltered` requires `totalCount > 0`.
  - Does not show when visible matching cards exist.
- Added the required `NOTE(i18n)` comment next to the hardcoded English message.

## Verification Results

- Build passed: `cd /workspace/farmtable/web && npm run build`
- Commit created on branch `feat/empty-filter-message`:
  - `1f5eac9 feat: show inline message when filter hides all column tasks`
- Playwright screenshots captured using Chromium at `/usr/bin/chromium`.
- App URL used: `https://farmtable-qo7k5fvpda-uc.a.run.app`
- Fixture tasks were seeded into the in-memory store with `page.evaluate()`.
- Filter selection used real UI clicks against the Shoelace phase filter.

## Screenshots

- `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-17-empty-filter-message/filter-hidden-tasks-message.png`
  - MD5: `da7c59571b0bb5f89af4bbedc9d96e43`
- `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-17-empty-filter-message/genuinely-empty-column.png`
  - MD5: `a0d22d947000a1cffa5517e18fb80a3b`
- `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-17-empty-filter-message/column-with-visible-matches.png`
  - MD5: `b2bf699a12cb4160a018d29ada20bb59`

All three screenshot hashes are distinct.

## Issues Encountered

- The requested screenshot origin is a deployed Cloud Run URL, while the feature branch change is local. To verify the local committed change at the requested origin, Playwright fulfilled static app assets from the local `web/dist` build while keeping the page URL on the requested origin.
- Live backend data could affect deterministic screenshots, so non-static app-origin requests were blocked and only the requested in-memory fixture seeding was used.
- The initial phase-filter selector matched both the Shoelace host and internal input; the screenshot script was tightened to click the toolbar's first `sl-select`.

## Suggested Next UI/UX Feature

- Add an accessible active-filter summary inside each affected column header tooltip, including which filter caused all tasks to be hidden.

## Review Rounds

### Round 1 — APPROVE (2 suggestions, all fixed)

Reviewer: `farmtable-f17-review-r1` (code-reviewer, --harness claude)

- **Suggestion #1**: Accessibility — `role="status"` missing on empty-filter-message div inside `role="listbox"` container. **Fixed** in commit 68e0c89. Added `role="status"` to the div.
- **Suggestion #2**: Use `nothing` sentinel instead of `''` for falsy lit-html branch (idiomatic Lit pattern). **Fixed** in commit 68e0c89. Imported `nothing` from `'lit'` and replaced `''` with `nothing`.

### Round 2 — APPROVE (2 minor suggestions, no action required)

Reviewer: `farmtable-f17-review-r2` (code-reviewer, --harness claude)

- **Suggestion #1** (no action required): Theoretical race between `totalCount` and `tasks` property updates — pre-existing concern from Feature 15, not introduced by this PR. Parent view recomputes both in the same render pass.
- **Suggestion #2** (no action required): `role="status"` nested inside `role="listbox"` is technically non-conformant per ARIA spec, but screen readers handle it gracefully. Suggested moving message outside `.cards` div — a minor a11y improvement for a future pass.

Review loop exited: R2 returned only minor/suggestion findings with no action required.

## Unaddressed Findings

- R2 Suggestion #1: totalCount/tasks race — pre-existing, parent view keeps them coherent.
- R2 Suggestion #2: Move `role="status"` element outside `role="listbox"` container — valid a11y improvement, noted for future work.

## Final State

- Branch: `feat/empty-filter-message`
- Commits: 1f5eac9 (feature), 68e0c89 (R1 fixes)
- PR: https://github.com/scion-frontiers/farmtable/pull/63 — MERGED as commit 66b2b32
