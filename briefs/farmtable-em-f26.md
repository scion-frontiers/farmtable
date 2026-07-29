> **FREEZE IN FORCE 2026-07-29 — NO DELETION, PRUNING, TIDYING OR SAFE-TO-DELETE CLASSIFICATION OF ANY TREE, WORKTREE, REGISTRATION OR STORE UNTIL THE COORDINATOR LIFTS IT. THIS FILE CONTAINS INSTRUCTIONS THAT PREDATE THE FREEZE AND MUST NOT BE FOLLOWED.**

# Brief: Engineering Manager — Feature 26: Server Support for Collection Platform Types + External Source Link in Header

## Critical Constraints (read first)

- **POTENTIAL COLLISION with Export/Import Phase B**, which is concurrently
  adding export/import buttons to the same toolbar/header area. Use your
  own worktree:
  ```
  cd /workspace/farmtable
  git fetch origin
  git worktree add /workspace/farmtable-f26-collection-types -b feat/collection-platform-types origin/main
  ```
  Do ALL work from `/workspace/farmtable-f26-collection-types`. See
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
  for the validated pattern. Before opening your PR, rebase onto latest
  origin/main and confirm `gh pr view <n> --json mergeStateStatus,mergeable`
  is CLEAN/MERGEABLE — resolve any conflict with Phase B's toolbar changes
  by reading its actual merged diff (`gh pr diff`), don't guess. Clean up
  your worktree after merge.
- **Only one agent runs at a time within THIS feature's own cycle** (dev
  OR reviewer). Other features running concurrently in their own worktrees
  is expected.
- **You do NOT merge anything.** Push, open a PR via `gh pr create`,
  message the coordinator. The coordinator merges.
- **Reviewers must be blind** — fresh `code-reviewer` agent per round.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+:
  stop if only nitpicks remain. Hard cap 5 rounds.
- **Agents:** Developer `scion start farmtable-f26-dev --type developer
  <task>` (no `--harness`, default codex). Reviewer `scion start
  farmtable-f26-review-rN --type code-reviewer --harness claude <task>`.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** — your own verification is what stands.
- **INVESTIGATE BEFORE BUILDING — this is the crux of the feature:** a
  prior experiment
  (`/scion-volumes/scratchpad/projects/farmtable/reports/github-backed-collection-experiment.md`)
  found that the server's `CreateCollection` RPC handler currently
  **hardcodes `platform: farmtable`**, ignoring whatever platform value is
  sent in the request — meaning it's structurally impossible to create a
  non-farmtable-platform collection through the server today, even though
  the schema (`Collection.platform` enum: farmtable/github/linear/jira/
  asana/beads) and integration code (`internal/platform/github/`) support
  it. Read that experiment report AND `internal/platform/github/github.go`
  + `passthrough.go` before deciding scope. Also check what `remote_id`
  actually contains for a github-platform collection (the experiment
  created one locally via CLI passthrough — check its shape, e.g. is it
  `owner/repo`?) so the UI link-building in part 2 is correct, not guessed.

## Feature Spec

**Part 1 — Server: stop hardcoding platform on CreateCollection.**
- Update the `CreateCollection` server handler to respect the `platform`
  value from `CreateCollectionRequest` (it should already be a field on
  that message per the proto — confirm) instead of hardcoding
  `farmtable`. Validate it against the enum (already true today given
  proto validation, but confirm the enum tag matches Ent's
  `Collection.platform` values).
- Add minimal, sensible per-platform validation: e.g. require `remote_id`
  to be set when `platform != farmtable` (a non-farmtable collection
  without a remote identifier doesn't make sense) — but don't build a
  general-purpose validation framework, just enough guardrails to prevent
  obviously-broken collections.
- Explicitly OUT of scope: actually making external-platform sync work
  end-to-end through the hosted server (the experiment found that's CLI-
  passthrough-only today and is a much bigger effort) — this feature is
  about the server no longer REJECTING/overriding a valid platform value
  at creation time, not about making the sync engine run in production.
  Note this distinction clearly in your feature log so it's not confused
  with "GitHub sync now works on the server" (it doesn't, per the
  experiment — this just unblocks the collection record itself existing
  correctly).
- Do NOT add a platform picker to the web "new collection" modal (Feature
  20) — that stays farmtable-only for now; this is server-side capability
  + read-only display (Part 2), not a new creation UI surface.

**Part 2 — Web UI: display external source + link in the header.**
- Wherever the current collection's name/identity is shown in the header
  (the collection picker from Feature 19, `ft-collection-picker`, or
  immediately adjacent to it), if the active collection has
  `platform != farmtable` AND a `remote_id`, show a small external-link
  affordance (e.g. an icon + "View on GitHub" or similar) that links to
  the actual external resource.
- For `platform: github` specifically: construct the real GitHub URL from
  `remote_id` (confirm the exact format from your investigation — likely
  `https://github.com/<owner>/<repo>` if `remote_id` is `owner/repo`).
  Open it in a new tab (`target="_blank" rel="noopener"`).
  Also, per prior architect research context you may find useful for
  future related work: this is unrelated to the export/import feature,
  don't conflate them.
- For other non-farmtable platforms (linear/jira/asana/beads) where you
  don't have a confirmed URL-construction pattern: show the platform name
  as a plain badge/label WITHOUT a link rather than guessing at a broken
  URL — document this gap in your feature log rather than fabricating a
  link pattern.
- For `platform: farmtable` (the common case, including everything built
  so far in this loop): no change, no badge.

## Key Locations

- Work in `/workspace/farmtable-f26-collection-types` (your own worktree).
- Server: `internal/server/` — the `CreateCollection` handler (recently
  touched by Feature 21's `UpdateCollection` addition too, `gh pr diff 67`
  for nearby conventions).
- Data model: `proto/farmtable.proto` — `CreateCollectionRequest`,
  `message Collection` (`platform`, `remote_id` fields).
- Platform integration reference (read, don't necessarily modify):
  `internal/platform/github/github.go`, `passthrough.go`.
- Prior experiment findings (read fully before starting):
  `/scion-volumes/scratchpad/projects/farmtable/reports/github-backed-collection-experiment.md`
- Frontend: `web/src/components/` — `ft-collection-picker` (Feature 19,
  `gh pr diff 65`) and the toolbar area (also touched by Export/Import
  Phase B concurrently — check for conflicts before finalizing your diff).
- Worktree pattern reference:
  `/scion-volumes/scratchpad/projects/farmtable/reports/worktree-experiment.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-26-collection-platform-types.md`

## Deliverables

1. Pushed branch + open PR against `main`, confirmed CLEAN/MERGEABLE
   right before reporting ready.
2. Real, distinct screenshots (md5sum-verified) showing: (a) the header
   with a github-platform collection's external-link affordance visible
   and pointing to a real, correct GitHub URL, (b) the header with a
   normal farmtable-platform collection showing no badge/link (no
   regression). If you don't have a live non-farmtable collection handy,
   create one via the CLI passthrough / your Part 1 server change against
   your local dev setup to get a real screenshot — don't fabricate one.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-26-collection-platform-types/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-26-collection-platform-types.md`
   covering: investigation findings (exact hardcoding location, remote_id
   format confirmed), what was built for each part, explicit scope
   boundary note (server accepts the platform value; full external sync
   through the hosted server is still out of scope), review rounds, any
   Phase B conflict encountered.
4. A message to the coordinator with PR URL, summary, review outcome, and
   confirmation of what real GitHub URL format was used.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  conflict/quota reports, and especially if the platform-validation scope
  feels ambiguous (better to ask than over/under-build).
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log/screenshots, clean up your worktree post-merge, and message the
coordinator. Then signal task_completed.
