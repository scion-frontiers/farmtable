import { describe, expect, it } from 'vitest';
import '../src/components/ready-queue/ft-ready-queue-view.js';
import {
  AvailabilityReason,
  RelationshipType,
  TaskHoldReason,
  TaskStage,
  type Task,
} from '../src/gen/types.js';
import { availabilityLabel } from '../src/util/task-state-utils.js';
import { mount, queryAllDeep, textDeep } from './helpers/dom.js';
import { storeWith, task, user } from './helpers/fixtures.js';

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

function renderedIds(view: Element): string[] {
  return queryAllDeep<HTMLElement>(view, '.queue-row .task-title').map((cell) =>
    (cell.textContent ?? '').trim(),
  );
}

/**
 * The availability badges rendered *inside the rows*.
 *
 * Direct children of `.queue-row` only, so the priority badge (nested in
 * `span.priority-cell`) is excluded, and `.blocks-badge` is filtered by class.
 * Anything looser lets a header or a neighbouring badge answer for this one.
 */
function availabilityBadges(view: Element): HTMLElement[] {
  return queryAllDeep<HTMLElement>(view, '.queue-row > sl-badge:not(.blocks-badge)');
}

async function mountQueue(tasks: Task[], props: Record<string, unknown> = {}) {
  return mount<HTMLElement>('ft-ready-queue-view', { store: storeWith(...tasks), ...props });
}

describe('ft-ready-queue-view — server availability is authoritative', () => {
  it('renders a task the server marks available even when the local fallback would reject it', async () => {
    // Triage + assigned + held: every local fallback rule says "not ready".
    const serverSaysYes = task({
      id: 'server-yes',
      name: 'server-yes',
      stage: TaskStage.TRIAGE,
      assignees: [user('u1')],
      holdReason: TaskHoldReason.WAITING_FOR_INPUT,
      availability: { available: true, reasons: [] },
    });

    const view = await mountQueue([serverSaysYes]);

    expect(renderedIds(view)).toEqual(['server-yes']);
  });

  it('omits a task the server marks unavailable even when the local fallback would accept it', async () => {
    // Accepted, unassigned, no hold, no blockers: the local fallback says "ready".
    const serverSaysNo = task({
      id: 'server-no',
      name: 'server-no',
      stage: TaskStage.ACCEPTED,
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });

    const view = await mountQueue([serverSaysNo]);

    expect(renderedIds(view)).toEqual([]);
    expect(textDeep(view)).toContain('All clear!');
  });

  /**
   * Scoped to the row, deliberately.
   *
   * The previous version of this test asserted `textDeep(view)` contains
   * "Available", which the *header* ("Available Queue (1)") satisfies before
   * any row is examined — deleting the availability badge from the row left it
   * green. The badge is the claim, so the badge is what gets queried.
   *
   * The expected text comes from the real `availabilityLabel()` rather than a
   * literal, so this cannot drift from production wording, and it is compared
   * against the badge's own text rather than the whole subtree.
   */
  it('renders the availability badge on the row itself, not merely in the header', async () => {
    const available = task({
      id: 'available',
      name: 'available',
      availability: { available: true, reasons: [] },
    });
    const view = await mountQueue([available]);

    const badges = availabilityBadges(view);
    expect(badges).toHaveLength(1);
    expect((badges[0].textContent ?? '').trim()).toBe(availabilityLabel(available));
    expect(badges[0].getAttribute('variant')).toBe('success');
  });

  /**
   * The complementary negative: the badge is conditional on the server having
   * reported availability at all, so a task carried only by the local fallback
   * must render no badge. Without this, a template that always emitted a
   * hardcoded "Available" badge would pass the test above.
   */
  it('renders no availability badge for a task the server said nothing about', async () => {
    const fallbackOnly = task({ id: 'fallback', name: 'fallback', stage: TaskStage.ACCEPTED });
    const view = await mountQueue([fallbackOnly]);

    expect(renderedIds(view)).toEqual(['fallback']);
    expect(availabilityBadges(view)).toHaveLength(0);
  });

  /**
   * CHARACTERISATION — documents a gap, does not endorse it. See finding F-4.
   *
   * The row's badge has a `variant=${available ? 'success' : 'neutral'}`
   * ternary and `availabilityLabel()` has an unavailable-reasons branch, but
   * neither is reachable from this view: `isReady()` drops every task the
   * server marks unavailable, so no row with `available: false` is ever
   * rendered, and `availabilityLabel()` returns 'Available' early whenever
   * `available` is true. The neutral half of that ternary is dead code here.
   *
   * This test pins the consequence rather than the mechanism: whatever
   * availability payload the server sends, a rendered queue row can only ever
   * show the success badge. If someone later makes unavailable tasks visible
   * (the availability filter suggests that was the intent), this test fails and
   * points at the branch that was never exercised.
   */
  it('can only ever show a success badge, because unavailable tasks are filtered out first', async () => {
    const withReasons = task({
      id: 'reasons',
      name: 'reasons',
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });
    const availableWithStaleReasons = task({
      id: 'stale',
      name: 'stale',
      // Server contradicts itself: available, but reasons are still populated.
      availability: { available: true, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    });

    const view = await mountQueue([withReasons, availableWithStaleReasons]);

    expect(renderedIds(view), 'the unavailable task is filtered out').toEqual(['stale']);
    const badges = availabilityBadges(view);
    expect(badges.map((badge) => badge.getAttribute('variant'))).toEqual(['success']);
    // `available: true` short-circuits, so the reasons never reach the user.
    expect(badges.map((badge) => (badge.textContent ?? '').trim())).toEqual(['Available']);
    expect(textDeep(view)).not.toContain('Blocked by dependency');
  });

  /**
   * CHARACTERISATION — see finding F-4.
   *
   * A held task that the server nonetheless reports as available renders in the
   * queue (asserted above) carrying a plain "Available" badge and no hold
   * indicator of any kind, unlike the inspector, which shows a hold badge. The
   * user cannot tell from the queue that the task is on hold.
   */
  it('shows no hold indicator on a held task the server reports as available', async () => {
    const heldButAvailable = task({
      id: 'held',
      name: 'held',
      holdReason: TaskHoldReason.WAITING_FOR_INPUT,
      availability: { available: true, reasons: [] },
    });

    const view = await mountQueue([heldButAvailable]);

    expect(renderedIds(view)).toEqual(['held']);
    expect(textDeep(view)).not.toMatch(/waiting for input/i);
    expect(textDeep(view)).not.toMatch(/\bon hold\b/i);
  });
});

describe('ft-ready-queue-view — local fallback applies only without server availability', () => {
  const fallbackCases: { label: string; task: Task; visible: boolean }[] = [
    {
      label: 'accepted, unassigned, unblocked',
      task: task({ id: 'ok', name: 'ok', stage: TaskStage.ACCEPTED }),
      visible: true,
    },
    {
      label: 'triage',
      task: task({ id: 'triage', name: 'triage', stage: TaskStage.TRIAGE }),
      visible: false,
    },
    {
      label: 'already assigned',
      task: task({ id: 'assigned', name: 'assigned', assignees: [user('u1')] }),
      visible: false,
    },
    {
      label: 'held',
      task: task({ id: 'held', name: 'held', holdReason: TaskHoldReason.DEFERRED }),
      visible: false,
    },
    {
      label: 'future start date',
      task: task({ id: 'future', name: 'future', startDate: FUTURE }),
      visible: false,
    },
    {
      label: 'terminal',
      task: task({ id: 'done', name: 'done', stage: TaskStage.COMPLETED }),
      visible: false,
    },
  ];

  for (const testCase of fallbackCases) {
    it(`${testCase.visible ? 'renders' : 'omits'} a task with no server availability that is ${testCase.label}`, async () => {
      const view = await mountQueue([testCase.task]);

      expect(renderedIds(view)).toEqual(testCase.visible ? [testCase.task.name] : []);
    });
  }

  it('omits a task with no server availability whose blocker is not completed', async () => {
    const blocker = task({ id: 'blocker', name: 'blocker', stage: TaskStage.WORKING });
    const dependent = task({
      id: 'dependent',
      name: 'dependent',
      relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: blocker.id }],
    });

    const view = await mountQueue([blocker, dependent]);

    expect(renderedIds(view)).toEqual([]);
  });

  it('renders a task with no server availability whose blocker completed', async () => {
    const blocker = task({ id: 'blocker', name: 'blocker', stage: TaskStage.COMPLETED });
    const dependent = task({
      id: 'dependent',
      name: 'dependent',
      relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: blocker.id }],
    });

    const view = await mountQueue([blocker, dependent]);

    expect(renderedIds(view)).toEqual(['dependent']);
  });
});

describe('ft-ready-queue-view — filters compose with availability', () => {
  it('applies the availability filter on top of the queue predicate', async () => {
    const available = task({
      id: 'available',
      name: 'available',
      availability: { available: true, reasons: [] },
    });
    const view = await mountQueue([available], { availabilityFilter: 'unavailable' });

    expect(renderedIds(view)).toEqual([]);
  });

  it('applies the assignee filter on top of the queue predicate', async () => {
    const mine = task({
      id: 'mine',
      name: 'mine',
      assignees: [user('u1')],
      availability: { available: true, reasons: [] },
    });
    const theirs = task({
      id: 'theirs',
      name: 'theirs',
      assignees: [user('u2')],
      availability: { available: true, reasons: [] },
    });

    const view = await mountQueue([mine, theirs], { assigneeFilter: 'u1' });

    expect(renderedIds(view)).toEqual(['mine']);
  });

  it('renders no deleted stage vocabulary in the queue', async () => {
    const available = task({
      id: 'available',
      name: 'available',
      availability: { available: true, reasons: [] },
    });
    const view = await mountQueue([available]);

    const text = textDeep(view);
    expect(text).not.toMatch(/\bReady\b/);
    expect(text).not.toMatch(/\bBlocked\b(?! by dependency)/);
    expect(text).not.toMatch(/\bBacklog\b/);
    expect(text).not.toMatch(/\bScheduled\b/);
  });
});
