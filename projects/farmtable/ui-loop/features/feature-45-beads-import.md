# Feature 45: Import Beads JSONL Format (Auto-Detected)

## Date
2026-07-22

## Status
Implementation complete, pending code review

## Branch
`feat/f45-beads-import` (worktree: `/workspace/farmtable-f45`)

---

## Beads JSONL Schema (Discovered)

The Beads platform stores issues as JSONL (one JSON object per line). The source
struct is in `internal/types/types.go` of the Beads reference codebase. Key fields
used for the import:

| Field | Type | Notes |
|---|---|---|
| `_type` | string | Always `"issue"` for issue records |
| `id` | string | e.g., `"abra-go-9cvt.4"` — alphanumeric with dots |
| `title` | string | Required, max 500 chars |
| `description` | string | Optional |
| `status` | string | `open`, `in_progress`, `blocked`, `deferred`, `closed`, `pinned`, `hooked` |
| `priority` | int | 0 (highest/P0) to 4 (lowest) |
| `issue_type` | string | `bug`, `feature`, `task`, `epic`, `chore`, `spike`, `story`, `milestone`, etc. |
| `assignee` | string | Username string, optional |
| `owner` | string | Username string, optional |
| `labels` | []string | Optional |
| `dependencies` | []object | `{issue_id, depends_on_id, type}` — types include `blocks`, `parent-child`, `related`, etc. |
| `acceptance_criteria` | string | Optional |
| `design` | string | Optional — appended to description |
| `notes` | string | Optional — appended to description |
| `created_at` | timestamp | ISO 8601 |
| `updated_at` | timestamp | ISO 8601 |
| `closed_at` | *timestamp | Optional, set when status is "closed" |
| `started_at` | *timestamp | Optional |
| `due_at` | *timestamp | Optional |
| `comments` | []object | `{id, issue_id, author, text, created_at}` |

### Sample Data Profile (`/scion-volumes/scratchpad/issues.jsonl`)

- **537 records** (all `_type: "issue"`)
- **Statuses**: open (104), closed (432), in_progress (1)
- **Types**: task (356), epic (63), bug (52), feature (65), chore (1)
- **Priority range**: 0–4 (most are 2=normal)
- **Assignees**: 15 unique usernames
- **Dependencies**: parent-child and blocks relationships present

---

## Field Mapping Decisions

### Status → Phase + Stage

| Beads Status | Farmtable Phase | Farmtable Stage | Rationale |
|---|---|---|---|
| `open` | `open` | `ready` | Ready for work |
| `in_progress` | `in_progress` | `working` | Actively being worked |
| `blocked` | `in_progress` | `blocked` | Work started but blocked |
| `deferred` | `on_hold` | `deferred` | Postponed |
| `closed` | `closed` | `completed` | Done |
| `pinned` | `open` | `backlog` | Important but not active |
| `hooked` | `in_progress` | `working` | Triggered/active (similar to in_progress) |
| (unknown) | `open` | `triage` | Safe default for unknown statuses |

The original Beads status is preserved in `native_label` for round-trip fidelity.

### Priority (int) → Priority (string)

| Beads Priority | Farmtable Priority |
|---|---|
| 0 (P0) | `urgent` |
| 1 (P1) | `high` |
| 2 (P2) | `normal` |
| 3 (P3) | `low` |
| 4+ | `low` |

### Issue Type → Task Type

| Beads Type | Farmtable Type | Rationale |
|---|---|---|
| `bug` | `bug` | Direct mapping |
| `epic` | `epic` | Direct mapping |
| `story` | `story` | Direct mapping |
| `task` | `task` | Direct mapping |
| `subtask` | `subtask` | Direct mapping |
| `feature` | `task` | No "feature" type in Farmtable; closest is task |
| `chore` | `task` | Maintenance work → task |
| (others) | `task` | Safe default |

### Dependencies → Relationships + Parent-Child

| Beads Dependency Type | Farmtable Mapping |
|---|---|
| `parent-child` | `parent_task_id` (hierarchical nesting) |
| `blocks` | Relationship type `blocks` |
| `related` / `relates-to` / `discovered-from` | Relationship type `relates_to` |
| `duplicates` | Relationship type `duplicates` |
| (others) | Relationship type `relates_to` |

### Other Field Mappings

- **`design`** and **`notes`**: Appended to `description` under `## Design` and `## Notes` headers
- **`acceptance_criteria`**: Direct mapping to `acceptance_criteria` field
- **`assignee`**: Mapped to user lookup → `assignee_id` (users created by display name)
- **`started_at`** → `start_date`, **`due_at`** → `due_date`, **`closed_at`** → `closed_at`
- **`comments`**: Mapped to Farmtable comments with author user lookup
- **`labels`**: Direct array mapping

---

## Auto-Detection Heuristic

Implemented in `detectImportFormat()`:

1. **Trim whitespace** from the input data
2. **Try Farmtable native format first**: If data starts with `{`, try parsing as a single JSON object and check for `format_version` field. If present → format is `"farmtable"`.
3. **Try Beads JSONL**: Read the first non-empty line. If it starts with `{` and parses as JSON with either `_type == "issue"` or a non-empty `title` field → format is `"beads"`.
4. If neither matches → return empty string (unsupported format).

This heuristic is reliable because:
- Farmtable's native format is always a single JSON document with `format_version`
- Beads JSONL is always line-delimited JSON with `_type: "issue"` markers
- The two formats are structurally distinct (single JSON doc vs. multi-line JSONL)

---

## Architecture

### Backend

**New file: `internal/server/beads_import.go`** (474 lines)
- `beadsIssue`, `beadsDependency`, `beadsComment` — struct types matching the JSONL schema
- `parseBeadsJSONL()` — line-by-line parser with validation and warning collection
- `beadsStatusToPhaseStage()`, `beadsPriorityToFarmtable()`, `beadsTypeToFarmtable()` — mapping functions
- `convertBeadsToExportDocument()` — converts parsed Beads issues into Farmtable's `exportDocument` format, which then feeds into the existing import pipeline (reusing all ID mapping, user resolution, reference validation, and database insertion logic)
- `detectImportFormat()` — format auto-detection heuristic
- `deduplicateRelationships()` — removes duplicate relationships that arise from bidirectional Beads dependencies

**Modified file: `internal/server/export_import.go`** (54 lines changed)
- `ImportCollection()` now calls `detectImportFormat()` first
- Beads format: parses JSONL → converts to `exportDocument` → feeds into existing pipeline
- Native format: unchanged existing logic
- Unsupported: returns descriptive error

### Frontend

**Modified file: `web/src/components/ft-import-collection-dialog.ts`** (88 lines changed)
- File input accepts `.json` and `.jsonl`
- New text: "Supported formats: Farmtable export (.json), Beads issue export (.jsonl)"
- Button text changed from "Choose JSON" to "Choose File"
- Added `detectedFormat` property to track format for preview display
- JSONL files: preview shows issue count (vs. task/comment/relationship counts for native)
- Format detection happens client-side for preview; backend does authoritative detection

### Tests

**New file: `internal/server/beads_import_test.go`** (608 lines)
- `TestParseBeadsJSONL` — parsing, validation, line skipping
- `TestDetectImportFormat` — format detection for native, beads, empty, and invalid data
- `TestBeadsStatusToPhaseStage` — all status mappings
- `TestBeadsPriorityToFarmtable` — all priority mappings
- `TestBeadsTypeToFarmtable` — all type mappings
- `TestConvertBeadsToExportDocument` — full conversion including parent-child, blocks dependencies, description appending, comments, timestamps

**Modified file: `internal/server/export_import_test.go`** (138 lines added)
- `TestRPC_ImportCollection_BeadsJSONL` — end-to-end RPC test with Beads JSONL data
- `TestRPC_ImportCollection_BeadsJSONL_DryRun` — dry-run mode test
- `TestRPC_ImportCollection_UnsupportedFormat` — error case test

---

## Verification Results

### Real Import of Sample JSONL

Successfully imported `/scion-volumes/scratchpad/issues.jsonl`:

```
Collection ID: 0e688faf-9adc-480d-b4b7-1385cae6a0db
Stats:
  Tasks: 537
  Comments: 1
  Relationships: 29
  Users matched: 0
  Users created: 15
Warnings:
  Created 15 new users
```

### Task List Verification

Imported tasks show correct mapping:
- Titles preserved (e.g., "Implement Sherlog Traces & Thoughts UI", "[EPIC] Security remediation")
- Phase/stage correctly mapped: CLOSED/completed, OPEN/ready, IN_PROGRESS/working
- Priority correctly mapped: URGENT (P0 tasks), HIGH, NORMAL, LOW
- Types correctly mapped: task, epic, bug
- Parent-child relationships preserved as task hierarchy (340 parent-child relationships)
- Block dependencies as relationships (29 relationships)

### Screenshots (saved to evidence directory)

1. `beads-kanban-tasks.png` — Kanban board showing 104 READY tasks, 1 WORKING task with proper priority/type badges
2. `import-dialog-formats.png` — Import dialog showing "Supported formats: Farmtable export (.json), Beads issue export (.jsonl)"
3. `real-import-output.txt` — CLI output of the real import
4. `task-list-output.json` — First 50 imported tasks with full field data

### Build & Test

- `go build ./...` — passes
- `go test ./internal/server/` — all 25+ tests pass (including new beads tests)
- `cd web && npm run build` — passes (TypeScript compilation + Vite build)

---

## Evidence Directory

`/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-45-beads-import/`
