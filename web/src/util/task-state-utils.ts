import {
  AvailabilityReason,
  RelationshipType,
  TaskHoldReason,
  TaskPriority,
  TaskStage,
  type Task,
} from '../gen/types.js';
import type { TaskStore } from '../store/task-store.js';

export type TaskGroupFilter = 'active' | 'closed';
export type AvailabilityFilter = 'available' | 'unavailable' | AvailabilityReason;

export const ACTIVE_STAGE_OPTIONS = [
  TaskStage.TRIAGE,
  TaskStage.ACCEPTED,
  TaskStage.WORKING,
  TaskStage.IN_REVIEW,
  TaskStage.IN_QA,
  TaskStage.DEPLOYING,
] as const;

export const CLOSED_STAGE_OPTIONS = [
  TaskStage.COMPLETED,
  TaskStage.WONT_FIX,
  TaskStage.DUPLICATE,
  TaskStage.CANCELLED,
] as const;

export const NATIVE_STAGE_OPTIONS = [
  ...ACTIVE_STAGE_OPTIONS,
  ...CLOSED_STAGE_OPTIONS,
] as const;

export const STAGE_LABEL: Record<number, string> = {
  [TaskStage.TRIAGE]: 'Triage',
  [TaskStage.ACCEPTED]: 'Accepted',
  [TaskStage.WORKING]: 'Working',
  [TaskStage.IN_REVIEW]: 'In Review',
  [TaskStage.IN_QA]: 'In QA',
  [TaskStage.DEPLOYING]: 'Deploying',
  [TaskStage.COMPLETED]: 'Completed',
  [TaskStage.WONT_FIX]: "Won't Fix",
  [TaskStage.DUPLICATE]: 'Duplicate',
  [TaskStage.CANCELLED]: 'Cancelled',
};

export const STAGE_COLOR: Record<number, string> = {
  [TaskStage.TRIAGE]: 'var(--ft-stage-triage)',
  [TaskStage.ACCEPTED]: 'var(--ft-stage-accepted)',
  [TaskStage.WORKING]: 'var(--ft-stage-working)',
  [TaskStage.IN_REVIEW]: 'var(--ft-stage-in-review)',
  [TaskStage.IN_QA]: 'var(--ft-stage-in-qa)',
  [TaskStage.DEPLOYING]: 'var(--ft-stage-deploying)',
  [TaskStage.COMPLETED]: 'var(--ft-stage-completed)',
  [TaskStage.WONT_FIX]: 'var(--ft-stage-wont-fix)',
  [TaskStage.DUPLICATE]: 'var(--ft-stage-duplicate)',
  [TaskStage.CANCELLED]: 'var(--ft-stage-cancelled)',
};

export const HOLD_REASON_LABEL: Record<number, string> = {
  [TaskHoldReason.WAITING_FOR_INPUT]: 'Waiting for input',
  [TaskHoldReason.DEFERRED]: 'Deferred',
};

export const AVAILABILITY_REASON_LABEL: Record<number, string> = {
  [AvailabilityReason.TRIAGE]: 'Triage',
  [AvailabilityReason.TERMINAL]: 'Terminal',
  [AvailabilityReason.HELD]: 'Held',
  [AvailabilityReason.BLOCKED_BY_DEPENDENCY]: 'Blocked by dependency',
  [AvailabilityReason.FUTURE_START_DATE]: 'Future start date',
};

export function isClosedStage(stage: TaskStage): boolean {
  return CLOSED_STAGE_OPTIONS.includes(stage as (typeof CLOSED_STAGE_OPTIONS)[number]);
}

/**
 * Whether a board lane accepts a drag-and-drop stage change.
 *
 * `wont_fix`, `duplicate` and `cancelled` carry semantics a drag gesture
 * cannot express (a reason, a duplicate target), so the board renders those
 * lanes — the stage filter needs a visible destination — but refuses drops
 * onto them. The refusal is surfaced to the user, never silent.
 */
export function acceptsStageDrop(stage: TaskStage): boolean {
  return !isClosedStage(stage) || stage === TaskStage.COMPLETED;
}

export function isUnsuccessfulTerminalStage(stage: TaskStage): boolean {
  return stage === TaskStage.WONT_FIX || stage === TaskStage.CANCELLED || stage === TaskStage.DUPLICATE;
}

export function availabilityLabel(task: Task): string {
  if (task.availability?.available) return 'Available';
  const reasons = task.availability?.reasons.filter((reason) => reason !== AvailabilityReason.UNSPECIFIED) ?? [];
  if (reasons.length === 0) return 'Unavailable';
  return reasons.map((reason) => AVAILABILITY_REASON_LABEL[reason] ?? String(reason)).join(', ');
}

export function holdReasonLabel(reason: TaskHoldReason | undefined): string {
  if (reason === undefined || reason === TaskHoldReason.UNSPECIFIED) return '';
  return HOLD_REASON_LABEL[reason] ?? String(reason);
}

export function hasAvailabilityReason(task: Task, reason: AvailabilityReason): boolean {
  return task.availability?.reasons.includes(reason) ?? false;
}

export function priorityRank(priority?: TaskPriority): number {
  if (priority === undefined || priority === TaskPriority.UNSPECIFIED) return 99;
  return priority;
}

export function compareAcceptedQueueOrder(a: Task, b: Task): number {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;

  const aRank = a.rank ?? Number.POSITIVE_INFINITY;
  const bRank = b.rank ?? Number.POSITIVE_INFINITY;
  if (aRank !== bRank) return aRank - bRank;

  const createdDelta = a.createdAt.localeCompare(b.createdAt);
  if (createdDelta !== 0) return createdDelta;

  return a.id.localeCompare(b.id);
}

export function attentionBlockers(task: Task, store: TaskStore): Task[] {
  if (!hasAvailabilityReason(task, AvailabilityReason.BLOCKED_BY_DEPENDENCY)) return [];

  const blockers: Task[] = [];
  for (const rel of task.relationships) {
    if (rel.type !== RelationshipType.BLOCKED_BY) continue;
    const blocker = store.getTask(rel.targetTaskId);
    if (blocker && isUnsuccessfulTerminalStage(blocker.stage)) {
      blockers.push(blocker);
    }
  }
  return blockers;
}
