# Passthrough Write-Through Implementation Log

## Phase 1: Core Write-Through (MVP)

### Started
2026-07-22

### Scope
- Change `isReadOnly` getter in `ft-app.ts` to check `remote_data.writable`
- Add dirty-task guard to `poll-manager.ts` (merge-based refresh instead of clear-and-replace)
- Coordinate `applyTaskUpdate` with `pollManager.markDirty/clearDirty`
- Reduce poll interval to 15s for writable external collections
- Update toolbar badge for writable external collections
- Fix assignee reverse-lookup bug in `passthrough.go`

### Progress
- [x] Phase 1 developer agent started (dev-passthrough-write-p1)
- [x] Phase 1 implementation complete (commit c0d3e2e)
- [x] Phase 1 code review Round 1: APPROVE with 2 Important findings
- [x] Phase 1 fixes applied (commit 7dee6ff — ref-counted dirty tasks, reactive poll interval)
- [x] Phase 1 code review Round 2: APPROVE (clean, only suggestions)
- [x] Phase 1 branch pushed, PR opened: https://github.com/scion-frontiers/farmtable/pull/116
- [x] Phase 1 reported to coordinator
- [ ] Phase 1 merged and deployed (waiting on coordinator)

### Decisions Made
- Assignee reverse-lookup uses GitHub node IDs (not logins) since `updateIssueAssignees` takes `[]githubv4.ID`. Added `ID` field to GraphQL query assignee nodes.
- Dirty-task guard uses reference-counted `Map<string, number>` (not simple `Set<string>`) to handle overlapping edits to the same task correctly.
- Poll interval reconfiguration is reactive — `reconfigurePollInterval()` called after `currentCollection` loads to handle the race where `switchToPolling()` fires before collection metadata is available.
- Round 1 "Suggestion" findings (hardcoded "GitHub" badge, error swallowing, assignee fallback clearing) left as-is per design doc intent — to be revisited in later phases.

### Deviations from Design Doc
- Design doc suggested using login strings for assignee reverse-lookup, but `updateIssueAssignees` takes `[]githubv4.ID` (node IDs), not `[]string`. Adapted to use node IDs from the GraphQL assignee nodes (added `ID` field to query).
- Design doc did not anticipate the dirty-task race on rapid edits or the poll interval race on first load — both caught in code review and fixed.

### Write-Through Verification (End-to-End)

**Test repo:** `scion-frontiers/scion-roadmap` (public, PAT has `repo` + `read:org` scope)
**Server mode:** `farmtable-server` with MultiStore + GitHub PlatformResolver (the `dashboard` command uses plain EntStore without MultiStore, so passthrough requires server mode)
**Collection:** `f6e08995-e40f-435b-881a-7aa7e88f9bf5` with `remote_data.writable = true`, platform `github`

#### Test Results

| Operation | Farmtable Command | GitHub Result | Status |
|-----------|-------------------|---------------|--------|
| **Create task** | `ft task create "Farmtable Write-Through Verified" -c <collID>` | Issue #2 created at `scion-frontiers/scion-roadmap` | ✅ |
| **Update title** | `ft task update <taskID> --name "...CONFIRMED — Title Updated From Farmtable"` | Issue #2 title updated on GitHub | ✅ |
| **Update description** | `ft task update <taskID> --description "..."` | Issue #2 body updated on GitHub | ✅ |
| **Add comment** | `ft comment add <taskID> "..."` | Comment appeared on GitHub issue #2 | ✅ |
| **Read-through** | Dashboard loads at `?collection=<collID>` | Both issues visible as Farmtable task cards | ✅ |

#### Screenshot Evidence (in worktree `screenshots/` directory)

1. **`02-github-collection.png`** — Empty kanban board with "↔ GitHub" badge, "+ Add Task" visible (writable gate unlocked)
2. **`03-github-writable-kanban.png`** — Kanban board showing 2 GitHub issues as task cards in TRIAGE column, with updated title visible
3. **`04-github-inspector-open.png`** — Inspector panel open on a GitHub issue showing editable properties, description, comment form

#### Reverse Direction (Read-Through)
The read-through (GitHub → Farmtable) was already working from the original passthrough project (PRs #85-#104). Verified: the test issue created directly via `gh issue create` appeared in the Farmtable dashboard when the collection was loaded.

#### Dashboard Note
The `ft dashboard` command uses a plain `EntStore` without `MultiStore` wrapping, so passthrough operations don't work through it. Only the `farmtable-server` binary wires up `MultiStore` + `PlatformResolver`. This is an existing architectural limitation, not a Phase 1 regression. Live deployments use `farmtable-server`.

---

## Phase 2: Capability-Based UI Gating

### Started
2026-07-22

### Scope
- Create `web/src/capabilities.ts` with `CollectionCapabilities` interface (15 flags), platform-specific capability sets, `getCapabilities()` factory, and `CAPABILITY_TOOLTIPS`
- Update 8 components to accept and use granular capability checks alongside existing `readOnly`
- Disable unmappable operations (dates, acceptance criteria, blocks/blocked-by, code context, delete, drag-reorder) with tooltips for GitHub collections
- Keep all mappable operations working (title, description, stage, priority, assignee, comments, create, close, reparent)

### Progress
- [x] Developer agent implementation complete (commit cff93e4)
- [x] Project log written (commit 1e1b62f)
- [x] Code review Round 1: APPROVE with 2 Important + 3 Suggestions
- [x] Review fixes applied (commit 51d39a2): capabilities wired to inspector-header/comments, defense-in-depth capability checks in kanban-view handlers, Object.freeze on constants, narrower tooltip type, disabled date cell cursor/opacity styling
- [x] Build verified clean after fixes
- [x] Branch pushed, PR opened: https://github.com/scion-frontiers/farmtable/pull/118
- [x] Reported to coordinator

### Decisions Made
- Capabilities live in a separate module (`capabilities.ts`) rather than in `gen/types.ts` — keeps generated types clean
- `readOnly` preserved alongside capabilities — components use specific capability flags for platform-varying operations, `readOnly` for universally-supported operations
- `!== false` defensive pattern — components without capabilities default to existing (enabled) behavior
- Several Phase 2 acceptance criteria (acceptance criteria edit, blocks/blocked-by, code context, delete, drag-reorder) are N/A because the UI controls don't exist yet — capability flags and tooltips are defined and ready for when those controls are added

### Deviations from Design Doc
- Design doc acceptance criteria 2-6 reference UI controls that don't exist yet (no acceptance criteria editor, no blocks/blocked-by editor, no code context editor, no delete button, no within-column reorder). The capability flags are defined in the interface and set correctly in GITHUB_CAPABILITIES; they'll gate the controls when they're implemented.
- Added `Object.freeze()` and narrower `Partial<Record<keyof ...>>` type per reviewer suggestion — not in design doc but improves safety
- Added `ft-inspector-header` and `ft-inspector-comments` capability wiring per reviewer's forward-compatibility suggestion

### Screenshot Evidence (in worktree `screenshots/` directory)

**Test setup:** Built ft-server from Phase 2 worktree, ran `ft dashboard --port 9091` with seed DB containing:
- Farmtable-platform collection ("default") with 7 test tasks
- GitHub-platform collection ("GitHub Test (scion-roadmap)") with `remote_data.writable = true` and 2 test tasks with date values set

| # | Screenshot | What it Shows |
|---|-----------|---------------|
| 1 | `p2-01-farmtable-all-enabled.png` | **Farmtable collection — ALL_ENABLED.** Inspector open on "Test task 4". Dates show "None" with **pencil edit icons** (editable). Assignee "+" button, label "+" button, description edit icon, Add Task button, comment form — all enabled. No capability gating applied. |
| 2 | `p2-02-github-capabilities-inspector.png` | **GitHub collection — GITHUB_CAPABILITIES.** Inspector open on "Write-through verification test". "↔ GitHub" badge in toolbar. Dates show values ("Jul 20, 2026", "Aug 1, 2026") but **no edit icons** — disabled by `canEditDates: false`. Title pencil icon ✅, description edit icon ✅, assignee "+" ✅, label "+" ✅, Add Task button ✅, comment form ✅ — all mapped operations still enabled. |
| 3 | `p2-03-github-disabled-date-tooltip.png` | **Tooltip on disabled date.** Tooltip reads **"No native date fields on GitHub issues"** overlaid on the Start date cell. Confirms `CAPABILITY_TOOLTIPS.canEditDates` is rendering correctly via `<sl-tooltip>`. |
| 4 | `p2-04-github-properties-closeup.png` | **GitHub properties close-up.** Tooltip text clearly visible. Date values rendered without edit controls, with `cursor: not-allowed; opacity: 0.6` styling. |
| 5 | `p2-05-farmtable-properties-closeup.png` | **Farmtable properties close-up (comparison).** Same Properties section for Farmtable collection — dates show "None" with **pencil edit icons** visible, confirming ALL_ENABLED is unaffected by the capability model. |

#### Key Visual Differences (Farmtable vs GitHub)
- **Dates:** Farmtable shows pencil edit icons; GitHub shows plain text with reduced opacity and tooltip
- **Assignees:** Both show "+" button (GitHub `canChangeAssignee: true`)
- **Labels:** Both show "+" button (labels map to GitHub labels)
- **Add Task:** Both show "+ Add Task" button (GitHub `canCreateTask: true`)
- **Description:** Both show edit icon (GitHub `canEditDescription: true`)
- **Comments:** Both show comment form (GitHub `canAddComment: true`)

---

## Phase 3: Polish + Error Handling

### Started
2026-07-22

### Scope
- Write error toasts in `ft-app.ts` (`showWriteError()`) mapping gRPC errors to user-friendly messages
- `write-error` CustomEvent dispatching from `ft-kanban-view.ts` and `ft-tree-view.ts` catch blocks
- `TypeToLabel` and `TypeLabelSwap` in `labels.go` (following `StageLabelSwap`/`PriorityLabelSwap` pattern)
- Generic `AddLabels`/`RemoveLabels` handling in `passthrough.go` `UpdateTask`
- 8 new Go tests covering type label mapping and swap edge cases

### Progress
- [x] Developer agent implementation complete (commit 14606b7)
- [x] Code review Round 1: APPROVE with 3 Suggestions (no Critical/Important)
- [x] Review fixes applied (commit 61a2c80): tree view write-error dispatch, TypeToLabel comment explaining "" return
- [x] Build verified clean after fixes (`go build ./...`, `go test ./...`, `npm run build`)
- [x] Screenshots captured (3 screenshots showing write error toasts)
- [x] Branch pushed, PR #119 opened: https://github.com/scion-frontiers/farmtable/pull/119
- [x] PR #119 merged to main (commit aa0feb2)

### Decisions Made
- `showWriteError()` uses regex-based error categorization — matches against `permission`, `403`, `forbidden`, `rate limit`, `too many requests`, `429` patterns to produce user-friendly messages. Falls back to raw error message for unexpected errors.
- Toast uses Shoelace `sl-alert` with `variant="danger"`, auto-close at 8s duration
- `write-error` CustomEvent uses `{bubbles: true, composed: true}` to cross shadow DOM boundaries from child components to `ft-app`
- `TypeToLabel` returns `""` for unknown types (unlike `StageToLabel`/`PriorityToLabel` which generate fallback labels) because types are open-ended strings — generating labels for arbitrary strings would create orphaned labels on GitHub. `TypeLabelSwap` guards with `newLabel != ""`.

### Deviations from Design Doc
- **Rate limit wait time not shown:** Toast shows "please wait before making more edits" but does not include the remaining wait time. Rate limit headers (`X-RateLimit-Reset`) are not plumbed through the gRPC layer. Documented as future enhancement.
- **Dynamic sweep interval not implemented:** The design doc's Component 5 (dynamic poll interval based on rate limit budget) is deferred — would require rate limit header propagation through gRPC responses. Current implementation uses the fixed 15s poll interval from Phase 1.

### Screenshot Evidence (in worktree `screenshots/` directory)

**Test setup:** Built ft-server from Phase 3 worktree, ran against test DB with GitHub-platform collection (`scion-frontiers/scion-roadmap`, `remote_data.writable = true`). Write errors triggered by programmatic JavaScript intervention to simulate GitHub API failures.

| # | Screenshot | What it Shows |
|---|-----------|---------------|
| 1 | `p3-01-github-writable-inspector.png` | **GitHub writable collection — baseline.** Inspector open on "Test task for error toast" in TRIAGE column. Title, description, assignees, labels, comments all editable. "↔ GitHub" badge in toolbar. No errors — normal working state. |
| 2 | `p3-02-write-error-toast.png` | **Write error toast — permission denied.** Red alert toast at top-right: "Failed to save changes: GitHub rejected this edit — your token may not have write access". Warning icon, dismissible with × button. Confirms `showWriteError()` regex matching on `permission`/`403`/`forbidden` patterns. |
| 3 | `p3-03-rate-limit-toast.png` | **Rate limit toast — stacked.** Two toasts stacked: (1) permission denied toast from previous action, (2) rate limit toast: "GitHub rate limit reached — please wait before making more edits". Confirms rate limit regex matching on `rate limit`/`too many requests`/`429` patterns. |

### Code Review Summary

**Reviewer verdict:** APPROVE  
**Findings:** 0 Critical, 0 Important, 3 Suggestions (all addressed in commit 61a2c80)

| Suggestion | Resolution |
|------------|------------|
| Tree view write errors silently swallowed | Added `write-error` CustomEvent dispatch in tree view reparent catch block + `@write-error` listener in ft-app |
| `ensureLabelIndex` called up to 5× per UpdateTask | Acknowledged — cached after first call, follows existing pattern. No change needed. |
| `TypeToLabel` should explain why it differs from `StageToLabel` | Added explanatory comment in `labels.go` |

### Test Coverage
- `TestTypeLabelSwap_Default` — default type mapping (bug → "bug" label)
- `TestTypeLabelSwap_Unknown` — unknown type returns empty label
- `TestTypeLabelSwap_CustomConfig` — custom config overrides default
- `TestTypeLabelSwap_Disabled` — disabled mapper returns nil/nil
- `TestTypeLabelSwap_SwapExisting` — removes old type label, adds new
- `TestTypeLabelSwap_NoExisting` — adds new label when no existing type
- `TestTypeLabelSwap_AlreadyPresent` — no changes when already correct
- `TestLabelMapper_Disabled` — extended to cover TypeToLabel and TypeLabelSwap
