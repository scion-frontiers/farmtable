# Auth Token Usage Timeout

Cleanup Round 4 bounded asynchronous API token usage recording in the gRPC
auth interceptors. Previously the fire-and-forget `RecordUsage` call used
`context.Background()` with no deadline, so a blocked store update could leave
an unbounded goroutine. The new helper gives both unary and streaming auth
paths a five-second timeout and a regression test verifies the usage context has
a deadline.

Verification:

- `go test ./internal/server -run TestAuthInterceptor_RecordUsageHasDeadline -count=1`
- `go test ./internal/server`
- `go test ./...`
- `go build ./...`
