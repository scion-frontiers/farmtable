import { grpc } from '@improbable-eng/grpc-web';
import { GrpcError } from '../util/grpc-error.js';
import { TaskEventType } from '../gen/types.js';
/**
 * Returns true when a gRPC error carries the Unimplemented status code (12) —
 * the server-side signal that WatchTasks is not supported (e.g. external
 * platform collections).
 */
function isUnimplementedError(err) {
    return err instanceof GrpcError && err.code === grpc.Code.Unimplemented;
}
export class StreamManager extends EventTarget {
    constructor(client, store) {
        super();
        this.status = 'disconnected';
        this.sequence = 0n;
        this.attempt = 0;
        this.abortController = null;
        this.heartbeatTimer = null;
        this.reconnectTimer = null;
        this.client = client;
        this.store = store;
    }
    get connectionStatus() {
        return this.status;
    }
    async start() {
        this.stop();
        this.connect();
    }
    stop() {
        this.abortController?.abort();
        this.abortController = null;
        this.clearHeartbeat();
        this.clearReconnect();
        this.setStatus('disconnected');
    }
    async connect() {
        this.abortController = new AbortController();
        this.setStatus('connecting');
        try {
            this.setStatus('syncing');
            for await (const event of this.client.watchTasks(this.abortController.signal)) {
                if (this.abortController?.signal.aborted)
                    break;
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
                }
                else if (event.eventType === TaskEventType.HEARTBEAT) {
                    // heartbeat — timer already reset above
                }
                else if (event.eventType === TaskEventType.DELETED) {
                    this.store.delete(event.task.id);
                }
                else {
                    this.store.upsert(event.task, event.changes);
                }
            }
            if (!this.abortController?.signal.aborted) {
                this.scheduleReconnect();
            }
        }
        catch (err) {
            if (this.abortController?.signal.aborted)
                return;
            // Detect codes.Unimplemented — means the collection's platform store
            // does not support WatchTasks. Notify the app so it can fall back to
            // polling-based refresh.
            if (isUnimplementedError(err)) {
                console.info('WatchTasks returned Unimplemented — falling back to polling.');
                this.setStatus('disconnected');
                this.dispatchEvent(new CustomEvent('watch-unsupported'));
                return;
            }
            console.error('Stream error:', err);
            this.setStatus('error');
            this.scheduleReconnect();
        }
    }
    resync() {
        this.sequence = 0n;
        this.store.clear();
        this.attempt = 0;
        this.scheduleReconnect();
    }
    scheduleReconnect() {
        this.clearReconnect();
        const base = Math.min(Math.pow(2, this.attempt) * 100, 30_000);
        const jitter = Math.random() * base * 0.1;
        const delay = base + jitter;
        this.attempt++;
        this.setStatus('reconnecting');
        this.reconnectTimer = setTimeout(() => this.connect(), delay);
    }
    resetHeartbeat() {
        this.clearHeartbeat();
        this.heartbeatTimer = setTimeout(() => {
            console.warn('Heartbeat timeout — no events for 45s. Reconnecting.');
            this.resync();
        }, StreamManager.HEARTBEAT_TIMEOUT);
    }
    clearHeartbeat() {
        if (this.heartbeatTimer) {
            clearTimeout(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }
    clearReconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }
    setStatus(status) {
        if (this.status === status)
            return;
        this.status = status;
        this.dispatchEvent(new CustomEvent('status-changed', { detail: { status } }));
    }
}
StreamManager.HEARTBEAT_TIMEOUT = 45_000;
//# sourceMappingURL=stream-manager.js.map