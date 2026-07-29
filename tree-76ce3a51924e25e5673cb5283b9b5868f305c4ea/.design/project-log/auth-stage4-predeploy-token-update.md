# Pre-Deploy: `ft token update` Command for Scope Modification

**Date:** 2026-07-26
**Branch:** `auth-stage4-predeploy-fixes`
**Builds on:** `auth-stage4-scope-extension.md`

## Problem

PR #166 added `task:accept` and `task:close` scopes that are intentionally
excluded from the default `agent` scope set. All existing agent tokens carry
persisted scopes that predate these new scopes — they break at deploy time
because `CloseTask` now requires `task:close` and the stored scopes don't
include it. There was no mechanism to modify scopes on existing tokens.

## Solution

Added `ft token update <token-id>` CLI command with scope modification flags:

```bash
# Add a scope to an existing token
ft token update <id> --add-scope task:close

# Remove a scope
ft token update <id> --remove-scope task:write

# Combine add and remove
ft token update <id> --add-scope task:accept --add-scope task:close --remove-scope task:write

# Replace all scopes at once
ft token update <id> --set-scopes task:read,task:write,task:claim,task:close
```

## Rollout strategy for existing agent tokens

The design intentionally excludes `task:close` from agent defaults — agents
should not unilaterally decide when work is done. Two rollout paths:

1. **Hand-off protocol (recommended):** A reviewer/orchestrator-typed token
   (which has both `task:accept` and `task:close`) closes work on the agent's
   behalf. Create one with `ft token create <user-id> --scope task:read
   --scope task:write --scope task:claim --scope task:accept --scope task:close
   --scope collection:read` or use `DefaultScopesForUserType("reviewer")`.

2. **Re-provision with close:** For deployments where the hand-off protocol is
   not yet implemented, operators can temporarily grant `task:close` to
   specific agent tokens:
   ```bash
   ft token update <agent-token-id> --add-scope task:close
   ```

## Changes

- `internal/store/store.go` — added `GetAPIToken` and `UpdateAPITokenScopes`
  to the `Store` interface
- `internal/store/entstore.go` — implemented both methods using Ent's
  `ApiToken.UpdateOneID().SetScopes()` builder
- `internal/store/multistore.go` — delegation to primary store
- `internal/platform/github/passthrough.go` — `ErrNotImplemented` stubs
- `internal/cli/token.go` — `ft token update` command with `--add-scope`,
  `--remove-scope`, and `--set-scopes` flags; validates via
  `server.ValidateScopes` before writing
