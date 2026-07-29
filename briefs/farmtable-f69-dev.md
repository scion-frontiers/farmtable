# Brief: Feature 69 — Inspector "Open External Source" Link

## Critical Constraints (read first)
- Dedicated git worktree: `git worktree add /workspace/farmtable-f69-dev -b feature-69-inspector-external-link origin/main`
- **Generalize, don't hardcode GitHub.** The Task proto already has a `remote_url` field
  that stores the full external URL regardless of platform (GitHub's adapter already
  populates it with the issue's HTML URL). Build the Inspector UI around
  `task.remoteUrl` directly — do NOT special-case platform types in the Inspector like
  the existing toolbar link does. If `remoteUrl` is present, show the link; if not, don't.

## User Request (verbatim, from ptone@google.com)
"we want a feature to open the GH issue from the inspector - this outbound link will
need to be a general feature for any external store"

## Key Locations (from codebase scouting — verify current line numbers before editing)
1. **Task proto**: `proto/farmtable.proto` — `remote_url` field (~line 330), already
   populated for GitHub-sourced tasks via `issueBuildRemoteData()` in
   `internal/platform/github/graphql_queries.go` (~line 216) with the issue's HTML URL.
2. **Existing visual pattern to follow** (but generalize): `web/src/components/ft-toolbar.ts`,
   `renderExternalLink()` method (~line 305-320) — this is the COLLECTION-level "View on
   GitHub" link added by Feature 26. It's currently GitHub-hardcoded (checks
   `platform === GITHUB`, constructs a URL from `remote_id`). Use its button styling/icon
   as a visual reference, but your Inspector version should be simpler: just check if
   `task.remoteUrl` exists and render it directly as an `<a href>`, no platform-specific
   URL construction needed since the URL is already stored in full.
3. **Inspector General tab**: `web/src/components/inspector/ft-inspector-meta.ts`
   (~line 579-613) — existing metadata rows (Assignees, Type, Labels, date grid). Add a
   new row here, likely near the top (or wherever makes sense visually) for the external
   link — something like "External Source" label + a clickable link/button with an
   external-link icon, similar to the toolbar's affordance.
4. **Beads note**: the Beads importer (`internal/platform/beads/beads.go`, ~line 350)
   currently stores an opaque `external_ref` in `remote_data` but does NOT populate
   `remote_url`. This means Beads-imported tasks won't show the link yet. Check quickly
   whether `external_ref` is typically a full URL (if the Beads JSONL format's
   `external_ref` values look like URLs) — if so, populate `task.remote_url` from it
   during import as a small bonus fix. If it's NOT reliably a URL (e.g. just an ID), skip
   this and just note it as a known gap — don't force a bad guess at URL construction.

## Task
1. Confirm the current field name/path for the remote URL on the frontend's Task type
   (check the generated TS types from the proto, likely `task.remoteUrl`).
2. Add a conditionally-rendered "External Source" link in the Inspector General tab
   (`ft-inspector-meta.ts`) — only shows when `task.remoteUrl` is truthy. Style
   consistent with the app's existing patterns (check `renderExternalLink()` in
   `ft-toolbar.ts` for icon/button styling to match, but keep the Inspector version
   platform-agnostic).
3. Investigate the Beads `external_ref` question from point 4 above and handle it per
   the guidance there (populate `remote_url` if reliably URL-shaped, otherwise skip).
4. Verify manually: open a GitHub-sourced task's Inspector, confirm the link appears and
   points to the correct GitHub issue URL, clicking it opens in a new tab. Open a
   native (non-external) task's Inspector, confirm NO link appears.
5. Run `npx tsc --noEmit` and any Go build/tests if you touch the Beads importer.

## Deliverables
1. A PR against `main`.
2. Screenshots showing: (a) a GitHub-sourced task's Inspector with the link visible and
   correct, (b) a native task's Inspector with no link shown. Saved to
   `/scion-volumes/scratchpad/projects/farmtable/reports/f69-external-link-evidence/`.
3. A message to the coordinator with the PR link, what you verified, and your finding on
   the Beads `external_ref` question.

## Direct Contact
- Coordinator: `scion message coordinator "<message>"` for questions or completion.
- Do not contact ptone@google.com directly.

## Termination
You MUST add the generalized (not GitHub-hardcoded) external-link row to the Inspector,
verify it shows correctly for GitHub-sourced tasks and correctly hides for native tasks
with real screenshots, resolve the Beads external_ref question, open the PR, and message
the coordinator with the PR link. Then signal task_completed.
