# Brief: Experiment — Front the Farmtable Repo's Own GitHub Issues via a GitHub-Backed Collection

## Critical constraints (read first)
- This is an EXPERIMENT against the LIVE deployed Cloud Run service
  (https://farmtable-qo7k5fvpda-uc.a.run.app, revision as of this writing includes PRs up
  through #71 — see `/scion-volumes/scratchpad/projects/farmtable/deploy/2026-07-19-deploy-2.md`
  for connection details/token retrieval), not local dev. The goal is genuinely open-ended —
  "let's see what it learns by trying." Success is NOT required; a clear, honest account of
  what worked, what didn't, and why is the actual deliverable.
- **Do not modify or delete any EXISTING collection or task** on the live service (the
  `default` collection and its tasks, or anything created by prior feature-verification
  work). Only ADD a new collection for this experiment — purely additive, no cleanup
  required unless something goes wrong and you want to tidy up your own test artifacts.
- **Do not write application code or open a PR** unless you hit something that's clearly a
  trivial, safe, isolated bug fix blocking the whole experiment (e.g. a one-line config
  issue) — if so, stop and report to the coordinator with the specifics rather than
  patching and shipping it yourself. This is exploration, not a feature build.
- You already have a GitHub PAT available via `$GITHUB_TOKEN` in this environment
  (authenticated as `ptone`, with push/admin access to `scion-frontiers/farmtable` — the
  repo this whole project has been working on). Use IT as the credential for linking a
  GitHub-backed collection if the flow calls for a token — do not attempt an interactive
  OAuth browser flow (won't work headless); if the only supported linking path truly
  requires interactive OAuth with no token-based alternative, that itself is a valid
  finding to report.

## Context
Farmtable's data model supports collections backed by external platforms — `Collection.platform`
can be `github` (among `farmtable`, `linear`, `jira`, `asana`, `beads` — see
`internal/store/schema/collection.go`), and `Collection` has `remote_id`,
`workspace_id`, and `linked_account_id` fields (`proto/farmtable.proto`) suggesting
external-repo binding. There's also backend integration code at
`internal/platform/github/` (`github.go`, `passthrough.go` + tests) already in the repo.
ptone@google.com wants to know: can Farmtable actually be pointed at a real GitHub repo
(specifically `scion-frontiers/farmtable` itself — a nice test case since its issues are
real and you already have access) and have its GitHub issues show up as Farmtable tasks?

## Task
1. **Read first, before touching the live service:** `internal/platform/github/github.go`
   and `passthrough.go` (+ their tests) to understand what a GitHub-backed collection
   actually needs — auth mechanism (PAT? GitHub App install? OAuth?), what `remote_id`/
   `workspace_id`/`linked_account_id` are expected to contain for platform=github, whether
   there's a sync/import mechanism (polling? webhook? on-demand pull?) that turns GitHub
   issues into Farmtable tasks, and whether it's two-way (would creating/editing a
   Farmtable task under this collection try to write back to GitHub — be careful here,
   don't accidentally mutate real GitHub issues on `scion-frontiers/farmtable` unless
   that's clearly the intended, safe behavior and you're deliberately testing it in a
   controlled, reversible way).
2. Check `internal/cli/` for any existing CLI support for creating a github-platform
   collection or linking a GitHub account (e.g. `ft collection create --platform github`,
   `ft account link`, or similar — look at whatever `CreateCollectionRequest`/
   `LinkedAccount`-related messages exist in the proto too).
3. Using the `ft` CLI (or direct gRPC calls if the CLI doesn't expose this) against the
   LIVE Cloud Run service, attempt to create a new collection with `platform: github`
   pointed at `scion-frontiers/farmtable`, providing whatever credential/config the code
   actually requires (per step 1's findings).
4. If it accepts the collection creation, check whether GitHub issues actually appear as
   tasks (may require a manual sync trigger, may happen automatically, may not be
   implemented at all despite the schema supporting it — any of these is a valid finding).
5. Document each concrete step you took (exact commands/RPC calls) and its exact result
   (success, error message, partial behavior) — this needs to be reproducible from your
   log, not just a summary verdict.

## Deliverables
Write findings to:
`/scion-volumes/scratchpad/projects/farmtable/reports/github-backed-collection-experiment.md`

Must contain: what the code actually supports (vs. what the schema merely allows), the
exact steps you tried against the live service and their results, whether real GitHub
issues successfully appeared as tasks (with evidence — a screenshot or `ft task list`
output), and a clear verdict: fully working / partially working (what's missing) / not
implemented despite schema support / blocked (and by what). If you created a real test
collection on the live service, note its ID/name so it can be found and cleaned up later
if desired — don't delete it yourself unless doing so is trivially safe.

## Direct contact
- Message the coordinator (`scion message coordinator "..."`) when done, or if you hit a
  genuine ambiguity about whether an action is safe to take against the live service
  (when in doubt, don't — ask first).
- Do not message ptone@google.com directly.

## Termination
You MUST produce the report at the path above (with reproducible step-by-step detail) and
then mark the task complete, regardless of whether the experiment succeeded.
