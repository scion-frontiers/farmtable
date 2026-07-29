# Mini-Design: X-Farmtable-Token Fallback Header

**Date:** 2026-07-22
**Author:** Architect agent (auth workstream)
**Status:** Ready for implementation dispatch
**Complexity:** Small (~30 lines server, ~5 lines per client)

---

## Problem

Farmtable is now deployed behind Google Cloud IAP on Cloud Run. IAP consumes the `Authorization: Bearer` header for its own OIDC validation before the request reaches the backend. Any farmtable `ft_` token in that header never arrives at the server's auth interceptor (`internal/server/auth.go`, lines 44–80).

**Affected clients:**
- `decomposer` binary (`internal/decomposer/writer.go`, line 69)
- `ft` CLI in remote server mode (`internal/cli/connect.go`, line 362)

**Not affected:**
- Web dashboard (browser) — currently operates without sending a farmtable token (empty string → no metadata → interceptor passes through unauthenticated). IAP handles browser auth via its own OAuth cookie flow.
- `ft` CLI in embedded mode — uses in-process bufconn, no IAP in the path.

**Answer to ptone's question:** It is correct that gRPC API clients (decomposer, `ft` CLI) currently have no way to pass their farmtable identity to the IAP-protected instance. The `ft_` token they send in `Authorization: Bearer` is consumed by IAP and never reaches the app. They can still reach the service (IAP passes the request through after OIDC validation), but the farmtable auth interceptor sees no token, so all requests are unauthenticated — meaning no user identity is associated with mutations (tasks created, claimed, etc. all record `uuid.Nil` as the actor).

---

## Proposed Design

### Approach: Fallback Header (Scion's Proven Pattern)

Scion solves this identically: agents send their token via `X-Scion-Agent-Token`, and the server checks that header first, then falls back to `Authorization: Bearer`. The `extractAgentToken()` function in `pkg/hub/agenttoken.go:292` implements this exact pattern.

For farmtable:
- **Header name:** `X-Farmtable-Token`
- **gRPC metadata key:** `x-farmtable-token` (gRPC lowercases metadata keys automatically)
- **Precedence:** `x-farmtable-token` metadata → `authorization` Bearer header (first wins)

### Server-Side Change

**File:** `internal/server/auth.go`

Add a helper function to extract the token, checking the custom header first:

```go
// extractToken retrieves the app-layer auth token from gRPC metadata.
// It checks x-farmtable-token first (required when behind IAP, which
// consumes the Authorization header), then falls back to Authorization: Bearer.
func extractToken(md metadata.MD) string {
    // 1. Custom header (IAP-safe)
    if vals := md.Get("x-farmtable-token"); len(vals) > 0 && vals[0] != "" {
        return vals[0]
    }
    // 2. Standard Authorization: Bearer (direct connections)
    if vals := md.Get("authorization"); len(vals) > 0 {
        val := vals[0]
        if strings.HasPrefix(val, "Bearer ") {
            return strings.TrimPrefix(val, "Bearer ")
        }
        // Has Authorization header but wrong scheme — will be rejected below
        return ""
    }
    return ""
}
```

Then update `TokenAuthInterceptor` and `TokenAuthStreamInterceptor` to use `extractToken()` instead of directly reading the `authorization` metadata. The Bearer-prefix validation error should only fire when `authorization` header is present but wrong scheme (not when using the custom header).

**Updated unary interceptor logic (pseudocode):**
```go
func TokenAuthInterceptor(lookup TokenLookup) grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
        if lookup == nil {
            return handler(ctx, req)
        }
        md, ok := metadata.FromIncomingContext(ctx)
        if !ok {
            return handler(ctx, req)
        }

        token := extractToken(md)
        if token == "" {
            // Check if authorization header exists but has wrong scheme
            if auth := md.Get("authorization"); len(auth) > 0 && !strings.HasPrefix(auth[0], "Bearer ") {
                return nil, status.Error(codes.Unauthenticated, "authorization header must use Bearer scheme")
            }
            return handler(ctx, req)  // no token → unauthenticated pass-through
        }

        // ... hash + lookup + expiry check + recordUsage (unchanged) ...
        ctx = ContextWithUserID(ctx, result.UserID)
        return handler(ctx, req)
    }
}
```

The streaming interceptor follows the same pattern.

### Client-Side Changes

All three clients need the same change: send the farmtable token via both headers (for backward compatibility with non-IAP deployments, and forward compatibility with IAP).

**File: `internal/decomposer/writer.go`** (line 68–71)
```go
func (w *GRPCWriter) authCtx(ctx context.Context) context.Context {
    md := metadata.Pairs(
        "authorization", "Bearer "+w.token,
        "x-farmtable-token", w.token,
    )
    return metadata.NewOutgoingContext(ctx, md)
}
```

**File: `internal/cli/connect.go`** (line 358–364)
```go
func authCtx(ctx context.Context, token string) context.Context {
    if token == "" {
        return ctx
    }
    md := metadata.Pairs(
        "authorization", "Bearer "+token,
        "x-farmtable-token", token,
    )
    return metadata.NewOutgoingContext(ctx, md)
}
```

**File: `web/src/gen/grpc-client.ts`** (line 387–390) — optional, for future when web dashboard uses farmtable tokens:
```typescript
private metadata(): grpc.Metadata.ConstructorArg | undefined {
    if (!this.token) return undefined;
    return {
        Authorization: `Bearer ${this.token}`,
        'X-Farmtable-Token': this.token,
    };
}
```

### CORS / gRPC-Web Header Allowlisting

**File: `internal/serverapp/unified.go`** — the `grpcweb.WrapServer` call may need to expose the custom header. Check that `grpcweb` passes through non-standard metadata keys. If it strips them, add an `AllowedHeaders` option.

---

## What This Does NOT Change

- **Auth enforcement model** — still advisory (no token → pass-through). Mandatory auth is a separate stage.
- **Web dashboard UX** — still works without a token via IAP's browser auth.
- **Token format or storage** — `ft_` prefix, SHA-256 hash in DB, all unchanged.
- **gRPC-Web protocol** — the custom metadata key is just another HTTP header in the gRPC-Web envelope.

---

## Testing

1. **Unit test** (`internal/server/auth_test.go`): Add `TestAuthInterceptor_CustomHeader` — send token via `x-farmtable-token` metadata only (no `authorization` header). Expect the same behavior as the existing Bearer test.

2. **Unit test**: `TestAuthInterceptor_CustomHeaderPrecedence` — send different tokens in both headers. Expect the custom header's token to be used.

3. **Unit test**: `TestAuthInterceptor_AuthorizationOnlyStillWorks` — existing test, should pass unchanged (backward compat).

4. **Integration test**: Run `decomposer` against a local server with auth enabled, using the `x-farmtable-token` header. Verify tasks are created with the correct user identity.

---

## Alternatives Considered

**A. Trust IAP entirely (proxy mode):** Verify `X-Goog-IAP-JWT-Assertion` and map IAP identity → farmtable user, skipping `ft_` tokens. This is the right strategic direction (Stage 5 of the auth improvement plan) but requires: JWT verification library, JWKS fetching, user auto-provisioning. Too much scope for an immediate unblock.

**B. Disable IAP:** Remove IAP and use Cloud Run's native `--no-allow-unauthenticated` + invoker IAM. Loses IAP's browser login flow, which is currently how the web dashboard is accessed.

**C. Token in URL query parameter:** Already supported on the web client (`?token=`). Bad practice for security (leaks in logs/history). Not applicable to gRPC anyway.

---

## Implementation Checklist

- [ ] Add `extractToken()` helper in `internal/server/auth.go`
- [ ] Update `TokenAuthInterceptor` to use `extractToken()`
- [ ] Update `TokenAuthStreamInterceptor` to use `extractToken()`
- [ ] Update `authCtx()` in `internal/cli/connect.go` to send both headers
- [ ] Update `authCtx()` in `internal/decomposer/writer.go` to send both headers
- [ ] Update `metadata()` in `web/src/gen/grpc-client.ts` to send both headers
- [ ] Check `grpcweb.WrapServer` allows custom metadata (if not, add `AllowedHeaders`)
- [ ] Add unit tests for custom header (3 tests described above)
- [ ] Run `go test ./internal/server/...` and `go test ./...`
- [ ] Rebuild `ft` binary and verify CLI works against local server with custom header
- [ ] Deploy and verify decomposer works against IAP-protected instance
