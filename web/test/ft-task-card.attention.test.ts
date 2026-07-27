import { describe, expect, it } from 'vitest';
import '../src/components/kanban/ft-task-card.js';
import {
  AvailabilityReason,
  RelationshipType,
  TaskHoldReason,
  TaskStage,
  type Task,
} from '../src/gen/types.js';
import { mount, queryAllDeep, textDeep } from './helpers/dom.js';
import { storeWith, task } from './helpers/fixtures.js';
import type { TaskStore } from '../src/store/task-store.js';

const ATTENTION_BADGE = 'Needs attention';

function badges(card: Element): string[] {
  return queryAllDeep<HTMLElement>(card, '.state-badges sl-tag').map((tag) =>
    (tag.textContent ?? '').replace(/\s+/g, ' ').trim(),
  );
}

/** A dependent task that the server reports as dependency-blocked. */
function dependent(blockerId: string, overrides: Partial<Task> = {}): Task {
  return task({
    id: 'dependent',
    stage: TaskStage.ACCEPTED,
    availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
    relationships: [{ type: RelationshipType.BLOCKED_BY, targetTaskId: blockerId }],
    ...overrides,
  });
}

async function mountCard(subject: Task, store: TaskStore) {
  return mount<HTMLElement>('ft-task-card', { task: subject, store });
}

describe('ft-task-card — needs-attention badge', () => {
  for (const blockerStage of [TaskStage.CANCELLED, TaskStage.DUPLICATE, TaskStage.WONT_FIX] as const) {
    it(`shows "${ATTENTION_BADGE}" when blocked by a ${TaskStage[blockerStage]} prerequisite`, async () => {
      const blocker = task({ id: 'blocker', stage: blockerStage });
      const subject = dependent(blocker.id);
      const card = await mountCard(subject, storeWith(blocker, subject));

      expect(badges(card)).toContain(ATTENTION_BADGE);
    });
  }

  it('shows the badge when any one of several blockers is unsuccessfully terminal', async () => {
    const done = task({ id: 'done', stage: TaskStage.COMPLETED });
    const dead = task({ id: 'dead', stage: TaskStage.WONT_FIX });
    const subject = task({
      id: 'dependent',
      availability: { available: false, reasons: [AvailabilityReason.BLOCKED_BY_DEPENDENCY] },
      relationships: [
        { type: RelationshipType.BLOCKED_BY, targetTaskId: done.id },
        { type: RelationshipType.BLOCKED_BY, targetTaskId: dead.id },
      ],
    });
    const card = await mountCard(subject, storeWith(done, dead, subject));

    expect(badges(card)).toContain(ATTENTION_BADGE);
  });
});

describe('ft-task-card — needs-attention negative cases', () => {
  it('does not show the badge when the blocker completed successfully', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.COMPLETED });
    const subject = dependent(blocker.id);
    const card = await mountCard(subject, storeWith(blocker, subject));

    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge when the blocker is still in a non-terminal stage', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.WORKING });
    const subject = dependent(blocker.id);
    const card = await mountCard(subject, storeWith(blocker, subject));

    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge when the blocker task is missing from the store', async () => {
    const subject = dependent('not-loaded');
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge without a BLOCKED_BY_DEPENDENCY availability reason', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, {
      availability: { available: false, reasons: [AvailabilityReason.HELD] },
    });
    const card = await mountCard(subject, storeWith(blocker, subject));

    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge when the server reports the task as available', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, { availability: { available: true, reasons: [] } });
    const card = await mountCard(subject, storeWith(blocker, subject));

    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('does not show the badge when the relationship is not BLOCKED_BY', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, {
      relationships: [{ type: RelationshipType.RELATED, targetTaskId: blocker.id }],
    });
    const card = await mountCard(subject, storeWith(blocker, subject));

    expect(badges(card)).not.toContain(ATTENTION_BADGE);
  });

  it('renders no state badges at all for a plain task with no hold or availability', async () => {
    const subject = task({ id: 'plain' });
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).toEqual([]);
  });
});

describe('ft-task-card — hold and availability badges', () => {
  it('renders the hold reason label as a badge', async () => {
    const subject = task({ id: 'held', holdReason: TaskHoldReason.WAITING_FOR_INPUT });
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).toContain('Waiting for input');
  });

  it('renders Available for server-available tasks', async () => {
    const subject = task({ id: 'ok', availability: { available: true, reasons: [] } });
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).toContain('Available');
  });

  it('renders the server availability reasons for unavailable tasks', async () => {
    const subject = task({
      id: 'held',
      holdReason: TaskHoldReason.DEFERRED,
      availability: {
        available: false,
        reasons: [AvailabilityReason.HELD, AvailabilityReason.FUTURE_START_DATE],
      },
    });
    const card = await mountCard(subject, storeWith(subject));

    expect(badges(card)).toContain('Held, Future start date');
    expect(badges(card)).toContain('Deferred');
  });

  it('renders no deleted stage vocabulary on the card', async () => {
    const blocker = task({ id: 'blocker', stage: TaskStage.CANCELLED });
    const subject = dependent(blocker.id, { holdReason: TaskHoldReason.WAITING_FOR_INPUT });
    const card = await mountCard(subject, storeWith(blocker, subject));

    const text = textDeep(card);
    expect(text).not.toMatch(/\bReady\b/);
    expect(text).not.toMatch(/\bBacklog\b/);
    expect(text).not.toMatch(/\bScheduled\b/);
  });
});
