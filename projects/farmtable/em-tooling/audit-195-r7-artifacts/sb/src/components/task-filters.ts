import type { Task, TaskPhase } from '../gen/types.js';

export const UNASSIGNED_FILTER_VALUE = '__unassigned';

export interface TaskFilterChangeDetail {
  phase: TaskPhase | null;
  assigneeId: string | null;
}

export function matchesTaskFilters(
  task: Task,
  phaseFilter: TaskPhase | null,
  assigneeFilter: string | null,
): boolean {
  if (phaseFilter !== null && task.phase !== phaseFilter) {
    return false;
  }

  if (!assigneeFilter) {
    return true;
  }

  if (assigneeFilter === UNASSIGNED_FILTER_VALUE) {
    return task.assignees.length === 0;
  }

  return task.assignees.some((assignee) => assignee.id === assigneeFilter);
}
