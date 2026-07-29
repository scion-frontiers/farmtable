# Export/Import Phase A Investigation

## 1. Bulk-query store methods

- No dedicated unpaginated bulk export methods currently exist in `internal/store/store.go` for all tasks/comments/changes/relationships in a collection.
- The `Store` interface exposes paginated-style list methods:
  - `ListTasks(ctx, ListTasksParams) ([]*ent.Task, int, error)` with `Limit`, `LastID`, and `LastSortValue` in `ListTasksParams` (`internal/store/store.go:100-115`, `internal/store/store.go:160`).
  - `ListComments(ctx, ListCommentsParams) ([]*ent.Comment, int, error)` with `Limit`, `LastID`, and `LastSortValue` (`internal/store/store.go:141-146`, `internal/store/store.go:171`).
  - `ListChanges(ctx, ListChangesParams) ([]*ent.Change, int, error)` with `Limit`, `LastID`, and `LastSortValue` (`internal/store/store.go:148-154`, `internal/store/store.go:172`).
  - `ListCollections(ctx, ListCollectionsParams) ([]*ent.Collection, int, error)` with cursor fields (`internal/store/store.go:128-133`, `internal/store/store.go:168`).
- The Ent implementations apply keyset cursor filtering when `LastID` is present and apply `Limit` only when `Limit > 0`; technically a caller can omit `Limit` and get all matching rows for tasks/comments/changes/collections, but the interface is still the paginated list API and returns total count (`internal/store/entstore.go:370-485`, `internal/store/entstore.go:915-938`, `internal/store/entstore.go:964-985`, `internal/store/entstore.go:1430-1454`).
- There is no `ListRelationships` method in the `Store` interface. Relationships are currently accessed through task edges loaded by `ListTasks`/graph queries or created internally during task creation/update (`internal/store/store.go:156-189`, `internal/store/entstore.go:464`, `internal/store/entstore.go:171-196`, `internal/store/entstore.go:640-672`).

## 2. Transactional creation support

- `CreateTask` already starts an Ent transaction with `s.client.Tx(ctx)`, uses `tx.Task.Create()` and `tx.Relationship.Create()` for task plus relationship creation, defers rollback, commits at the end, then reloads the task with edges (`internal/store/entstore.go:106-205`).
- Ent-generated transactional support is available for all entity types needed by import. `ent.Tx` has clients for `Collection`, `Task`, `Comment`, `Relationship`, `Change`, and `User` (`internal/store/ent/tx.go:12-28`).
- The schemas define all required entities and fields:
  - `Collection`: UUID id, name, description, platform, created/updated timestamps (`internal/store/schema/collection.go:14-24`).
  - `Task`: UUID id, collection/assignee/parent IDs, phase/stage/type/priority, dates, labels, remote data, repo/branch, CI/pull request fields, version (`internal/store/schema/task.go:47-88`).
  - `Comment`: UUID id, task_id, author_id, body, created/updated timestamps (`internal/store/schema/comment.go:133-141`).
  - `Relationship`: UUID id, source_task_id, target_task_id, type, unique `(source_task_id,target_task_id,type)` index (`internal/store/schema/relationship.go:173-203`).
  - `Change`: UUID id, task_id, author_id, field_name, old/new values, created timestamp (`internal/store/schema/change.go:219-228`).
  - `User`: UUID id, email, display_name, type, status, platform_id, created/updated timestamps (`internal/store/schema/user.go:259-270`).
- Generated create builders expose `SetID` for all required entities and timestamp setters where those fields exist, so transactional import can create rows with either generated or explicit remapped UUIDs and preserved timestamps as needed (`internal/store/ent/collection_create.go:59-88`, `internal/store/ent/task_create.go:180-311`, `internal/store/ent/comment_create.go:43-72`, `internal/store/ent/relationship_create.go:24-43`, `internal/store/ent/change_create.go:71-86`, `internal/store/ent/user_create.go:87-116`).
- Current public store creation methods are not sufficient for import as-is because they do not expose caller-controlled IDs/timestamps for all entities, and there are no public create methods for `Relationship` or `Change`. Import should add a transaction-oriented store method rather than trying to compose existing public methods.
- User resolution by email is not currently supported directly. The store has `GetUserByName` and `ListUsers` can filter only by `Type`; no `GetUserByEmail` or email filter exists (`internal/store/store.go:177-180`, `internal/store/store.go:238-243`, `internal/store/entstore.go:1202-1237`). Ent predicates do support `user.EmailEQ`, so adding an email lookup is straightforward.

## 3. gRPC max message size

- The production gRPC server in `cmd/farmtable-server/main.go` calls `grpc.NewServer` with token auth interceptors only; it does not configure `grpc.MaxRecvMsgSize` or `grpc.MaxSendMsgSize` (`cmd/farmtable-server/main.go:53-56`).
- Embedded/dashboard servers and test servers also use `grpc.NewServer` without max message size options (`internal/cli/dashboard.go:75-78`, `internal/cli/connect.go:155-158`, `internal/testutil/testserver.go:21-23`).
- Client dialing currently uses `grpc.NewClient` without `grpc.WithDefaultCallOptions(grpc.MaxCallRecvMsgSize(...), grpc.MaxCallSendMsgSize(...))` (`internal/cli/connect.go:93-100`).
- There are no current occurrences of `MaxRecvMsgSize`, `MaxSendMsgSize`, `MaxCallRecvMsgSize`, or `MaxCallSendMsgSize` in the repo. The implementation currently uses gRPC defaults, which means the default 4 MB inbound receive limit remains in effect unless raised.

## 4. Proto structure

- The `Collection` data model message is in the entity/message section at `proto/farmtable.proto:345-371`.
- Collection RPC request/response messages are grouped later under `// Collection RPC Messages` at `proto/farmtable.proto:672-699`. The new `ExportCollectionRequest`, `ExportCollectionResponse`, `ImportCollectionRequest`, `ImportCollectionResponse`, and `ImportStats` messages should fit in this same section after `UpdateCollectionRequest` and before `Graph Query RPC Messages`.
- `FarmTableService` begins at `proto/farmtable.proto:937`. Existing collection RPCs are grouped under `// ── Collections ──` at `proto/farmtable.proto:958-965`. The new `ExportCollection` and `ImportCollection` RPCs should be added there after `UpdateCollection`.
- Proto generation is driven by `buf generate` per `Makefile:4` and `buf.gen.yaml`. Ent generation is separate (`go generate ./internal/store/ent` in `CLAUDE.md`) and not needed for proto-only changes unless Ent schemas are changed.

## 5. Store interface pattern

- The standard pattern is `Method(ctx context.Context, p SomeParams) (..., error)` for create/list operations and `Method(ctx context.Context, id uuid.UUID, p SomeParams, ...)` for update/action operations (`internal/store/store.go:156-180`).
- Parameter structs live in `internal/store/store.go` near the interface. Examples include `CreateTaskParams`, `UpdateTaskParams`, `ListTasksParams`, `CreateCollectionParams`, `ListCollectionsParams`, `AddCommentParams`, `ListCommentsParams`, `ListChangesParams`, `CreateUserParams`, and `ListUsersParams` (`internal/store/store.go:23-154`, `internal/store/store.go:231-243`).
- List methods consistently return `([]*ent.X, int, error)` where the `int` is total count, even when the caller may choose not to set a limit. Cursor pagination is represented by `Limit`, `LastID`, and `LastSortValue`.
- For Phase A, new bulk export methods can either follow a narrower `ListAll...(...uuid.UUID) ([]*ent.X, error)` style requested by the task or preserve the param-object pattern. The existing interface strongly favors param structs for anything with optional filters.

## 6. CLI pattern

- Collection subcommands are registered by `newCollectionCmd`, which creates the top-level `collection` command and calls `cmd.AddCommand(newCollectionListCmd(globals), newCollectionGetCmd(globals), newCollectionCreateCmd(globals))` (`internal/cli/collection.go:11-20`).
- Each collection subcommand follows the same structure:
  - Resolve token/output with `resolveToken(globals.token)` and `resolveOutput(globals.output)`.
  - Open a client with `newClient(globals)` and defer `closer.Close()`.
  - Build an auth context with `authCtx(context.Background(), token)`.
  - Call the gRPC client.
  - Use `handleGRPCError(err)` on RPC failure.
  - Respect output modes such as `quiet`, `jsonl`, `table`, or JSON/list helpers (`internal/cli/collection.go:30-73`, `internal/cli/collection.go:86-109`, `internal/cli/collection.go:121-145`).
- `readInputValue` in `internal/cli/input.go` supports `-` for stdin and `@file` for file content, otherwise returning the literal input (`internal/cli/input.go:10-25`). For `ft collection import <file>`, the exact design says the positional file can be a path, `-`, or `@file`; because `readInputValue` only reads file content for `@file`, a plain path will need either direct `os.ReadFile(path)` handling or an extension to the helper usage.

