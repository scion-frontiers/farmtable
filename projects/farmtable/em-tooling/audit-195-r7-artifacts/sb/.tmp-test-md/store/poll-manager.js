/**
 * PollManager periodically fetches the full task list via ListTasks and pushes
 * results into the TaskStore.  It is the fallback data source for external
 * collections whose platform stores do not implement WatchTasks.
 */
export class PollManager extends EventTarget {
    constructor(client, store, intervalMs = PollManager.DEFAULT_INTERVAL_MS) {
        super();
        this.status = 'idle';
        this.timer = null;
        this._lastRefreshed = null;
        this._isRefreshing = false;
        this.pollToken = 0;
        /** Task IDs with in-flight writes — sweep skips these (reference-counted). */
        this.dirtyTasks = new Map();
        this.client = client;
        this.store = store;
        this.intervalMs = intervalMs;
    }
    /** Current status of the poller. */
    get pollStatus() {
        return this.status;
    }
    /** Timestamp of the last successful refresh, or null if not yet refreshed. */
    get lastRefreshed() {
        return this._lastRefreshed;
    }
    /** True while a ListTasks request is in-flight. */
    get isRefreshing() {
        return this._isRefreshing;
    }
    /** Mark a task as dirty (in-flight write). Sweep skips dirty tasks. */
    markDirty(taskId) {
        this.dirtyTasks.set(taskId, (this.dirtyTasks.get(taskId) ?? 0) + 1);
    }
    /** Clear dirty flag (write completed or rolled back). */
    clearDirty(taskId) {
        const count = (this.dirtyTasks.get(taskId) ?? 0) - 1;
        if (count <= 0) {
            this.dirtyTasks.delete(taskId);
        }
        else {
            this.dirtyTasks.set(taskId, count);
        }
    }
    /**
     * Start polling.  Performs an initial fetch immediately, then repeats on
     * the configured interval.
     */
    async start() {
        this.stop();
        await this.refresh();
        this.timer = setInterval(() => void this.refresh(), this.intervalMs);
    }
    /** Update the polling interval. Restarts the timer if currently running. */
    setInterval(ms) {
        this.intervalMs = ms;
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = setInterval(() => void this.refresh(), this.intervalMs);
        }
    }
    /** Stop polling and clean up the interval timer. */
    stop() {
        if (this.timer !== null) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.pollToken++;
        this._isRefreshing = false;
        this.setStatus('idle');
    }
    /**
     * Manually trigger a single ListTasks fetch.  De-duplicates concurrent
     * calls — if a refresh is already in-flight, the call is a no-op.
     */
    async refresh() {
        if (this._isRefreshing)
            return;
        const token = ++this.pollToken;
        this._isRefreshing = true;
        this.setStatus('polling');
        this.dispatchEvent(new CustomEvent('refresh-start'));
        try {
            const tasks = await this.client.listTasks();
            // Guard against stale responses when stop() was called mid-flight.
            if (token !== this.pollToken)
                return;
            // Merge-based refresh: update non-dirty tasks, remove stale ones.
            // This avoids overwriting in-flight optimistic updates and prevents
            // the brief "empty board" flash that clear() causes.
            const freshIds = new Set();
            let anyChanged = false;
            for (const task of tasks) {
                freshIds.add(task.id);
                if (!this.dirtyTasks.has(task.id)) {
                    if (this.store.upsert(task)) {
                        anyChanged = true;
                    }
                }
            }
            // Remove tasks that are gone from the remote source
            // (but not dirty ones — they may have just been created or updated).
            for (const existing of this.store.allTasks) {
                if (!freshIds.has(existing.id) && !this.dirtyTasks.has(existing.id)) {
                    this.store.delete(existing.id);
                    anyChanged = true;
                }
            }
            // Only fire snapshot-complete if data actually changed or this is initial load
            if (anyChanged || this.store.isLoading) {
                this.store.snapshotComplete();
            }
            this._lastRefreshed = new Date();
            this._isRefreshing = false;
            this.setStatus('idle');
            this.dispatchEvent(new CustomEvent('refresh-end', { detail: { lastRefreshed: this._lastRefreshed } }));
        }
        catch (err) {
            if (token !== this.pollToken)
                return;
            console.error('Poll refresh failed:', err);
            this._isRefreshing = false;
            this.setStatus('error');
            this.dispatchEvent(new CustomEvent('refresh-error', { detail: { error: err } }));
        }
    }
    setStatus(status) {
        if (this.status === status)
            return;
        this.status = status;
        this.dispatchEvent(new CustomEvent('status-changed', { detail: { status } }));
    }
}
/** Default polling interval: 30 seconds. */
PollManager.DEFAULT_INTERVAL_MS = 30_000;
//# sourceMappingURL=poll-manager.js.map