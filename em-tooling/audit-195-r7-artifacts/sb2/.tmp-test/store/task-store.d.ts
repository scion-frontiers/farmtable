import type { Task, Change, TaskStage } from '../gen/types.js';
export declare class TaskStore extends EventTarget {
    private tasks;
    private _childMap;
    private _allTasksCache;
    private _rootsCache;
    private _isLoading;
    get isLoading(): boolean;
    /** Number of tasks currently in the store. */
    get taskCount(): number;
    get allTasks(): readonly Task[];
    getTask(id: string): Task | undefined;
    getByStage(stage: TaskStage): Task[];
    get byStage(): Map<TaskStage, Task[]>;
    /** Cached parent→children index. O(1) lookup. */
    get byParent(): ReadonlyMap<string, readonly Task[]>;
    get roots(): readonly Task[];
    /** O(1) child lookup via cached parent→children map. */
    getChildren(parentId: string): readonly Task[];
    private _addToChildMap;
    private _removeFromChildMap;
    private _invalidateCaches;
    upsert(task: Task, _changes?: Change[]): boolean;
    delete(taskId: string): void;
    snapshotComplete(): void;
    clear(): void;
}
