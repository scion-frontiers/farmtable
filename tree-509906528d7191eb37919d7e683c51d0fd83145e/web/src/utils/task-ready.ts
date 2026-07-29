import { TaskStore } from '../store/task-store.js';
import { RelationshipType, TaskStage } from '../gen/types.js';
import type { Task } from '../gen/types.js';

/**
 * Determine if a task is available for work under the task-state contract.
 * Server-computed availability is authoritative; the fallback only keeps local
 * mock data and older snapshots conservative.
 */
export function isReady(task: Task, store: TaskStore): boolean {
  if (task.availability) {
    return task.availability.available;
  }

  if (task.stage !== TaskStage.ACCEPTED) {
    return false;
  }
  if (task.assignees.length > 0) {
    return false;
  }
  if (task.holdReason !== undefined || hasFutureStartDate(task)) {
    return false;
  }
  for (const rel of task.relationships) {
    if (rel.type !== RelationshipType.BLOCKED_BY) continue;
    const blocker = store.getTask(rel.targetTaskId);
    if (blocker && blocker.stage !== TaskStage.COMPLETED) {
      return false;
    }
  }
  return true;
}

function hasFutureStartDate(task: Task): boolean {
  if (!task.startDate) return false;
  const start = new Date(task.startDate).getTime();
  return Number.isFinite(start) && start > Date.now();
}
