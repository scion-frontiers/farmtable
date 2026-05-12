import type { FarmTableServiceClient } from '../gen/service.js';
import { TaskEventType } from '../gen/types.js';
import type { TaskStore } from './task-store.js';

export type ConnectionStatus = 'connecting' | 'connected' | 'syncing' | 'live' | 'disconnected' | 'error' | 'reconnecting';

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
      this.resetHeartbeat();

      for await (const event of this.client.watchTasks()) {
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
          // heartbeat — timer already reset above
        } else if (event.eventType === TaskEventType.DELETED) {
          this.store.delete(event.task.id);
        } else {
          this.store.upsert(event.task, event.changes);
        }
      }
    } catch (err) {
      if (this.abortController?.signal.aborted) return;
      console.error('Stream error:', err);
      this.setStatus('error');
      this.scheduleReconnect();
    }
  }

  private resync(): void {
    this.sequence = 0n;
    this.store.clear();
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
      console.warn('Heartbeat timeout — no events for 45s. Reconnecting.');
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
