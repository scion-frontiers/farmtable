import { TaskStore } from '../store/task-store.js';
import { RelationshipType, TaskPhase } from '../gen/types.js';
import type { Task } from '../gen/types.js';

/**
 * Determine if a task is "ready" (unblocked).
 * Phase is OPEN or IN_PROGRESS, and no BLOCKED_BY relationship targets a non-CLOSED task.
 */
export function isReady(task: Task, store: TaskStore): boolean {
  if (task.phase !== TaskPhase.OPEN && task.phase !== TaskPhase.IN_PROGRESS) {
    return false;
  }
  for (const rel of task.relationships) {
    if (rel.type !== RelationshipType.BLOCKED_BY) continue;
    const blocker = store.getTask(rel.targetTaskId);
    if (blocker && blocker.phase !== TaskPhase.CLOSED) {
      return false;
    }
  }
  return true;
}
