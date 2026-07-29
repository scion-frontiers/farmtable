# Investigation: Farm Table Collection Data Model & UI Scoping

**Date:** 2026-07-19  
**Investigator:** Investigator agent  
**Brief:** `farmtable-inv-collection`

---

## Summary

**Yes**, Farm Table has a first-class top-level "Collection" construct. Every task belongs to exactly one collection (mandatory foreign key). The deployed Cloud Run dashboard is **scoped to a single collection** — the first one returned by `ListCollections` (which is the auto-created "default" collection, UUID `1e0f02d1-99cd-46bc-a739-bac0fde60710`). There is **no UI element** to pick or switch between collections. The scoping is entirely a frontend runtime behavior (not hardcoded at build time), and the collection ID could be overridden via URL parameter `?collection=<uuid>`, a global JS variable, or localStorage — but none of these are surfaced in the UI.

---

## Question 1: Does the data model have a top-level "collection" construct?

### Answer: **Yes.**

The `Collection` message is a primary entity in the protobuf schema and is fully implemented in the Ent ORM and gRPC service layer.

### Proto definition

**`proto/farmtable.proto:345-371`** — `message Collection`:
```proto
message Collection {
  string id = 1;            // UUID
  string name = 2;          // required, min 1 char
  optional string description = 3;
  Platform platform = 4;    // farmtable, github, linear, jira, asana, beads
  optional string remote_id = 5;
  optional string workspace_id = 6;
  optional string linked_account_id = 7;
  repeated StatusMapping status_mappings = 8;
  repeated CustomFieldDefinition custom_field_definitions = 9;
  google.protobuf.Struct remote_data = 10;
  google.protobuf.Timestamp created_at = 11;
  google.protobuf.Timestamp updated_at = 12;
}
```

The proto doc comment at line 345 says: *"A grouping of tasks representing a project, board, or repository. Each collection maps 1:1 to a single external platform integration."*

### Task → Collection relationship

**`proto/farmtable.proto:303`** — Every `Task` has a required `collection_id` field:
```proto
string collection_id = 14 [(buf.validate.field).string.uuid = true];
```

This is a **required UUID** (no `optional` keyword, validation enforces UUID format). Every task belongs to exactly one collection.

### Ent schema (ORM layer)

**`internal/store/schema/collection.go:10-31`** — Ent `Collection` entity with:
- Fields: `id` (UUID), `name`, `description`, `platform` (enum), `created_at`, `updated_at`
- Edge: `edge.To("tasks", Task.Type)` — one-to-many relationship to tasks

**`internal/store/schema/task.go:39`** — Task has `field.UUID("collection_id", uuid.UUID{})` (required, not optional/nillable).

**`internal/store/schema/task.go:62-65`** — Task edge back to collection:
```go
edge.From("collection", Collection.Type).
    Ref("tasks").
    Field("collection_id").
    Required().
    Unique(),
```

This confirms: each task belongs to exactly one collection (Required + Unique), and a collection has many tasks (1:many).

### gRPC service RPCs

**`proto/farmtable.proto:957-959`** — Three collection RPCs:
- `ListCollections` — returns all collections, filterable by platform
- `GetCollection` — by UUID or name
- `CreateCollection` — creates a built-in backend collection

Many task-related RPCs accept an optional `collection_id` filter (e.g., `ListTasksRequest.collection_id`, `WatchTasksRequest.collection_id`, `GetReadyTasksRequest.collection_id`).

---

## Question 2: Is the deployed UI scoped to one particular collection?

### Answer: **Yes** — the UI defaults to the first collection returned by `ListCollections` and provides no mechanism to switch.

### How the scoping works (frontend source)

**`web/src/gen/grpc-client.ts:274-280`** — `resolveCollectionId()` method:
```typescript
private async resolveCollectionId(): Promise<string> {
    if (this.collectionId) return this.collectionId;
    const response = await this.unary(methods.listCollections, { pageSize: 1 });
    const firstCollection = asArray(response.items)[0];
    this.collectionId = stringField(asRecord(firstCollection).id) || DEFAULT_COLLECTION_ID;
    return this.collectionId;
}
```

If no collection ID was provided at construction time, it calls `ListCollections` with `pageSize: 1`, takes the first result's UUID, and caches it. Fallback: the hardcoded `DEFAULT_COLLECTION_ID = '00000000-0000-0000-0000-000000000001'` (line 23).

**`web/src/gen/grpc-client.ts:310-324`** — `createGrpcFarmTableClient()` factory:
```typescript
const collectionId = params.get('collection')
  ?? globalConfig.FARMTABLE_COLLECTION_ID
  ?? localStorage.getItem('farmtable.collectionId')
  ?? undefined;
```

Collection ID override sources (in priority order):
1. URL query parameter `?collection=<uuid>`
2. Global JS variable `window.FARMTABLE_COLLECTION_ID`
3. localStorage key `farmtable.collectionId`
4. If none: resolved dynamically via `ListCollections` (first result)

**None of these overrides are surfaced in the UI.** The toolbar (`ft-toolbar`) offers Phase filter, Assignee filter, and Kanban/Tree view toggle — no collection selector.

### No collection UI element

Searched all component files in `web/src/components/` for any reference to "collection" — **zero results**. The word "collection" does not appear in any UI component's template, property, or event handler. Confirmed via both source grep and Playwright DOM inspection (see below).

### Live dashboard observation (Playwright evidence)

**Network calls captured:**

1. `POST /farmtable.v1.FarmTableService/ListCollections` → HTTP 200 (gRPC-Web)
   - Request body (proto-encoded): `pageSize: 1`
   
2. `POST /farmtable.v1.FarmTableService/WatchTasks` → HTTP 200 (gRPC-Web)
   - Request body (proto-decoded from binary): `collectionId: "1e0f02d1-99cd-46bc-a739-bac0fde60710"`, `includeInitial: true`

The `WatchTasks` stream is scoped to collection `1e0f02d1-99cd-46bc-a739-bac0fde60710`. This is the "default" collection auto-created by `ensureDefaultCollection()`.

**DOM inspection results:**
- `bodyHasCollection: false` — the word "collection" appears nowhere in the rendered page text
- Zero `<select>`, `<sl-select>`, or ARIA listbox/combobox elements related to collections
- Toolbar contains only: "Farm Table" title, Phase dropdown, Assignee dropdown, Kanban/Tree toggle, dark mode toggle, help button, connection badge

**Visible tasks** (all in the single default collection):
- "Test task from real client" (Triage)
- "foobar" (Triage)
- "smoke-test-1784467180" (Ready)
- "my-new-task" (In Review)

### How the default collection is created

**`internal/cli/connect.go:216-228`** — `ensureDefaultCollection()`:
```go
func ensureDefaultCollection(ctx context.Context, client pb.FarmTableServiceClient) error {
    resp, err := client.ListCollections(ctx, &pb.ListCollectionsRequest{})
    if err != nil { return err }
    if resp.GetTotalCount() > 0 { return nil }
    _, err = client.CreateCollection(ctx, &pb.CreateCollectionRequest{
        Name: "default",
    })
    return err
}
```

This runs on CLI connect (`internal/cli/connect.go:178`) and on dashboard bootstrap (`internal/cli/dashboard.go:95`). It creates a collection named "default" (platform: "farmtable") if none exist.

### Which collection is shown

The deployed Cloud Run instance has a collection named **"default"** with UUID **`1e0f02d1-99cd-46bc-a739-bac0fde60710`**. This was confirmed from the `WatchTasks` gRPC-Web request payload captured by Playwright. All visible tasks belong to this collection.

---

## Artifacts

| Artifact | Path |
|----------|------|
| Dashboard screenshot | `reports/collection-investigation-dashboard.png` |
| Playwright inspection script | `reports/inspect-collection-ui.mjs` |

---

## Confidence

**High confidence** on both answers.

- Question 1 (data model): Definitive. Traced through proto → Ent schema → server implementation. No ambiguity.
- Question 2 (UI scoping): High confidence. Confirmed through both source code analysis and live Playwright observation. The UI is scoped to a single collection with no switcher. The scoping mechanism is well-understood (first-result-from-ListCollections auto-selection in `resolveCollectionId()`).

**Minor nuance:** If someone were to create a second collection and set `?collection=<uuid>` in the URL or `localStorage.setItem('farmtable.collectionId', '<uuid>')`, the dashboard would scope to that collection instead. But this is not discoverable from the UI itself — it requires knowing the implementation detail.
