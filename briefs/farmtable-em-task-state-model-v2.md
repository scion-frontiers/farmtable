# Brief: EM (Re-assigned) — Task State Model Implementation, Phase 2 Continuation

## Critical Constraints (read first)
- This is a RE-ASSIGNMENT. The prior EM (`farmtable-em-task-state-model`) hit a hard
  codex-account quota exhaustion mid-synthesis and had to be replaced. Nothing about the
  underlying work is different — you're picking up exactly where it left off. Phase 1 is
  already merged, deployed, and live in production (do not touch it, do not redeploy it).
- Dedicated git worktree per workstream (`git worktree add /workspace/farmtable-<slug> -b
  <branch> origin/main`), never a direct checkout in the shared `/workspace/farmtable`.
- Existing worktree for Phase 2 already exists on disk at
  `/workspace/farmtable-task-state-web-ui` on branch `task-state-web-ui` (commit
  `2f912bbee2f4cfc2f40f2650164a56c69a697fb9`) — use it, don't recreate from scratch. Verify
  its state with `git status`/`git log` before continuing.
- Same review rigor as the rest of this workstream: every phase needs a genuine
  INDEPENDENT review (code review + security audit + test review, all three, every round)
  before merge. Do not self-review. This bar has caught real issues in every single round
  so far across Phase 1 and now Phase 2 — do not relax it.
- **Read every review report yourself before deciding anything is done.** The coordinator
  made a mistake earlier in this exact phase: only relayed the code-review findings and
  missed the parallel security-audit and test-review findings (which included a HIGH
  severity XSS vulnerability). Do not repeat that mistake — always read all parallel
  report files, not just whichever one messages first.

## Key Locations
- Authoritative design contract: `/scion-volumes/scratchpad/projects/farmtable/design-task-state-model-contract.md`
- Codebase: `/workspace/farmtable` (main checkout); Phase 2 worktree at
  `/workspace/farmtable-task-state-web-ui`
- Existing review reports for the CURRENT unresolved round (read all three in full):
  - `/scion-volumes/scratchpad/projects/farmtable/reports/review-task-state-web-ui.md`
  - `/scion-volumes/scratchpad/projects/farmtable/reports/audit-task-state-web-ui.md`
  - `/scion-volumes/scratchpad/projects/farmtable/reports/test-task-state-web-ui.md`
- Prior phase deploy log (Phase 1, already live, for context):
  `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-27-task-state-phase1-live.md`

## Current State — Phase 2 (web UI) has ONE completed review round, ZERO fixes applied yet
An initial Phase 2 implementation was built and reviewed once. All three reviewers came
back REQUEST CHANGES / CHANGES REQUESTED. None of these findings have been fixed:

### Must fix (blocking, in priority order)
1. **HIGH severity XSS** (`web/src/components/inspector/ft-inspector-meta.ts:607`):
   `task.remoteUrl` is inserted directly into an anchor `href` with `target="_blank"` and
   no URL-scheme validation. A `javascript:` URL in that field executes script in the app
   origin on click. Fix: validate the URL scheme (allow only `https:`, optionally `http:`
   on localhost for dev) before rendering any link; render nothing for invalid values. Full
   suggested code is in the audit report.
2. **Native stage/phase controls are still reachable in the UI** — a genuine Phase 2
   CONTRACT VIOLATION, not just a coverage gap (`web/src/components/ft-toolbar.ts:345-359`,
   `web/src/components/kanban/ft-kanban-column.ts:177-213`,
   `web/src/components/kanban/ft-kanban-view.ts:133-149`). The toolbar still renders a
   native-stage `sl-select`, and kanban drag/drop still emits `{stage, phase}` updates
   through `client.updateTask()`. The whole point of Phase 2 is that native phase/stage
   controls must NOT be reachable from the UI. Remove or replace these paths per the
   contract (native stage transitions should happen through the approved API/CLI/MCP
   surfaces only, not ad hoc UI mutation).
3. **Kanban board missing 3 terminal-stage columns** (`web/src/components/kanban/ft-kanban-view.ts:29`):
   only defines columns through `Completed`; `WONT_FIX`, `DUPLICATE`, `CANCELLED` are
   filterable via the toolbar but unreachable in the board itself. Add all 4 terminal
   columns per the code review's suggested `BOARD_COLUMNS` array, and update
   `ft-kanban-column.ts`'s `STAGE_COLOR` to match.
4. **Mock change-history data still uses deleted vocabulary**
   (`web/src/gen/service.ts:400,424`): `oldValue: 'Ready'`, `newValue: 'Blocked'` rendered
   verbatim in the inspector's change history. Update to current stage/hold-reason
   terminology per the audit's suggested fixture.

### Should fix in the same pass (Medium, real but lower urgency)
5. **Bearer token fallback readable from localStorage** (`web/src/gen/grpc-client.ts:418`,
   `web/src/components/ft-app.ts:313`): gate this dev/testing fallback behind an explicit
   build flag, don't ship it live by default. Suggested code in the audit report.

### Test coverage gaps flagged (add alongside the fixes above, not a separate pass)
The test review found that current tests only cover helper/predicate functions, not the
actual rendered UI — meaning findings #2, #3, #4 above were reachable specifically because
no test asserts their absence. Add:
- Component tests proving no native phase selector and no native stage selector are
  rendered/reachable (would have caught #2).
- Component tests that fail if kanban drag/drop can emit native stage/phase mutations.
- Rendered-order tests for `ft-ready-queue-view`/`ft-kanban-column` using the existing
  comparator.
- Rendered attention-workflow tests for `ft-task-card` covering cancelled/duplicate/
  wont-fix blockers (not just the helper-level test that exists today).
Full list with priorities is in the test review report.

## Task
1. Read all 3 existing report files in full before doing anything else.
2. Fix items 1-4 (blocking) and 5 (should-fix) in the existing `task-state-web-ui`
   worktree/branch.
3. Add the missing test coverage identified above.
4. Get a fresh, full independent review round (code review + security audit + test review,
   all three) on the fix.
5. Iterate until all three approve with no remaining Critical/High findings.
6. Merge, then proceed to deploy verification (Phase 2 hasn't touched production yet — this
   is a clean deploy, not a data migration like Phase 1 was, but still needs real
   verification: build the web bundle, confirm no console errors, confirm the native
   controls are genuinely gone, confirm the XSS fix holds under a real `javascript:` URL
   test case).
7. Once Phase 2 is merged and deployed+verified, proceed to Phase 3 (documentation polish)
   per the design contract's Section 11/13.

## Deliverables
1. PR(s) merging the Phase 2 fixes, independently reviewed and approved (all 3 review
   types).
2. Real verification evidence for the XSS fix specifically (a test/screenshot proving a
   `javascript:` URL does NOT execute).
3. Deploy confirmation once live, with the same evidence bar used throughout this project
   (real revision IDs, gcloud-confirmed traffic, no error logs).
4. A phase-completion report to the coordinator.
5. Then Phase 3 completion report.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for phase-completion reports,
  genuine blockers, or contract ambiguities.
- Do not contact ptone@google.com directly unless you hit a product decision the contract
  doesn't cover — route those through the coordinator first.

## Termination
You own this until Phase 2 is fixed, reviewed, merged, deployed, verified, AND Phase 3
(docs polish) is also complete. Report to the coordinator at each phase-completion
milestone. This is a standing workstream, not a one-shot task.
