# Auth Stage 4 Deploy Rollout Procedure

**Date:** 2026-07-26
**Branch:** `auth-stage4-deploy-prep`
**Context:** PR #166 (scope extension) + PR #167 (pre-deploy fixes) are merged.
This documents the token rollout procedure for deploy.

## Rollout Decision

**Hand-off protocol** is the recommended path (matching the design intent):
- Agents do NOT get `task:close` — they work tasks but don't unilaterally
  decide when work is done.
- A reviewer/orchestrator-typed token (or a human via the dashboard) closes
  work on the agent's behalf.

**Fallback**: For deployments where the hand-off protocol is not yet
operational, operators can temporarily grant `task:close` to specific agent
tokens using the new `ft token update` command.

## Pre-Deploy Checklist

### 1. Token inventory
```bash
# List all tokens and identify agent-typed ones
ft token list --output json | jq '.items[] | {id, name, user_name, scopes}'
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
# The reviewer type automatically gets: task:read, task:write, task:claim,
# task:accept, task:close, collection:read
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

## Known Limitation: SQLite Only

The `ft token update` command uses `openDirectStore()` which hardcodes the
`sqlite3` driver. It operates on the local SQLite database at
`$FARMTABLE_DB_PATH` (default: `~/.farmtable/farmtable.db`).

**WARNING:** Do NOT set `FARMTABLE_DB_PATH` to a PostgreSQL connection string.
The command will silently create a new empty SQLite file at that path, then
report `TOKEN_NOT_FOUND` — the operator will believe they operated on production
when they did not.

For PostgreSQL-backed deployments, update token scopes directly:
```sql
-- Verify current scopes first
SELECT id, name, scopes FROM api_tokens WHERE id = '<token-id>';

-- Update scopes (JSON array format)
UPDATE api_tokens SET scopes = '["task:read","task:write","task:claim","task:close","collection:read"]'
WHERE id = '<token-id>';
```

A server-mode RPC for token scope updates is tracked as a follow-up.
