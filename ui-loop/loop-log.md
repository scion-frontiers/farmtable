# Farmtable UI Improvement Loop — Log

Owned by: top-level coordinator (primary loop). One EM spawned per feature.

## Process (agreed with ptone@google.com, 2026-07-19)

- Coordinator spawns one `eng-manager` agent per feature (`--harness claude`).
- EM spawns a `developer` agent (no --harness flag, project default = codex)
  to implement exactly one UI/UX feature, kept alive across fix iterations.
- Developer uses the web/screenshot skill to visually verify their work —
  real screenshots required as evidence (Simulation Trap applies).
- EM then spawns a fresh, blind `code-reviewer` agent (`--harness claude`)
  per round — no prior review feedback shared with it.
- Exit criteria: Round 1 findings (including nitpicks) must ALL be fixed.
  From round 2 onward, if a fresh review returns ONLY nitpick/minor findings
  (nothing significant/blocking), stop — ship as-is. If it finds anything
  significant, fix and do another round. Cap: 5 review rounds max.
- Only one agent (dev OR reviewer) runs at a time within a feature cycle.
- EM does NOT merge. When ready, EM pushes the developer's branch, opens a
  PR via gh, and reports to the coordinator with PR link + summary + final
  review outcome + developer's optional next-feature suggestion.
- Coordinator verifies deliverables (real PR, real screenshots, sane review
  history) then runs `gh pr merge --squash` to origin/main itself.
- Coordinator decides/kicks off the next feature and repeats.
- Quota watch: if an agent stalls, coordinator uses `scion look` to inspect.
  If it shows codex quota/limit exhaustion, HALT all production (stop
  spawning new agents) and notify the user — do not just auto-retry.

## Features

| # | Feature | EM agent | Status | PR | Merge commit |
|---|---------|----------|--------|----|----|
| 1 | Add Task UI (create-item affordance on dashboard) | farmtable-em-f1 | merged | [#47](https://github.com/scion-frontiers/farmtable/pull/47) | 97867f2 |
| 2 | Per-column inline create controls | farmtable-em-f2 | merged | [#48](https://github.com/scion-frontiers/farmtable/pull/48) | 7f7f913 |
| 3 | Inline task editing from Kanban card (title + priority) | farmtable-em-f3 | merged | [#49](https://github.com/scion-frontiers/farmtable/pull/49) | 9df3ed1 |
| 4 | Task detail/inspector panel — description + date inline editing | farmtable-em-f4 | merged | [#50](https://github.com/scion-frontiers/farmtable/pull/50) | b099714 |
| 5 | Inspector label editing (tag chips, add/remove) | farmtable-em-f5 | merged | [#51](https://github.com/scion-frontiers/farmtable/pull/51) | b129924 |
| 6 | Inline assignee editing in inspector (ListUsers picker) | farmtable-em-f6 | merged | [#52](https://github.com/scion-frontiers/farmtable/pull/52) | 8347b22 |
| 7 | Inline priority editing in inspector (parity w/ card editing) | farmtable-em-f7 | merged | [#53](https://github.com/scion-frontiers/farmtable/pull/53) | b045c69 |
| 8 | Inspector editor reliability pass (state reset on task switch, consistent dismiss) | farmtable-em-f8 | merged | [#54](https://github.com/scion-frontiers/farmtable/pull/54) | 51a833c |
| 9 | Keyboard-first inspector navigation (Tab order, focus styling, scoped Escape) | farmtable-em-f9 | merged | [#55](https://github.com/scion-frontiers/farmtable/pull/55) | 64225d1 |
| 10 | Kanban card keyboard navigation (roving focus, ARIA, focus ring) | farmtable-em-f10 | merged | [#56](https://github.com/scion-frontiers/farmtable/pull/56) | a2fcd2a |
| 11 | Keyboard shortcut overlay (discoverability, closes a11y arc) | farmtable-em-f11 | merged | [#57](https://github.com/scion-frontiers/farmtable/pull/57) | 1795a5a |
| 12 | Wire toolbar Phase/Assignee filters to real board data | farmtable-em-f12 | merged | [#58](https://github.com/scion-frontiers/farmtable/pull/58) | 543f221 |
| 13 | Active-filter chips with one-click removal + clear-all | farmtable-em-f13 | merged | [#59](https://github.com/scion-frontiers/farmtable/pull/59) | 4a24415 |
| 14 | Filtered task count badge (N of M tasks) | farmtable-em-f14 | merged | [#60](https://github.com/scion-frontiers/farmtable/pull/60) | 055e2b0 |
| 15 | Per-column filtered count summaries ("N of M") | farmtable-em-f15 | merged | [#61](https://github.com/scion-frontiers/farmtable/pull/61) | d06d787 (1 review round only - broker infra failure on R2 after 4 retries, R1 was thorough/clean) |
| 16 | Filter-active visual state + tooltip on column count chip | farmtable-em-f16 | merged | [#62](https://github.com/scion-frontiers/farmtable/pull/62) | 835b7eb |
| 17 | Per-column empty-filter-state message | farmtable-em-f17 | merged | [#63](https://github.com/scion-frontiers/farmtable/pull/63) | 66b2b32 |

## Loop paused 2026-07-19 13:11 per ptone@google.com direction

17 features dispatched, 17 merged, 0 abandoned. Pivoting to Cloud Run deployment for review. Next-feature suggestion queued for whenever the loop resumes: accessible active-filter summary in column header tooltip naming which filter hid the tasks (from Feature 17's developer).

## Loop resumed 2026-07-19 14:58 per ptone@google.com direction

New chained 3-feature sequence (explicit user request, supersedes the queued suggestion above for now — that suggestion stays queued for after this sequence). Sequential dependency: 19 needs 18's URL/state mechanism, 20 needs 19's picker. Redeploy after all 3 merge.

| # | Feature | EM agent | Status | PR | Merge commit |
|---|---------|----------|--------|----|----|
| 18 | URL-driven collection routing (landing list when no collection in URL, ?collection=<uuid> on select, direct-nav loads that collection) | farmtable-em-f18 | merged | [#64](https://github.com/scion-frontiers/farmtable/pull/64) | 948aef7 |
| 19 | Collection picker, top-left | farmtable-em-f19 | merged | [#65](https://github.com/scion-frontiers/farmtable/pull/65) | 18657ee |
| 20 | New-collection button + modal next to picker, switches to new collection on create | farmtable-em-f20 | merged | [#66](https://github.com/scion-frontiers/farmtable/pull/66) | f50c584 |

All 3 chained features (18/19/20) merged. Redeploy done 2026-07-19 (rev farmtable-00007-w87, 100% traffic, independently verified). Queued suggestion (collection settings/edit modal) picked up as Feature 21 per ptone@google.com "let's do it" 2026-07-19 19:44.

## Deliberate collision test 2026-07-19 21:19 per ptone@google.com direction

| # | Feature | EM agent | Status | PR | Merge commit |
|---|---------|----------|--------|----|----|
| 24 | Inspector date-field 2x2 grid (start/due date one row, created/updated one row), single-file diff on ft-inspector-meta.ts | farmtable-em-f24 | merged | [#70](https://github.com/scion-frontiers/farmtable/pull/70) | b3826bd |
| 25 | Inspector tabs - General (existing content) + Relationships (parent/children/blocked-by/blocking); relationship display/nav mostly pre-existing (ft-inspector-relations.ts), pure frontend | farmtable-em-f25 | merged | [#71](https://github.com/scion-frontiers/farmtable/pull/71) | 55437f3 |

Both dispatched in parallel, own worktrees, SAME Inspector component area - user explicitly anticipated a merge collision. Feature 24 opened its PR first and merged clean. Feature 25 rebased onto 24's merge (touched a different file, ft-inspector.ts + new files vs. 24's ft-inspector-meta.ts) - NO actual conflict occurred, clean rebase. First-pass Feature 25 report skipped required screenshots ("no Playwright session in worktree") - coordinator caught this and sent it back before merging; re-report included 3 real md5sum-verified screenshots confirming both features render correctly together (24's date grid visible inside 25's General tab).

## Loop continues 2026-07-19 19:44 per ptone@google.com direction

| # | Feature | EM agent | Status | PR | Merge commit |
|---|---------|----------|--------|----|----|
| 21 | Collection settings/edit modal (name+description edit, platform read-only; UpdateCollection RPC did not exist, added minimally) | farmtable-em-f21 | merged | [#67](https://github.com/scion-frontiers/farmtable/pull/67) | 8aa79a4 |
| 22 | Reachable URLs for Kanban/Tree views (?view=kanban\|tree, extends Feature 18's routing) - own worktree (/workspace/farmtable-f22-view-urls), ran IN PARALLEL with 23, worktree worked cleanly | farmtable-em-f22 | merged | [#69](https://github.com/scion-frontiers/farmtable/pull/69) | a3f3a5a |
| 23 | Add comment from Inspector - first production use of git-worktree pattern (sibling worktree /workspace/farmtable-f23-comments). Pure frontend wiring (AddComment RPC + read-only display already existed). Ran in parallel with 21 then 22; worktree experience smooth both times; survived a reviewer container crash (r2 exit 255) via normal EM retry. 3 review rounds. | farmtable-em-f23 | merged | [#68](https://github.com/scion-frontiers/farmtable/pull/68) | fcc1e72 |

### Feature 18 handoff mechanism (for Features 19/20)
Per farmtable-em-f18's merge report:
- URL param: `?collection=<uuid>`
- Route state: `FtApp.routeView = 'landing' | 'validating' | 'board'`
- Read current: `new URLSearchParams(window.location.search).get('collection')`
- Write/navigate: `pushState` with `url.searchParams.set('collection', id)` + `applyRoute()`
- Unscoped client: `createGrpcFarmTableClientWithOptions({ collectionId: null })` for list/validation
- Scoped client: `createGrpcFarmTableClientWithOptions({ collectionId })` for board streaming
- Back/forward: `popstate` listener calls `applyRoute()`
- Review: R1 approve after fixing 2 important + 3 suggestions (7fee9ce); R2 approve, minor/nitpick only, shipped as-is.

### Feature 19 notes
- Incident: PR #65 initially showed mergeStateStatus DIRTY/CONFLICTING (branch had Feature 18's pre-squash commits colliding with the squashed commit on main). EM rebased onto origin/main (948aef7), keeping only the 2 Feature 19 commits; came back CLEAN/MERGEABLE. Merged as 18657ee.
- Feature 20 handoff: `.collection-controls` wrapper div (`display: flex; gap: 0.5rem`) is the first child in the toolbar; `<ft-collection-picker>` lives inside it. Feature 20's new-collection button goes in as a sibling of the picker inside that same wrapper — no layout refactor needed.
- Review: R1 approve after fixing 7 findings (d6690af); R2 approve, 3 nitpicks only, shipped as-is.

### Feature 20 notes
- Built: ⊕ button next to picker opens modal (name-only, intentionally minimal), calls CreateCollection RPC, navigates into the new collection via existing pushState+applyRoute() routing on success. Follows ft-add-task-dialog pattern. Errors surfaced via sl-alert.
- Review: R1 approve, 4 nitpick/minor findings all fixed (d622196); R2 approve, 2 nitpicks only, shipped as-is.
- PR confirmed CLEAN/MERGEABLE before reporting ready (learned from Feature 19's conflict incident) — no merge issues this round.

(Note: Features 21-28 and the export/import, GitHub-platform, and tree-view-fix workstreams
are tracked in `/workspace/projects.md` rather than duplicated here in full detail going
forward — this file continues as the append-only feature ledger for quick PR/commit lookup.)

## Watcher-comparison batch, 2026-07-20 23:47 per ptone@google.com direction

Items from `reports/watcher-frontend-comparison.md`, in the user's requested order
(10, 9, 1, 2, 8, 4), dispatched ~2 at a time in worktrees:

| # | Feature (watcher item) | EM agent | Status | PR |
|---|---|---|---|---|
| 29 | Icon-based view mode switcher (#10) | farmtable-em-f29 | merged | [#79](https://github.com/scion-frontiers/farmtable/pull/79) (477d0ab) |
| 30 | Reusable empty state component (#9) | farmtable-em-f30 | merged | [#80](https://github.com/scion-frontiers/farmtable/pull/80) (3db1688) |
| 31 | Command palette / global search (#1) | farmtable-em-f31 | merged | [#82](https://github.com/scion-frontiers/farmtable/pull/82) (462c76d) |
| 32 | Dashboard/summary view, minimal (#2) - integrated dashboard icon into Feature 29's switcher | farmtable-em-f32 | merged | [#81](https://github.com/scion-frontiers/farmtable/pull/81) (59ee2ca) |
| 33 | Collapsible inspector sections (#8) | farmtable-em-f33 | dispatched, pair 3 | - |
| 34 | Ready queue view (#4) - pure frontend as investigated (relationship data globally available), also fixed a real backend bug (relationship-type inversion in taskToProto, benefits Feature 25's Relationships tab too) | farmtable-em-f34 | merged | [#83](https://github.com/scion-frontiers/farmtable/pull/83) (90b0031) |
