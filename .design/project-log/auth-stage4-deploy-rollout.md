# Auth Stage 4 Deploy Rollout Procedure

**Date:** 2026-07-26
**Branch:** `auth-stage4-deploy-prep`
**Context:** PR #166 (scope extension) + PR #167 (pre-deploy fixes) are merged.
This documents the token rollout procedure for deploy.

## ⚠️ Before You Start: CLI Commands Are SQLite-Only

Every `ft user` / `ft token` command below (`create`, `list`, `update`,
`revoke`) opens the local embedded SQLite database via `openDirectStore()`.
**None of them talk to a farmtable server**, and they ignore `--server` /
`FARMTABLE_SERVER`.

Against a PostgreSQL/server deployment they fail *silently*, not loudly:
- `ft token list` returns `{"total_count": 0, "items": null}` — looks like
  "nothing to migrate".
- `ft user create` / `ft token create` succeed against a throwaway local SQLite
  file and print a UUID and raw token that do not exist in production.
- `ft token update` reports `TOKEN_NOT_FOUND` after silently creating an empty
  SQLite file at the `FARMTABLE_DB_PATH` path.

For PostgreSQL deployments, use the direct SQL procedure in
**"PostgreSQL Deployments"** below for **all** steps, not just scope updates.
User and token *creation* on Postgres must go through the server's RPC or
dashboard — those operations are out of scope for this runbook's CLI path.

A server-mode RPC for `ft token`/`ft user` commands is tracked as a follow-up
(see GitHub issue).

## Rollout Decision

**Hand-off protocol** is the recommended path (matching the design intent):
- Agents do NOT get `task:close` — they work tasks but don't unilaterally
  decide when work is done.
- A reviewer/orchestrator-typed token (or a human via the dashboard) closes
  work on the agent's behalf.

**Fallback**: For deployments where the hand-off protocol is not yet
operational, operators can temporarily grant `task:close` to specific agent
tokens using the new `ft token update` command.

## Pre-Deploy Checklist (SQLite / Embedded Deployments)

### 1. Token inventory
```bash
# List all tokens and identify agent-typed ones
ft token list --output json | jq '.items[] | {id, name, user_name, scopes}'
```

Reading the output:
- `scopes: [...]` — explicitly scoped; migrate with `--add-scope` /
  `--remove-scope`.
- `scopes: null` — **legacy wildcard: this token currently has FULL ACCESS.**
  It will keep working after deploy (`RequireScope` treats nil as wildcard) but
  must be migrated with `--set-scopes`; `--add-scope` is refused with
  `UNSCOPED_TOKEN`.
- `["*"]` — explicit wildcard; `--remove-scope` is refused with
  `WILDCARD_TOKEN`.

```bash
# Triage the dangerous ones first
ft token list --output json | jq '.items[] | select(.scopes == null) | {id, name, user_name}'

# ft token list caps at 200 rows and has no pagination flag. Confirm you saw everything:
ft token list --output json | jq '{returned: (.items | length), total: .total_count}'
# If returned < total, the inventory is INCOMPLETE — query the DB directly:
#   SELECT id, name, user_id, scopes FROM api_tokens ORDER BY created_at;
```

### 2. For each agent token that needs to keep closing work
```bash
# Option A: Grant task:close directly (temporary bridge)
ft token update <token-id> --add-scope task:close

# Option B: If the token has nil/legacy scopes (UNSCOPED_TOKEN error),
# set the full intended scope set explicitly:
ft token update <token-id> --set-scopes task:read,task:write,task:claim,task:close,collection:read
```

### 3. Create reviewer/orchestrator tokens (for the hand-off protocol)
```bash
# Create a reviewer-typed user (if not already present)
ft user create "task-reviewer" --type reviewer --email reviewer@example.com

# Create a token with lifecycle scopes
ft token create <reviewer-user-id> --name "lifecycle-reviewer"

# MUST verify: an unrecognised --type (e.g. a "reviewr" typo) silently mints a
# WILDCARD token instead of a scoped reviewer token.
ft token list --output json | jq '.items[] | select(.name == "lifecycle-reviewer") | .scopes'
# Expected exactly:
# ["task:read","task:write","task:claim","task:accept","task:close","collection:read"]
# If this prints null or is absent, the user type was not recognised — revoke the
# token, delete the user, and re-create with the exact string "reviewer".
```

### 4. Verify after deploy
```bash
# Confirm agent token scopes
ft token list --output json | jq '.items[] | select(.name == "<agent-token>") | .scopes'

# Test the lifecycle: create task, accept (reviewer), claim (agent),
# update (agent), close (reviewer)
```

## Current State of This Deployment

- **Embedded DB** (`/workspace/.farmtable/farmtable.db`): Single "local" user
  (type AGENT) with 17 tokens, all nil-scoped (legacy wildcard). These tokens
  will NOT break because `RequireScope` treats nil scopes as wildcard.
- **The `ft` CLI binary** has been rebuilt at `/workspace/.farmtable/bin/ft`
  with the `ft token update` command.
- **No production agent tokens require migration for this development
  instance.** If this code is deployed to a production farmtable server with
  real scoped agent tokens, the operator must run the inventory and update
  steps above before or during deploy.

## PostgreSQL Deployments

The `ft` CLI uses `openDirectStore()` which hardcodes the `sqlite3` driver.
It operates on the local SQLite database at `$FARMTABLE_DB_PATH` (default:
`~/.farmtable/farmtable.db`).

**WARNING:** Do NOT set `FARMTABLE_DB_PATH` to a PostgreSQL connection string.
The command will silently create a new empty SQLite file at that path (embedding
the password in the directory name), then report `TOKEN_NOT_FOUND` — the
operator will believe they operated on production when they did not.

### Inventory (replaces step 1)
```sql
SELECT id, name, user_id, scopes FROM api_tokens ORDER BY created_at;
-- NULL or '[]' in the scopes column means LEGACY WILDCARD (full access), not "no access".
```

### Scope updates (replaces step 2)
```sql
-- Verify current scopes first.
-- NULL or [] means LEGACY WILDCARD (full access), not "no access".
SELECT id, name, scopes FROM api_tokens WHERE id = '<token-id>';

-- Update scopes (JSON array format, exactly as ent encodes it).
UPDATE api_tokens SET scopes = '["task:read","task:write","task:claim","task:close","collection:read"]'
WHERE id = '<token-id>';

-- Confirm exactly one row changed and the value round-trips.
SELECT id, name, scopes FROM api_tokens WHERE id = '<token-id>';
```

**This path bypasses the `ft token update` guard rails. In particular:**
- **NEVER** write `'[]'` or `NULL` — an empty scope set is interpreted as
  **wildcard (full access)** by `RequireScope`. Use `ft token revoke` semantics
  (delete the row) to disable a token instead.
- Scope strings are **not validated** by SQL. A typo (`task:cl0se`) is stored
  happily and the capability is silently denied at runtime. Valid scopes are
  listed in `internal/server/scopes.go`.
- Changes take effect immediately — `StoreTokenLookup` does not cache, so no
  server restart is required.

### User/token creation (replaces step 3)

User and token creation on PostgreSQL deployments must go through the farmtable
server's gRPC API or the web dashboard. The `ft user create` and `ft token
create` CLI commands cannot reach the production database.

A server-mode RPC for token/user CLI management is tracked as a follow-up.
