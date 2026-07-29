# Investigation: Farm Table Comment Data Model

**Date:** 2026-07-19  
**Investigator:** Investigator agent  
**Brief:** `farmtable-inv-comments`

---

## Summary

**Comments are a linked record (separate entity/table), not embedded within Task.** The `Comment` message is a standalone proto message with its own `id` and a `task_id` foreign key. In the Ent ORM, `Comment` is a separate schema/table with an FK-backed edge to `Task`. The relationship is **many-to-one**: many comments belong to exactly one task. Comments also reference an author via `author_id` (FK to `User`), though this is a bare FK field without a full Ent edge. Comments are accessed through dedicated RPCs (`AddComment`, `ListComments`, `GetComment`) and can optionally be inlined in `GetTask` responses via `include_comments`.

---

## Direct Answer

**Linked record.** Comments are a first-class separate entity — not a repeated field embedded on Task.

---

## Evidence: Proto Layer

### `message Comment` — standalone message

**`proto/farmtable.proto:375-391`**:
```proto
message Comment {
  string id = 1;              // own UUID primary key
  string task_id = 2;         // FK to Task (UUID, required)
  User author = 3;            // required author reference
  string body = 4;            // required, min 1 char
  repeated Attachment attachments = 5;
  google.protobuf.Timestamp created_at = 6;
  google.protobuf.Timestamp updated_at = 7;
  optional string remote_id = 8;
}
```

Key observations:
- Comment has its own `id` (field 1) — it is an independently addressable entity, not a sub-message.
- `task_id` (field 2) is a required UUID FK linking back to a Task.
- `author` (field 3) is a required `User` reference.

### `message Task` — no embedded comments

**`proto/farmtable.proto:272-341`**: The `Task` message has **no** `repeated Comment` field. Comments are not inlined on the Task proto message.

### Dedicated Comment RPCs

**`proto/farmtable.proto:954-956`**:
```proto
rpc AddComment(AddCommentRequest) returns (Comment);
rpc ListComments(ListCommentsRequest) returns (ListCommentsResponse);
rpc GetComment(GetCommentRequest) returns (Comment);
```

These are separate service methods, not sub-resources of a Task RPC.

### Optional inline via `GetTask`

**`proto/farmtable.proto:492-494`** — `GetTaskRequest` has `bool include_comments = 2;`, and `GetTaskResponse` (line 498-504) has `repeated Comment comments = 2;`. This is a convenience join, not embedded storage — the comments are still fetched from the separate Comment store (confirmed in server code at `server.go:276-285`).

### `ListCommentsRequest` scoped by task_id

**`proto/farmtable.proto:650-655`**:
```proto
message ListCommentsRequest {
  string task_id = 1;   // required — comments are always fetched per-task
  int32 page_size = 2;
  string page_token = 3;
  SortOrder order = 4;
}
```

---

## Evidence: Ent Schema (ORM/Storage Layer)

### `Comment` schema — separate table with FK edge to Task

**`internal/store/schema/comment.go:11-40`**:
```go
type Comment struct { ent.Schema }

func (Comment) Fields() []ent.Field {
    return []ent.Field{
        field.UUID("id", uuid.UUID{}).Default(uuid.New),
        field.UUID("task_id", uuid.UUID{}),       // FK column
        field.UUID("author_id", uuid.UUID{}),     // FK column
        field.String("body").NotEmpty(),
        field.Time("created_at").Default(timeNow).Immutable(),
        field.Time("updated_at").Default(timeNow).UpdateDefault(timeNow),
    }
}

func (Comment) Edges() []ent.Edge {
    return []ent.Edge{
        edge.From("task", Task.Type).
            Ref("comments").          // back-ref to Task.comments edge
            Field("task_id").         // FK column
            Required().               // task_id is NOT NULL
            Unique(),                 // each comment belongs to exactly one task
    }
}

func (Comment) Indexes() []ent.Index {
    return []ent.Index{
        index.Fields("task_id"),      // indexed for efficient per-task queries
    }
}
```

### `Task` schema — forward edge to comments

**`internal/store/schema/task.go:71`**:
```go
edge.To("comments", Comment.Type),
```

This is the one-to-many forward edge from Task → Comment. Combined with Comment's `Required().Unique()` back-edge, this confirms a strict **1:many** relationship.

### Author reference — bare FK, no Ent edge

**`internal/store/schema/comment.go:19`**: `field.UUID("author_id", uuid.UUID{})` — this is a plain FK column referencing the User table. There is **no** Ent edge defined from Comment to User (and no back-edge from User to Comment — confirmed at `internal/store/schema/user.go:27-31`). The join is done manually in the conversion layer.

**`internal/server/convert.go:384`**: `Author: &pb.User{Id: c.AuthorID.String()}` — only the author's UUID is populated; no eager-loading of the full User record.

---

## Relationship Cardinality

| Relationship | Type | Enforced by |
|---|---|---|
| Task → Comments | 1:many | Ent edge `Task.comments` (forward) + Comment back-edge with `Required().Unique()` |
| Comment → Task | many:1 | `comment.task_id` FK (required, NOT NULL) + DB index |
| Comment → User (author) | many:1 | `comment.author_id` FK (required UUID field, no Ent edge) |

- A comment belongs to **exactly one** task (required FK, unique back-edge).
- A task can have **zero or more** comments.
- A comment has **exactly one** author (`author_id` is a required UUID, not optional/nillable).
- Comments do **not** link to any other entities beyond Task and User (author). There is no link to Collection, LinkedAccount, etc. — those are reached indirectly through the Task.

---

## Confidence

**High confidence.** The answer is unambiguous across all three layers (proto definition, Ent schema, server implementation). Comment is definitively a separate linked entity with its own table, its own UUID primary key, and FK relationships to Task (required) and User/author (required). It is not embedded as a repeated field on Task.
