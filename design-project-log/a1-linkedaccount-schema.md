# A1: LinkedAccount Ent Schema

**Date:** 2026-07-21
**Agent:** A1
**Branch:** `feat/extstore-a1-linkedaccount-schema`
**Commit:** `d957cdf`

## Summary

Created the `LinkedAccount` Ent schema at `internal/store/schema/linkedaccount.go` and added a one-to-many edge from `Collection` to `LinkedAccount`.

## Schema Fields

| Field            | Type                                      | Modifiers                    |
|------------------|-------------------------------------------|------------------------------|
| `id`             | `UUID`                                    | Default `uuid.New`           |
| `collection_id`  | `UUID`                                    | FK to Collection             |
| `platform`       | `Enum(github,linear,jira,asana,beads)`    | Required                     |
| `auth_token`     | `String`                                  | Sensitive                    |
| `auth_method`    | `Enum(pat,oauth,github_app)`              | Required                     |
| `scopes`         | `JSON []string`                           | Optional                     |
| `remote_user_id` | `String`                                  | Optional, Default `""`       |
| `status`         | `Enum(active,expired,revoked)`            | Default `active`             |
| `created_at`     | `Time`                                    | Default `timeNow`, Immutable |
| `expires_at`     | `Time`                                    | Optional, Nillable           |

## Edges

- `LinkedAccount` -> `Collection` (many-to-one via `collection_id`, required)
- `Collection` -> `LinkedAccount` (one-to-many, named `linked_accounts`)

## Verification

- `go generate ./internal/store/ent` — succeeded, generated 7 new files
- `go build ./...` — passed
- `go test ./...` — all tests pass

## Files Changed

- **New:** `internal/store/schema/linkedaccount.go`
- **Modified:** `internal/store/schema/collection.go` (added `linked_accounts` edge)
- **Generated:** 7 new files + 13 modified files under `internal/store/ent/`
