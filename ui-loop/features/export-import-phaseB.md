# Export/Import Phase B — Web UI

## Investigation Findings (Pre-Implementation)

### Phase A Status
- PR #72 merged to main at 2026-07-19T23:16:58Z (commit b8929bf)
- Proto has `ExportCollectionRequest/Response`, `ImportCollectionRequest/Response`, `ImportStats` messages
- Proto has `ExportCollection` and `ImportCollection` RPCs in `FarmTableService`

### gRPC-Web Client State
- **`web/src/gen/farmtable.json`** (protobufjs JSON descriptor): ❌ Did NOT contain export/import message definitions or RPC entries. Developer added them manually.
- **`web/src/gen/grpc-client.ts`**: ❌ Did NOT have export/import methods. Developer added them.
- **`web/src/gen/types.ts`**: ❌ No `ImportStats` interface. Developer added it.
- **`web/src/gen/service.ts`**: ❌ `FarmTableServiceClient` interface did not include export/import. Developer extended it.

### Codegen Approach
- `buf.gen.yaml` only generates Go code — no JS/TS plugin.
- `farmtable.json` and `types.ts` are hand-maintained.
- Developer manually added all export/import entries.

## What Was Built

### Files Changed (9 files, ~610 additions)
1. `web/src/gen/farmtable.json` — Added proto descriptor entries for 5 messages + 2 RPCs
2. `web/src/gen/grpc-client.ts` — Added `exportCollection()` and `importCollection()` methods with robust bytes handling (Uint8Array + base64 fallback)
3. `web/src/gen/types.ts` — Added `ImportStats` interface
4. `web/src/gen/service.ts` — Extended `FarmTableServiceClient` interface and `MockFarmTableClient`
5. `web/src/components/ft-toolbar.ts` — Added export/import buttons, handlers, toast helper, import dialog integration
6. `web/src/components/ft-import-collection-dialog.ts` — NEW: Shoelace dialog for importing collections from JSON files
7. `web/src/index.ts` — Registered new component (later removed per R1 review — imported via toolbar instead)
8. `.design/project-log/feature-26-export-import-web-ui.md` — Project log

### Export Flow
- Download icon button in toolbar, conditional on FARMTABLE platform
- Single click calls ExportCollection RPC → Blob → Object URL → programmatic anchor click → download
- Loading state on button during RPC
- Warnings shown via toast, errors shown via toast

### Import Flow
- Upload icon button in toolbar, always visible
- Opens `ft-import-collection-dialog` with:
  - File input (hidden native input + Shoelace button trigger, .json only)
  - 50MB file size guard
  - JSON parse validation + format_version check
  - Preview: collection name, task/comment/relationship counts
  - Editable collection name (pre-filled from file)
  - Import button calls ImportCollection RPC
  - Success: closes dialog, navigates to new collection, shows stats toast
  - Error: shows in-dialog error, lets user retry

## Review Rounds

### R1: APPROVE with findings
**Verdict:** APPROVE

**Important (2):**
1. `client: any` in import dialog → changed to `FarmTableServiceClient?`
2. Unnecessary `as GrpcFarmTableClient` cast in toolbar export handler → removed, using interface directly

**Suggestions (4):**
1. Redundant import in index.ts → removed (dialog imported via toolbar only)
2. `?open` attribute binding differs from peer dialogs → removed, using programmatic show()/hide()
3. No file size check → added 50MB guard
4. `showToast` could be shared utility → noted for future, no change

**All findings fixed** in commit d252f3d → 7ba5cbd (after rebase).

### R2: APPROVE (clean)
**Verdict:** APPROVE — no critical or important issues.

**Minor suggestions only (5):**
1. Export decode/reencode could be simplified
2. `revokeObjectURL` timing (defensive setTimeout)
3. `fileText` non-reactive by design — add comment
4. Preview renders user data safely (verified)
5. Base64 bytes fallback correct but verbose

**Exit criteria met:** R2 returned only nitpick/minor findings → ship as-is.

## Rebase & PR

- Rebased onto origin/main (including PR #73 — collection platform types)
- Resolved merge conflict in ft-toolbar.ts (added external link + platform badge alongside export/import buttons)
- Build verified after rebase
- **PR #74**: https://github.com/scion-frontiers/farmtable/pull/74
- **Status**: CLEAN/MERGEABLE

## Final State
- Branch: `feat/export-import-web-ui` (2 commits ahead of main)
- Commits: ef91a7d (feat), 7ba5cbd (fix)
- TypeScript build: PASS
- Go build + vet: PASS
