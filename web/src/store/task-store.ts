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
  private _isLoading = true;

  get isLoading(): boolean {
    return this._isLoading;
  }

  get allTasks(): Task[] {
    return [...this.tasks.values()];
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

  get byParent(): Map<string, Task[]> {
    const map = new Map<string, Task[]>();
    for (const task of this.tasks.values()) {
      if (task.parentTaskId) {
        const list = map.get(task.parentTaskId);
        if (list) {
          list.push(task);
        } else {
          map.set(task.parentTaskId, [task]);
        }
      }
    }
    return map;
  }

  get roots(): Task[] {
    return this.allTasks.filter((t) => !t.parentTaskId);
  }

  getChildren(parentId: string): Task[] {
    return this.allTasks.filter((t) => t.parentTaskId === parentId);
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
    this.tasks.set(task.id, task);
    this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { task } }));
    return true;
  }

  delete(taskId: string): void {
    this.tasks.delete(taskId);
    this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { taskId } }));
  }

  snapshotComplete(): void {
    this._isLoading = false;
    this.dispatchEvent(new CustomEvent('snapshot-complete'));
  }

  clear(): void {
    this.tasks.clear();
    this._isLoading = true;
    this.dispatchEvent(new CustomEvent('tasks-changed'));
  }
}
