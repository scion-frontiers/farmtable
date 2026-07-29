# Brief: Engineering Manager — Collection Export/Import Phase B: Web UI

## Critical Constraints (read first)

- **Only one agent runs at a time.** Never run a developer and a reviewer
  simultaneously.
- **You do NOT merge anything.** When ready, push the branch, open a PR with
  `gh pr create`, then message the coordinator with the PR URL and summary.
  The coordinator runs `gh pr merge --squash` itself.
- **Reviewers must be blind.** Each review round is a brand-new
  `code-reviewer` agent (`--harness claude`) with zero knowledge of prior
  review feedback — give it only the current repo/diff state.
- **Exit criteria for the review loop:**
  - Round 1: have the developer fix ALL findings (including nitpicks).
  - Round 2 onward: if the fresh review returns ONLY nitpick/minor findings
    (nothing significant/blocking), STOP — ship as-is. Otherwise fix and
    run another fresh review round.
  - Hard cap: 5 review rounds total.
- **Agent types/harnesses:**
  - Developer: `scion start farmtable-exportB-dev --type developer <task>` —
    NO `--harness` flag (project default is codex).
  - Reviewer: `scion start farmtable-exportB-review-rN --type code-reviewer
    --harness claude <task>` (r1, r2, r3...).
- **Keep the developer agent alive** across all fix iterations.
- **Before opening the PR, rebase onto latest origin/main and confirm `gh
  pr view <n> --json mergeStateStatus,mergeable` shows CLEAN/MERGEABLE.**
- **Quota watch:** if an agent stalls/errors with quota/rate-limit signs,
  don't keep retrying — `scion look` it and message the coordinator.
- **The coordinator will NOT independently re-read your diff or re-open
  your screenshots** — your own verification is what stands. Be rigorous.
- **Phase A must be merged first.** This phase depends on the
  `ExportCollection` and `ImportCollection` gRPC RPCs added in Phase A. If
  Phase A is not yet merged to `main`, do NOT proceed — message the
  coordinator immediately.
- **INVESTIGATE BEFORE BUILDING (do this first):** Verify that the Phase A
  RPCs (`ExportCollection`, `ImportCollection`) exist in the proto and are
  implemented in the server. Specifically check:
  - `proto/farmtable.proto` has `ExportCollectionRequest/Response`,
    `ImportCollectionRequest/Response`, `ImportStats` messages and the two
    RPCs in `FarmTableService`.
  - The gRPC-Web generated client (`web/src/gen/grpc-client.ts`) includes
    methods for calling these RPCs. If not, the developer needs to
    regenerate the web client from the proto (check the project's web
    codegen workflow — likely `buf generate` or `protoc` with the
    grpc-web plugin).
  - Report findings to the coordinator before committing to implementation.

## Feature Spec

Add export (download) and import (upload) UI surfaces to the web
dashboard, calling the Phase A gRPC RPCs via gRPC-Web.

### Export Button (Download)

Add a download icon button to the toolbar's `.collection-controls` div,
next to the existing settings gear icon.

**Placement:**
```html
<!-- In ft-toolbar.ts, inside the PLATFORM_FARMTABLE conditional block,
     after the gear icon button -->
<sl-icon-button
  name="download"
  label="Export collection"
  @click=${this.onExportClick}
></sl-icon-button>
```

- **Conditional display:** Only shown when `this.currentCollection?.platform
  === Platform.FARMTABLE` (same condition as the settings gear icon — see
  `ft-toolbar.ts` around line 146-154 for the existing pattern).
- **No modal needed for v1** — single click triggers the export.

**Export flow:**
1. User clicks the download icon button.
2. Handler calls `ExportCollection` via the unscoped gRPC-Web client, passing
   the current collection ID and `include_changes: false`.
3. While the RPC is in flight, show a brief loading state on the button
   (e.g., replace icon with `sl-spinner`, or add a `loading` attribute if
   Shoelace supports it on icon buttons).
4. On response:
   a. Extract the `data` bytes from the response.
   b. Create a `Blob` from the data with type `application/json`.
   c. Generate an Object URL via `URL.createObjectURL(blob)`.
   d. Create a temporary `<a>` element with `href` = Object URL and
      `download` = `"<collection-name>-<YYYY-MM-DD>.json"` (sanitize the
      collection name for filesystem safety: replace non-alphanumeric chars
      except hyphens/underscores with hyphens).
   e. Programmatically click the `<a>` to trigger the browser download.
   f. Revoke the Object URL via `URL.revokeObjectURL()`.
5. If the response includes `warnings`, show a brief `sl-alert` toast
   listing them (same toast pattern as the error alerts in
   `ft-new-collection-dialog` / `ft-collection-settings-dialog`).
6. On RPC error: show an `sl-alert` error toast.

### Import Dialog (Upload)

Add an upload icon button to the toolbar (near the export button) and a
new `ft-import-collection-dialog` component.

**Toolbar button:**
```html
<!-- In ft-toolbar.ts, inside .collection-controls, always visible
     (importing always creates a new PLATFORM_FARMTABLE collection) -->
<sl-icon-button
  name="upload"
  label="Import collection"
  @click=${this.onImportClick}
></sl-icon-button>
```

**Dialog component: `ft-import-collection-dialog.ts`**

Follow the same patterns as `ft-new-collection-dialog` (Shoelace
`<sl-dialog>`, focus trap, Escape to cancel, error alert). This is the
**first file-upload interaction** in the dashboard — there's no existing
pattern to copy for the file input, but keep it simple.

**Dialog layout:**
```
┌─ Import Collection ─────────────────────────────┐
│                                                  │
│  [Choose File]  no-file-selected.json            │
│                                                  │
│  ┌─ Preview ──────────────────────────────────┐  │
│  │ Collection: "Sprint 42"                    │  │
│  │ Tasks: 47  Comments: 123  Relationships: 8 │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│  Collection name: [Sprint 42                  ]  │
│                                                  │
│  ┌─ Error area (hidden unless error) ─────────┐  │
│  │ sl-alert with error message                │  │
│  └────────────────────────────────────────────┘  │
│                                                  │
│                        [Cancel]  [Import]         │
└──────────────────────────────────────────────────┘
```

**Dialog flow:**
1. Dialog opens with the file input and an empty preview area. Import
   button is disabled until a valid file is selected.
2. User clicks "Choose File" (an `<input type="file" accept=".json">`
   styled via a Shoelace button or hidden behind one).
3. On file selection:
   a. Read the file via `FileReader.readAsText()`.
   b. Parse the JSON. If parsing fails, show an error in the dialog.
   c. Validate `format_version === 1`. If not, show error.
   d. Display the preview: collection name, and counts of tasks, comments,
      relationships (from the parsed JSON arrays' lengths).
   e. Pre-fill the "Collection name" input with the collection name from
      the file. User can edit to override.
   f. Enable the Import button.
4. User clicks "Import":
   a. Disable the Import button, show a loading spinner.
   b. Call `ImportCollection` via gRPC-Web, passing:
      - `data`: the raw file bytes (re-encode the original file text to
        bytes, or keep the original ArrayBuffer from FileReader).
      - `name`: the value from the collection name input (only if changed
        from the original).
      - `dry_run`: false.
   c. On success:
      - Close the dialog.
      - Show an `sl-alert` success toast with import stats (e.g.,
        "Imported 47 tasks, 123 comments, 8 relationships. 2 users
        matched, 1 user created.").
      - Navigate to the newly imported collection using the existing
        `pushState` + `applyRoute()` routing pattern (same mechanism
        as `ft-new-collection-dialog`'s `onCollectionCreate` handler —
        emit a `collection-select` event with the new collection ID, or
        call the same navigation helper).
   d. On error: show the error message in the dialog's error area (do not
      close the dialog — let the user try again or cancel).
   e. If the response includes `warnings`, include them in the success
      toast or show a separate info toast.

**Component properties:**
```typescript
// ft-import-collection-dialog.ts
@property({ type: Object }) client;  // gRPC-Web client (unscoped)
// Internal state
@state() private open = false;
@state() private file: File | null = null;
@state() private preview: { name: string; tasks: number; comments: number; relationships: number } | null = null;
@state() private collectionName = '';
@state() private loading = false;
@state() private error = '';
```

**Events emitted:**
- `collection-import` — fires on successful import, with `detail:
  { collectionId: string }`. The toolbar handles this the same way it
  handles `collection-create` from the new-collection dialog (navigate to
  the new collection).

### gRPC-Web Client

The developer must ensure the gRPC-Web generated client includes methods
for `ExportCollection` and `ImportCollection`. Check
`web/src/gen/grpc-client.ts` — if these methods are missing, regenerate
the web client from the proto.

The `ExportCollectionResponse.data` field is `bytes` in proto, which will
arrive as a `Uint8Array` in the JavaScript client. Convert to string for
Blob creation:
```javascript
const jsonString = new TextDecoder().decode(response.data);
const blob = new Blob([jsonString], { type: 'application/json' });
```

For `ImportCollectionRequest.data`, convert the file content to
`Uint8Array`:
```javascript
const encoder = new TextEncoder();
const data = encoder.encode(fileContent);
```

Explicitly OUT of scope:
- Backend/proto changes (those are in Phase A, already merged).
- Include-changes checkbox in the export flow (v1 exports without changes
  from the web UI; the CLI supports `--include-changes` for users who need
  it).
- Drag-and-drop file upload (simple file input is fine for v1).
- Progress indicator for large exports/imports (unary RPCs return all at
  once — no intermediate progress).

## Key Locations

- Repo: `/workspace/farmtable`, base off current `main` (must include
  Phase A's merged PR) — use a fresh feature branch, PR to merge.
- **Design doc (read for context):**
  `/scion-volumes/scratchpad/projects/farmtable/reports/design-export-import.md`
- Proto (read-only reference, do not modify):
  `proto/farmtable.proto` — `ExportCollectionRequest/Response`,
  `ImportCollectionRequest/Response`, `ImportStats` messages.
- Web source: `web/src/` — all web components live here.
- gRPC-Web client: `web/src/gen/grpc-client.ts` — generated client, check
  for `exportCollection` / `importCollection` methods.
- Types: `web/src/gen/types.ts` — generated TypeScript types from proto.
- Toolbar: `web/src/components/ft-toolbar.ts` — the `.collection-controls`
  section where export/import buttons go (around lines 134-156). Look at
  how the settings gear icon is conditionally shown for FARMTABLE platform.
- New-collection dialog (pattern to follow):
  `web/src/components/ft-new-collection-dialog.ts` — Shoelace dialog,
  focus trap, error handling, event emission pattern.
- Collection-settings dialog (another pattern reference):
  `web/src/components/ft-collection-settings-dialog.ts`.
- Repo's own agent guide: `/workspace/farmtable/agents.md` and
  `/workspace/farmtable/CLAUDE.md` — dev/build/test conventions,
  `farmtable-dev` skill for env setup.
- Prior feature logs for UI component patterns:
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/feature-20-new-collection-modal.md`
  (closest analog — modal dialog with form, RPC call, navigation on
  success).
- Prior Playwright learnings:
  `/scion-volumes/scratchpad/projects/farmtable/learnings/playwright-cloud-run-verification.md`
- Your scratchpad for this feature (create it):
  `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/export-import-phaseB.md`

## Deliverables

1. A pushed feature branch + open PR (via `gh pr create`) against
   `scion-frontiers/farmtable` `main`, confirmed CLEAN/MERGEABLE via `gh
   pr view --json mergeStateStatus,mergeable` before reporting ready.
2. Real, distinct screenshots (verified via `md5sum`, genuine UI
   interaction) showing:
   (a) The export button in the toolbar next to the gear icon.
   (b) Clicking export triggers a file download (browser download bar or
       file save dialog visible).
   (c) The import button in the toolbar.
   (d) The import dialog with a file selected and preview showing.
   (e) After successful import — navigated to the newly imported
       collection, tasks visible on the board.
   Saved under
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/export-import-phaseB/`
3. A log at
   `/scion-volumes/scratchpad/projects/farmtable/ui-loop/features/export-import-phaseB.md`
   with: findings from the investigate-first step (did gRPC-Web client
   already have the export/import methods?), what was built (components,
   toolbar changes, dialog), each review round's findings/resolutions,
   final state, and any issues encountered.
4. A message to the coordinator with: PR URL, branch, summary, and final
   review outcome.

## Direct Contact

- Coordinator: `scion message coordinator "<message>"` for done/blocked/
  quota-concern reports, and especially to report the investigate-first
  finding (gRPC-Web client state) before committing to implementation.
- Do not message ptone@google.com directly — that's the coordinator's job.

## Termination

You MUST get the PR opened, pushed, and confirmed mergeable, produce the
log and screenshots at the paths above, and message the coordinator with
the summary. Then signal task_completed. Do not delete your developer
agent until the coordinator confirms the merge landed or explicitly tells
you to clean up.
