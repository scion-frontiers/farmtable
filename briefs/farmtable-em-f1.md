# Brief: Engineering Manager — Feature 1: Add Task UI

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never have a developer and a reviewer
  running simultaneously. Start one, wait for it to finish, delete it (or
  keep it per the rule below), then start the next.
- **You do NOT merge anything.** When the feature is ready, push the branch
  and open a PR with `gh pr create`, then message the coordinator (this
  session's parent) with the PR URL and a summary. The coordinator performs
  the actual `gh pr merge --squash` to origin/main. Do not run `gh pr merge`
  yourself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) that has never seen prior
  review feedback. Do not paste previous rounds' findings into its prompt,
  and do not reference "what the last reviewer said." Give it only: the repo
  state / diff / branch to review, and ask it to review for correctness,
  UX, and code quality bugs from scratch. Its goal is to find anything a
  prior reviewer might have missed, so it must not be primed by prior
  results.
- **Exit criteria for the review loop:**
  - Round 1: whatever the reviewer finds (including nitpicks/minor style
    issues), have the developer fix ALL of it.
  - Round 2 onward: if the fresh review comes back with ONLY nitpick/minor
    findings (nothing significant or blocking), STOP — the feature is done,
    ship as-is with those nitpicks unaddressed. If it finds anything
    significant/blocking, have the developer fix it and run another fresh
    review round.
  - Hard cap: 5 review rounds total. If round 5 still has significant
    findings, stop anyway, do not fix further, and report the unresolved
    findings honestly to the coordinator — do not loop forever.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f1-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f1-review-rN --type code-reviewer
    --harness claude <task>` (increment N each round: r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations within this
  feature — do not recreate it between review rounds, just message it the
  new feedback to fix (message with "continue" style follow-ups after
  giving it the findings). Only stop/delete it after you've reported
  completion to the coordinator and gotten acknowledgement, OR if it
  stalls/errors (see quota note below).
- **Quota watch:** if the developer or a reviewer agent stalls (no progress,
  same state across checks) or errors in a way that looks like a quota /
  rate limit / "limits exceeded" issue, do NOT just keep retrying. Use
  `scion look <agent>` to check its screen, capture what you see, and
  message the coordinator directly immediately with what you observed. Do
  not spawn a replacement agent in this case — wait for the coordinator.
- **Verify, don't assume.** Before reporting the feature done, check the
  developer's actual git diff/commit and actual screenshots exist with real
  content (not stubs) — the Simulation Trap applies to your own dev agent
  too.

## Feature Spec

Add a "create new task" UI affordance to the Farm Table dashboard. Today the
dashboard (Kanban view, `web/` — Lit-based per `web/src/`) appears to be
read/view-only — no visible way to create a task from the browser (tasks
currently only get created via the `ft` CLI or gRPC API). Add:

- A visible "+ Add Task" (or similar) control in the dashboard UI.
- A minimal form/dialog to enter at least a task title (description optional
  if it fits naturally), submitting via the existing
  `farmtable.v1.FarmTableService` gRPC-Web client
  (`web/src/gen/grpc-client.ts` per earlier notes) to actually create a real
  task.
- New task should appear in the appropriate column (e.g. Triage/Backlog)
  after creation, ideally via the existing live/watch mechanism already
  used by the dashboard (per the Cloud Run verification notes, `WatchTasks`
  is already wired up).
- Keep scope to this one feature — do not attempt to add other UI features
  in this pass.

## Key Locations

- Repo: `/workspace/farmtable` (branch off `main`, do NOT push to main
  directly — use a feature branch and PR)
- Repo's own agent guide: `/workspace/farmtable/agents.md` (symlinked
  CLAUDE.md) — dev environment, build/test commands, task claiming protocol
- Web frontend: `/workspace/farmtable/web/src/`
- `farmtable-dev` skill covers local env setup, build, test — the developer
  agent should use it.
- The developer should use the project's web-launch/screenshot tooling (the
  `web` / `run` skill pattern used elsewhere in this project) to actually
  launch the app locally (or point at the deployed Cloud Run URL — see below
  — whichever is more practical) and take real screenshots proving the
  Add Task control works end-to-end (create a task, see it appear).
- Existing deployed instance for reference/comparison (read-only — do not
  deploy to it): `https://farmtable-qo7k5fvpda-uc.a.run.app`. Full handoff
  doc: `/workspace/downloads/tg_1784417200_cloud-run-handoff.md`.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Scratchpad for this feature (write your round-by-round log here as you
  go): `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`, implementing the Add Task UI.
2. Real screenshots (before/after, or the working flow) saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-1-add-task-ui.md`
   containing: what was built, each review round's findings (even though
   reviewers were blind to each other, you should record them for the
   coordinator's records) and how they were resolved, final state, any
   nitpicks left unaddressed, and the developer's optional suggestion for
   the next most logical UI/UX feature to add (ask the developer for this
   once their implementation is done — it's optional, just relay whatever
   they say, don't act on it).
4. A message to the coordinator with: PR URL, branch name, summary, final
   review outcome, and the developer's next-feature suggestion (if any).

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` — message it directly
  when done, blocked, or reporting quota concerns.
- If the end user needs to be reached, that's the coordinator's job, not
  yours — do not message ptone@google.com directly for this feature.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary described
above. Then signal task_completed. Do not delete your developer agent until
the coordinator confirms the merge landed or explicitly tells you to clean
up.
