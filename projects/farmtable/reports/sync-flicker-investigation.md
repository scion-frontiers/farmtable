# Sync Flicker Investigation — Findings Report

## Summary

The periodic UI flicker during the 15-second passthrough sync is **reproduced and root-caused**. The visible artifact is the **Refresh button in the toolbar briefly showing a loading spinner** on every poll cycle (20 DOM mutations per cycle), caused by the `isRefreshing` state toggling `true→false` during `PollManager.refresh()`. A secondary issue — `TaskStore.upsert()` firing `tasks-changed` events unconditionally even when task data is identical — causes unnecessary render cascades (7+ `requestUpdate()` calls per cycle for 7 tasks), though Lit's template diffing prevents these from producing visible DOM changes in the kanban board at the current task count. Both issues should be fixed.

## Reproduction

**Environment:** Local dashboard with seed DB, Playwright-driven. Polling mode was simulated by programmatically setting `isPolling=true`, `connectionStatus='polling'`, and toggling `isRefreshing`.

**Observed behavior:** Every 15 seconds (or 30s for read-only external collections), the Refresh button in the toolbar:
1. Gains `loading` and `disabled` attributes → Shoelace `sl-button` shows a spinner animation and hides the button text (8 DOM mutations)
2. After `listTasks()` completes, loses both attributes → returns to normal (12 DOM mutations)

This toggle is visible as a brief blink/flash of the button area. The kanban board itself does **not** visually change (0 DOM mutations from the task data re-upserts).

**Screenshot evidence:**
- `screenshots/03-polling-mode.png` — Polling mode idle state: "↻ Refresh" button visible
- `screenshots/04-refresh-loading.png` — During refresh: button replaced by spinner
- `screenshots/05-refresh-idle.png` — After refresh: button returns to normal

## Root Cause

### Primary: Refresh button loading animation (visible flicker)

**Files:** `web/src/components/ft-app.ts:89-95`, `web/src/components/ft-toolbar.ts:374-394`

`PollManager` dispatches `refresh-start` and `refresh-end` events. `ft-app` handles these by toggling `isRefreshing` (a `@state()` property):

```typescript
// ft-app.ts:89-95
private onPollRefreshEnd = ((e: CustomEvent) => {
    this.lastRefreshed = e.detail.lastRefreshed as Date;
    this.isRefreshing = false;
}) as EventListener;
private onPollRefreshStart = (() => {
    this.isRefreshing = true;
}) as EventListener;
```

This is passed to the toolbar: `?isRefreshing=${this.isRefreshing}` (ft-app.ts:263), which renders:

```typescript
// ft-toolbar.ts:378-383
<sl-button
    size="small"
    variant="default"
    ?loading=${this.isRefreshing}   // ← THIS toggles every poll cycle
    ?disabled=${this.isRefreshing}
    @click=${this.onRefreshClick}
>
```

Shoelace's `sl-button` with `loading=true` replaces the button content with a spinner animation, producing a visible flash. The `refresh-start` event fires before the `await listTasks()` call, and `refresh-end` fires after — so `isRefreshing` toggles on every poll cycle regardless of whether any data changed.

### Secondary: Unconditional `upsert()` fires unnecessary events (wasted work)

**File:** `web/src/store/task-store.ts:59-62`

```typescript
upsert(task: Task, _changes?: Change[]): void {
    this.tasks.set(task.id, task);
    this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { task } }));
}
```

No equality check. Every poll cycle, `PollManager.refresh()` upserts every non-dirty task with a new object (from the `listTasks()` response), firing N `tasks-changed` events even when nothing changed. Each event triggers `TaskStoreController.onChanged()` → `host.requestUpdate()` on every component with a controller (ft-app:78, ft-kanban-view:133, ft-tree-view:142).

**Measured impact (7-task seed DB):**
- Without equality check: 7 `tasks-changed` events + 1 `snapshot-complete` = 10 `requestUpdate()` calls per poll cycle
- With equality check: 0 `tasks-changed` events = 2 `requestUpdate()` calls (only from `isRefreshing`/`lastRefreshed` state changes)

At the current task count, Lit batches all `requestUpdate()` calls into 1 render cycle with 0 visible DOM mutations (Lit's efficient diffing). But this is O(N) wasted work per poll cycle and will scale poorly.

## Scope Confirmation

### ✅ 15s poll correctly gated to writable external collections

```typescript
// ft-app.ts:773-776
const interval = this.isExternalWritable
    ? 15_000
    : PollManager.DEFAULT_INTERVAL_MS;  // 30_000
```

`switchToPolling()` is called only when `StreamManager` receives a `watch-unsupported` event (WatchTasks returns gRPC `Unimplemented`), which is the correct signal for external platform collections.

### ⚠️ Read-only external collections also affected (at 30s interval)

Read-only external collections also fall through to the polling path (WatchTasks also returns Unimplemented for them). They experience the same Refresh button flicker at half the frequency (30s default interval).

### ✅ Native Farmtable collections NOT affected

Native Farmtable collections use `StreamManager` with WatchTasks (streaming). The `isPolling` state is never set, so no Refresh button is rendered, and no periodic `listTasks()` calls happen. The `upsert()` no-equality-check issue technically affects stream events too, but stream events only fire for actual changes.

## Recommended Approach

### Fix 1: Suppress Refresh button loading state for background polls (addresses visible flicker)

**Scope: XS** — 2 files, ~10 lines changed.

Option A (preferred): Remove the `?loading` attribute from the Refresh button entirely. The "Updated Xs ago" timestamp already indicates freshness. The button should only show loading on **manual** refresh clicks.

```typescript
// ft-app.ts — separate manual-refresh loading from auto-poll loading
private onPollRefreshStart = (() => {
    // Only show loading indicator for manual refreshes, not background polls
    // this.isRefreshing = true;  ← remove this
}) as EventListener;
```

Or better: track manual vs auto refresh separately. `isRefreshing` only sets true when the user clicks "Refresh".

Option B: Don't dispatch `refresh-start`/`refresh-end` events at all (the "Updated Xs ago" timestamp is sufficient feedback). Only show loading state when the user manually clicks Refresh.

### Fix 2: Add equality check to `TaskStore.upsert()` (addresses wasted work)

**Scope: XS** — 1 file, ~10 lines changed.

```typescript
// task-store.ts
upsert(task: Task, _changes?: Change[]): void {
    const existing = this.tasks.get(task.id);
    if (existing && !_changes && this.isEqual(existing, task)) return;  // skip if identical
    this.tasks.set(task.id, task);
    this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { task } }));
}

private isEqual(a: Task, b: Task): boolean {
    return JSON.stringify(a) === JSON.stringify(b);  // or a targeted field comparison
}
```

Note: When `_changes` is provided (from the stream path), always fire the event — the changes array indicates the server has seen a difference even if the serialized task looks the same.

### Fix 3 (optional): Suppress redundant `snapshotComplete` on subsequent polls

**Scope: XS** — 1 file, ~3 lines.

`PollManager.refresh()` calls `store.snapshotComplete()` on every cycle, but `_isLoading` is only meaningful on the first load. Subsequent calls fire a redundant `snapshot-complete` event. Could gate on `store.isLoading` to only call when transitioning from loading to loaded.

## Per-Object Change Events (User's Suggested Direction)

The user asked whether per-object change events would be cleaner than full sync-and-diff. The answer is nuanced:

- The server-side `WatchTasks` stream already provides per-object change events — this is the design for native Farmtable collections.
- For external platforms (GitHub), WatchTasks is unimplemented because GitHub doesn't provide real-time push notifications. The 15s poll + ListTasks is the correct fallback.
- GitHub webhooks could provide per-object change events, but that requires webhook infrastructure (a publicly reachable endpoint). This is a **Medium** scope feature, not a quick fix.
- The immediate fix (equality check in `upsert()`) achieves the same effect as per-object events: only tasks that actually changed trigger downstream re-renders.

**Recommendation:** Fix 1 + Fix 2 resolve the current issue. Per-object events via GitHub webhooks should be a separate project if polling latency becomes a concern.

## Open Questions

1. **Real GitHub collection timing:** The test used a native Farmtable collection with simulated polling. The actual ListTasks latency for a GitHub collection (which involves a live GitHub GraphQL API call) may be longer, making the Refresh button loading animation more prominent (visible for longer). This doesn't change the fix — it makes it more important.

2. **`lastRefreshed` update always re-renders:** Even with Fix 1 and Fix 2, `lastRefreshed = new Date()` triggers a `ft-app` re-render every poll cycle (new Date object → `ft-toolbar` gets a new prop → "Updated Xs ago" text updates). This is intentional and non-flickery (text change, no animation), but could be optimized by only updating if the displayed text would change.
