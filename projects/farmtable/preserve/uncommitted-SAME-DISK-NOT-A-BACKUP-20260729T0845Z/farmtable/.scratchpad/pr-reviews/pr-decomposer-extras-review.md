# PR Review: Decomposer Binary (`feat/decomposer-extras`)

**Reviewer:** Code Review Agent
**Date:** 2026-07-21
**Branch:** `feat/decomposer-extras` vs `main`
**Scope:** 14 files, ~2,043 lines added

---

## Review Summary

**Verdict:** APPROVE (with recommendations)

**Overview:** This is a well-structured, clean addition of a standalone decomposer binary with solid interface design, correct concurrency handling, and thorough unit tests. The semaphore-only-around-LLM-call design is correct and well-documented; the recursive fan-out pattern is sound. There are two important issues to address before this sees heavy production use (HTTP client timeout, per-call GenAI client creation) and one correctness concern with collection resolution pagination, but none are merge-blocking given the tool's current scope as an internal CLI.

---

## Critical Issues

None.

---

## Important Issues

### 1. Anthropic client uses `http.DefaultClient` with no timeout
**File:** `internal/decomposer/llm_anthropic.go:99`
**Category:** Security / Reliability

`http.DefaultClient` has no request-level timeout. While the context is propagated via `http.NewRequestWithContext` (so user cancellation works), there are no connection-level timeouts for TCP connect, TLS handshake, or response header wait. If the Anthropic API accepts the connection but stalls, the goroutine blocks indefinitely, holding a semaphore slot. With `concurrency=4`, four such hangs deadlock all LLM work.

**Suggested Fix:**
```go
// In AnthropicClient struct or as a package-level var:
var anthropicHTTPClient = &http.Client{
    Timeout: 120 * time.Second,
}

// In Complete():
resp, err := anthropicHTTPClient.Do(req)
```

### 2. GenAI client created per `Complete()` call
**File:** `internal/decomposer/llm.go:65-73`
**Category:** Performance

A new `genai.NewClient` is created on every `Complete()` call. This involves ADC token resolution, HTTP client allocation, and potentially new TLS connections each time. For a decomposition with 20+ LLM calls, this is significant overhead. The client should be created once and reused.

**Suggested Fix:**
```go
type GenAIClient struct {
    Project  string
    Location string
    Model    string
    
    once   sync.Once
    client *genai.Client
    initErr error
}

func (c *GenAIClient) getClient(ctx context.Context) (*genai.Client, error) {
    c.once.Do(func() {
        c.client, c.initErr = genai.NewClient(ctx, &genai.ClientConfig{
            Project:  c.Project,
            Location: c.Location,
            Backend:  genai.BackendVertexAI,
        })
    })
    return c.client, c.initErr
}
```

Note: verify the `genai.Client` is safe for concurrent use before applying this — it almost certainly is, as Google SDK clients are typically goroutine-safe.

### 3. `ResolveCollection` does not paginate `ListCollections`
**File:** `internal/decomposer/writer.go:117`
**Category:** Correctness

`ListCollections` is called with an empty request (no `PageSize`). The server applies a default page size. If the target collection is beyond the first page of results, it will not be found, causing a spurious "collection not found" error and auto-creation of a duplicate.

**Suggested Fix:**
```go
func (w *GRPCWriter) ResolveCollection(ctx context.Context, collectionFlag string) (string, error) {
    ctx = w.authCtx(ctx)
    if isUUID(collectionFlag) {
        w.collectionID = collectionFlag
        return collectionFlag, nil
    }
    
    var pageToken string
    for {
        resp, err := w.client.ListCollections(ctx, &pb.ListCollectionsRequest{
            PageSize:  100,
            PageToken: pageToken,
        })
        if err != nil {
            return "", fmt.Errorf("listing collections: %w", err)
        }
        for _, c := range resp.GetItems() {
            if strings.EqualFold(c.GetName(), collectionFlag) {
                w.collectionID = c.GetId()
                return c.GetId(), nil
            }
        }
        pageToken = resp.GetNextPageToken()
        if pageToken == "" {
            break
        }
    }
    return "", fmt.Errorf("collection %q not found", collectionFlag)
}
```

---

## Suggestions

### 4. Semaphore held during retry backoff sleep
**File:** `internal/decomposer/engine.go:212-254`
**Category:** Performance

The semaphore is acquired once before the retry loop and released after all retries complete. During exponential backoff (up to 4s), a semaphore slot is occupied doing nothing. With `concurrency=4` and multiple goroutines in backoff, effective parallelism drops.

Consider releasing the semaphore before sleeping and re-acquiring before the next attempt. This complicates the code, so it's a judgment call — the current approach is correct, just suboptimal under retry storms.

### 5. Unbounded `io.ReadAll` on HTTP response body
**File:** `internal/decomposer/llm_anthropic.go:105`
**Category:** Defensive coding

The response body is read without a size limit. While the Anthropic API is a trusted source, wrapping in `io.LimitReader` is cheap insurance:

```go
respBody, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20)) // 1 MB cap
```

### 6. `extractJSON` could be more robust
**File:** `internal/decomposer/parser.go:56-66`
**Category:** Resilience

The first-`{`-to-last-`}` heuristic works for well-behaved LLM output but can false-match if the LLM includes braces in commentary before the JSON (e.g., `"Here are the {tasks} I found: {...actual JSON...}"`). The corrective retry mechanism mitigates this gracefully, so it's not a bug — but a more robust approach (e.g., trying `json.Unmarshal` starting at each `{` position) would reduce retry round-trips.

### 7. `printSummary` dashboard URL construction doesn't handle IPv6
**File:** `cmd/decomposer/main.go:244`
**Category:** Edge case

`strings.Split(dashServer, ":")[0]` to strip the port doesn't handle IPv6 addresses like `[::1]:8080` (would produce `[`). Consider using `net.SplitHostPort` which already handles this, as done in `writer.go:isLocalhost`.

```go
if host, _, err := net.SplitHostPort(dashServer); err == nil {
    dashServer = host
}
```

### 8. `contains` / `searchSubstring` test helpers duplicate `strings.Contains`
**File:** `internal/decomposer/parser_test.go:267-278`
**Category:** Simplification

These two helpers replicate `strings.Contains` exactly. Replace with `strings.Contains` for clarity.

---

## What's Done Well

1. **Semaphore design is correct and well-documented.** The comment at engine.go:93-97 explaining WHY the semaphore wraps only the LLM call (not the full recursion) is exactly the kind of documentation that prevents future regressions. This is the single most important design decision in the system and it's right.

2. **Clean interface design.** `Inferencer` and `TaskWriter` are minimal interfaces that make the engine fully testable. The mock implementations in tests are straightforward and the engine has zero knowledge of providers or gRPC — good separation.

3. **Context chain clone via `copy()`** (engine.go:197-199). The explicit allocation of a new slice with `make` + `copy` prevents slice aliasing bugs that would surface nondeterministically under concurrent fan-out. This is a subtle correctness point done right.

4. **Corrective retry with graceful degradation.** Parse failure → corrective re-prompt → second parse failure → force terminal. This is a pragmatic fallback that prevents the system from crashing on bad LLM output while still producing a partial DAG.

5. **Comprehensive test coverage.** 22 test cases covering: single-level, recursive, max-depth enforcement, terminal from LLM, context chain propagation, concurrent fan-out, corrective retry, double-parse-fail forced terminal, and context cancellation. The mock Inferencer is thread-safe (mutex-protected), which is necessary given the concurrent fan-out tests.

6. **Atomic stats tracking.** Using `atomic.Int32` for counters avoids needing a mutex on the hot path. The CAS loop for `maxDepthSeen` (engine.go:100-105) is correct — it's a compare-and-swap idiom for tracking a running maximum.

7. **Auth pattern consistency.** Flag → env var fallback for `FARMTABLE_SERVER`, `FARMTABLE_TOKEN`, `GOOGLE_CLOUD_PROJECT`, `ANTHROPIC_API_KEY` follows the existing patterns in `cmd/ft` and `cmd/farmtable-server`.

---

## Verification Story

- **Tests reviewed:** Yes — 22 test cases across `parser_test.go` (14 cases) and `engine_test.go` (8 cases). Good coverage of happy paths, error paths, edge cases, and concurrency. Missing: no test for `writer.go` (gRPC calls — would need integration test infrastructure).
- **Build verified:** Yes — `go build ./cmd/decomposer/` succeeds cleanly.
- **Lint/static analysis clean:** Yes — `go vet ./internal/decomposer/ ./cmd/decomposer/` passes with no output.
- **Security checked:** Yes — API keys handled via env vars (no hardcoding), auth token passed via gRPC metadata, TLS used for non-localhost connections. One finding: `http.DefaultClient` has no timeout (Issue #1 above).

---

## Final Verdict

**APPROVE** — The code is well-designed, correctly handles the hard concurrency problem (semaphore placement), and has thorough tests. Issues #1-3 are real but non-blocking for an internal CLI tool at this stage. Recommend addressing #1 (HTTP timeout) and #3 (pagination) before the tool sees production use with real Farmtable instances. Issue #2 (per-call client creation) is a performance optimization that can be deferred.
