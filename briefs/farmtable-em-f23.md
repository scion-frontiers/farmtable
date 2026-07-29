> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 23: Add Comment from Inspector

## Critical Constraints (read first)

- **THIS FEATURE RUNS IN PARALLEL WITH FEATURE 21**, which is actively
  working in the shared checkout at `/workspace/farmtable` on its own
  branch right now. To avoid stepping on it, **you MUST NOT use
  `/workspace/farmtable` directly.** Instead, have your developer create a
  fresh git worktree as a SIBLING directory (one level below `/workspace`,
  same pattern the repo itself uses):
  ```
  cd /workspace/farmtable
  git fetch origin
  git worktree add /workspace/farmtable-f23-comments -b feat/inspector-add-comment origin/main
  ```
  Then do ALL work (build, dev server, screenshots, commits, push, PR)
  from `/workspace/farmtable-f23-comments`, not `/workspace/farmtable`.
  A prior experiment validated this pattern works cleanly for this repo
  (no absolute-path issues, shared Go module cache, ~91MB/5s npm install
  cost per worktree, dev-server ports are configurable) — see
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
  for the full findings/gotchas if you hit anything unexpected. **This is
  the first real production use of the worktree pattern — if it breaks
  down in some way the experiment didn't anticipate, message the
  coordinator with specifics rather than fighting it silently.**
  Clean up the worktree (`git worktree remove`) once the PR is merged and
  confirmed.
- **Only one agent runs at a time within THIS feature's own cycle.** Never
  run your developer and a reviewer simultaneously. (Feature 21's agents
  running concurrently in their own separate checkout is fine and
  expected — that's the whole point of the worktree.)
- **You do NOT merge anything.** Push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and
  summary. The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback.
- **Exit criteria for the review loop:**
  - Round 1: fix ALL findings (including nitpicks).
  - Round 2 onward: if a fresh review returns ONLY nitpick/minor findings,
    STOP — ship as-is. Otherwise fix and run another fresh round.
  - Hard cap: 5 review rounds total.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f23-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f23-review-rN --type code-reviewer
    --harness claude <task>`.
- **Keep the developer agent alive** across all fix iterations.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
  Since Feature 21 may merge to main while you're working, rebase again
  right before opening the PR if time has passed.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** — your own verification is what stands. Be rigorous:
  confirm real git diff/commits, confirm screenshots show genuine distinct
  UI states (md5sum them), and say so explicitly and specifically.
- **INVESTIGATE BEFORE BUILDING:** check whether a `CreateComment` (or
  similarly named) RPC already exists in `proto/farmtable.proto` and the
  server implementation (`internal/server/`). Also check whether the
  Inspector panel currently displays comments AT ALL (read-only or
  otherwise) — Feature 4 added the inspector but comments may not be
  wired up yet. Report what you find to the coordinator before committing
  to a plan:
  - If `CreateComment` already exists: pure UI wiring.
  - If it does not exist: add the smallest possible backend surface — a
    `CreateComment` RPC/handler accepting `task_id`, `body`, and deriving
    `author_id` from the authenticated caller (check how other
    write RPCs like `CreateCollection`/task-editing RPCs resolve the
    current user — reuse that, don't invent a new auth mechanism).
  - If the inspector has no comment display at all yet: build a minimal
    read-only comment list (author + body + timestamp, chronological) as
    a prerequisite for the "add comment" UI to make sense — keep it
    simple, this is not the point of the feature, just scaffolding for it.

## Feature Spec

Users should be able to add a new comment to a task from the Inspector
panel (the task detail panel added in Feature 4, extended in Features 5-9
for label/assignee/priority editing and keyboard nav).

- Add a comment input (textarea) + submit control at the bottom of the
  inspector's comment section (existing if present, or the minimal one
  you scaffold per the investigate-first step above).
- On submit: call the create-comment RPC with the task ID and the
  entered body, then show the new comment appended to the list
  immediately (optimistic or refetch — your call, but no full page
  reload).
- Validation: non-empty body required; trim whitespace-only submissions.
- Clear the input on successful submit. Keep focus sensible (e.g. back in
  the input for rapid follow-up comments) — check existing keyboard-nav
  conventions from Features 9-11 rather than inventing new focus behavior.
- Handle RPC errors visibly (same `sl-alert` pattern used in Features 20
  and, if applicable, 21) — don't fail silently.
- Keyboard: Enter-to-submit is a reasonable default IF there's a clear
  way to still get a newline (e.g. Shift+Enter) in the textarea — use
  judgment, but don't trap keyboard users.

Explicitly OUT of scope:
- Editing or deleting existing comments.
- Rich text / markdown rendering beyond whatever the data model already
  implies (comments were confirmed as a linked record with a plain body
  field per prior investigation — check
  `/scion-volumes/scratchpad/projects/farmtable/reports/investigation-comments-model.md`
  for the exact schema before assuming formatting support).
- @mentions, notifications, or any comment-triggered side effects.

## Key Locations

- Repo: branch off current `main` — but work in your OWN worktree per the
  critical constraint above, not `/workspace/farmtable` directly.
- Proto/backend: `proto/farmtable.proto` (look near `message Comment`,
  `message Task`), `internal/server/`, `internal/store/schema/` (comment
  schema/edges), `internal/store/` (store interface, mirror how
  `CreateCollection` or task-update RPCs are implemented if you need to
  add `CreateComment`).
- Frontend: `web/src/` — the Inspector component from Feature 4 onward;
  check `gh pr diff 50` (Feature 4) and subsequent inspector-related PRs
  for the existing structure/conventions.
- Prior investigation (data model, already answered — use it, don't
  re-derive):
  `/scion-volumes/scratchpad/projects/farmtable/reports/investigation-comments-model.md`
- Worktree pattern reference:
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` (note: read this
  from `/workspace/farmtable`, but then do your actual work in your
  worktree at `/workspace/farmtable-f23-comments`).
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-23-inspector-add-comment.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`, confirmed CLEAN/MERGEABLE.
2. Real, distinct screenshots (md5sum-verified, genuine UI interaction)
   showing: (a) the comment input in the inspector, (b) a newly added
   comment appearing in the list after submit, (c) the empty-input
   validation state (e.g. submit disabled/no-op on empty).
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-23-inspector-add-comment/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-23-inspector-add-comment.md`
   with: investigate-first findings (did `CreateComment` exist? did a
   comment list already exist?), what was built, review rounds, final
   state, unaddressed nitpicks, developer's next-feature suggestion, AND
   an honest note on how the worktree setup went (smooth / friction / had
   to deviate — this feeds back into whether we keep using this pattern).
4. A message to the coordinator with: PR URL, branch, summary, whether
   backend changes were needed, final review outcome, and how the
   worktree experience went.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports, investigate-first findings, or worktree friction.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log and screenshots at the paths above, clean up your worktree after
merge is confirmed, and message the coordinator with the summary. Then
signal task_completed.
