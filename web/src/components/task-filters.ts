import { AvailabilityReason, TaskHoldReason, TaskStage, type Task } from '../gen/types.js';
import type { AvailabilityFilter, TaskGroupFilter } from '../util/task-state-utils.js';
import { hasAvailabilityReason, isClosedStage } from '../util/task-state-utils.js';

export const UNASSIGNED_FILTER_VALUE = '__unassigned';

export interface TaskFilterChangeDetail {
  group: TaskGroupFilter | null;
  stage: TaskStage | null;
  holdReason: TaskHoldReason | null;
  availability: AvailabilityFilter | null;
  assigneeId: string | null;
}

export function matchesTaskFilters(
  task: Task,
  groupFilter: TaskGroupFilter | null,
  stageFilter: TaskStage | null,
  holdReasonFilter: TaskHoldReason | null,
  availabilityFilter: AvailabilityFilter | null,
  assigneeFilter: string | null,
): boolean {
  if (groupFilter === 'active' && isClosedStage(task.stage)) {
    return false;
  }
  if (groupFilter === 'closed' && !isClosedStage(task.stage)) {
    return false;
  }

  if (stageFilter !== null && task.stage !== stageFilter) {
    return false;
  }

  const taskHoldReason = task.holdReason ?? TaskHoldReason.UNSPECIFIED;
  if (holdReasonFilter !== null && taskHoldReason !== holdReasonFilter) {
    return false;
  }

  if (availabilityFilter === 'available' && task.availability?.available !== true) {
    return false;
  }
  if (availabilityFilter === 'unavailable' && task.availability?.available !== false) {
    return false;
  }
  if (
    typeof availabilityFilter === 'number' &&
    availabilityFilter !== AvailabilityReason.UNSPECIFIED &&
    !hasAvailabilityReason(task, availabilityFilter)
  ) {
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
