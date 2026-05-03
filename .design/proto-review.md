# Farm Table — Protobuf Schema Review

**Date:** 2026-05-03
**Scope:** Review of `farmtable.proto` against CLI design (`cli-design.md`), schema v0.3.0 (`DRAFT-schema.json`), and product decisions (`discussion-log.md`).

---

## 1. Strengths

### All design decisions reflected
Three-tier status (Phase/Stage/native_status), PARENT/CHILD removed from RelationshipType, optional priority, typed CodeContext extension, acceptance_criteria, start_date, closed_at, expanded AuthMethod with GITHUB_APP/ATLASSIAN_CONNECT/LOCAL_PROCESS, 1:1 collection mapping via linked_account_id. Everything from the discussion log and schema v0.3.0 landed correctly.

### Complete CLI-to-RPC mapping
Every `ft` command has a corresponding RPC. Including `GetStatus` from the CLI review's health check recommendation.

### Clean proto3 conventions
All enums have `UNSPECIFIED = 0`. Validation annotations via `buf.validate` throughout. `google.protobuf.Timestamp` for dates, `google.protobuf.Struct` for freeform remote_data, `google.protobuf.Value` for custom field values. Field numbering gaps in UpdateTaskRequest (7→10, 17→20, 24→30, 33→40) are deliberate reservation for future fields.

### UpdateTaskRequest handles clearing correctly
`clear_assignees`, `clear_due_date`, `clear_start_date`, `clear_parent` booleans solve the proto3 problem of distinguishing "not set" from "set to empty/null." Maps well to the CLI's `--assignee none` / `--due-date none` pattern.

### ClaimTask as a first-class RPC
Separate from UpdateTask, with its own request/response. ClaimTaskResponse includes `claimed_at`.

---

## 2. Issues to fix

### 2.1 `code_context` on Task should be `optional`

**Current:** `CodeContext code_context = 19;`
**Should be:** `optional CodeContext code_context = 19;`

Without `optional`, you can't distinguish "no code context" (non-code task) from "empty code context" (code task with no details yet). In Go, a non-optional message field that's empty is still a non-nil pointer to an empty struct.

### 2.2 `creator` on Task should be `optional`

**Current:** `User creator = 11;`
**Should be:** `optional User creator = 11;`

Some externally sourced tasks may not have a known creator. The JSON schema had this as nullable.

### 2.3 `add_pull_request` in UpdateTaskRequest should be repeated

**Current:** `PullRequest add_pull_request = 32;`
**Should be:** `repeated PullRequest add_pull_requests = 32;`

The CLI's `--add-pr` flag is repeatable. An agent linking multiple PRs in one update call shouldn't need N API calls.

### 2.4 `GetReadyTasksRequest` is missing pagination cursor

Has `page_size` but no `page_token`. If there are many ready tasks, you can't page through them. Add `string page_token = 6;`.

### 2.5 `GetBlockedTasksRequest` has no pagination

No `page_size` or `page_token`. Add both:
```
int32 page_size = 3 [(buf.validate.field).int32 = {gte: 1, lte: 200}];
string page_token = 4;
```

Also update `GetBlockedTasksResponse` to include `next_page_token`, `has_more`, `total_count`.

### 2.6 Pagination naming: proto `page_token` vs CLI `--cursor`

The proto follows Google API design guide conventions (`page_token`/`next_page_token`), which is correct. The CLI design should align — either use `--page-token` as the flag name, or keep `--cursor` as a user-facing alias that maps to `page_token` internally. Recommend updating the CLI design to use `--page-token` for consistency.

---

## 3. Missing items to track

### 3.1 HTTP transcoding annotations

Q6 decision was "gRPC with HTTP transcoding." The proto doesn't import `google/api/annotations.proto` or include `option (google.api.http)` on RPCs. Without these, grpc-gateway / Envoy transcoding won't map RPCs to REST endpoints. Can be added in a follow-up pass.

### 3.2 Request ID / tracing metadata

The CLI review recommended request IDs for debugging. In gRPC this is typically handled via metadata headers rather than message fields. Consider adding a server-side interceptor that injects `x-request-id` into response metadata.

---

## 4. Observations (design notes, not bugs)

### Recursive DependencyNode
Valid proto3, but can produce large responses for deep graphs. The `max_depth` on GetDependencyTreeRequest mitigates this. Consider a server-side response size cap.

### CloseTaskRequest.stage accepts any TaskStage
Only `completed`, `wont_fix`, `duplicate`, `cancelled` are valid for closing. Server-side validation handles this, but add a proto comment documenting the constraint.

### Single service definition
All RPCs in `FarmTableService`. Fine for v1. If the service grows significantly, consider splitting into `TaskService`, `GraphService`, `CollectionService`, etc.

---

## 5. Summary

The proto is a strong translation of the design. Items 2.1–2.5 are bugs that should be fixed before code generation. Item 2.6 is a naming alignment task. Items 3.1–3.2 are known gaps to track for follow-up. The core structure — messages, enums, service definition, validation annotations — is solid and ready to drive implementation once the fixes land.
