# CLI ft collection link/unlink Commands (A7)

**Date:** 2026-07-21
**Branch:** feat/extstore-a7-cli-link-unlink
**Task:** A7 - CLI ft collection link/unlink Commands

## Summary

Added three new CLI subcommands under `ft collection` for managing linked
external platform accounts: `link`, `unlink`, and `links`. These commands
call the LinkedAccount gRPC RPCs implemented in A5/PR #95.

## Changes

### `internal/cli/link.go` (new file)
- **`ft collection link <platform>`**: Links an external platform account to a
  collection by calling `CreateLinkedAccount` RPC.
  - Flags: `--collection`, `--token`, `--repo`
  - Token resolution order: `--token` flag > `FARMTABLE_LINK_TOKEN` env var >
    stdin (for piping from secret managers)
  - Automatically infers `auth_method` from platform (e.g., GitHub -> PAT,
    Linear/Jira -> API_KEY)
  - Automatically infers default scopes per platform (e.g., GitHub gets
    `repo`, `read:org`)
  - `--repo` maps to `remote_user_id` field for repository targeting

- **`ft collection unlink`**: Removes a linked account by calling
  `DeleteLinkedAccount` RPC.
  - Flags: `--collection`, `--account`
  - If `--account` is provided, deletes that specific linked account directly
  - If only `--collection` is provided, lists linked accounts and deletes if
    exactly one exists; shows disambiguation if multiple found

- **`ft collection links`**: Lists linked accounts by calling
  `ListLinkedAccounts` RPC.
  - Flags: `--collection`, `--platform`
  - Supports all output formats: json (default), quiet, jsonl, table

- Helper functions:
  - `resolveLinkToken()`: three-tier token resolution (flag > env > stdin)
  - `isTerminal()`: detects whether stdin is a tty for safe stdin reading
  - `inferAuthMethod()`: platform-specific auth method defaults
  - `inferScopes()`: platform-specific default scope sets
  - `linkedAccountToMap()`: proto-to-map conversion for JSON output
  - `printLinkedAccountTable()`: tabular display for linked accounts
  - Enum display maps: `linkedAccountStatusNames`, `authMethodNames`

### `internal/cli/collection.go`
- Wired `newCollectionLinkCmd`, `newCollectionUnlinkCmd`, and
  `newCollectionLinksCmd` into the collection command group.

### `internal/cli/link_test.go` (new file)
- Unit tests for:
  - `resolveLinkToken`: flag precedence, env var fallback, empty case
  - `inferAuthMethod`: per-platform defaults (GitHub, Linear, Jira, Asana,
    Farmtable)
  - `inferScopes`: GitHub scopes, empty scopes for others
  - `linkedAccountToMap`: proto-to-map field mapping
  - `isTerminal`: pipe detection
  - `linkedAccountStatusNames` and `authMethodNames` coverage

## Design Decisions

1. **Separate file (`link.go`)**: Keeps the collection.go file from growing
   too large and groups all linked-account CLI logic together.

2. **Token via stdin**: Supports `echo $SECRET | ft collection link github ...`
   pattern common with secret managers (Vault, 1Password CLI, etc.) by
   detecting non-terminal stdin.

3. **Smart unlink**: When only a collection is specified and it has exactly one
   linked account, deletes it directly. When multiple exist, prints them and
   asks the user to specify `--account`.

4. **Platform-aware defaults**: The `inferAuthMethod` and `inferScopes`
   functions reduce boilerplate for common cases (GitHub PAT, etc.) while
   the proto layer remains flexible.

## Verification

- `go build ./...` passes
- `go vet ./internal/cli/` passes
- `go test ./internal/cli/` passes (all 7 new test functions)
