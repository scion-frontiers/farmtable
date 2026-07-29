# A3: Add remote_data JSON field to Collection schema

**Date:** 2026-07-21
**Status:** Complete
**Commit:** feat: add remote_data JSON field to Collection schema

## Summary

Added an optional `remote_data` JSON field to the Collection entity, mirroring
the existing pattern on the Task entity. This field stores arbitrary
platform-specific metadata for collections synced from external sources (GitHub,
Linear, Jira, etc.).

## Changes

### Schema (`internal/store/schema/collection.go`)
- Added `field.JSON("remote_data", map[string]any{}).Optional()` to `Fields()`

### Generated Ent code (`internal/store/ent/`)
- Ran `go generate ./internal/store/ent` — updated collection model, create/update
  builders, migration schema, mutation, runtime, and where predicates

### Store layer (`internal/store/store.go`)
- Added `RemoteData map[string]any` to `CreateCollectionParams`
- Added `RemoteData map[string]any` to `UpdateCollectionParams`
- Added `RemoteData map[string]any` to `ImportCollection`

### Store implementation (`internal/store/entstore.go`)
- `CreateCollection`: persists `RemoteData` when non-nil
- `UpdateCollection`: merge-on-update semantics — reads existing `RemoteData`,
  merges new keys on top (same pattern as Task)
- `ImportCollection`: persists `RemoteData` when non-nil during import

### Proto conversion (`internal/server/convert.go`)
- `collectionToProto`: converts `RemoteData` to `structpb.Struct` for the
  `remote_data` proto field (field 10 on the Collection message)

### Export/Import (`internal/server/export_import.go`)
- Added `RemoteData` to `exportCollection` struct (JSON-serialized with `omitempty`)
- Wired `RemoteData` through export construction and import params

## Verification

- `go build ./...` — passes
- `go test ./...` — all tests pass

## Design Decisions

- **Merge-on-update**: Follows the Task pattern where update merges new keys into
  existing remote_data rather than replacing it wholesale. This prevents
  accidental data loss when only a subset of keys is updated.
- **Proto request messages**: `CreateCollectionRequest` and
  `UpdateCollectionRequest` do not yet include `remote_data` fields in the proto
  definition. The store layer is ready; proto request changes can be added when
  the API surface is extended.
