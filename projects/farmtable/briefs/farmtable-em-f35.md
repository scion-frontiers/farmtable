# Brief: Engineering Manager — Feature 35: Constant Task Title Above Inspector Tabs

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer simultaneously.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`, message the
  coordinator.
- **Reviewers must be blind** — fresh `code-reviewer` agent, `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+: stop if only
  nitpicks remain. Hard cap 5 rounds.
- **Developer harness:** `scion start farmtable-f35-dev --type developer <task>` should
  normally work, but the `developer` template had a serious provisioning bug earlier today
  (workspace-trust dialog + permanent "Not logged in", root cause not fully identified,
  worked around via `--type default`). Try `--type developer` first — if it hits a trust
  dialog or "Not logged in" state, don't fight it: delete and retry once with `--type
  default` instead (same capabilities, different template wrapper), and mention in your
  report which one worked. Reviewer: `--harness claude` as always.
- **Real screenshots required** (md5sum-verified, genuine interaction) — this is a visible
  UI change.
- **The coordinator will NOT independently re-read your diff or re-open your
  screenshots** — your own verification is what stands.

## Feature Spec

The Inspector panel has a tabbed structure (General / Relationships, from Feature 25, PR
#71) with a tab chooser control. Currently the task's title lives inside the "General"
tab's content — investigate whether it's genuinely only visible on the General tab, or
already positioned above the tabs (verify before assuming there's a bug).

**The ask**: the task title should be a CONSTANT header element, always visible above the
tab chooser, regardless of which tab (General or Relationships, or any future tab) is
active — not something that disappears when switching tabs.

- Move (or confirm/leave, if it turns out this is already the case) the title so it renders
  once, above the `sl-tab-group`/tab-selector element, not inside either tab's content pane.
- Preserve all existing title-related behavior — if the title is editable (check Feature
  4/8's inline editing), that must keep working from its new constant position.
- Keep existing badges/metadata that logically belong WITH the title (check what's
  currently rendered alongside it — e.g. priority/status badges from `ft-inspector-header.ts`)
  — use judgment on what stays with the title vs. what's tab-specific content, but don't
  strip functionality, just relocate the title itself to be tab-independent.

Explicitly OUT of scope: any other Inspector layout changes, changing what's in each tab's
content.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` — fresh feature branch, PR to
  merge.
- Frontend: `web/src/components/inspector/` — `ft-inspector.ts` (tab structure, PR #71
  `gh pr diff 71`), `ft-inspector-header.ts` (likely where the title currently renders).
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-35-inspector-title-constant.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots showing: (a) title visible on General tab, (b) title still
   visible (same position) after switching to Relationships tab, (c) title editing still
   works from its new position if it's editable. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-35-inspector-title-constant/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-35-inspector-title-constant.md`.
4. A message to the coordinator with PR URL, summary, review outcome, and which developer
   template ended up working.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log/screenshots,
and message the coordinator. Then signal task_completed.
