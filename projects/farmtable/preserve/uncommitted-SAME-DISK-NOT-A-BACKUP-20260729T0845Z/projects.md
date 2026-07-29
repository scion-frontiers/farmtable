# Projects — Coordinator Tracking

Human-readable tracker of projects, features, and tasks managed by this coordinator.
(Session-continuity/handoff notes live separately in `.coordinator-state.md`; this file
is the higher-level project/feature ledger.)

---

## Project: Farmtable

Repo: `scion-frontiers/farmtable` (`/workspace/farmtable`). Methodology:
`/scion-volumes/scratchpad/projects/farmtable/HANDOFF-METHODOLOGY.md`. Full feature-by-feature
detail/PR links: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/loop-log.md`.

### UI-Improvement Loop — Features

| # | Feature | Status | PR |
|---|---------|--------|----|
| 1-17 | Initial UI loop (add/edit tasks, inspector, keyboard nav, shortcut overlay, toolbar filters/chips/counts) | merged | [#47-#63](https://github.com/scion-frontiers/farmtable/pulls?q=is%3Apr+47..63) |
| 18 | URL-driven collection routing | merged | [#64](https://github.com/scion-frontiers/farmtable/pull/64) |
| 19 | Collection picker (top-left) | merged | [#65](https://github.com/scion-frontiers/farmtable/pull/65) |
| 20 | New-collection button + modal | merged | [#66](https://github.com/scion-frontiers/farmtable/pull/66) |
| 21 | Collection settings/edit modal (name+description edit; `UpdateCollection` RPC didn't exist, added minimally) | merged | [#67](https://github.com/scion-frontiers/farmtable/pull/67) |
| 22 | Reachable URLs for Kanban/Tree views (`?view=kanban\|tree`) | merged | [#69](https://github.com/scion-frontiers/farmtable/pull/69) |
| 23 | Add comment from Inspector (pure frontend wiring, `AddComment` RPC already existed) | merged | [#68](https://github.com/scion-frontiers/farmtable/pull/68) |

| 24 | Inspector date-field 2x2 grid (start/due + created/updated) | merged | [#70](https://github.com/scion-frontiers/farmtable/pull/70) |
| 25 | Inspector tabs: General + Relationships (parent/children/blocked-by/blocking) | merged | [#71](https://github.com/scion-frontiers/farmtable/pull/71) |
| Export/Import A | Backend RPCs + CLI for full collection export/import | merged | [#72](https://github.com/scion-frontiers/farmtable/pull/72) |
| Export/Import B | Web UI for export/import | merged | [#74](https://github.com/scion-frontiers/farmtable/pull/74) |
### External Store Passthrough implementation (2026-07-21, `farmtable-em-extstore`)
Wave 1 (8 tasks): ALL 8 MERGED - PR #85 (A1 LinkedAccount schema, 36ae463), #86 (A6
MultiStore, 72cf854), #87 (A3 remote_data, 5161499), #88 (B1+B5 passthrough, 5fde8f7), #89
(B2 taskToProto, ef1e497), #90 (C1 EphemeralStorePool, 0a8b27e), #93 (A2 proto+A4 store
methods combined, faa6982 - #92 closed as redundant superset). Wave 3 (C2
collectionSupportsGraph) also merged: PR #91, 06249be.
**MAJOR INFRA INCIDENT (2026-07-21 02:47-03:16):** the `developer` scion template broke
completely (workspace-trust dialog + permanent "Not logged in" on every dispatch). Root
cause not fully identified (ruled out: EM's harness-config edit, Hub timeout alone, missing
--harness-auth). WORKAROUND: `--type default` works perfectly and is now the standing
substitute for `developer` dispatches on this project - see `.coordinator-state.md`
Standing Directives. `code-reviewer` template confirmed unaffected. A5 (PR #95, 5cb2a63) and A8 (PR #94, 0f36c6d) merged. B3 (PR #96, e608750) merged - main branch build fixed. A7 (PR #97, 224fc98) and B4 (PR #98,
f193846) merged. **ALL 21/21 TASKS MERGED - PROJECT COMPLETE.** Final PR #104 (B7 read-only mode) merged
d95a755 after a real round-1 review caught 2 bugs (unguarded write paths) + 1 UX issue, all
fixed and re-approved round 2. Full PR list: #85-#104 (20 PRs, some tasks combined).
Friction log finalized at `reports/passthrough-dogfood-friction-log.md` with honest
delegated-mode gap noted (sole-interactor used throughout this session, not fabricated).
Not yet deployed to Cloud Run - next step if desired.
**Process note:** Hub API hit intermittent `context deadline exceeded` timeouts causing
~13 ghost agent registrations across two incidents tonight (all recovered by delete+retry).
During the worst of it, the EM did all 6 Wave-1 code reviews in-process (Agent tool) instead
of via fresh scion reviewer agents, since reviewer provisioning failed too - accepted as a
ONE-TIME exception (produced a real finding on PR #85, not a rubber stamp) but EM instructed
to prefer real fresh reviewer agents going forward.

### GitHub issues review (2026-07-19)
Top 10 ranked candidates for next work: `reports/github-issues-top10.md`. Top picks: #41
(kanban column clipping bug, XS), #28 (remove `ft task delete`, XS), #42 (`ft task search`,
S/M), #30 (shell completions, S), #31 (`ft task batch`, M). Notable finding: an INFRA
dependency chain (#45→#12→#13→#21→#22→#29) is blocked on a GitHub App permissions gap
requiring human action — same underlying class of issue as our own `ptone/scion` issue-filing
token-scope blocker below.

### Export/Import Phase A: MERGED (PR #72, commit b8929bf)
5 new proto messages, 2 new RPCs (ExportCollection/ImportCollection), transactional import
w/ full UUID remapping + topological task ordering + cycle detection, user email matching,
CLI (`ft collection export/import`), 64MB gRPC limits, 9 test cases. 3 review rounds
(caught a critical orphaned-users-in-tx bug in R1). Phase B (web UI) now dispatched
(`farmtable-em-exportb`).

### External store architecture brainstorm (2026-07-20)
farmtable-architect-external-store (XL model) produced
`reports/design-external-store-brainstorm.md` (5 architecture options for representing
external task stores without full sync; recommends lightweight full task-row sync + lazy
comment loading). Messaged ptone@google.com directly to open discussion, staying available
for follow-up per brief - agent NOT deleted, this is an ongoing conversation.
~~STANDING RULE: never delete this agent~~ — rescinded 2026-07-20 13:03, agent deleted
after confirming work complete.
Follow-up: drafted a formal phased design doc (now `design-external-store-passthrough.md`,
3 implementation phases) and sent it to ptone@google.com for review directly. Iterated with
user, then decomposed the design into a 24-task DAG (3 phase parents + 21 leaf tasks,
BLOCKS/BLOCKED_BY sequencing, 7 parallel waves) created LIVE on the hosted server -
collection "External Store Passthrough" (`5d1e4eea-3dc7-4958-99ac-01e3372c5a0d`), dashboard
link: https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=5d1e4eea-3dc7-4958-99ac-01e3372c5a0d.
Report `reports/design-passthrough-task-breakdown.md` corrected and verified complete: all
24 tasks fully listed with IDs/priority/labels/scope/blocked-by, 8 ready + 13 blocked
verified against `ft task ready`/`ft task blocked`. Reported to user.
Blind-trial follow-up (2026-07-20 12:59): `farmtable-blind-taskify` (default model)
independently produced a comparable 23-task DAG (collection `ext-store-passthrough-design`,
id `11f2f0ec-6cf2-4a1e-86f8-333d08d031d5`) with the same phase structure and comparably
precise per-task BLOCKED_BY dependencies - report:
`reports/design-passthrough-task-breakdown-trial2.md`. Both live collections left on the
server for the user to compare directly. Agent deleted, task complete.

### Export/Import live verification (2026-07-20)
Redeployed (rev `farmtable-00009-826`, 100% traffic, independently verified) and tested a
full round-trip against the LIVE service both ways: CLI (export default -> import as new
collection, 4/4 tasks matched, fields spot-checked) PASS; Web UI (toolbar download -> import
dialog -> new collection with visible tasks) PASS. No protected collections touched. Report:
`deploy/2026-07-20-deploy-4.md`.

### GitHub-backed collection experiment (2026-07-19)
Verdict: PARTIALLY WORKING. CLI local passthrough mode (`FARMTABLE_GITHUB_REPO`) fully
works - correctly mapped all 45 real GitHub issues from scion-frontiers/farmtable into
Farmtable tasks (state/labels/type/parent-child intact). The deployed Cloud Run SERVER's
`CreateCollection` RPC hardcodes `platform: farmtable` — no server-side way to create a
github-platform collection today, so the passthrough integration isn't reachable through
the hosted service, only the local CLI. Left one empty test collection on the live service
(`6a0a49f9-9c61-46cf-af5a-46f98f90ff20`, `github-experiment-scion-frontiers-farmtable`) -
safe to clean up or leave. Report: `reports/github-backed-collection-experiment.md`.

### Watcher vs Farmtable frontend comparison (2026-07-20)
10 adoptable patterns ranked (top 3: command palette/global search, dashboard/summary view,
drag-and-drop Kanban cards - all pure UI, low effort), 5 considered-and-rejected. Open
question: does TaskStore expose relationship/blocked-by data globally or only per-task
(affects feasibility of Ready Queue/Blocked view/Dependency Graph patterns). Report:
`reports/watcher-frontend-comparison.md`.

### Local dev database (2026-07-19)
Confirmed present and usable: `web-test/farmtable.db` (SQLite, 7 tables/tasks), ported over
with the scratchpad extraction. Report: `reports/local-testdb-check.md`.

| 26 | Server support for collection platform types (stop hardcoding `platform: farmtable` on create) + external source link in header | merged | [#73](https://github.com/scion-frontiers/farmtable/pull/73) |
| 27 | CLI integration/user test scripts (task lifecycle, collection lifecycle, export/import round-trip) in `test/integration/`, verified with a real passing transcript against the live service | merged | [#75](https://github.com/scion-frontiers/farmtable/pull/75) |
| 28 | URGENT fix: tree view infinite growth bug (inline SVG + ResizeObserver feedback loop, ~240px/s) - 2-line CSS fix, verified 240px/s -> 0px/s | merged | [#78](https://github.com/scion-frontiers/farmtable/pull/78) |

### Watcher-comparison batch (2026-07-20 23:47, per ptone@google.com)
Items from the Watcher comparison, in requested order (10,9,1,2,8,4), ~2 at a time in worktrees:

| # | Feature (watcher item) | Status | PR |
|---|---|---|---|
| 29 | Icon-based view mode switcher (#10) | merged | [#79](https://github.com/scion-frontiers/farmtable/pull/79) |
| 30 | Reusable empty state component (#9) | merged | [#80](https://github.com/scion-frontiers/farmtable/pull/80) |
| 31 | Command palette / global search (#1) | merged | [#82](https://github.com/scion-frontiers/farmtable/pull/82) |
| 32 | Dashboard/summary view, minimal (#2) | merged | [#81](https://github.com/scion-frontiers/farmtable/pull/81) |
| 33 | Collapsible inspector sections (#8) | merged | [#84](https://github.com/scion-frontiers/farmtable/pull/84) |
| 34 | Ready queue view (#4) - pure frontend, plus fixed a real relationship-type inversion bug in taskToProto (also benefits Feature 25's Relationships tab) | merged | [#83](https://github.com/scion-frontiers/farmtable/pull/83) |

Note: Hub API hit repeated `context deadline exceeded` timeouts around 19:53-20:00 when
first trying to dispatch a different EM (external-store passthrough) - resolved itself by
23:47 when this batch was dispatched cleanly. If dispatch failures recur, check Hub health
before assuming a command/brief problem.

### Post-passthrough small features + bugfix (2026-07-21)

| # | Feature | Status | PR |
|---|---------|--------|----|
| Bugfix | Passthrough collection stuck on spinner — root cause: `isUnimplementedError()` string-matched the error message instead of checking the numeric `grpc.Code`; introduced a `GrpcError` class carrying the code. Also wired `github.NewPlatformResolver()` into `main.go` (defined in PR #96, never wired). Shepherded investigator → architect → EM per ptone@google.com's request. | merged | [#107](https://github.com/scion-frontiers/farmtable/pull/107) |
| 35 | Constant task title above inspector tabs | merged | [#105](https://github.com/scion-frontiers/farmtable/pull/105) |
| 36 | Independent vertical scroll for main content (first pass — fixed Kanban board's internal overflow only) | merged | [#106](https://github.com/scion-frontiers/farmtable/pull/106) |
| 37 | Scroll/frame-to-item on navigation, dim overlay if task not in view | merged | [#108](https://github.com/scion-frontiers/farmtable/pull/108) |
| 38 | Truly independent main-content scroll — refinement of #36; real root cause was `theme.css`'s `ft-app { display: block }` overriding Shadow DOM's `:host { display: flex }` | merged | [#109](https://github.com/scion-frontiers/farmtable/pull/109), commit `50b51ba` |

Ad-hoc: `ft collection link` run for collection `466c2baa` using the environment's GitHub PAT
— LinkedAccount created (id `e6b593ac-da9a-4e78-b9bc-93f9ea36787f`), 47 real GitHub issues
now loading. Report: `reports/link-github-account-466c2baa.md`.

### Deploy-9 (2026-07-21 21:38): rev `farmtable-00015-65p`, commit `798efc5` (main HEAD - F35,
F36, spinner fix, F37, F38, decomposer app), 100% traffic. Playwright-verified live: F38
scroll fix PASS (toolbar/inspector pixel-identical across scroll positions), F35 PASS
(title constant above tabs), F37 PASS (auto-scroll-to-item + dim overlay). Log:
`deploy/2026-07-21-deploy-9.md`, screenshots: `deploy/2026-07-21-deploy-9/` (7 images).

| 39 | Independent main + inspector scroll (v3) - user feedback on F38 said it left per-kanban-column scrollbars (from F36) instead of one scroll region for all of `main`. Removed per-column `overflow`/`min-height` CSS in `ft-kanban-view.ts`/`ft-kanban-column.ts` so `.main` is the single vertical scroll container; inspector scroll confirmed independent. Verified with live-data Playwright (23 tasks, scrollHeight 1896 > clientHeight 735). | merged | [#111](https://github.com/scion-frontiers/farmtable/pull/111), commit `8dfd5b8` |

### Deploy-10 (2026-07-21 22:39): rev `farmtable-00016-m5w`, commit `8dfd5b8` (Feature 39),
100% traffic. Playwright-verified live, all 5 checks PASS: `.main` is the single scroll
container, no per-column scrollbars (8 columns, 16-card Ready column included), toolbar
fixed during scroll, Inspector scrolls independently, horizontal scroll intact. Log:
`deploy/2026-07-21-deploy-10.md`, screenshots: `deploy/2026-07-21-deploy-10/`.

| 40 | Inspector panel vertical scroll (v4) - after F39 fixed `main`'s scroll, user found the Inspector panel had no scroll at all. CSS-only fix in `ft-inspector.ts` (flex height chain through Shoelace's `sl-tab-group` shadow DOM: `min-height:0` on flex items, `height:100%` on `::part(base)`, scroll delegated to `sl-tab-panel::part(base)`). First feature verified with the new local-first protocol (~3 min build-to-screenshots). | merged | [#112](https://github.com/scion-frontiers/farmtable/pull/112), commit `8ac4bc0` |

### Deploy-11 (2026-07-22 00:20): rev `farmtable-00017-wnn`, commit `8ac4bc0` (Feature 40),
100% traffic. Playwright-verified live, all 5 checks PASS: Inspector scrolls independently
(scrollH 1247 > clientH 545, previously-hidden Comments/Change History reachable), scroll
independence confirmed both directions (wheel events don't propagate), F39 main-scroll and
F38 fixed-toolbar both non-regressed. Log: `deploy/2026-07-22-deploy-11.md`, screenshots:
`deploy/2026-07-22-deploy-11/`.

| 41 | Animated tree-canvas centering (750ms ease-in-out) - builds on Feature 37's frame-to-node logic. `requestAnimationFrame` interpolation of SVG viewBox pan; cancel-and-restart semantics for rapid reselection; manual pan/wheel-zoom cancel in-flight animation; initial `centerGraph()` layout stays instant. Verified with 10-frame progressive screenshot sequences (2 separate animations). | merged | [#113](https://github.com/scion-frontiers/farmtable/pull/113), commit `146b3be` |

### Deploy-12 (2026-07-22 01:14): rev `farmtable-00018-jmx`, commit `146b3be` (Feature 41),
100% traffic. Playwright-verified live: animation confirmed via 7 unique viewBox values
across the progressive screenshot sequence (both pan directions), centering accuracy exact
(0.0, 0.0 offset). Log: `deploy/2026-07-22-deploy-12.md`, screenshots:
`deploy/2026-07-22-deploy-12/`.

| Bugfix | URGENT: Kanban drag-and-drop dead zones - PR #111 (F39) had dropped `flex:1` from `.cards` in `ft-kanban-column.ts`, shrinking the drop target to card-content-only size (up to 95% dead zone in taller/emptier columns). A scripted mouse-drag investigation initially missed it (precision-hit on card content); a follow-up investigation using real HTML5 DnD events found and confirmed the root cause. 1-line fix, restored `flex:1`, verified no regression to F39's single-scroll-region behavior. | merged | [#114](https://github.com/scion-frontiers/farmtable/pull/114), commit `6cddeb4` |

### Deploy-13 (2026-07-22 02:12, URGENT): rev `farmtable-00019-w8z`, commit `6cddeb4`
(Feature 42 DnD fix), 100% traffic. Playwright-verified live with real HTML5 DnD
(`locator.dragTo()`): all 8 columns now 0px dead zone (was up to 1795px/95%), successfully
dropped a card into what was previously 100% dead space, no scroll regression. Log:
`deploy/2026-07-22-deploy-13.md`, screenshots: `deploy/2026-07-22-deploy-13/`.

### GitHub Passthrough Write-Through (design → architect discussion → EM implementation, in progress)
- Phase 1 (Core Write-Through MVP): merged [#116](https://github.com/scion-frontiers/farmtable/pull/116), commit `2ac0945`. Unlocks writes for `remote_data.writable=true` GitHub collections, optimistic updates with dirty-task guard, merge-based poll refresh (15s), "↔ GitHub" toolbar badge, assignee reverse-lookup bug fix. Verified with a REAL round trip against a live test repo (`scion-frontiers/scion-roadmap`): created/updated/commented on an actual GitHub issue via `ft` CLI, confirmed via `gh api` - first verification attempt was rejected for lacking this and redone properly.
- Phase 2 (Capability-Based UI Gating): merged [#118](https://github.com/scion-frontiers/farmtable/pull/118), commit `2095838`. New `capabilities.ts` with per-operation `CollectionCapabilities` flags replacing the binary read-only prop; GitHub collections show unmappable operations (dates, acceptance criteria, blocks/blocked-by, code context, delete, drag-reorder) as disabled with tooltips, mapped operations (title/description/stage/priority/assignee/comments/create/close/reparent) stay enabled; Farmtable collections fully unaffected (ALL_ENABLED). First verification attempt had zero screenshots for an entirely visual feature - rejected and redone with 5 real, distinct screenshots.
- Phase 3 (Polish + Error Handling): merged [#119](https://github.com/scion-frontiers/farmtable/pull/119), commit `aa0feb2`. Write-error toasts (gRPC error → user-friendly message: permission denied, rate limit, generic fallback), `write-error` CustomEvent plumbed from kanban/tree view catch blocks, task-type label mapping (`TypeToLabel`/`TypeLabelSwap` in `labels.go`), generic AddLabels/RemoveLabels in passthrough UpdateTask, 8 new Go tests. Deviations: rate-limit wait time not shown (headers not plumbed through gRPC yet), dynamic sweep interval deferred. **All 3 phases of GitHub Passthrough Write-Through now complete and deployed** - deploy-18 (rev `farmtable-00024-prb`) verified all 4 toast variants live plus a real 401 propagation path. Deploy log: `deploy/2026-07-22-deploy-18.md`.
- Extends the read-only GitHub passthrough (PRs #85-104) to support writes flowing to
  GitHub and reflecting back via the read-through proxy. Design by
  `farmtable-architect-passthrough-write`, approved by ptone@google.com. 3 phases: (1) MVP
  writable collections + optimistic updates + assignee bug fix, (2) capability-based UI
  gating, (3) error handling + rate-limit awareness + missing field mappings.
- Design doc: `design-passthrough-write.md` (525 lines). Findings:
  `passthrough-write-current-state.md` (361 lines).
- Status: dispatched to `farmtable-em-passthrough-write` (2026-07-22 11:08) to own the full
  3-phase implementation lifecycle, reporting after each phase merges for deploy.

| 43 | Tree view shows parent-child hierarchy only - removed BLOCKS/BLOCKED_BY dashed-line rendering from `ft-tree-view.ts`, leaving only solid parent→child lines. Feature 41's animated centering preserved. Evidence redone with real BLOCKS test data after initial round used seed data with no such relationships (didn't actually prove the fix visually). | merged | [#115](https://github.com/scion-frontiers/farmtable/pull/115), commit `b2a8123` |

### Deploy-14 (2026-07-22 11:55): rev `farmtable-00020-flp`, commit `b2a8123` (Feature 43),
100% traffic. Playwright-verified live: 5 hierarchy edges / 0 dependency edges in tree SVG,
a real BLOCKS relationship confirmed present in data via Inspector but correctly not
rendered as a tree edge, Feature 41 centering animation still works. Log:
`deploy/2026-07-22-deploy-14.md`, screenshots: `deploy/2026-07-22-deploy-14/`.

| 44 | New "Dependency Tree" view - left-to-right layered DAG showing only BLOCKS/BLOCKED_BY relationships. Longest-path layering (layer N = max(blocker layers)+1), layer 0 reuses Ready Queue's "unblocked" definition, closed tasks excluded from all layers, cycle-safe (depth-capped at 50). View-switcher icon reuses the Tree view's icon rotated 90°CW. First screenshot round had two required test scenarios (multi-layer chain, fan-in multi-blocker) submitted as byte-identical images - caught via MD5 check and redone with genuinely distinct data. | merged | [#117](https://github.com/scion-frontiers/farmtable/pull/117), commit `2f15c92` |

### Deploy-15 (2026-07-22 12:27): rev `farmtable-00021-hth`, commit `2ac0945` (Passthrough
Write-Through Phase 1), 100% traffic. Playwright + `gh api` verified live against test repo
`scion-frontiers/scion-roadmap`: title edit, description edit, and comment add all
confirmed landing on the actual GitHub issue; "↔ GitHub" badge correct; Feature 43 (5
hierarchy/0 dependency edges) non-regressed. Log: `deploy/2026-07-22-deploy-15.md`,
screenshots: `deploy/2026-07-22-deploy-15/`.

### Deploy-16 (2026-07-22 12:50): rev `farmtable-00022-z2d`, commit `2f15c92` (Feature 44),
100% traffic. Playwright-verified live: 4-layer left-to-right DAG layout with dashed blue
dependency edges, rotated diagram-3 icon in view switcher, Feature 43 (5 hierarchy/0
dependency edges) non-regressed, Phase 1 write-through infra intact. Log:
`deploy/2026-07-22-deploy-16.md`, screenshots: `deploy/2026-07-22-deploy-16/`.

### Deploy-17 (2026-07-22 13:09): rev `farmtable-00023-q6j`, commit `2095838` (Phase 2
capability gating), 100% traffic. Playwright-verified live on a GitHub test collection:
date fields disabled with tooltips, title/description/comments still editable, Farmtable
collection unaffected (0 disabled fields), Feature 44 non-regressed. Log:
`deploy/2026-07-22-deploy-17.md`, screenshots: `deploy/2026-07-22-deploy-17/`.

| 47 | Fix Ready Queue badge alignment - `.priority-cell` CSS wrapper with `min-width: 6.5rem` around priority badges in `ft-ready-queue-view.ts` so task titles align consistently regardless of badge text width ("Urgent" vs "No priority" etc). | merged | [#121](https://github.com/scion-frontiers/farmtable/pull/121), commit `cb19a2f` |

### Deploy-19 (2026-07-22 13:49): rev `farmtable-00025-nkn`, commit `cb19a2f` (Feature 47),
100% traffic. Playwright-verified live: `.priority-cell` min-width fix confirmed - all
titles align at identical left position (446px) regardless of badge width (60-80px range),
tested on two collections. Log: `deploy/2026-07-22-deploy-19.md`, screenshots:
`deploy/2026-07-22-deploy-19/`.

| 45 | Import Beads JSONL format with auto-detection - `beads_import.go` parser/converter/format-detector alongside the existing native JSON export/import (Phase A/B). Import dialog updated to state supported formats. Verified with a real import of the actual scratchpad sample file (`issues.jsonl`, 537 issues -> 537 tasks, 29 relationships, 1 comment, 15 users). First evidence round had two required screenshots (import dialog vs resulting kanban) submitted as byte-identical - caught via MD5 check and redone with genuinely distinct captures. | merged | [#122](https://github.com/scion-frontiers/farmtable/pull/122), commit `2c973dc` |

| 46 | Relationships tab delete + quick-add - trash-can icon per relationship (optimistic delete, no confirm dialog), "+" button on BLOCKS/BLOCKED_BY section headings opens the existing command palette (Feature 31) in a new add-relationship mode with type pills, pre-selection from section context, and self-exclusion - extends the palette rather than duplicating it, per instruction. Only BLOCKS/BLOCKED_BY addable (proto limitation); all relationship types deletable. 20 Playwright screenshots, core functional evidence (add/delete before-after) all uniquely verified. | merged | [#123](https://github.com/scion-frontiers/farmtable/pull/123), commit `7a2e742` |

### Deploy-20 (2026-07-22 14:04): rev `farmtable-00026-746`, commit `2c973dc` (Feature 45),
100% traffic. Playwright-verified live: import dialog states both formats, auto-detection
correctly identifies .jsonl as Beads (~537 issue preview), import into a new test
collection succeeded (105 tasks created with sensible titles/priorities/types), Feature 47
non-regressed. Log: `deploy/2026-07-22-deploy-20.md`, screenshots:
`deploy/2026-07-22-deploy-20/`.

### Deploy-21 (2026-07-22 14:21): rev `farmtable-00027-6hc`, commit `7a2e742` (Feature 46),
100% traffic. Playwright-verified live: add flow (command palette type pills, search,
select) and delete flow (trash-can icon) both confirmed working, Feature 45 non-regressed.
Log: `deploy/2026-07-22-deploy-21.md`, screenshots: `deploy/2026-07-22-deploy-21/`.

| 48 | Drag-and-drop relationship building in the Dependency view - dropping one task node onto another creates a BLOCKED_BY relationship (dragged task blocked by drop target), reusing Feature 46's `applyTaskUpdate(addBlockedBy)` rather than new backend logic. Self-drop and duplicate-relationship are no-ops; cycle creation detected and rejected with a toast. Visual feedback: drop-target highlight, source-node dim during drag. Verified with real HTML5 DnD events per the Feature 42 dead-zone bug lesson, not mouse-move simulation. | merged | [#124](https://github.com/scion-frontiers/farmtable/pull/124), commit `b8ee51f` |

### Deploy-22 (2026-07-22 15:28): rev `farmtable-00028-gf6`, commit `b8ee51f` (Feature 48),
100% traffic. Playwright-verified live with real HTML5 DnD events: relationship created via
drag, self-drop no-op, cycle detection toast blocks the relationship, persists after
reload. Feature 46 non-regressed. Log: `deploy/2026-07-22-deploy-22.md`, screenshots:
`deploy/2026-07-22-deploy-22/`.

| 49 | Fix missing reciprocal relationship immediate sync - Feature 46's optimistic update only updated the source task's local store and only published a server event for the source task, so the reciprocal relationship on the target task didn't appear until a reload/poll. Fixed both the client-side optimistic cache (`ft-app.ts`) and server-side event fanout (`server.go`) to update/notify target tasks too. First evidence round skipped the actual no-reload verification (build/tests passing isn't proof) - sent back and redone with real Playwright evidence for both BLOCKS and BLOCKED_BY directions. | merged | [#126](https://github.com/scion-frontiers/farmtable/pull/126), commit `6814944` |

| 50 | Scrollable collection-list landing page + New Project button - `.landing` scroll container (`flex:1; overflow:auto; min-height:0`) wraps the collection list, `min-height:100vh` removed from `ft-collection-list.ts`, New Project button integrated with the existing `ft-new-collection-dialog` from Feature 20. Verified with 16 collections overflowing the viewport and a real wheel-scroll trace (scrollTop 0->500->651). | merged | [#127](https://github.com/scion-frontiers/farmtable/pull/127), commit `277ae61` |

### Deploy-23 (2026-07-22 16:30): rev `farmtable-00029-w2d`, commit `6814944` (Feature 49),
100% traffic. Playwright-verified live: added a BLOCKS relationship via command palette,
confirmed the reciprocal "Blocked by" appeared immediately with no reload, both store state
and DOM rendering checked. Log: `deploy/2026-07-22-deploy-23.md`, screenshots:
`deploy/2026-07-22-deploy-23/`.

### Deploy-24 (2026-07-22 16:43): rev `farmtable-00030-9zg`, commit `277ae61` (Feature 50),
100% traffic. Playwright-verified live: landing page scrolls (scrollHeight 1292 > clientHeight
900), New Project button opens the create dialog, creating a project navigates to its
board. Log: `deploy/2026-07-22-deploy-24.md`, screenshots: `deploy/2026-07-22-deploy-24/`.

| 51 | Dependency view layout fixes - (1) replaced dagre with a manual layout using `computeLayers()` so all unblocked tasks render in the same leftmost column (dagre was ignoring per-node rank constraints), (2) edges now emit from source's right edge and attach to target's left edge via cubic bezier curves instead of top/bottom anchors, preventing lines from routing under task boxes. First evidence round had only one after-only screenshot for two required before/after comparisons - sent back, redone with the original user report reproduced plus clean before/after pairs. | merged | [#128](https://github.com/scion-frontiers/farmtable/pull/128), commit `71dfe88` |

### Deploy-25 (2026-07-22 18:22): rev `farmtable-00031-vfh`, commit `71dfe88` (Feature 51),
100% traffic. Playwright-verified live: unblocked tasks confirmed aligned to the same
leftmost column (X=40) across two test scenarios, edges anchor right-center to left-center
via bezier curves with no under-box routing, Feature 48 drag-and-drop preserved. Log:
`deploy/2026-07-22-deploy-25.md`, screenshots: `deploy/2026-07-22-deploy-25/`.

| 52 | Fix command palette search - scoped to title+labels only (removed description/type/stage/assignees/ID from search), added per-label fuzzy scoring (labels weren't searched at all before), fixed a latent score-filter bug (`filter(s >= 0)` silently dropped valid negative-scored word-boundary-bonus matches; changed sentinel to `Infinity` with `Number.isFinite`). 6 screenshots covering partial-title match, description/ID exclusion, case-insensitivity, fuzzy matching, and label search. | merged | [#130](https://github.com/scion-frontiers/farmtable/pull/130), commit `0596714` |

| 53 | Remove redundant "Relations" section from Inspector General tab - deleted `ft-inspector-relations.ts` (the old read-only component) and its wiring; the dedicated Relationships tab (Features 25/46/48/49) is the sole place relationships are shown/managed. EM hit infra trouble (dev OOM'd, reviewer stuck on trust prompt) and substituted an inline review instead of an independent one - coordinator dispatched a separate standalone blind reviewer before merging, which came back APPROVE with no findings. | merged | [#129](https://github.com/scion-frontiers/farmtable/pull/129), commit `40f8d82` |

### Deploy-26 (2026-07-22 19:14): rev `farmtable-00032-ksz`, commit `0596714` (Feature 52),
100% traffic. Playwright-verified live: partial title match, description-only exclusion,
case-insensitivity, fuzzy match, and label search all confirmed. Log:
`deploy/2026-07-22-deploy-26.md`, screenshots: `deploy/2026-07-22-deploy-26/`.

### Deploy-27 (2026-07-22 19:25): rev `farmtable-00033-sbg`, commit `40f8d82` (Feature 53),
100% traffic. Playwright-verified live: General tab confirmed clean of the Relations
section (only Properties/Description/Comments), Relationships tab fully functional with
all 6 types and working add-relationship dialogs. Log: `deploy/2026-07-22-deploy-27.md`,
screenshots: `deploy/2026-07-22-deploy-27/`.

| 54 | Minimap with draggable viewport frame for tree views - new shared `ft-minimap.ts` component (180x180px scaled overview) used by both the Tree view and Dependency view via properties (nodes/edges/pan/scale/container size, optional custom edge-path fn). Draggable frame indicator, click-to-jump, wheel-forwarding for zoom. 2 rounds of 8-angle high-effort blind review (13 findings total, all real ones fixed). | merged | [#131](https://github.com/scion-frontiers/farmtable/pull/131), commit `5ca9037` |

### Deploy-28 (2026-07-22 20:01): rev `farmtable-00034-svn`, commit `5ca9037` (Feature 54),
100% traffic. Playwright-verified live: minimap (180x180px, 29 nodes, viewport frame)
present on both Tree and Dependency views, drag-to-pan confirmed on both. Log:
`deploy/2026-07-22-deploy-28.md`, screenshots: `deploy/2026-07-22-deploy-28/`.

| 55 | Fix poll-sync flicker - suppressed the Refresh button's loading spinner on background poll ticks (was toggling `isRefreshing` on every 15s cycle; now only on manual clicks), added a JSON-equality check to `TaskStore.upsert()` to skip `tasks-changed` events when poll data is unchanged, plus a pre-existing bug fix (spinner not clearing on failed manual refresh). First evidence round submitted 4 byte-identical screenshots including the one meant to prove manual refresh still shows a spinner - sent back; redone using gRPC request interception to catch the transient spinner state, proving background polls show no spinner while manual refresh does. | merged | [#132](https://github.com/scion-frontiers/farmtable/pull/132), commit `f1a86dc` |

### Deploy-29 (2026-07-22 20:45): rev `farmtable-00035-rg4`, commit `f1a86dc` (Feature 55),
100% traffic. Playwright-verified live (gRPC-Web interception with artificial delay to
catch transient state): background poll shows no spinner (identical screenshots), manual
refresh shows it (unique screenshot). Log: `deploy/2026-07-22-deploy-29.md`, screenshots:
`deploy/2026-07-22-deploy-29/`.

| 56 | Zoom-to-target-size on selection + more prominent highlight - selecting a node in either tree view now animates zoom+pan together (750ms) so the node occupies ~20% of viewport width (`targetScale = 0.20*viewportWidth/NODE_WIDTH`, clamped [0.3, 3.0], focal-point centering recomputed per frame). Selected-node highlight: 3px border (was 2px) + two-layer box-shadow halo (3px gap + 6px indigo ring), priority accent border preserved. Measured 19.6% vs 20% target on both views. | merged | [#133](https://github.com/scion-frontiers/farmtable/pull/133), commit `696cacc` |

| 57 | GitHub issue #76 fix: `ft task bottlenecks` returns null for graphs built with `--blocked-by` edges - `GetBottlenecks` seeding loop only checked source-side `blocks` edges, missing tasks that block via incoming `blocked_by` edges; fixed to mirror `countDownstream`'s dual-direction traversal with dedup, plus a regression test using `--blocked-by`. Validated by a dedicated investigator first (confirmed reporter's root cause and fix were both accurate). | merged | [#134](https://github.com/scion-frontiers/farmtable/pull/134), commit `f33d68a`, closes [#76](https://github.com/scion-frontiers/farmtable/issues/76) |

### Deploy-30 (2026-07-22 21:36): rev `farmtable-00036-4lm`, commit `696cacc` (Feature 56),
100% traffic. Playwright-verified live: Tree view 19.6%, Dependency view 20.0% of
viewport/container width (target ~20%), highlight halo confirmed on both. Log:
`deploy/2026-07-22-deploy-30.md`, screenshots: `deploy/2026-07-22-deploy-30/`.

| 58 | Fix combined pan+zoom animation regression (PR #133 broke Feature 41's smooth animated pan) - PR #133 removed the `startPanX/startPanY` capture in `animatePanZoomTo()`, deriving pan from node position each frame instead, causing an instant jump on frame 0. Restored viewport-center interpolation: captures start position, interpolates center+scale together over 750ms ease-in-out, on both tree views. Evidence: 7-frame sequences at 150ms intervals for both views with a JSON data trace of panX/panY/scale values, proving genuine progressive interpolation (not just endpoints, which is exactly how this regression slipped through the first time). | merged | [#135](https://github.com/scion-frontiers/farmtable/pull/135), commit `b500753` |

### Deploy-31 (2026-07-23 00:27): rev `farmtable-00037-7cv`, commit `b500753` (Feature 58),
100% traffic. Playwright-verified live: 47 rAF frames + 16 screenshots across both tree
views confirming smooth combined pan+zoom, Feature 56 non-regressed (19.6% zoom target,
highlight halo intact). Log: `deploy/2026-07-23-deploy-31.md`, screenshots:
`deploy/2026-07-23-deploy-31/`.

### Deploy-32 (2026-07-23 00:43): rev `farmtable-00038-gmg`, commit `7d64230` (Feature 59),
100% traffic. Explicit live validation against the DEPLOYED revision (per ptone@google.com's
request, not just the pre-merge test build) - 4 tests: IAP-only pass-through (PASS), IAP +
x-farmtable-token authenticated (PASS, 16 real collections returned), old
Authorization-only approach correctly BLOCKED by IAP, x-farmtable-token-only (no
Authorization) correctly BLOCKED by IAP (confirms IAP's own OIDC layer is still required
in addition to the app-level header). Log: `deploy/2026-07-23-deploy-32.md`, evidence:
`deploy/2026-07-23-deploy-32/`.

### Auth Improvements Task DAG (2026-07-23) - dogfooded on the live instance
- New collection "Auth Improvements" (id `9a16e171-59e6-4179-a79d-708b8e2adade`) on the live
  service, populated with the full 6-stage plan from `design-auth-improvements.md`: 52
  tasks total (7 stage-epics + 45 subtasks). Stage 0 (the already-shipped x-farmtable-token
  fix, PR #136) represented as a completed stage for a full historical record. Critical
  path: Stage 1 -> Stage 3 -> Stage 4 -> Stage 6; Stages 2/3 and 5/6 are parallelizable.
- Friction note: the `ft` CLI doesn't natively support dual-header IAP auth (IAP OIDC in
  `Authorization` + app token in `x-farmtable-token`) yet - the EM built a temp wrapper to
  get this done. This friction itself validates Stage 5 (OAuth/IAP proxy auth) of the plan.
  Queued as a CLI improvement candidate.
- Log: `auth-task-breakdown-log.md`.

### Auth Improvements Plan Implementation (farmtable-em-auth-implementation, in progress)
- Stage 1 (Mandatory Auth Enforcement): auth interceptor now rejects unauthenticated
  requests by default when token auth is configured (GetVersion/GetStatus exempt,
  `FARMTABLE_OPEN_ACCESS=1` opt-out for local dev). Commits `4f6378f`, `f7f6a46`.
- Stage 2 (Web Dashboard Auth): server-side session endpoints
  (POST/GET/DELETE `/api/auth/session`) with encrypted cookies, session-to-bearer
  middleware, login dialog UI, logout button, `?token=` URL param removed. Commit
  `befeffd` (merge).
- Stage 3 (Identity-Aware Operations): `RequireIdentity()` enforces non-nil user ID on all
  12 mutating RPCs + WatchTasks; read-only RPCs unaffected; `LegacyTokenAuth` deprecated;
  change records now reliably capture the authenticated actor. Commits `3074952`,
  `bd9be40`.
- Stage 4 (Scoped Tokens & Basic RBAC, critical path): scope vocabulary (task:read/write/
  claim, collection:read/write/admin, token:manage, user:read, `*` wildcard),
  `RequireScope()`/`RequireCollectionAccess()` helpers, scope/collection fields on
  `ApiToken` schema, all 28+ RPC handlers now enforce scope+collection access, `ft token
  create --scope/--collection` flags, default scopes by user type, 608 lines of RBAC
  tests. 4 review rounds (round 4 hit the recurring code-reviewer "Not logged in"
  provisioning bug, recovered with `--type default`). Non-blocking follow-up noted: graph
  traversal helpers can follow relationship edges across collections. Commit `5b05b01`.
- Stage 5 (OAuth/SSO & IAP Proxy Auth): AuthMode config (token|oauth|proxy), Google OAuth
  login flow with PKCE (S256), IAPAuthenticator (JWT verification via JWKS), user
  provisioning with domain allowlist. +2,131 lines/12 files. Review found 2 HIGH (race
  condition, open redirect) + 2 MEDIUM, all fixed. 50 tests pass.
- Stage 6 (External Credential Improvements): AES-256-GCM encrypted credential storage,
  GitHub App/Jira/Linear OAuth link flows, background token refresh, credential status
  monitoring. +2,952 lines/22 files. Review found 2 HIGH (thread safety, encryption not
  wired into read/write path) + 3 MEDIUM, all fixed.
- Both merged to `main` (commit `36235c3`, one cross-stage conflict resolved - duplicate
  `generateState()`). All tasks marked completed on the live collection.
- **Not yet deployed - and NOT YET WIRED into server startup** (`unified.go`); code
  compiles and tests pass in isolation but isn't active yet. Coordinator asked the EM to
  handle wiring as its own reviewed change before deploy, rather than folding it into a
  deploy step.
- All merged directly by the EM (self-merge authority for this workstream), each stage
  blind-reviewed separately.
- **Stage 4 deployed and fully validated** - deploy-35, rev `farmtable-00041-jh7`, 100%
  traffic. All checks PASS: backward compat for pre-existing tokens, scoped tokens
  correctly restricted to their granted scope/collection (write blocked without
  `task:write`, cross-collection access blocked), admin wildcard token unrestricted, web
  dashboard session auth unaffected, dual-header IAP+ft CLI pattern still works. Log:
  `deploy/2026-07-23-deploy-35.md`, evidence: `deploy/2026-07-23-deploy-35/`.
- **Deployed and fully validated** - deploy-34, rev `farmtable-00040-c8p`, commit
  `befeffd`, 100% traffic. All 5 explicit access-path checks PASS: (a) dual-header IAP+ft
  auth works for read+mutate, (b) unauthenticated mutating calls now correctly REJECTED
  (Stage 1 enforcement confirmed active), (c) GetVersion/GetStatus remain exempt, (d) full
  web dashboard session auth lifecycle (login/cookie/session-to-bearer/logout/post-logout
  401) all work, no `?token=` param needed, (e) existing tokens still resolve correctly for
  backward compat. Log: `deploy/2026-07-23-deploy-34.md`, evidence:
  `deploy/2026-07-23-deploy-34/`.

### Decomposer IAP Support (2026-07-23)
- `--iap-audience` flag added to the decomposer binary to auto-mint OIDC identity tokens
  via `gcloud` for IAP auth, plus dual-header (`Authorization` + `x-farmtable-token`) auth
  context in the writer. Live-tested end-to-end against the IAP-protected instance: 77-task
  decomposition succeeded on a real collection ("Vintage Action Figures Ecommerce").
  Blind review APPROVED, no blocking issues (non-blocking suggestions: unit tests for the
  IAP branch, timeout on the gcloud exec call). Merged
  [#138](https://github.com/scion-frontiers/farmtable/pull/138), commit `f44fa79`.
- Follow-up fix: the terminal-criteria issue (LLM judged most tasks terminal at depth 1
  despite max-depth 7) - root cause was the prompt asking the LLM to pre-judge subtask
  terminality inline, conflicting with the intended per-task self-assessment design. Fixed
  by removing "terminal" from the subtask JSON template and adding an explicit
  don't-pre-judge rule, plus a missing stats-counter fix. Merged
  [#139](https://github.com/scion-frontiers/farmtable/pull/139), commit `c6519ab`. Also
  noted: no `DeleteCollection` RPC exists, so the old test collection can't be cleaned up -
  written up as a product-gap follow-up (`followup-delete-collection-rpc.md`).
- **Verification run found an over-correction**: pre-fix 77 tasks (89.6% terminal at depth
  1); post-fix 1995+ tasks, 0% terminal through depth 3, growth ~8-9x per depth level.
  Extrapolated to `max-depth 7`, the full tree could reach tens of thousands of tasks -
  real cost/UX concern (LLM calls + Farmtable storage/UI usability). Growth rate is
  slowing per-depth, suggesting the LLM starts terminating deeper down, but this needs
  prompt tuning (terminal criteria too loose now) or a task-count cap. New collection:
  "Vintage Action Figures Ecommerce v3" (`bd0b8364-32a0-4962-873b-fb2d292a2a94`). Report:
  `reports/decomposer-rerun-verification.md`.

### IAP Auth Fix (design by farmtable-architect-auth → EM implementation)
- Cloud Run's IAP consumes the `Authorization: Bearer` header, colliding with Farmtable's
  own app-level `ft_...` token which used the same header - blocking `ft`/decomposer access
  to the IAP-protected live instance entirely. Design: `design-iap-token-header.md`.
- Fix: `x-farmtable-token` gRPC metadata fallback header - server's new `extractToken()`
  checks it first, falls back to `Authorization`; CLI/decomposer/web dashboard all send the
  token via both headers now. Verified against the LIVE IAP-protected instance (not just
  locally) - confirmed the header passes through IAP untouched.
- Status: merged [#136](https://github.com/scion-frontiers/farmtable/pull/136), commit
  `7d64230`. Not yet deployed.

| 60 | Fix dependency view redraw/re-zoom on poll ticks - (1) sorted the relationships array in `structureKey()` before joining so non-deterministic API ordering doesn't produce a false key change, (2) guarded `snapshotComplete()` with an actual-change check (`upsert()` now returns a boolean) so no-op poll cycles don't force a re-render, bypassing Feature 55's equality check. First evidence round was broken (same cached screenshot saved 5x across unrelated claims, including "after a real change" matching "initial load") - caught, sent back, and redone with a quantitative verification log (snapshotFired=true, anyChanged=true, yet viewport numerically identical before/after) that independently confirmed the fix. | merged | [#137](https://github.com/scion-frontiers/farmtable/pull/137), commit `c957f7e` |

### Deploy-33 (2026-07-23 01:50): rev `farmtable-00039-8xw`, commit `c957f7e` (Feature 60),
100% traffic. Quantitative viewport evidence: zero drift across 8 samples over 40s on both
Dependency and Tree views. Log: `deploy/2026-07-23-deploy-33.md`, evidence:
`deploy/2026-07-23-deploy-33/`.

### Decomposer Extras App (design → architect discussion → EM implementation)
- Standalone Go binary (`cmd/decomposer/`, `internal/decomposer/`) that recursively
  decomposes a Farmtable task into a subtask DAG using an LLM (Google GenAI via ADC as
  primary provider, Anthropic as Phase 3 secondary), encoding groups as BLOCKED_BY
  relationships. 14 files, ~2071 lines, 22 unit tests (14 parser + 8 engine). Verified with
  a real live run against collection `decomposer-test-1784662856` (real DAG created via the
  live GenAI provider + ADC, not mocked) - transcript at
  `reports/decomposer-live-run-transcript.txt` (456 lines).
- Design doc: `design-decomposer-extras.md`. LLM system prompt: ptone@google.com's original
  prompt (`/scion-volumes/scratchpad/decomposer.md`) was adapted by
  `farmtable-architect-decomposer` into `decomposer-system-prompt.md` (JSON template
  matching our schema) and is correctly embedded in the shipped code at
  `internal/decomposer/prompt_default.txt` (verified 2026-07-21). Earlier "placeholder"
  labeling in docs was misleading, not accurate - the real adapted prompt was in fact
  shipped. Corrected 2026-07-21 after ptone@google.com flagged the confusion.
- Status: **merged** [#110](https://github.com/scion-frontiers/farmtable/pull/110), squash
  commit `798efc5`. `farmtable-em-decomposer` instructed to clean up its dev/reviewer
  agents; `farmtable-architect-decomposer` remains alive as the standing discussion agent
  for decomposer follow-ups (per user's original request to have it contact them directly).
- Not yet included in a Cloud Run deploy (last deploy `farmtable-00014-jfd` predates this
  and Feature 38).

### Queued next-feature suggestions (not yet dispatched)
- URL routing for phase filters or task deep-linking (from Feature 22's dev)
- Component-level browser/unit tests for inspector comment interactions (from Feature 23's dev)
- Add `Cache-Control: no-cache` on HTML responses (`internal/serverapp/unified.go` bare
  `http.FileServer`) and `max-age=immutable` on content-hashed assets - the missing headers
  caused a false "Feature 46 isn't live" report from stale browser cache (2026-07-22
  investigation, `reports/f46-missing-investigation.md`). XS fix, not yet dispatched.

### Ad-hoc: reference material
- 2026-07-22: Shallow clone (depth 1) of `GoogleCloudPlatform/scion` at
  `/scion-volumes/scratchpad/scion-reference` (49MB), per ptone@google.com request.

### Deployments
- 2026-07-21 deploy-8: rev `farmtable-00014-jfd` (commit 6aeed20, includes PR #107
  passthrough spinner fix). LinkedAccount created for collection `466c2baa` via `ft
  collection link github` (id `e6b593ac-da9a-4e78-b9bc-93f9ea36787f`) - verified 47 real
  GitHub issues now loading. Two CLI/infra friction points found: `ft collection link`'s
  local `--token` flag shadows the global one (needed `FARMTABLE_TOKEN`/
  `FARMTABLE_LINK_TOKEN` env vars instead), and MultiStore cached a bad PassThroughStore
  from an initial wrong-token attempt requiring a second deploy to clear (matches a
  non-blocking B3-review observation about missing negative-caching). Report:
  `reports/link-github-account-466c2baa.md`.
- 2026-07-21 deploy-7: rev `farmtable-00012-5dc` (External Store Passthrough, PRs #85-104,
  commit d95a755), 100% traffic, independently verified (gcloud + curl). Smoke tests pass:
  `ft task list` returned 72 tasks, `ft collection link/unlink/links` CLI subcommands live.
  Log: `deploy/2026-07-21-deploy-7.md`.
- 2026-07-21 deploy-6: rev `farmtable-00011-vh5` (Watcher-comparison batch, PRs #79-84),
  100% traffic, independently verified (gcloud + curl). Playwright confirmed icon view
  switcher (4 modes), command palette (Ctrl+K), dashboard view, ready queue view all live.
  Log: `deploy/2026-07-21-deploy-6.md`.
- 2026-07-20 deploy-5 (URGENT): rev `farmtable-00010-qdh` (tree view fix, commit 6a7cafe),
  100% traffic, independently verified (gcloud + curl). Live Playwright check confirmed
  0px/s growth (was 240px/s) on the actual deployed revision. Hit an interactive
  model-deprecation prompt mid-run (dismissed with --raw ENTER) and a Hub-auth notification
  glitch at the end (nudged with continue) - both recovered cleanly. Log: `deploy/2026-07-20-deploy-5.md`.
- 2026-07-20 deploy-3: rev `farmtable-00008-btl` (incl. Feature 26), 100% traffic,
  independently verified (gcloud + curl). GitHub mirror attempt: confirmed empty-as-expected
  - created a real github-platform collection via CreateCollection RPC on the live service
  (id 466c2baa-334e-439c-b9f9-abbe89eb8aae, remote_id scion-frontiers/farmtable), task list
  came back 0 - no sync/refresh RPC is wired server-side, no error either (clean no-op, not
  a bug). Log: `deploy/2026-07-20-deploy-3.md`.
- 2026-07-19 deploy-1: rev `farmtable-00006-rx9` (features 1-17). Log: `deploy/2026-07-19-deploy-1.md`
- 2026-07-19 deploy-2: rev `farmtable-00007-w87` (features 18-20), 100% traffic, independently verified. Log: `deploy/2026-07-19-deploy-2.md`
- Next deploy: after Feature 21 (and 22, TBD whether batched or per-feature — decide when 21 ships)

### Ad-hoc Investigations (data model / UI Q&A, relayed from ptone@google.com)
- Collection construct + Cloud Run UI scoping — answered 2026-07-19. Report: `reports/investigation-collection-model.md`
- Comments: linked record vs. embedded — answered 2026-07-19 (linked record, Task 1:many Comment, Comment many:1 User author). Report: `reports/investigation-comments-model.md`

### Side Experiments
- Git worktree parallelization feasibility — completed 2026-07-19, verdict: viable, recommend adopting for future parallel dev batches. Report: `reports/worktree-experiment.md`
- Feature request to `ptone/scion` (adjacent/sibling worktrees for repos one level below `/workspace`) — drafted and ready, **BLOCKED on filing**: both the agent's and coordinator's GitHub tokens get "Resource not accessible by personal access token (createIssue)" on `ptone/scion` despite admin/push repo permissions (looks like missing `Issues: write` PAT scope). Escalated to ptone@google.com 2026-07-19 20:14 - needs either manual filing or a token scope grant. Draft body: `reports/scion-worktree-feature-request.md`.

### Scheduled Jobs
- `farmtable-ui-loop-heartbeat` (id `1cd83dbe-df76-4625-9abf-0722a46868ab`): 30-min sweep of the active loop for stalls/quota issues. Active while features are in flight; paused when idle.

---

## Notes
- This file is coordinator-maintained; update at every milestone (feature dispatched/merged,
  investigation answered, deploy done, schedule paused/resumed).
- Task-level detail (in-flight work, blockers) is also tracked live in the coordinator task
  list (TaskList/TaskCreate/TaskUpdate tool) — this file is the persistent, human-readable
  mirror of that for anyone reading the repo/workspace directly.
