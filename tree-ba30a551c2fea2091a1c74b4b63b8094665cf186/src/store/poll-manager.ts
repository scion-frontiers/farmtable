import type { FarmTableServiceClient } from '../gen/service.js';
import type { TaskStore } from './task-store.js';

export type PollStatus = 'idle' | 'polling' | 'error';

/**
 * PollManager periodically fetches the full task list via ListTasks and pushes
 * results into the TaskStore.  It is the fallback data source for external
 * collections whose platform stores do not implement WatchTasks.
 */
export class PollManager extends EventTarget {
  private client: FarmTableServiceClient;
  private store: TaskStore;
  private intervalMs: number;

  private status: PollStatus = 'idle';
  private timer: ReturnType<typeof setInterval> | null = null;
  private _lastRefreshed: Date | null = null;
  private _isRefreshing = false;
  private pollToken = 0;

  /** Default polling interval: 30 seconds. */
  static DEFAULT_INTERVAL_MS = 30_000;

  constructor(
    client: FarmTableServiceClient,
    store: TaskStore,
    intervalMs: number = PollManager.DEFAULT_INTERVAL_MS,
  ) {
    super();
    this.client = client;
    this.store = store;
    this.intervalMs = intervalMs;
  }

  /** Current status of the poller. */
  get pollStatus(): PollStatus {
    return this.status;
  }

  /** Timestamp of the last successful refresh, or null if not yet refreshed. */
  get lastRefreshed(): Date | null {
    return this._lastRefreshed;
  }

  /** True while a ListTasks request is in-flight. */
  get isRefreshing(): boolean {
    return this._isRefreshing;
  }

  /**
   * Start polling.  Performs an initial fetch immediately, then repeats on
   * the configured interval.
   */
  async start(): Promise<void> {
    this.stop();
    await this.refresh();
    this.timer = setInterval(() => void this.refresh(), this.intervalMs);
  }

  /** Stop polling and clean up the interval timer. */
  stop(): void {
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
  async refresh(): Promise<void> {
    if (this._isRefreshing) return;

    const token = ++this.pollToken;
    this._isRefreshing = true;
    this.setStatus('polling');
    this.dispatchEvent(new CustomEvent('refresh-start'));

    try {
      const tasks = await this.client.listTasks();

      // Guard against stale responses when stop() was called mid-flight.
      if (token !== this.pollToken) return;

      // Replace the store contents with the fresh snapshot.
      this.store.clear();
      for (const task of tasks) {
        this.store.upsert(task);
      }
      this.store.snapshotComplete();

      this._lastRefreshed = new Date();
      this._isRefreshing = false;
      this.setStatus('idle');
      this.dispatchEvent(new CustomEvent('refresh-end', { detail: { lastRefreshed: this._lastRefreshed } }));
    } catch (err) {
      if (token !== this.pollToken) return;

      console.error('Poll refresh failed:', err);
      this._isRefreshing = false;
      this.setStatus('error');
      this.dispatchEvent(new CustomEvent('refresh-error', { detail: { error: err } }));
    }
  }

  private setStatus(status: PollStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.dispatchEvent(new CustomEvent('status-changed', { detail: { status } }));
  }
}
