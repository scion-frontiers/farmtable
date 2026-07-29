# GitHub Sub-Issues

Added native GitHub sub-issue support to the GitHub integration.

## Files Changed

- `internal/platform/github/graphql_queries.go` adds GraphQL helpers for
  `addSubIssue`, `removeSubIssue`, and sub-issue listing.
- `internal/platform/github/passthrough.go` wires `parent_task_id` through
  create/update operations and maps GitHub parent metadata back to tasks.
- `internal/platform/github/github.go` stores GitHub issue `node_id` in remote
  data and links local parent/child tasks during configured sync.
- `scripts/remap-github-sub-issues.sh` provides an idempotent remap script for
  the fixed existing issue hierarchy.

## Notes

- GitHub limits are enforced as `MaxSubIssueDepth = 8` and
  `MaxSubIssuesPerParent = 100`.
- The remap script was run against `ptone/farmtable`; all 28 requested links
  were already present and were skipped without creating duplicates.
- Live GraphQL verification confirmed the expected parent/sub-issue mapping for
  issues `#4`, `#5`, `#6`, `#7`, `#8`, `#18`, and `#27`.
- Verification passed with `go test ./...` and `go build ./...`.
