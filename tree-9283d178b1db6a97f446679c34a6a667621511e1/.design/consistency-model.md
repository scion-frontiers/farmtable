# Farm Table — Consistency Model

**Date:** 2026-05-03
**Status:** Draft proposal — pending product review
**Context:** Q4 from discussion-log.md. Farm Table is not a sync product, but agents reading/writing to external platforms face stale-read risks when humans update tasks directly in the source platform.

---

## 1. Problem Statement

Farm Table proxies task operations to external platforms (GitHub, Jira, Linear, Asana) and also operates a built-in backend. Two consistency challenges arise:

1. **Stale reads**: An agent fetches a task, works for 10 minutes, then updates it. A human may have changed the task's status, assignee, or description in the source platform during that window.
2. **Concurrent writes**: Two agents (or an agent and a human) update the same task at roughly the same time. Without coordination, the last write silently wins.

The built-in backend can enforce strong consistency (it owns the data). External platforms cannot — Farm Table is a client, not the source of truth.

---

## 2. Design Principles

- **Optimistic concurrency, not locking.** Task operations happen at human timescales (minutes to hours). Pessimistic locks would add complexity, introduce lock-leak risks, and provide marginal benefit at this frequency.
- **Detect conflicts, don't prevent them.** The goal is to surface when an agent's write was based on stale state, not to guarantee serializable transactions across platforms.
- **Built-in backend gets stronger guarantees.** External platforms get best-effort conflict detection bounded by what their APIs support.
- **Fail loud, not silent.** When a conflict is detected, the operation fails with a clear error (exit code 5 / CONFLICT). The agent can re-fetch and retry.

---

## 3. Mechanism: Version Tokens

### 3.1 The `version` field

Add a `string version = 27;` field to the Task message. This is an opaque token representing the task's state at read time.

- **Built-in backend:** The version is a monotonically increasing integer (stored as string). Every write increments it. Conditional updates compare the supplied version against the stored version — mismatch → CONFLICT.
- **External platforms:** The version is derived from the platform's own concurrency primitive where available:
  - **GitHub Issues:** `updated_at` timestamp (GitHub returns 409 if `If-Match` / `If-Unmodified-Since` headers conflict, but this is limited — fallback to `updated_at` comparison).
  - **Jira:** ETag from Jira's REST API response headers, or the `update` sequence number.
  - **Linear:** `updatedAt` timestamp.
  - **Asana:** No native concurrency primitive. Version is a hash of key fields at read time.
  - **Beads:** TBD — depends on API capabilities.
- **Platforms without native concurrency control (Asana):** Farm Table computes a version hash from the task's mutable fields (status, assignee, title, description). Before writing, it re-fetches the task and compares the current hash to the version token. If they differ, the write is rejected with CONFLICT.

### 3.2 Conditional updates

`UpdateTaskRequest` gains an optional `string version = 41;` field.

Behavior:
- **If `version` is provided:** The server compares it to the current task version. Mismatch → error with code CONFLICT (gRPC `ABORTED`, HTTP 409). Response includes the current task state so the agent can inspect and retry.
- **If `version` is omitted:** The update proceeds unconditionally (last-write-wins). This preserves backward compatibility and supports fire-and-forget use cases.

The same pattern applies to `ClaimTaskRequest` (add `optional string version = 4;`) and `CloseTaskRequest` (add `optional string version = 5;`).

### 3.3 CLI integration

- `ft task get` and `ft task list` responses include the `version` field in JSON output.
- `ft task update` gains `--version <token>` flag. When supplied, the update is conditional.
- `ft task claim` and `ft task close` gain the same `--version` flag.
- Exit code 5 (CONFLICT) is already defined in the CLI design for claim conflicts. Extend it to cover version conflicts on update/close.

---

## 4. Staleness Management

### 4.1 Freshness window

When Farm Table serves a task that was fetched from an external platform, it may cache the result briefly to reduce API call volume. The task response includes a `google.protobuf.Timestamp fetched_at` (or similar metadata) indicating when the data was last read from the source platform.

**Decision needed:** Should `fetched_at` be a field on the Task message, or response-level metadata (gRPC trailing metadata / HTTP header)?

**Recommendation:** Response-level metadata. It's transport concern, not domain data. The Task message stays clean. The CLI can surface it in `--verbose` output.

### 4.2 Re-fetch before write (server-side)

For external platforms, the server re-fetches the task from the source platform before applying a conditional update. This ensures the version comparison uses current state, not a cached snapshot.

Flow for conditional `UpdateTask` on an external platform:
1. Agent sends `UpdateTask` with `version = "v_read"`.
2. Server re-fetches task from the external platform → computes `v_current`.
3. If `v_read != v_current` → return CONFLICT with the current task state.
4. If `v_read == v_current` → apply the update to the external platform.
5. If the external platform rejects the write (e.g., GitHub 409) → return CONFLICT.
6. If the external platform accepts → return updated task with new version.

**Note:** There is a TOCTOU window between steps 2 and 4. This is acceptable: the window is typically <100ms (one API round-trip), and the risk is mitigated by the external platform's own conflict detection (step 5) where available.

### 4.3 Built-in backend: no staleness concern

The built-in backend is the source of truth. Reads are always fresh. Conditional updates use database-level compare-and-swap (e.g., `UPDATE ... WHERE version = $expected RETURNING *`).

---

## 5. Change Audit Trail Integration

Every mutation already produces a Change record (per the proto's `Change` message and `ListChanges` RPC). When a conflict is detected and the agent retries:

- The failed attempt is **not** recorded as a Change (no mutation occurred).
- The successful retry is recorded normally.
- The Change record includes the `reason` field from the request, allowing agents to document retry context.

No changes needed to the Change model.

---

## 6. Proto Impact

### New fields required:

```protobuf
// In Task message:
string version = 27;  // Opaque concurrency token

// In UpdateTaskRequest:
optional string version = 41;  // Conditional update

// In ClaimTaskRequest:
optional string version = 4;  // Conditional claim

// In CloseTaskRequest:
optional string version = 5;  // Conditional close
```

### Error response enhancement:

When returning CONFLICT, the error details should include the current Task state. In gRPC, this maps to `google.rpc.Status` with an `errdetails.ErrorInfo` or a custom detail message containing the conflicting task. The CLI extracts this from the error response and prints the current task state on stderr.

---

## 7. Agent Workflow Example

```bash
# Fetch task with version
TASK=$(ft task get TASK-42)
VERSION=$(echo "$TASK" | jq -r '.version')

# ... agent works for 10 minutes ...

# Conditional update — will fail if someone else changed the task
ft task update TASK-42 --stage in_review --version "$VERSION" --reason "Code review ready"

# If exit code 5 (CONFLICT):
#   Re-fetch, inspect changes, decide whether to retry or abort
if [ $? -eq 5 ]; then
  TASK=$(ft task get TASK-42)
  # Agent inspects what changed and decides next action
fi
```

---

## 8. What This Model Does NOT Cover (Deferred)

- **Active drift detection / webhooks:** Proactively detecting when a task changes in an external platform without Farm Table initiating a read. Requires webhook ingestion from each platform. Deferred to post-launch.
- **Conflict resolution policies:** Automatic merge of non-conflicting field changes (e.g., agent changed description, human changed assignee). For now, any version mismatch is a full CONFLICT. Field-level merging is a future enhancement.
- **Distributed locks / pessimistic concurrency:** Not needed at task-assignment timescales.
- **Cross-task transactional consistency:** Updating task A and task B atomically. Each operation is independent.

---

## 9. Summary

| Aspect | Built-in backend | External platforms |
|---|---|---|
| Version token source | Monotonic integer | Platform-native (ETag, updatedAt) or computed hash |
| Conditional update | Database CAS | Re-fetch + compare + platform write |
| TOCTOU window | None (single DB transaction) | ~100ms (one API round-trip) |
| Unconditional update | Supported (omit version) | Supported (last-write-wins) |
| Conflict signal | gRPC ABORTED / HTTP 409 / exit code 5 | Same |
| Staleness | N/A (source of truth) | Bounded by re-fetch-before-write |

The model is opt-in (version field is optional on mutating requests), backward-compatible, and provides meaningful conflict detection without imposing distributed locking overhead.
