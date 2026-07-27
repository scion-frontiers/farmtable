import { AvailabilityReason, TaskHoldReason, TaskStage, type Task } from '../gen/types.js';
import type { TaskStore } from '../store/task-store.js';
import type { AvailabilityFilter, TaskGroupFilter } from '../util/task-state-utils.js';
import { attentionBlockers, hasAvailabilityReason, isClosedStage } from '../util/task-state-utils.js';

export const UNASSIGNED_FILTER_VALUE = '__unassigned';

export interface TaskFilterChangeDetail {
  group: TaskGroupFilter | null;
  stage: TaskStage | null;
  holdReason: TaskHoldReason | null;
  availability: AvailabilityFilter | null;
  assigneeId: string | null;
}

/**
 * Whether `task` survives the five contract filters.
 *
 * `store` is not a sixth filter — it is the resolution context the
 * `'attention'` availability value needs, because "blocked by an unsuccessful
 * terminal prerequisite" is a fact about the task's *blockers*, and only the
 * store can turn a relationship's `targetTaskId` into the blocker's stage. It
 * is required rather than optional on purpose: an optional store would let a
 * caller that forgot it silently answer "nothing needs attention", which is a
 * wrong answer that looks exactly like a correct one.
 *
 * The attention set is computed by the real `attentionBlockers()` and is never
 * re-derived here.
 */
export function matchesTaskFilters(
  task: Task,
  groupFilter: TaskGroupFilter | null,
  stageFilter: TaskStage | null,
  holdReasonFilter: TaskHoldReason | null,
  availabilityFilter: AvailabilityFilter | null,
  assigneeFilter: string | null,
  store: TaskStore,
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
  // No extra unavailability test: `attentionBlockers` already requires the
  // BLOCKED_BY_DEPENDENCY reason, so adding one here would be a second, local
  // model of what "needs attention" means.
  if (availabilityFilter === 'attention' && attentionBlockers(task, store).length === 0) {
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
