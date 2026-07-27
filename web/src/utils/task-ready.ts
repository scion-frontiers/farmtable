import { TaskStore } from '../store/task-store.js';
import { RelationshipType, TaskPhase, TaskStage } from '../gen/types.js';
import type { Task } from '../gen/types.js';

/**
 * Determine if a task is available for work under the Phase 1 task-state model.
 */
export function isReady(task: Task, store: TaskStore): boolean {
  if (task.availability) {
    return task.availability.available;
  }

  if (task.phase !== TaskPhase.OPEN && task.phase !== TaskPhase.IN_PROGRESS) {
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
