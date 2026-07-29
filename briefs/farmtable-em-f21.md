# Brief: Engineering Manager — Feature 21: Collection Settings/Edit Modal

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** When ready, push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and summary.
  The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback — give it only the current repo/diff state.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f21-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f21-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
  (Feature 19's PR hit a squash-merge rebase conflict — avoid repeating it.)
- **Quota watch:** if an agent stalls/errors with quota/rate-limit signs,
  don't keep retrying — `scion look` it and message the coordinator.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** (context-preservation directive from the project
  owner) — your own verification is what stands. Be rigorous and specific.
- **INVESTIGATE BEFORE BUILDING (do this first, it changes scope):** check
  whether an `UpdateCollection` RPC (or equivalent write path) already
  exists in `proto/farmtable.proto` / the server implementation
  (`internal/server/`). Feature 20 needed zero backend changes because
  `CreateCollection` already existed — this feature may not be so lucky.
  Report what you find to the coordinator before committing to a plan:
  - If an update RPC already exists: this is pure UI wiring, proceed as
    scoped below.
  - If it does NOT exist: add the smallest possible backend surface to
    support it — a new `UpdateCollection` RPC/handler that accepts
    `name` and `description` only (do not build a generic "update any
    field" mechanism, do not touch `platform`/`remote_id`/
    `workspace_id`/`linked_account_id`/`status_mappings`/
    `custom_field_definitions` — those are platform-integration concerns
    out of scope here). Keep the backend change proportional to the two
    fields below.

## Feature Spec

Add a way to edit an existing collection's **name** and **description**
after creation (currently only settable at creation time via Feature 20,
name-only).

- Entry point: a settings/edit affordance associated with the collection
  picker (Feature 19) — e.g. a small gear/edit icon next to or inside the
  picker, or an "Edit collection" item in its dropdown. Use your judgment
  on exact placement/icon, consistent with existing toolbar button styling,
  but it must be discoverable from the board view without extra navigation.
- Modal/dialog: pre-filled with the CURRENT collection's name and
  description, editable, with a Save/Cancel affordance. Reuse the
  `ft-new-collection-dialog` pattern from Feature 20 for consistency
  (Shoelace dialog, focus trap, Escape to cancel) rather than building a
  new dialog primitive from scratch.
- On save: persist via the update RPC (existing or newly added per the
  investigation above), then reflect the new name immediately in the
  picker and anywhere else the collection name is displayed, without
  requiring a full page reload.
- Validation: name remains required/non-empty (matches existing
  `Collection.name` `min_len = 1` constraint). Description can be empty.
- Show the collection's `platform` value in the modal as **read-only**
  (informational only — do not make it editable; changing an
  integration-linked collection's platform is a bigger decision than this
  feature covers).
- Handle RPC errors visibly (same pattern as Feature 20's `sl-alert`
  approach) — don't fail silently.

Explicitly OUT of scope:
- Editing `platform`, `remote_id`, `workspace_id`, `linked_account_id`,
  `status_mappings`, `custom_field_definitions`.
- Deleting collections.
- Bulk-editing or a full collection-management admin page — this is a
  single-collection quick-edit modal only.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PR #66,
  commit f50c584) — use a fresh feature branch, PR to merge.
- Proto/backend: `proto/farmtable.proto` (look for existing
  `UpdateCollection`/similar near the `CreateCollection`/`ListCollections`
  RPCs), `internal/server/` (service implementation), `internal/store/`
  (Ent schema/queries) if a new RPC is genuinely needed.
- Frontend: `web/src/` — `ft-new-collection-dialog` component and its
  toolbar wiring from Feature 20 (`gh pr diff 66`), `ft-collection-picker`
  from Feature 19 (`gh pr diff 65`).
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Prior feature logs for context/patterns:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-19-collection-picker.md`,
  `feature-20-new-collection-modal.md`
- Prior Playwright learnings:
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-21-collection-settings-modal.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`, confirmed CLEAN/MERGEABLE via `gh
   pr view --json mergeStateStatus,mergeable` before reporting ready.
2. Real, distinct screenshots (verified via `md5sum`, genuine UI
   interaction) showing: (a) the edit entry point, (b) modal pre-filled
   with current name/description, (c) after save — updated name visible
   in the picker/UI without reload. Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-21-collection-settings-modal/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-21-collection-settings-modal.md`
   with: findings from the investigate-first step (did `UpdateCollection`
   already exist?), what was built (frontend + backend if applicable),
   each review round's findings/resolutions, final state, unaddressed
   nitpicks, and the developer's optional next-feature suggestion.
4. A message to the coordinator with: PR URL, branch, summary (including
   whether backend changes were needed), and final review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports, and especially to report the investigate-first
  finding before committing significant backend work.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log and screenshots at the paths above, and message the coordinator with
the summary. Then signal task_completed. Do not delete your developer
agent until the coordinator confirms the merge landed or explicitly tells
you to clean up.
