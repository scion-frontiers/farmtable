# Feature 59: x-farmtable-token Fallback Header (IAP Auth Fix)

## Status: MERGED — PR #136, commit 7d64230
## Started: 2026-07-22
## Completed: 2026-07-23

## PR
https://github.com/scion-frontiers/farmtable/pull/136

## Summary
Add `x-farmtable-token` gRPC metadata key as a fallback auth mechanism so that
farmtable API clients (ft CLI, decomposer) can authenticate through IAP, which
consumes the standard `Authorization: Bearer` header.

## Design Doc
`/scion-volumes/scratchpad/projects/farmtable/design-iap-token-header.md`

## Implementation Checklist
- [x] Add `extractToken()` helper in `internal/server/auth.go`
- [x] Update `TokenAuthInterceptor` to use `extractToken()`
- [x] Update `TokenAuthStreamInterceptor` to use `extractToken()`
- [x] Update `authCtx()` in `internal/cli/connect.go` to send both headers
- [x] Update `authCtx()` in `internal/decomposer/writer.go` to send both headers
- [x] Update `metadata()` in `web/src/gen/grpc-client.ts` to send both headers
- [x] Check `grpcweb.WrapServer` allows custom metadata (default ["*"], no change needed)
- [x] Add unit tests (2 new: custom header, precedence; existing backward compat test preserved)
- [x] Run `go test ./internal/server/...` and `go test ./...` — ALL PASS
- [x] Build `ft` binary — SUCCESS
- [x] Live IAP verification — PASSED

## Review Rounds
- **Round 1**: APPROVE (reviewer: review-f59-iap-token). 2 non-blocking items:
  1. Misleading comment "below" → "by caller" — FIXED (commit 777ce3d)
  2. Stream interceptor test gap — noted for follow-up

## Agents
| Agent | Role | Status |
|-------|------|--------|
| dev-f59-iap-token | Developer | Complete |
| review-f59-iap-token | Code Reviewer | Complete (APPROVE) |

## Evidence
Saved under `feature-59-iap-token-header/`
- `live-iap-verification.md` — full live IAP test results
