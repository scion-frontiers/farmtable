import { TaskStore } from '../store/task-store.js';
import type { Task } from '../gen/types.js';
/**
 * Determine if a task is available for work under the Phase 1 task-state model.
 */
export declare function isReady(task: Task, store: TaskStore): boolean;
