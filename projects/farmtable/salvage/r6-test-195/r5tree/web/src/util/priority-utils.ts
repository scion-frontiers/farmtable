import { TaskPriority } from '../gen/types.js';

/** Maps TaskPriority enum values to Shoelace badge variant names. */
export const PRIORITY_VARIANT: Record<number, string> = {
  [TaskPriority.UNSPECIFIED]: 'neutral',
  [TaskPriority.URGENT]: 'danger',
  [TaskPriority.HIGH]: 'warning',
  [TaskPriority.NORMAL]: 'primary',
  [TaskPriority.LOW]: 'neutral',
};

/** Maps TaskPriority enum values to human-readable labels. */
export const PRIORITY_LABEL: Record<number, string> = {
  [TaskPriority.UNSPECIFIED]: 'No priority',
  [TaskPriority.URGENT]: 'Urgent',
  [TaskPriority.HIGH]: 'High',
  [TaskPriority.NORMAL]: 'Normal',
  [TaskPriority.LOW]: 'Low',
};
