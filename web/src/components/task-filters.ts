import type { TaskPhase } from '../gen/types.js';

export const UNASSIGNED_FILTER_VALUE = '__unassigned';

export interface TaskFilterChangeDetail {
  phase: TaskPhase | null;
  assigneeId: string | null;
}
