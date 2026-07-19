import { RelationshipType, TaskStage } from '../../gen/types.js';

export const STAGE_LABEL: Record<number, string> = {
  [TaskStage.TRIAGE]: 'Triage',
  [TaskStage.BACKLOG]: 'Backlog',
  [TaskStage.READY]: 'Ready',
  [TaskStage.WORKING]: 'Working',
  [TaskStage.IN_REVIEW]: 'In Review',
  [TaskStage.IN_QA]: 'In QA',
  [TaskStage.DEPLOYING]: 'Deploying',
  [TaskStage.BLOCKED]: 'Blocked',
  [TaskStage.WAITING_FOR_INPUT]: 'Waiting',
  [TaskStage.DEFERRED]: 'Deferred',
  [TaskStage.SCHEDULED]: 'Scheduled',
  [TaskStage.COMPLETED]: 'Completed',
  [TaskStage.WONT_FIX]: "Won't Fix",
  [TaskStage.DUPLICATE]: 'Duplicate',
  [TaskStage.CANCELLED]: 'Cancelled',
};

export const STAGE_COLOR: Record<number, string> = {
  [TaskStage.TRIAGE]: 'var(--ft-stage-triage)',
  [TaskStage.BACKLOG]: 'var(--ft-stage-backlog)',
  [TaskStage.READY]: 'var(--ft-stage-ready)',
  [TaskStage.WORKING]: 'var(--ft-stage-working)',
  [TaskStage.IN_REVIEW]: 'var(--ft-stage-in-review)',
  [TaskStage.IN_QA]: 'var(--ft-stage-in-qa)',
  [TaskStage.DEPLOYING]: 'var(--ft-stage-deploying)',
  [TaskStage.BLOCKED]: 'var(--ft-stage-blocked)',
  [TaskStage.COMPLETED]: 'var(--ft-stage-completed)',
  [TaskStage.CANCELLED]: 'var(--ft-stage-cancelled)',
};

export const REL_GROUP_LABEL: Record<number, string> = {
  [RelationshipType.BLOCKED_BY]: 'Blocked by',
  [RelationshipType.BLOCKS]: 'Blocks',
  [RelationshipType.RELATED]: 'Related',
  [RelationshipType.DUPLICATE]: 'Duplicate of',
};

export const REL_GROUP_ORDER = [
  RelationshipType.BLOCKED_BY,
  RelationshipType.BLOCKS,
  RelationshipType.RELATED,
  RelationshipType.DUPLICATE,
];
