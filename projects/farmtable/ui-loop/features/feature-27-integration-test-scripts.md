# Feature 27: CLI Integration Test Scripts

## Investigation Findings Matched

- The repository uses Go standard tests and integration build tags, with no existing shell-based integration test convention. These scripts were added under `test/integration/` as reusable test tooling rather than CI wiring.
- `DeleteCollection` does not exist as an RPC or CLI command, so test collections cannot be cleaned up programmatically.
- `UpdateCollection` exists as an RPC but has no CLI command, so collection update behavior is not covered.
- Authentication follows the expected `FARMTABLE_SERVER` and `FARMTABLE_TOKEN` environment variables, with the live token retrieved via:

```bash
gcloud secrets versions access latest --secret=farmtable-token --project=deploy-demo-test
```

## What Was Built

- `test/integration/common.sh`: shared environment validation, command checks, JSON assertions, disposable collection creation, and leftover collection listing.
- `test/integration/test-task-lifecycle.sh`: creates a disposable collection, creates/lists/gets/updates a task, adds/lists a comment, creates a second task, verifies a blocking relationship through task output and dependency tree output, closes the task, and verifies closed state.
- `test/integration/test-collection-lifecycle.sh`: creates a disposable collection, verifies list/get behavior, creates a task in that collection, and verifies collection-scoped task listing.
- `test/integration/test-export-import.sh`: creates a disposable source collection with two tasks, exports it to `/tmp`, validates JSON structure, imports it under a new name, verifies the imported collection and task count, and spot-checks task fields.
- `test/integration/run-all.sh`: validates prerequisites, runs all three journey scripts in sequence, and lists `test-integration-*` collections left behind.
- `test/integration/README.md`: documents prerequisites, running against local or Cloud Run servers, coverage, and known limitations.

## Explicitly Out of Scope

- CI workflow wiring was not added because the task explicitly excluded `.github/workflows/` work.
- `DeleteCollection` RPC/CLI support was not added; the scripts document and surface leftover disposable collections instead.
- Collection update testing was not added because there is no `ft collection update` command.
- Exhaustive CLI coverage was not attempted; these scripts focus on high-value end-to-end user journeys.

## Live Run Result

- Result: PASS after fixing the local assertion helper to pass through `jq --arg` options.
- Final transcript: `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-27-integration-test-scripts/live-run-transcript.txt`
- Final transcript length: 56 lines.
- Verification commands:

```bash
bash -n test/integration/common.sh test/integration/test-task-lifecycle.sh test/integration/test-collection-lifecycle.sh test/integration/test-export-import.sh test/integration/run-all.sh
go test ./...
go build ./...
```

All verification commands passed.

## Review Rounds

### Round 1
- Verdict: **APPROVE** with 1 important + 1 suggestion finding
- Important: temp file `/tmp/test-export-*.json` never cleaned up → fixed with `trap cleanup EXIT`
- Suggestion: `test_stamp()` PID collision risk → fixed by adding `$RANDOM` suffix
- Both fixed in commit `f25e7e5`

### Round 2
- Verdict: **APPROVE** — no new issues, all R1 findings resolved
- Only observational notes (no changes needed)

## PR
- PR #75: https://github.com/scion-frontiers/farmtable/pull/75
- Branch: `feat/cli-integration-tests`
- Commits: `48f9ef6` (initial) + `f25e7e5` (review fixes)
- Status: CLEAN, MERGEABLE

## Test Collections Left Behind

These collections remain on the live service because there is no programmatic delete operation:

- `e66e9179-fa14-42d5-9293-e2637b7cfd71` `test-integration-20260720131734-6733-task`
- `2a68677e-0a5c-4399-b847-bcdd34a2dd78` `test-integration-20260720131735-6799-collection`
- `3a3c0e1f-ce84-4196-9045-8b35679156d4` `test-integration-20260720131735-6717-export`
- `709ae760-8c5b-498d-8ef1-848f8f359841` `test-integration-20260720131735-6717-reimported`
- `60fb37bf-ad46-4e80-8db7-d39c1dd4b36c` `test-integration-20260720131756-7440-task`
- `9a568ad7-f0c2-49ab-8e6c-435fb9d11d5b` `test-integration-20260720131758-7667-collection`
- `e2528733-7322-4eeb-a30e-458fe812fc41` `test-integration-20260720131759-7424-export`
- `e615511a-61b5-46be-b180-1e137d3b9aea` `test-integration-20260720131759-7424-reimported`
