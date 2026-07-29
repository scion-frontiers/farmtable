import type { Task, Change, TaskStage } from '../gen/types.js';

/**
 * Key-order-independent JSON stringify for deep equality checks.
 * Standard JSON.stringify is sensitive to object key insertion order,
 * which can vary between gRPC responses due to non-deterministic
 * proto map serialization (e.g. google.protobuf.Struct fields).
 */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return '{' + keys
    .map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k]))
    .join(',') + '}';
}

export class TaskStore extends EventTarget {
  private tasks = new Map<string, Task>();
  private _childMap = new Map<string, Task[]>();
  private _allTasksCache: Task[] | null = null;
  private _rootsCache: Task[] | null = null;
  private _isLoading = true;

  get isLoading(): boolean {
    return this._isLoading;
  }

  /** Number of tasks currently in the store. */
  get taskCount(): number {
    return this.tasks.size;
  }

  get allTasks(): readonly Task[] {
    if (!this._allTasksCache) {
      this._allTasksCache = [...this.tasks.values()];
    }
    // Return a shallow copy so callers cannot mutate the cached array.
    return [...this._allTasksCache];
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id);
  }

  getByStage(stage: TaskStage): Task[] {
    return this.allTasks.filter((t) => t.stage === stage);
  }

  get byStage(): Map<TaskStage, Task[]> {
    const map = new Map<TaskStage, Task[]>();
    for (const task of this.tasks.values()) {
      const list = map.get(task.stage);
      if (list) {
        list.push(task);
      } else {
        map.set(task.stage, [task]);
      }
    }
    return map;
  }

  /** Cached parent→children index. O(1) lookup. */
  get byParent(): ReadonlyMap<string, readonly Task[]> {
    return this._childMap;
  }

  get roots(): readonly Task[] {
    if (!this._rootsCache) {
      this._rootsCache = [...this.allTasks.filter((t) => !t.parentTaskId)];
    }
    // Return a shallow copy so callers cannot mutate the cached array.
    return [...this._rootsCache];
  }

  /** O(1) child lookup via cached parent→children map. */
  getChildren(parentId: string): readonly Task[] {
    // Return a shallow copy so callers cannot mutate the cached array.
    return [...(this._childMap.get(parentId) ?? [])];
  }

  // ── Child-map maintenance ──

  private _addToChildMap(task: Task): void {
    if (task.parentTaskId) {
      const siblings = this._childMap.get(task.parentTaskId);
      if (siblings) {
        siblings.push(task);
      } else {
        this._childMap.set(task.parentTaskId, [task]);
      }
    }
  }

  private _removeFromChildMap(task: Task): void {
    if (task.parentTaskId) {
      const siblings = this._childMap.get(task.parentTaskId);
      if (siblings) {
        const idx = siblings.indexOf(task);
        if (idx >= 0) siblings.splice(idx, 1);
        if (siblings.length === 0) this._childMap.delete(task.parentTaskId);
      }
    }
  }

  private _invalidateCaches(): void {
    this._allTasksCache = null;
    this._rootsCache = null;
  }

  upsert(task: Task, _changes?: Change[]): boolean {
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

  delete(taskId: string): void {
    const existing = this.tasks.get(taskId);
    if (existing) {
      this._removeFromChildMap(existing);
    }
    this.tasks.delete(taskId);
    this._invalidateCaches();
    this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { taskId } }));
  }

  snapshotComplete(): void {
    this._isLoading = false;
    this.dispatchEvent(new CustomEvent('snapshot-complete'));
  }

  clear(): void {
    this.tasks.clear();
    this._childMap.clear();
    this._invalidateCaches();
    this._isLoading = true;
    this.dispatchEvent(new CustomEvent('tasks-changed'));
  }
}
