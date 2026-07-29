# Design: Decomposer Retry & Resilience

**Status:** Proposed  
**Date:** 2026-07-23  
**Context:** Decomposer resume runs fail after 4-10 minutes with transient "invalid token" errors from the Farmtable API. LLM 429s are also unhandled at the SDK level.

## Problem & Goals

The decomposer has two categories of outbound calls — Farmtable gRPC (writer) and LLM inference — and neither has adequate transient-error resilience:

1. **Farmtable API calls** (CreateTask, ListChildren, GetTask, UpdateTaskLabels): Zero retry. A single transient gRPC error (masked as "invalid token" by auth.go) kills the entire run. Under sustained load (~700 RPCs/min), this reliably triggers within minutes.

2. **LLM calls**: The engine has `callLLMWithRetry` (3 retries, exponential backoff) which correctly handles `LLMError` with `IsTransient()` (429, 5xx). However, the GenAI SDK (`google.golang.org/genai@v1.64.0`) does NOT retry `GenerateContent` calls — its retry logic only covers file uploads. So the existing engine retry is our only defense, and it works but doesn't surface 429-specific backoff headers.

**Goals:**
1. Writer calls survive transient gRPC errors without killing the run.
2. LLM 429 responses use `Retry-After` hints when available.
3. Retry logic is centralized and consistent across both call paths.
4. Resume runs can complete large trees (~18,000 tasks) without manual restarts.

## Non-Goals

- Fixing the server-side error masking in auth.go (separate issue, filed at `issue-token-lookup-error-masking.md`).
- Connection pooling or gRPC keepalive tuning (may help but is a separate concern).
- Circuit breakers (overkill for a CLI tool with bounded concurrency).

## Proposed Design

### 1. Reusable Retry Helper

Extract retry logic into a shared helper that both the LLM path and writer path can use:

```go
// retryConfig controls retry behavior.
type retryConfig struct {
    MaxRetries    int
    InitialDelay  time.Duration
    MaxDelay      time.Duration
    Jitter        bool  // add random jitter to avoid thundering herd
}

var (
    defaultWriterRetry = retryConfig{
        MaxRetries:   5,
        InitialDelay: 500 * time.Millisecond,
        MaxDelay:     10 * time.Second,
        Jitter:       true,
    }
    defaultLLMRetry = retryConfig{
        MaxRetries:   3,
        InitialDelay: 1 * time.Second,
        MaxDelay:     30 * time.Second,
        Jitter:       true,
    }
)

// retryWithBackoff executes fn up to maxRetries times with exponential backoff.
// isTransient determines which errors are retryable.
func retryWithBackoff(ctx context.Context, cfg retryConfig, isTransient func(error) bool, fn func() error) error
```

### 2. Writer Retry Wrapper

Wrap all writer calls with retry. The transient-error check for gRPC:

```go
func isTransientGRPC(err error) bool {
    code := status.Code(err)
    switch code {
    case codes.Unavailable,      // connection issues, load balancer errors
         codes.DeadlineExceeded, // timeout
         codes.Aborted,         // transaction conflict
         codes.Internal,        // server bug (includes masked DB errors)
         codes.ResourceExhausted, // rate limiting
         codes.Unauthenticated:   // masked DB errors from auth.go (the current bug)
        return true
    }
    return false
}
```

**Note on Unauthenticated:** We retry `codes.Unauthenticated` specifically because the server's auth.go returns this code for transient DB errors. This is a workaround for the server bug. Once `issue-token-lookup-error-masking.md` is fixed (server returns `codes.Internal` for DB errors), we can remove Unauthenticated from the retryable set.

Apply to all writer methods in engine.go and walkAndResume:

```go
// Before (crashes on transient error):
children, err := e.writer.ListChildren(ctx, taskID)
if err != nil {
    return fmt.Errorf("listing children: %w", err)
}

// After (retries transient errors):
var children []TaskInfo
err := retryWithBackoff(ctx, defaultWriterRetry, isTransientGRPC, func() error {
    var retryErr error
    children, retryErr = e.writer.ListChildren(ctx, taskID)
    return retryErr
})
if err != nil {
    return fmt.Errorf("listing children (after retries): %w", err)
}
```

### 3. LLM Retry Enhancement

The existing `callLLMWithRetry` already works. Two improvements:

**a. Parse Retry-After from 429 responses:**

The GenAI SDK wraps errors as `*googleapi.Error` or returns status details. Check for `Retry-After` and use it as the backoff floor:

```go
// In callLLMWithRetry, after detecting a 429:
if retryAfter := parseRetryAfter(err); retryAfter > 0 {
    backoff = retryAfter
}
```

**b. Surface GenAI errors as LLMError:**

Currently, GenAI errors are returned as generic `fmt.Errorf` wraps. To enable `IsTransient()` detection, parse the HTTP status from GenAI SDK errors:

```go
// In GenAIClient.Complete(), wrap errors with status info:
resp, err := client.Models.GenerateContent(ctx, c.Model, contents, config)
if err != nil {
    if apiErr := extractAPIError(err); apiErr != nil {
        return "", &LLMError{StatusCode: apiErr.Code, Body: apiErr.Message}
    }
    return "", fmt.Errorf("GenAI GenerateContent: %w", err)
}
```

### 4. Logging

All retries should be logged so the operator can see what's happening:

```
[retry] ListChildren failed (attempt 1/5, backoff 500ms): rpc Unauthenticated: invalid token
[retry] ListChildren failed (attempt 2/5, backoff 1.2s): rpc Unauthenticated: invalid token
[retry] ListChildren succeeded (attempt 3/5)
```

## Alternatives Considered

### A. Retry at the gRPC dial/transport level

Use `grpc.WithDefaultServiceConfig` with a retry policy JSON. Rejected: gRPC retry policies don't cover `Unauthenticated` (not in the default retryable set), and the server bug means that's the code we need to retry. Also less visible — no logging.

### B. Retry inside the GRPCWriter methods

Put retry logic in writer.go instead of engine.go. Rejected: the writer is a thin gRPC wrapper and shouldn't own retry policy. The engine should control retry behavior because it has context about concurrency, semaphores, and overall run state.

### C. Only fix the server-side error masking

If auth.go returned `codes.Internal` for DB errors, the decomposer would still crash — it doesn't retry ANY writer errors. The server fix is necessary but not sufficient. Both need to happen.

## Migration / Rollout

1. All changes are in the decomposer binary — no server changes needed.
2. Backward compatible — retry is additive.
3. Existing `callLLMWithRetry` is refactored to use the shared helper but behavior is preserved.

## Implementation Phases

1. **Phase 1:** Add `retryWithBackoff` helper and `isTransientGRPC`. Apply to all writer calls in `decompose()` and `walkAndResume()`.
2. **Phase 2:** Refactor `callLLMWithRetry` to use the shared helper. Add GenAI error wrapping for `LLMError` status detection.
3. **Phase 3:** Add `Retry-After` parsing for 429 responses.
4. **Phase 4:** Re-run resume against flash-lite v3 to verify resilience.

## Open Questions

1. **Should Unauthenticated be retryable?** Yes, as a workaround for the server bug. Document clearly and remove when the server is fixed.
2. **Max retry delay for writer calls?** 10s seems right — the errors are transient DB hiccups, not sustained outages. If still failing after 5 retries with 10s max, the problem is bigger than a retry can solve.
3. **Jitter implementation:** Use `delay * (0.5 + rand(0.5))` to spread retries from concurrent goroutines. Without jitter, 8 concurrent goroutines all retrying at the same intervals could create thundering-herd spikes.

## Acceptance Criteria

- [ ] Writer calls (CreateTask, ListChildren, GetTask, UpdateTaskLabels) retry on transient gRPC errors.
- [ ] Retry uses exponential backoff with jitter.
- [ ] Each retry is logged with attempt number and backoff duration.
- [ ] LLM errors from GenAI SDK are wrapped as `LLMError` with status code.
- [ ] Resume run against flash-lite v3 collection completes without manual restart.
- [ ] Existing tests pass; new tests for retry helper.
