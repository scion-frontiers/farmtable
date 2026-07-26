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
ft token list --output json | jq '.items[] | {id, name, user_name}'
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
ft user create --type reviewer --name "task-reviewer" --email reviewer@example.com

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

## Known Limitation

The `ft token update` command operates on the local/embedded DB via
`openDirectStore()`. For a server-mode (PostgreSQL) deployment, the operator
must either:
1. Run `ft token update` with `FARMTABLE_DB_PATH` pointed at the production DB
2. Or use the store directly (SQL: `UPDATE api_tokens SET scopes = '...'
   WHERE id = '...'`)
