# A2: Proto Messages and RPC Definitions for LinkedAccount

**Date:** 2026-07-21
**Branch:** feat/extstore-a2-proto-rpcs
**Task:** External Store Passthrough — Proto layer

## Summary

Added proto definitions for LinkedAccount CRUD operations to support the
External Store Passthrough feature. This is the gRPC contract that enables
agents to manage linked platform accounts (GitHub, Linear, Jira, Asana, Beads)
through Farm Table's auth bridge.

## Changes

### Proto (`proto/farmtable.proto`)

1. **New enum `LinkedAccountStatus`** — `ACTIVE`, `EXPIRED`, `REVOKED` to model
   the lifecycle of a linked account credential, matching the Ent schema values.

2. **Updated `LinkedAccount` message** — Added `collection_id` (UUID) and
   `updated_at` (Timestamp) fields. Changed `status` type from `IdentityStatus`
   to the new `LinkedAccountStatus` enum for domain-specific semantics.
   Renumbered fields for the new layout.

3. **New request/response messages:**
   - `CreateLinkedAccountRequest` — includes `auth_token` (sensitive, write-only)
   - `CreateLinkedAccountResponse` — wraps `LinkedAccount`
   - `GetLinkedAccountRequest` / `GetLinkedAccountResponse`
   - `DeleteLinkedAccountRequest` / `DeleteLinkedAccountResponse`
   - `ListLinkedAccountsRequest` — filterable by `collection_id`, `platform`,
     `status`; paginated
   - `ListLinkedAccountsResponse` — standard list envelope

4. **New RPCs on `FarmTableService`:**
   - `CreateLinkedAccount`
   - `GetLinkedAccount`
   - `DeleteLinkedAccount`
   - `ListLinkedAccounts`

### Generated Go Code (`api/farmtable/v1/`)

Regenerated with `buf generate`. Client, server interfaces, and
`UnimplementedFarmTableServiceServer` stubs all include the four new RPCs.

### GitHub PassThrough Store (`internal/platform/github/passthrough.go`)

Added stub implementations (returning `ErrNotImplemented`) for the four
`LinkedAccount` store interface methods so the pass-through store continues to
satisfy the `store.Store` interface.

## Design Decisions

- **`auth_token` excluded from `LinkedAccount` message** — The token is
  write-only (accepted in `CreateLinkedAccountRequest`), never returned in
  responses. The server stores and uses it internally for proxying operations.

- **`LinkedAccountStatus` vs `IdentityStatus`** — Created a dedicated enum
  rather than reusing `IdentityStatus` because linked accounts have a different
  lifecycle (active/expired/revoked) than user identities (active/suspended/archived).

- **Field renumbering** — The `LinkedAccount` message fields were renumbered to
  accommodate `collection_id` at field 2. This is safe because the message had
  no prior wire-format consumers (it was defined but not used in any RPC before
  this change).

## Verification

- `buf generate` succeeds (proto compiles cleanly)
- `go build ./...` passes
- `go test ./...` passes (all existing tests green)
