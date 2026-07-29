/**
 * Key-order-independent JSON stringify for deep equality checks.
 * Standard JSON.stringify is sensitive to object key insertion order,
 * which can vary between gRPC responses due to non-deterministic
 * proto map serialization (e.g. google.protobuf.Struct fields).
 */
function stableStringify(value) {
    if (value === null || value === undefined)
        return String(value);
    if (typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value)) {
        return '[' + value.map(stableStringify).join(',') + ']';
    }
    const obj = value;
    const keys = Object.keys(obj).sort();
    return '{' + keys
        .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
        .join(',') + '}';
}
export class TaskStore extends EventTarget {
    constructor() {
        super(...arguments);
        this.tasks = new Map();
        this._childMap = new Map();
        this._allTasksCache = null;
        this._rootsCache = null;
        this._isLoading = true;
    }
    get isLoading() {
        return this._isLoading;
    }
    /** Number of tasks currently in the store. */
    get taskCount() {
        return this.tasks.size;
    }
    get allTasks() {
        if (!this._allTasksCache) {
            this._allTasksCache = [...this.tasks.values()];
        }
        // Return a shallow copy so callers cannot mutate the cached array.
        return [...this._allTasksCache];
    }
    getTask(id) {
        return this.tasks.get(id);
    }
    getByStage(stage) {
        return this.allTasks.filter((t) => t.stage === stage);
    }
    get byStage() {
        const map = new Map();
        for (const task of this.tasks.values()) {
            const list = map.get(task.stage);
            if (list) {
                list.push(task);
            }
            else {
                map.set(task.stage, [task]);
            }
        }
        return map;
    }
    /** Cached parent→children index. O(1) lookup. */
    get byParent() {
        return this._childMap;
    }
    get roots() {
        if (!this._rootsCache) {
            this._rootsCache = [...this.allTasks.filter((t) => !t.parentTaskId)];
        }
        // Return a shallow copy so callers cannot mutate the cached array.
        return [...this._rootsCache];
    }
    /** O(1) child lookup via cached parent→children map. */
    getChildren(parentId) {
        // Return a shallow copy so callers cannot mutate the cached array.
        return [...(this._childMap.get(parentId) ?? [])];
    }
    // ── Child-map maintenance ──
    _addToChildMap(task) {
        if (task.parentTaskId) {
            const siblings = this._childMap.get(task.parentTaskId);
            if (siblings) {
                siblings.push(task);
            }
            else {
                this._childMap.set(task.parentTaskId, [task]);
            }
        }
    }
    _removeFromChildMap(task) {
        if (task.parentTaskId) {
            const siblings = this._childMap.get(task.parentTaskId);
            if (siblings) {
                const idx = siblings.indexOf(task);
                if (idx >= 0)
                    siblings.splice(idx, 1);
                if (siblings.length === 0)
                    this._childMap.delete(task.parentTaskId);
            }
        }
    }
    _invalidateCaches() {
        this._allTasksCache = null;
        this._rootsCache = null;
    }
    upsert(task, _changes) {
        // Skip re-dispatch when the incoming task is identical to the stored one.
        // Bypass this check when _changes are provided (streaming events) since
        // those indicate a confirmed server-side mutation that listeners must process.
        // Uses stableStringify (key-order-independent) instead of JSON.stringify
        // because proto map fields (e.g. remoteData from google.protobuf.Struct)
        // can arrive with non-deterministic key ordering between poll responses.
        const existing = this.tasks.get(task.id);
        if (existing && !_changes && stableStringify(existing) === stableStringify(task)) {
            return false;
        }
        // Maintain child map: remove old entry, add new one.
        if (existing) {
            this._removeFromChildMap(existing);
        }
        this.tasks.set(task.id, task);
        this._addToChildMap(task);
        this._invalidateCaches();
        this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { task } }));
        return true;
    }
    delete(taskId) {
        const existing = this.tasks.get(taskId);
        if (existing) {
            this._removeFromChildMap(existing);
        }
        this.tasks.delete(taskId);
        this._invalidateCaches();
        this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { taskId } }));
    }
    snapshotComplete() {
        this._isLoading = false;
        this.dispatchEvent(new CustomEvent('snapshot-complete'));
    }
    clear() {
        this.tasks.clear();
        this._childMap.clear();
        this._invalidateCaches();
        this._isLoading = true;
        this.dispatchEvent(new CustomEvent('tasks-changed'));
    }
}
//# sourceMappingURL=task-store.js.map