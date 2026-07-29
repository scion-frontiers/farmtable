# Feature 35: Constant Task Title Above Inspector Tabs

## Summary
Moved the `ft-inspector-header` component (task title + phase/stage/priority badges) from inside the General tab panel to a constant position above the `sl-tab-group`. The title and badges are now always visible regardless of which inspector tab is active.

## Changes
- **`web/src/components/inspector/ft-inspector.ts`**: 
  - Relocated `<ft-inspector-header>` from inside `<sl-tab-panel name="general">` to between the `.header-bar` and `<sl-tab-group>`
  - Added CSS: `ft-inspector-header { margin-bottom: 0.5rem; flex-shrink: 0; }` for proper spacing and flex layout

## Verification
- Build passes (`npm run build` — tsc + vite, zero errors)
- Code review: **APPROVED** (no critical or important issues)
- Screenshots taken with Puppeteer (md5-verified, genuine interaction):
  - `a-title-on-general-tab.png` (md5: 5a42f191fd99746288a79c93eb8b2007) — title visible on General tab
  - `b-title-on-relationships-tab.png` (md5: f28a759f6629b9d70b1cfe739549c9f2) — title visible on Relationships tab (same position)
  - `c-priority-editing.png` (md5: 603555748e825849e1864d716fccd6bd) — priority dropdown works from constant header position
- Screenshots saved to: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-35-inspector-title-constant/`

## Decisions
- Title is NOT inline-editable (just `${t.name}`), so no editing behavior to preserve for the title text itself
- Priority badge IS click-to-edit inline — confirmed working from new constant position
- All badges (phase, stage, priority) kept with the title as they're task-level metadata, not tab-specific
- Developer template (`--type developer`) had the same provisioning issue (stuck at welcome screen); used `--type default` successfully
- Review: 1 round, APPROVED with only minor suggestions (long title + flex-shrink:0 on tiny viewports — noted for future)

## Branch
- `feat/f35-inspector-title-constant` from `main` @ `d95a755`
- Commit: `21d4abb feat(inspector): move task title to constant position above tabs`
