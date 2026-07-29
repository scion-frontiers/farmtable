# PR Review: feat/f45-beads-import — Beads JSONL Import Support

## Executive Summary

This PR adds Beads JSONL import format support with auto-detection, clean integration into the existing `ImportCollection` pipeline, and corresponding UI updates. **Risk level: Low-Medium** — one correctness bug around default-priority mapping and a couple of minor robustness gaps; the core architecture and test coverage are solid.

**Verdict: REQUEST CHANGES** — one Important issue to fix before merge; the rest are Suggestions.

---

## Critical Issues

None.

---

## Important Issues

### 1. Zero-value `Priority` silently maps to "urgent" for issues missing the field

**File:** `internal/server/beads_import.go:29`

The `beadsIssue.Priority` field is `int` (not `*int`). When a Beads JSONL line omits `"priority"` entirely, `json.Unmarshal` sets it to `0` (Go's zero value for `int`). `beadsPriorityToFarmtable(0)` then returns `"urgent"`.

This means **every imported issue without an explicit priority is silently marked "urgent"**, which is almost certainly wrong — "normal" or nil would be appropriate.

The root cause is that priority `0` is a valid semantic value (urgent) AND the zero-value default, making them indistinguishable.

**Suggested fix:**

```go
// beads_import.go:29
-	Priority           int               `json:"priority"`
+	Priority           *int              `json:"priority"`

// beads_import.go:239 (in convertBeadsToExportDocument)
-	priority := beadsPriorityToFarmtable(issue.Priority)
+	var priority *string
+	if issue.Priority != nil {
+		priority = beadsPriorityToFarmtable(*issue.Priority)
+	}
```

Tests for priority mapping would also need minor updates to pass `*int` values.

---

## Suggestions

### 2. Client-side line count can overcount issues in JSONL preview

**File:** `web/src/components/ft-import-collection-dialog.ts:153-155`

```ts
const lines = text.split('\n').filter((l) => l.trim().length > 0);
const issueCount = lines.length;
```

This counts ALL non-empty lines, including lines with `_type != "issue"` (e.g., metadata records, events). The server-side parser correctly filters these, so the preview could show "12 issues" while the server imports only 10.

Not blocking — the preview is just an estimate — but it could be slightly misleading.

**Suggested improvement:** Parse first-line JSON to detect `_type` and count only lines with `_type == "issue"` or `_type` absent, to match server-side logic more closely. Or label the preview as "~N lines" rather than "N issues".

### 3. Client format detection uses file extension, server uses content heuristics

**File:** `web/src/components/ft-import-collection-dialog.ts:148`

```ts
const isJsonl = file.name.endsWith('.jsonl');
```

The client detects format by file extension, but the server uses `detectImportFormat()` which inspects content. If a user renames a Beads export to `.json`, the client will attempt to `JSON.parse()` it as native format (which will fail on multi-line JSONL), producing an error that doesn't suggest "this looks like a JSONL file."

This is a minor UX gap — the server would handle it correctly if the data reached it. Could be improved with a fallback:

```ts
// If JSON.parse fails and lines look like JSONL, try the JSONL path
```

### 4. Negative priority test coverage gap

**File:** `internal/server/beads_import_test.go`

`TestBeadsPriorityToFarmtable` tests priorities 0-4 but doesn't test negative values (e.g., `-1`). The `default` branch returns `nil` for negatives, which is correct, but a test would document this edge case.

**Suggested addition:**

```go
{-1, ""}, // should return nil
```

With a nil-specific assertion in the test loop.

### 5. `detectImportFormat` could false-positive on minimal JSON objects with a "title" key

**File:** `internal/server/beads_import.go:414-422`

Any single JSON object `{"title": "something"}` without `format_version` is detected as `"beads"`. This is unlikely in practice (native farmtable always has `format_version`), but if someone crafts or corrupts a farmtable export by removing `format_version`, it could be silently re-interpreted as Beads. The heuristic is reasonable; just worth noting as a known limitation.

### 6. `deduplicateRelationships` doesn't normalize direction for `blocks`/`duplicates`

**File:** `internal/server/beads_import.go:445-460`

Directionality normalization is applied only for `relates_to`:

```go
if r.Type == string(relationship.TypeRelatesTo) {
    if r.SourceTaskID > r.TargetTaskID {
        k = relKey{r.TargetTaskID, r.SourceTaskID, r.Type}
    }
}
```

`blocks` and `duplicates` are directional, so this is semantically correct — two `blocks` with different directions are NOT duplicates. However, if both sides of a `blocks` edge emit the same direction (source=blocker, target=blocked) after the swap in `convertBeadsToExportDocument`, they could still duplicate. The current approach handles this fine since the key includes `{source, target, type}` without normalization. Just confirming the logic is sound.

---

## What's Done Well

1. **Clean architecture.** The conversion funnels through the existing `exportDocument` intermediary, reusing the full validation/import pipeline (`validateImportReferences`, `orderImportTasks`, `importedTask`, etc.) without duplicating logic. This is the right pattern.

2. **Thorough test coverage.** Unit tests cover all mapping functions (status, priority, type), parser edge cases (empty lines, non-issue records, missing titles), conversion logic (parent-child, blocks, comments, missing parents), and integration tests hit the real gRPC endpoint including dry-run and unsupported-format error paths.

3. **Defensive parsing.** The JSONL parser handles blank lines, invalid JSON lines (as warnings), non-issue `_type` records, and missing titles gracefully. The 10MB per-line scanner buffer is appropriate for the 50MB max import size.

4. **Relationship deduplication.** `deduplicateRelationships` with direction normalization for `relates_to` is a smart anticipation of the double-emit problem from bidirectional beads dependencies.

5. **Warning propagation.** Parse and convert warnings flow through to the response, giving users visibility into skipped lines or unresolvable parent links without failing the import.

6. **UI updates are clean.** Format-specific preview labels, `.jsonl` in the file accept filter, and proper state reset on error/close are all handled.

---

## Verification Story

- **Tests reviewed:** Yes — both unit and integration tests pass. Coverage includes parser edge cases, all mapping functions, full conversion pipeline, RPC integration (including dry-run and error), and deduplication. Missing: negative priority test, large-file stress test.
- **Build verified:** Yes — `go build ./...` succeeds. `go vet` shows only pre-existing warnings in `server.go`.
- **Lint/static analysis:** `go vet` clean for new code.
- **Security checked:** Yes — no injection risks. Input is parsed via `json.Unmarshal` (no `Decoder` with streaming into untrusted contexts). JSONL scanner has bounded buffer (10MB/line). No user-controlled data is used in file paths, SQL, or template rendering. Comment text and descriptions pass through as-is which is correct (the existing pipeline handles escaping downstream).
