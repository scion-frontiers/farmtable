# Brief: Engineering Manager — Feature 18: URL-Driven Collection Routing

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
  - If the broker/infra genuinely fails to start a review agent after
    3-4 retries with brief waits, it's acceptable to ship on a single
    thorough, clean review round — document the failure explicitly.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-f18-dev --type developer <task>` — NO
    `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-f18-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations. Only delete
  it after the coordinator confirms the merge landed.
- **Quota watch:** if the developer or a reviewer stalls or errors in a way
  that looks like quota/rate-limit/"limits exceeded", do NOT keep retrying.
  Use `scion look <agent>` to check its screen and message the coordinator
  immediately with what you observed. Do not spawn a replacement.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** (context-preservation directive from the project
  owner) — your own verification is what stands. Be rigorous: confirm real
  git diff/commits, confirm screenshots show genuine distinct UI states
  (md5sum them), and say so explicitly and specifically in your report.
  Vague "looks good" reports are not acceptable evidence.
- **This is feature 1 of a 3-feature chained sequence** (18 -> 19 -> 20),
  each building on the last. Keep your implementation's collection-id
  handling generic/reusable — features 19 (collection picker) and 20 (new
  collection modal) will build directly on whatever URL/state mechanism
  you put in place here. Document the exact mechanism (state var names,
  URL param name, how components read current collection) clearly in your
  feature log so the next EM/developer isn't rediscovering it.

## Feature Spec

Farm Table's data model already supports multiple `Collection`s (see
`proto/farmtable.proto` `message Collection` and `ListCollections` RPC),
but the deployed dashboard currently auto-picks the first collection
silently and has no way to see or navigate between collections. This
feature makes collection selection explicit and URL-addressable:

1. **No collection in the URL** -> the app must NOT auto-pick a collection.
   Instead it shows a landing view listing all available collections
   (via `ListCollections`) for the user to choose from. Simple list is
   fine (name + platform, maybe task count if cheap to get) — this is not
   a polished picker (that's Feature 19's job), just an unambiguous choice
   screen.
2. **Selecting a collection from that list** -> navigates to a URL that
   encodes that collection's ID (the existing client already supports
   reading `?collection=<uuid>` in `web/src/gen/grpc-client.ts` — reuse
   that param name/scheme unless you find a strong reason not to; if you
   change it, update the client accordingly and document why) and then
   renders that collection's board.
3. **Directly navigating to a URL with a collection ID already present**
   -> loads and displays that collection's board directly, skipping the
   list view entirely, without a full page reload if you can help it (a
   client-side history push/replace or reading the param on initial load
   both work; use `pushState`/`replaceState` as appropriate so back/
   forward and direct navigation behave sanely).
4. **Unknown/invalid collection ID in the URL** — handle gracefully (e.g.
   fall back to the list view with a small "collection not found"
   notice). Don't crash or infinite-spin.

Explicitly OUT of scope for this feature (deferred to 19/20):
- Any persistent picker UI chrome (dropdown, top-left widget) — that's
  Feature 19.
- Creating new collections — that's Feature 20.
- Removing the existing `resolveCollectionId()` auto-pick-first fallback
  behavior entirely is fine/expected, but don't rip out unrelated client
  code paths (e.g. CLI usage of the same client) — check for other
  callers before deleting shared logic.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PRs #47-
  #63) — use a fresh feature branch, PR to merge.
- Frontend root: `web/src/` — `index.ts` is the entry point;
  `web/src/components/` holds UI components, `web/src/store/` likely holds
  app/client state. Investigate the actual app bootstrap and current
  routing (if any) yourself before designing — do not assume a router
  library exists; a plain query-param + pushState approach is likely
  simplest and most consistent with the existing `?collection=` support.
- Collection-related client code: `web/src/gen/grpc-client.ts` —
  `resolveCollectionId()`, `createGrpcFarmTableClient()` (reads
  `?collection=`, `window.FARMTABLE_COLLECTION_ID`, localStorage).
- Data model reference (for RPC shapes): `proto/farmtable.proto` —
  `message Collection`, `ListCollections`, `GetCollection`.
- Prior investigation of current (pre-this-feature) collection scoping
  behavior, useful background:
  `/scion-volumes/scratchpad/projects/farmtable/reports/investigation-collection-model.md`
- Repo's own agent guide: `/workspace/farmtable/agents.md` — dev/build/test
  conventions, `farmtable-dev` skill for env setup.
- Prior Playwright learnings (Chromium executable path gotcha, reusable
  node_modules):
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-18-collection-url-routing.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`.
2. Real, distinct screenshots (verified via `md5sum`, driven by genuine UI
   interaction, not `page.evaluate()`) showing: (a) landing view with no
   collection in URL listing available collections, (b) board shown after
   selecting one (URL now has the ID), (c) direct navigation to a
   collection URL loading that board without going through the list.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-18-collection-url-routing/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-18-collection-url-routing.md`
   with: what was built, the exact URL/state mechanism used (param name,
   how a component reads/writes current collection — this is load-bearing
   for Features 19/20), each review round's findings and resolutions,
   final state, unaddressed nitpicks.
4. A message to the coordinator with: PR URL, branch name, summary
   (including the URL/state mechanism in a couple sentences so the
   coordinator can hand it to Feature 19's EM), and final review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened and pushed, produce the log and screenshots at
the paths above, and message the coordinator with the summary (including
the URL/state mechanism description). Then signal task_completed. Do not
delete your developer agent until the coordinator confirms the merge
landed or explicitly tells you to clean up.
