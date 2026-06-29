# MCP Numeric Bounds

Cleanup Round 6 added explicit MCP-side numeric validation for task list,
ready-task, and dependency-tree requests. Previously the adapter accepted
oversized `limit` values and cast `max_depth` to `int32` before checking bounds,
which could produce confusing downstream behavior for huge numeric inputs.

The new helper rejects non-finite, negative, fractional, and oversized values
before any gRPC request is made. Regression tests cover `limit > 200` for
`task_list` and `task_ready`, plus a huge `max_depth` value that is rejected
before `int32` conversion.

Verification:

- `go test ./internal/mcp`
- `go test ./...`
- `go build ./...`
