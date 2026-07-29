# Brief: Create LinkedAccount for Collection 466c2baa via `ft collection link`

## Critical constraints (read first)
- This mutates real state on the LIVE Cloud Run service (adds a LinkedAccount / credential
  record). Only touch the specific collection named below — do not modify or delete any
  other collection.
- Use the GitHub PAT already available in this environment as `$GITHUB_TOKEN` (authenticated
  as `ptone`, with access to `scion-frontiers/farmtable`) as the credential for the link —
  do not ask for or fabricate a different token.
- Do not write application code. This is an operational/data task only.

## Context
Collection `466c2baa-334e-439c-b9f9-abbe89eb8aae` (`platform: github`, `remote_id:
scion-frontiers/farmtable`) was created before the LinkedAccount/passthrough system
existed. The passthrough stuck-spinner bug was just fixed and deployed (PR #107, revision
TBD/latest) — the fix makes the frontend correctly detect "not supported, use polling"
instead of hanging, but this collection still has NO LinkedAccount, so it will show an
empty board (not real GitHub data) until one is created. ptone@google.com asked to run
`ft collection link` now using the environment's PAT to complete this.

## Task
1. Get the Farmtable API token and connect to the live service:
   `TOKEN=$(gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test)`,
   `export FARMTABLE_SERVER=farmtable-qo7k5fvpda-uc.a.run.app:443`.
2. Check `ft collection link --help` (added in PR #97) for the exact flags/usage.
3. Run `ft collection link` for collection `466c2baa-334e-439c-b9f9-abbe89eb8aae`,
   platform `github`, using `$GITHUB_TOKEN` as the credential.
4. Verify it worked: check `ft collection links <collection-id>` (or equivalent) shows the
   new LinkedAccount, and check `ft task list -c 466c2baa-334e-439c-b9f9-abbe89eb8aae`
   (or open the dashboard URL) to confirm real GitHub issues now appear instead of an empty
   board or stuck spinner.
5. Take a screenshot of the live dashboard at
   `https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=466c2baa-334e-439c-b9f9-abbe89eb8aae`
   showing real data (or the exact state if something's still wrong — report honestly
   either way, don't force a screenshot that doesn't match reality).

## Deliverables
1. Exact commands run and their exact output (not paraphrased).
2. Screenshot of the resulting dashboard state.
3. A short report at
   `/scion-volumes/scratchpad/projects/farmtable/reports/link-github-account-466c2baa.md`.
4. A message to the coordinator with the result — success, partial, or still broken (with
   specifics either way).

## Direct contact
- Coordinator: `scion message coordinator "<message>"` for blockers.
- Do not message ptone@google.com directly.

## Termination
You MUST run the link command, verify the result, produce the report and screenshot, and
message the coordinator. Then signal task_completed.
