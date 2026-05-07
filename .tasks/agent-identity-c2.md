# Agent Identity (C2) — Token→User Mapping + Auth Context Propagation

## Context

Every store mutation (ClaimTask, UpdateTask, CloseTask, AddComment) currently uses either `uuid.New()` or `uuid.Nil` for the author/actor ID. The audit trail is meaningless — you can't tell which agent did what. This is the #1 blocker for reliable dog-fooding and the foundation for all subsequent work.

## Goal

Ship a v1 identity system: API tokens map to User records, and the resolved user ID flows through gRPC context to every store mutation that records an actor.

## Design (v1 — simple token→user table)

### 1. User Entity + API Token Entity

The User schema likely already exists in `internal/store/schema/`. Check what's there. If not, create:

**User schema** (if not already present):
- `id` (UUID, primary key)
- `name` (string, required) — display name like "deploy-agent" or "preston"
- `email` (string, optional, unique)
- `created_at`, `updated_at`

**API Token schema** (new):
- `id` (UUID, primary key)
- `token_hash` (string, unique, indexed) — SHA-256 hash of the token (never store raw tokens)
- `user_id` (UUID, foreign key → User)
- `name` (string) — descriptive label like "deploy-agent-prod"
- `created_at`
- `expires_at` (optional)
- `last_used_at` (optional)

After schema changes, run `go generate ./internal/store/ent`.

### 2. Token Resolution in Auth Interceptor

**File:** `internal/server/auth.go`

Update the auth interceptor to:
1. Extract Bearer token from metadata (already done)
2. Hash the token with SHA-256
3. Look up the token hash in the API Token table
4. If found, inject the associated `user_id` into the gRPC context
5. If not found (and auth is required), return `codes.Unauthenticated`

```go
type contextKey string
const userIDKey contextKey = "user_id"

func UserIDFromContext(ctx context.Context) (uuid.UUID, bool) {
    id, ok := ctx.Value(userIDKey).(uuid.UUID)
    return id, ok
}
```

The interceptor needs access to the store to look up tokens. Pass the store (or a token-lookup interface) to the interceptor constructor.

### 3. Propagate User ID to Store Mutations

**File:** `internal/server/server.go`

In every RPC handler that mutates data, extract user ID from context and pass it to the store:

- `UpdateTask` — pass user ID as the author for change records
- `ClaimTask` — if no explicit assignee, use the authenticated user ID; always use as change author
- `CloseTask` — pass user ID as the change author
- `CreateComment` — use authenticated user ID as the comment author (instead of random UUID)
- `CreateTask` — use authenticated user ID as the creator/reporter

Update store method signatures as needed to accept an `actorID uuid.UUID` parameter, or pass it via context.

### 4. Token Management CLI Commands

Add CLI commands for managing tokens and users:

**`ft user create <name>`** — creates a User record, returns the user ID
- Flags: `--email`

**`ft token create <user-id>`** — generates an API token for a user
- Generates a random token, stores SHA-256 hash, returns the raw token ONCE
- Flags: `--name`, `--expires` (duration)
- IMPORTANT: The raw token is shown only at creation time

**`ft user whoami`** — resolves the current token to user info (calls a new WhoAmI or GetStatus RPC)

**`ft user list`** — lists users

**`ft token list`** — lists tokens (shows name, user, created_at, last_used — never the token value)

**`ft token revoke <token-id>`** — deletes a token

### 5. Backward Compatibility

- **Embedded mode:** When running in embedded mode (no auth), use a "local" user identity. On first embedded startup, auto-create a "local" user and generate a token stored in the config. This is transparent to the user.
- **Server mode without FARMTABLE_TOKEN:** Continue to allow unauthenticated access (for dev), but log a warning. Mutations use uuid.Nil as actor (preserves current behavior).
- **Server mode with FARMTABLE_TOKEN (legacy):** The existing single-token model should still work. On first use, if the token doesn't exist in the API Token table, the admin needs to create a user+token via the CLI. Document this migration path.

### 6. Proto Changes

Check if User/Token RPCs already exist in the proto. If they do, implement the stubs. If not, this work should NOT add new proto definitions — instead:
- Use the existing User RPC stubs if available
- For token management, implement as direct store operations from CLI commands (embedded mode) or admin-only RPCs

### 7. Tests

- Test token creation + lookup (hash round-trip)
- Test auth interceptor rejects invalid token, accepts valid token
- Test user ID propagation: create user+token → authenticate → ClaimTask → verify change record has correct author
- Test embedded mode auto-creates local user
- All existing tests must continue to pass

## Constraints

- Hash tokens with SHA-256 — never store raw tokens
- Do NOT modify the proto unless User/Token RPCs already exist as stubs
- Run `go generate ./internal/store/ent` after schema changes
- `go build ./...` and `go test ./...` must pass
- Rebuild ft binary: `go build -o /workspace/.farmtable/bin/ft ./cmd/ft`
- **Push to origin/main when done:** `git push origin main`
