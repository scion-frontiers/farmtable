# Brief: Engineering Manager — Feature 27: CLI Integration/User Test Scripts Against Deployed Backend

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** Push the branch, open a PR via `gh pr create`,
  message the coordinator. The coordinator merges.
- **Reviewers must be blind** — fresh `code-reviewer` agent per round,
  `--harness claude`.
- **Exit criteria:** Round 1 fix everything (incl. nitpicks). Round 2+:
  stop if only nitpicks remain. Hard cap 5 rounds.
- **Agents:** Developer `scion start farmtable-f27-dev --type developer
  <task>` (no `--harness`, default codex). Reviewer `scion start
  farmtable-f27-review-rN --type code-reviewer --harness claude <task>`.
- **Keep the developer agent alive** across all fix iterations.
- **This feature's "verification" is different from UI features**: instead
  of Playwright screenshots, the required evidence is a REAL terminal
  transcript of the test scripts actually running against the LIVE Cloud
  Run service (https://farmtable-qo7k5fvpda-uc.a.run.app) and passing —
  capture full stdout/stderr, not a summary claim. This is non-negotiable,
  same rigor bar as screenshots for UI work.
- **Do NOT touch or delete the `default` collection, or any pre-existing
  collection on the live service** (there are several from prior
  experiments/design work — leave all of them alone). Test scripts must
  create their OWN clearly-named, disposable test collections (e.g. prefix
  `test-integration-<timestamp>`) and should attempt cleanup if a delete
  path exists — investigate this (see below).
- **The coordinator will NOT independently re-read your diff or re-run
  your scripts** — your own verification (the real transcript) is what
  stands. Be rigorous and specific.
- **INVESTIGATE BEFORE BUILDING:**
  1. Check the repo's existing test conventions — `internal/server/*_test.go`,
     any `test/` or `scripts/` directory, `Makefile` targets, and
     `.github/workflows/ci.yml` — to match existing patterns (test
     runner, language/shell, naming) rather than inventing a new one from
     scratch.
  2. Check whether a `DeleteCollection` RPC/CLI command exists (prior
     investigation only confirmed List/Get/Create/Update — Delete may not
     exist). If it doesn't, don't add one for this feature — just
     document in the test script comments/README that test collections
     are left behind as a known limitation, with clearly disposable names
     so a human can manually clean up later.
  3. Check how `ft` currently authenticates (token flag, env var) so your
     scripts follow the same pattern other docs/examples in the repo use.

## Feature Spec

Author a set of higher-level integration/user-journey test scripts that exercise the `ft`
CLI against a real, running Farmtable server — parameterized (via env vars, e.g.
`FARMTABLE_SERVER`, a token env var) so they can run against ANY deployment (local dev or
the live Cloud Run service), not hardcoded to one. These get checked into the repo (not the
scratchpad) as real, reusable test tooling for future development.

Coverage — organize into logically separate scripts/files by domain, covering realistic
user journeys (not just isolated unit-style calls):
- **Task lifecycle**: create a task, list it, get it, update fields (priority, labels,
  assignee — whatever `ft task update`-equivalent supports), add a comment, verify it
  appears, confirm relationships behavior if easily testable (parent/child or
  blocks/blocked-by from a couple of tasks).
- **Collection lifecycle**: create a collection, list collections, update its settings
  (name/description via Feature 21's `UpdateCollection`), verify a platform-typed
  collection (Feature 26) shows correctly if that's exercisable via CLI.
- **Export/Import round-trip**: export a collection to a file, import it as a new
  collection, verify task counts/fields match (this mirrors what `deploy-4` did manually —
  formalize it as a repeatable script).

Keep scope to what's realistically CLI-exercisable in a reasonable script — don't try to
cover every single feature ever built in this project; pick the highest-value user-journey
coverage and say explicitly in your PR/log what's deliberately NOT covered and why.

Explicitly OUT of scope:
- Wiring these into actual CI (`.github/workflows/ci.yml`) — the Scion GitHub App lacks the
  `workflows` permission to make CI changes take effect anyway (known, separate blocker).
  Just author the scripts so they COULD be wired into CI later; don't attempt the wiring.
- Adding a `DeleteCollection` RPC if one doesn't exist — see investigate-first step 2.

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (includes PR #74) — use a fresh
  feature branch, PR to merge.
- Live service connection pattern (token retrieval, server env var) — see any recent deploy
  brief for the exact commands:
  `/scion-volumes/scratchpad/projects/farmtable/briefs/farmtable-deploy-4.md`
- Prior CLI usage references: `internal/cli/`, `/workspace/farmtable/agents.md`
  (`farmtable-dev` skill for env setup — also now documents a prebuilt `ft` binary at
  `/workspace/.farmtable/bin/ft` you can use instead of rebuilding, if still current).
- Design docs referencing the CLI surfaces you're testing (for context, not required
  reading): `/scion-volumes/scratchpad/projects/farmtable/reports/design-export-import.md`,
  feature logs for 21/26 under
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/`.
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-27-integration-test-scripts.md`

## Deliverables

1. A pushed feature branch + open PR against `scion-frontiers/farmtable` `main`, confirmed
   CLEAN/MERGEABLE, containing the new test scripts checked into the repo (plus a short
   README in the same directory explaining how to run them against a given server).
2. A REAL, full terminal transcript of running the scripts against the LIVE Cloud Run
   service (not local dev — that's a nice-to-have addition but the live run is required),
   captured verbatim (not summarized), saved at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-27-integration-test-scripts/live-run-transcript.txt`
   (or similar), showing genuine pass/fail output.
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-27-integration-test-scripts.md`
   covering: investigate-first findings (existing test conventions matched, DeleteCollection
   existence), what was built, what's explicitly out of scope, the live-run result, review
   rounds, and cleanup status of any test collections left on the live service (names/IDs).
4. A message to the coordinator with PR URL, summary, live-run pass/fail verdict, and any
   test collection IDs left behind on the live service.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/quota reports.
- Do not message ptone@google.com directly.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the log and the real
live-run transcript at the paths above, and message the coordinator with the summary. Then
signal task_completed. Do not delete your developer agent until the coordinator confirms
the merge landed.
