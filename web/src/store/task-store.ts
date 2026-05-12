import type { Task, Change, TaskStage } from '../gen/types.js';

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

  upsert(task: Task, _changes?: Change[]): void {
    this.tasks.set(task.id, task);
    this.dispatchEvent(new CustomEvent('tasks-changed', { detail: { task } }));
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
