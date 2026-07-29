# Brief: Investigator — Passthrough Collection Stuck on Spinner (Live Bug)

## Critical constraints (read first)
- Read-only investigation. Do NOT modify code, do NOT commit, do NOT open a PR, and do NOT
  attempt a fix yourself — this bug is being explicitly shepherded through
  investigator → architect → engineering-manager, and your job is ONLY the investigation
  and root-cause report. Hand off cleanly.
- Do not disturb `/workspace/farmtable`'s shared checkout if other agents are active there
  — reading files is fine.
- Do not modify or delete anything on the live Cloud Run service or its data — this is
  observation only.

## Context
ptone@google.com reports: the collection at
`https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=466c2baa-334e-439c-b9f9-abbe89eb8aae`
is designed to use the new External Store Passthrough feature (just deployed, revision
`farmtable-00012-5dc`, commit d95a755, PRs #85-104) but appears **stuck on a loading
spinner** — the sync never completes.

Background you should know before investigating:
- This collection (`466c2baa-334e-439c-b9f9-abbe89eb8aae`) was created MONTHS-worth-of-
  work-ago during an early GitHub-backed-collection experiment
  (`/scion-volumes/scratchpad/projects/farmtable/reports/github-backed-collection-experiment.md`)
  — it's `platform: github`, `remote_id: scion-frontiers/farmtable`, created via a direct
  `CreateCollection` RPC call BEFORE the LinkedAccount/passthrough system existed.
- The just-shipped External Store Passthrough design
  (`/scion-volumes/scratchpad/projects/farmtable/design-external-store-passthrough.md`,
  task breakdown at `reports/design-passthrough-task-breakdown.md`) introduces a
  `LinkedAccount` entity that stores per-collection platform credentials, and a `MultiStore`
  that lazily constructs a passthrough store **from a LinkedAccount's credentials on first
  request** (task B3). A collection with no `LinkedAccount` may have no way to actually
  resolve a passthrough store, which could explain a hang.
- **This is a hypothesis, not a conclusion — verify it, don't assume it.** There could be
  other causes (a genuine bug in the lazy registration, a network/timeout issue talking to
  GitHub, a frontend bug unrelated to the backend, etc).

## Task
1. **Reproduce live**: open the URL above with Playwright, confirm the stuck-spinner
   behavior, and inspect via Chrome DevTools Protocol (network tab, console) what
   request(s) are pending/failing. Screenshot the stuck state.
2. **Check Cloud Logging**: use `gcloud logging read` (or the Cloud Run console equivalent)
   against the `farmtable` Cloud Run service in project `deploy-demo-test`, filtered to
   recent timeframe, looking for errors/warnings related to this collection ID, MultiStore,
   PlatformResolver, LinkedAccount, or passthrough store construction. Capture the actual
   log lines, not a paraphrase.
3. **Check server-side state**: via `ft` CLI (get a token per
   `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-20-deploy-4.md`'s pattern),
   check whether a `LinkedAccount` exists for this collection (`ft collection links
   <collection-id>` or equivalent — check `ft collection --help` for the exact command from
   PR #97). Check what `ft task list -c 466c2baa-334e-439c-b9f9-abbe89eb8aae` actually
   returns (hangs? errors? empty?).
4. **Read the relevant code** to understand the actual failure mode once you have log/
   network evidence pointing somewhere specific — `internal/store/multistore.go`,
   `internal/store/passthrough_store.go` (or wherever it lives), the WatchTasks/ListTasks
   handlers, and the frontend polling/loading-state code for external collections
   (`web/src/` — check Feature B8's poll-refresh and B7's read-only mode code from PRs
   #103/#104 for how the frontend handles external-collection loading states).
5. Determine the exact root cause with code citations (file:line) and log evidence, not
   just a plausible theory.

## Deliverables
Write findings to:
`/scion-volumes/scratchpad/projects/farmtable/reports/passthrough-stuck-spinner-investigation.md`

Must contain: reproduction confirmation with screenshot, actual Cloud Logging excerpts,
server-side state check results (LinkedAccount existence, raw ft command output), root
cause with file:line citations, and a recommendation for what needs to change (you don't
implement it — describe it clearly enough for an architect to design a fix approach from).

## Direct contact
- Message the coordinator (`scion message coordinator "..."`) when done. The coordinator
  will hand your findings to an architect next, then an EM for the fix — you don't need to
  loop in the user directly.

## Termination
You MUST produce the report at the path above and then mark the task complete.
