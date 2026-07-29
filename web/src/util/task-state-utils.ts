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

/**
 * What the Availability control filters by.
 *
 * `'attention'` is a REFINEMENT of `AvailabilityReason.BLOCKED_BY_DEPENDENCY`,
 * not a sibling of it: `attentionBlockers()` short-circuits unless that reason
 * is present, so the attention set is always a strict subset of the
 * dependency-blocked set. It belongs in this union rather than in a filter
 * parameter of its own precisely because of that containment — the user picks
 * it from the same control, one line below the reason it narrows.
 */
export type AvailabilityFilter = 'available' | 'unavailable' | 'attention' | AvailabilityReason;

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

/**
 * Why a drag is refused — on the board (a stage drop) or in the queue (a rank
 * reorder).
 *
 * `ft-kanban-column` renders the board entries as a hover affordance,
 * `ft-kanban-view` reports them as a toast after a drop, and
 * `ft-ready-queue-view` reports the queue entries the same way. They live here,
 * next to `acceptsStageDrop()` — the rule the board half explains — so the
 * tooltip and the toast cannot drift apart, and so both halves of the refusal
 * seam bind to an exported constant rather than to an inline literal.
 *
 * The two terminal-lane variants are deliberately worded differently: the hint
 * is read *before* the gesture and names the lane, while the toast is read
 * *after* it and has to explain why the drop did nothing.
 *
 * NOTE(i18n): Hardcoded English; extract if i18n is added.
 */
export const DROP_REFUSAL = {
  readOnlyBoard: 'This board is read-only — stage changes are not saved.',
  stageChangeUnsupported: 'This collection does not support stage changes.',
  terminalLaneHint: (label: string) =>
    `“${label}” is set through the API, CLI, or MCP — dragging here will not change the stage.`,
  terminalLaneToast: (label: string) =>
    `“${label}” needs a reason, so it is set through the API, CLI, or MCP rather than by dragging.`,

  // ── Queue reorder (ft-ready-queue-view) ──
  readOnlyQueue: 'This queue is read-only — the order is not saved.',
  reorderUnsupported: 'This collection does not support drag reordering.',
  /**
   * Cross-band drags are an explicitly optional convenience in contract §10 and
   * are not implemented, so the refusal names the way to get the same result.
   * `bandLabel` is the destination priority's label, resolved by the caller.
   */
  crossBandToast: (taskName: string, bandLabel: string) =>
    `Drag reordering works within one priority band. Change the priority of ` +
    `“${taskName}” to move it into ${bandLabel}.`,
  /**
   * No client is attached, so nothing can be persisted. `ft-app` always assigns
   * one, making this a defensive path — but a reorder that cannot be saved must
   * still say so rather than move the row and stay quiet.
   */
  reorderNotConnected: 'Not connected to the server — the new order was not saved.',
  /**
   * A previous reorder is still being saved. Two overlapping reorders interleave
   * their writes, and a rollback from the first would clobber ranks the second
   * already persisted, so the second gesture is refused rather than queued.
   */
  reorderBusy: 'Still saving the last reorder — wait for it to finish, then try again.',
} as const;

/**
 * A write that FAILED, as distinct from one this UI REFUSED.
 *
 * Deliberately not part of `DROP_REFUSAL`. A refusal is this UI declining a
 * gesture before anything is sent; a failure is the server having been asked
 * and something having gone wrong afterwards. Folding these words into
 * `DROP_REFUSAL` would widen a constant whose precision is the reason it
 * exists, and would make "refusal" mean two different things at the same seam.
 *
 * They live here for the same reason the refusals do: this is vocabulary a user
 * reads, and the anchor test can only pin what it can import.
 *
 * NOTE(i18n): Hardcoded English; extract if i18n is added.
 */
export const WRITE_FAILURE = {
  /**
   * A queue reorder writes ranks one at a time, so a later write can fail after
   * earlier ones have already been persisted. `ft-ready-queue-view` rolls the
   * whole band back locally, which leaves the local store disagreeing with the
   * server until the next snapshot — hence "reload", which is the actionable
   * half and the reason `ft-app` prefers this message over the raw error.
   */
  partialRenumber: 'Reordering the queue failed part way through — reload to see the saved order.',
} as const;

export function isUnsuccessfulTerminalStage(stage: TaskStage): boolean {
  return stage === TaskStage.WONT_FIX || stage === TaskStage.CANCELLED || stage === TaskStage.DUPLICATE;
}

export function availabilityLabel(task: Task): string {
  if (task.availability?.available) return 'Available';
  const reasons = task.availability?.reasons.filter((reason) => reason !== AvailabilityReason.UNSPECIFIED) ?? [];
  if (reasons.length === 0) return 'Unavailable';
  return reasons.map((reason) => AVAILABILITY_REASON_LABEL[reason] ?? String(reason)).join(', ');
}

/**
 * Whether a hold reason is actually set.
 *
 * `undefined` and `UNSPECIFIED` (0) both mean "not held", and every caller has
 * to normalise both. `toObject({ defaults: false })` omits zero-valued enums so
 * an unset reason normally arrives as `undefined` — but if the proto ever
 * declares the field `optional` and sends an explicit 0, a bare
 * `!== undefined` test would treat every task as held.
 */
export function hasHoldReason(reason: TaskHoldReason | undefined): boolean {
  return reason !== undefined && reason !== TaskHoldReason.UNSPECIFIED;
}

export function holdReasonLabel(reason: TaskHoldReason | undefined): string {
  if (!hasHoldReason(reason)) return '';
  return HOLD_REASON_LABEL[reason!] ?? String(reason);
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

/**
 * The rank band a task belongs to: every task sharing its collection and its
 * priority band, in queue order.
 *
 * Contract §4.6 scopes `rank` to (collection, priority band), so this is the
 * exact set a reorder's arithmetic may look at. It is deliberately NOT "the
 * rows on screen". A task can be missing from the queue for three unrelated
 * reasons, and only one of them says anything about its rank:
 *
 * 1. **The view filter.** The user narrowed the queue by search text, stage, or
 *    availability reason. Purely presentational — those tasks still hold ranks
 *    in the band, so a reorder that ignored them would hand out ranks already
 *    in use.
 * 2. **Availability.** The server reports the task as unavailable: held,
 *    blocked by a dependency, or not started yet. Also temporary — the hold is
 *    released, the blocker closes, the start date arrives, and the task walks
 *    straight back into the queue carrying the rank it had all along. Its rank
 *    is live and must anchor the arithmetic.
 * 3. **A closed stage.** Completed, won't fix, duplicate, cancelled. This one
 *    is different in kind: terminal tasks do not re-enter the queue, so their
 *    ranks are dead. Counting them would wedge live ranks into ever-smaller
 *    gaps and force renumbers that buy nothing. Mirrors the server's
 *    `store.IsTerminalStage` (PR #191).
 *
 * So membership turns on stage, not on availability — with one union clause.
 * `isQueueMember` is the caller's queue-membership predicate (`isReady`), and
 * server-reported availability outranks stage everywhere else in this UI: a
 * closed task the server still calls available IS rendered in the queue and IS
 * draggable. Excluding it here would let a visible row be reordered against a
 * band it is not part of — a silent no-op. If it is on screen, it is in the
 * band.
 */
export function rankBand(
  task: Task,
  candidates: readonly Task[],
  isQueueMember: (candidate: Task) => boolean,
): Task[] {
  const bandPriority = priorityRank(task.priority);
  return candidates
    .filter(
      (candidate) =>
        candidate.collectionId === task.collectionId &&
        priorityRank(candidate.priority) === bandPriority &&
        (!isClosedStage(candidate.stage) || isQueueMember(candidate)),
    )
    .sort(compareAcceptedQueueOrder);
}

/**
 * The words for "this task is stranded behind an abandoned prerequisite".
 *
 * One phrase, five places: the card badge, the Availability filter option, the
 * active-filter chip, the dashboard tile, and the inspector's attention callout
 * (`calloutTitle` below). They have to agree — a user who sees "Needs attention"
 * on a card has to be able to find the control that lists every other card
 * wearing it, and a second wording would hide the link.
 *
 * `label` alone cannot say *why*, and the why is the whole point: contract §11
 * states that `cancelled` and `wont_fix` do not automatically unblock
 * dependents, so these tasks are stranded by design and no process will ever
 * surface them. `explanation` carries that, and is what the tile shows on hover.
 *
 * NOTE(i18n): Hardcoded English; extract if i18n is added.
 */
export const ATTENTION = {
  label: 'Needs attention',
  explanation:
    'Blocked by a prerequisite that was cancelled, dropped as a duplicate, or ' +
    "won't be fixed. Closing a prerequisite that way does not unblock its " +
    'dependents, so nothing will clear these on its own.',
  /** Completes the dashboard tile's accessible name: "<label>: 3 — <tileAction>". */
  tileAction: 'click to list them on the board',
  /**
   * Heading of the inspector's attention callout.
   *
   * Deliberately identical to `label`. The inspector panel and the card badge
   * are on screen at the same time for the same task, so a longer or smarter
   * phrasing here reads as a *different* state rather than the same one seen
   * up close.
   */
  calloutTitle: 'Needs attention',
  /**
   * Body of the inspector's attention callout, which has room to say what the
   * badge cannot.
   *
   * Carries the same permanence `explanation` does — contract §11 means these
   * prerequisites will never unblock this task on their own. Wording that says
   * only that a prerequisite "is still blocking" implies the block is merely
   * current, which is the reading `explanation` exists to prevent.
   */
  calloutBody: (n: number): string =>
    n === 1
      ? 'A prerequisite was cancelled, dropped as a duplicate, or will not be ' +
        'fixed. Closing it that way does not unblock this task, so nothing ' +
        'will clear it on its own.'
      : `${n} prerequisites were cancelled, dropped as duplicates, or will not ` +
        'be fixed. Closing them that way does not unblock this task, so ' +
        'nothing will clear it on its own.',
} as const;

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
