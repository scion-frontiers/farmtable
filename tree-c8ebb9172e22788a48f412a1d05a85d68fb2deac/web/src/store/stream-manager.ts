import type { FarmTableServiceClient } from '../gen/service.js';
import { TaskEventType } from '../gen/types.js';
import type { TaskStore } from './task-store.js';

export type ConnectionStatus = 'connecting' | 'syncing' | 'live' | 'disconnected' | 'error' | 'reconnecting' | 'polling';

/**
 * Returns true when a gRPC error message indicates codes.Unimplemented \u2014 the
 * server-side signal that WatchTasks is not supported (e.g. external platform
 * collections).
 */
function isUnimplementedError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return (
    msg.includes('Unimplemented') ||
    msg.includes('code 12') ||
    msg.includes('code 12:') ||
    /gRPC.*(?:failed|error).*\b12\b/.test(msg)
  );
}

export class StreamManager extends EventTarget {
  private client: FarmTableServiceClient;
  private store: TaskStore;
  private status: ConnectionStatus = 'disconnected';
  private sequence = 0n;
  private attempt = 0;
  private abortController: AbortController | null = null;
  private heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  private static HEARTBEAT_TIMEOUT = 45_000;

  constructor(client: FarmTableServiceClient, store: TaskStore) {
    super();
    this.client = client;
    this.store = store;
  }

  get connectionStatus(): ConnectionStatus {
    return this.status;
  }

  async start(): Promise<void> {
    this.stop();
    this.connect();
  }

  stop(): void {
    this.abortController?.abort();
    this.abortController = null;
    this.clearHeartbeat();
    this.clearReconnect();
    this.setStatus('disconnected');
  }

  private async connect(): Promise<void> {
    this.abortController = new AbortController();
    this.setStatus('connecting');

    try {
      this.setStatus('syncing');

      for await (const event of this.client.watchTasks(this.abortController.signal)) {
        if (this.abortController?.signal.aborted) break;

        this.resetHeartbeat();

        if (event.sequence !== this.sequence + 1n && this.sequence !== 0n) {
          console.warn(`Sequence gap: expected ${this.sequence + 1n}, got ${event.sequence}. Resyncing.`);
          this.resync();
          return;
        }
        this.sequence = event.sequence;

        if (event.eventType === TaskEventType.SNAPSHOT_COMPLETE) {
          this.store.snapshotComplete();
          this.attempt = 0;
          this.setStatus('live');
        } else if (event.eventType === TaskEventType.HEARTBEAT) {
          // heartbeat \u2014 timer already reset above
        } else if (event.eventType === TaskEventType.DELETED) {
          this.store.delete(event.task.id);
        } else {
          this.store.upsert(event.task, event.changes);
        }
      }

      if (!this.abortController?.signal.aborted) {
        this.scheduleReconnect();
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) return;

      // Detect codes.Unimplemented \u2014 means the collection's platform store
      // does not support WatchTasks. Notify the app so it can fall back to
      // polling-based refresh.
      if (isUnimplementedError(err)) {
        console.info('WatchTasks returned Unimplemented \u2014 falling back to polling.');
        this.setStatus('disconnected');
        this.dispatchEvent(new CustomEvent('watch-unsupported'));
        return;
      }

      console.error('Stream error:', err);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private resync(): void {
    this.sequence = 0n;
    this.store.clear();
    this.attempt = 0;
    this.scheduleReconnect();
  }

  private scheduleReconnect(): void {
    this.clearReconnect();
    const base = Math.min(Math.pow(2, this.attempt) * 100, 30_000);
    const jitter = Math.random() * base * 0.1;
    const delay = base + jitter;
    this.attempt++;
    this.setStatus('reconnecting');
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  private resetHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatTimer = setTimeout(() => {
      console.warn('Heartbeat timeout \u2014 no events for 45s. Reconnecting.');
      this.resync();
    }, StreamManager.HEARTBEAT_TIMEOUT);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearTimeout(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status === status) return;
    this.status = status;
    this.dispatchEvent(new CustomEvent('status-changed', { detail: { status } }));
  }
}
