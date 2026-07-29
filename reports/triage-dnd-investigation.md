# Investigation: Can't Move Items Out of Triage Column (Kanban)

**Date:** 2026-07-22
**Collection:** `f7351b20-3c44-41b1-a253-e8dd6128b250` (decomposer-test-1784662856)
**URL:** https://farmtable-qo7k5fvpda-uc.a.run.app/?collection=f7351b20-3c44-41b1-a253-e8dd6128b250&view=kanban

## Summary

**Drag-and-drop from Triage works correctly. The issue cannot be reproduced.** The collection is a native farmtable collection (`platform: farmtable`), not an external/passthrough collection, and the UI is correctly NOT in read-only mode. Programmatic drag events and Playwright mouse-based drag both successfully move tasks from Triage to other columns. No console errors, network failures, or server-side errors were observed. The most likely explanation is that the reporter experienced a transient browser issue or a UX misunderstanding.

## Root Cause Classification

**None of (a), (b), or (c)** — the reported issue cannot be reproduced. The system is working correctly.

- **(a) Read-only?** No. The collection has `platform: "farmtable"` (value `1` = `Platform.FARMTABLE`), no `remote_id`, and no linked external account. The `isReadOnly` getter in `ft-app.ts:145-147` correctly evaluates to `false`. The `readOnly` prop is `false` at all levels: app → kanban-view → kanban-column → task-card.
- **(b) Collection-specific bug?** No. Drag-and-drop works for this specific collection — tasks moved successfully from Triage to Backlog during testing.
- **(c) General DnD bug?** No. The drag-and-drop implementation is correct and functional.

## Reproduction Attempt

### Environment
- Playwright 1.61.1, headless Chromium, 1920×1080 viewport
- Targeted the live production URL directly

### Step 1: Verified Collection Properties

```bash
ft collection get f7351b20-3c44-41b1-a253-e8dd6128b250 --server farmtable-qo7k5fvpda-uc.a.run.app:443 -o json
```

Result:
```json
{
  "platform": "farmtable",
  "remote_id": null,
  "name": "decomposer-test-1784662856"
}
```

The `ft collection links` query returns a linked account for a **different** collection (`466c2baa`, the GitHub-mirrored one), confirming this collection has no external links.

### Step 2: Verified UI State (Playwright)

| Property | Value |
|---|---|
| `app.currentCollection.platform` | `1` (FARMTABLE) |
| `app.isReadOnly` | `false` |
| `kanban.readOnly` | `false` |
| Card `draggable` attribute | `"true"` |
| Card `draggable` DOM property | `true` |
| Card `readOnly` property | `false` |

All 95 tasks are in the Triage column. All other columns have 0 tasks.

### Step 3: Programmatic Drag Events

Dispatched `dragstart` → `dragenter` → `dragover` → `drop` events manually:

| Event | Result |
|---|---|
| `dragstart` on card | Fired successfully, `dataTransfer` contains task ID |
| `dragenter` on Backlog | `isDragOver` became `true` |
| `dragover` on Backlog | `defaultPrevented: true` (drop allowed) |
| `drop` on Backlog | `defaultPrevented: true` (handled correctly) |

### Step 4: Mouse-Based Drag (Playwright)

Used `page.mouse.down()` → `page.mouse.move()` → `page.mouse.up()` to drag a card from Triage to Backlog.

**Result:** Tasks successfully moved. Triage: 95→93, Backlog: 0→2.

Screenshots captured:
- `screenshot-initial.png` — before drag, all 95 tasks in Triage
- `screenshot-after-drag.png` — after drag, 93 in Triage, 2 in Backlog

### Step 5: Server-Side Logs

```bash
gcloud logging read 'resource.type="cloud_run_revision" AND resource.labels.service_name="farmtable" AND severity>=ERROR AND timestamp>="2026-07-22T00:00:00Z" AND timestamp<="2026-07-22T02:00:00Z"' --project=deploy-demo-test --limit=20
```

**Result:** No errors found. Empty response `[]`.

### Step 6: Console Errors

Only one unrelated error: `Failed to load resource: the server responded with a status of 404` (likely a missing favicon or static asset — does not affect drag-and-drop).

## Code Review

The relevant code paths are correct:

1. **`ft-app.ts:145-147`** — `isReadOnly` getter checks `currentCollection.platform !== Platform.FARMTABLE`. For this collection, `platform === 1 === Platform.FARMTABLE`, so `isReadOnly === false`.

2. **`ft-app.ts:306`** — Passes `?readOnly=${this.isReadOnly}` to `<ft-kanban-view>`.

3. **`ft-kanban-view.ts:316,349`** — Passes `?readOnly=${this.readOnly}` to columns and cards.

4. **`ft-task-card.ts:375`** — Sets `draggable=${String(!this.readOnly && !this.isEditingTitle && !this.isEditingPriority)}`. Evaluates to `"true"` when not editing.

5. **`ft-task-card.ts:185-193`** — `onDragStart` sets data transfer with task ID and `effectAllowed: 'move'`.

6. **`ft-kanban-column.ts:188-191`** — `onDragOver` calls `e.preventDefault()` to allow drop.

7. **`ft-kanban-column.ts:200-214`** — `onDrop` dispatches `stage-change` event with the new stage.

8. **`ft-kanban-view.ts:142-166`** — `onStageChange` performs optimistic update + server `updateTask` call.

No validation blocks Triage→other-stage transitions. The `CLOSED_STAGES` guard at line 148 only prevents drops into closed stages other than Completed.

## Scope Recommendation

**XS — No action needed.**

The reported issue cannot be reproduced. Drag-and-drop works correctly for this collection. If the reporter continues to experience issues, further investigation should include:
- The reporter's specific browser/OS/input device
- Whether they were using a trackpad or touch screen (which may handle drag differently)
- Whether a browser extension is interfering with drag events

## Recommended Approach

No fix needed. Recommend replying to the reporter that drag-and-drop is working on this collection and asking for more details about their browser/device if they continue to experience the issue.

## Open Questions

1. **Reporter's browser/device** — unknown. Drag-and-drop can behave differently on touch devices, certain trackpads, or with browser extensions like drag-blocker add-ons.
2. **Timing** — the report was at 01:05 UTC. It's possible there was a transient deployment or cold-start issue that resolved before this investigation.
3. **UX clarity** — with 95 tasks all in Triage, the column is quite tall. The user may have had difficulty with the drag gesture if scrolling was needed simultaneously.
