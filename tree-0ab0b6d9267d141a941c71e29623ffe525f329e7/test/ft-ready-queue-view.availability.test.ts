import { describe, expect, it } from 'vitest';
import '../src/components/ready-queue/ft-ready-queue-view.js';
import {
  AvailabilityReason,
  RelationshipType,
  TaskHoldReason,
  TaskStage,
  type Task,
} from '../src/gen/types.js';
import { mount, queryAllDeep, textDeep } from './helpers/dom.js';
import { storeWith, task, user } from './helpers/fixtures.js';

const FUTURE = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

function renderedIds(view: Element): string[] {
  return queryAllDeep<HTMLElement>(view, '.queue-row .task-title').map((cell) =>
    (cell.textContent ?? '').trim(),
  );
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

  it('renders the server availability reasons on the row', async () => {
    const held = task({
      id: 'held',
      name: 'held',
      availability: { available: true, reasons: [] },
    });
    const view = await mountQueue([held]);

    expect(textDeep(view)).toContain('Available');
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
